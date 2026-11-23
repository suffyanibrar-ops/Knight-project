/**
 * Canonical hostname policy.
 *
 * The public site has one preferred origin:
 *   https://www.knightmedicalbilling.com
 *
 * The apex host (`knightmedicalbilling.com`) is an alias. It must never serve a
 * second copy of the site: Google reported the alias pages as
 * "Alternate page with proper canonical tag" because they returned HTTP 200
 * with a canonical pointing at the preferred host.
 *
 * This module is pure (no Node.js or Next.js imports) so the proxy, config
 * validation, metadata builders and tests all share the same policy.
 */

export const PREFERRED_HOST = "www.knightmedicalbilling.com";
export const APEX_HOST = "knightmedicalbilling.com";
export const CANONICAL_ORIGIN = `https://${PREFERRED_HOST}`;

/** Hostnames that must never receive a host-canonicalisation redirect. */
const ASSET_PREFIXES = ["/_next/", "/images/", "/media/", "/blog-media/", "/favicon.ico"];

/**
 * Normalise a Host/X-Forwarded-Host value to a bare lowercase hostname.
 * Handles comma-separated proxy chains, ports, trailing dots and surrounding
 * whitespace. Returns "" for values that cannot be parsed.
 */
export function normaliseRequestHost(raw: string | null | undefined): string {
  const first = (raw ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "";
  try {
    return new URL(`https://${first}`).hostname.replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function isApexHost(raw: string | null | undefined): boolean {
  return normaliseRequestHost(raw) === APEX_HOST;
}

function safePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function safeSearch(search: string | undefined): string {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

/**
 * Absolute 301 target for a request that arrived on the apex host.
 * Returns null when no host redirect is appropriate.
 *
 * Path and query string are preserved exactly. API routes are deliberately
 * excluded: a 301 can change a POST into a GET in some clients, and API
 * responses are not indexable, so keeping the API reachable on both hosts is
 * safer than a host redirect there.
 */
export function canonicalHostRedirect(input: {
  host: string | null | undefined;
  pathname: string;
  search?: string;
  /** Only GET/HEAD are redirected: a 301 must never turn a POST into a GET. */
  method?: string;
}): string | null {
  const method = (input.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;

  const hostname = normaliseRequestHost(input.host);
  if (hostname !== APEX_HOST) return null;

  const pathname = safePathname(input.pathname);
  if (pathname === "/api" || pathname.startsWith("/api/")) return null;
  if (ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return `${CANONICAL_ORIGIN}${pathname}${safeSearch(input.search)}`;
}

/**
 * Normalise the configured public site URL to the preferred origin.
 *
 * Only the project's own apex host is rewritten. Localhost, preview hosts and
 * custom test domains are preserved so development and tests are unaffected.
 */
export function preferredSiteUrl(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return CANONICAL_ORIGIN;
  try {
    const url = new URL(trimmed);
    if (!/^https?:$/.test(url.protocol)) return trimmed;
    if (url.hostname.replace(/\.$/, "") === APEX_HOST) {
      url.protocol = "https:";
      url.hostname = PREFERRED_HOST;
    } else if (url.hostname.replace(/\.$/, "") === PREFERRED_HOST) {
      url.protocol = "https:";
    } else {
      return trimmed;
    }
    return url.origin;
  } catch {
    return trimmed;
  }
}
