let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };
try {
  const c = await import("../src/lib/consent");
  const now = new Date("2026-11-16T00:00:00.000Z");
  ok("accept all enables optional categories", (() => { const r = c.acceptAll(now); return r.categories.analytics && r.categories.functional; })());
  ok("reject all disables optional categories", (() => { const r = c.rejectAll(now); return !r.categories.analytics && !r.categories.functional && !r.categories.marketing; })());
  ok("essential is always on", c.rejectAll(now).categories.essential === true);
  ok("essential-only disables optional categories", (() => { const r = c.essentialOnly(now); return r.decision === "essential" && r.categories.essential && !r.categories.analytics && !r.categories.functional && !r.categories.marketing; })());
  ok("essential-only round-trips", c.parseConsent(JSON.stringify(c.essentialOnly(now)))?.decision === "essential");
  ok("essential-only summary is explicit", /essential/i.test(c.consentSummary(c.essentialOnly(now))));
  ok("custom keeps only chosen categories", (() => { const r = c.buildConsent({ decision: "custom", analytics: true, functional: false, marketing: true, now }); return r.categories.analytics && !r.categories.functional && !r.categories.marketing; })());
  // Marketing is deliberately not enableable via custom: nothing on the site uses it.
  ok("marketing cannot be switched on by a custom choice", c.buildConsent({ decision: "custom", marketing: true, now }).categories.marketing === false);
  ok("timestamp recorded", c.acceptAll(now).decidedAt === now.toISOString());
  ok("version recorded", c.acceptAll(now).version === c.CONSENT_VERSION);

  ok("valid record parsed", c.parseConsent(JSON.stringify(c.acceptAll(now)))?.decision === "accepted");
  ok("corrupt record ignored", c.parseConsent("{broken") === null);
  ok("null ignored", c.parseConsent(null) === null);
  ok("stale version ignored", c.parseConsent(JSON.stringify({ ...c.acceptAll(now), version: "0" })) === null);
  ok("unknown decision ignored", c.parseConsent(JSON.stringify({ ...c.acceptAll(now), decision: "maybe" })) === null);
  ok("missing categories ignored", c.parseConsent(JSON.stringify({ version: c.CONSENT_VERSION, decision: "accepted" })) === null);

  ok("missing consent denies analytics", c.hasConsent(null, "analytics") === false);
  ok("rejected consent denies analytics", c.hasConsent(c.rejectAll(now), "analytics") === false);
  ok("accepted consent allows analytics", c.hasConsent(c.acceptAll(now), "analytics") === true);
  ok("analytics blocked without consent", c.analyticsAllowed(null, false, false) === false);
  ok("analytics blocked by legacy opt-out", c.analyticsAllowed(c.acceptAll(now), true, false) === false);
  ok("analytics blocked by do-not-track", c.analyticsAllowed(c.acceptAll(now), false, true) === false);
  ok("analytics allowed with consent", c.analyticsAllowed(c.acceptAll(now), false, false) === true);
  ok("summary reflects rejection", /rejected/i.test(c.consentSummary(c.rejectAll(now))));
  ok("summary reflects custom set", /analytics/i.test(c.consentSummary(c.buildConsent({ decision: "custom", analytics: true, now }))));
  console.log(`RESULT pass=${passed} fail=0`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  console.log("RESULT pass=0 fail=1"); process.exitCode = 1;
}
