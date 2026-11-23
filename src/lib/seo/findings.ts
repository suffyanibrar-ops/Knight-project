import { evidenceHash, findingKey, type ClaimClass, type Observation, type Severity, type SubjectType } from "./observations";
import { confidenceFromEvidence, maxSeverity, prioritise, SEVERITY_RANK, type ExecutionLevel, type PriorityResult } from "./priority";

/**
 * Consolidation: observations → findings (Phase 6 Rev 3 §3).
 *
 * Observations are immutable and per-tool. Findings are the deduplicated,
 * explainable unit an admin sees. Consolidation never discards attribution: a
 * finding that two independent tools agree on says so, and a finding where they
 * disagree is marked as a conflict instead of silently picking a winner.
 */

export interface SourceAttribution {
  source: Observation["source"];
  observedAt: string;
  evidenceHash: string;
  severity: Severity | null;
  completeness: Observation["completeness"] | null;
  provenance: string | null;
  metrics: Record<string, number | string | null> | null;
}

export interface ConsolidatedFinding {
  key: string;
  checkId: string;
  subjectType: SubjectType;
  subjectKey: string;
  claimClass: ClaimClass;
  level: ExecutionLevel;
  severity: Severity;
  observationCount: number;
  sources: SourceAttribution[];
  sourceNames: string[];
  firstSeen: string;
  lastSeen: string;
  disagreement: boolean;
  confidence: number;
  priority: PriorityResult;
}

const OPPORTUNITY_PREFIXES = ["gsc_", "bing_", "opportunity_", "decay_", "cannibal_", "intent_", "internal_link_"];
const HYPOTHESIS_PREFIXES = ["ai_", "hypothesis_"];
const VERIFIED_PREFIXES = ["measure_", "verified_"];

/**
 * Claim class is a property of the check, not of the tool that ran it.
 * Only deterministic rules can produce a confirmed defect.
 */
export function classifyCheck(checkId: string): ClaimClass {
  if (VERIFIED_PREFIXES.some((prefix) => checkId.startsWith(prefix))) return "verified_improvement";
  if (HYPOTHESIS_PREFIXES.some((prefix) => checkId.startsWith(prefix))) return "ai_hypothesis";
  if (OPPORTUNITY_PREFIXES.some((prefix) => checkId.startsWith(prefix))) return "probable_opportunity";
  return "confirmed_defect";
}

/**
 * Execution level (Rev 3 §8). Deliberately conservative: public pages are code,
 * so a "fix" usually needs a deploy. Level A is reserved for actions that are
 * reversible without touching page semantics.
 */
export function levelFor(checkId: string, claimClass: ClaimClass): ExecutionLevel {
  const LEVEL_A = new Set(["indexnow_notify", "queue_housekeeping", "sitemap_refresh"]);
  if (LEVEL_A.has(checkId)) return "A";
  if (claimClass === "ai_hypothesis") return "B";
  const LEVEL_C = new Set(["robots_noindex", "canonical_mismatch", "http_redirect_chain", "http_error_status"]);
  if (LEVEL_C.has(checkId)) return "C";
  return "B";
}

/** Anchors from Rev 3 §4.2 — deliberately coarse and documented. */
function impactFor(severity: Severity, observationCount: number): number {
  const bySeverity: Record<Severity, number> = { critical: 0.9, high: 0.75, medium: 0.5, low: 0.25, info: 0.1 };
  const base = bySeverity[severity];
  // Agreement across independent sources raises the expected value, never above 1.
  return Math.min(1, base + Math.min(0.1, (observationCount - 1) * 0.05));
}

function easeFor(level: ExecutionLevel): number {
  return level === "A" ? 1 : level === "B" ? 0.5 : 0.15;
}

function safetyFor(level: ExecutionLevel): number {
  return level === "A" ? 1 : level === "B" ? 0.6 : 0.2;
}

export interface ConsolidateOptions {
  /** Restrict to a window, e.g. the last 30 days of observations. */
  since?: string | null;
  /** Optional severity floor so the queue is not flooded with `info`. */
  minSeverity?: Severity;
}

export function consolidate(observations: Observation[], options: ConsolidateOptions = {}): ConsolidatedFinding[] {
  const floor = options.minSeverity ? SEVERITY_RANK[options.minSeverity] : -1;
  const groups = new Map<string, Observation[]>();

  for (const observation of observations) {
    if (options.since && observation.observedAt < options.since) continue;
    const key = findingKey(observation);
    const bucket = groups.get(key);
    if (bucket) bucket.push(observation);
    else groups.set(key, [observation]);
  }

  const findings: ConsolidatedFinding[] = [];

  for (const [key, bucket] of groups) {
    const first = bucket[0];
    const severities = bucket.map((item) => item.severity ?? "info");
    const severity = maxSeverity(severities);
    if (SEVERITY_RANK[severity] < floor) continue;

    const sourceNames = [...new Set(bucket.map((item) => item.source))].sort();
    const distinctSeverities = new Set(severities);
    // Two tools reporting the same defect at different severities is a conflict
    // worth a human look; it is never resolved by picking the louder one.
    const disagreement = sourceNames.length > 1 && distinctSeverities.size > 1;
    const claimClass = classifyCheck(first.checkId);
    const level = levelFor(first.checkId, claimClass);
    const deterministic = first.source === "rules" || first.source === "crawl" || first.source === "linkinator";

    let confidence = confidenceFromEvidence(bucket.length, { deterministic, agreement: sourceNames.length > 1 });
    if (disagreement) confidence = Math.min(confidence, 0.45);
    if (first.completeness === "top_rows_only" || first.completeness === "truncated") confidence = Math.min(confidence, 0.7);

    const priority = prioritise({
      impact: impactFor(severity, bucket.length),
      confidence,
      ease: easeFor(level),
      safety: safetyFor(level),
      level,
      claimClass,
      evidenceCount: bucket.length,
    });

    const sorted = [...bucket].sort((a, b) => a.observedAt.localeCompare(b.observedAt));

    findings.push({
      key,
      checkId: first.checkId,
      subjectType: first.subjectType,
      subjectKey: first.subjectKey,
      claimClass,
      level,
      severity,
      observationCount: bucket.length,
      sources: sorted.map((item) => ({
        source: item.source,
        observedAt: item.observedAt,
        evidenceHash: evidenceHash(item),
        severity: item.severity ?? null,
        completeness: item.completeness ?? null,
        provenance: item.provenance ?? null,
        metrics: item.metrics ?? null,
      })),
      sourceNames,
      firstSeen: sorted[0].observedAt,
      lastSeen: sorted[sorted.length - 1].observedAt,
      disagreement,
      confidence: Math.round(confidence * 100) / 100,
      priority,
    });
  }

  // Deterministic order: priority desc, then stable subject+check tiebreaker.
  return findings.sort((a, b) =>
    b.priority.score - a.priority.score ||
    `${a.subjectType}|${a.subjectKey}|${a.checkId}`.localeCompare(`${b.subjectType}|${b.subjectKey}|${b.checkId}`),
  );
}
