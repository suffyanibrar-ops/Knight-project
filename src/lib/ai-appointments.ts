import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { sendOwnerNotification, sendVisitorConfirmation } from "./email";
import { getSetting } from "./sqlite";
import { sqliteHandle } from "./sqlite";
import { site } from "./site";
import {
  BUSINESS_TIMEZONE,
  TimezoneInputError,
  formatAppointment,
  formatClock,
  intervalsOverlap,
  localParts,
  localToUtcInstant,
  minutesFromClock,
  parseDateInput,
  parseTimeInput,
  resolveTimezone,
  timezoneLabel,
  type FormattedAppointment,
} from "./timezone";

/**
 * Appointment availability and booking.
 *
 * - All instants are stored in UTC plus the visitor's local date/time and IANA
 *   zone, so nothing is ever displayed in a timezone the visitor did not choose.
 * - Availability rules are wall-clock business hours in the business zone
 *   (America/New_York by default); conversions go through Luxon's IANA data, so
 *   daylight-saving changes are automatic.
 * - Conflicts use full interval overlap ([start, end)), not start-time equality.
 * - Booking runs in BEGIN IMMEDIATE with a final overlap check; a unique partial
 *   index on start time remains as a second guard.
 */

export const BOOKING_TIMEZONE = BUSINESS_TIMEZONE;
const DEFAULT_SLOT_MINUTES = 15;

export { TimezoneInputError };

export class SchedulingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SchedulingError";
    this.code = code;
  }
}

type Raw = NonNullable<ReturnType<typeof sqliteHandle>>;

function db(): Raw {
  const handle = sqliteHandle();
  if (!handle) throw new SchedulingError("calendar_unavailable", "I can't reach the calendar right now. Please try again in a moment.");
  return handle;
}

function assertCalendarOperational(): void {
  if (process.env.AI_TEST_MODE === "1" && process.env.AI_TEST_FAIL_CALENDAR === "1") {
    throw new SchedulingError("calendar_unavailable", "I'm having trouble checking the calendar right now, so I don't want to give you the wrong availability.");
  }
}

export interface Slot {
  startsAtUtc: number;
  endsAtUtc: number;
  iso: string;
  dateLabel: string;
  timeLabel: string;
  timezone: string;
  timezoneLabel: string;
  dateISO: string;
  timeISO: string;
  durationMinutes: number;
}

export interface AppointmentRequest {
  startsAtUtc: number;
  endsAtUtc: number;
  iso: string;
  date: string;
  time: string;
  timezone: string;
  timezoneLabel: string;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
}

export interface AvailabilityResult {
  available: boolean;
  reason: "available" | "conflict" | "outside_hours" | "closed" | "too_soon" | "too_far";
  message: string;
  requested: AppointmentRequest;
  alternatives: Slot[];
}

function bookingWindow() {
  const businessTimezone = resolveTimezone(getSetting("ai.booking_timezone") ?? "") ?? BUSINESS_TIMEZONE;
  const horizonDays = Math.max(1, Math.min(180, Number(getSetting("ai.booking_horizon_days") ?? 60) || 60));
  const noticeHours = Math.max(0, Math.min(168, Number(getSetting("ai.booking_notice_hours") ?? 24) || 24));
  const durationMinutes = Math.max(10, Math.min(60, Number(getSetting("ai.booking_duration_minutes") ?? DEFAULT_SLOT_MINUTES) || DEFAULT_SLOT_MINUTES));
  const bufferMinutes = Math.max(0, Math.min(60, Number(getSetting("ai.booking_buffer_minutes") ?? 15) || 15));
  return { businessTimezone, horizonDays, noticeHours, durationMinutes, bufferMinutes };
}

export function clampDuration(value: number | undefined, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(10, Math.min(60, Math.round(numeric / 5) * 5));
}

/** Format a UTC instant in the given IANA zone (defaults to business zone). */
export function formatSlot(startsAtUtc: number, timeZone = BOOKING_TIMEZONE): { dateLabel: string; timeLabel: string } {
  const formatted = formatAppointment(startsAtUtc, resolveTimezone(timeZone) ?? BOOKING_TIMEZONE);
  return { dateLabel: formatted.dateLabel, timeLabel: formatted.timeLabel };
}

