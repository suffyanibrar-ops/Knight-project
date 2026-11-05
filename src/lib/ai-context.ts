import "server-only";
import { sqliteHandle } from "./sqlite";
import { inferTimezoneFromText, localToUtcInstant, resolveTimezone } from "./timezone";
import { specialties } from "./site";

/**
 * Structured conversation memory + scheduling state machine.
 *
 * The model sees this summary on every turn, so it never re-asks for details the
 * visitor already gave. Stage transitions are enforced by the backend tools:
 * availability must be checked for the exact requested time before booking, and
 * booking additionally requires explicit visitor confirmation.
 */

export const AGENT_STAGES = [
  "DISCOVERY",
  "UNDERSTANDING_CONCERN",
  "ANSWERING",
  "TIMEZONE_COLLECTION",
  "AVAILABILITY_CHECK",
  "TIME_CONFIRMATION",
  "BOOKING",
  "BOOKED",
] as const;
export type AgentStage = (typeof AGENT_STAGES)[number];

export interface ConversationContext {
  conversationId: number;
  stage: AgentStage;
  userName: string | null;
  practice: string | null;
  specialty: string | null;
  concern: string | null;
  concernDetail: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  timezone: string | null;
  appointmentType: string | null;
  durationMinutes: number | null;
  bookingConfirmed: boolean;
  lastCheckedUtc: number | null;
  lastCheckedDate: string | null;
  lastCheckedTime: string | null;
  lastCheckedTimezone: string | null;
  lastCheckAvailable: boolean | null;
}

type Raw = NonNullable<ReturnType<typeof sqliteHandle>>;
function db(): Raw {
  const handle = sqliteHandle();
  if (!handle) throw new Error("The assistant's scheduling state is unavailable.");
  return handle;
}

function map(row: Record<string, unknown>): ConversationContext {
  const stage = String(row.stage ?? "DISCOVERY") as AgentStage;
  return {
    conversationId: Number(row.conversation_id),
    stage: AGENT_STAGES.includes(stage) ? stage : "DISCOVERY",
    userName: row.user_name ? String(row.user_name) : null,
    practice: row.practice ? String(row.practice) : null,
    specialty: row.specialty ? String(row.specialty) : null,
    concern: row.concern ? String(row.concern) : null,
    concernDetail: row.concern_detail ? String(row.concern_detail) : null,
    preferredDate: row.preferred_date ? String(row.preferred_date) : null,
    preferredTime: row.preferred_time ? String(row.preferred_time) : null,
    timezone: row.timezone ? resolveTimezone(String(row.timezone)) ?? String(row.timezone) : null,
    appointmentType: row.appointment_type ? String(row.appointment_type) : null,
    durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : null,
    bookingConfirmed: Number(row.booking_confirmed ?? 0) === 1,
    lastCheckedUtc: row.last_checked_utc ? Number(row.last_checked_utc) : null,
    lastCheckedDate: row.last_checked_date ? String(row.last_checked_date) : null,
    lastCheckedTime: row.last_checked_time ? String(row.last_checked_time) : null,
    lastCheckedTimezone: row.last_checked_timezone ? String(row.last_checked_timezone) : null,
    lastCheckAvailable: row.last_check_available === null || row.last_check_available === undefined ? null : Number(row.last_check_available) === 1,
  };
}

export function getConversationContext(conversationId: number): ConversationContext {
  const sql = db();
  const existing = sql.prepare("SELECT * FROM ai_conversation_contexts WHERE conversation_id = ?").get(conversationId) as Record<string, unknown> | undefined;
  if (existing) return map(existing);
  const now = Date.now();
  sql.prepare("INSERT OR IGNORE INTO ai_conversation_contexts (conversation_id, stage, created_at, updated_at) VALUES (?, 'DISCOVERY', ?, ?)")
    .run(conversationId, now, now);
  const created = sql.prepare("SELECT * FROM ai_conversation_contexts WHERE conversation_id = ?").get(conversationId) as Record<string, unknown>;
  return map(created);
}

