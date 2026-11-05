import { NextResponse } from "next/server";
import { checkRequestedAvailability, SchedulingError, TimezoneInputError } from "@/lib/ai-appointments";
import { isSameOrigin } from "@/lib/request-security";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { getAiSettings } from "@/lib/ai-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deterministic availability check for an exact visitor-requested local time.
 * Used by tests and the scheduling UI; the agent uses the same backend function.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  const headers = await request.headers;
  if (process.env.AI_TEST_MODE !== "1") {
    const limit = checkRateLimit({ key: `ai-check:${clientKeyFromHeaders(headers)}`, limit: 40, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }
  if (!getAiSettings().bookingEnabled) return NextResponse.json({ ok: false, error: "Online booking is currently unavailable." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  try {
    const availability = checkRequestedAvailability({
      date: typeof body.date === "string" ? body.date : "",
      time: typeof body.time === "string" ? body.time : "",
      timezone: typeof body.timezone === "string" ? body.timezone : "",
      durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
    });
    return NextResponse.json({ ok: true, ...availability }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TimezoneInputError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: 400 });
    }
    if (error instanceof SchedulingError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, code: "unknown", error: "The calendar check failed." }, { status: 500 });
  }
}
