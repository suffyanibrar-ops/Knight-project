import type { Severity } from "./observations";

/**
 * Prioritisation model — Phase 6 Rev 3 §4.
 *
 * Replaces the Rev 1 formula `impact × confidence ÷ (effort × risk)`, which was
 * unbounded: effort or risk at 0 produced Infinity, and multiplying four
 * unbounded factors made the ordering impossible to explain or calibrate.
 *
 * Here every factor is normalised to [0,1], weights are non-negative and sum to
 * 1, and the score is a bounded 0–100 priority index. No division, so no
 * singularity and no runaway scores. The index is an ordering device, never a
 * probability and never a ranking prediction.
 */

export const PRIORITY_VERSION = "v2.1";

export interface PriorityWeights {
  impact: number;
  confidence: number;
  ease: number;
  safety: number;
}

/** Defaults are fixed and versioned; changing them requires a re-rank report. */
export const DEFAULT_WEIGHTS: PriorityWeights = { impact: 0.4, confidence: 0.3, ease: 0.15, safety: 0.15 };

export type ExecutionLevel = "A" | "B" | "C";

export interface PriorityInput {
  /** Business relevance of the affected surface. */
  impact: number;
  /** Strength of the evidence (source agreement, reproducibility). */
  confidence: number;
  /** 1 = trivial reversible change, 0 = requires code deploy and review. */
  ease: number;
  /** 1 = fully reversible mechanical, 0 = structural/irreversible. */
  safety: number;
  level: ExecutionLevel;
  /** AI hypotheses may never outrank measured defects for execution. */
  claimClass: "confirmed_defect" | "probable_opportunity" | "ai_hypothesis" | "verified_improvement";
  evidenceCount?: number;
}

export interface PriorityResult {
  score: number;
  factors: PriorityInput & { weights: PriorityWeights; version: string; raw: number };
  explanation: string;
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const pct = (value: number): string => `${Math.round(clamp01(value) * 100)}%`;

/**
 * Confidence ladder (Rev 3 §4.2): one unverified source is not confidence.
 * Deterministic single-source findings start at 0.7; independent agreement adds.
 */
export function confidenceFromEvidence(evidenceCount: number, opts: { deterministic: boolean; agreement: boolean }): number {
  const base = opts.deterministic ? 0.7 : 0.4;
  const perExtraSource = opts.agreement ? 0.15 : 0.05;
  return clamp01(base + perExtraSource * Math.max(0, evidenceCount - 1));
}

export function prioritise(input: PriorityInput, weights: PriorityWeights = DEFAULT_WEIGHTS): PriorityResult {
  const normalised: PriorityWeights = {
    impact: clamp01(weights.impact),
    confidence: clamp01(weights.confidence),
    ease: clamp01(weights.ease),
    safety: clamp01(weights.safety),
  };
  const totalWeight = normalised.impact + normalised.confidence + normalised.ease + normalised.safety;
  // Weights are re-normalised so a misconfigured set can never inflate the score.
  const w = totalWeight > 0
    ? {
        impact: normalised.impact / totalWeight,
        confidence: normalised.confidence / totalWeight,
        ease: normalised.ease / totalWeight,
        safety: normalised.safety / totalWeight,
      }
    : DEFAULT_WEIGHTS;

  const impact = clamp01(input.impact);
  const confidence = clamp01(input.confidence);
  const ease = clamp01(input.ease);
  const safety = clamp01(input.safety);

  const raw = w.impact * impact + w.confidence * confidence + w.ease * ease + w.safety * safety;
  let score = Math.round(raw * 1000) / 10; // one decimal, 0–100

  // Hard gates: a hypothesis can never be scheduled ahead of a measured defect.
  if (input.claimClass === "ai_hypothesis") score = Math.min(score, 55);
  if (input.level === "C") score = Math.min(score, 60);
  // Anything resting on a single unverified observation is capped (Rev 3 §4.3).
  if ((input.evidenceCount ?? 0) <= 0) score = Math.min(score, 30);

  const explanation =
    `Level ${input.level} ${input.claimClass.replace(/_/g, " ")}: ` +
    `impact ${pct(impact)}, confidence ${pct(confidence)}, ease ${pct(ease)}, safety ${pct(safety)} ` +
    `(weights ${Math.round(w.impact * 100)}/${Math.round(w.confidence * 100)}/${Math.round(w.ease * 100)}/${Math.round(w.safety * 100)}, ${PRIORITY_VERSION}).`;

  return {
    score,
    factors: { ...input, impact, confidence, ease, safety, weights: w, version: PRIORITY_VERSION, raw },
    explanation,
  };
}

/** Severity ordering used when consolidating mixed-source observations. */
export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export function maxSeverity(severities: (Severity | undefined)[]): Severity {
  return severities.reduce<Severity>((worst, current) => {
    if (!current) return worst;
    return SEVERITY_RANK[current] > SEVERITY_RANK[worst] ? current : worst;
  }, "info");
}
