import { NextResponse } from "next/server";
import { limitAdmin, requireAdmin } from "@/lib/api-admin";
import { listCategoriesWithCounts, listPublicPosts, listTags } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";
import { audiences, services, specialties } from "@/lib/site";

/**
 * Technical SEO health audit for the admin console.
 *
 * This handler crawls the REAL public site (`SITE_URL`) and reports only what it
 * actually observed in the served HTML — no scores, no estimates. Every fetch is
 * time-bounded and a single failing page never aborts the whole run.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATIC_ROUTES = [
  "/",
  "/services",
  "/specialties",
  "/who-we-serve",
  "/results",
  "/about",
  "/our-process",
  "/insights",
  "/faq",
  "/contact",
  "/schedule-form",
  "/hipaa-compliance",
  "/privacy-policy",
  "/terms-of-service",
  "/blog",
];

const MAX_ROUTES = 80;
const MAX_BLOG_POSTS = 60;
const PAGE_TIMEOUT_MS = 15_000;
const CHECK_TIMEOUT_MS = 10_000;
const PAGE_CONCURRENCY = 4;
const CHECK_CONCURRENCY = 6;
const MAX_REDIRECT_HOPS = 5;
const USER_AGENT = "KnightMedicalBilling-SEOHealth/1.0 (+admin audit)";

type IssueRow = { path: string; detail: string };

type RedirectHop = { from: string; status: number; location: string | null };

type FetchedPage = {
  path: string;
  requestedUrl: string;
  status: number;
  finalUrl: string;
  chain: RedirectHop[];
  contentType: string;
  html: string;
  error: string | null;
};

type ParsedPage = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string;
  lang: string | null;
  h1Count: number;
  h1Text: string | null;
  images: { src: string | null; alt: string | null }[];
  internalLinks: string[];
  jsonLdBlocks: number;
  jsonLdErrors: string[];
};

type LinkCheck = {
  firstStatus: number;
  finalStatus: number;
  finalUrl: string;
  chain: RedirectHop[];
  error: string | null;
};

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => run()));
  return results;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unknown fetch error.";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return decodeEntities(match[2] ?? match[3] ?? "");
}

function truncate(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Fetch a page, following at most five redirects, and return the final HTML. */
async function fetchPage(url: string): Promise<{ status: number; finalUrl: string; chain: RedirectHop[]; contentType: string; html: string; error: string | null }> {
  let current = url;
  const chain: RedirectHop[] = [];

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
    } catch (error) {
      return { status: 0, finalUrl: current, chain, contentType: "", html: "", error: errorMessage(error) };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      chain.push({ from: current, status: response.status, location: location ? new URL(location, current).toString() : null });
      try {
        await response.body?.cancel();
      } catch {
        /* ignore */
      }
      if (!location) {
        return { status: response.status, finalUrl: current, chain, contentType: response.headers.get("content-type") ?? "", html: "", error: "Redirect response without a Location header." };
      }
      current = new URL(location, current).toString();
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    let html = "";
    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      try {
        html = await response.text();
      } catch (error) {
        return { status: response.status, finalUrl: current, chain, contentType, html: "", error: errorMessage(error) };
      }
    } else {
      try {
        await response.body?.cancel();
      } catch {
        /* ignore */
      }
    }
    return { status: response.status, finalUrl: current, chain, contentType, html, error: null };
  }

  return { status: 599, finalUrl: current, chain, contentType: "", html: "", error: `More than ${MAX_REDIRECT_HOPS} redirects.` };
}

