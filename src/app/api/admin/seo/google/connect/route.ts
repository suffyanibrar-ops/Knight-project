import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { siteUrl } from "@/lib/config";
import {
  GSC_STATE_COOKIE,
  GSC_STATE_TTL_SECONDS,
  buildGoogleAuthUrl,
  createOAuthState,
  oauthConfig,
} from "@/lib/gsc-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicBase(): string {
  return siteUrl().replace(/\/$/, "");
}

function adminRedirect(_request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/admin/login?next=%2Fadmin%2Fseo", publicBase()));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthenticated())) return adminRedirect(request);
  const config = oauthConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/admin/seo?google=config_required", publicBase()));
  }
  const state = createOAuthState(config.stateSecret);
  const response = NextResponse.redirect(buildGoogleAuthUrl(config, state));
  response.cookies.set(GSC_STATE_COOKIE, state.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin/seo/google",
    maxAge: GSC_STATE_TTL_SECONDS,
  });
  return response;
}
