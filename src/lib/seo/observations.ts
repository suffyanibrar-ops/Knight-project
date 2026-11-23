import { createHash } from "node:crypto";

/**
 * Evidence layer for the SEO intelligence system (Phase 6, P6.0).
 *
 * Two distinct objects exist on purpose:
 *   - Observation: one tool, one check, one subject, one timestamp. Immutable,
 *     append-only, never deduplicated. This is what we actually measured.
 *   - Finding (see ./findings.ts): a consolidated problem built FROM observations.
 *     Dedupe happens here, never at the observation layer, so attribution and
 *     history survive consolidation.
 */

export const OBSERVATION_SOURCES = ["gsc", "bing", "crawl", "lighthouse", "linkinator", "rules"] as const;
export type ObservationSource = (typeof OBSERVATION_SOURCES)[number];

/** Claim classes decide what may be automated (Rev 3 §8). */
export const CLAIM_CLASSES = ["confirmed_defect", "probable_opportunity", "ai_hypothesis", "verified_improvement"] as const;
export type ClaimClass = (typeof CLAIM_CLASSES)[number];

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SUBJECT_TYPES = ["url", "query", "page_topic", "site"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

/** How complete the underlying dataset was. Search Console returns top rows only. */
export const COMPLETENESS = ["complete", "top_rows_only", "partial", "truncated"] as const;
export type Completeness = (typeof COMPLETENESS)[number];

export interface Observation {
  source: ObservationSource;
  /** Stable identifier of the check, e.g. "canonical_mismatch", "gsc_ctr_gap". */
  checkId: string;
  subjectType: SubjectType;
  subjectKey: string;
  observedAt: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  severity?: Severity;
  metrics?: Record<string, number | string | null>;
  evidence?: Record<string, unknown>;
  completeness?: Completeness;
  /** Free-form pointer to where the evidence came from (API method, crawl run id). */
  provenance?: string;
}

export function isObservationSource(value: unknown): value is ObservationSource {
  return typeof value === "string" && (OBSERVATION_SOURCES as readonly string[]).includes(value);
}

export function isClaimClass(value: unknown): value is ClaimClass {
  return typeof value === "string" && (CLAIM_CLASSES as readonly string[]).includes(value);
}

/**
 * Canonicalise a URL for joining crawl / Lighthouse / Search Console rows.
 *
 * Domain properties report both apex and www hosts; every page-level subject is
 * normalised to one origin so one page cannot look like two. Query strings and
 * hash fragments are dropped, trailing slashes removed (root kept as "/").
 */
export function canonicaliseUrl(raw: string, canonicalOrigin: string): string {
  const base = canonicalOrigin.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(raw, `${base}/`);
  } catch {
    return raw.trim();
  }
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return `${base}${pathname === "/" ? "/" : pathname}`;
}

/**
 * Property keys are NOT URLs. A Search Console domain property is stored verbatim
 * as `sc-domain:example.com`, so it must never pass through URL normalisation.
 */
export function normaliseSubjectKey(subjectType: SubjectType, raw: string, canonicalOrigin: string): string {
  const value = raw.trim();
  if (subjectType === "url") return canonicaliseUrl(value, canonicalOrigin);
  if (subjectType === "site") return value;
  return value.toLowerCase().replace(/\s+/g, " ");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Fingerprint of the *evidence*, not of the finding. Two runs that measure the
 * same thing produce the same hash, which is what makes observations idempotent
 * and findings reproducible.
 */
export function evidenceHash(observation: Observation): string {
  const payload = stableStringify({
    source: observation.source,
    checkId: observation.checkId,
    subjectType: observation.subjectType,
    subjectKey: observation.subjectKey,
    windowStart: observation.windowStart ?? null,
    windowEnd: observation.windowEnd ?? null,
    severity: observation.severity ?? null,
    metrics: observation.metrics ?? null,
    evidence: observation.evidence ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/** One finding per (check, subject). Independent of which tool reported it. */
export function findingKey(observation: Pick<Observation, "checkId" | "subjectType" | "subjectKey">): string {
  return createHash("sha256")
    .update(`${observation.checkId}|${observation.subjectType}|${observation.subjectKey}`)
    .digest("hex");
}

/** Deterministic ordering so exports and tests are reproducible. */
export function sortObservations(observations: Observation[]): Observation[] {
  return [...observations].sort((a, b) => {
    const keyA = `${a.subjectType}|${a.subjectKey}|${a.checkId}|${a.source}`;
    const keyB = `${b.subjectType}|${b.subjectKey}|${b.checkId}|${b.source}`;
    return keyA.localeCompare(keyB);
  });
}