/** Convert local wall-clock minutes in an IANA zone to UTC (legacy helper). */
export function localToUtc(year: number, month: number, day: number, minutesFromMidnight: number, timeZone = BOOKING_TIMEZONE): Date {
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time = formatClock(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60);
  return new Date(localToUtcInstant({ date, time, timezone: timeZone }).utcMs);
}

interface RuleRow { weekday: number; start_minute: number; end_minute: number; slot_minutes: number; buffer_minutes: number; timezone: string; active: number }
interface Interval { start: number; end: number }

function activeIntervals(): { blocked: Interval[]; booked: Interval[] } {
  const sql = db();
  const now = Date.now();
  const blocked = sql.prepare("SELECT starts_at_utc AS start, ends_at_utc AS end FROM ai_blocked_times WHERE ends_at_utc > ?").all(now) as Interval[];
  const booked = sql.prepare("SELECT starts_at_utc AS start, ends_at_utc AS end FROM ai_appointments WHERE status IN ('pending','confirmed') AND ends_at_utc > ?").all(now) as Interval[];
  return { blocked, booked };
}

function hasConflict(start: number, end: number, intervals: Interval[]): boolean {
  return intervals.some((interval) => intervalsOverlap(start, end, interval.start, interval.end));
}

function slotFor(start: number, durationMinutes: number, displayZone: string): Slot {
  const labels = formatAppointment(start, displayZone);
  return {
    startsAtUtc: start,
    endsAtUtc: start + durationMinutes * 60_000,
    iso: new Date(start).toISOString(),
    dateLabel: labels.dateLabel,
    timeLabel: labels.timeLabel,
    timezone: labels.timezone,
    timezoneLabel: labels.timezoneLabel,
    dateISO: labels.dateISO,
    timeISO: labels.timeISO,
    durationMinutes,
  };
}

/**
 * Generate real availability from the rules, blocked times and existing
 * appointments, labelled in the visitor's timezone.
 */
export function getAvailableSlots(options: { days?: number; limit?: number; timezone?: string } = {}): Slot[] {
  assertCalendarOperational();
  const window = bookingWindow();
  const displayZone = resolveTimezone(options.timezone ?? "") ?? window.businessTimezone;
  const days = Math.max(1, Math.min(options.days ?? 21, window.horizonDays));
  const limit = Math.max(1, Math.min(options.limit ?? 24, 40));
  const now = Date.now();
  const earliest = now + window.noticeHours * 60 * 60 * 1000;
  const latest = now + window.horizonDays * 24 * 60 * 60 * 1000;
  const sql = db();
  const rules = sql.prepare("SELECT weekday, start_minute, end_minute, slot_minutes, buffer_minutes, timezone, active FROM ai_availability_rules WHERE active = 1 ORDER BY weekday, start_minute").all() as RuleRow[];
  if (!rules.length) return [];
  const { blocked, booked } = activeIntervals();
  const startDay = DateTime.now().setZone(window.businessTimezone).startOf("day");
  const slots: Slot[] = [];

  for (let offset = 0; offset < days && slots.length < limit; offset += 1) {
    const day = startDay.plus({ days: offset });
    const dateISO = day.toFormat("yyyy-LL-dd");
    const weekday = day.weekday % 7;
    for (const rule of rules.filter((candidate) => candidate.weekday === weekday)) {
      const duration = rule.slot_minutes || window.durationMinutes;
      const step = Math.max(duration, 5) + Math.max(rule.buffer_minutes ?? window.bufferMinutes, 0);
      for (let minute = rule.start_minute; minute + duration <= rule.end_minute; minute += step) {
        const time = formatClock(Math.floor(minute / 60), minute % 60);
        const start = localToUtcInstant({ date: dateISO, time, timezone: rule.timezone || window.businessTimezone }).utcMs;
        const end = start + duration * 60_000;
        if (start < earliest || end > latest) continue;
        if (hasConflict(start, end, blocked) || hasConflict(start, end, booked)) continue;
        slots.push(slotFor(start, duration, displayZone));
        if (slots.length >= limit) break;
      }
    }
  }
  return slots.sort((a, b) => a.startsAtUtc - b.startsAtUtc);
}

