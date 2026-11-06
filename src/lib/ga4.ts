import "server-only";
import { createSign } from "node:crypto";

/**
 * Minimal GA4 Data API client.
 *
 * Website analytics stay in GA4; SQLite remains the business database. This
 * module is server-only and never exposes the service-account credentials or
 * access token to the browser. Every call fails closed with an honest status
 * so the admin UI can say "not connected" instead of rendering invented zeroes.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_SAFETY_MS = 60_000;
const REPORT_TIMEOUT_MS = 12_000;

type GaServiceAccount = {
  clientEmail: string;
  privateKey: string;
  propertyId: string;
};

type GaConfig = {
  configured: boolean;
  propertyId: string | null;
  clientEmail: string | null;
  error: string | null;
};

export type GaDimension = { name: string; value: string };
export type GaMetric = { name: string; value: number };
export type GaRow = { dimensions: GaDimension[]; metrics: GaMetric[] };

type GaResponse = {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  totals?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  rowCount?: number;
};

type CachedToken = { token: string; expiresAt: number };
let tokenCache: CachedToken | null = null;

function readServiceAccount(): { account: GaServiceAccount | null; error: string | null } {
  const propertyId = (process.env.GA4_PROPERTY_ID ?? "").trim().replace(/^properties\//, "");
  const json = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as { client_email?: string; private_key?: string };
      if (!propertyId || !parsed.client_email || !parsed.private_key) {
        return { account: null, error: "GA4 service-account JSON is present, but the property ID or credentials are incomplete." };
      }
      return {
        account: { propertyId, clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, "\n") },
        error: null,
      };
    } catch {
      return { account: null, error: "GA4_SERVICE_ACCOUNT_JSON is not valid JSON." };
    }
  }

  const clientEmail = (process.env.GA4_CLIENT_EMAIL ?? "").trim();
  const privateKey = (process.env.GA4_PRIVATE_KEY ?? "").trim().replace(/\\n/g, "\n");
  if (!propertyId || !clientEmail || !privateKey) {
    return { account: null, error: null };
  }
  return { account: { propertyId, clientEmail, privateKey }, error: null };
}

export function ga4Status(): GaConfig {
  const { account, error } = readServiceAccount();
  return {
    configured: Boolean(account),
    propertyId: account?.propertyId ?? null,
    clientEmail: account?.clientEmail ?? null,
    error,
  };
}

/** Mask a property/account value so Settings can show that it is present without leaking it. */
export function maskIdentifier(value: string | null): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(6, value.length - 4))}${value.slice(-4)}`;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function accessToken(account: GaServiceAccount): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + TOKEN_SAFETY_MS) return tokenCache.token;

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: account.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat,
    exp,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.privateKey, "base64url")}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string; error?: string } | null;
  if (!response.ok || !body?.access_token) {
    const detail = body?.error_description ?? body?.error;
    throw new Error(detail ? `GA4 authentication failed: ${detail}` : `GA4 authentication failed (${response.status}).`);
  }
  const expiresAt = now + Math.max(60, Number(body.expires_in ?? 3600)) * 1000;
  tokenCache = { token: body.access_token, expiresAt };
  return body.access_token;
}

async function postGa(path: string, body: unknown): Promise<GaResponse> {
  const config = ga4Status();
  const { account, error } = readServiceAccount();
  if (!account) throw new Error(error ?? "GA4 is not configured.");
  const token = await accessToken(account);
  const response = await fetch(`${DATA_API}/properties/${encodeURIComponent(account.propertyId)}:${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as (GaResponse & { error?: { message?: string; status?: string } }) | null;
  if (!response.ok) {
    const detail = payload?.error?.message?.slice(0, 220);
    throw new Error(detail ? `GA4 report error: ${detail}` : `GA4 report error (${response.status}).`);
  }
  void config;
  return payload ?? {};
}

function parseRows(payload: GaResponse | null | undefined): GaRow[] {
  const dimensions = payload?.dimensionHeaders?.map((header) => header.name) ?? [];
  const metrics = payload?.metricHeaders?.map((header) => header.name) ?? [];
  return (payload?.rows ?? []).map((row) => ({
    dimensions: dimensions.map((name, index) => ({ name, value: row.dimensionValues?.[index]?.value ?? "" })),
    metrics: metrics.map((name, index) => ({ name, value: Number(row.metricValues?.[index]?.value ?? 0) || 0 })),
  }));
}

