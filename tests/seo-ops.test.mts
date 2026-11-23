import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-seo-ops-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "seo-ops-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const ORIGIN = "https://www.knightmedicalbilling.com";

try {
  const indexnow = await import("../src/lib/seo/indexnow");
  const retention = await import("../src/lib/seo/retention");
  const sqlite = await import("../src/lib/sqlite");
  const store = await import("../src/lib/seo/store");

  const handle = sqlite.sqliteHandle();
  assert.ok(handle);
  const events = () => Number((handle.prepare("SELECT COUNT(*) n FROM seo_index_events").get() as { n: number }).n);

  // ---- key handling ----
  ok("short key rejected", indexnow.normaliseIndexNowKey("abc") === null);
  ok("invalid characters rejected", indexnow.normaliseIndexNowKey("bad key!!") === null);
  ok("valid key accepted", indexnow.normaliseIndexNowKey("a".repeat(32)) === "a".repeat(32));
  ok("missing env key is null", indexnow.indexNowKeyFromEnv({} as NodeJS.ProcessEnv) === null);

  // ---- url scoping ----
  ok("same host accepted", indexnow.isSubmittable(`${ORIGIN}/about`, ORIGIN));
  ok("www/apex equivalence respected", indexnow.isSubmittable("https://knightmedicalbilling.com/about", ORIGIN));
  ok("foreign host rejected", !indexnow.isSubmittable("https://evil.example/about", ORIGIN));
  const deduped = indexnow.dedupeUrls([`${ORIGIN}/a`, `${ORIGIN}/a/`, `${ORIGIN}/a?utm=1`, "https://evil.example/x"], ORIGIN);
  ok("urls are canonicalised and deduplicated", deduped.length === 1 && deduped[0].endsWith("/a"), deduped.join(","));

  // ---- no key: nothing is sent ----
  let calls = 0;
  const noKey = await indexnow.submitChangedUrls({
    urls: [`${ORIGIN}/a`], contentHashes: { [`${ORIGIN}/a`]: "h1" }, origin: ORIGIN, key: null,
    fetchImpl: async () => { calls += 1; return { status: 200 }; },
  });
  ok("without a key the submission is skipped", noKey.status === "skipped" && noKey.error === "indexnow_not_configured");
  ok("no request is made without a key", calls === 0);

  // ---- happy path + dedupe ----
  const key = "b".repeat(32);
  const first = await indexnow.submitChangedUrls({
    urls: [`${ORIGIN}/a`], contentHashes: { [`${ORIGIN}/a`]: "h1" }, origin: ORIGIN, key,
    fetchImpl: async ({ body }) => {
      ok("payload carries host, key and url list", body.host === "www.knightmedicalbilling.com" && Array.isArray(body.urlList) && body.urlList.length === 1);
      ok("key location points at the configured host", String(body.keyLocation).endsWith(`/${key}.txt`));
      return { status: 200 };
    },
  });
  ok("accepted submission reports submitted", first.status === "submitted" && first.httpStatus === 200);
  ok("submission is recorded", events() === 1);
  const again = await indexnow.submitChangedUrls({
    urls: [`${ORIGIN}/a`], contentHashes: { [`${ORIGIN}/a`]: "h1" }, origin: ORIGIN, key,
    fetchImpl: async () => { throw new Error("must not be called"); },
  });
  ok("unchanged content is never resubmitted", again.status === "skipped" && again.error === "already_submitted");
  const changed = await indexnow.submitChangedUrls({
    urls: [`${ORIGIN}/a`], contentHashes: { [`${ORIGIN}/a`]: "h2" }, origin: ORIGIN, key,
    fetchImpl: async () => ({ status: 202 }),
  });
  ok("changed content is submitted again", changed.status === "submitted" && changed.httpStatus === 202);
  ok("202 is treated as accepted", changed.accepted.length === 1);

  // ---- failure mapping ----
  for (const [status, code] of [[400, "bad_request"], [403, "key_not_verified"], [422, "url_outside_host"], [429, "rate_limited"], [500, "http_500"]] as const) {
    const result = await indexnow.submitChangedUrls({
      urls: [`${ORIGIN}/f${status}`], contentHashes: { [`${ORIGIN}/f${status}`]: "h" }, origin: ORIGIN, key,
      fetchImpl: async () => ({ status }),
    });
    ok(`HTTP ${status} maps to ${code}`, result.status === "failed" && result.error === code, String(result.error));
  }

  // ---- retention ----
  const old = Date.now() - 600 * 24 * 60 * 60 * 1000;
  handle.prepare("INSERT INTO seo_observations (source, check_id, subject_type, subject_key, observed_at, evidence_hash) VALUES ('rules','title_missing','url',?,?,?)")
    .run(`${ORIGIN}/old`, new Date(old).toISOString(), "hash-old");
  handle.prepare("INSERT INTO seo_observations (source, check_id, subject_type, subject_key, observed_at, evidence_hash) VALUES ('rules','title_missing','url',?,?,?)")
    .run(`${ORIGIN}/new`, new Date().toISOString(), "hash-new");
  handle.prepare("INSERT INTO seo_metrics_daily (source, date, dimension, dimension_key) VALUES ('gsc', ?, 'date', '')").run(new Date(old).toISOString().slice(0, 10));
  handle.prepare("INSERT INTO seo_metrics_daily (source, date, dimension, dimension_key) VALUES ('gsc', ?, 'date', '')").run(new Date().toISOString().slice(0, 10));
  handle.prepare("INSERT INTO seo_sync_runs (provider, kind, status, started_at, finished_at) VALUES ('gsc','sync','completed',?,?)").run(old, old);
  handle.prepare("INSERT INTO seo_sync_runs (provider, kind, status, started_at) VALUES ('gsc','sync','running',?)").run(Date.now());
  handle.prepare("INSERT INTO seo_pages (url, crawled_at) VALUES (?, ?)").run(`${ORIGIN}/old`, old);

  const pruned = retention.pruneSeoData();
  ok("old observations pruned, recent kept",
    pruned.observations === 1 && Number((handle.prepare("SELECT COUNT(*) n FROM seo_observations").get() as { n: number }).n) === 1);
  ok("old metrics pruned, recent kept",
    pruned.metrics === 1 && Number((handle.prepare("SELECT COUNT(*) n FROM seo_metrics_daily").get() as { n: number }).n) === 1);
  ok("old crawl pages pruned", pruned.crawlPages === 1);
  ok("finished old runs pruned", pruned.syncRuns === 1);
  ok("a running job is never pruned (it is the lock)",
    Number((handle.prepare("SELECT COUNT(*) n FROM seo_sync_runs WHERE status='running'").get() as { n: number }).n) === 1);
  ok("pruning is idempotent", (() => {
    const second = retention.pruneSeoData();
    return second.observations === 0 && second.metrics === 0 && second.crawlPages === 0 && second.syncRuns === 0;
  })());

  // ---- findings reader backing the admin page ----
  ok("findings reader returns an array", Array.isArray(store.listFindings(20)));

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
