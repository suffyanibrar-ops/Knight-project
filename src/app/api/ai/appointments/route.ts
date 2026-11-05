import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bookAppointment } from "@/lib/ai-appointments";
import { getAiSettings } from "@/lib/ai-config";
import { AI_SESSION_COOKIE, findConversationByToken } from "@/lib/ai-session";
import { isSameOrigin } from "@/lib/request-security";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manual booking from the visual calendar in the chat widget. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  const headers = await request.headers;
  const limit = checkRateLimit({ key: `ai-book:${clientKeyFromHeaders(headers)}`, limit: 8, windowMs: 10 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many booking attempts. Please try again shortly." }, { status: 429 });
  if (!getAiSettings().bookingEnabled) return NextResponse.json({ ok: false, error: "Online booking is currently unavailable. Please call us." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  const startsAtUtc = Number(body.startsAtUtc);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const confirmed = body.confirmed === true;
  if (!confirmed) return NextResponse.json({ ok: false, error: "Please confirm the appointment details before booking." }, { status: 400 });
  if (!name || !email) return NextResponse.json({ ok: false, error: "Name and business email are required." }, { status: 400 });

  const cookieStore = await cookies();
  const conversation = findConversationByToken(cookieStore.get(AI_SESSION_COOKIE)?.value);
  try {
    const booked = await bookAppointment({
      startsAtUtc,
      name,
      email,
      phone: typeof body.phone === "string" ? body.phone : null,
      organization: typeof body.organization === "string" ? body.organization : null,
      specialty: typeof body.specialty === "string" ? body.specialty : null,
      conversationId: conversation?.id ?? null,
    });
    return NextResponse.json({
      ok: true,
      appointment: { id: booked.id, startsAtUtc: booked.startsAtUtc, dateLabel: booked.dateLabel, timeLabel: booked.timeLabel, timezone: booked.timezone, manageToken: booked.manageToken },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Booking failed." }, { status: 409 });
  }
}
