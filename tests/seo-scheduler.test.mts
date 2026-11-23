import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-seo-scheduler-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "seo-scheduler-password";
delete process.env.BING_WEBMASTER_API_KEY;

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const ORIGIN = "https://www.knightmedicalbilling.com";
const MINUTE = 60 * 1000;

try {
  const automation = await import("../src/lib/seo-automation");
  const scheduler = await import("../src/lib/seo/scheduler");
  const sqlite = await import("../src/lib/sqlite");

  const handle = sqlite.sqliteHandle();
  assert.ok(handle);
  const runs = () => handle.prepare("SELECT * FROM seo_automation_runs ORDER BY id").all() as Record<string, unknown>[];
  const ledger = (provider: string) =>
    handle.prepare("SELECT * FROM seo_quota_ledger WHERE provider = ? AND window_kind = 'day'").get(provider) as Record<string, unknown> | undefined;

  const baseSettings = {
    enabled: "true",
    discovery_interval_hours: "24",
    audit_interval_hours: "168",
    refresh_interval_hours: "168",
    gsc_interval_hours: "6",
    bing_interval_hours: "12",
    gsc_lookback_days: "3",
    gsc_max_requests_per_run: "10",
    gsc_daily_request_budget: "48",
    bing_daily_request_budget: "24",
  };
  await automation.setSeoSettings(baseSettings);
  ok("research ceiling defaults to 15 ideas", automation.SEO_SETTING_DEFAULTS.max_opportunities_per_run === "15");
  ok("research queries default to 6", automation.SEO_SETTING_DEFAULTS.max_queries_per_run === "6");
  ok("crawl coverage default covers the public site", Number(automation.SEO_SETTING_DEFAULTS.crawl_max_pages) >= 100);

  // ---------- 1 & 2: task registration, existing tasks preserved ----------
  ok("gsc_sync registered", (automation.SEO_TASK_TYPES as readonly string[]).includes("gsc_sync"));
  ok("bing_sync registered", (automation.SEO_TASK_TYPES as readonly string[]).includes("bing_sync"));
  ok("original three tasks preserved",
    ["opportunity_discovery", "technical_audit", "content_refresh"].every((task) => (automation.SEO_TASK_TYPES as readonly string[]).includes(task)));
  // Task count is asserted in the pipeline suite; keep this focused on the two
  // sync tasks being first-class scheduler members.
  ok("sync tasks are scheduler members",
    (automation.SEO_TASK_TYPES as readonly string[]).filter((task) => task.endsWith("_sync")).length === 2);

  // ---------- 3: dispatch through the existing scheduler ----------
  // No credentials exist in this environment, so dispatch must fail fast and
  // locally — before any network call.
  const dispatch = await automation.runSeoTask("gsc_sync");
  ok("gsc_sync dispatches through runSeoTask", dispatch.status === "failed");
  ok("gsc dispatch records a real run row", runs().some((row) => row.task_type === "gsc_sync" && row.status === "failed"));
  ok("missing GSC authorization is reported, not hidden", /gsc_not_connected/.test(String(dispatch.error)));
  const bingDispatch = await automation.runSeoTask("bing_sync");
  ok("bing_sync dispatches through runSeoTask", bingDispatch.status === "failed");
  ok("missing Bing key is reported", /missing_credentials|BING_WEBMASTER_API_KEY/.test(String(bingDispatch.error)), String(bingDispatch.error));

  // ---------- 4: independent interval configuration ----------
  ok("gsc default interval is 6h", scheduler.syncIntervalHours("gsc_sync", {}) === 6);
  ok("bing default interval is 12h", scheduler.syncIntervalHours("bing_sync", {}) === 12);
  ok("intervals are independent", scheduler.syncIntervalHours("gsc_sync", { gsc_interval_hours: "2", bing_interval_hours: "48" }) !==
    scheduler.syncIntervalHours("bing_sync", { gsc_interval_hours: "2", bing_interval_hours: "48" }));
  ok("interval minimum enforced", scheduler.syncIntervalHours("gsc_sync", { gsc_interval_hours: "0" }) === scheduler.MIN_INTERVAL_HOURS);
  ok("interval maximum enforced", scheduler.syncIntervalHours("gsc_sync", { gsc_interval_hours: "9999" }) === scheduler.MAX_INTERVAL_HOURS);

  // ---------- 5: disabled automation never runs ----------
  await automation.setSeoSettings({ ...baseSettings, enabled: "false" });
  ok("disabled scheduler returns no due tasks", (await automation.dueTasks()).length === 0);
  const disabledTick = await automation.runAutomationTick();
  ok("disabled tick reports disabled", disabledTick.enabled === false && disabledTick.ran.length === 0);
  await automation.setSeoSettings(baseSettings);

  // ---------- 6: due ordering is fair, tick stays bounded ----------
  const due = await automation.dueTasks();
  ok("tick is bounded to two tasks", due.length === 2, due.join(","));
  // Prove the sync tasks are schedulable in their own right: park the original
  // tasks as "just ran" and leave only the sync tasks overdue.
  handle.exec("DELETE FROM seo_automation_runs");
  for (const task of ["opportunity_discovery", "technical_audit", "content_refresh"]) {
    handle.prepare(
      "INSERT INTO seo_automation_runs (execution_id, task_type, status, started_at, retry_count, meta_json) VALUES (?, ?, 'completed', ?, 0, '{}')",
    ).run(`parked-${task}`, task, Date.now());
  }
  const syncDue = await automation.dueTasks();
  ok("both sync tasks become due when their interval elapses",
    syncDue.includes("gsc_sync") && syncDue.includes("bing_sync"), syncDue.join(","));

  // ---------- 7 & 8: quota + pagination accounting ----------
  handle.exec("DELETE FROM seo_quota_ledger");
  const pagedGsc = async ({ body }: { body: { startRow: number } }) => {
    if (body.startRow === 0) return { status: 200, json: { rows: Array.from({ length: 25_000 }, (_, i) => ({ keys: ["2026-11-13"], clicks: i + 1, impressions: 10 })), responseAggregationType: "byProperty" } };
    if (body.startRow === 25_000) return { status: 200, json: { rows: [{ keys: ["2026-11-13"], clicks: 1, impressions: 5 }], responseAggregationType: "byProperty" } };
    return { status: 200, json: { rows: [] } };
  };
  const paged = await scheduler.runSyncTask("gsc_sync", {
    settings: baseSettings,
    gsc: async () => ({ token: "test-token", propertyKey: "sc-domain:example.com", propertyKind: "domain", dates: ["2026-11-13"], fetchImpl: pagedGsc, maxRequests: 10 }),
  });
  ok("paginated sync completes", paged.status === "completed", JSON.stringify(paged));
  ok("pagination counted as two requests", paged.requests === 2, String(paged.requests));
  ok("ledger records actual requests", Number(ledger("gsc")?.requests) === 2, String(ledger("gsc")?.requests));
  ok("ledger records rows read", Number(ledger("gsc")?.rows_read) > 0);
  const gscRuns = runs().filter((row) => row.task_type === "gsc_sync");
  ok("completed run records request count in meta", /"requests":2/.test(String(gscRuns[gscRuns.length - 1]?.meta_json)));

  // ---------- 9: 401 / 403 ----------
  for (const [status, code] of [[401, "UNAUTHENTICATED"], [403, "PERMISSION_DENIED"]] as const) {
    const result = await scheduler.runSyncTask("gsc_sync", {
      settings: baseSettings,
      gsc: async () => ({ token: "t", propertyKey: "sc-domain:example.com", dates: ["2026-11-13"], fetchImpl: async () => ({ status, json: { error: { status: code } } }), maxRequests: 5 }),
    });
    ok(`HTTP ${status} fails the run`, result.status === "failed");
    ok(`HTTP ${status} preserves the status`, String(result.error).includes(String(status)) && String(result.error).includes(code), String(result.error));
  }

  // ---------- 10 & 11: 429 and 5xx ----------
  for (const status of [429, 500, 503]) {
    const before = Number(ledger("gsc")?.requests ?? 0);
    const result = await scheduler.runSyncTask("gsc_sync", {
      settings: baseSettings,
      gsc: async () => ({ token: "t", propertyKey: "sc-domain:example.com", dates: ["2026-11-13"], fetchImpl: async () => ({ status, json: null }), maxRequests: 5 }),
    });
    ok(`HTTP ${status} fails the run`, result.status === "failed");
    ok(`HTTP ${status} still records the attempted request`, Number(ledger("gsc")?.requests ?? 0) === before + 1, `${before} -> ${ledger("gsc")?.requests}`);
  }

  // ---------- 12: missing credentials (Bing) ----------
  const previousKey = process.env.BING_WEBMASTER_API_KEY;
  delete process.env.BING_WEBMASTER_API_KEY;
  const missingKey = await scheduler.runSyncTask("bing_sync", {
    settings: baseSettings,
    bing: async () => scheduler.loadBingDependencies(ORIGIN, async () => ({ status: 200, json: { d: [] } })),
  });
  ok("missing Bing key fails without a network call", missingKey.status === "failed" && /missing_credentials/.test(String(missingKey.error)), String(missingKey.error));
  if (previousKey) process.env.BING_WEBMASTER_API_KEY = previousKey;

  // ---------- 13: network failure ----------
  const timeout = await scheduler.runSyncTask("gsc_sync", {
    settings: baseSettings,
    gsc: async () => ({ token: "t", propertyKey: "sc-domain:example.com", dates: ["2026-11-13"], maxRequests: 5, fetchImpl: async () => { throw new Error("The operation was aborted due to timeout"); } }),
  });
  ok("network timeout is classified", timeout.status === "failed" && /network_timeout/.test(String(timeout.error)), String(timeout.error));

  // ---------- 14 & 15: duplicate-run prevention, lock release ----------
  const lock = scheduler.acquireTaskRun("bing_sync");
  ok("lock acquired", lock.acquired && typeof lock.runId === "number");
  const blocked = await scheduler.runSyncTask("bing_sync", {
    settings: baseSettings,
    bing: async () => ({ key: "k".repeat(32), siteUrl: ORIGIN, fetchImpl: async () => ({ status: 200, json: { d: [] } }) }),
  });
  ok("second Bing job is skipped while the first holds the lock", blocked.status === "skipped" && /already_running/.test(String(blocked.error)));
  scheduler.finishTaskRun(lock.runId!, { status: "failed", meta: {}, error: "simulated crash" });
  ok("lock released after a failed run", scheduler.acquireTaskRun("bing_sync").acquired === true);

  // ---------- 16 & 17: stale lock recovery, interrupted runs ----------
  const staleId = Number(handle.prepare(
    "INSERT INTO seo_automation_runs (execution_id, task_type, status, started_at, retry_count, meta_json) VALUES (?, 'gsc_sync', 'running', ?, 0, '{}')",
  ).run("stale-fixture", Date.now() - scheduler.STALE_LOCK_MS - MINUTE).lastInsertRowid);
  const recovered = await scheduler.runSyncTask("gsc_sync", {
    settings: baseSettings,
    gsc: async () => ({ token: "t", propertyKey: "sc-domain:example.com", dates: ["2026-11-13"], maxRequests: 5, fetchImpl: async () => ({ status: 200, json: { rows: [] } }) }),
  });
  ok("stale lock is recovered", recovered.status === "completed", JSON.stringify(recovered));
  const staleRow = handle.prepare("SELECT * FROM seo_automation_runs WHERE id = ?").get(staleId) as Record<string, unknown>;
  ok("interrupted run is marked failed, not deleted", staleRow.status === "failed" && /Interrupted/.test(String(staleRow.error)));
  const freshLock = scheduler.acquireTaskRun("gsc_sync");
  ok("recovery does not block the new run", freshLock.acquired === true);
  scheduler.finishTaskRun(freshLock.runId!, { status: "completed", meta: {} });

  // ---------- 18: partial synchronization ----------
  const partial = await scheduler.runSyncTask("gsc_sync", {
    settings: baseSettings,
    gsc: async () => ({
      token: "t", propertyKey: "sc-domain:example.com", dates: ["2026-11-13"], maxRequests: 5,
      fetchImpl: async ({ body }: { body: { startRow: number } }) =>
        body.startRow === 0
          ? { status: 200, json: { rows: Array.from({ length: 25_000 }, () => ({ keys: ["2026-11-13"], clicks: 1 })), responseAggregationType: "byProperty" } }
          : { status: 500, json: null },
    }),
  });
  ok("partial sync is reported as failed, never success", partial.status === "failed");
  ok("partial sync keeps the pages it did read", Number(partial.meta.pages) === 1, JSON.stringify(partial.meta));
  ok("partial sync preserves the failure detail", JSON.stringify(partial.meta.errors).includes("500"));

  // ---------- 19 & 20: repeated ticks, zero live calls ----------
  const realFetch = globalThis.fetch;
  let liveCalls = 0;
  globalThis.fetch = (async () => { liveCalls += 1; throw new Error("live network call attempted"); }) as typeof fetch;
  try {
    await automation.setSeoSettings({ ...baseSettings, enabled: "true" });
    const first = await automation.runAutomationTick();
    const second = await automation.runAutomationTick();
    ok("tick runs at most two tasks", first.ran.length <= 2, JSON.stringify(first.ran.map((r) => r.task)));
    ok("repeated tick does not duplicate dispatch",
      second.ran.every((entry) => !first.ran.some((prior) => prior.task === entry.task)), JSON.stringify(second.ran));
    ok("no live API call was made by the scheduler", liveCalls === 0, String(liveCalls));
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { rmSync(db + suffix, { force: true }); } catch {}
  }
}
