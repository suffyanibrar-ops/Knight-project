import "server-only";
import { services, site } from "./site";
import {
  bookAppointment,
  checkRequestedAvailability,
  getAvailableSlots,
  SchedulingError,
  TimezoneInputError,
} from "./ai-appointments";
import { createHandoff, notifyHandoff, notifyNewLead, saveLead } from "./ai-session";
import { searchKnowledge } from "./ai-knowledge";
import type { ToolDefinition } from "./ai-deepseek";
import {
  hasMatchingAvailabilityCheck,
  getConversationContext,
  recordAvailabilityCheck,
  recordBookingConfirmed,
  updateConversationContext,
} from "./ai-context";
import { resolveTimezone } from "./timezone";

/**
 * Backend tools available to the model. Every argument is validated here; the
 * model never receives database access, arbitrary HTTP or code execution.
 */
export const AI_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_website_knowledge",
      description: "Search the approved Knight Medical Billing website knowledge base (services, specialties, FAQs, process, published articles). Use for any question about what the company offers or how it works.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Visitor question or keywords" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_information",
      description: "Look up one specific service offered by Knight Medical Billing (for example medical billing and coding, A/R management, credentialing, denial management, eligibility verification).",
      parameters: {
        type: "object",
        properties: { service: { type: "string", description: "Service name or slug, or leave empty to list all services" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_visitor_context",
      description: "Silently remember scheduling/qualification details the visitor has already shared so you never ask again (name, practice, specialty, concern, timezone, preferred date/time, appointment type/duration). Never ask a question just to fill this tool; only record what was said.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          practice: { type: "string" },
          specialty: { type: "string" },
          concern: { type: "string", description: "Short label such as denials, aged A/R, credentialing, eligibility, coding, staffing" },
          concern_detail: { type: "string" },
          timezone: { type: "string", description: "Visitor timezone: Eastern/Central/Mountain/Pacific or an IANA zone such as America/Chicago" },
          preferred_date: { type: "string", description: "YYYY-MM-DD if the visitor named a date" },
          preferred_time: { type: "string", description: "Local time if named, e.g. 2:00 PM" },
          appointment_type: { type: "string" },
          duration_minutes: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_lead_information",
      description: "Save contact and qualification details the visitor has provided (name, business email, phone, practice, concern). Never invent details. Ask permission before saving if the visitor seems hesitant.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          email: { type: "string", description: "Business email address" },
          phone: { type: "string" },
          organization: { type: "string", description: "Practice, clinic or health system name" },
          specialty: { type: "string" },
          providers: { type: "string", description: "Number of providers if mentioned" },
          current_setup: { type: "string", description: "In-house billing, current vendor or software" },
          challenge: { type: "string", description: "Main billing or revenue cycle challenge" },
          services_interest: { type: "string" },
          preferred_contact: { type: "string", description: "Phone, email or meeting" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_available_appointment_slots",
      description: "List REAL upcoming consultation openings, labelled in the visitor's timezone. Only use when the visitor is interested in scheduling and you know their timezone. Never invent times.",
      parameters: {
        type: "object",
        properties: {
          timezone: { type: "string", description: "Visitor timezone (Eastern/Central/Mountain/Pacific or IANA). Required unless already remembered." },
          days: { type: "number", description: "How many days ahead to search (default 14, max 21)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_appointment_availability",
      description: "Check the real calendar for ONE exact local date/time in the visitor's timezone. ALWAYS call this before saying a time is available or booked. Returns available/conflict/outside-hours plus nearby alternatives. Do not call with an ambiguous time such as '2' — ask AM or PM first.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "Visitor local time, e.g. 2:00 PM (never a bare hour)" },
          timezone: { type: "string", description: "Visitor timezone or IANA zone" },
          duration_minutes: { type: "number", description: "Consultation length; defaults to 15" },
        },
        required: ["date", "time", "timezone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book the exact time the visitor explicitly confirmed. Requires a successful check_appointment_availability for the same date/time/timezone in this conversation, plus the visitor's name and business email. Never call on a mere mention of a time.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD (visitor local date)" },
          time: { type: "string", description: "Visitor local time, e.g. 2:00 PM" },
          timezone: { type: "string", description: "Visitor timezone or IANA zone" },
          duration_minutes: { type: "number" },
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          organization: { type: "string" },
          specialty: { type: "string" },
          confirmed: { type: "boolean", description: "Set true ONLY after the visitor explicitly said yes to this exact date, time and timezone" },
        },
        required: ["date", "time", "timezone", "full_name", "email", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_assistance",
      description: "Create a human handoff request for the team. Use when the visitor asks for a person, when the question is outside the knowledge base, or for complex/urgent matters. The team will follow up — never claim a person is online.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why the visitor needs a human" },
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
        },
        required: ["reason"],
      },
    },
  },
];

