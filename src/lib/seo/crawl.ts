import { canonicaliseUrl } from "./observations";

/**
 * Bounded site crawler core (Phase 6, P6.4).
 *
 * Only fetches the configured origin, honours a hard page cap and a small
 * concurrency limit, and never follows a redirect off-origin. Fetching is
 * injected so tests run entirely on fixtures and no live crawl is implied.
 */

export interface CrawlPage {
  url: string;
  status: number;
  finalUrl: string;
  redirectChain: string[];
  html: string;
}

export interface CrawlLink { from: string; to: string }

export interface CrawlResult {
  pages: CrawlPage[];
  links: CrawlLink[];
  skipped: string[];
  fetched: number;
  truncated: boolean;
}

export type CrawlFetch = (url: string) => Promise<{ status: number; finalUrl?: string; redirectChain?: string[]; html?: string }>;

const locRe = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;

export function parseSitemap(xml: string): string[] {
  const urls: string[] = [];
  for (const match of xml.matchAll(locRe)) {
    const value = match[1]?.trim();
    if (value && /^https?:\/\//i.test(value)) urls.push(value);
  }
  return [...new Set(urls)];
}

export function hostOf(value: string): string {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

export function isSameOrigin(candidate: string, origin: string): boolean {
  const host = hostOf(candidate);
  const base = hostOf(origin);
  return Boolean(host) && Boolean(base) && host.replace(/^www\./, "") === base.replace(/^www\./, "");
}

const hrefRe = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

export function extractInternalLinks(html: string, baseUrl: string, origin: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(hrefRe)) {
    const raw = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(raw)) continue;
    let absolute: URL;
    try {
      absolute = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(absolute.protocol)) continue;
    const clean = `${absolute.origin}${absolute.pathname.replace(/\/+$/, "") || "/"}`;
    if (isSameOrigin(clean, origin)) found.add(absolute.pathname.replace(/\/+$/, "") || "/");
  }
  return [...found].sort();
}

export interface CrawlOptions {
  origin: string;
  fetchImpl: CrawlFetch;
  seedUrls?: string[];
  maxPages?: number;
  /** Pages fetched at once; kept low to protect the live site's CWV. */
  concurrency?: number;
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const maxPages = Math.max(1, Math.min(200, options.maxPages ?? 30));
  const concurrency = Math.max(1, Math.min(3, options.concurrency ?? 2));
  const seen = new Set<string>();
  const queue: string[] = [];

  const enqueue = (raw: string) => {
    if (!isSameOrigin(raw, options.origin)) return;
    const url = canonicaliseUrl(raw, options.origin);
    if (seen.has(url) || queue.includes(url)) return;
    queue.push(url);
  };

  for (const seed of options.seedUrls ?? []) enqueue(seed);
  if (queue.length === 0) enqueue(`${options.origin.replace(/\/+$/, "")}/`);

  const pages: CrawlPage[] = [];
  const links: CrawlLink[] = [];
  const skipped: string[] = [];
  let fetched = 0;

  while (queue.length > 0 && pages.length < maxPages) {
    const batch = queue.splice(0, concurrency);
    const results = await Promise.all(batch.map(async (url) => {
      seen.add(url);
      try {
        const response = await options.fetchImpl(url);
        fetched += 1;
        return { url, response };
      } catch {
        skipped.push(url);
        return null;
      }
    }));

    for (const item of results) {
      if (!item) continue;
      const { url, response } = item;
      const chain = response.redirectChain ?? [url];
      const rawFinal = response.finalUrl ?? url;
      // Check the real host BEFORE canonicalising: canonicaliseUrl rewrites any
      // host to the configured origin, which would hide an off-site redirect.
      if (!isSameOrigin(rawFinal, options.origin)) {
        skipped.push(url);
        continue;
      }
      const finalUrl = canonicaliseUrl(rawFinal, options.origin);
      const html = response.html ?? "";
      pages.push({ url, status: response.status, finalUrl, redirectChain: chain, html });
      for (const path of extractInternalLinks(html, finalUrl, options.origin)) {
        links.push({ from: finalUrl, to: `${options.origin.replace(/\/+$/, "")}${path === "/" ? "/" : path}` });
        enqueue(`${options.origin.replace(/\/+$/, "")}${path === "/" ? "/" : path}`);
      }
    }
  }

  return { pages, links, skipped, fetched, truncated: queue.length > 0 || pages.length >= maxPages };
}

/** Pages nobody links to internally (homepage excluded) — a real SEO defect class. */
export function orphanPages(knownUrls: string[], links: CrawlLink[], origin: string): string[] {
  const linked = new Set(links.map((link) => canonicaliseUrl(link.to, origin)));
  const home = canonicaliseUrl(`${origin.replace(/\/+$/, "")}/`, origin);
  return [...new Set(knownUrls.map((url) => canonicaliseUrl(url, origin)))]
    .filter((url) => url !== home && !linked.has(url))
    .sort();
}

/** Breadth-first depth limited by the page cap; exposes the queue for reporting. */
export function crawlLimits(options: { maxPages?: number; concurrency?: number }): { maxPages: number; concurrency: number } {
  return {
    maxPages: Math.max(1, Math.min(200, options.maxPages ?? 30)),
    concurrency: Math.max(1, Math.min(3, options.concurrency ?? 2)),
  };
}
