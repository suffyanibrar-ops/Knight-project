let passed = 0;
const ok = (name: string, condition: boolean, detail = "") => {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
};

try {
  const review = await import("../src/lib/revenue-review");
  const offers = await import("../src/lib/conversion-offers");

  // ---------- the single low-friction path ----------
  ok("exactly six concern choices", review.REVIEW_CONCERNS.length === 6);
  ok("concern ids are stable and unique", new Set(review.REVIEW_CONCERNS.map((item: { id: string }) => item.id)).size === 6);
  ok("denials resolves", review.reviewConcern("denials")?.id === "denials");
  ok("lookup is trimmed and case-insensitive", review.reviewConcern("  A/R  ")?.id === "ar");
  ok("unknown concern is ignored", review.reviewConcern("bogus") === null && review.reviewConcern(null) === null && review.reviewConcern(undefined) === null);
  ok("every concern stores a single primary-concern interest", review.REVIEW_CONCERNS.every((item: { interest: string }) => review.isPrimaryConcernInterest(item.interest)));
  ok("interests stay human-readable", review.REVIEW_CONCERNS.every((item: { interest: string }) => /^Primary concern: [a-z]/.test(item.interest)));

  // ---------- offers point at the same path ----------
  const hrefs = ["/", "/services/denial-management", "/services/accounts-receivable-management", "/services/credentialing-and-contracting"].map((path: string) => offers.offerForPath(path)?.ctaHref ?? "");
  ok("offer CTAs land on the consultation form", hrefs.every((href: string) => href.startsWith("/schedule-form")));
  ok("offer concern params are valid concern ids", hrefs.every((href: string) => {
    const value = new URL(href, "https://example.com").searchParams.get("concern");
    return value === null || review.reviewConcern(value) !== null;
  }), hrefs.join(" | "));
  ok("denial offer preselects denials", offers.offerForPath("/services/denial-management")?.ctaHref === "/schedule-form?concern=denials");
  ok("A/R offer preselects A/R", offers.offerForPath("/services/accounts-receivable-management")?.ctaHref === "/schedule-form?concern=ar");
  ok("credentialing offer preselects credentialing", offers.offerForPath("/services/credentialing-and-contracting")?.ctaHref === "/schedule-form?concern=credentialing");

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
}
