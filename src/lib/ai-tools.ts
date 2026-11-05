import "server-only";
import { services, site } from "./site";
import { getAvailableSlots, bookAppointment } from "./ai-appointments";
import { createHandoff, notifyHandoff, notifyNewLead, saveLead } from "./ai-session";
import { searchKnowledge } from "./ai-knowledge";
import type { ToolDefinition } from "./ai-deepseek";

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
      name: "save_lead_information",
      description: "Save contact and qualification details the visitor has provided. Call after learning their name, email and needs. Never invent details. Ask permission before saving if the visitor seems hesitant.",
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
      description: "Get REAL available 15-minute introductory call slots from the booking system. Never invent times — always call this first.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "How many days ahead to search (default 14, max 21)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book a confirmed 15-minute intro call. Only call after the visitor explicitly confirms the specific slot and their name/email. The backend revalidates availability.",
      parameters: {
        type: "object",
        properties: {
          starts_at_utc: { type: "string", description: "Exact slot ISO timestamp returned by get_available_appointment_slots" },
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          organization: { type: "string" },
          specialty: { type: "string" },
          confirmed: { type: "boolean", description: "Set true ONLY after the visitor confirms this exact slot and their contact details" },
        },
        required: ["starts_at_utc", "full_name", "email", "confirmed"],
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

export async function executeAiTool(name: string, rawArgs: string, context: ToolContext): Promise<ToolExecution> {
  const args = parseArgs(rawArgs);
  try {
    switch (name) {
      case "search_website_knowledge": {
        const query = str(args.query, 300);
        if (!query) return { ok: false, content: JSON.stringify({ ok: false, error: "A search query is required." }), summary: "search failed" };
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
          return { ok: false, content: JSON.stringify({ ok: false, error: "No such service on the approved list. Offer the published services list or human help." }), summary: "service not found" };
        }
        return { ok: true, content: JSON.stringify({ ok: true, service: serviceView(match) }), summary: `service: ${match.name}` };
      }
      case "save_lead_information": {
        const email = str(args.email, 200);
        if (email && !EMAIL_RE.test(email)) {
          return { ok: false, content: JSON.stringify({ ok: false, error: "That email address does not look valid. Ask the visitor to confirm it." }), summary: "lead validation failed" };
        }
        const name = str(args.full_name, 120);
        if (!email && !name) {
          return { ok: false, content: JSON.stringify({ ok: false, error: "Collect at least a name or a business email before saving." }), summary: "lead incomplete" };
        }
        const saved = saveLead({
          conversationId: context.conversationId,
          name,
          email,
          phone: str(args.phone, 40),
          organization: str(args.organization, 160),
          specialty: str(args.specialty, 120),
          providers: str(args.providers, 40),
          currentSetup: str(args.current_setup, 300),
          challenge: str(args.challenge, 600),
          servicesInterest: str(args.services_interest, 300),
          preferredContact: str(args.preferred_contact, 40),
        });
        if (saved.created) {
          void notifyNewLead({ name, email: saved.email, organization: str(args.organization, 160), challenge: str(args.challenge, 600) });
        }
        return { ok: true, content: JSON.stringify({ ok: true, saved: true, lead_id: saved.id, note: "Details saved for the team. Confirm to the visitor without reading back sensitive data." }), summary: saved.created ? "saved new lead" : "updated lead" };
      }
      case "get_available_appointment_slots": {
        const days = Math.max(1, Math.min(21, Number(args.days ?? 14) || 14));
        const slots = getAvailableSlots({ days, limit: 8 });
        if (!slots.length) {
          return { ok: true, content: JSON.stringify({ ok: true, slots: [], note: "No open slots found in that window. Offer human assistance or the phone number." }), summary: "no slots available" };
        }
        return {
          ok: true,
          content: JSON.stringify({
            ok: true,
            timezone: slots[0].timezone,
            slots: slots.map((slot) => ({ starts_at_utc: slot.iso, display: `${slot.dateLabel} at ${slot.timeLabel}` })),
            note: "Offer two or three of these real times. Do not invent others.",
          }),
          summary: `${slots.length} real slots offered`,
        };
      }
      case "book_appointment": {
        if (args.confirmed !== true) {
          return { ok: false, content: JSON.stringify({ ok: false, error: "Not confirmed. Repeat the date, time and contact details and ask the visitor to confirm first." }), summary: "booking blocked (no confirmation)" };
        }
        const starts = typeof args.starts_at_utc === "string" ? Date.parse(args.starts_at_utc) : NaN;
        if (!Number.isFinite(starts)) {
          return { ok: false, content: JSON.stringify({ ok: false, error: "Invalid slot. Call get_available_appointment_slots and use one of the returned ISO times." }), summary: "booking failed (bad slot)" };
        }
        const name = str(args.full_name, 120);
        const email = str(args.email, 200);
        if (!name || !email || !EMAIL_RE.test(email)) {
          return { ok: false, content: JSON.stringify({ ok: false, error: "A full name and valid business email are required to book." }), summary: "booking failed (contact details)" };
        }
        const booked = await bookAppointment({
          startsAtUtc: starts,
          name,
          email,
          phone: str(args.phone, 40),
          organization: str(args.organization, 160),
          specialty: str(args.specialty, 120),
          conversationId: context.conversationId,
        });
        return {
          ok: true,
          content: JSON.stringify({
            ok: true,
            booked: true,
            appointment_id: booked.id,
            display: `${booked.dateLabel} at ${booked.timeLabel}`,
            timezone: booked.timezone,
            note: "Confirm the booking to the visitor and mention that a confirmation email with reschedule/cancel options was sent.",
          }),
          summary: `booked ${booked.dateLabel} ${booked.timeLabel}`,
        };
      }
      case "request_human_assistance": {
        const reason = str(args.reason, 1000);
        if (!reason) return { ok: false, content: JSON.stringify({ ok: false, error: "A reason is required." }), summary: "handoff failed" };
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
        return { ok: false, content: JSON.stringify({ ok: false, error: "Unknown tool." }), summary: "unknown tool" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The action could not be completed.";
    return { ok: false, content: JSON.stringify({ ok: false, error: message }), summary: "action failed" };
  }
}
