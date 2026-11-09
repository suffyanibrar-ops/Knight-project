import { NextResponse, type NextRequest } from "next/server";
import { sessionSecret } from "@/lib/admin-session";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`.
 * This file enforces the admin session at the edge for every /admin and
 * /api/admin request. Each admin page also re-verifies the signed session
 * server-side, so protection does not depend on this file alone.
 */

const COOKIE = "kmb_admin_session";

/**
 * Permanent aliases for the first dedicated SEO pages. These are handled here
 * so they are true 301 responses rather than framework-default 308s.
 */
const CANONICAL_ALIASES: Record<string, string> = {
  "/specialties/mental-health": "/specialties/mental-health-billing",
  "/specialties/behavioral-health": "/specialties/mental-health-billing",
  "/specialties/physical-therapy": "/specialties/physical-therapy-billing",
  "/specialties/podiatry": "/specialties/podiatry-billing",
  "/insights/switching-medical-billing": "/switching-medical-billing",
  "/case-studies": "/results/case-studies",
  "/blog": "/insights",
};

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifySession(token: string | undefined, secret: string) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [scope, version, expiresRaw, signature] = parts;
  if (scope !== "admin" || !version) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${scope}.${version}.${expiresRaw}`));
    return constantTimeEqual(new Uint8Array(mac), hexToBytes(signature));
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const alias = CANONICAL_ALIASES[pathname] ?? (pathname.startsWith("/case-studies/") ? "/results/case-studies" : undefined);
  if (alias) {
    const destination = request.nextUrl.clone();
    destination.pathname = alias;
    return NextResponse.redirect(destination, 301);
  }

  if (pathname.startsWith("/admin")) {
    // These two recovery pages are intentionally public: an owner who cannot
    // sign in still needs to reach them. They never expose whether an account
    // exists and do not grant a session by themselves.
    if (pathname === "/admin/forgot-password" || pathname === "/admin/reset-password") {
      const response = NextResponse.next();
      response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
      return response;
    }
    const authenticated = await verifySession(request.cookies.get(COOKIE)?.value, sessionSecret());

    if (pathname === "/admin/login") {
      // The login page itself redirects a genuinely valid session to /admin.
      // Do not redirect solely on a signature here: after a password change the
      // cookie can be correctly signed but carry an obsolete session generation,
      // and this layer cannot read the version from SQLite. Redirecting here
      // would create /admin -> /admin/login -> /admin loops.
      const response = NextResponse.next();
      response.headers.set("x-robots-tag", "noindex, nofollow");
      return response;
    }

    if (!authenticated) {
      const url = new URL("/admin/login", request.url);
      if (pathname !== "/admin") url.searchParams.set("next", `${pathname}${search}`);
      const response = NextResponse.redirect(url);
      response.headers.set("x-robots-tag", "noindex, nofollow");
      return response;
    }
  }

  const response = NextResponse.next();
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/specialties/mental-health",
    "/specialties/behavioral-health",
    "/specialties/physical-therapy",
    "/specialties/podiatry",
    "/insights/switching-medical-billing",
    "/case-studies",
    "/case-studies/:path*",
    "/blog",
  ],
};
