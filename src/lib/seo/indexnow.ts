import "server-only";
import { sqliteHandle } from "@/lib/sqlite";
import { canonicaliseUrl } from "./observations";

/**
 * IndexNow notifications (Phase 6, P6.5).
 *
 * Separate from the Bing Webmaster key: a different secret with a different job.
 * Notifications never guarantee indexing — the API merely acknowledges receipt.
 * Nothing is submitted unless a key is configured, and each (url, content hash)
 * pair is submitted at most once.
 */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_ENV = "INDEXNOW_KEY";
export const INDEXNOW_MAX_URLS = 10_000;

/** Keys are 8–128 hex-ish characters (letters, digits, dashes). */
export function normaliseIndexNowKey(value: string | null | undefined): string | null {
  const key = (value ?? "").trim();
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) return null;
  return key;
}

export function indexNowKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  return normaliseIndexNowKey(env[INDEXNOW_KEY_ENV]);
}

export function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

/** Only URLs on the configured property may be submitted. */
export function isSubmittable(url: string, origin: string): boolean {
  const host = hostOf(url);
  const base = hostOf(origin);
  if (!host || !base) return false;
  return host.replace(/^www\./, "") === base.replace(/^www\./, "");
}

export function dedupeUrls(urls: string[], origin: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!isSubmittable(raw, origin)) continue;
    const url = canonicaliseUrl(raw, origin);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out.slice(0, INDEXNOW_MAX_URLS);
}

export function alreadySubmitted(url: string, contentHash: string): boolean {
  const db = sqliteHandle();
  if (!db) return false;
  const row = db.prepare(
    "SELECT id FROM seo_index_events WHERE url = ? AND content_hash = ? AND engine = 'indexnow' LIMIT 1",
  ).get(url, contentHash) as { id?: number } | undefined;
  return Boolean(row?.id);
}

function recordEvent(url: string, contentHash: string, status: number | null, response: unknown): void {
  const db = sqliteHandle();
  if (!db) return;
  db.prepare(
    `INSERT INTO seo_index_events (url, engine, http_status, submitted_at, content_hash, response_json)
     VALUES (?, 'indexnow', ?, ?, ?, ?)
     ON CONFLICT(url, content_hash, engine) DO UPDATE SET http_status = excluded.http_status, response_json = excluded.response_json`,
  ).run(url, status, Date.now(), contentHash, JSON.stringify(response ?? null).slice(0, 2000));
}

export interface IndexNowFetch {
  (input: { url: string; body: Record<string, unknown> }): Promise<{ status: number; body?: string }>;
}

export interface IndexNowResult {
  status: "submitted" | "skipped" | "failed";
  accepted: string[];
  skipped: string[];
  httpStatus: number | null;
  error: string | null;
}

/**
 * Submit changed URLs. `contentHashes` maps url → hash of the page content so an
 * unchanged page is never re-submitted. 200 and 202 both mean "received".
 */
export async function submitChangedUrls(input: {
  urls: string[];
  contentHashes: Record<string, string>;
  origin: string;
  key: string | null;
  fetchImpl: IndexNowFetch;
}): Promise<IndexNowResult> {
  const key = normaliseIndexNowKey(input.key);
  const candidates = dedupeUrls(input.urls, input.origin);
  if (!key) {
    return { status: "skipped", accepted: [], skipped: candidates, httpStatus: null, error: "indexnow_not_configured" };
  }
  if (candidates.length === 0) {
    return { status: "skipped", accepted: [], skipped: [], httpStatus: null, error: null };
  }

  const pending = candidates.filter((url) => !alreadySubmitted(url, input.contentHashes[url] ?? ""));
  if (pending.length === 0) {
    return { status: "skipped", accepted: [], skipped: candidates, httpStatus: null, error: "already_submitted" };
  }

  const host = hostOf(input.origin);
  const response = await input.fetchImpl({
    url: INDEXNOW_ENDPOINT,
    body: {
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: pending,
    },
  });

  const accepted = response.status === 200 || response.status === 202;
  for (const url of pending) {
    recordEvent(url, input.contentHashes[url] ?? "", response.status, { status: response.status, accepted });
  }

  if (accepted) {
    return { status: "submitted", accepted: pending, skipped: candidates.filter((url) => !pending.includes(url)), httpStatus: response.status, error: null };
  }
  const error =
    response.status === 400 ? "bad_request" :
    response.status === 403 ? "key_not_verified" :
    response.status === 422 ? "url_outside_host" :
    response.status === 429 ? "rate_limited" : `http_${response.status}`;
  return { status: "failed", accepted: [], skipped: candidates, httpStatus: response.status, error };
}
