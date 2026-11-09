import "server-only";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Optional, explicitly configured research providers.
 *
 * The application never invents search volume, keyword difficulty, rankings or
 * competitor facts. When a provider is configured it returns real search-result
 * titles/snippets; when Google Search Console is configured it returns verified
 * query performance for the property (clicks, impressions, CTR, average
 * position). Those are different metrics and are labelled as such.
 */

export type SearchResult = { title: string; url: string; snippet: string; position: number };
export type LiveSearch = {
  available: boolean;
  provider: string | null;
  query: string;
  results: SearchResult[];
  note: string;
  error?: string;
  fetchedAt?: string;
};

export type SearchConsoleMetric = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
export type SearchConsoleData = {
  available: boolean;
  siteUrl: string | null;
  metrics: SearchConsoleMetric[];
  period: string;
  note: string;
  error?: string;
  fetchedAt?: string;
};

const NO_SEARCH_PROVIDER =
  "No search provider is configured. Set SERPER_API_KEY or GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_CX to retrieve real search results. No competitor data or keyword metrics were invented.";

const NO_GSC =
  "Google Search Console is not configured. Set GSC_SITE_URL and GSC_SERVICE_ACCOUNT_JSON to retrieve verified query performance. Search volume and keyword difficulty are not available from this integration.";

function cleanText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, options: RequestInit, timeoutMs = 15_000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`provider returned ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLiveSearch(query: string): Promise<LiveSearch> {
  const cleaned = query.trim().slice(0, 220);
  try {
    if (process.env.SERPER_API_KEY) {
      const body = await fetchJson("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": process.env.SERPER_API_KEY },
        body: JSON.stringify({ q: cleaned, num: 10 }),
      });
      const organic = Array.isArray(body.organic) ? body.organic : [];
      const results = organic.slice(0, 10).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const title = cleanText(row.title, 240);
        const url = safeUrl(row.link);
        if (!title || !url) return [];
        return [{ title, url, snippet: cleanText(row.snippet, 700), position: index + 1 }];
      });
      return {
        available: true,
        provider: "serper",
        query: cleaned,
        results,
        note: "Live Google-style result titles and snippets from Serper. This provider does not supply search volume or keyword difficulty; those are not estimated here.",
        fetchedAt: new Date().toISOString(),
      };
    }
    if (process.env.GOOGLE_CUSTOM_SEARCH_API_KEY && process.env.GOOGLE_CUSTOM_SEARCH_CX) {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", process.env.GOOGLE_CUSTOM_SEARCH_API_KEY);
      url.searchParams.set("cx", process.env.GOOGLE_CUSTOM_SEARCH_CX);
      url.searchParams.set("q", cleaned);
      url.searchParams.set("num", "10");
      const body = await fetchJson(url.toString(), { method: "GET" });
      const items = Array.isArray(body.items) ? body.items : [];
      const results = items.slice(0, 10).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const title = cleanText(row.title, 240);
        const link = safeUrl(row.link);
        if (!title || !link) return [];
        return [{ title, url: link, snippet: cleanText(row.snippet, 700), position: index + 1 }];
      });
      return {
        available: true,
        provider: "google-custom-search",
        query: cleaned,
        results,
        note: "Live Google Custom Search results. Search volume and keyword difficulty are not provided by this integration and are not estimated.",
        fetchedAt: new Date().toISOString(),
      };
    }
    return { available: false, provider: null, query: cleaned, results: [], note: NO_SEARCH_PROVIDER };
  } catch (error) {
    return {
      available: false,
      provider: null,
      query: cleaned,
      results: [],
      note: NO_SEARCH_PROVIDER,
      error: error instanceof Error ? error.message.slice(0, 180) : "provider unavailable",
      fetchedAt: new Date().toISOString(),
    };
  }
}

type ServiceAccount = { client_email?: string; private_key?: string };

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function gscAccessToken(): Promise<{ token: string; siteUrl: string } | null> {
  let raw = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  const credentialFile = process.env.GSC_SERVICE_ACCOUNT_FILE?.trim();
  if (!raw && credentialFile) {
    try { raw = readFileSync(credentialFile, "utf8"); } catch { return null; }
  }
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  if (!raw || !siteUrl) return null;
  let account: ServiceAccount;
  try {
    account = JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
  if (!account.client_email || !account.private_key) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return { token: cachedToken.token, siteUrl };

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(account.private_key, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Search Console auth returned ${response.status}`);
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Search Console auth returned no token");
  cachedToken = { token: body.access_token, expiresAt: Date.now() + Math.max(300, Number(body.expires_in ?? 3600)) * 1000 };
  return { token: cachedToken.token, siteUrl };
}

export async function fetchSearchConsoleMetrics(query: string): Promise<SearchConsoleData> {
  const cleaned = query.trim().slice(0, 120);
  const period = "last 90 days";
  try {
    const auth = await gscAccessToken();
    if (!auth) return { available: false, siteUrl: null, metrics: [], period, note: NO_GSC };
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 90);
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(auth.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dimensions: ["query"],
          dimensionFilterGroups: [{ filters: [{ dimension: "query", operator: "contains", expression: cleaned }] }],
          rowLimit: 10,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error(`Search Console returned ${response.status}`);
    const body = (await response.json()) as { rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[] };
    const metrics = (body.rows ?? []).slice(0, 10).flatMap((row) => {
      const q = row.keys?.[0];
      if (!q) return [];
      return [{ query: q.slice(0, 200), clicks: Number(row.clicks ?? 0), impressions: Number(row.impressions ?? 0), ctr: Number(row.ctr ?? 0), position: Number(row.position ?? 0) }];
    });
    return {
      available: true,
      siteUrl: auth.siteUrl,
      metrics,
      period,
      note: "Verified Search Console performance for queries containing the topic. Clicks, impressions, CTR and average position are not search volume or keyword difficulty.",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      siteUrl: process.env.GSC_SITE_URL?.trim() ?? null,
      metrics: [],
      period,
      note: NO_GSC,
      error: error instanceof Error ? error.message.slice(0, 180) : "Search Console unavailable",
      fetchedAt: new Date().toISOString(),
    };
  }
}
