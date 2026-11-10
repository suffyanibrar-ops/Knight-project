import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getGscConnectionStatus } from "@/lib/gsc-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const status = await getGscConnectionStatus();
  return NextResponse.json({ ok: true, status }, { headers: { "cache-control": "no-store" } });
}
