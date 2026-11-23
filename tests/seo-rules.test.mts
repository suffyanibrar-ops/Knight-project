import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-seo-rules-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "seo-rules-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const ORIGIN = "https://www.knightmedicalbilling.com";

const BAD_PAGE = `<!doctype html><html><head>
<title>Short</title>
<link rel="canonical" href="https://knightmedicalbilling.com/other-page/">
<meta name="robots" content="noindex,follow">
<script type="application/ld+json">{ not json }</script>
</head><body>
<img src="/a.jpg">
<img src="/b.jpg" alt="">
<h1>A</h1><h1>B</h1>
<p>${"claim ".repeat(40)}</p>
</body></html>`;

const GOOD_PAGE = `<!doctype html><html><head>
<title>Medical billing services for hospitals and clinics</title>
<link rel="canonical" href="https://www.knightmedicalbilling.com/services">
<meta name="description" content="${"Clear revenue cycle support for healthcare providers and organisations of every size. ".slice(0, 120)}">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"Medical billing"}</script>
</head><body>
<h1>Medical billing services</h1>
<h2>Claims</h2><h2>Denials</h2><h2>Reporting</h2>
<p>${"We review every claim before submission and report the outcome each month. ".repeat(30)}</p>
<img src="/c.jpg" alt="Billing team reviewing claims">
<img src="/d.jpg" alt="" aria-hidden="true">
</body></html>`;

