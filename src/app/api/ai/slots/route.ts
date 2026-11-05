import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/ai-appointments";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { getAiSettings } from "@/lib/ai-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = await request.headers;
  const limit = checkRateLimit({ key: `ai-slots:${clientKeyFromHeaders(headers)}`, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  const settings = getAiSettings();
  if (!settings.bookingEnabled) return NextResponse.json({ ok: false, error: "Online booking is currently unavailable." }, { status: 503 });
  const slots = getAvailableSlots({ days: 21, limit: 40 });
  return NextResponse.json({ ok: true, slots }, { headers: { "Cache-Control": "no-store" } });
}
