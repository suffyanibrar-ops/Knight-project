import "server-only";
import { sqliteHandle } from "@/lib/sqlite";
import type { Observation } from "./observations";
import { saveObservations } from "./store";

/**
 * Bing Webmaster sync (Phase 6, P6.3).
 *
 * Verified against the live API on 2026-11-16:
 *  - the JSON protocol is `…/api.svc/json/<Method>?apikey=…`
 *  - responses are OData-wrapped: `{ "d": [ … ] }`, not a bare array
 *  - `GetUserSites` items expose `Url` and **`IsVerified`** (not `Verified`),
 *    plus `AuthenticationCode`, `DnsVerificationCode`, `__type`
 *  - the verified property here is the domain root `https://knightmedicalbilling.com/`
 *
 * The API key is read from the environment by the caller and never logged.
 */

export const BING_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
export const BING_ENV_KEY = "BING_WEBMASTER_API_KEY";

export interface BingSite {
  url: string;
  verified: boolean;
}

/** OData envelope: `{ d: [...] }`, `{ d: {...} }`, or a bare payload. */
export function unwrapOData(payload: unknown): unknown[] {
  if (payload === null || payload === undefined) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object" && "d" in (payload as Record<string, unknown>)) {
    const inner = (payload as { d?: unknown }).d;
    if (Array.isArray(inner)) return inner;
    if (inner && typeof inner === "object") return [inner];
    return [];
  }
  if (typeof payload === "object") return [payload];
  return [];
}

export function parseUserSites(payload: unknown): BingSite[] {
  return unwrapOData(payload).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const url = typeof row.Url === "string" ? row.Url : typeof row.url === "string" ? row.url : "";
    if (!url) return [];
    const verified = row.IsVerified === true || row.Verified === true;
    return [{ url, verified }];
  });
}

export function bingKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env[BING_ENV_KEY]?.trim();
  return value && value.length >= 16 ? value : null;
}

export type BingFetch = (input: { url: string; method: string }) => Promise<{ status: number; json: unknown }>;

export interface BingCallResult<T = unknown> {
  status: number;
  data: T[];
  error: { code: number | null; message: string | null } | null;
}

/**
 * One JSON GET. The key travels in the query string (documented method for this
 * interface); callers must never log `url`.
 */
export async function callBing(
  method: string,
  options: { key: string; siteUrl?: string; fetchImpl: BingFetch },
): Promise<BingCallResult> {
  if (!/^[A-Za-z]+$/.test(method)) throw new Error("Invalid Bing API method name.");
  const params = new URLSearchParams({ apikey: options.key });
  if (options.siteUrl) params.set("siteUrl", options.siteUrl);
  const url = `${BING_BASE}/${method}?${params.toString()}`;
  const response = await options.fetchImpl({ url, method });
  const data = unwrapOData(response.json);
  const errorPayload = response.status === 200 ? null : (response.json as { ErrorCode?: number; Message?: string } | null);
  return {
    status: response.status,
    data,
    error: errorPayload
      ? { code: typeof errorPayload.ErrorCode === "number" ? errorPayload.ErrorCode : null, message: typeof errorPayload.Message === "string" ? errorPayload.Message.slice(0, 200) : null }
      : null,
  };
}

interface BingStatRow {
  Date?: string;
  Query?: string;
  Page?: string;
  Impressions?: number;
  Clicks?: number;
  AvgImpressionPosition?: number;
  AvgClickPosition?: number;
}

export interface NormalisedBingStat {
  checkId: string;
  subjectType: Observation["subjectType"];
  subjectKey: string;
  metrics: Record<string, number | string | null>;
}

/**
 * Bing's JSON protocol serialises .NET dates as OData literals — `/Date(1794…)/`
 * where the number is Unix milliseconds. The previous implementation sliced the
 * first ten characters of that string, which turned one real traffic row into
 * the pseudo-URL `/Date(1794`. That value was then stored as a finding subject
 * and displayed as if it were a website page. Parse the literal properly and
 * never let an unparseable value become a subject key.
 */
