/**
 * Cookie / storage consent (Phase 7).
 *
 * Pure state + gating helpers so the banner, the analytics component and the
 * tests all read the same rules. Consent is versioned: bumping the version
 * re-asks, because a stored "accept" is not consent for a new purpose.
 *
 * Nothing here claims legal compliance — it records what the visitor chose.
 */

export const CONSENT_VERSION = "1";
export const CONSENT_STORAGE_KEY = "kmb-consent";
export const LEGACY_OPTOUT_KEY = "kmb-analytics-optout";

export const CONSENT_CATEGORIES = ["essential", "analytics", "functional", "marketing"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export type ConsentDecision = "accepted" | "rejected" | "essential" | "custom";

export interface ConsentRecord {
  version: string;
  decision: ConsentDecision;
  /** Essential is always true; it is recorded for completeness, not choice. */
  categories: Record<ConsentCategory, boolean>;
  /** ISO timestamp of the recorded choice. */
  decidedAt: string;
}

export const DEFAULT_CONSENT: ConsentRecord = {
  version: CONSENT_VERSION,
  decision: "rejected",
  categories: { essential: true, analytics: false, functional: false, marketing: false },
  decidedAt: "",
};

export function buildConsent(input: {
  decision: ConsentDecision;
  analytics?: boolean;
  functional?: boolean;
  marketing?: boolean;
  now?: Date;
}): ConsentRecord {
  return {
    version: CONSENT_VERSION,
    decision: input.decision,
    categories: {
      essential: true,
      analytics: input.decision === "accepted" ? true : Boolean(input.analytics),
      functional: input.decision === "accepted" ? true : Boolean(input.functional),
      marketing: input.decision === "accepted" ? Boolean(input.marketing) : false,
    },
    decidedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function acceptAll(now?: Date): ConsentRecord {
  return { ...buildConsent({ decision: "accepted", now }), categories: { essential: true, analytics: true, functional: true, marketing: true } };
}

export function rejectAll(now?: Date): ConsentRecord {
  return buildConsent({ decision: "rejected", analytics: false, functional: false, marketing: false, now });
}

/** Explicit "essential only" choice. Functionally optional-off, but recorded separately. */
export function essentialOnly(now?: Date): ConsentRecord {
  return buildConsent({ decision: "essential", analytics: false, functional: false, marketing: false, now });
}

export function parseConsent(raw: string | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (!parsed || typeof parsed !== "object" || !parsed.categories) return null;
    if (parsed.version !== CONSENT_VERSION) return null; // stale consent is not consent
    if (parsed.decision !== "accepted" && parsed.decision !== "rejected" && parsed.decision !== "essential" && parsed.decision !== "custom") return null;
    return {
      version: CONSENT_VERSION,
      decision: parsed.decision,
      categories: {
        essential: true,
        analytics: parsed.categories.analytics === true,
        functional: parsed.categories.functional === true,
        marketing: parsed.categories.marketing === true,
      },
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : "",
    };
  } catch {
    return null;
  }
}

/** Non-essential work must be gated on this. Missing consent means "no". */
export function hasConsent(record: ConsentRecord | null, category: Exclude<ConsentCategory, "essential">): boolean {
  if (!record || record.version !== CONSENT_VERSION) return false;
  return record.categories[category] === true;
}

/**
 * Analytics may only run with analytics consent. The legacy opt-out key is still
 * honoured so a visitor who previously opted out is never tracked again.
 */
export function analyticsAllowed(record: ConsentRecord | null, legacyOptOut: boolean, doNotTrack: boolean): boolean {
  if (doNotTrack) return false;
  if (legacyOptOut) return false;
  return hasConsent(record, "analytics");
}

/** Short label for the persistent "change your choice" control. */
export function consentSummary(record: ConsentRecord | null): string {
  if (!record) return "Cookie preferences not set";
  if (record.decision === "accepted") return "All optional cookies accepted";
  if (record.decision === "rejected") return "Optional cookies rejected";
  if (record.decision === "essential") return "Essential storage only";
  const on = CONSENT_CATEGORIES.filter((category) => category !== "essential" && record.categories[category]);
  return on.length ? `Allowed: ${on.join(", ")}` : "Optional cookies rejected";
}