function metricValue(row: GaRow | undefined, name: string): number {
  return row?.metrics.find((metric) => metric.name === name)?.value ?? 0;
}

function dimensionValue(row: GaRow | undefined, name: string): string {
  return row?.dimensions.find((dimension) => dimension.name === name)?.value ?? "";
}

export type GaTotals = {
  users: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  engagedSessions: number;
  engagementRate: number;
  averageSessionDuration: number;
};

const EMPTY_TOTALS: GaTotals = {
  users: 0,
  newUsers: 0,
  sessions: 0,
  pageViews: 0,
  engagedSessions: 0,
  engagementRate: 0,
  averageSessionDuration: 0,
};

function toTotals(row: GaRow | undefined): GaTotals {
  return {
    users: metricValue(row, "totalUsers"),
    newUsers: metricValue(row, "newUsers"),
    sessions: metricValue(row, "sessions"),
    pageViews: metricValue(row, "screenPageViews"),
    engagedSessions: metricValue(row, "engagedSessions"),
    engagementRate: metricValue(row, "engagementRate"),
    averageSessionDuration: metricValue(row, "averageSessionDuration"),
  };
}

const TOTALS_METRICS = [
  "totalUsers",
  "newUsers",
  "sessions",
  "screenPageViews",
  "engagedSessions",
  "engagementRate",
  "averageSessionDuration",
].map((name) => ({ name }));

export type GaTraffic = {
  available: boolean;
  error: string | null;
  totals: GaTotals;
  previous: GaTotals;
  change: {
    users: number | null;
    sessions: number | null;
    pageViews: number | null;
    engagedSessions: number | null;
  };
  series: { date: string; users: number; sessions: number; pageViews: number }[];
  pages: { path: string; users: number; views: number; engagementRate: number; averageTime: number }[];
  landingPages: { path: string; users: number; sessions: number }[];
  sources: { source: string; users: number; sessions: number; engagedSessions: number; engagementRate: number }[];
  referrals: { source: string; medium: string; users: number }[];
  visitors: {
    newVsReturning: { label: string; users: number }[];
    devices: { label: string; users: number }[];
    browsers: { label: string; users: number }[];
    countries: { label: string; users: number }[];
    cities: { label: string; users: number }[];
  };
  warning: string | null;
};

export type GaLive = {
  available: boolean;
  error: string | null;
  activeLast5: number | null;
  activeLast30: number;
  activeBasis: "5_minutes" | "30_minutes";
  pages: { label: string; activeUsers: number }[];
  devices: { label: string; activeUsers: number }[];
  sources: { label: string; activeUsers: number }[];
  countries: { label: string; activeUsers: number }[];
  fetchedAt: string;
  warning: string | null;
};

function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

async function report(body: unknown): Promise<GaRow[]> {
  return parseRows(await postGa("runReport", body));
}

async function realtime(body: unknown): Promise<GaRow[]> {
  return parseRows(await postGa("runRealtimeReport", body));
}

/** Resolve a user-facing range into GA4 date strings and a comparison range. */
export type TrafficRange = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  compareStartDate: string;
  compareEndDate: string;
  compareLabel: string;
  days: number | null;
  startDay: string;
  endDay: string;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveTrafficRange(range: string | null, start: string | null, end: string | null): TrafficRange {
  const customStart = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null;
  const customEnd = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null;
  if (customStart && customEnd && customStart <= customEnd) {
    const startDate = new Date(`${customStart}T00:00:00Z`);
    const endDate = new Date(`${customEnd}T00:00:00Z`);
    const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
    const previousEnd = new Date(startDate.getTime() - 86_400_000);
    const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86_400_000);
    return {
      key: "custom",
      label: `${customStart} → ${customEnd}`,
      startDate: customStart,
      endDate: customEnd,
      compareStartDate: isoDate(previousStart),
      compareEndDate: isoDate(previousEnd),
      compareLabel: "previous period",
      days,
      startDay: customStart,
      endDay: customEnd,
    };
  }

  const presets: Record<string, { label: string; days: number }> = {
    today: { label: "Today", days: 1 },
    "7d": { label: "Last 7 days", days: 7 },
    "30d": { label: "Last 30 days", days: 30 },
    "90d": { label: "Last 90 days", days: 90 },
  };
  const preset = presets[range ?? "7d"] ?? presets["7d"];
  const days = preset.days;
  const currentStart = days === 1 ? "today" : `${days - 1}daysAgo`;
  const previousStart = days === 1 ? "yesterday" : `${days * 2 - 1}daysAgo`;
  const previousEnd = days === 1 ? "yesterday" : `${days}daysAgo`;
  const endDay = isoDate(new Date());
  const startDay = isoDate(new Date(Date.now() - (days - 1) * 86_400_000));
  return {
    key: days === 1 ? "today" : `${days}d`,
    label: preset.label,
    startDate: currentStart,
    endDate: "today",
    compareStartDate: previousStart,
    compareEndDate: previousEnd,
    compareLabel: days === 1 ? "yesterday" : `previous ${days} days`,
    days,
    startDay,
    endDay,
  };
}

