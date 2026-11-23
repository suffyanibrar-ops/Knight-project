import "server-only";
import { sqliteHandle } from "@/lib/sqlite";

/**
 * Google Search Console sync (Phase 6, P6.2).
 *
 * Correctness rules encoded here (verified against Google's docs, Rev 3 §1):
 *  - dimensions are only query | page | country | device | date | searchAppearance
 *  - `type` is a request field, enumerated per type; it is not a dimension
 *  - a response carries at most 25,000 rows; a single day/type is capped at
 *    50,000 rows total, so pagination stops at that cap rather than pretending
 *    the data is complete
 *  - `aggregationType` decides accuracy: page/query rows are a top-row sample
 *  - a row that Google did not return is missing, never zero
 */

export const GSC_ENDPOINT = "https://searchconsole.googleapis.com/webmasters/v3/sites";
export const GSC_ROW_LIMIT = 25_000;
export const GSC_DAILY_ROW_CAP = 50_000;
export const GSC_TYPES = ["web", "image", "video", "news", "discover"] as const;
export type GscType = (typeof GSC_TYPES)[number];
export const GSC_DIMENSIONS = ["date", "query", "page", "country", "device", "searchAppearance"] as const;
export type GscDimension = (typeof GSC_DIMENSIONS)[number];

export interface GscQueryBody {
  startDate: string;
  endDate: string;
  dimensions: GscDimension[];
  type: GscType;
  rowLimit: number;
  startRow: number;
  aggregationType?: "auto" | "byPage" | "byProperty" | "byNewsShowcasePanel";
}

export interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export function buildSearchAnalyticsQuery(input: {
  date: string;
  type: GscType;
  dimensions: GscDimension[];
  startRow?: number;
  rowLimit?: number;
  aggregationType?: GscQueryBody["aggregationType"];
}): GscQueryBody {
  const dimensions = input.dimensions.filter((dimension) => (GSC_DIMENSIONS as readonly string[]).includes(dimension));
  return {
    startDate: input.date,
    endDate: input.date,
    dimensions,
    type: input.type,
    rowLimit: Math.min(input.rowLimit ?? GSC_ROW_LIMIT, GSC_ROW_LIMIT),
    startRow: Math.max(0, input.startRow ?? 0),
    ...(input.aggregationType ? { aggregationType: input.aggregationType } : {}),
  };
}

export interface NormalisedMetric {
  dimension: string;
  dimensionKey: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  completeness: "complete" | "top_rows_only";
}

/**
 * A row is only a sample when page/query are part of the dimension set: Google
 * documents that detail queries may drop rows to stay within budget.
 */
export function normaliseGscRow(row: GscRow, dimensions: GscDimension[]): NormalisedMetric {
  const keys = row.keys ?? [];
  const detailed = dimensions.includes("page") || dimensions.includes("query");
  return {
    dimension: dimensions.join("+") || "total",
    dimensionKey: keys.join("|").slice(0, 400),
    clicks: typeof row.clicks === "number" ? row.clicks : null,
    impressions: typeof row.impressions === "number" ? row.impressions : null,
    ctr: typeof row.ctr === "number" ? Math.round(row.ctr * 10_000) / 10_000 : null,
    position: typeof row.position === "number" ? Math.round(row.position * 100) / 100 : null,
    completeness: detailed ? "top_rows_only" : "complete",
  };
}

export function ensureProperty(source: "gsc" | "bing", propertyKey: string, kind: "domain" | "url_prefix"): number | null {
  const db = sqliteHandle();
  if (!db) return null;
  db.prepare(
    `INSERT INTO seo_properties (source, property_key, property_kind, verified, last_ok_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(source, property_key) DO UPDATE SET last_ok_at = excluded.last_ok_at`,
  ).run(source, propertyKey, kind, Date.now());
  const row = db.prepare("SELECT id FROM seo_properties WHERE source = ? AND property_key = ?").get(source, propertyKey) as { id: number } | undefined;
  return row ? Number(row.id) : null;
}