function buildRequest(utcMs: number, durationMinutes: number, timezone: string): AppointmentRequest {
  const formatted: FormattedAppointment = formatAppointment(utcMs, timezone);
  const parts = localParts(utcMs, formatted.timezone);
  return {
    startsAtUtc: utcMs,
    endsAtUtc: utcMs + durationMinutes * 60_000,
    iso: new Date(utcMs).toISOString(),
    date: parts.date,
    time: parts.time,
    timezone: formatted.timezone,
    timezoneLabel: formatted.timezoneLabel,
    dateLabel: formatted.dateLabel,
    timeLabel: formatted.timeLabel,
    durationMinutes,
  };
}

function businessHoursFailure(start: number, durationMinutes: number): "outside_hours" | "closed" | null {
  const window = bookingWindow();
  const business = DateTime.fromMillis(start, { zone: window.businessTimezone });
  const weekday = business.weekday % 7;
  const rules = db().prepare("SELECT weekday, start_minute, end_minute FROM ai_availability_rules WHERE active = 1 AND weekday = ?").all(weekday) as { weekday: number; start_minute: number; end_minute: number }[];
  if (!rules.length) return "closed";
  const startMinute = business.hour * 60 + business.minute;
  const endMinute = startMinute + durationMinutes;
  const fits = rules.some((rule) => startMinute >= rule.start_minute && endMinute <= rule.end_minute);
  return fits ? null : "outside_hours";
}

/**
 * Check a specific visitor-requested local time against the real calendar.
 * Timezone and AM/PM ambiguity are rejected explicitly instead of guessed.
 */
export function checkRequestedAvailability(input: { date: string; time: string; timezone: string; durationMinutes?: number }): AvailabilityResult {
  assertCalendarOperational();
  const window = bookingWindow();
  const local = localToUtcInstant({ date: input.date, time: input.time, timezone: input.timezone });
  const duration = clampDuration(input.durationMinutes, window.durationMinutes);
  const requested = buildRequest(local.utcMs, duration, local.timezone);
  const earliest = Date.now() + window.noticeHours * 60 * 60 * 1000;
  const latest = Date.now() + window.horizonDays * 24 * 60 * 60 * 1000;

  if (local.utcMs < earliest) {
    return { available: false, reason: "too_soon", message: "That time is too soon to book online. Please choose a later time.", requested, alternatives: [] };
  }
  if (local.utcMs > latest) {
    return { available: false, reason: "too_far", message: "That date is beyond our online booking window. Please choose an earlier date.", requested, alternatives: [] };
  }

  const hoursReason = businessHoursFailure(local.utcMs, duration);
  if (hoursReason === "closed") {
    return { available: false, reason: "closed", message: "We don't have booking hours on that day.", requested, alternatives: [] };
  }
  if (hoursReason === "outside_hours") {
    return { available: false, reason: "outside_hours", message: "That time is outside our booking hours.", requested, alternatives: [] };
  }

  const { blocked, booked } = activeIntervals();
  const conflict = hasConflict(local.utcMs, local.utcMs + duration * 60_000, blocked) || hasConflict(local.utcMs, local.utcMs + duration * 60_000, booked);
  if (conflict) {
    const alternatives = getAvailableSlots({ days: 21, limit: 30, timezone: local.timezone })
      .filter((slot) => slot.startsAtUtc !== local.utcMs)
      .sort((a, b) => Math.abs(a.startsAtUtc - local.utcMs) - Math.abs(b.startsAtUtc - local.utcMs))
      .slice(0, 3);
    return {
      available: false,
      reason: "conflict",
      message: "That time is already booked. I can check the closest available times around it.",
      requested,
      alternatives,
    };
  }

  return { available: true, reason: "available", message: "That time is available.", requested, alternatives: [] };
}