export async function getGa4Live(): Promise<GaLive> {
  const status = ga4Status();
  if (!status.configured) {
    return {
      available: false,
      error: status.error,
      activeLast5: null,
      activeLast30: 0,
      activeBasis: "30_minutes",
      pages: [],
      devices: [],
      sources: [],
      countries: [],
      fetchedAt: new Date().toISOString(),
      warning: null,
    };
  }

  const baseLive = { metrics: [{ name: "activeUsers" }], limit: 8 };
  try {
    const thirty = await realtime({ ...baseLive, dimensions: [{ name: "unifiedScreenName" }] });
    let activeLast30 = 0;
    for (const row of thirty) activeLast30 += metricValue(row, "activeUsers");

    let activeLast5: number | null = null;
    let activeBasis: GaLive["activeBasis"] = "30_minutes";
    try {
      const five = await realtime({
        ...baseLive,
        dimensions: [{ name: "unifiedScreenName" }],
        minuteRanges: [{ startMinutesAgo: 4, endMinutesAgo: 0 }],
      });
      activeLast5 = five.reduce((sum, row) => sum + metricValue(row, "activeUsers"), 0);
      activeBasis = "5_minutes";
    } catch {
      // Older GA4 API versions/report shapes may not accept minuteRanges.
      // Keep the 30-minute figure and label it honestly in the UI.
    }

    const [pages, devices, sources, countries] = await Promise.allSettled([
      realtime({ ...baseLive, dimensions: [{ name: "unifiedScreenName" }] }),
      realtime({ ...baseLive, dimensions: [{ name: "deviceCategory" }] }),
      realtime({ ...baseLive, dimensions: [{ name: "sessionSourceMedium" }] }),
      realtime({ ...baseLive, dimensions: [{ name: "country" }] }),
    ]);
    const map = (settled: PromiseSettledResult<GaRow[]>, name: string) =>
      settled.status === "fulfilled"
        ? settled.value
            .map((row) => ({ label: dimensionValue(row, name) || "(not set)", activeUsers: metricValue(row, "activeUsers") }))
            .filter((row) => row.activeUsers > 0)
            .sort((a, b) => b.activeUsers - a.activeUsers)
            .slice(0, 5)
        : [];

    return {
      available: true,
      error: null,
      activeLast5,
      activeLast30,
      activeBasis,
      pages: map(pages, "unifiedScreenName"),
      devices: map(devices, "deviceCategory"),
      sources: map(sources, "sessionSourceMedium"),
      countries: map(countries, "country"),
      fetchedAt: new Date().toISOString(),
      warning: activeBasis === "30_minutes" ? "The analytics provider does not expose a 5-minute window; the online figure is active in the last 30 minutes." : null,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Unable to load realtime analytics.",
      activeLast5: null,
      activeLast30: 0,
      activeBasis: "30_minutes",
      pages: [],
      devices: [],
      sources: [],
      countries: [],
      fetchedAt: new Date().toISOString(),
      warning: null,
    };
  }
}

