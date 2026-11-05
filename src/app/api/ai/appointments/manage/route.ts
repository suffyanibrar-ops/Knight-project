import { NextResponse } from "next/server";
import { appointmentDisplay, cancelAppointmentByToken, getAppointmentByToken, rescheduleAppointmentByToken, SchedulingError, TimezoneInputError } from "@/lib/ai-appointments";
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
      rescheduleAppointmentByToken(token, {
        date: typeof body.date === "string" ? body.date : undefined,
        time: typeof body.time === "string" ? body.time : undefined,
        timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
        startsAtUtc: typeof body.startsAtUtc === "number" ? body.startsAtUtc : undefined,
      });
    } else {
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof TimezoneInputError) return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: 400 });
    if (error instanceof SchedulingError) {
      const status = error.code === "calendar_unavailable" ? 503 : 409;
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not update the appointment." }, { status: 409 });
  }
  const updated = getAppointmentByToken(token) ?? appointment;
  const display = appointmentDisplay(updated);
  const email = String(appointment.email);
  const name = String(appointment.name);
  const summary = action === "cancel" ? "cancelled" : `moved to ${display.formatted.dateLabel} at ${display.formatted.timeLabel}`;
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
  return NextResponse.json({
    ok: true,
    status: action === "cancel" ? "cancelled" : "confirmed",
    startsAtUtc: Number(updated.starts_at_utc),
    dateLabel: display.formatted.dateLabel,
    timeLabel: display.formatted.timeLabel,
    timezone: display.formatted.timezone,
    timezoneLabel: display.formatted.timezoneLabel,
    durationMinutes: display.durationMinutes,
  });
}
