import { NextResponse } from "next/server";
import { getAvailableSlots, SchedulingError } from "@/lib/ai-appointments";
import { resolveTimezone } from "@/lib/timezone";
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
  const requestedTimezone = new URL(request.url).searchParams.get("timezone");
  const timezone = resolveTimezone(requestedTimezone) ?? undefined;
  try {
    const slots = getAvailableSlots({ days: 21, limit: 40, timezone });
    const display = slots[0]?.timezone ?? timezone ?? null;
    return NextResponse.json(
      { ok: true, timezone: display, timezoneLabel: slots[0]?.timezoneLabel ?? null, slots },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[ai-slots]", error instanceof Error ? error.stack ?? error.message : error);
    const message = error instanceof SchedulingError ? error.message : "The calendar could not be loaded.";
    return NextResponse.json({ ok: false, code: error instanceof SchedulingError ? error.code : "calendar_unavailable", error: message }, { status: 503 });
  }
}
