import { NextResponse } from "next/server";
import { requireAdmin, limitAdmin } from "@/lib/api-admin";
import { clearOAuthAccessTokenCache, revokeAndDeleteGscConnection } from "@/lib/gsc-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("gsc-disconnect", 10);
  if (limited) return limited;
  try {
    await revokeAndDeleteGscConnection();
    clearOAuthAccessTokenCache();
    return NextResponse.json({ ok: true, status: "not_connected" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "The local Search Console connection could not be removed." }, { status: 500 });
  }
}