export function isSlotAvailable(startsAtUtc: number, timezone = BOOKING_TIMEZONE): boolean {
  const formatted = formatAppointment(startsAtUtc, resolveTimezone(timezone) ?? BOOKING_TIMEZONE);
  try {
    return checkRequestedAvailability({
      date: formatted.dateISO,
      time: formatted.timeISO,
      timezone: formatted.timezone,
      durationMinutes: bookingWindow().durationMinutes,
    }).available;
  } catch {
    return false;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface BookInput {
  date?: string;
  time?: string;
  timezone?: string;
  durationMinutes?: number;
  /** Legacy support: exact UTC instant. Local date/time/timezone is preferred. */
  startsAtUtc?: number;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  specialty?: string | null;
  notes?: string | null;
  conversationId?: number | null;
  leadId?: number | null;
}

export interface BookedAppointment {
  id: number;
  startsAtUtc: number;
  endsAtUtc: number;
  dateLabel: string;
  timeLabel: string;
  timezone: string;
  timezoneLabel: string;
  localDate: string;
  localTime: string;
  durationMinutes: number;
  manageToken: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function resolveRequestedInstant(input: BookInput): { utcMs: number; timezone: string; duration: number } {
  const window = bookingWindow();
  const duration = clampDuration(input.durationMinutes, window.durationMinutes);
  if (input.date && input.time) {
    const zone = resolveTimezone(input.timezone);
    if (!zone) throw new TimezoneInputError("unknown_timezone", "Which time zone should I use — Eastern, Central, Mountain or Pacific?");
    const local = localToUtcInstant({ date: input.date, time: input.time, timezone: zone });
    return { utcMs: local.utcMs, timezone: zone, duration };
  }
  if (Number.isFinite(input.startsAtUtc)) {
    const zone = resolveTimezone(input.timezone) ?? window.businessTimezone;
    if (!resolveTimezone(input.timezone)) {
      // Legacy callers without a timezone keep the old business-zone behaviour;
      // the UI and agent always send an explicit visitor timezone.
    }
    return { utcMs: Number(input.startsAtUtc), timezone: zone, duration };
  }
  throw new TimezoneInputError("needs_time", "A date and time are needed to book the call.");
}

/** Validate + atomically book a real slot. Never trusts model-side availability. */
export async function bookAppointment(input: BookInput): Promise<BookedAppointment> {
  assertCalendarOperational();
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name || name.length < 2 || name.length > 120) throw new Error("Please provide the visitor's full name.");
  if (!email || !EMAIL_RE.test(email) || email.length > 200) throw new Error("Please provide a valid business email address.");

  const { utcMs, timezone, duration } = resolveRequestedInstant(input);
  if (!Number.isFinite(utcMs)) throw new Error("Choose a valid appointment time.");

  // Re-run the same real availability check used by the agent, in the visitor's zone.
  const formatted = formatAppointment(utcMs, timezone);
  const availability = checkRequestedAvailability({ date: formatted.dateISO, time: formatted.timeInput, timezone, durationMinutes: duration });
  if (!availability.available) throw new SchedulingError(availability.reason, availability.message);

  const endsAtUtc = utcMs + duration * 60 * 1000;
  const token = randomBytes(24).toString("base64url");
  const sql = db();
  let id: number;
  sql.exec("BEGIN IMMEDIATE");
  try {
    const clash = sql
      .prepare("SELECT id FROM ai_appointments WHERE status IN ('pending','confirmed') AND starts_at_utc < ? AND ends_at_utc > ? LIMIT 1")
      .get(endsAtUtc, utcMs) as { id: number } | undefined;
    if (clash) throw new SchedulingError("conflict", "That time was just booked by someone else. Please choose another time.");
    const result = sql
      .prepare(
        `INSERT INTO ai_appointments (conversation_id, lead_id, name, email, phone, organization, specialty, starts_at_utc, ends_at_utc, timezone, local_date, local_time, duration_minutes, status, token_hash, email_status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'pending', ?, ?, ?)`,
      )
      .run(
        input.conversationId ?? null,
        input.leadId ?? null,
        name.slice(0, 120),
        email.slice(0, 200),
        input.phone?.slice(0, 40) ?? null,
        input.organization?.slice(0, 160) ?? null,
        input.specialty?.slice(0, 120) ?? null,
        utcMs,
        endsAtUtc,
        timezone,
        formatted.dateISO,
        formatted.timeISO,
        duration,
        hashToken(token),
        input.notes?.slice(0, 1000) ?? null,
        Date.now(),
        Date.now(),
      );
    id = Number(result.lastInsertRowid);
    if (input.conversationId) {
      sql.prepare("UPDATE ai_conversations SET appointment_id = ?, last_activity_at = ? WHERE id = ?").run(id, Date.now(), input.conversationId);
    }
    sql.exec("COMMIT");
  } catch (error) {
    try { sql.exec("ROLLBACK"); } catch { /* ignore */ }
    if (error instanceof SchedulingError) throw error;
    if (String((error as Error)?.message).includes("UNIQUE")) throw new SchedulingError("conflict", "That time was just booked. Please choose another time.");
    throw error;
  }

  const labels = formatAppointment(utcMs, timezone);
  await sendAppointmentEmails({
    id, name, email, phone: input.phone ?? null, organization: input.organization ?? null,
    startsAtUtc: utcMs, endsAtUtc, token, labels, timezone, durationMinutes: duration,
  });
  return {
    id,
    startsAtUtc: utcMs,
    endsAtUtc,
    dateLabel: labels.dateLabel,
    timeLabel: labels.timeLabel,
    timezone,
    timezoneLabel: labels.timezoneLabel,
    localDate: labels.dateISO,
    localTime: labels.timeISO,
    durationMinutes: duration,
    manageToken: token,
  };
}

async function sendAppointmentEmails(input: {
  id: number; name: string; email: string; phone: string | null; organization: string | null;
  startsAtUtc: number; endsAtUtc: number; token: string; labels: FormattedAppointment; timezone: string; durationMinutes: number;
}): Promise<void> {
  const sql = db();
  if (process.env.AI_TEST_MODE === "1" && process.env.AI_TEST_SUPPRESS_EMAILS === "1") {
    sql.prepare("UPDATE ai_appointments SET email_status = 'suppressed' WHERE id = ?").run(input.id);
    return;
  }
  const manageUrl = `${site.url}/appointment/manage?token=${encodeURIComponent(input.token)}`;
  const when = `${input.labels.dateLabel} at ${input.labels.timeLabel}`;
  const duration = input.durationMinutes;
  const details = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.organization ? `Organization: ${input.organization}` : null,
    `When: ${when} (${input.labels.timezoneLabel})`,
    `Duration: ${duration} minutes`,
  ].filter(Boolean).join("\n");
  try {
    const owner = await sendOwnerNotification({
      kind: "appointment",
      subject: `New AI-booked appointment — ${when}`,
      text: `A visitor booked an introductory call through the AI agent.\n\n${details}\n\nReschedule/cancel: ${manageUrl}`,
      html: `<h2>New AI-booked appointment</h2><p>A visitor booked an introductory call through the AI agent.</p><ul>${details.split("\n").map((line) => `<li>${line}</li>`).join("")}</ul><p><a href="${manageUrl}">Manage this appointment</a></p>`,
      relatedType: "ai_appointment",
      relatedId: input.id,
    });
    await sendVisitorConfirmation({
      kind: "appointment",
      subject: `Your Knight Medical Billing intro call — ${when}`,
      text: `Hi ${input.name},\n\nYour ${duration}-minute introductory call with Knight Medical Billing is confirmed for ${when} (${input.labels.timezoneLabel}).\n\nWe'll call the number you provided, or the meeting link will be sent before the call. Need to change it? ${manageUrl}\n\nKnight Medical Billing\n${site.phone}\n${site.email}`,
      html: `<h2>Your intro call is confirmed</h2><p>Hi ${input.name},</p><p>Your ${duration}-minute introductory call with Knight Medical Billing is confirmed for <strong>${when}</strong> (${input.labels.timezoneLabel}).</p><p>We'll call the number you provided, or send a meeting link before the call.</p><p><a href="${manageUrl}">Reschedule or cancel</a></p><p>Knight Medical Billing<br/>${site.phone}<br/>${site.email}</p>`,
      to: input.email,
      relatedType: "ai_appointment",
      relatedId: input.id,
    });
    const failed = owner.status === "failed";
    sql.prepare("UPDATE ai_appointments SET email_status = ? WHERE id = ?").run(failed ? "owner_failed" : "sent", input.id);
  } catch {
    sql.prepare("UPDATE ai_appointments SET email_status = 'failed' WHERE id = ?").run(input.id);
  }
}

export function getAppointmentByToken(token: string) {
  if (!token || token.length > 200) return null;
  const sql = db();
  return (sql.prepare("SELECT * FROM ai_appointments WHERE token_hash = ? LIMIT 1").get(hashToken(token)) as Record<string, unknown> | undefined) ?? null;
}

export interface AppointmentTimeChange {
  date?: string;
  time?: string;
  timezone?: string;
  durationMinutes?: number;
  /** Legacy support. */
  startsAtUtc?: number;
}

export function cancelAppointmentByToken(token: string): boolean {
  const sql = db();
  const row = getAppointmentByToken(token);
  if (!row) return false;
  sql.prepare("UPDATE ai_appointments SET status = 'cancelled', updated_at = ? WHERE id = ?").run(Date.now(), row.id as number);
  return true;
}

export function rescheduleAppointmentByToken(token: string, change: AppointmentTimeChange): { previous: Record<string, unknown> } {
  assertCalendarOperational();
  const sql = db();
  const row = getAppointmentByToken(token);
  if (!row) throw new Error("This appointment link is invalid or has expired.");
  if (String(row.status) === "cancelled") throw new Error("This appointment was already cancelled.");
  const timezone = resolveTimezone(change.timezone) ?? (resolveTimezone(String(row.timezone)) ?? BOOKING_TIMEZONE);
  const duration = clampDuration(change.durationMinutes, Number(row.duration_minutes ?? bookingWindow().durationMinutes));
  let date = change.date;
  let time = change.time;
  if ((!date || !time) && Number.isFinite(change.startsAtUtc)) {
    const formatted = formatAppointment(Number(change.startsAtUtc), timezone);
    date = formatted.dateISO;
    time = formatted.timeInput;
  }
  if (!date || !time) throw new TimezoneInputError("needs_time", "A new date and time are needed.");
  const availability = checkRequestedAvailability({ date, time, timezone, durationMinutes: duration });
  if (!availability.available) throw new SchedulingError(availability.reason, availability.message);
  const start = availability.requested.startsAtUtc;
  const end = start + duration * 60_000;
  const formatted = formatAppointment(start, timezone);
  sql.exec("BEGIN IMMEDIATE");
  try {
    const clash = sql
      .prepare("SELECT id FROM ai_appointments WHERE status IN ('pending','confirmed') AND id <> ? AND starts_at_utc < ? AND ends_at_utc > ? LIMIT 1")
      .get(row.id as number, end, start) as { id: number } | undefined;
    if (clash) throw new SchedulingError("conflict", "That time was just booked. Please choose another time.");
    sql.prepare("UPDATE ai_appointments SET starts_at_utc = ?, ends_at_utc = ?, timezone = ?, local_date = ?, local_time = ?, duration_minutes = ?, status = 'confirmed', updated_at = ? WHERE id = ?")
      .run(start, end, timezone, formatted.dateISO, formatted.timeISO, duration, Date.now(), row.id as number);
    sql.exec("COMMIT");
  } catch (error) {
    try { sql.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
  return { previous: row };
}

/* ------------------------------------------------------------------ admin */

export interface AdminAppointment {
  id: number; name: string; email: string; phone: string | null; organization: string | null;
  startsAtUtc: number; endsAtUtc: number; timezone: string; timezoneLabel: string; status: string; emailStatus: string;
  dateLabel: string; timeLabel: string; durationMinutes: number; localDate: string | null; localTime: string | null;
}

export function listAppointments(limit = 100): AdminAppointment[] {
  try {
    const rows = db().prepare("SELECT * FROM ai_appointments ORDER BY starts_at_utc DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map((row) => {
      const startsAtUtc = Number(row.starts_at_utc);
      const timezone = resolveTimezone(String(row.timezone ?? "")) ?? BOOKING_TIMEZONE;
      const formatted = formatAppointment(startsAtUtc, timezone);
      return {
        id: Number(row.id), name: String(row.name), email: String(row.email),
        phone: row.phone ? String(row.phone) : null, organization: row.organization ? String(row.organization) : null,
        startsAtUtc, endsAtUtc: Number(row.ends_at_utc), timezone, timezoneLabel: formatted.timezoneLabel,
        status: String(row.status), emailStatus: String(row.email_status),
        dateLabel: formatted.dateLabel, timeLabel: formatted.timeLabel, durationMinutes: Number(row.duration_minutes ?? 15),
        localDate: row.local_date ? String(row.local_date) : formatted.dateISO,
        localTime: row.local_time ? String(row.local_time) : formatted.timeISO,
      };
    });
  } catch { return []; }
}

export function setAppointmentStatus(id: number, status: "confirmed" | "cancelled"): void {
  if (!["confirmed", "cancelled"].includes(status)) throw new Error("Invalid status.");
  db().prepare("UPDATE ai_appointments SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), id);
}

/** Build a display row for the manage page. */
export function appointmentDisplay(row: Record<string, unknown>): { formatted: FormattedAppointment; durationMinutes: number } {
  const start = Number(row.starts_at_utc);
  const timezone = resolveTimezone(String(row.timezone ?? "")) ?? BOOKING_TIMEZONE;
  return { formatted: formatAppointment(start, timezone), durationMinutes: Number(row.duration_minutes ?? 15) };
}

export interface AvailabilityRule { id: number; weekday: number; startMinute: number; endMinute: number; slotMinutes: number; bufferMinutes: number; active: boolean }
export function listAvailabilityRules(): AvailabilityRule[] {
  try {
    const rows = db().prepare("SELECT * FROM ai_availability_rules ORDER BY weekday, start_minute").all() as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id), weekday: Number(row.weekday), startMinute: Number(row.start_minute), endMinute: Number(row.end_minute),
      slotMinutes: Number(row.slot_minutes), bufferMinutes: Number(row.buffer_minutes), active: Number(row.active) === 1,
    }));
  } catch { return []; }
}

