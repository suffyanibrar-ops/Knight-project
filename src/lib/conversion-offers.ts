/**
 * Centralised contextual conversion offers.
 *
 * One deterministic catalogue, one eligibility model and one persistence shape.
 * There is deliberately no AI, no fingerprinting, no behavioural ad network and
 * no second popup system: the component either shows one relevant offer at the
 * right moment or shows nothing.
 */

import { hasConsent, type ConsentRecord } from "./consent";

export const OFFER_STATE_VERSION = "1";
export const OFFER_STORAGE_KEY = "kmb-offer-state";
export const OFFER_SESSION_KEY = "kmb-offer-session";
export const OFFER_COOLDOWN_DAYS = 14;
export const OFFER_GLOBAL_COOLDOWN_DAYS = 3;
export const OFFER_MAX_SHOWS = 2;
export const OFFER_MIN_EXIT_SECONDS = 12;
export const OFFER_MIN_EXIT_SCROLL = 12;
export const OFFER_DWELL_SECONDS = 35;
export const OFFER_DWELL_SCROLL = 50;
export const OFFER_MOBILE_DWELL_SECONDS = 45;
export const OFFER_MOBILE_DWELL_SCROLL = 60;

export type OfferChannel = "exit" | "dwell";
export type OfferType = "review" | "workflow" | "denial" | "ar" | "eligibility" | "credentialing" | "specialty" | "software" | "resource" | "results" | "company";

export interface ConversionOffer {
  id: string;
  type: OfferType;
  label: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  priority: number;
  highIntent: boolean;
  channels: OfferChannel[];
}

export interface IntentSignals {
  pagesViewed: number;
  secondsOnPage: number;
  maxScroll: number;
  highIntentPath: boolean;
  returning: boolean;
  ctaInteracted: boolean;
}

export type IntentLevel = "low" | "engaged" | "high";

export function intentLevel(signals: IntentSignals): IntentLevel {
  let score = 0;
  if (signals.pagesViewed >= 2) score += 1;
  if (signals.pagesViewed >= 3) score += 1;
  if (signals.secondsOnPage >= 20) score += 1;
  if (signals.secondsOnPage >= 60) score += 1;
  if (signals.maxScroll >= 40) score += 1;
  if (signals.maxScroll >= 70) score += 1;
  if (signals.highIntentPath) score += 2;
  if (signals.returning) score += 1;
  if (signals.ctaInteracted) score += 1;
  if (score >= 4) return "high";
  if (score >= 1) return "engaged";
  return "low";
}

function serviceOffer(slug: string): ConversionOffer {
  const base = {
    id: `service-${slug}`,
    type: "workflow" as const,
    label: "Billing workflow",
    headline: "Want a clearer view of this workflow?",
    body: "See how this service fits into the revenue cycle you already run.",
    ctaLabel: "See How It Works",
    ctaHref: "/our-process",
    priority: 50,
    highIntent: true,
    channels: ["exit", "dwell"] as OfferChannel[],
  };
  if (slug === "denial-management") {
    return {
      ...base,
      id: "service-denial-management",
      type: "denial",
      label: "Denial review",
      headline: "Find the patterns behind recurring denials.",
      body: "A review can separate coding issues, payer rules and follow-up gaps.",
      ctaLabel: "Review My Denials",
      ctaHref: "/schedule-form?concern=denials",
      priority: 80,
    };
  }
  if (slug === "accounts-receivable-management") {
    return {
      ...base,
      id: "service-accounts-receivable",
      type: "ar",
      label: "A/R review",
      headline: "Your A/R aging tells a story.",
      body: "Let us identify where follow-up is getting stuck.",
      ctaLabel: "Review My A/R",
      ctaHref: "/schedule-form?concern=ar",
      priority: 80,
    };
  }
  if (slug === "eligibility-and-benefits-verification") {
    return {
      ...base,
      id: "service-eligibility",
      type: "eligibility",
      label: "Front-end review",
      headline: "Front-end issues can become back-end billing problems.",
      body: "Review the eligibility and authorization steps before the claim is filed.",
      ctaLabel: "Review the Process",
      ctaHref: "/our-process",
      priority: 65,
    };
  }
  if (slug === "credentialing-and-contracting" || slug === "contracting-and-enrollment") {
    return {
      ...base,
      id: `service-${slug}`,
      type: "credentialing",
      label: "Credentialing",
      headline: "Adding providers or dealing with enrollment delays?",
      body: "Talk through credentialing, contracting and payer enrollment.",
      ctaLabel: "Talk About Credentialing",
      ctaHref: "/schedule-form?concern=credentialing",
      priority: 75,
    };
  }
  if (slug === "medical-billing-and-coding" || slug === "claims-management") {
    return {
      ...base,
      id: `service-${slug}`,
      type: "workflow",
      label: "Billing workflow",
      headline: "Not sure where billing work is getting stuck?",
      body: "We can walk through the claim path from eligibility to payment posting.",
      ctaLabel: "Review the Workflow",
      ctaHref: "/our-process",
      priority: 60,
    };
  }
  return base;
}

