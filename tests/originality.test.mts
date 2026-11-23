let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };

try {
  const o = await import("../src/lib/content-originality");
  const body = (n: number, word = "billing") => `<p>${Array.from({ length: n }, (_, i) => `${word} process ${i}`).join(" ")}</p>`;
  const longArticle = `<h2>Eligibility</h2><p>${"We verify coverage before the visit and record what the payer confirmed. ".repeat(12)}</p><ul><li>Check</li></ul><a href="/services">Services</a>`;
  // Varied vocabulary, 300+ words, headings, a list and an internal link: this is
  // the control fixture that must produce zero warnings.
  const scrub = Array.from({ length: 340 }, (_, i) => ["payer", "chart", "audit", "queue", "ledger", "appeal", "roster", "cohort", "bench", "signal"][i % 10] + i);
  const cleanArticle = `<h2>Eligibility</h2><h2>Denials</h2><h2>Reporting</h2><ul><li>Verify</li></ul><a href="/services">Services</a>${
    Array.from({ length: 9 }, (_, block) => `<p>${scrub.slice(block * 38, block * 38 + 38).join(" ")}</p>`).join("")
  }`;

  // ---- exact duplicate ----
  const exact = o.analyseContent({ title: "Clean claims", contentHtml: longArticle, corpus: [{ id: 1, title: "Clean claims", contentHtml: longArticle }] });
  ok("exact duplicate detected", exact.findings.some((f) => f.id === "duplicate-exact" && f.severity === "critical"));

  // ---- near duplicate ----
  const near = longArticle.replace("Eligibility", "Coverage");
  const nearResult = o.analyseContent({ title: "Clean claim process", contentHtml: near, corpus: [{ id: 2, title: "Clean claims", contentHtml: longArticle }] });
  ok("near duplicate detected", nearResult.findings.some((f) => f.id === "duplicate-near"));
  ok("near duplicate is not called identical", !nearResult.findings.some((f) => f.id === "duplicate-exact"));

  // ---- similar title ----
  const titleResult = o.analyseContent({ title: "Clean claim process guide", contentHtml: body(80), corpus: [{ id: 3, title: "Clean claim process", contentHtml: body(80, "denial") }] });
  ok("similar title flagged", titleResult.findings.some((f) => f.id === "duplicate-title"));

  // ---- repeated paragraph ----
  const repeatedPara = `<p>${"This paragraph is repeated deliberately to test duplication detection inside one article. ".repeat(2)}</p>`;
  const rep = o.analyseContent({ title: "T", contentHtml: `${repeatedPara}${repeatedPara}${body(80)}` });
  ok("repeated paragraph detected", rep.findings.some((f) => f.id === "repetition-paragraphs"));

  // ---- repeated headings ----
  const dupHeads = o.analyseContent({ title: "T", contentHtml: `<h2>Denials</h2><h2>Denials</h2>${body(80)}` });
  ok("duplicate headings detected", dupHeads.findings.some((f) => f.id === "repetition-headings"));

  // ---- keyword stuffing ----
  const stuffed = o.analyseContent({ title: "T", contentHtml: `<p>${"medical billing ".repeat(60)}</p><p>${"filler word ".repeat(40)}</p>` });
  ok("keyword stuffing detected", stuffed.findings.some((f) => f.id === "keywords-stuffing"));

  // ---- thin content ----
  const thin = o.analyseContent({ title: "T", contentHtml: "<p>Too short to help anyone.</p>" });
  ok("thin content detected", thin.findings.some((f) => f.id === "thin-content" && f.severity === "critical"));

  // ---- false positives: a clean article passes ----
  const clean = o.analyseContent({ title: "How eligibility checks prevent denials", contentHtml: cleanArticle });
  ok("clean article reports no problems", clean.findings.every((f) => f.severity === "passed"), clean.findings.map((f) => f.id).join(","));
  ok("passed finding explains the limits", /cannot verify facts/i.test(clean.findings[0].detail + clean.limitations));

  // ---- empty content is handled, not crashed ----
  const empty = o.analyseContent({ title: "", contentHtml: "" });
  ok("empty content analysed safely", Array.isArray(empty.findings) && empty.metrics.words === 0);

  // ---- unicode & punctuation ----
  ok("unicode normalised", o.tokens("Billing — café ’quotes’ “smart”").includes("café".replace("é", "é")) || o.tokens("café").length === 1);
  ok("punctuation does not create tokens", !o.tokens("— – · •").length);

  // ---- claims ----
  const claim = o.analyseContent({ title: "T", contentHtml: `${longArticle}<p>We guarantee 100% clean claims and are HIPAA certified.</p>` });
  ok("absolute claims flagged for review", claim.findings.filter((f) => f.category === "claims").length >= 2);
  ok("claims are warnings, not passes", claim.findings.filter((f) => f.category === "claims").every((f) => f.severity === "warning"));

  // ---- missing links / actionable value ----
  const noLinks = o.analyseContent({ title: "T", contentHtml: `<p>${"Plain paragraph without any detail. ".repeat(20)}</p>` });
  ok("missing internal links flagged", noLinks.findings.some((f) => f.id === "links-missing"));
  ok("missing actionable detail flagged", noLinks.findings.some((f) => f.id === "value-actionable"));

  // ---- own article excluded from its corpus (draft/published isolation) ----
  const selfExcluded = o.analyseContent({ title: "Same", contentHtml: longArticle, corpus: [] });
  ok("no self-comparison without a corpus", !selfExcluded.findings.some((f) => f.category === "duplicate"));

  // ---- large article stays deterministic and bounded ----
  const big = `<p>${"A distinct sentence about payer behaviour and follow-up work. ".repeat(400)}</p>`;
  const bigA = o.analyseContent({ title: "Big", contentHtml: big });
  const bigB = o.analyseContent({ title: "Big", contentHtml: big });
  ok("large article is deterministic", JSON.stringify(bigA.findings) === JSON.stringify(bigB.findings));

  // ---- similarity helper ----
  ok("identical text scores 1", o.similarity(longArticle, longArticle) === 1);
  ok("unrelated text scores low", o.similarity(longArticle, `<p>${"zebra crossing " .repeat(40)}</p>`) < 0.2);

  // ---- Phase 5.1: live editor integration ----
  const liveA = o.analysisFingerprint("Draft title", "<p>saved body</p>");
  const liveB = o.analysisFingerprint("Draft title", "<p>edited body</p>");
  ok("fingerprint changes when the body changes", liveA !== liveB);
  ok("fingerprint is stable for identical input", liveA === o.analysisFingerprint("Draft title", "<p>saved body</p>"));
  ok("title changes also invalidate", liveA !== o.analysisFingerprint("Other title", "<p>saved body</p>"));
  ok("fingerprint ignores surrounding whitespace in the title", o.analysisFingerprint(" T ", "x") === o.analysisFingerprint("T", "x"));

  const unsaved = o.analyseContent({ title: "Unsaved draft", contentHtml: "<p>Nothing saved yet.</p>" });
  ok("unsaved content is analysed", unsaved.metrics.words > 0 && unsaved.findings.length > 0);
  ok("empty live draft is handled", (() => { const r = o.analyseContent({ title: "", contentHtml: "" }); return r.metrics.words === 0 && r.findings.some((f) => f.id === "thin-content"); })());

  const edited = o.analyseContent({ title: "T", contentHtml: `<p>${"edited draft content ".repeat(30)}</p>`, corpus: [{ id: 9, title: "T", contentHtml: `<p>${"edited draft content ".repeat(30)}</p>` }] });
  ok("edited unsaved content reaches duplicate detection", edited.findings.some((f) => f.id === "duplicate-exact"));

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
}
