import { sqliteHandle } from "@/lib/sqlite";
import type { ConsolidatedFinding } from "./findings";

/**
 * Outcome measurement (Phase 6, P6.7).
 *
 * Connects a change to what happened afterwards without ever asserting
 * causation. A verdict is `improved | declined | inconclusive`; the wording in
 * the UI must stay correlational ("after the change"), and confounders are
 * recorded explicitly.
 */

export interface WindowSeries {
  /** date (YYYY-MM-DD) → value; missing dates are absent, never zero. */
  points: Record<string, number>;
}

export interface WindowSummary {
  days: number;
  total: number;
  average: number | null;
}

export function summariseWindow(series: WindowSeries, start: string, end: string): WindowSummary {
  const dates = Object.keys(series.points).filter((date) => date >= start && date <= end).sort();
  if (dates.length === 0) return { days: 0, total: 0, average: null };
  const total = dates.reduce((sum, date) => sum + (series.points[date] ?? 0), 0);
  return { days: dates.length, total, average: Math.round((total / dates.length) * 100) / 100 };
}

export type Verdict = "improved" | "declined" | "inconclusive";

export interface MeasureInput {
  before: WindowSummary;
  after: WindowSummary;
  /** Same metric for the whole site over the same windows, when available. */
  siteBefore?: WindowSummary;
  siteAfter?: WindowSummary;
  minDays?: number;
  /** Percentage change that counts as a real move. */
  thresholdPct?: number;
}

export interface MeasureResult {
  verdict: Verdict;
  changePct: number | null;
  confounders: string[];
  reason: string;
}

const pctChange = (before: number, after: number): number | null => {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (before === 0) return after === 0 ? 0 : null;
  return Math.round(((after - before) / before) * 1000) / 10;
};

/**
 * Bounded comparison. Inconclusive whenever the evidence cannot support a
 * claim — short windows, no trailing data, or a sitewide move of similar size
 * (which makes the page-level change unremarkable).
 */
export function measureOutcome(input: MeasureInput): MeasureResult {
  const minDays = input.minDays ?? 14;
  const threshold = input.thresholdPct ?? 15;
  const confounders: string[] = [];

  if (input.before.days < minDays || input.after.days < minDays) {
    return {
      verdict: "inconclusive",
      changePct: null,
      confounders,
      reason: `Both windows need at least ${minDays} days of data (before ${input.before.days}, after ${input.after.days}).`,
    };
  }
  if (input.before.average === null || input.after.average === null) {
    return { verdict: "inconclusive", changePct: null, confounders, reason: "One window has no reported rows." };
  }

  const changePct = pctChange(input.before.average, input.after.average);
  if (changePct === null) {
    return { verdict: "inconclusive", changePct: null, confounders, reason: "Baseline average is zero; a percentage change is undefined." };
  }

  if (input.siteBefore?.average != null && input.siteAfter?.average != null) {
    const siteChange = pctChange(input.siteBefore.average, input.siteAfter.average);
    if (siteChange !== null && Math.abs(siteChange) >= Math.abs(changePct) * 0.75 && Math.sign(siteChange) !== 0) {
      confounders.push("sitewide_shift");
    }
  }
  if (input.after.days < minDays + 7) confounders.push("short_after_window");

  if (confounders.includes("sitewide_shift")) {
    return { verdict: "inconclusive", changePct, confounders, reason: "The whole site moved by a similar amount, so this page's change is not attributable to the edit." };
  }
  if (Math.abs(changePct) < threshold) {
    return { verdict: "inconclusive", changePct, confounders, reason: `Change of ${changePct}% is inside the ±${threshold}% noise band.` };
  }
  return {
    verdict: changePct > 0 ? "improved" : "declined",
    changePct,
    confounders,
    reason: `${changePct > 0 ? "Increase" : "Decrease"} of ${Math.abs(changePct)}% after the change. Correlation only: seasonality, SERP layout and algorithm updates were not controlled.`,
  };
}

export interface MeasurementRecord {
  actionId: number;
  windowKind: "before" | "after" | "baseline";
  windowStart: string;
  windowEnd: string;
  metric: string;
  baseline: number | null;
  observed: number | null;
  verdict: Verdict;
  confounders: string[];
}

export function saveMeasurement(record: MeasurementRecord): boolean {
  const db = sqliteHandle();
  if (!db) return false;
  db.prepare(
    `INSERT INTO seo_measurements (action_id, window_kind, window_start, window_end, metric, baseline, observed, verdict, confounders_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.actionId,
    record.windowKind,
    record.windowStart,
    record.windowEnd,
    record.metric,
    record.baseline,
    record.observed,
    record.verdict,
    JSON.stringify(record.confounders).slice(0, 2000),
  );
  return true;
}

/** Adds ISO dates around a change date: N days before, N days after. */
export function measurementWindows(changedOn: string, windowDays = 28): { before: { start: string; end: string }; after: { start: string; end: string } } {
  const shift = (iso: string, days: number): string => {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  return {
    before: { start: shift(changedOn, -windowDays), end: shift(changedOn, -1) },
    after: { start: shift(changedOn, 1), end: shift(changedOn, windowDays) },
  };
}

/** Marks a finding as measured so the queue can show the outcome. */
export function recordFindingOutcome(finding: ConsolidatedFinding, result: MeasureResult, actionId: number): boolean {
  const db = sqliteHandle();
  if (!db) return false;
  db.prepare("UPDATE seo_findings SET status = ?, updated_at = ? WHERE finding_key = ?")
    .run(result.verdict === "improved" ? "verified_improved" : result.verdict === "declined" ? "verified_declined" : "measured_inconclusive", Date.now(), finding.key);
  saveMeasurement({
    actionId,
    windowKind: "after",
    windowStart: "",
    windowEnd: "",
    metric: "clicks",
    baseline: null,
    observed: result.changePct,
    verdict: result.verdict,
    confounders: result.confounders,
  });
  return true;
}
