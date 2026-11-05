import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sendOwnerNotification, sendVisitorConfirmation } from "./email";
import { getSetting } from "./sqlite";
import { sqliteHandle } from "./sqlite";
import { site } from "./site";

/**
 * Appointment availability and booking.
 *
 * All timestamps are stored in UTC; availability rules are expressed as local
 * minutes in an IANA timezone (America/New_York by default) and converted with
 * Intl so daylight-saving transitions are handled correctly. Booking runs inside
 * a BEGIN IMMEDIATE transaction and a unique partial index on the start time is
 * the final double-booking guarantee.
 */

export const BOOKING_TIMEZONE = "America/New_York";
const DEFAULT_SLOT_MINUTES = 15;

type Raw = NonNullable<ReturnType<typeof sqliteHandle>>;

function db(): Raw {
  const handle = sqliteHandle();
  if (!handle) throw new Error("Booking is temporarily unavailable.");
  return handle;
}

export interface Slot {
  startsAtUtc: number;
  iso: string;
  dateLabel: string;
  timeLabel: string;
  timezone: string;
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) if (part.type !== "literal") parts[part.type] = part.value;
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour) % 24, minute: Number(parts.minute), second: Number(parts.second),
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

/** Convert a wall-clock time in `timeZone` to the matching UTC instant. */
export function localToUtc(year: number, month: number, day: number, minutesFromMidnight: number, timeZone = BOOKING_TIMEZONE): Date {
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let offset = zoneOffsetMs(new Date(guess), timeZone);
  let result = guess - offset;
  // Re-check once for DST boundaries where the offset changes at the guess.
  offset = zoneOffsetMs(new Date(result), timeZone);
  result = guess - offset;
  return new Date(result);
}

export function formatSlot(startsAtUtc: number, timeZone = BOOKING_TIMEZONE): { dateLabel: string; timeLabel: string } {
  const date = new Date(startsAtUtc);
  return {
    dateLabel: new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(date),
    timeLabel: new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date),
  };
}

function bookingWindow() {
  const horizonDays = Math.max(1, Math.min(180, Number(getSetting("ai.booking_horizon_days") ?? 60) || 60));
  const noticeHours = Math.max(0, Math.min(168, Number(getSetting("ai.booking_notice_hours") ?? 24) || 24));
  const durationMinutes = Math.max(10, Math.min(60, Number(getSetting("ai.booking_duration_minutes") ?? DEFAULT_SLOT_MINUTES) || DEFAULT_SLOT_MINUTES));
  const bufferMinutes = Math.max(0, Math.min(60, Number(getSetting("ai.booking_buffer_minutes") ?? 15) || 15));
  const timezone = getSetting("ai.booking_timezone") || BOOKING_TIMEZONE;
  return { horizonDays, noticeHours, durationMinutes, bufferMinutes, timezone };
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

function overlaps(start: number, end: number, intervals: Interval[]): boolean {
  return intervals.some((interval) => start < interval.end && end > interval.start);
}

/** Generate real availability from the rules, blocked times and existing bookings. */
export function getAvailableSlots(options: { days?: number; limit?: number } = {}): Slot[] {
  const { horizonDays, noticeHours, durationMinutes, bufferMinutes, timezone } = bookingWindow();
  const days = Math.max(1, Math.min(options.days ?? 21, horizonDays));
  const limit = Math.max(1, Math.min(options.limit ?? 24, 40));
  const now = Date.now();
  const earliest = now + noticeHours * 60 * 60 * 1000;
  const latest = now + horizonDays * 24 * 60 * 60 * 1000;
  const sql = db();
  const rules = sql.prepare("SELECT weekday, start_minute, end_minute, slot_minutes, buffer_minutes, timezone, active FROM ai_availability_rules WHERE active = 1 ORDER BY weekday, start_minute").all() as RuleRow[];
  if (!rules.length) return [];
  const { blocked, booked } = activeIntervals();
  const today = zonedParts(new Date(), timezone);
  const slots: Slot[] = [];

  for (let offset = 0; offset < days && slots.length < limit; offset += 1) {
    const base = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12, 0, 0));
    const date = zonedParts(base, timezone);
    const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
    for (const rule of rules.filter((candidate) => candidate.weekday === weekday)) {
      const step = Math.max(rule.slot_minutes || durationMinutes, 5) + Math.max(rule.buffer_minutes ?? bufferMinutes, 0);
      for (let minute = rule.start_minute; minute + (rule.slot_minutes || durationMinutes) <= rule.end_minute; minute += step) {
        const start = localToUtc(date.year, date.month, date.day, minute, rule.timezone || timezone).getTime();
        const end = start + (rule.slot_minutes || durationMinutes) * 60 * 1000;
        if (start < earliest || end > latest) continue;
        if (overlaps(start, end, blocked) || overlaps(start, end, booked)) continue;
        const labels = formatSlot(start, rule.timezone || timezone);
        slots.push({ startsAtUtc: start, iso: new Date(start).toISOString(), ...labels, timezone: rule.timezone || timezone });
        if (slots.length >= limit) break;
      }
    }
  }
  return slots.sort((a, b) => a.startsAtUtc - b.startsAtUtc);
}