export function parseBingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const odata = raw.match(/^\/?Date\((-?\d+)(?:[+-]\d{4})?\)\/?$/i);
  if (odata) {
    const date = new Date(Number(odata[1]));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const date = new Date(`${iso[1]}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** A stat subject must be an absolute http(s) URL before it is treated as a page. */
export function isPageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Repair a legacy stored subject key. Site-level Bing rows are periods, not
 * URLs; an old malformed `/Date(…)` key is reduced to the neutral `period`
 * sentinel so historical observations cannot masquerade as a page.
 */
export function repairBingSubjectKey(subjectType: string, subjectKey: string): string {
  if (subjectType !== "site") return subjectKey;
  const parsed = parseBingDate(subjectKey);
  if (parsed) return parsed;
  return /^\/?Date\(/i.test(subjectKey.trim()) ? "period" : subjectKey;
}

/**
 * Bing returns aggregates whose field names vary by method, so each numeric is
 * read defensively and unknown values stay `null` rather than becoming zero.
 */
export function normaliseBingStats(method: string, rows: unknown[]): NormalisedBingStat[] {
  const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return rows.flatMap((item): NormalisedBingStat[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as BingStatRow;
    const metrics = {
      impressions: num(row.Impressions),
      clicks: num(row.Clicks),
      avgImpressionPosition: num(row.AvgImpressionPosition),
      avgClickPosition: num(row.AvgClickPosition),
    };
    if (method === "GetQueryStats") {
      const query = typeof row.Query === "string" ? row.Query.trim() : "";
      if (!query) return [];
      return [{ checkId: "bing_query_stats", subjectType: "query" as const, subjectKey: query.slice(0, 200).toLowerCase(), metrics }];
    }
    if (method === "GetPageStats") {
      // A page stat without a real absolute URL is a data defect, not a page.
      if (!isPageUrl(row.Page)) return [];
      return [{ checkId: "bing_page_stats", subjectType: "url" as const, subjectKey: row.Page.trim().slice(0, 500), metrics }];
    }
    const date = parseBingDate(row.Date);
    return [{
      checkId: method === "GetRankAndTrafficStats" ? "bing_traffic_stats" : "bing_site_stats",
      subjectType: "site" as const,
      subjectKey: date ?? "period",
      metrics,
    }];
  });
}

export interface BingSyncOptions {
  key: string;
  siteUrl: string;
  fetchImpl: BingFetch;
  /** Which stats methods to pull; defaults to the three traffic reports. */
  methods?: string[];
  observedAt?: string;
}

export interface BingSyncSummary {
  requests: number;
  observations: number;
  missingFields: string[];
  errors: { method: string; status: number; code: number | null }[];
}

export async function runBingSync(options: BingSyncOptions): Promise<BingSyncSummary> {
  const summary: BingSyncSummary = { requests: 0, observations: 0, missingFields: [], errors: [] };
  const observedAt = options.observedAt ?? new Date().toISOString();
  const methods = options.methods ?? ["GetRankAndTrafficStats", "GetQueryStats", "GetPageStats"];
  const observations: Observation[] = [];

  for (const method of methods) {
    const result = await callBing(method, { key: options.key, siteUrl: options.siteUrl, fetchImpl: options.fetchImpl });
    summary.requests += 1;
    if (result.status !== 200) {
      summary.errors.push({ method, status: result.status, code: result.error?.code ?? null });
      continue;
    }
    const rows = result.data;
    if (rows.length > 0) {
      const first = rows[0] as Record<string, unknown>;
      for (const field of ["Impressions", "Clicks"]) {
        if (!(field in first) && !summary.missingFields.includes(`${method}.${field}`)) {
          summary.missingFields.push(`${method}.${field}`);
        }
      }
    }
    for (const stat of normaliseBingStats(method, rows)) {
      observations.push({
        source: "bing",
        checkId: stat.checkId,
        subjectType: stat.subjectType,
        subjectKey: stat.subjectKey,
        observedAt,
        metrics: stat.metrics,
        evidence: { method, property: options.siteUrl },
        completeness: "complete",
        provenance: `bing:${method}`,
      });
    }
  }

  if (observations.length > 0) {
    summary.observations = saveObservations(observations);
  }
  return summary;
}

/** Read-only capability check used before trusting any report. */
export async function verifyBingSite(options: {
  key: string;
  fetchImpl: BingFetch;
  host: string;
}): Promise<{ ok: boolean; site: BingSite | null; status: number }> {
  const result = await callBing("GetUserSites", { key: options.key, fetchImpl: options.fetchImpl });
  const sites = parseUserSites({ d: result.data });
  const site = sites.find((entry) => {
    try {
      return new URL(entry.url).hostname.replace(/^www\./, "") === options.host.replace(/^www\./, "");
    } catch {
      return false;
    }
  }) ?? null;
  return { ok: result.status === 200 && Boolean(site?.verified), site, status: result.status };
}

export function propertyKindFor(key: string): "domain" | "url_prefix" {
  return key.startsWith("sc-domain:") ? "domain" : "url_prefix";
}

/** Guard used by callers so a missing key fails loudly and locally. */
export function requireBingKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = bingKeyFromEnv(env);
  if (!key) throw new Error(`${BING_ENV_KEY} is not configured on the server.`);
  return key;
}

/** sqlite dependency is exercised through saveObservations; re-exported for tests. */
export function bingStorageAvailable(): boolean {
  return Boolean(sqliteHandle());
}
