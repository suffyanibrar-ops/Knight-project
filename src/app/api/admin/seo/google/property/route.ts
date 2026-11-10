import { NextResponse } from "next/server";
import { requireAdmin, limitAdmin } from "@/lib/api-admin";
import { getGscConnectionStatus, selectGscProperty } from "@/lib/gsc-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("gsc-property", 20);
  if (limited) return limited;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim().slice(0, 500) : "";
    if (!siteUrl) return NextResponse.json({ ok: false, error: "Choose a Search Console property." }, { status: 400 });
    await selectGscProperty(siteUrl);
    return NextResponse.json({ ok: true, status: await getGscConnectionStatus() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "The Search Console property could not be saved." }, { status: 400 });
  }
}