export interface ToolContext {
  conversationId: number;
  channel: "text" | "voice";
}

export interface ToolExecution {
  ok: boolean;
  content: string;
  summary: string;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function serviceView(service: (typeof services)[number]) {
  return {
    name: service.name,
    slug: service.slug,
    tagline: service.tagline,
    summary: service.intro,
    included: service.included.slice(0, 8),
    highlights: service.highlights.slice(0, 4).map((item) => `${item.title}: ${item.detail}`),
    standards: service.metrics.map((metric) => `${metric.value} ${metric.label}`),
    url: `${site.url}/services/${service.slug}`,
  };
}

function toolError(code: string, message: string, summary: string): ToolExecution {
  return { ok: false, content: JSON.stringify({ ok: false, code, error: message }), summary };
}

function resolveVisitorTimezone(raw: unknown, conversationId: number): string | null {
  const provided = str(raw, 120);
  if (provided) return resolveTimezone(provided);
  return getConversationContext(conversationId).timezone;
}

export async function executeAiTool(name: string, rawArgs: string, context: ToolContext): Promise<ToolExecution> {
  const args = parseArgs(rawArgs);
  try {
    switch (name) {
      case "search_website_knowledge": {
        const query = str(args.query, 300);
        if (!query) return toolError("query_required", "A search query is required.", "search failed");
        const hits = searchKnowledge(query, 5);
        if (!hits.length) {
          return {
            ok: true,
            content: JSON.stringify({ ok: true, results: [], note: "No matching approved content. Tell the visitor you don't have that detail and offer human help; do not invent an answer." }),
            summary: "searched knowledge (no match)",
          };
        }
        return {
          ok: true,
          content: JSON.stringify({
            ok: true,
            results: hits.map((hit) => ({ title: hit.title, url: `${site.url}${hit.url}`, excerpt: hit.content.slice(0, 700) })),
          }),
          summary: `searched knowledge (${hits.length} matches)`,
        };
      }
      case "get_service_information": {
        const raw = str(args.service, 120)?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!raw) {
          return { ok: true, content: JSON.stringify({ ok: true, services: services.map((service) => ({ name: service.name, slug: service.slug, summary: service.tagline })) }), summary: "listed services" };
        }
        const match = services.find((service) => service.slug === raw || service.slug.includes(raw) || service.name.toLowerCase().includes(raw));
        if (!match) {
          return toolError("service_not_found", "No such service on the approved list. Offer the published services list or human help.", "service not found");
        }
        return { ok: true, content: JSON.stringify({ ok: true, service: serviceView(match) }), summary: `service: ${match.name}` };
      }
      case "remember_visitor_context": {
        const timezone = str(args.timezone, 80) ? resolveTimezone(str(args.timezone, 80)) : undefined;
        const contextBefore = getConversationContext(context.conversationId);
        const concern = str(args.concern, 160);
        updateConversationContext(context.conversationId, {
          userName: str(args.full_name, 120) ?? undefined,
          practice: str(args.practice, 160) ?? undefined,
          specialty: str(args.specialty, 120) ?? undefined,
          concern: concern ?? undefined,
          concernDetail: str(args.concern_detail, 600) ?? undefined,
          timezone: timezone ?? undefined,
          preferredDate: str(args.preferred_date, 20) ?? undefined,
          preferredTime: str(args.preferred_time, 20) ?? undefined,
          appointmentType: str(args.appointment_type, 80) ?? undefined,
          durationMinutes: typeof args.duration_minutes === "number" ? Math.max(10, Math.min(60, args.duration_minutes)) : undefined,
          stage: contextBefore.stage === "DISCOVERY" && concern ? "UNDERSTANDING_CONCERN" : undefined,
        });
        return { ok: true, content: JSON.stringify({ ok: true, remembered: true }), summary: "remembered visitor context" };
      }
      case "save_lead_information": {
        const email = str(args.email, 200);
        if (email && !EMAIL_RE.test(email)) {
          return toolError("invalid_email", "That email address does not look valid. Ask the visitor to confirm it.", "lead validation failed");
        }
        const name = str(args.full_name, 120);
        if (!email && !name) {
          return toolError("details_required", "Collect at least a name or a business email before saving.", "lead incomplete");
        }
        const challenge = str(args.challenge, 600);
        const saved = saveLead({
          conversationId: context.conversationId,
          name,
          email,
          phone: str(args.phone, 40),
          organization: str(args.organization, 160),
          specialty: str(args.specialty, 120),
          providers: str(args.providers, 40),
          currentSetup: str(args.current_setup, 300),
          challenge,
          servicesInterest: str(args.services_interest, 300),
          preferredContact: str(args.preferred_contact, 40),
        });
        updateConversationContext(context.conversationId, {
          userName: name ?? undefined,
          practice: str(args.organization, 160) ?? undefined,
          specialty: str(args.specialty, 120) ?? undefined,
          concern: challenge ?? undefined,
        });
        if (saved.created) {
          void notifyNewLead({ name, email: saved.email, organization: str(args.organization, 160), challenge });
        }
        return { ok: true, content: JSON.stringify({ ok: true, saved: true, lead_id: saved.id, note: "Details saved for the team. Confirm to the visitor without reading back sensitive data." }), summary: saved.created ? "saved new lead" : "updated lead" };
      }
      case "get_available_appointment_slots": {
        const timezone = resolveVisitorTimezone(args.timezone, context.conversationId);
        if (!timezone) {
          return toolError("needs_timezone", "Ask the visitor which time zone they are in (Eastern, Central, Mountain or Pacific) before listing times.", "timezone needed");
        }
        const days = Math.max(1, Math.min(21, Number(args.days ?? 14) || 14));
        const slots = getAvailableSlots({ days, limit: 8, timezone });
        updateConversationContext(context.conversationId, { timezone, stage: "TIMEZONE_COLLECTION" });
        if (!slots.length) {
          return { ok: true, content: JSON.stringify({ ok: true, timezone, slots: [], note: "No open slots found in that window. Offer human assistance or the phone number." }), summary: "no slots available" };
        }
        return {
          ok: true,
          content: JSON.stringify({
            ok: true,
            timezone,
            timezone_label: slots[0].timezoneLabel,
            slots: slots.map((slot) => ({
              date: slot.dateISO,
              time: slot.timeISO,
              display_date: slot.dateLabel,
              display_time: slot.timeLabel,
              starts_at_utc: slot.iso,
            })),
            note: "Offer two or three of these real times in the visitor's timezone. Do not invent others.",
          }),
          summary: `${slots.length} real slots offered`,
        };
      }
      case "check_appointment_availability": {
        const timezone = resolveVisitorTimezone(args.timezone, context.conversationId);
        if (!timezone) return toolError("needs_timezone", "Ask which time zone the visitor is in before checking the calendar.", "timezone needed");
        const date = str(args.date, 20);
        const time = str(args.time, 20);
        if (!date) return toolError("needs_date", "Ask the visitor which date they want.", "date needed");
        if (!time) return toolError("needs_time", "Ask the visitor what time works for them.", "time needed");
        if (!/[ap]m/i.test(time) && !/^\s*\d{1,2}:\d{2}\s*$/.test(time)) {
          return toolError("ambiguous_time", "Ask whether the visitor means AM or PM before checking.", "ambiguous time");
        }
        const result = checkRequestedAvailability({
          date,
          time,
          timezone,
          durationMinutes: typeof args.duration_minutes === "number" ? args.duration_minutes : getConversationContext(context.conversationId).durationMinutes ?? undefined,
        });
        recordAvailabilityCheck(context.conversationId, {
          date: result.requested.date,
          time: result.requested.time,
          timezone: result.requested.timezone,
          available: result.available,
          startsAtUtc: result.requested.startsAtUtc,
          durationMinutes: result.requested.durationMinutes,
        });
        updateConversationContext(context.conversationId, {
          stage: result.available ? "TIME_CONFIRMATION" : "AVAILABILITY_CHECK",
          preferredDate: result.requested.date,
          preferredTime: result.requested.time,
          timezone: result.requested.timezone,
          durationMinutes: result.requested.durationMinutes,
        });
        return {
          ok: true,
          content: JSON.stringify({
            ok: true,
            available: result.available,
            reason: result.reason,
            message: result.message,
            requested: {
              date: result.requested.date,
              time: result.requested.time,
              display_date: result.requested.dateLabel,
              display_time: result.requested.timeLabel,
              timezone: result.requested.timezone,
              timezone_label: result.requested.timezoneLabel,
              duration_minutes: result.requested.durationMinutes,
            },
            alternatives: result.alternatives.map((slot) => ({
              date: slot.dateISO,
              time: slot.timeISO,
              display_date: slot.dateLabel,
              display_time: slot.timeLabel,
            })),
            instruction: result.available
              ? "Confirm the exact date, time and timezone and ask if they want you to book it. Do not book until they say yes."
              : "Do not mention other appointments. Only explain that the requested time is unavailable and offer the alternatives, if any.",
          }),
          summary: result.available ? `checked: available ${result.requested.dateLabel} ${result.requested.timeLabel}` : `checked: unavailable (${result.reason})`,
        };
      }
      case "book_appointment": {
        if (args.confirmed !== true) {
          return toolError("not_confirmed", "Do not book yet. Confirm the exact date, time and timezone and wait for an explicit yes.", "booking blocked (no confirmation)");
        }
        const timezone = resolveVisitorTimezone(args.timezone, context.conversationId);
        const date = str(args.date, 20);
        const time = str(args.time, 20);
        if (!timezone || !date || !time) return toolError("needs_time", "A date, time and timezone are required before booking.", "booking blocked (incomplete)");
        if (!hasMatchingAvailabilityCheck(context.conversationId, { date, time, timezone })) {
          return toolError("availability_not_checked", "Check that exact time with check_appointment_availability first; the visitor may not have been told whether it is open.", "booking blocked (no availability check)");
        }
        const name = str(args.full_name, 120);
        const email = str(args.email, 200);
        if (!name || !email || !EMAIL_RE.test(email)) {
          return toolError("contact_required", "A full name and valid business email are required to book.", "booking failed (contact details)");
        }
        const contextState = getConversationContext(context.conversationId);
        const booked = await bookAppointment({
          date,
          time,
          timezone,
          durationMinutes: typeof args.duration_minutes === "number" ? args.duration_minutes : contextState.durationMinutes ?? undefined,
          name,
          email,
          phone: str(args.phone, 40),
          organization: str(args.organization, 160),
          specialty: str(args.specialty, 120),
          conversationId: context.conversationId,
        });
        recordBookingConfirmed(context.conversationId);
        updateConversationContext(context.conversationId, {
          preferredDate: booked.localDate,
          preferredTime: booked.localTime,
          timezone: booked.timezone,
          durationMinutes: booked.durationMinutes,
        });
        return {
          ok: true,
          content: JSON.stringify({
            ok: true,
            booked: true,
            appointment_id: booked.id,
            display: `${booked.dateLabel} at ${booked.timeLabel}`,
            timezone: booked.timezone,
            timezone_label: booked.timezoneLabel,
            duration_minutes: booked.durationMinutes,
            note: "Confirm the booking to the visitor and mention a confirmation email with reschedule/cancel options was sent.",
          }),
          summary: `booked ${booked.dateLabel} ${booked.timeLabel}`,
        };
      }
      case "request_human_assistance": {
        const reason = str(args.reason, 1000);
        if (!reason) return toolError("reason_required", "A reason is required.", "handoff failed");
        const handoffId = createHandoff({
          conversationId: context.conversationId,
          reason,
          name: str(args.full_name, 120),
          email: str(args.email, 200),
          phone: str(args.phone, 40),
        });
        const notified = await notifyHandoff({ id: handoffId, reason, name: str(args.full_name, 120), email: str(args.email, 200), phone: str(args.phone, 40) });
        return {
          ok: true,
          content: JSON.stringify({
            ok: true,
            handoff_created: true,
            notified,
            note: "Tell the visitor the request was logged for the team. Do NOT claim a person is online. Mention the team follows up during business hours.",
          }),
          summary: "human handoff created",
        };
      }
      default:
        return toolError("unknown_tool", "Unknown tool.", "unknown tool");
    }
  } catch (error) {
    if (error instanceof TimezoneInputError) return toolError(error.code, error.message, "input clarification needed");
    if (error instanceof SchedulingError) return toolError(error.code, error.message, `calendar error (${error.code})`);
    const message = error instanceof Error ? error.message : "The action could not be completed.";
    return toolError("action_failed", message, "action failed");
  }
}