const SPECIALTY_OFFERS: Record<string, { headline: string; body: string }> = {
  "podiatry-billing": {
    headline: "See where podiatry billing workflows commonly lose time.",
    body: "Review the coding, authorization and claim steps that need attention.",
  },
  "mental-health-billing": {
    headline: "Review the billing workflow behind authorizations, documentation and claims.",
    body: "See how behavioral-health claims move from eligibility to payment.",
  },
  "physical-therapy-billing": {
    headline: "Review your PT billing workflow, including authorization and visit-limit challenges.",
    body: "Walk through the steps from plan of care to claim follow-up.",
  },
};

function specialtyOffer(slug: string): ConversionOffer {
  const copy = SPECIALTY_OFFERS[slug];
  const name = slug.replace(/-billing$/, "").replace(/-/g, " ");
  return {
    id: `specialty-${slug}`,
    type: "specialty",
    label: "Specialty workflow",
    headline: copy?.headline ?? `Review the ${name} billing workflow.`,
    body: copy?.body ?? "See where a specialty workflow can be reviewed end to end.",
    ctaLabel: "Review This Workflow",
    ctaHref: "/schedule-form",
    priority: 70,
    highIntent: true,
    channels: ["exit", "dwell"],
  };
}

function softwareOffer(slug: string): ConversionOffer {
  return {
    id: `software-${slug}`,
    type: "software",
    label: "Software workflow",
    headline: "Keep your system. Put experienced billing support inside the workflow.",
    body: "See how Knight works inside the software your team already uses.",
    ctaLabel: "See How It Works",
    ctaHref: "/our-process",
    priority: 65,
    highIntent: true,
    channels: ["exit", "dwell"],
  };
}

function resourceOffer(): ConversionOffer {
  return {
    id: "resource-workflow-review",
    type: "resource",
    label: "Practical next step",
    headline: "Want to apply this to your own billing workflow?",
    body: "See what a structured workflow review looks like.",
    ctaLabel: "Review Your Workflow",
    ctaHref: "/our-process",
    priority: 40,
    highIntent: false,
    channels: ["exit"],
  };
}

const EXCLUDED_PREFIXES = [
  "/contact",
  "/schedule-form",
  "/appointment",
  "/admin",
  "/api",
  "/privacy-policy",
  "/terms-of-service",
  "/cookie-policy",
  "/hipaa-compliance",
  "/faq",
  "/tools",
  "/media",
];

