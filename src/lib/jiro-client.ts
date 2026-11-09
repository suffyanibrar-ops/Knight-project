import "server-only";
import { existsSync, readFileSync } from "node:fs";

/**
 * Server-only Jiro integration.
 *
 * Jiro is an internal loopback service. Its URL and private token must never
 * reach the browser. The token gate lives in Jiro's server wrapper because
 * Jiro's free-tier auth gate currently rejects valid authenticated free keys.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8010";
const DEFAULT_TOKEN_FILE = "/home/knight/jiro/internal-token";
const MAX_RESULTS = 10;
const REQUEST_TIMEOUT_MS = 25_000;

export type JiroSearchResult = {
  position: number;
  title: string;
  url: string;
  snippet: string;
  source: string;
};

export type JiroSearchResponse = {
  available: boolean;
  provider: "jiro" | null;
  query: string;
  results: JiroSearchResult[];
  note: string;
  error?: string;
  fetchedAt?: string;
  engine?: string;
};

export type JiroExtraction = {
  available: boolean;
  url: string;
  title: string | null;
  headings: string[];
  content: string;
  fetchedAt: string;
  error?: string;
};

function baseUrl(): string {
  return (process.env.JIRO_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function token(): string {
  const inline = process.env.JIRO_INTERNAL_TOKEN?.trim();
  if (inline) return inline;
  const file = process.env.JIRO_INTERNAL_TOKEN_FILE?.trim() || DEFAULT_TOKEN_FILE;
  try {
    return existsSync(file) ? readFileSync(file, "utf8").trim() : "";
  } catch {
    return "";
  }
}

export function jiroConfigured(): boolean {
  const url = baseUrl();
  return Boolean(token()) && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url);
}

function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Reject local/private targets before asking Jiro to scrape them. */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return false;
    if (/^\[?::1\]?$/.test(host)) return false;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
      const parts = host.split(".").map(Number);
      if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function jiroRequest(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const tokenValue = token();
  if (!tokenValue) throw new Error("Jiro internal token is not available.");
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-knight-internal-token": tokenValue,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = JSON.parse(text); } catch { /* provider returned non-JSON */ }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "error" in payload ? String((payload as Record<string, unknown>).error) : `HTTP ${response.status}`;
    throw new Error(`Jiro ${detail}`.slice(0, 240));
  }
  if (!payload || typeof payload !== "object") throw new Error("Jiro returned an invalid response.");
  return payload as Record<string, unknown>;
}

export async function jiroHealth(): Promise<{ ok: boolean; version?: string; uptimeSeconds?: number; error?: string }> {
  if (!jiroConfigured()) return { ok: false, error: "Jiro is not configured or internal token is missing." };
  try {
    const response = await fetch(`${baseUrl()}/health`, {
      cache: "no-store",
      headers: { "x-knight-internal-token": token() },
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json().catch(() => null)) as { status?: string; version?: string; uptime_seconds?: number } | null;
    if (!response.ok || body?.status !== "ok") return { ok: false, error: `Jiro health returned HTTP ${response.status}.` };
    return { ok: true, version: body.version, uptimeSeconds: body.uptime_seconds };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 180) : "Jiro health check failed." };
  }
}

export async function jiroSearch(query: string, options: { limit?: number; engine?: string } = {}): Promise<JiroSearchResponse> {
  const cleaned = query.trim().slice(0, 220);
  const fetchedAt = new Date().toISOString();
  if (!cleaned) return { available: false, provider: null, query: "", results: [], note: "No query supplied." };
  if (!jiroConfigured()) {
    return { available: false, provider: null, query: cleaned, results: [], note: "Jiro is not configured; no search data was invented.", fetchedAt };
  }
  try {
    const body = await jiroRequest("/search", {
      method: "POST",
      body: JSON.stringify({
        q: cleaned,
        num: Math.min(MAX_RESULTS, Math.max(1, options.limit ?? 5)),
        engine: options.engine ?? process.env.JIRO_ENGINE ?? "duckduckgo",
        type: "web",
        language: "en",
        location: "us",
      }),
    });
    const organic = Array.isArray(body.organic_results) ? body.organic_results : [];
    const results = organic.slice(0, MAX_RESULTS).flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const title = safeText(row.title, 240);
      const url = safeText(row.link, 700);
      if (!title || !isSafeExternalUrl(url)) return [];
      return [{
        position: typeof row.position === "number" ? row.position : index + 1,
        title,
        url,
        snippet: safeText(row.snippet, 700),
        source: safeText(row.source, 120) || new URL(url).hostname,
      }];
    });
    const metadata = body.search_metadata && typeof body.search_metadata === "object" ? body.search_metadata as Record<string, unknown> : {};
    return {
      available: true,
      provider: "jiro",
      query: cleaned,
      results,
      note: "Live search results from the self-hosted Jiro service. Search volume, keyword difficulty, rankings and traffic are not supplied and are not estimated.",
      fetchedAt,
      engine: typeof metadata.engine === "string" ? metadata.engine : undefined,
    };
  } catch (error) {
    return { available: false, provider: null, query: cleaned, results: [], note: "Jiro search was unavailable. No search data was invented.", error: error instanceof Error ? error.message.slice(0, 180) : "Jiro search failed.", fetchedAt };
  }
}

export async function jiroExtract(url: string): Promise<JiroExtraction> {
  const fetchedAt = new Date().toISOString();
  if (!isSafeExternalUrl(url)) return { available: false, url, title: null, headings: [], content: "", fetchedAt, error: "Refused a non-public or invalid URL." };
  if (!jiroConfigured()) return { available: false, url, title: null, headings: [], content: "", fetchedAt, error: "Jiro is not configured." };
  try {
    const body = await jiroRequest("/scrape", {
      method: "POST",
      body: JSON.stringify({ url, format: "markdown", include_metadata: true, include_structured: false }),
    });
    const rawContent = typeof body.content === "string" ? body.content : "";
    const content = rawContent.slice(0, 12_000);
    const headings = [...content.matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => safeText(match[1], 180)).filter(Boolean).slice(0, 30);
    return { available: true, url, title: safeText(body.title, 240) || null, headings, content, fetchedAt };
  } catch (error) {
    return { available: false, url, title: null, headings: [], content: "", fetchedAt, error: error instanceof Error ? error.message.slice(0, 180) : "Jiro extraction failed." };
  }
}
