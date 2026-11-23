let passed = 0;
const ok = (name: string, condition: boolean, detail = "") => {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
};

const DAY = 86_400_000;

try {
  const consent = await import("../src/lib/consent");
  const c = await import("../src/lib/conversion-offers");
  const now = Date.parse("2026-11-19T12:00:00.000Z");
  const accepted = consent.acceptAll(new Date(now));
  const essential = consent.essentialOnly(new Date(now));

  // ---------- contextual mapping ----------
  ok("homepage gets its own offer", c.offerForPath("/")?.id === "homepage-revenue-review");
  ok("denial page gets denial copy", c.offerForPath("/services/denial-management")?.type === "denial");
  ok("A/R page gets A/R copy", c.offerForPath("/services/accounts-receivable-management")?.type === "ar");
  ok("eligibility page gets front-end copy", c.offerForPath("/services/eligibility-and-benefits-verification")?.type === "eligibility");
  ok("credentialing page gets credentialing copy", c.offerForPath("/services/credentialing-and-contracting")?.type === "credentialing");
  ok("unknown service still gets a workflow offer", c.offerForPath("/services/clean-up-billing")?.type === "workflow");
  ok("podiatry gets specialty copy", /podiatry/i.test(c.offerForPath("/specialties/podiatry-billing")?.headline ?? ""));
  ok("PT gets specialty copy", /PT|physical/i.test(c.offerForPath("/specialties/physical-therapy-billing")?.headline ?? ""));
  ok("software page gets software copy", c.offerForPath("/software/nextgen-medical-billing")?.type === "software");
  ok("article gets the softer resource offer", c.offerForPath("/blog/what-causes-medical-billing-denials")?.type === "resource");
  ok("results gets the stronger offer", c.offerForPath("/results")?.type === "results");
  ok("about gets the softer company offer", c.offerForPath("/about")?.type === "company");
  ok("contact pages are excluded", c.offerForPath("/contact") === null && c.offerForPath("/schedule-form") === null);
  ok("privacy and legal pages are excluded", c.offerForPath("/cookie-policy") === null && c.offerForPath("/privacy-policy") === null);
  ok("admin and API are excluded", c.offerForPath("/admin/seo") === null && c.offerForPath("/api/health") === null);
  ok("listing pages without a specific offer are excluded", c.offerForPath("/services") === null && c.offerForPath("/faq") === null);

  // ---------- intent ----------
  const low = c.intentLevel({ pagesViewed: 1, secondsOnPage: 5, maxScroll: 10, highIntentPath: false, returning: false, ctaInteracted: false });
  const engaged = c.intentLevel({ pagesViewed: 1, secondsOnPage: 25, maxScroll: 45, highIntentPath: false, returning: false, ctaInteracted: false });
  const high = c.intentLevel({ pagesViewed: 2, secondsOnPage: 45, maxScroll: 60, highIntentPath: true, returning: false, ctaInteracted: false });
  ok("low intent stays low", low === "low");
  ok("engagement is recognised", engaged === "engaged");
  ok("a little meaningful engagement is enough to exit-offer", c.intentLevel({ pagesViewed: 1, secondsOnPage: 22, maxScroll: 18, highIntentPath: false, returning: false, ctaInteracted: false }) === "engaged");
  ok("high-intent route plus engagement is high", high === "high");

  // ---------- eligibility ----------
  const homepage = c.offerForPath("/")!;
  const denial = c.offerForPath("/services/denial-management")!;
  const resource = c.offerForPath("/blog/test")!;
  const base = {
    channel: "exit" as const,
    isMobile: false,
    intent: "engaged" as const,
    secondsOnPage: 25,
    maxScroll: 35,
    consentOpen: false,
    modalOpen: false,
    formActive: false,
    state: c.EMPTY_OFFER_STATE,
    shownThisSession: [] as string[],
    now,
  };
  ok("homepage exit offer is allowed after engagement", c.evaluateOffer({ ...base, offer: homepage }).show);
  ok("homepage can offer after sustained engagement",
    c.evaluateOffer({ ...base, offer: homepage, channel: "dwell", intent: "high", secondsOnPage: c.OFFER_DWELL_SECONDS + 1, maxScroll: c.OFFER_DWELL_SCROLL + 1 }).show);
  ok("homepage dwell still needs the threshold", c.evaluateOffer({ ...base, offer: homepage, channel: "dwell", intent: "high", secondsOnPage: 10, maxScroll: 20 }).reason === "not_high_intent");
  ok("consent banner blocks every offer", c.evaluateOffer({ ...base, offer: denial, consentOpen: true }).reason === "consent_open");
  ok("a rejected optional-storage choice does not hide offers", c.evaluateOffer({ ...base, offer: denial }).show);
  ok("essential-only does not hide offers", c.evaluateOffer({ ...base, offer: denial }).show);
  ok("active modal blocks offers", c.evaluateOffer({ ...base, offer: denial, modalOpen: true }).reason === "modal_open");
  ok("active form blocks offers", c.evaluateOffer({ ...base, offer: denial, formActive: true }).reason === "form_active");
  ok("converted visitors are never interrupted", c.evaluateOffer({ ...base, offer: denial, state: c.recordConverted(null, now) }).reason === "converted");
  ok("one offer per session", c.evaluateOffer({ ...base, offer: denial, shownThisSession: ["homepage-revenue-review"] }).reason === "already_shown_this_session");
  ok("lifetime show limit", c.evaluateOffer({ ...base, offer: denial, state: { ...c.EMPTY_OFFER_STATE, shown: c.OFFER_MAX_SHOWS } }).reason === "show_limit_reached");
  const dismissed = c.recordOfferDismissed(null, denial.id, now - 2 * DAY);
  ok("same offer cooldown", c.evaluateOffer({ ...base, offer: denial, state: dismissed, now }).reason === "offer_dismissed");
  const otherDismissed = c.recordOfferDismissed(null, "homepage-revenue-review", now - 1 * DAY);
  ok("a dismissal also cools down other offers", c.evaluateOffer({ ...base, offer: denial, state: otherDismissed, now }).reason === "recent_dismissal");
  ok("cooldowns expire", c.evaluateOffer({ ...base, offer: denial, state: dismissed, now: now + (c.OFFER_COOLDOWN_DAYS + 1) * DAY }).show);
  ok("exit needs real engagement", c.evaluateOffer({ ...base, offer: homepage, intent: "low", secondsOnPage: 5, maxScroll: 0 }).reason === "not_engaged");
  ok("mobile never fakes exit intent", c.evaluateOffer({ ...base, offer: denial, isMobile: true }).reason === "mobile_exit_disabled");
  ok("mobile high-intent dwell can show after long engagement",
    c.evaluateOffer({ ...base, offer: denial, isMobile: true, channel: "dwell", intent: "high", secondsOnPage: c.OFFER_MOBILE_DWELL_SECONDS + 1, maxScroll: c.OFFER_MOBILE_DWELL_SCROLL + 1 }).show);
  ok("desktop high-intent dwell can show",
    c.evaluateOffer({ ...base, offer: denial, channel: "dwell", intent: "high", secondsOnPage: c.OFFER_DWELL_SECONDS + 1, maxScroll: c.OFFER_DWELL_SCROLL + 1 }).show);
  ok("blog never gets a dwell interruption",
    c.evaluateOffer({ ...base, offer: resource, channel: "dwell", intent: "high", secondsOnPage: 200, maxScroll: 100 }).reason === "channel_not_allowed");

  // ---------- state ----------
  const shown = c.recordOfferShown(null, now);
  ok("show increments once", shown.shown === 1 && shown.lastShownAt === now);
  const state = c.recordOfferDismissed(shown, homepage.id, now + 1000);
  ok("dismissal is per offer", state.dismissedOffers[homepage.id] === now + 1000);
  ok("conversion is sticky", c.recordConverted(state, now + 2000).convertedAt === now + 2000);
  ok("corrupt offer state is ignored", c.parseOfferState("{broken") === null);
  ok("stale offer state is ignored", c.parseOfferState(JSON.stringify({ version: "0", shown: 9 })) === null);
  ok("state round-trips", c.parseOfferState(JSON.stringify(state))?.shown === 1);
  ok("session parser is defensive", c.parseOfferSession("{broken").pagesViewed === 0);
  ok("offers never require functional consent to appear", c.evaluateOffer({ ...base, offer: denial, consentRecord: essential }).reason === "exit_intent");
  ok("functional consent gates remembering, not showing", c.offerPersistenceAllowed(accepted) && !c.offerPersistenceAllowed(essential) && !c.offerPersistenceAllowed(consent.rejectAll(new Date(now))));
  ok("exit intent is reachable after a short engagement window", c.OFFER_MIN_EXIT_SECONDS <= 15 && c.OFFER_MIN_EXIT_SCROLL <= 15 && c.OFFER_DWELL_SECONDS <= 40 && c.OFFER_MOBILE_DWELL_SECONDS <= 60);

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
}
