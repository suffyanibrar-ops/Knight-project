import { canonicaliseUrl, type Observation } from "./observations";

/**
 * Search-opportunity detection (Phase 6, P6.6).
 *
 * Pure functions over already-synced Search Console rows. They emit
 * `probable_opportunity` observations — never `confirmed_defect`, because an
 * opportunity is an inference from performance, not a broken state.
 *
 * The CTR benchmark below is an INTERNAL HEURISTIC derived from position bands.
 * It is not Google data, not a ranking factor and not a guarantee. Every
 * observation says so in its evidence so the UI cannot present it as measured
 * truth.
 */

export interface GscRow {
  dimensionKey: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  date?: string;
}

export interface OpportunityContext {
  canonicalOrigin: string;
  observedAt?: string;
  provenance?: string;
  /** Minimum impressions before a row is worth judging. */
  minImpressions?: number;
}

const HEURISTIC_NOTE = "Internal CTR benchmark by position band; not Google data.";

/** Deliberately coarse bands; only used to flag "worth a look". */
export function expectedCtr(position: number): number {
  if (position <= 3) return 0.08;
  if (position <= 5) return 0.055;
  if (position <= 10) return 0.03;
  if (position <= 20) return 0.012;
  return 0.006;
}

function base(context: OpportunityContext) {
  return {
    source: "gsc" as const,
    observedAt: context.observedAt ?? new Date().toISOString(),
    provenance: context.provenance ?? "gsc:searchAnalytics",
  };
}

function subjectFor(row: GscRow, context: OpportunityContext): { subjectType: "query" | "url"; subjectKey: string } {
  // Query rows are stored lowercased by the sync; page rows are canonical URLs.
  if (row.dimensionKey.startsWith("http")) {
    return { subjectType: "url", subjectKey: canonicaliseUrl(row.dimensionKey, context.canonicalOrigin) };
  }
  return { subjectType: "query", subjectKey: row.dimensionKey.toLowerCase() };
}

/** Queries with real impressions but a CTR far below the band benchmark. */
export function ctrGapObservations(rows: GscRow[], context: OpportunityContext): Observation[] {
  const minImpressions = context.minImpressions ?? 100;
  return rows.flatMap((row) => {
    if (row.impressions === null || row.position === null || row.ctr === null) return [];
    if (row.impressions < minImpressions) return [];
    const expected = expectedCtr(row.position);
    if (row.ctr >= expected * 0.6) return [];
    const subject = subjectFor(row, context);
    return [{
      ...base(context),
      checkId: "gsc_ctr_gap",
      ...subject,
      severity: row.impressions >= 1000 ? "medium" : "low",
      completeness: "top_rows_only" as const,
      metrics: { impressions: row.impressions, clicks: row.clicks ?? 0, ctr: row.ctr, expectedCtr: Math.round(expected * 1000) / 1000, position: row.position },
      evidence: { heuristic: HEURISTIC_NOTE, band: `position ${Math.floor(row.position)}` },
    }];
  });
}

/** Position 11–20 with volume: close enough to page one to be worth work. */
export function strikingDistanceObservations(rows: GscRow[], context: OpportunityContext): Observation[] {
  const minImpressions = context.minImpressions ?? 50;
  return rows.flatMap((row) => {
    if (row.position === null || row.impressions === null) return [];
    if (row.position < 10.5 || row.position > 20 || row.impressions < minImpressions) return [];
    const subject = subjectFor(row, context);
    return [{
      ...base(context),
      checkId: "gsc_striking_distance",
      ...subject,
      severity: "low" as unknown as Observation["severity"],
      completeness: "top_rows_only" as const,
      metrics: { impressions: row.impressions, position: row.position, clicks: row.clicks ?? 0 },
      evidence: { note: "Average position in the 11–20 window; page-one movement is plausible but not guaranteed." },
    }];
  });
}

/** Same query served by two or more pages close in position — intent overlap. */
export function cannibalisationObservations(
  rowsByPage: { query: string; page: string }[],
  context: OpportunityContext,
): Observation[] {
  const grouped = new Map<string, Set<string>>();
  for (const row of rowsByPage) {
    if (!row.query || !row.page) continue;
    const key = row.query.trim().toLowerCase();
    const bucket = grouped.get(key) ?? new Set<string>();
    bucket.add(canonicaliseUrl(row.page, context.canonicalOrigin));
    grouped.set(key, bucket);
  }
  return [...grouped.entries()]
    .filter(([, pages]) => pages.size >= 2)
    .map(([query, pages]) => ({
      ...base(context),
      checkId: "gsc_cannibalisation",
      subjectType: "query" as const,
      subjectKey: query,
      severity: "medium" as const,
      metrics: { pages: pages.size },
      evidence: { pages: [...pages].slice(0, 6), note: "Multiple pages appear for one query; confirm intent before consolidating." },
    }));
}

export interface WindowTotals { clicks: number; impressions: number; days: number }

/** Sums a window of already-filtered rows. Days without data are not zero-filled. */
export function totalsForWindow(rows: GscRow[]): WindowTotals {
  let clicks = 0;
  let impressions = 0;
  const days = new Set<string>();
  for (const row of rows) {
    clicks += row.clicks ?? 0;
    impressions += row.impressions ?? 0;
    if (row.date) days.add(row.date);
  }
  return { clicks, impressions, days: days.size };
}

export interface DecayResult { changePct: number; verdict: "declined" | "stable" | "inconclusive" }

/**
 * Compares two equal windows. Requires volume and both windows present; a
 * missing window is inconclusive, never a decline.
 */
export function decayVerdict(before: WindowTotals, after: WindowTotals, opts: { minImpressions?: number; thresholdPct?: number } = {}): DecayResult {
  const minImpressions = opts.minImpressions ?? 100;
  const threshold = opts.thresholdPct ?? 20;
  if (before.impressions < minImpressions || after.days === 0 || before.days === 0) {
    return { changePct: 0, verdict: "inconclusive" };
  }
  const changePct = ((after.clicks - before.clicks) / Math.max(1, before.clicks)) * 100;
  if (changePct <= -threshold) return { changePct: Math.round(changePct * 10) / 10, verdict: "declined" };
  return { changePct: Math.round(changePct * 10) / 10, verdict: "stable" };
}

export function decayObservations(
  input: { key: string; before: WindowTotals; after: WindowTotals; subjectType?: "query" | "url" },
  context: OpportunityContext,
): Observation[] {
  const result = decayVerdict(input.before, input.after);
  if (result.verdict !== "declined") return [];
  return [{
    ...base(context),
    checkId: "gsc_traffic_decay",
    subjectType: input.subjectType ?? "query",
    subjectKey: input.key,
    severity: result.changePct <= -40 ? "high" : "medium",
    completeness: "top_rows_only" as const,
    metrics: { changePct: result.changePct, beforeClicks: input.before.clicks, afterClicks: input.after.clicks, beforeDays: input.before.days, afterDays: input.after.days },
    evidence: { note: "Clicks fell across two equal windows. Seasonality, SERP changes and algorithm updates are plausible alternative causes." },
  }];
}

/** Convenience: every GSC-derived opportunity for one dataset. */
export function gscOpportunityObservations(
  input: { queryRows: GscRow[]; pageRows: GscRow[]; queryPagePairs: { query: string; page: string }[] },
  context: OpportunityContext,
): Observation[] {
  return [
    ...ctrGapObservations(input.queryRows, context),
    ...strikingDistanceObservations(input.queryRows, context),
    ...cannibalisationObservations(input.queryPagePairs, context),
  ];
}
