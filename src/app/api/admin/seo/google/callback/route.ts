import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  GSC_SCOPE,
  GSC_STATE_COOKIE,
  GscReconnectError,
  exchangeOAuthCode,
  fetchGscProperties,
  oauthConfig,
  readGscTokenRecord,
  verifyOAuthState,
  writeGscTokenRecord,
  type GscProperty,
  type GscTokenRecord,
} from "@/lib/gsc-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(request: NextRequest, code: string): NextResponse {
  const url = new URL("/admin/seo", request.url);
  url.searchParams.set("google", code);
  const next = NextResponse.redirect(url);
  next.cookies.set(GSC_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin/seo/google",
    maxAge: 0,
  });
  return next;
}

function login(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/admin/login?next=%2Fadmin%2Fseo", request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthenticated())) return login(request);
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return response(request, params.get("error") === "access_denied" ? "denied" : "error");
  const code = params.get("code")?.trim();
  if (!code) return response(request, "error");
  const config = oauthConfig();
  if (!config) return response(request, "config_required");
  const state = verifyOAuthState(request.cookies.get(GSC_STATE_COOKIE)?.value, params.get("state") ?? "", config.stateSecret);
  if (!state) return response(request, "invalid_state");

  try {
    const token = await exchangeOAuthCode(code, state.verifier);
    const existing = readGscTokenRecord();
    const refreshToken = token.refreshToken ?? existing?.refreshToken ?? null;
    if (!refreshToken) return response(request, "no_refresh_token");

    let properties: GscProperty[] = [];
    let propertyError = false;
    try {
      properties = await fetchGscProperties(token.accessToken);
    } catch {
      propertyError = true;
    }
    const previousSite = existing?.siteUrl && properties.some((property) => property.siteUrl === existing.siteUrl) ? existing.siteUrl : null;
    const now = new Date().toISOString();
    const record: GscTokenRecord = {
      version: 1,
      refreshToken,
      scope: GSC_SCOPE,
      tokenType: "Bearer",
      connectedAt: existing?.connectedAt ?? now,
      updatedAt: now,
      accountEmail: null,
      siteUrl: previousSite,
      properties,
      lastError: propertyError ? "Search Console properties could not be loaded immediately after connection." : null,
    };
    writeGscTokenRecord(record);
    return response(request, propertyError ? "properties_unavailable" : "connected");
  } catch (error) {
    return response(request, error instanceof GscReconnectError ? "reconnect_required" : "error");
  }
}
