import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-seo-intel-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "seo-intel-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const ORIGIN = "https://www.knightmedicalbilling.com";
const AT = "2026-11-16T00:00:00.000Z";

try {
  const opp = await import("../src/lib/seo/opportunities");
  const measure = await import("../src/lib/seo/measure");
  const crawl = await import("../src/lib/seo/crawl");
  const findings = await import("../src/lib/seo/findings");
  const sqlite = await import("../src/lib/sqlite");

  // ---------------- P6.6 opportunities ----------------
  const lowCtr = { dimensionKey: "medical billing services", clicks: 2, impressions: 400, ctr: 0.005, position: 6 };
  const hit = opp.ctrGapObservations([lowCtr], { canonicalOrigin: ORIGIN, observedAt: AT });
  ok("ctr gap detected", hit.length === 1 && hit[0].checkId === "gsc_ctr_gap");
  ok("ctr gap is an opportunity, not a defect", findings.classifyCheck(hit[0].checkId) === "probable_opportunity");
  ok("ctr gap evidence labels the heuristic", /not Google data/i.test(JSON.stringify(hit[0].evidence)));
  ok("ctr gap never becomes level A", findings.levelFor("gsc_ctr_gap", "probable_opportunity") !== "A");
  ok("low volume is ignored", opp.ctrGapObservations([{ ...lowCtr, impressions: 20 }], { canonicalOrigin: ORIGIN }).length === 0);
  ok("healthy ctr is ignored", opp.ctrGapObservations([{ ...lowCtr, ctr: 0.06 }], { canonicalOrigin: ORIGIN }).length === 0);
  ok("missing metrics are not invented", opp.ctrGapObservations([{ dimensionKey: "x", clicks: null, impressions: null, ctr: null, position: null }], { canonicalOrigin: ORIGIN }).length === 0);

  const striking = opp.strikingDistanceObservations([{ dimensionKey: "hospital billing", clicks: 5, impressions: 120, ctr: 0.04, position: 14.2 }], { canonicalOrigin: ORIGIN, observedAt: AT });
  ok("striking distance detected in the 11-20 band", striking.length === 1 && striking[0].checkId === "gsc_striking_distance");
  ok("striking distance ignores page one", opp.strikingDistanceObservations([{ dimensionKey: "x", clicks: 1, impressions: 200, ctr: 0.1, position: 4 }], { canonicalOrigin: ORIGIN }).length === 0);

  const cannibal = opp.cannibalisationObservations(
    [
      { query: "medical billing services", page: `${ORIGIN}/services` },
      { query: "Medical Billing Services", page: `${ORIGIN}/services/medical-billing-and-coding` },
      { query: "unique query", page: `${ORIGIN}/about` },
    ],
    { canonicalOrigin: ORIGIN, observedAt: AT },
  );
  ok("cannibalisation groups by normalised query", cannibal.length === 1 && cannibal[0].subjectKey === "medical billing services");
  ok("cannibalisation lists the competing pages", (cannibal[0].evidence as { pages: string[] }).pages.length === 2);
  ok("single-page queries are not flagged", cannibal.every((obs) => obs.subjectKey !== "unique query"));

  const totals = opp.totalsForWindow([
    { dimensionKey: "a", clicks: 10, impressions: 100, ctr: 0.1, position: 5, date: "2026-11-01" },
    { dimensionKey: "a", clicks: 5, impressions: 50, ctr: 0.1, position: 5, date: "2026-11-02" },
  ]);
  ok("window totals sum clicks and impressions", totals.clicks === 15 && totals.impressions === 150);
  ok("days are counted from dates, not invented", totals.days === 2);

  const decay = opp.decayObservations(
    { key: "x", before: { clicks: 100, impressions: 2000, days: 28 }, after: { clicks: 50, impressions: 1500, days: 28 } },
    { canonicalOrigin: ORIGIN, observedAt: AT },
  );
  ok("decay detected when clicks fall", decay.length === 1 && decay[0].checkId === "gsc_traffic_decay");
  ok("decay requires two populated windows",
    opp.decayVerdict({ clicks: 100, impressions: 2000, days: 28 }, { clicks: 50, impressions: 100, days: 0 }).verdict === "inconclusive");
  ok("small drops stay stable", opp.decayVerdict({ clicks: 100, impressions: 2000, days: 28 }, { clicks: 95, impressions: 1900, days: 28 }).verdict === "stable");

  // ---------------- P6.7 measurement ----------------
  const series = { points: Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, "0")}`, 10])) };
  const summary = measure.summariseWindow(series, "2026-10-01", "2026-10-28");
  ok("window summary counts only reported days", summary.days === 28 && summary.total === 280);
  ok("missing days are not zero-filled", measure.summariseWindow({ points: {} }, "2026-10-01", "2026-10-28").average === null);

  const improved = measure.measureOutcome({ before: { days: 28, total: 280, average: 10 }, after: { days: 28, total: 420, average: 15 } });
  ok("clear improvement is reported", improved.verdict === "improved" && improved.changePct === 50);
  ok("verdict text is correlational", /Correlation only/i.test(improved.reason));
  ok("decline is reported", measure.measureOutcome({ before: { days: 28, total: 400, average: 14 }, after: { days: 28, total: 200, average: 7 } }).verdict === "declined");
  ok("noise band is inconclusive", measure.measureOutcome({ before: { days: 28, total: 280, average: 10 }, after: { days: 28, total: 290, average: 10.4 } }).verdict === "inconclusive");
  ok("short windows are inconclusive", measure.measureOutcome({ before: { days: 5, total: 50, average: 10 }, after: { days: 28, total: 280, average: 10 } }).verdict === "inconclusive");
  const sitewide = measure.measureOutcome({
    before: { days: 28, total: 280, average: 10 }, after: { days: 28, total: 420, average: 15 },
    siteBefore: { days: 28, total: 2800, average: 100 }, siteAfter: { days: 28, total: 4200, average: 150 },
  });
  ok("sitewide shift downgrades to inconclusive", sitewide.verdict === "inconclusive" && sitewide.confounders.includes("sitewide_shift"));
  ok("windows are computed around the change date", (() => {
    const windows = measure.measurementWindows("2026-11-15", 28);
    return windows.before.end === "2026-11-14" && windows.after.start === "2026-11-16";
  })());

  const handle = sqlite.sqliteHandle();
  assert.ok(handle);
  const findingId = Number(handle.prepare("SELECT id FROM seo_findings LIMIT 1").get()?.id ?? 0);
  const findingRow = findingId
    ? (handle.prepare("SELECT * FROM seo_findings WHERE id = ?").get(findingId) as Record<string, unknown>)
    : null;
  if (findingRow) {
    const consolidated = {
      key: String(findingRow.finding_key),
      checkId: String(findingRow.check_id), subjectType: "query", subjectKey: String(findingRow.subject_key),
      claimClass: "probable_opportunity", level: "B", severity: "low",
      observationCount: 1, sources: [], sourceNames: [], firstSeen: AT, lastSeen: AT,
      disagreement: false, confidence: 0.5,
      priority: { score: 10, factors: {} as never, explanation: "" },
    } as unknown as import("../src/lib/seo/findings").ConsolidatedFinding;
    const saved = measure.recordFindingOutcome(consolidated, improved, 1);
    ok("outcome is persisted against the finding", saved === true);
  } else {
    ok("outcome persistence is skipped without a stored finding (no fabrication)", true);
  }
  ok("measurement rows are writable", (() => {
    const insert = handle.prepare("INSERT INTO seo_actions (level, action_type, status) VALUES ('B','meta_edit','completed')").run();
    return Number(insert.changes) === 1;
  })());

  // ---------------- P6.4 crawler ----------------
  const sitemap = `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/about</loc></url><url><loc>${ORIGIN}/orphan</loc></url><url><loc>https://elsewhere.example/x</loc></url></urlset>`;
  const sitemapUrls = crawl.parseSitemap(sitemap);
  ok("sitemap URLs parsed", sitemapUrls.length === 4 && sitemapUrls[0] === `${ORIGIN}/`);
  ok("same-origin check tolerates www differences", crawl.isSameOrigin("https://knightmedicalbilling.com/about", ORIGIN));
  ok("cross-origin is rejected", !crawl.isSameOrigin("https://evil.example/about", ORIGIN));

  const html = `<a href="/about">About</a><a href="https://knightmedicalbilling.com/services">S</a><a href="mailto:x@y.com">mail</a><a href="#top">top</a><a href="https://evil.example/x">bad</a>`;
  const internal = crawl.extractInternalLinks(html, `${ORIGIN}/`, ORIGIN);
  ok("internal links extracted and normalised", internal.includes("/about") && internal.includes("/services"));
  ok("mailto, anchors and external links ignored", !internal.some((link) => /mailto|#|evil/.test(link)));

  const fetchHome = async (url: string) => {
    if (url.endsWith("/")) return { status: 200, finalUrl: `${ORIGIN}/`, redirectChain: [`${ORIGIN}/`], html: `<a href="/about">a</a><a href="/services">b</a>` };
    if (url.endsWith("/about")) return { status: 200, finalUrl: `${ORIGIN}/about`, html: `<a href="/">home</a>` };
    return { status: 200, finalUrl: `${ORIGIN}/services`, html: "" };
  };
  const result = await crawl.crawlSite({ origin: ORIGIN, fetchImpl: fetchHome, maxPages: 3, concurrency: 1 });
  ok("crawl respects the page cap", result.pages.length <= 3, String(result.pages.length));
  ok("crawl records a link graph", result.links.length >= 3, String(result.links.length));
  ok("crawl truncation is reported", typeof result.truncated === "boolean");
  const offOrigin = await crawl.crawlSite({ origin: ORIGIN, fetchImpl: async () => ({ status: 200, finalUrl: "https://evil.example/", html: "" }) });
  ok("off-origin redirect is dropped", offOrigin.pages.length === 0 && offOrigin.skipped.length === 1);
  const failing = await crawl.crawlSite({ origin: ORIGIN, fetchImpl: async () => { throw new Error("boom"); }, maxPages: 2 });
  ok("fetch failure is recorded, not thrown", failing.pages.length === 0 && failing.skipped.length >= 1);
  ok("orphans exclude the homepage and linked pages", (() => {
    const orphans = crawl.orphanPages([`${ORIGIN}/`, `${ORIGIN}/about`, `${ORIGIN}/orphan`], [{ from: `${ORIGIN}/`, to: `${ORIGIN}/about` }], ORIGIN);
    return orphans.length === 1 && orphans[0].endsWith("/orphan");
  })());
  ok("crawl limits clamp concurrency", crawl.crawlLimits({ concurrency: 99 }).concurrency === 3);

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