/** Parse the SEO-relevant parts of a page. Deliberately regex-based: no DOM library on the server. */
function parsePage(html: string, pageUrl: string): ParsedPage {
  const origin = new URL(pageUrl).origin;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) || null : null;

  const descriptionTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  const description = descriptionTag ? (attribute(descriptionTag[0], "content") ?? "").trim() || null : null;

  const canonicalTag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  const canonical = canonicalTag ? (attribute(canonicalTag[0], "href") ?? "").trim() || null : null;

  const robotsTag = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  const robots = robotsTag ? (attribute(robotsTag[0], "content") ?? "") : "";

  const langMatch = html.match(/<html[^>]*\blang=["']([^"']+)["']/i);
  const lang = langMatch ? langMatch[1].trim() || null : null;

  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1s = h1Matches.map((match) => stripTags(match[1])).filter(Boolean);

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => ({
    src: attribute(match[0], "src"),
    alt: attribute(match[0], "alt"),
  }));

  const internalLinks: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    const href = decodeEntities(match[1]).trim();
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    if (href.startsWith("/_next/")) continue;
    try {
      const resolved = new URL(href, pageUrl);
      if (!/^https?:$/.test(resolved.protocol)) continue;
      if (resolved.origin !== origin) continue;
      if (resolved.pathname.startsWith("/_next")) continue;
      internalLinks.push(resolved.toString());
    } catch {
      /* malformed href: ignore here, the page-level checks still cover links */
    }
  }

  const jsonLdErrors: string[] = [];
  let jsonLdBlocks = 0;
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    jsonLdBlocks += 1;
    const raw = match[1].trim();
    if (!raw) {
      jsonLdErrors.push("Empty JSON-LD block.");
      continue;
    }
    try {
      JSON.parse(raw);
    } catch (error) {
      jsonLdErrors.push(`${errorMessage(error)} — ${truncate(raw.replace(/\s+/g, " "), 100)}`);
    }
  }

  return {
    title,
    description,
    canonical,
    robots,
    lang,
    h1Count: h1s.length,
    h1Text: h1s[0] ? truncate(h1s[0]) : null,
    images: images.map((image) => ({ src: image.src, alt: image.alt })),
    internalLinks,
    jsonLdBlocks,
    jsonLdErrors,
  };
}

/** Check one link target once (redirects followed) so repeat links cost a single request. */
async function checkLink(url: string): Promise<LinkCheck> {
  let current = url;
  const chain: RedirectHop[] = [];
  let firstStatus = 0;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
    } catch (error) {
      return { firstStatus: firstStatus || 0, finalStatus: 0, finalUrl: current, chain, error: errorMessage(error) };
    }
    try {
      await response.body?.cancel();
    } catch {
      /* ignore */
    }
    if (hop === 0) firstStatus = response.status;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { firstStatus, finalStatus: response.status, finalUrl: current, chain, error: null };
      chain.push({ from: current, status: response.status, location: new URL(location, current).toString() });
      current = new URL(location, current).toString();
      continue;
    }
    return { firstStatus, finalStatus: response.status, finalUrl: current, chain, error: null };
  }
  return { firstStatus, finalStatus: 599, finalUrl: current, chain, error: "Redirect chain too long." };
}

/** HEAD first, then GET for servers that reject HEAD. Only the status is needed. */
async function checkImage(url: string): Promise<{ status: number; error: string | null }> {
  async function attempt(method: "HEAD" | "GET"): Promise<Response | string> {
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        cache: "no-store",
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
    } catch (error) {
      return errorMessage(error);
    }
  }

  const head = await attempt("HEAD");
  let status = typeof head === "string" ? 0 : head.status;
  if (typeof head !== "string") {
    try {
      await head.body?.cancel();
    } catch {
      /* ignore */
    }
  }
  if (typeof head === "string" || status === 0 || status === 403 || status === 405 || status === 501) {
    const get = await attempt("GET");
    if (typeof get === "string") return { status: 0, error: get };
    status = get.status;
    try {
      await get.body?.cancel();
    } catch {
      /* ignore */
    }
    return { status, error: null };
  }
  return { status, error: null };
}