export function metricRowsToStore(rows: NormalisedMetric[], meta: {
  propertyId: number;
  date: string;
  type: GscType;
  aggregation: string;
}): number {
  const db = sqliteHandle();
  if (!db) return 0;
  const upsert = db.prepare(
    `INSERT INTO seo_metrics_daily
      (property_id, source, date, search_type, dimension, dimension_key, aggregation, clicks, impressions, ctr, position, completeness, synced_at)
     VALUES (?, 'gsc', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(property_id, source, date, search_type, dimension, dimension_key, aggregation) DO UPDATE SET
       clicks = excluded.clicks,
       impressions = excluded.impressions,
       ctr = excluded.ctr,
       position = excluded.position,
       completeness = excluded.completeness,
       synced_at = excluded.synced_at`,
  );
  let written = 0;
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      upsert.run(
        meta.propertyId,
        meta.date,
        meta.type,
        row.dimension,
        row.dimensionKey,
        meta.aggregation,
        row.clicks,
        row.impressions,
        row.ctr,
        row.position,
        row.completeness,
        Date.now(),
      );
      written += 1;
    }
    db.exec("COMMIT");
    return written;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

export type GscFetch = (input: { url: string; body: GscQueryBody; token: string }) => Promise<{
  status: number;
  json: { rows?: GscRow[]; responseAggregationType?: string; error?: { status?: string; code?: number } } | null;
}>;

export interface GscSyncOptions {
  token: string;
  propertyKey: string;
  propertyKind?: "domain" | "url_prefix";
  dates: string[];
  types?: GscType[];
  dimensions?: GscDimension[];
  /** Hard stop for tests and for quota-limited runs. */
  maxRequests?: number;
  fetchImpl: GscFetch;
  onRequest?: () => void;
}

export interface GscSyncSummary {
  requests: number;
  rows: number;
  pages: number;
  errors: { date: string; type: string; status: number; code: string | null }[];
  truncated: boolean;
}

/**
 * Sync one or more days. Pagination stops on an empty page, on the documented
 * 50k/day/type cap, or on any error — and errors are reported, never smoothed
 * into "no data".
 */
export async function runGscSync(options: GscSyncOptions): Promise<GscSyncSummary> {
  const summary: GscSyncSummary = { requests: 0, rows: 0, pages: 0, errors: [], truncated: false };
  const propertyId = ensureProperty("gsc", options.propertyKey, options.propertyKind ?? "domain");
  if (propertyId === null) throw new Error("SQLite is unavailable; cannot store Search Console data.");

  const types = options.types ?? (["web"] as GscType[]);
  const dimensions = options.dimensions ?? (["date"] as GscDimension[]);
  const maxRequests = options.maxRequests ?? 12;

  for (const date of options.dates) {
    for (const type of types) {
      let startRow = 0;
      let dayRows = 0;
      while (startRow < GSC_DAILY_ROW_CAP) {
        if (summary.requests >= maxRequests) { summary.truncated = true; return summary; }
        const body = buildSearchAnalyticsQuery({ date, type, dimensions, startRow });
        const url = `${GSC_ENDPOINT}/${encodeURIComponent(options.propertyKey)}/searchAnalytics/query`;
        const response = await options.fetchImpl({ url, body, token: options.token });
        summary.requests += 1;
        options.onRequest?.();

        if (response.status !== 200 || !response.json) {
          summary.errors.push({
            date,
            type,
            status: response.status,
            code: response.json?.error?.status ?? null,
          });
          break;
        }

        const rows = response.json.rows ?? [];
        if (rows.length === 0) break;

        const normalised = rows.map((row) => normaliseGscRow(row, dimensions));
        metricRowsToStore(normalised, {
          propertyId,
          date,
          type,
          aggregation: response.json.responseAggregationType ?? "auto",
        });
        summary.rows += normalised.length;
        summary.pages += 1;
        dayRows += rows.length;

        if (rows.length < GSC_ROW_LIMIT) break;
        startRow += GSC_ROW_LIMIT;
      }
      if (dayRows >= GSC_DAILY_ROW_CAP) summary.truncated = true;
    }
  }
  return summary;
}