export function isSlotAvailable(startsAtUtc: number): boolean {
  return getAvailableSlots({ days: bookingWindow().horizonDays, limit: 40 }).some((slot) => slot.startsAtUtc === startsAtUtc);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface BookInput {
  startsAtUtc: number;
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
  manageToken: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validate + atomically book a real slot. Never trusts model-side availability. */
export async function bookAppointment(input: BookInput): Promise<BookedAppointment> {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name || name.length < 2 || name.length > 120) throw new Error("Please provide the visitor's full name.");
  if (!email || !EMAIL_RE.test(email) || email.length > 200) throw new Error("Please provide a valid business email address.");
  const startsAtUtc = Number(input.startsAtUtc);
  if (!Number.isFinite(startsAtUtc)) throw new Error("Choose a valid appointment time.");
  const { durationMinutes, timezone } = bookingWindow();
  if (!isSlotAvailable(startsAtUtc)) throw new Error("That time is no longer available. Please pick another slot.");
  const endsAtUtc = startsAtUtc + durationMinutes * 60 * 1000;
  const token = randomBytes(24).toString("base64url");
  const sql = db();
  let id: number;
  sql.exec("BEGIN IMMEDIATE");
  try {
    const clash = sql
      .prepare("SELECT id FROM ai_appointments WHERE status IN ('pending','confirmed') AND starts_at_utc < ? AND ends_at_utc > ? LIMIT 1")
      .get(endsAtUtc, startsAtUtc) as { id: number } | undefined;
    if (clash) throw new Error("That time was just booked by someone else. Please choose another slot.");
    const result = sql
      .prepare(
        `INSERT INTO ai_appointments (conversation_id, lead_id, name, email, phone, organization, specialty, starts_at_utc, ends_at_utc, timezone, status, token_hash, email_status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'pending', ?, ?, ?)`,
      )
      .run(
        input.conversationId ?? null,
        input.leadId ?? null,
        name.slice(0, 120),
        email.slice(0, 200),
        input.phone?.slice(0, 40) ?? null,
        input.organization?.slice(0, 160) ?? null,
        input.specialty?.slice(0, 120) ?? null,
        startsAtUtc,
        endsAtUtc,
        timezone,
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
    throw error;
  }

  const labels = formatSlot(startsAtUtc, timezone);
  await sendAppointmentEmails({ id, name, email, phone: input.phone ?? null, organization: input.organization ?? null, startsAtUtc, endsAtUtc, token, labels, timezone });
  return {
    id,
    startsAtUtc,
    endsAtUtc,
    dateLabel: labels.dateLabel,
    timeLabel: labels.timeLabel,
    timezone,
    manageToken: token,
  };
}

async function sendAppointmentEmails(input: {
  id: number; name: string; email: string; phone: string | null; organization: string | null;
  startsAtUtc: number; endsAtUtc: number; token: string; labels: { dateLabel: string; timeLabel: string }; timezone: string;
}): Promise<void> {
  const sql = db();
  const manageUrl = `${site.url}/appointment/manage?token=${encodeURIComponent(input.token)}`;
  const when = `${input.labels.dateLabel} at ${input.labels.timeLabel}`;
  const details = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.organization ? `Organization: ${input.organization}` : null,
    `When: ${when} (${input.timezone})`,
    `Duration: ${Math.round((input.endsAtUtc - input.startsAtUtc) / 60000)} minutes`,
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
      text: `Hi ${input.name},\n\nYour 15-minute introductory call with Knight Medical Billing is confirmed for ${when} (${input.timezone}).\n\nWe'll call the number you provided, or the meeting link will be sent before the call. Need to change it? ${manageUrl}\n\nKnight Medical Billing\n${site.phone}\n${site.email}`,
      html: `<h2>Your intro call is confirmed</h2><p>Hi ${input.name},</p><p>Your 15-minute introductory call with Knight Medical Billing is confirmed for <strong>${when}</strong> (${input.timezone}).</p><p>We'll call the number you provided, or send a meeting link before the call.</p><p><a href="${manageUrl}">Reschedule or cancel</a></p><p>Knight Medical Billing<br/>${site.phone}<br/>${site.email}</p>`,
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

export function cancelAppointmentByToken(token: string): boolean {
  const sql = db();
  const row = getAppointmentByToken(token);
  if (!row) return false;
  sql.prepare("UPDATE ai_appointments SET status = 'cancelled', updated_at = ? WHERE id = ?").run(Date.now(), row.id as number);
  return true;
}

export function rescheduleAppointmentByToken(token: string, startsAtUtc: number): boolean {
  const sql = db();
  const row = getAppointmentByToken(token);
  if (!row) return false;
  if (!isSlotAvailable(startsAtUtc)) throw new Error("That time is not available.");
  const { durationMinutes } = bookingWindow();
  sql.exec("BEGIN IMMEDIATE");
  try {
    const clash = sql.prepare("SELECT id FROM ai_appointments WHERE status IN ('pending','confirmed') AND id <> ? AND starts_at_utc < ? AND ends_at_utc > ? LIMIT 1")
      .get(row.id as number, startsAtUtc + durationMinutes * 60_000, startsAtUtc) as { id: number } | undefined;
    if (clash) throw new Error("That time was just booked. Please choose another slot.");
    sql.prepare("UPDATE ai_appointments SET starts_at_utc = ?, ends_at_utc = ?, status = 'confirmed', updated_at = ? WHERE id = ?")
      .run(startsAtUtc, startsAtUtc + durationMinutes * 60_000, Date.now(), row.id as number);
    sql.exec("COMMIT");
  } catch (error) {
    try { sql.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
  return true;
}

/* ------------------------------------------------------------------ admin */

export interface AdminAppointment {
  id: number; name: string; email: string; phone: string | null; organization: string | null;
  startsAtUtc: number; endsAtUtc: number; timezone: string; status: string; emailStatus: string;
  dateLabel: string; timeLabel: string;
}

export function listAppointments(limit = 100): AdminAppointment[] {
  try {
    const rows = db().prepare("SELECT * FROM ai_appointments ORDER BY starts_at_utc DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map((row) => {
      const startsAtUtc = Number(row.starts_at_utc);
      const labels = formatSlot(startsAtUtc, String(row.timezone ?? BOOKING_TIMEZONE));
      return {
        id: Number(row.id), name: String(row.name), email: String(row.email),
        phone: row.phone ? String(row.phone) : null, organization: row.organization ? String(row.organization) : null,
        startsAtUtc, endsAtUtc: Number(row.ends_at_utc), timezone: String(row.timezone), status: String(row.status), emailStatus: String(row.email_status),
        ...labels,
      };
    });
  } catch { return []; }
}

export function setAppointmentStatus(id: number, status: "confirmed" | "cancelled"): void {
  if (!["confirmed", "cancelled"].includes(status)) throw new Error("Invalid status.");
  db().prepare("UPDATE ai_appointments SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), id);
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
