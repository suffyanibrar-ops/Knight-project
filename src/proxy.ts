import { NextResponse, type NextRequest } from "next/server";
import { sessionSecret } from "@/lib/admin-session";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`.
 * This file enforces the admin session at the edge for every /admin and
 * /api/admin request. Each admin page also re-verifies the signed session
 * server-side, so protection does not depend on this file alone.
 */

const COOKIE = "kmb_admin_session";

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
  if (parts.length !== 3) return false;
  const [scope, expiresRaw, signature] = parts;
  if (scope !== "admin") return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${scope}.${expiresRaw}`));
    return constantTimeEqual(new Uint8Array(mac), hexToBytes(signature));
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const authenticated = await verifySession(request.cookies.get(COOKIE)?.value, sessionSecret());

    if (pathname === "/admin/login") {
      if (authenticated) return NextResponse.redirect(new URL("/admin", request.url));
      return NextResponse.next();
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
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
