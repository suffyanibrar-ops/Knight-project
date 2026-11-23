import "server-only";
import { indexNowKeyFromEnv, submitChangedUrls } from "./indexnow";

/**
 * IndexNow publish notifications (Phase 6, P6.5).
 *
 * Notifies participating engines that a public article changed. It is:
 *  - inert without INDEXNOW_KEY (no request, no error);
 *  - fire-and-forget: a failure never breaks publishing;
 *  - deduplicated by (url, content version) so unchanged content is not resent;
 *  - never treated as proof of indexing.
 */

export interface NotifyOptions {
  /** Absolute public URLs that are live right now. */
  urls: string[];
  /** Version marker per URL (e.g. updated timestamp) for dedupe. */
  versions?: Record<string, string>;
  origin: string;
  fetchImpl?: (input: { url: string; body: Record<string, unknown> }) => Promise<{ status: number }>;
  key?: string | null;
  now?: number;
}

export interface NotifyResult {
  status: "submitted" | "skipped" | "failed";
  accepted: number;
  reason?: string;
}

const defaultFetch = async (input: { url: string; body: Record<string, unknown> }) => {
  const response = await fetch(input.url, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status };
};

export async function notifyIndexNow(options: NotifyOptions): Promise<NotifyResult> {
  try {
    const key = options.key === undefined ? indexNowKeyFromEnv() : options.key;
    if (!key) return { status: "skipped", accepted: 0, reason: "indexnow_not_configured" };

    const versions: Record<string, string> = {};
    for (const url of options.urls) {
      const version = options.versions?.[url];
      if (!version) return { status: "skipped", accepted: 0, reason: "missing_content_version" };
      versions[url] = version;
    }

    const result = await submitChangedUrls({
      urls: options.urls,
      contentHashes: versions,
      origin: options.origin,
      key,
      fetchImpl: options.fetchImpl ?? defaultFetch,
    });
    return { status: result.status, accepted: result.accepted.length, ...(result.error ? { reason: result.error } : {}) };
  } catch (error) {
    // Publishing must never fail because a notification failed.
    return { status: "failed", accepted: 0, reason: error instanceof Error ? error.message.slice(0, 120) : "notify_failed" };
  }
}

/** Absolute URL for a published slug on the configured origin. */
export function articleUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/blog/${slug.replace(/^\/+/, "")}`;
}