try {
  const obs = await import("../src/lib/seo/observations");
  const priority = await import("../src/lib/seo/priority");
  const technical = await import("../src/lib/seo/rules/technical");
  const content = await import("../src/lib/seo/rules/content");
  const findings = await import("../src/lib/seo/findings");
  const store = await import("../src/lib/seo/store");
  const sqlite = await import("../src/lib/sqlite");

  // ---------- observation layer ----------
  ok("url canonicalisation collapses host/slash/query",
    obs.canonicaliseUrl("https://knightmedicalbilling.com/services/?utm=x#frag", ORIGIN) === "https://www.knightmedicalbilling.com/services");
  ok("root path preserved",
    obs.canonicaliseUrl("https://knightmedicalbilling.com", ORIGIN) === "https://www.knightmedicalbilling.com/");
  ok("domain property key is never URL-normalised",
    obs.normaliseSubjectKey("site", "sc-domain:knightmedicalbilling.com", ORIGIN) === "sc-domain:knightmedicalbilling.com");

  const baseObs = {
    source: "rules" as const,
    checkId: "title_missing",
    subjectType: "url" as const,
    subjectKey: `${ORIGIN}/x`,
    observedAt: "2026-11-16T00:00:00.000Z",
    severity: "high" as const,
    metrics: { length: 0 },
  };
  ok("evidence hash is stable across key order",
    obs.evidenceHash(baseObs) === obs.evidenceHash({ ...baseObs, metrics: { length: 0 } }));
  ok("evidence hash changes when the measurement changes",
    obs.evidenceHash(baseObs) !== obs.evidenceHash({ ...baseObs, metrics: { length: 61 } }));
  ok("finding key ignores the tool", obs.findingKey(baseObs) === obs.findingKey({ ...baseObs, source: "crawl" }));

  // ---------- priority model ----------
  const p1 = priority.prioritise({ impact: 0.9, confidence: 0.9, ease: 0.5, safety: 0.6, level: "B", claimClass: "confirmed_defect", evidenceCount: 2 });
  const p2 = priority.prioritise({ impact: 0.2, confidence: 0.2, ease: 0.5, safety: 0.6, level: "B", claimClass: "confirmed_defect", evidenceCount: 2 });
  ok("priority score is bounded 0–100", p1.score >= 0 && p1.score <= 100 && p2.score >= 0 && p2.score <= 100, `${p1.score} / ${p2.score}`);
  ok("priority is monotonic in impact/confidence", p1.score > p2.score);
  ok("no singularity when ease and safety are zero",
    Number.isFinite(priority.prioritise({ impact: 1, confidence: 1, ease: 0, safety: 0, level: "C", claimClass: "confirmed_defect", evidenceCount: 1 }).score));
  const hyp = priority.prioritise({ impact: 1, confidence: 1, ease: 1, safety: 1, level: "A", claimClass: "ai_hypothesis", evidenceCount: 5 });
  ok("ai hypothesis is capped", hyp.score <= 55, String(hyp.score));
  const levelC = priority.prioritise({ impact: 1, confidence: 1, ease: 1, safety: 1, level: "C", claimClass: "confirmed_defect", evidenceCount: 5 });
  ok("level C is capped", levelC.score <= 60, String(levelC.score));
  const noEvidence = priority.prioritise({ impact: 1, confidence: 1, ease: 1, safety: 1, level: "A", claimClass: "confirmed_defect", evidenceCount: 0 });
  ok("missing evidence is capped", noEvidence.score <= 30, String(noEvidence.score));
  ok("weights are renormalised", Math.abs(Object.values(p1.factors.weights).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  ok("explanation names the level and version", /Level B/.test(p1.explanation) && p1.explanation.includes("v2.1"));

  // ---------- technical rules ----------
  const badObs = technical.technicalObservations({
    url: `${ORIGIN}/bad`,
    status: 404,
    finalUrl: `${ORIGIN}/bad`,
    redirectChain: [`${ORIGIN}/bad`],
    html: BAD_PAGE,
  }, { canonicalOrigin: ORIGIN, observedAt: "2026-11-16T00:00:00.000Z" });
  const badChecks = new Set(badObs.map((o) => o.checkId));
  for (const expected of ["http_error_status", "canonical_mismatch", "robots_noindex", "title_length_out_of_range", "h1_multiple", "image_alt_missing", "schema_invalid_json", "meta_description_missing"]) {
    ok(`bad page detected ${expected}`, badChecks.has(expected), [...badChecks].join(","));
  }

  const goodObs = technical.technicalObservations({
    url: `${ORIGIN}/services`,
    status: 200,
    finalUrl: `${ORIGIN}/services`,
    redirectChain: [`${ORIGIN}/services`],
    html: GOOD_PAGE,
  }, { canonicalOrigin: ORIGIN, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("clean page produces no defect observations", goodObs.length === 0, goodObs.map((o) => o.checkId).join(","));
  ok("decorative alt is not flagged", technical.imagesMissingAlt(GOOD_PAGE) === 0);

  // Regression: alt="" is valid decorative markup even without aria-hidden.
  ok("empty alt alone is not a missing alt",
    technical.imagesMissingAlt('<img src="/logo.png" alt=""><img src="/photo.jpg" alt="Team at work">') === 0);
  ok("truly absent alt is still flagged", technical.imagesMissingAlt('<img src="/a.png"><img src="/b.png" alt="">') === 1);
  ok("decorative count is reported as evidence",
    technical.decorativeImageCount('<img src="/logo.png" alt=""><img src="/b.png" alt="x">') === 1);

  // ---------- heading structure ----------
  ok("main content is extracted, not chrome",
    content.mainContent("<header><h2>Nav</h2></header><main><h1>Page</h1><p>Body</p></main><footer><p>Footer</p></footer>").includes("Body")
    && !content.mainContent("<header><h2>Nav</h2></header><main><h1>Page</h1><p>Body</p></main>").includes("Nav"));

  // Regression: Next.js streams dynamic pages; the first `<main>` is a skeleton
  // and the real markup arrives in a hidden segment. Both must be understood.
  const streamedDoc = `<html><head><title>Medical billing services for hospitals and clinics</title></head><body>
    <main><template id="B:0"></template><div role="status" aria-label="Loading page content"><span>Loading…</span></div></main>
    <footer><p>Footer copy here.</p></footer>
    <div hidden id="S:0"><section><h1>Services</h1><h2>Claims</h2><p>The real page copy.</p></section></div>
    <div hidden id="S:1"><section><h2>Denials</h2><p>More real copy.</p></section></div>
  </body></html>`;
  const streamed = content.mainContent(streamedDoc);
  ok("streaming fallback is recognised", content.isStreamingFallback('<main><!--$?--><div role="status" aria-label="Loading page content"></div></main>'));
  ok("streamed segments are joined", streamed.includes("The real page copy") && streamed.includes("More real copy"));
  ok("streaming fallback text is not used as content", !streamed.includes("Loading…") && !streamed.includes("Footer copy"));
  ok("hidden segment extraction keeps nested markup", content.streamedSegments('<div hidden id="S:0"><div><p>Nested</p></div></div>').includes("<p>Nested</p>"));
  ok("skipped heading levels detected", content.skippedHeadingLevels("<h1>A</h1><h2>B</h2><h4>C</h4>").length === 1);
  ok("valid hierarchy has no skips", content.skippedHeadingLevels("<h1>A</h1><h2>B</h2><h3>C</h3>").length === 0);
  const twoSections = `<main><h1>Page</h1><h2>One</h2><h3>Detail</h3><h2>Two</h2><p>${"We review every claim before submission. ".repeat(60)}</p></main>`;
  const twoSectionObs = content.contentObservations({ url: `${ORIGIN}/two`, html: twoSections }, { canonicalOrigin: ORIGIN, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("two logical sections are enough for a long page", !twoSectionObs.some((o) => o.checkId === "content_heading_structure"), twoSectionObs.map((o) => o.checkId).join(","));
  const skipped = content.contentObservations({ url: `${ORIGIN}/skip`, html: `<main><h1>Page</h1><h2>One</h2><h4>Jump</h4><p>${"We review every claim before submission. ".repeat(60)}</p></main>` }, { canonicalOrigin: ORIGIN, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("heading skip is flagged", skipped.some((o) => o.checkId === "content_heading_structure"));

  // Chrome text must not decide readability: readable article inside an unreadable shell.
  const shell = `<header>${"Nav item. ".repeat(40)}</header><main><h1>Page</h1><h2>A</h2><h2>B</h2><p>${"We review every claim before submission and explain the result clearly. ".repeat(25)}</p></main><footer>${"Legal notice. ".repeat(40)}</footer>`;
  const shellObs = content.contentObservations({ url: `${ORIGIN}/shell`, html: shell }, { canonicalOrigin: ORIGIN, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("main-content readability ignores header/footer", !shellObs.some((o) => o.checkId === "content_readability_hard"), shellObs.map((o) => o.checkId).join(","));

  // ---------- content rubric ----------
  const signals = content.analyseContent(GOOD_PAGE, "medical billing");
  ok("word count is measured", signals.words > 200, String(signals.words));
  ok("flesch score is finite", Number.isFinite(signals.fleschReadingEase));
  ok("keyword placement detected", signals.keywordInFirst100Words === true);

  // Thin-content floors are page-type aware.
  ok("utility pages use a lower thin floor",
    content.minimumWordsForPage(`${ORIGIN}/contact`) === 150
    && content.minimumWordsForPage(`${ORIGIN}/schedule-form`) === 150
    && content.minimumWordsForPage(`${ORIGIN}/services/medical-billing-and-coding`) === 300);
  ok("listing pages are recognised",
    content.isListingPage(`${ORIGIN}/specialties`) && content.isListingPage(`${ORIGIN}/services`)
    && !content.isListingPage(`${ORIGIN}/specialties/cardiology`));
  const longSentences = `<main><h1>Page</h1><h2>A</h2><h2>B</h2><p>${(`clear ${"word ".repeat(80)}. `).repeat(6)}</p></main>`;
  const longObs = content.contentObservations({ url: `${ORIGIN}/long`, html: longSentences }, { canonicalOrigin: ORIGIN, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("long sentences are still flagged", longObs.some((o) => o.checkId === "content_readability_hard"), longObs.map((o) => o.checkId).join(","));
  const listingText = `<main><h1>Specialties</h1><h2>Directory</h2>${Array.from({ length: 80 }, (_, i) => `<p>Cardiology ${i} anesthesia radiology eligibility verification reimbursement</p>`).join("")}</main>`;
  const listingObs = content.contentObservations({ url: `${ORIGIN}/specialties`, html: listingText }, { canonicalOrigin: ORIGIN, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("prose readability is not applied to a listing page", !listingObs.some((o) => o.checkId === "content_readability_hard"));

  const thin = content.contentObservations({ url: `${ORIGIN}/thin`, html: "<h1>Hi</h1><p>Two words.</p>" }, { canonicalOrigin: ORIGIN, minWords: 300, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("thin content flagged", thin.some((o) => o.checkId === "content_thin"));
  const keywordStuffed = content.contentObservations({ url: `${ORIGIN}/stuffed`, html: `<p>${"billing ".repeat(200)}</p>` }, { canonicalOrigin: ORIGIN, keyword: "billing", minWords: 100, observedAt: "2026-11-16T00:00:00.000Z" });
  ok("keyword density flagged", keywordStuffed.some((o) => o.checkId === "content_keyword_density"));

  // ---------- consolidation ----------
  const shared = [
    { ...baseObs, source: "rules" as const },
    { ...baseObs, source: "lighthouse" as const },
  ];
  const merged = findings.consolidate(shared);
  ok("two tools collapse into one finding", merged.length === 1, String(merged.length));
  ok("attribution is preserved", merged[0].sources.length === 2 && merged[0].sourceNames.join(",") === "lighthouse,rules");
  ok("agreement is not a conflict", merged[0].disagreement === false);
  ok("confidence rises with agreement", merged[0].confidence >= 0.7, String(merged[0].confidence));

  const conflicting = findings.consolidate([
    { ...baseObs, source: "rules" as const, severity: "high" as const },
    { ...baseObs, source: "bing" as const, severity: "info" as const },
  ]);
  ok("disagreement is recorded", conflicting[0].disagreement === true);
  ok("disagreement caps confidence", conflicting[0].confidence <= 0.45, String(conflicting[0].confidence));

  ok("claim class comes from the check", findings.classifyCheck("canonical_mismatch") === "confirmed_defect" &&
    findings.classifyCheck("gsc_ctr_gap") === "probable_opportunity" &&
    findings.classifyCheck("ai_hypothesis_x") === "ai_hypothesis" &&
    findings.classifyCheck("measure_lcp") === "verified_improvement");
  ok("level A is restricted", findings.levelFor("indexnow_notify", "confirmed_defect") === "A" &&
    findings.levelFor("canonical_mismatch", "confirmed_defect") === "C" &&
    findings.levelFor("title_length_out_of_range", "confirmed_defect") === "B");
  ok("hypotheses never reach level A", findings.levelFor("ai_idea", "ai_hypothesis") !== "A");

  // ---------- schema v13 + persistence ----------
  const status = sqlite.sqliteStatus();
  ok("sqlite available for migration test", status.available, status.error ?? "");
  const handle = sqlite.sqliteHandle();
  assert.ok(handle);
  ok("migration reached version 13", Number(handle.pragma("user_version", { simple: true })) === 13);
  const tables = new Set((handle.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((row) => row.name));
  for (const table of ["seo_properties", "seo_sync_runs", "seo_quota_ledger", "seo_metrics_daily", "seo_pages", "seo_observations", "seo_findings", "seo_actions", "seo_measurements", "seo_index_events"]) {
    ok(`table ${table} exists`, tables.has(table));
  }

  const inserted = store.saveObservations(badObs);
  ok("observations persist", inserted === badObs.length, `${inserted}/${badObs.length}`);
  ok("re-saving the same observations inserts nothing", store.saveObservations(badObs) === 0);

  const saved = store.saveFindings(findings.consolidate(badObs));
  ok("findings persist", saved > 0, String(saved));
  const firstPass = store.listFindings(50);
  ok("findings are readable and ordered", firstPass.length === saved && firstPass.every((row) => row.priorityScore >= 0));
  const firstSeen = firstPass.find((row) => row.checkId === "robots_noindex")?.firstSeen;

  store.saveFindings(findings.consolidate(badObs.map((o) => ({ ...o, observedAt: "2026-11-20T00:00:00.000Z" }))));
  const secondPass = store.listFindings(50);
  ok("re-consolidation does not duplicate findings", secondPass.length === firstPass.length, `${secondPass.length}/${firstPass.length}`);
  ok("first_seen is preserved across re-consolidation",
    secondPass.find((row) => row.checkId === "robots_noindex")?.firstSeen === firstSeen);

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