export async function getGa4Traffic(range: TrafficRange): Promise<GaTraffic> {
  const status = ga4Status();
  const empty: GaTraffic = {
    available: false,
    error: status.error,
    totals: EMPTY_TOTALS,
    previous: EMPTY_TOTALS,
    change: { users: null, sessions: null, pageViews: null, engagedSessions: null },
    series: [],
    pages: [],
    landingPages: [],
    sources: [],
    referrals: [],
    visitors: { newVsReturning: [], devices: [], browsers: [], countries: [], cities: [] },
    warning: null,
  };
  if (!status.configured) return empty;

  try {
    const currentTotals = await report({
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      metrics: TOTALS_METRICS,
    });
    const previousTotals = await report({
      dateRanges: [{ startDate: range.compareStartDate, endDate: range.compareEndDate }],
      metrics: TOTALS_METRICS,
    }).catch(() => []);
    const totals = toTotals(currentTotals[0]);
    const previous = toTotals(previousTotals[0]);

    const [seriesRows, pagesRows, landingRows, sourceRows, referralRows] = await Promise.all([
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }).catch(() => []),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }, { name: "averageSessionDuration" }, { name: "engagementRate" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 15,
      }).catch(() => []),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "landingPage" }],
        metrics: [{ name: "totalUsers" }, { name: "sessions" }],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 10,
      }).catch(() => []),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "engagedSessions" }, { name: "engagementRate" }],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 10,
      }).catch(() => []),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 10,
      }).catch(() => []),
    ]);

    const visitorReports = await Promise.allSettled([
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "newVsReturning" }],
        metrics: [{ name: "totalUsers" }],
      }),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "totalUsers" }],
      }),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "browser" }],
        metrics: [{ name: "totalUsers" }],
      }),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "totalUsers" }],
      }),
      report({
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: "city" }],
        metrics: [{ name: "totalUsers" }],
      }),
    ]);

    const visitorList = (index: number, name: string) => {
      const result = visitorReports[index];
      if (!result || result.status !== "fulfilled") return [];
      return result.value
        .map((row) => ({ label: dimensionValue(row, name) || "(not set)", users: metricValue(row, "totalUsers") }))
        .filter((row) => row.users > 0)
        .sort((a, b) => b.users - a.users)
        .slice(0, 10);
    };

    return {
      available: true,
      error: null,
      totals,
      previous,
      change: {
        users: percentChange(totals.users, previous.users),
        sessions: percentChange(totals.sessions, previous.sessions),
        pageViews: percentChange(totals.pageViews, previous.pageViews),
        engagedSessions: percentChange(totals.engagedSessions, previous.engagedSessions),
      },
      series: seriesRows.map((row) => ({
        date: dimensionValue(row, "date"),
        users: metricValue(row, "totalUsers"),
        sessions: metricValue(row, "sessions"),
        pageViews: metricValue(row, "screenPageViews"),
      })),
      pages: pagesRows.map((row) => ({
        path: dimensionValue(row, "pagePath") || "/",
        views: metricValue(row, "screenPageViews"),
        users: metricValue(row, "totalUsers"),
        averageTime: metricValue(row, "averageSessionDuration"),
        engagementRate: metricValue(row, "engagementRate"),
      })),
      landingPages: landingRows.map((row) => ({
        path: dimensionValue(row, "landingPage") || "/",
        users: metricValue(row, "totalUsers"),
        sessions: metricValue(row, "sessions"),
      })),
      sources: sourceRows.map((row) => ({
        source: dimensionValue(row, "sessionDefaultChannelGroup") || "(not set)",
        users: metricValue(row, "totalUsers"),
        sessions: metricValue(row, "sessions"),
        engagedSessions: metricValue(row, "engagedSessions"),
        engagementRate: metricValue(row, "engagementRate"),
      })),
      referrals: referralRows.map((row) => ({
        source: dimensionValue(row, "sessionSource") || "(not set)",
        medium: dimensionValue(row, "sessionMedium") || "(not set)",
        users: metricValue(row, "totalUsers"),
      })),
      visitors: {
        newVsReturning: visitorList(0, "newVsReturning"),
        devices: visitorList(1, "deviceCategory"),
        browsers: visitorList(2, "browser"),
        countries: visitorList(3, "country"),
        cities: visitorList(4, "city"),
      },
      warning: previousTotals.length === 0 ? "Comparison data is unavailable for this range." : null,
    };
  } catch (error) {
    return {
      ...empty,
      error: error instanceof Error ? error.message : "Unable to load analytics.",
    };
  }
}
