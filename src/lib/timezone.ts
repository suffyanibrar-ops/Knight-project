import { IANAZone, DateTime } from "luxon";

/**
 * IANA-timezone utilities shared by scheduling and tests.
 *
 * No fixed UTC offsets are used: every conversion goes through Luxon's IANA
 * zone database, so daylight-saving transitions are handled by the tz data.
 * Visitors may live in any of the four US zones; the calendar's business hours
 * remain in the configured business zone (America/New_York by default).
 */

export type TimezoneErrorCode =
  | "needs_date"
  | "needs_time"
  | "ambiguous_time"
  | "invalid_date"
  | "invalid_time"
  | "unknown_timezone"
  | "ambiguous_local_time"
  | "nonexistent_local_time";

export class TimezoneInputError extends Error {
  readonly code: TimezoneErrorCode;
  constructor(code: TimezoneErrorCode, message: string) {
    super(message);
    this.name = "TimezoneInputError";
    this.code = code;
  }
}

export const BUSINESS_TIMEZONE = "America/New_York";

const FRIENDLY_ZONES: Record<string, string> = {
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Phoenix": "Arizona Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Anchorage": "Alaska Time",
  "Pacific/Honolulu": "Hawaii Time",
};

const ALIASES: Record<string, string> = {
  eastern: "America/New_York",
  east: "America/New_York",
  et: "America/New_York",
  est: "America/New_York",
  edt: "America/New_York",
  "eastern time": "America/New_York",
  "eastern standard time": "America/New_York",
  "eastern daylight time": "America/New_York",
  "us eastern": "America/New_York",
  "new york": "America/New_York",
  "new york time": "America/New_York",
  central: "America/Chicago",
  ct: "America/Chicago",
  cst: "America/Chicago",
  cdt: "America/Chicago",
  "central time": "America/Chicago",
  "central standard time": "America/Chicago",
  "central daylight time": "America/Chicago",
  "us central": "America/Chicago",
  chicago: "America/Chicago",
  "chicago time": "America/Chicago",
  mountain: "America/Denver",
  mt: "America/Denver",
  mst: "America/Denver",
  mdt: "America/Denver",
  "mountain time": "America/Denver",
  "mountain standard time": "America/Denver",
  "mountain daylight time": "America/Denver",
  "us mountain": "America/Denver",
  denver: "America/Denver",
  "denver time": "America/Denver",
  arizona: "America/Phoenix",
  phoenix: "America/Phoenix",
  pacific: "America/Los_Angeles",
  pt: "America/Los_Angeles",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  "pacific time": "America/Los_Angeles",
  "pacific standard time": "America/Los_Angeles",
  "pacific daylight time": "America/Los_Angeles",
  "us pacific": "America/Los_Angeles",
  "los angeles": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  seattle: "America/Los_Angeles",
  portland: "America/Los_Angeles",
  "san diego": "America/Los_Angeles",
  "las vegas": "America/Los_Angeles",
  alaska: "America/Anchorage",
  hawaii: "Pacific/Honolulu",
};

// Unambiguous city/state hints. States spanning multiple zones are deliberately
// omitted so the agent asks instead of guessing.
const CITY_ZONES: Record<string, string> = {
  "new york": "America/New_York", boston: "America/New_York", philadelphia: "America/New_York",
  "washington dc": "America/New_York", atlanta: "America/New_York",
  miami: "America/New_York", orlando: "America/New_York", tampa: "America/New_York",
  charlotte: "America/New_York", raleigh: "America/New_York", detroit: "America/New_York",
  cleveland: "America/New_York", columbus: "America/New_York", indianapolis: "America/New_York",
  baltimore: "America/New_York", pittsburgh: "America/New_York", richmond: "America/New_York",
  chicago: "America/Chicago", dallas: "America/Chicago", houston: "America/Chicago",
  austin: "America/Chicago", "san antonio": "America/Chicago", "fort worth": "America/Chicago",
  minneapolis: "America/Chicago", "st. louis": "America/Chicago", "saint louis": "America/Chicago",
  "kansas city": "America/Chicago", "new orleans": "America/Chicago", nashville: "America/Chicago",
  memphis: "America/Chicago", milwaukee: "America/Chicago", "oklahoma city": "America/Chicago",
  denver: "America/Denver", "salt lake city": "America/Denver", albuquerque: "America/Denver",
  "colorado springs": "America/Denver", boise: "America/Denver",
  phoenix: "America/Phoenix", tucson: "America/Phoenix",
  "los angeles": "America/Los_Angeles", "san francisco": "America/Los_Angeles",
  "san diego": "America/Los_Angeles", seattle: "America/Los_Angeles", portland: "America/Los_Angeles",
  "las vegas": "America/Los_Angeles", sacramento: "America/Los_Angeles", san: "America/Los_Angeles",
  "san jose": "America/Los_Angeles", oakland: "America/Los_Angeles",
};