export interface ContextPatch {
  stage?: AgentStage;
  userName?: string | null;
  practice?: string | null;
  specialty?: string | null;
  concern?: string | null;
  concernDetail?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  timezone?: string | null;
  appointmentType?: string | null;
  durationMinutes?: number | null;
  bookingConfirmed?: boolean;
  lastCheckedUtc?: number | null;
  lastCheckedDate?: string | null;
  lastCheckedTime?: string | null;
  lastCheckedTimezone?: string | null;
  lastCheckAvailable?: boolean | null;
}

const COLUMN_MAP: Record<keyof ContextPatch, string> = {
  stage: "stage", userName: "user_name", practice: "practice", specialty: "specialty",
  concern: "concern", concernDetail: "concern_detail", preferredDate: "preferred_date",
  preferredTime: "preferred_time", timezone: "timezone", appointmentType: "appointment_type",
  durationMinutes: "duration_minutes", bookingConfirmed: "booking_confirmed",
  lastCheckedUtc: "last_checked_utc", lastCheckedDate: "last_checked_date", lastCheckedTime: "last_checked_time",
  lastCheckedTimezone: "last_checked_timezone", lastCheckAvailable: "last_check_available",
};

export function updateConversationContext(conversationId: number, patch: ContextPatch): ConversationContext {
  getConversationContext(conversationId);
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch) as [keyof ContextPatch, ContextPatch[keyof ContextPatch]][]) {
    if (value === undefined) continue;
    assignments.push(`${COLUMN_MAP[key]} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
  }
  if (assignments.length) {
    assignments.push("updated_at = ?");
    values.push(Date.now());
    db().prepare(`UPDATE ai_conversation_contexts SET ${assignments.join(", ")} WHERE conversation_id = ?`).run(...values, conversationId);
  }
  return getConversationContext(conversationId);
}

export function recordAvailabilityCheck(conversationId: number, input: {
  date: string; time: string; timezone: string; available: boolean; startsAtUtc: number; durationMinutes: number;
}): ConversationContext {
  const timezone = resolveTimezone(input.timezone) ?? input.timezone;
  return updateConversationContext(conversationId, {
    stage: input.available ? "TIME_CONFIRMATION" : "AVAILABILITY_CHECK",
    timezone,
    preferredDate: input.date,
    preferredTime: input.time,
    durationMinutes: input.durationMinutes,
    lastCheckedUtc: input.startsAtUtc,
    lastCheckedDate: input.date,
    lastCheckedTime: input.time,
    lastCheckedTimezone: timezone,
    lastCheckAvailable: input.available,
  });
}

export function recordBookingConfirmed(conversationId: number): ConversationContext {
  return updateConversationContext(conversationId, { stage: "BOOKED", bookingConfirmed: true });
}

/** Was the exact requested instant checked successfully and not since replaced? */
export function hasMatchingAvailabilityCheck(conversationId: number, input: { date: string; time: string; timezone: string }): boolean {
  const context = getConversationContext(conversationId);
  try {
    const local = localToUtcInstant({ date: input.date, time: input.time, timezone: input.timezone });
    return context.lastCheckAvailable === true && context.lastCheckedUtc === local.utcMs && context.lastCheckedTimezone === local.timezone;
  } catch {
    return false;
  }
}

const STAGE_GUIDANCE: Record<AgentStage, string> = {
  DISCOVERY: "You are getting oriented. Answer what was asked and learn the single most useful thing about their situation. Do not pitch services or push a call yet.",
  UNDERSTANDING_CONCERN: "You know the main concern. Acknowledge it specifically, add one useful insight, and ask one relevant follow-up. Still no booking pitch.",
  ANSWERING: "Answer their question first, concisely. Only if natural, ask one follow-up that helps you help them. Do not pivot to booking unless they signal interest.",
  TIMEZONE_COLLECTION: "They want to schedule. Ask which time zone they are in (they may say Eastern, Central, Mountain or Pacific). Never assume Eastern.",
  AVAILABILITY_CHECK: "A time/date is known. Check the actual calendar with check_appointment_availability before saying anything about availability.",
  TIME_CONFIRMATION: "You have checked a specific time and it is available. Confirm the date, time and timezone and ask whether they want you to book it. Do not book until they explicitly say yes.",
  BOOKING: "The visitor explicitly confirmed. Book the exact checked time now. If booking fails, say it has not been confirmed and why.",
  BOOKED: "The appointment already exists. Do not book another one; help with questions or point them to the confirmation email for changes.",
};

/** Compact memory block injected into the system prompt. */
export function formatContextForPrompt(context: ConversationContext): string {
  const known: string[] = [];
  if (context.userName) known.push(`Name: ${context.userName}`);
  if (context.practice) known.push(`Practice/facility: ${context.practice}`);
  if (context.specialty) known.push(`Specialty: ${context.specialty}`);
  if (context.concern) known.push(`Main concern: ${context.concern}${context.concernDetail ? ` (${context.concernDetail})` : ""}`);
  if (context.timezone) known.push(`Timezone: ${context.timezone}`);
  if (context.preferredDate) known.push(`Preferred date: ${context.preferredDate}`);
  if (context.preferredTime) known.push(`Preferred time: ${context.preferredTime}`);
  if (context.lastCheckedUtc) {
    known.push(`Last availability check: ${context.lastCheckedDate} ${context.lastCheckedTime} ${context.lastCheckedTimezone} → ${context.lastCheckAvailable ? "available" : "not available"}`);
  }
  if (context.bookingConfirmed) known.push("Appointment already booked in this conversation");
  return `CONVERSATION MEMORY (never ask for these again)
${known.length ? known.map((line) => `- ${line}`).join("\n") : "- Nothing captured yet"}
CURRENT STAGE: ${context.stage}
STAGE GUIDANCE: ${STAGE_GUIDANCE[context.stage]}`;
}


const CONCERN_KEYWORDS: [RegExp, string][] = [
  [/\baged\s+a\/?r\b|\ba\/?r\s+(?:is|getting|aging|older|high)\b|\baccounts? receivable\b/i, "aged A/R"],
  [/\bdenials?\b|\bdenied claims?\b/i, "denials"],
  [/\bunderpayment|underpaid|underpayments?\b/i, "underpayments"],
  [/\bcollections?\b|\bunpaid claims?\b/i, "collections"],
  [/\bcredentialing\b|\bcontracting\b/i, "credentialing"],
  [/\beligibility\b|\bbenefits verification\b/i, "eligibility"],
  [/\bprior auth(?:orization)?\b/i, "prior authorization"],
  [/\bcoding\b|\bcoders?\b/i, "coding"],
  [/\bstaff(?:ing)?\b|\bbiller(s)?\b|\bturnover\b/i, "staffing"],
  [/\bgrowing\b|\bexpansion\b|\bnew providers?\b/i, "practice growth"],
  [/\binsurance\b|\bpayer(s)?\b/i, "insurance issues"],
  [/\brevenue cycle\b|\brcm\b/i, "revenue cycle"],
];

/** Conservative, deterministic extraction of facts explicitly stated by the visitor. */
export function inferVisitorDetails(texts: string[]): ContextPatch {
  const patch: ContextPatch = {};
  const knownSpecialties = specialties.map((item) => item.name).filter((name) => name.length > 3);
  for (const text of [...texts].reverse()) {
    if (!text) continue;
    if (!patch.timezone) {
      const zone = inferTimezoneFromText(text);
      if (zone) patch.timezone = zone;
    }
    if (!patch.specialty) {
      const specialty = knownSpecialties.find((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
      if (specialty) patch.specialty = specialty;
    }
    if (!patch.concern) {
      const concern = CONCERN_KEYWORDS.find(([pattern]) => pattern.test(text))?.[1];
      if (concern) patch.concern = concern;
    }
    if (!patch.practice) {
      const practice = /\b(?:we(?:'re| are)|our)\s+(?:a\s+|an\s+)?([a-z0-9][a-z0-9 -]{2,70}?\s+(?:practice|clinic|group|hospital|health system|medical center))\b/i.exec(text);
      if (practice) patch.practice = practice[1].trim();
    }
    if (!patch.userName) {
      const name = /\b(?:my name is|this is|i'm|i am)\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)\b/.exec(text);
      if (name && !/^(In|Not|Here|Looking|Interested|Trying|Wondering)$/.test(name[1])) patch.userName = name[1].trim();
    }
  }
  return patch;
}
