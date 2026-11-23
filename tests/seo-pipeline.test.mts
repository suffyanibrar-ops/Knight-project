import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-seo-pipeline-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "seo-pipeline-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const ORIGIN = "https://www.knightmedicalbilling.com";
const AT = "2026-11-16T00:00:00.000Z";

try {
  const pipeline = await import("../src/lib/seo/pipeline");
  const observe = await import("../src/lib/seo/observe");
  const automation = await import("../src/lib/seo-automation");
  const sqlite = await import("../src/lib/sqlite");

  const handle = sqlite.sqliteHandle();
  assert.ok(handle);
  const count = (table: string) => Number((handle.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as { n: number }).n);

  // ---- sync bookkeeping (previously never written) ----
  const runId = observe.recordSyncRun({ provider: "gsc", kind: "sync", status: "completed", startedAt: Date.now() - 1000, finishedAt: Date.now(), requests: 3, rows: 42 });
  ok("sync run is persisted", typeof runId === "number" && count("seo_sync_runs") === 1);
  ok("sync health is readable", observe.recentSyncRuns(5)[0]?.rows === 42);

  // ---- crawl → observations ----
  const badHtml = `<!doctype html><html><head><title>Hi</title></head><body><img src="/x.jpg"><h1>a</h1><h1>b</h1><p>short</p></body></html>`;
  const goodHtml = `<!doctype html><html><head><title>Medical billing services for hospitals and clinics</title>
<link rel="canonical" href="${ORIGIN}/services"><meta name="description" content="${"Clear revenue cycle support for providers of every size. ".slice(0,120)}"></head>
<body><h1>Services</h1><h2>A</h2><h2>B</h2><h2>C</h2><p>${"We review every claim before submission. ".repeat(40)}</p><img src="/y.jpg" alt="team"></body></html>`;

  const fetchImpl = async (url: string) => {
    if (url.endsWith("/")) return { status: 200, finalUrl: `${ORIGIN}/`, html: `<a href="/services">s</a><a href="/bad">b</a>` };
    if (url.endsWith("/services")) return { status: 200, finalUrl: `${ORIGIN}/services`, html: goodHtml };
    return { status: 200, finalUrl: `${ORIGIN}/bad`, html: badHtml };
  };

  const crawl = await pipeline.runCrawlTask({ origin: ORIGIN, fetchImpl, maxPages: 5, observedAt: AT });
  ok("crawler fetched pages", crawl.pages >= 2, String(crawl.pages));
  ok("crawl produced observations", crawl.observations > 0);
  ok("observations persisted", crawl.stored === crawl.observations);
  ok("page snapshots stored", count("seo_pages") >= 2);
  ok("technical rules ran", crawl.checkIds.includes("h1_multiple") || crawl.checkIds.includes("title_length_out_of_range"), crawl.checkIds.join(","));

  // ---- observations → findings ----
  const before = count("seo_findings");
  const consolidation = pipeline.runConsolidationTask({ sinceDays: 30 });
  ok("consolidation read stored observations", consolidation.observationsRead === crawl.observations);
  ok("findings were created", consolidation.written > 0 && count("seo_findings") > before);
  ok("findings are deduplicated by check+subject", consolidation.findings === consolidation.written);
  ok("stored findings are readable by the admin reader", pipeline.storedFindings(50).length > 0);

  const rerun = pipeline.runConsolidationTask({ sinceDays: 30 });
  ok("re-consolidation does not duplicate findings", count("seo_findings") === before + consolidation.written, String(count("seo_findings")));
  ok("re-consolidation is stable", rerun.findings === consolidation.findings);

  // ---- a later crawl verifies fixes and resolves findings ----
  const fixedBadHtml = `<!doctype html><html><head><title>Bad page reporting for healthcare providers</title>
<link rel="canonical" href="${ORIGIN}/bad"><meta name="description" content="${"Clear revenue cycle support for providers of every size. ".slice(0,120)}"></head>
<body><main><h1>Services</h1><h2>A</h2><h2>B</h2><p>${"We review every claim before submission. ".repeat(40)}</p><img src="/y.jpg" alt="team"></main></body></html>`;
  const recrawl = await pipeline.runCrawlTask({
    origin: ORIGIN,
    observedAt: "2026-11-17T00:00:00.000Z",
    maxPages: 5,
    fetchImpl: async (url: string) => {
      if (url.endsWith("/bad")) return { status: 200, finalUrl: `${ORIGIN}/bad`, html: fixedBadHtml };
      return fetchImpl(url);
    },
  });
  ok("a fixed page resolves its prior confirmed findings", recrawl.resolved > 0, String(recrawl.resolved));
  const resolvedRows = handle.prepare("SELECT check_id FROM seo_findings WHERE status = 'resolved'").all() as { check_id: string }[];
  ok("resolved findings keep their identity for verification",
    resolvedRows.some((row) => row.check_id === "h1_multiple" || row.check_id === "image_alt_missing"),
    resolvedRows.map((row) => row.check_id).join(","));
  ok("resolved findings leave the open queue", !pipeline.storedFindings(200).some((finding) => finding.subjectKey.endsWith("/bad") && finding.checkId === "h1_multiple"));

  // ---- legacy malformed Bing subject is repaired, not displayed as a page ----
  handle.prepare(
    `INSERT INTO seo_findings
      (finding_key, check_id, subject_type, subject_key, claim_class, level, severity, status, confidence,
       priority_score, explanation, observation_count, source_names_json, disagreement, first_seen, last_seen, updated_at)
     VALUES (?, 'bing_traffic_stats', 'site', '/Date(1794', 'probable_opportunity', 'B', 'info', 'open', 0.5,
       10, 'legacy malformed date', 1, '["bing"]', 0, ?, ?, ?)`,
  ).run("legacy-malformed-bing", AT, AT, Date.now());
  pipeline.runConsolidationTask({ sinceDays: 30 });
  const legacy = handle.prepare("SELECT status FROM seo_findings WHERE finding_key = 'legacy-malformed-bing'").get() as { status: string } | undefined;
  ok("a malformed Bing date subject is resolved, not left open", legacy?.status === "resolved", JSON.stringify(legacy));

  // Historical observations from before the fix must not resurrect a resolved
  // finding when consolidation runs again.
  const stillResolved = handle.prepare("SELECT status FROM seo_findings WHERE check_id = 'h1_multiple' AND subject_key = ?").get(`${ORIGIN}/bad`) as { status: string } | undefined;
  ok("re-consolidation does not reopen a crawl-verified fix", stillResolved?.status === "resolved", JSON.stringify(stillResolved));

  // Raw Bing traffic totals are metrics, not findings.
  handle.prepare(
    `INSERT INTO seo_observations (source, check_id, subject_type, subject_key, observed_at, severity, evidence_hash)
     VALUES ('bing', 'bing_traffic_stats', 'site', '2026-11-17', ?, 'info', 'traffic-noise-fixture')`,
  ).run(AT);
  pipeline.runConsolidationTask({ sinceDays: 30 });
  const trafficFinding = handle.prepare("SELECT status FROM seo_findings WHERE check_id = 'bing_traffic_stats'").get() as { status: string } | undefined;
  ok("daily Bing traffic is not left as an open finding", trafficFinding?.status !== "open", JSON.stringify(trafficFinding));

  // A fresh observation of the same defect must reopen it.
  handle.prepare(
    `INSERT INTO seo_observations
      (source, check_id, subject_type, subject_key, observed_at, severity, evidence_hash)
     VALUES ('rules', 'h1_multiple', 'url', ?, ?, 'medium', ?)`,
  ).run(`${ORIGIN}/bad`, "2026-12-01T00:00:00.000Z", "reopen-fixture-hash");
  pipeline.runConsolidationTask({ sinceDays: 120 });
  const reopened = handle.prepare("SELECT status FROM seo_findings WHERE check_id = 'h1_multiple' AND subject_key = ?").get(`${ORIGIN}/bad`) as { status: string } | undefined;
  ok("a newer observation reopens the finding", reopened?.status === "open", JSON.stringify(reopened));

  // ---- task registration + dispatch ----
  ok("crawl_audit registered", (automation.SEO_TASK_TYPES as readonly string[]).includes("crawl_audit"));
  ok("consolidate_findings registered", (automation.SEO_TASK_TYPES as readonly string[]).includes("consolidate_findings"));
  ok("seven task types", automation.SEO_TASK_TYPES.length === 7, String(automation.SEO_TASK_TYPES.length));

  const consolidateRun = await automation.runSeoTask("consolidate_findings");
  ok("consolidation task dispatches", consolidateRun.ok === true && consolidateRun.status === "completed");
  ok("task dispatch records a run row", count("seo_automation_runs") > 0);

  // ---- admin page data source now populated ----
  ok("sync health has a row for the admin view", observe.recentSyncRuns(5).length >= 1);

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