export function isValidTimezone(timezone: string): boolean {
  return typeof timezone === "string" && timezone.includes("/") && IANAZone.isValidZone(timezone);
}

/** Resolve aliases, city hints and IANA identifiers. Returns null when unclear. */
export function resolveTimezone(input?: string | null): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (isValidTimezone(raw)) return raw;
  const key = raw.toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ").replace(/\./g, "").trim();
  if (ALIASES[key]) return ALIASES[key];
  if (ALIASES[key.replace(/\s*time$/, "")]) return ALIASES[key.replace(/\s*time$/, "")];
  if (CITY_ZONES[key]) return CITY_ZONES[key];
  // Accept "America/Chicago" written with spaces or lowercase.
  const normalized = raw.replace(/\s+/g, "_");
  for (const zone of Object.keys(FRIENDLY_ZONES)) {
    if (zone.toLowerCase() === normalized.toLowerCase()) return zone;
  }
  return null;
}

export function timezoneLabel(timezone: string): string {
  return FRIENDLY_ZONES[timezone] ?? timezone.replace(/_/g, " ");
}

export function timezoneOptionLabel(timezone: string): string {
  const abbreviation = DateTime.now().setZone(timezone).toFormat("ZZZZ");
  return `${timezoneLabel(timezone)} (${abbreviation})`;
}

/** Strict date-only parser: YYYY-MM-DD. */
export function parseDateInput(date: string | null | undefined): { year: number; month: number; day: number; iso: string } {
  if (!date || !date.trim()) throw new TimezoneInputError("needs_date", "A specific date is needed (for example 2026-11-10).");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) throw new TimezoneInputError("invalid_date", "Use the date format YYYY-MM-DD.");
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const dt = DateTime.fromObject({ year, month, day }, { zone: "UTC" });
  if (!dt.isValid || dt.year !== year || dt.month !== month || dt.day !== day) throw new TimezoneInputError("invalid_date", "That date does not exist.");
  return { year, month, day, iso: `${match[1]}-${match[2]}-${match[3]}` };
}

export interface ParsedTime { hour: number; minute: number; source: "12h" | "24h" }

/**
 * Parse a visitor/system supplied clock time. Plain numbers without AM/PM are
 * ambiguous by design (e.g. "2" or "2:30") and must be clarified.
 */
export function parseTimeInput(time: string | null | undefined): ParsedTime {
  if (!time || !time.trim()) throw new TimezoneInputError("needs_time", "A specific time is needed (for example 2:00 PM).");
  const raw = time.trim().toLowerCase().replace(/\s+/g, " ").replace(/\./g, "");
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(raw);
  if (!match) throw new TimezoneInputError("invalid_time", "Use a time like 2:00 PM or 14:00.");
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) throw new TimezoneInputError("invalid_time", "That time is not valid.");
  if (meridiem) {
    if (hour < 1 || hour > 12) throw new TimezoneInputError("invalid_time", "When using AM/PM, the hour must be 1–12.");
    const normalized = hour % 12 + (meridiem === "pm" ? 12 : 0);
    return { hour: normalized, minute, source: "12h" };
  }
  // 24-hour strings are unambiguous when padded (09:00, 10:00) or >= 13:00.
  // A bare hour (2) or unpadded hour (2:30) is ambiguous and must be clarified.
  if (hour >= 13 && hour <= 23) return { hour, minute, source: "24h" };
  if (hour === 0) return { hour: 0, minute, source: "24h" };
  if (match[1].length === 2) return { hour, minute, source: "24h" };
  throw new TimezoneInputError("ambiguous_time", "Was that AM or PM?");
}

export function formatClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export interface LocalToUtcResult {
  utcMs: number;
  iso: string;
  date: string;
  time: string;
  timezone: string;
  timezoneLabel: string;
}