export function saveAvailabilityRule(input: { id: number; startMinute: number; endMinute: number; slotMinutes: number; bufferMinutes: number; active: boolean }): void {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
  const start = clamp(input.startMinute, 0, 1439);
  const end = clamp(input.endMinute, start + 15, 1440);
  db().prepare("UPDATE ai_availability_rules SET start_minute = ?, end_minute = ?, slot_minutes = ?, buffer_minutes = ?, active = ?, updated_at = ? WHERE id = ?")
    .run(start, end, clamp(input.slotMinutes, 10, 60), clamp(input.bufferMinutes, 0, 60), input.active ? 1 : 0, Date.now(), input.id);
}

export function listBlockedTimes(): { id: number; startsAtUtc: number; endsAtUtc: number; reason: string | null }[] {
  try {
    const rows = db().prepare("SELECT * FROM ai_blocked_times ORDER BY starts_at_utc ASC").all() as Record<string, unknown>[];
    return rows.map((row) => ({ id: Number(row.id), startsAtUtc: Number(row.starts_at_utc), endsAtUtc: Number(row.ends_at_utc), reason: row.reason ? String(row.reason) : null }));
  } catch { return []; }
}

export function addBlockedTime(input: { startsAtUtc: number; endsAtUtc: number; reason?: string }): void {
  if (!Number.isFinite(input.startsAtUtc) || !Number.isFinite(input.endsAtUtc) || input.endsAtUtc <= input.startsAtUtc) throw new Error("Invalid blocked time window.");
  db().prepare("INSERT INTO ai_blocked_times (starts_at_utc, ends_at_utc, reason, created_at) VALUES (?, ?, ?, ?)")
    .run(input.startsAtUtc, input.endsAtUtc, input.reason?.slice(0, 200) ?? null, Date.now());
}

export function deleteBlockedTime(id: number): void {
  db().prepare("DELETE FROM ai_blocked_times WHERE id = ?").run(id);
}

export { timezoneLabel, parseDateInput, parseTimeInput };