async function buildRouteInventory(): Promise<{ paths: string[]; truncated: boolean; warnings: string[] }> {
  const paths = new Set<string>(STATIC_ROUTES);
  const warnings: string[] = [];

  for (const service of services) paths.add(`/services/${service.slug}`);
  for (const audience of audiences) paths.add(`/who-we-serve/${audience.slug}`);
  for (const specialty of specialties) paths.add(`/specialties/${specialty.slug}`);

  // Published blog posts, paginated (the data layer caps perPage at 24), max 60.
  try {
    const posts: { slug: string }[] = [];
    const firstPage = await listPublicPosts({ page: 1, perPage: 24 });
    posts.push(...firstPage.posts.map((post) => ({ slug: post.slug })));
    const lastPage = Math.min(firstPage.totalPages, Math.ceil(MAX_BLOG_POSTS / 24));
    for (let page = 2; page <= lastPage && posts.length < MAX_BLOG_POSTS; page += 1) {
      const nextPage = await listPublicPosts({ page, perPage: 24 });
      if (!nextPage.posts.length) break;
      posts.push(...nextPage.posts.map((post) => ({ slug: post.slug })));
    }
    for (const post of posts.slice(0, MAX_BLOG_POSTS)) paths.add(`/blog/${post.slug}`);
  } catch (error) {
    warnings.push(`Published blog posts could not be loaded: ${errorMessage(error)}`);
  }

  try {
    for (const category of await listCategoriesWithCounts()) {
      if (category.count > 0) paths.add(`/blog/category/${category.slug}`);
    }
  } catch (error) {
    warnings.push(`Blog categories could not be loaded: ${errorMessage(error)}`);
  }

  try {
    for (const tag of await listTags()) {
      if (tag.postCount > 0) paths.add(`/blog/tag/${tag.slug}`);
    }
  } catch (error) {
    warnings.push(`Blog tags could not be loaded: ${errorMessage(error)}`);
  }

  const all = [...paths];
  return { paths: all.slice(0, MAX_ROUTES), truncated: all.length > MAX_ROUTES, warnings };
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const limited = await limitAdmin("seo-audit", 3, 60_000);
  if (limited) return limited;

  let base: URL;
  try {
    base = new URL(SITE_URL);
  } catch {
    return NextResponse.json({ ok: false, error: `SITE_URL is not a valid absolute URL: ${SITE_URL}` }, { status: 500 });
  }

  const { paths, truncated, warnings } = await buildRouteInventory();

  const pages: FetchedPage[] = await mapWithConcurrency(paths, PAGE_CONCURRENCY, async (path) => {
    const requestedUrl = new URL(path, `${base.origin}/`).toString();
    const fetched = await fetchPage(requestedUrl);
    return { path, requestedUrl, status: fetched.status, finalUrl: fetched.finalUrl, chain: fetched.chain, contentType: fetched.contentType, html: fetched.html, error: fetched.error };
  });

  const issues = {
    pageStatus: [] as IssueRow[],
    fetchErrors: [] as IssueRow[],
    redirects: [] as { path: string; from: string; to: string | null; status: number; detail: string }[],
    missingTitles: [] as { path: string; title: string | null; detail: string }[],
    missingDescriptions: [] as { path: string; description: string | null; detail: string }[],
    missingCanonicals: [] as { path: string; detail: string }[],
    canonicalMismatch: [] as { path: string; canonical: string; detail: string }[],
    noindexLeaks: [] as { path: string; robots: string; detail: string }[],
    h1Issues: [] as { path: string; h1Count: number; h1Text: string | null; detail: string }[],
    missingLang: [] as { path: string; detail: string }[],
    missingAlt: [] as { path: string; src: string | null; detail: string }[],
    invalidJsonLd: [] as { path: string; detail: string }[],
    missingJsonLd: [] as { path: string; detail: string }[],
    brokenLinks: [] as { path: string; target: string; status: number; detail: string }[],
    linkRedirects: [] as { path: string; target: string; status: number; detail: string }[],
    brokenImages: [] as { path: string; src: string; status: number; detail: string }[],
  };

  const titleMap = new Map<string, string[]>();
  const descriptionMap = new Map<string, string[]>();
  const linkTargets = new Map<string, Set<string>>();
  const imageTargets = new Map<string, Set<string>>();

  for (const page of pages) {
    if (page.status !== 200) {
      if (page.status === 0) issues.fetchErrors.push({ path: page.path, detail: page.error ?? "The request failed before a response was received." });
      else issues.pageStatus.push({ path: page.path, detail: `Expected HTTP 200 but received ${page.status}${page.error ? ` (${page.error})` : ""}.` });
    }
    for (const hop of page.chain) {
      issues.redirects.push({
        path: page.path,
        from: hop.from,
        to: hop.location,
        status: hop.status,
        detail: `Expected HTTP 200 but the route redirected (${hop.status})${hop.location ? ` to ${new URL(hop.location, hop.from).pathname}` : ""}.`,
      });
    }

    // Only parse pages that actually served a 200 HTML document; error and
    // redirect targets are already recorded above and must not be audited as if
    // they were the requested public page.
    if (page.status !== 200) continue;
    const isHtml = page.contentType.includes("text/html") || page.contentType.includes("application/xhtml");
    if (!isHtml) {
      issues.pageStatus.push({ path: page.path, detail: `Expected an HTML page but received "${page.contentType || "unknown content type"}".` });
      continue;
    }
    if (!page.html) {
      issues.pageStatus.push({ path: page.path, detail: "Returned HTTP 200 but the HTML body was empty." });
      continue;
    }
    const parsed = parsePage(page.html, page.finalUrl || page.requestedUrl);

    if (!parsed.title) issues.missingTitles.push({ path: page.path, title: null, detail: "No <title> element, or the title is empty." });
    else {
      const list = titleMap.get(parsed.title) ?? [];
      list.push(page.path);
      titleMap.set(parsed.title, list);
    }

    if (!parsed.description) issues.missingDescriptions.push({ path: page.path, description: null, detail: "No meta description, or it is empty." });
    else {
      const list = descriptionMap.get(parsed.description) ?? [];
      list.push(page.path);
      descriptionMap.set(parsed.description, list);
    }

    if (!parsed.canonical) {
      issues.missingCanonicals.push({ path: page.path, detail: "No <link rel=\"canonical\">." });
    } else {
      try {
        const canonicalUrl = new URL(parsed.canonical, page.finalUrl || page.requestedUrl);
        const pagePath = new URL(page.finalUrl || page.requestedUrl).pathname;
        if (canonicalUrl.pathname !== pagePath) {
          issues.canonicalMismatch.push({ path: page.path, canonical: parsed.canonical, detail: `Canonical points to ${canonicalUrl.pathname} instead of ${pagePath}.` });
        }
      } catch {
        issues.canonicalMismatch.push({ path: page.path, canonical: parsed.canonical, detail: "Canonical is not a valid URL." });
      }
    }

    if (/noindex/i.test(parsed.robots)) {
      issues.noindexLeaks.push({ path: page.path, robots: parsed.robots || "noindex", detail: `Public page is marked noindex (robots: ${truncate(parsed.robots || "noindex", 80)}).` });
    }

    if (parsed.h1Count !== 1) {
      issues.h1Issues.push({
        path: page.path,
        h1Count: parsed.h1Count,
        h1Text: parsed.h1Text,
        detail: `Expected exactly one H1 but found ${parsed.h1Count}${parsed.h1Text ? ` (first: “${parsed.h1Text}”)` : ""}.`,
      });
    }

    if (!parsed.lang) issues.missingLang.push({ path: page.path, detail: "The <html> element has no lang attribute." });

    for (const image of parsed.images) {
      if (image.alt === null) {
        issues.missingAlt.push({ path: page.path, src: image.src, detail: `Image has no alt attribute${image.src ? ` (${truncate(image.src, 100)})` : ""}.` });
      }
      if (!image.src || image.src.startsWith("data:")) continue;
      try {
        const resolved = new URL(image.src, page.finalUrl || page.requestedUrl);
        if (!/^https?:$/.test(resolved.protocol)) continue;
        const referrers = imageTargets.get(resolved.toString()) ?? new Set<string>();
        referrers.add(page.path);
        imageTargets.set(resolved.toString(), referrers);
      } catch {
        /* malformed src */
      }
    }

    for (const link of parsed.internalLinks) {
      const referrers = linkTargets.get(link) ?? new Set<string>();
      referrers.add(page.path);
      linkTargets.set(link, referrers);
    }

    for (const error of parsed.jsonLdErrors) {
      issues.invalidJsonLd.push({ path: page.path, detail: `Invalid JSON-LD: ${truncate(error, 160)}` });
    }
    if (parsed.jsonLdBlocks === 0) {
      issues.missingJsonLd.push({ path: page.path, detail: "No JSON-LD structured data block was found." });
    }
  }

  // Link checks: every unique internal target is fetched exactly once.
  const linkChecks = await mapWithConcurrency([...linkTargets.keys()], CHECK_CONCURRENCY, async (target) => {
    const result = await checkLink(target);
    return { target, ...result };
  });

  for (const check of linkChecks) {
    const referrers = [...(linkTargets.get(check.target) ?? [])].sort();
    const referrer = referrers[0] ?? "/";
    const linkedFrom = referrers.length > 1 ? ` (linked from ${referrers.length} pages)` : "";
    if (check.finalStatus === 0) {
      issues.brokenLinks.push({ path: referrer, target: check.target, status: 0, detail: `Link could not be fetched: ${check.error ?? "network error"}${linkedFrom}.` });
    } else if (check.finalStatus >= 400) {
      issues.brokenLinks.push({ path: referrer, target: check.target, status: check.finalStatus, detail: `Link target ${check.target} returns HTTP ${check.finalStatus}${linkedFrom}.` });
    } else if (check.chain.length > 0) {
      issues.linkRedirects.push({
        path: referrer,
        target: check.target,
        status: check.firstStatus,
        detail: `Internal link redirects (${check.firstStatus}) to ${new URL(check.finalUrl).pathname} instead of returning 200 directly${linkedFrom}.`,
      });
    }
  }

  // Image checks: every unique image URL is fetched exactly once.
  const imageChecks = await mapWithConcurrency([...imageTargets.keys()], CHECK_CONCURRENCY, async (src) => {
    const result = await checkImage(src);
    return { src, ...result };
  });

  for (const check of imageChecks) {
    if (check.status >= 400 || check.status === 0) {
      const referrers = [...(imageTargets.get(check.src) ?? [])].sort();
      issues.brokenImages.push({
        path: referrers[0] ?? "/",
        src: check.src,
        status: check.status,
        detail: `Image returns ${check.status === 0 ? `no response (${check.error ?? "network error"})` : `HTTP ${check.status}`}${referrers.length > 1 ? ` (used on ${referrers.length} pages)` : ""}.`,
      });
    }
  }

  const duplicateTitles = [...titleMap.entries()]
    .filter(([, pathsForTitle]) => pathsForTitle.length > 1)
    .map(([title, pathsForTitle]) => ({ title, paths: pathsForTitle.sort(), detail: `Same title used on ${pathsForTitle.length} pages.` }))
    .sort((a, b) => b.paths.length - a.paths.length);

  const duplicateDescriptions = [...descriptionMap.entries()]
    .filter(([, pathsForDescription]) => pathsForDescription.length > 1)
    .map(([description, pathsForDescription]) => ({ description, paths: pathsForDescription.sort(), detail: `Same meta description used on ${pathsForDescription.length} pages.` }))
    .sort((a, b) => b.paths.length - a.paths.length);

  const issuePathSet = new Set<string>();
  for (const rows of Object.values(issues)) {
    for (const row of rows) issuePathSet.add(row.path);
  }
  for (const duplicate of duplicateTitles) for (const path of duplicate.paths) issuePathSet.add(path);
  for (const duplicate of duplicateDescriptions) for (const path of duplicate.paths) issuePathSet.add(path);

  const pagesWithIssues = issuePathSet.size;
  const summary = {
    totalPages: pages.length,
    checkedOk: Math.max(0, pages.length - pagesWithIssues),
    pagesWithIssues,
    missingTitles: issues.missingTitles.length,
    missingDescriptions: issues.missingDescriptions.length,
    missingCanonicals: issues.missingCanonicals.length,
    noindexLeaks: issues.noindexLeaks.length,
    h1Issues: issues.h1Issues.length,
    missingAlt: issues.missingAlt.length,
    brokenLinks: issues.brokenLinks.length,
    brokenImages: issues.brokenImages.length,
    invalidJsonLd: issues.invalidJsonLd.length,
    redirects: issues.redirects.length,
    missingLang: issues.missingLang.length,
    missingJsonLd: issues.missingJsonLd.length,
    canonicalMismatches: issues.canonicalMismatch.length,
    duplicateTitles: duplicateTitles.length,
    duplicateDescriptions: duplicateDescriptions.length,
    pageStatusIssues: issues.pageStatus.length,
    fetchErrors: issues.fetchErrors.length,
    auditBaseUrl: SITE_URL,
  };

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      baseUrl: SITE_URL,
      auditedRoutes: pages.length,
      truncated,
      warnings,
      summary,
      issues,
      duplicateTitles,
      duplicateDescriptions,
      brokenLinkDetails: issues.brokenLinks,
      brokenImageDetails: issues.brokenImages,
      redirectDetails: issues.redirects,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