/** Convert a wall-clock date/time in an IANA zone into a UTC instant. */
export function localToUtcInstant(input: { date: string; time: string; timezone: string }): LocalToUtcResult {
  const zone = resolveTimezone(input.timezone);
  if (!zone) throw new TimezoneInputError("unknown_timezone", "Which time zone should I use — Eastern, Central, Mountain or Pacific?");
  const parsedDate = parseDateInput(input.date);
  const parsedTime = parseTimeInput(input.time);
  const dt = DateTime.fromObject(
    { year: parsedDate.year, month: parsedDate.month, day: parsedDate.day, hour: parsedTime.hour, minute: parsedTime.minute },
    { zone },
  );
  if (!dt.isValid) throw new TimezoneInputError("invalid_date", "That date/time is not valid.");
  // Luxon shifts nonexistent local times (spring-forward gap) forward; reject
  // those rather than silently booking a different time.
  if (dt.year !== parsedDate.year || dt.month !== parsedDate.month || dt.day !== parsedDate.day || dt.hour !== parsedTime.hour || dt.minute !== parsedTime.minute) {
    throw new TimezoneInputError("nonexistent_local_time", "That local time does not exist because the clocks change; please choose another time.");
  }
  const offsets = dt.getPossibleOffsets();
  if (offsets.length > 1) {
    throw new TimezoneInputError("ambiguous_local_time", "That local time occurs twice when the clocks change; please choose a nearby time.");
  }
  return {
    utcMs: dt.toUTC().toMillis(),
    iso: dt.toUTC().toISO({ suppressMilliseconds: true }) ?? dt.toUTC().toISO()!,
    date: parsedDate.iso,
    time: `${String(parsedTime.hour).padStart(2, "0")}:${String(parsedTime.minute).padStart(2, "0")}`,
    timezone: zone,
    timezoneLabel: timezoneLabel(zone),
  };
}

export interface FormattedAppointment {
  dateLabel: string;
  timeLabel: string;
  timezoneLabel: string;
  timezone: string;
  dateISO: string;
  timeISO: string;
  timeInput: string;
  full: string;
}

/** Format a UTC instant in the visitor's zone (never assumes Eastern). */
export function formatAppointment(utcMs: number, timezone: string): FormattedAppointment {
  const zone = resolveTimezone(timezone) ?? timezone;
  const dt = DateTime.fromMillis(utcMs, { zone });
  const abbreviation = dt.toFormat("ZZZZ");
  const dateLabel = dt.toFormat("ccc, LLL d");
  const timeLabel = `${dt.toFormat("h:mm a")} ${abbreviation}`.trim();
  return {
    dateLabel,
    timeLabel,
    timezoneLabel: timezoneLabel(zone),
    timezone: zone,
    dateISO: dt.toFormat("yyyy-LL-dd"),
    timeISO: dt.toFormat("HH:mm"),
    timeInput: dt.toFormat("h:mm a"),
    full: `${dateLabel} at ${timeLabel}`,
  };
}

export function localParts(utcMs: number, timezone: string): { date: string; time: string; weekday: number } {
  const dt = DateTime.fromMillis(utcMs, { zone: timezone });
  return { date: dt.toFormat("yyyy-LL-dd"), time: dt.toFormat("HH:mm"), weekday: dt.weekday % 7 };
}

/** True when two half-open intervals [start, end) intersect. Back-to-back is allowed. */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function addDaysToDate(dateISO: string, days: number): string {
  return DateTime.fromISO(dateISO, { zone: "UTC" }).plus({ days }).toFormat("yyyy-LL-dd");
}

export function minutesFromClock(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}


/**
 * Infer a US timezone from free text when the visitor names a city or zone.
 * Returns null when nothing is mentioned or multiple conflicting zones appear.
 */
export function inferTimezoneFromText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const direct = /(america\/[a-z_]+)/i.exec(text);
  if (direct) return resolveTimezone(direct[1]);
  const zones = new Set<string>();
  for (const [key, zone] of Object.entries(CITY_ZONES)) {
    if (key.length < 4) continue;
    if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) zones.add(zone);
  }
  for (const [key, zone] of Object.entries(ALIASES)) {
    if (key.length < 4) continue;
    if (/(east|west|north|south)(ern)?$/.test(key)) continue;
    if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) zones.add(zone);
  }
  return zones.size === 1 ? [...zones][0] : null;
}
