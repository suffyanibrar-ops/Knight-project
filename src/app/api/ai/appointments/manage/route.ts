import { NextResponse } from "next/server";
import { cancelAppointmentByToken, formatSlot, getAppointmentByToken, rescheduleAppointmentByToken } from "@/lib/ai-appointments";
import { sendOwnerNotification, sendVisitorConfirmation } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-security";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  const headers = await request.headers;
  const limit = checkRateLimit({ key: `appt-manage:${clientKeyFromHeaders(headers)}`, limit: 15, windowMs: 10 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  const token = typeof body.token === "string" ? body.token : "";
  const action = String(body.action ?? "");
  const appointment = getAppointmentByToken(token);
  if (!appointment) return NextResponse.json({ ok: false, error: "This link is invalid or has expired." }, { status: 404 });
  if (appointment.status === "cancelled") return NextResponse.json({ ok: false, error: "This appointment was already cancelled." }, { status: 409 });
  try {
    if (action === "cancel") {
      cancelAppointmentByToken(token);
    } else if (action === "reschedule") {
      const startsAtUtc = Number(body.startsAtUtc);
      if (!Number.isFinite(startsAtUtc)) return NextResponse.json({ ok: false, error: "Choose a new time." }, { status: 400 });
      rescheduleAppointmentByToken(token, startsAtUtc);
    } else {
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not update the appointment." }, { status: 409 });
  }
  const updated = getAppointmentByToken(token);
  const startsAtUtc = Number(updated?.starts_at_utc ?? appointment.starts_at_utc);
  const labels = formatSlot(startsAtUtc);
  const email = String(appointment.email);
  const name = String(appointment.name);
  const summary = action === "cancel" ? "cancelled" : `moved to ${labels.dateLabel} at ${labels.timeLabel}`;
  try {
    await sendOwnerNotification({
      kind: "appointment",
      subject: `AI appointment ${summary} — ${name}`,
      text: `${name} (${email}) ${summary} their introductory call.`,
      html: `<p>${name} (${email}) ${summary} their introductory call.</p>`,
      relatedType: "ai_appointment",
      relatedId: Number(appointment.id),
    });
    if (action === "cancel") {
      await sendVisitorConfirmation({ kind: "appointment", to: email, subject: "Your Knight Medical Billing call was cancelled", text: `Hi ${name},\n\nYour introductory call was cancelled. You can book a new time any time at ${site.url}/schedule-form.\n\n${site.phone}`, html: `<p>Hi ${name},</p><p>Your introductory call has been cancelled. You can book a new time at <a href="${site.url}/schedule-form">our scheduling page</a>.</p><p>${site.phone}</p>` });
    }
  } catch { /* status change already succeeded */ }
  return NextResponse.json({ ok: true, status: action === "cancel" ? "cancelled" : "confirmed", startsAtUtc, dateLabel: labels.dateLabel, timeLabel: labels.timeLabel });
}