export function isOfferExcluded(pathname: string): boolean {
  const path = normalizePath(pathname);
  return EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function normalizePath(pathname: string): string {
  const path = (pathname || "/").split(/[?#]/)[0].replace(/\/+$/, "");
  return path || "/";
}

/** Route → one contextual offer. Returns null where no interruption belongs. */
export function offerForPath(pathname: string): ConversionOffer | null {
  const path = normalizePath(pathname);
  if (isOfferExcluded(path)) return null;

  if (path === "/") {
    return {
      id: "homepage-revenue-review",
      type: "review",
      label: "Revenue cycle review",
      headline: "See where your revenue cycle may be losing momentum.",
      body: "A short, no-obligation review of your claims, denials, A/R and reporting.",
      ctaLabel: "Review My Revenue Cycle",
      ctaHref: "/schedule-form",
      priority: 90,
      highIntent: true,
      channels: ["exit", "dwell"],
    };
  }

  if (path === "/results" || path === "/results/case-studies") {
    return {
      id: "results-review",
      type: "results",
      label: "Your practice",
      headline: "Want to understand what a similar review would look like for your practice?",
      body: "We can review your current claims, A/R and reporting and explain what we would investigate first.",
      ctaLabel: "Talk With Knight",
      ctaHref: "/schedule-form",
      priority: 85,
      highIntent: true,
      channels: ["exit", "dwell"],
    };
  }

  if (path === "/about" || path === "/why-knight") {
    return {
      id: "company-how-it-works",
      type: "company",
      label: "How Knight works",
      headline: "See what Knight would actually take off your team's desk.",
      body: "A clear view of the work, the ownership and the reporting.",
      ctaLabel: "See How Knight Works",
      ctaHref: "/our-process",
      priority: 45,
      highIntent: false,
      channels: ["exit"],
    };
  }

  if (path === "/software" || path.startsWith("/software/")) {
    return softwareOffer(path === "/software" ? "overview" : path.slice("/software/".length));
  }

  if (path.startsWith("/services/")) {
    return serviceOffer(path.slice("/services/".length));
  }

  if (path.startsWith("/specialties/") && path !== "/specialties") {
    return specialtyOffer(path.slice("/specialties/".length));
  }

  if (path === "/blog" || path === "/insights" || path.startsWith("/blog/") || path.startsWith("/insights/")) {
    return resourceOffer();
  }

  return null;
}

export interface OfferState {
  version: string;
  shown: number;
  lastShownAt: number | null;
  dismissedAt: number | null;
  dismissedOffers: Record<string, number>;
  convertedAt: number | null;
}

export const EMPTY_OFFER_STATE: OfferState = {
  version: OFFER_STATE_VERSION,
  shown: 0,
  lastShownAt: null,
  dismissedAt: null,
  dismissedOffers: {},
  convertedAt: null,
};

export function parseOfferState(raw: string | null): OfferState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OfferState>;
    if (!parsed || typeof parsed !== "object" || parsed.version !== OFFER_STATE_VERSION) return null;
    const dismissedOffers: Record<string, number> = {};
    if (parsed.dismissedOffers && typeof parsed.dismissedOffers === "object") {
      for (const [key, value] of Object.entries(parsed.dismissedOffers)) {
        if (typeof value === "number" && Number.isFinite(value)) dismissedOffers[key] = value;
      }
    }
    return {
      version: OFFER_STATE_VERSION,
      shown: Number.isFinite(Number(parsed.shown)) ? Math.max(0, Number(parsed.shown)) : 0,
      lastShownAt: typeof parsed.lastShownAt === "number" && Number.isFinite(parsed.lastShownAt) ? parsed.lastShownAt : null,
      dismissedAt: typeof parsed.dismissedAt === "number" && Number.isFinite(parsed.dismissedAt) ? parsed.dismissedAt : null,
      dismissedOffers,
      convertedAt: typeof parsed.convertedAt === "number" && Number.isFinite(parsed.convertedAt) ? parsed.convertedAt : null,
    };
  } catch {
    return null;
  }
}

export function recordOfferShown(state: OfferState | null, now = Date.now()): OfferState {
  const base = state ?? EMPTY_OFFER_STATE;
  return { ...base, version: OFFER_STATE_VERSION, shown: base.shown + 1, lastShownAt: now };
}

export function recordOfferDismissed(state: OfferState | null, offerId: string, now = Date.now()): OfferState {
  const base = state ?? EMPTY_OFFER_STATE;
  return {
    ...base,
    version: OFFER_STATE_VERSION,
    dismissedAt: now,
    dismissedOffers: { ...base.dismissedOffers, [offerId]: now },
  };
}

export function recordConverted(state: OfferState | null, now = Date.now()): OfferState {
  const base = state ?? EMPTY_OFFER_STATE;
  return { ...base, version: OFFER_STATE_VERSION, convertedAt: now };
}

/**
 * Offering is not tracking.
 *
 * The offer itself is rendered from the page the visitor is already reading and
 * needs no optional storage, so it may appear without functional consent. Only
 * *remembering* it across visits (dismissals, cooldowns, impression counts) is
 * non-essential, and that is what this gates. Without it the same frequency
 * rules run against in-memory state for the page session and nothing persists.
 */
export function offerPersistenceAllowed(record: ConsentRecord | null): boolean {
  return hasConsent(record, "functional");
}

/** @deprecated Use offerPersistenceAllowed — showing is never consent-gated. */
export const offersAllowedByConsent = offerPersistenceAllowed;

export interface OfferDecisionInput {
  offer: ConversionOffer | null;
  channel: OfferChannel;
  isMobile: boolean;
  intent: IntentLevel;
  secondsOnPage: number;
  maxScroll: number;
  consentOpen: boolean;
  modalOpen: boolean;
  formActive: boolean;
  state: OfferState | null;
  shownThisSession: string[];
  now?: number;
}

export interface OfferDecision { show: boolean; reason: string }

export function evaluateOffer(input: OfferDecisionInput): OfferDecision {
  const now = input.now ?? Date.now();
  const state = input.state;
  if (!input.offer) return { show: false, reason: "no_offer" };
  if (input.consentOpen) return { show: false, reason: "consent_open" };
  if (input.modalOpen) return { show: false, reason: "modal_open" };
  if (input.formActive) return { show: false, reason: "form_active" };
  if (state?.convertedAt) return { show: false, reason: "converted" };
  if (input.shownThisSession.length > 0) return { show: false, reason: "already_shown_this_session" };
  if ((state?.shown ?? 0) >= OFFER_MAX_SHOWS) return { show: false, reason: "show_limit_reached" };
  if (state?.dismissedOffers[input.offer.id]) {
    const days = (now - state.dismissedOffers[input.offer.id]) / 86_400_000;
    if (days < OFFER_COOLDOWN_DAYS) return { show: false, reason: "offer_dismissed" };
  }
  if (state?.dismissedAt) {
    const days = (now - state.dismissedAt) / 86_400_000;
    if (days < OFFER_GLOBAL_COOLDOWN_DAYS) return { show: false, reason: "recent_dismissal" };
  }
  if (!input.offer.channels.includes(input.channel)) return { show: false, reason: "channel_not_allowed" };
  if (input.isMobile && input.channel === "exit") return { show: false, reason: "mobile_exit_disabled" };

  if (input.channel === "exit") {
    if (input.intent === "low" || input.secondsOnPage < OFFER_MIN_EXIT_SECONDS || input.maxScroll < OFFER_MIN_EXIT_SCROLL) {
      return { show: false, reason: "not_engaged" };
    }
    return { show: true, reason: "exit_intent" };
  }

  const minSeconds = input.isMobile ? OFFER_MOBILE_DWELL_SECONDS : OFFER_DWELL_SECONDS;
  const minScroll = input.isMobile ? OFFER_MOBILE_DWELL_SCROLL : OFFER_DWELL_SCROLL;
  if (!input.offer.highIntent || input.intent !== "high" || input.secondsOnPage < minSeconds || input.maxScroll < minScroll) {
    return { show: false, reason: "not_high_intent" };
  }
  return { show: true, reason: "high_intent_dwell" };
}

export interface OfferSession {
  pagesViewed: number;
  shownThisSession: string[];
}

export function parseOfferSession(raw: string | null): OfferSession {
  if (!raw) return { pagesViewed: 0, shownThisSession: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<OfferSession>;
    return {
      pagesViewed: Number.isFinite(Number(parsed.pagesViewed)) ? Math.max(0, Number(parsed.pagesViewed)) : 0,
      shownThisSession: Array.isArray(parsed.shownThisSession) ? parsed.shownThisSession.filter((item): item is string => typeof item === "string").slice(0, 10) : [],
    };
  } catch {
    return { pagesViewed: 0, shownThisSession: [] };
  }
}
