import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { sqliteHandle } from "@/lib/sqlite";
import { ACTIONS, executeAction, issueActionGrant, previewAction, revokeGrant } from "./admin-actions";
import type { SessionResolver } from "./admin-actions";

/**
 * Admin assistant orchestration (Phase 8).
 *
 * Safety model:
 *  - the model never touches the database. It may only choose an intent from a
 *    closed list, which maps to a parameterised action from admin-actions.ts;
 *  - every state change is proposed first, then executed only with a
 *    single-use token that is claimed atomically;
 *  - proposals expire and are bound to the administrator who created them;
 *  - intent parsing is deterministic, so the assistant still works when the AI
 *    provider is unavailable (chat replies degrade, actions do not disappear).
 */


export type Intent =
  | { kind: "cancel_appointment"; id: number }
  | { kind: "set_enquiry_status"; id: number; status: string }
  | { kind: "list_pending_appointments" }
  | { kind: "help" }
  | { kind: "unknown"; reason: string };

const STATUSES = ["pending", "contacted", "resolved", "cancelled"] as const;

/** Deterministic, dependency-free intent interpretation. */
export function parseIntent(message: string): Intent {
  const text = message.trim().toLowerCase();
  if (!text) return { kind: "unknown", reason: "Empty message." };

  const cancel = text.match(/cancel (?:the )?appointment\s*#?(\d+)/) ?? text.match(/appointment\s*#?(\d+)\D{0,20}cancel/);
  if (cancel) return { kind: "cancel_appointment", id: Number(cancel[1]) };

  const enquiry = text.match(/(?:set|change|update) (?:the )?(?:enquiry|enquiries|lead)\s*#?(\d+)\s*(?:to|as|->)\s*([a-z]+)/);
  if (enquiry) {
    const status = enquiry[2];
    if (!(STATUSES as readonly string[]).includes(status)) {
      return { kind: "unknown", reason: `"${status}" is not a valid enquiry status.` };
    }
    return { kind: "set_enquiry_status", id: Number(enquiry[1]), status };
  }

  if (/(?:show|list|which).*(?:pending|unconfirmed).*appointment/.test(text) || /appointments?.*(?:pending|still)/.test(text)) {
    return { kind: "list_pending_appointments" };
  }
  if (/^(help|what can you do)/.test(text)) return { kind: "help" };
  return { kind: "unknown", reason: "No supported action matched this request." };
}

export interface ProposalView {
  nonce: string;
  token: string;
  expiresAt: number;
  type: string;
  summary: string;
  level: string;
  reversible: boolean;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  before: Record<string, unknown>;
}

export interface AssistantTurn {
  reply: string;
  proposal?: ProposalView;
  error?: string;
}

/** Turns a chat message into a proposal (never an execution). */
export async function propose(
  message: string,
  options: { resolver?: SessionResolver } = {},
): Promise<AssistantTurn> {
  const intent = parseIntent(message);

  if (intent.kind === "help") {
    return { reply: "I can prepare two changes: cancel an appointment (\"cancel appointment 12\") or change an enquiry status (\"set enquiry 5 to contacted\"). I always show a preview and wait for your confirmation. I never run queries or shell commands." };
  }
  if (intent.kind === "list_pending_appointments") {
    const pending = (await import("./ai-appointments")).listAppointments(50, "active");
    return { reply: pending.length === 0 ? "No active appointments." : `${pending.length} active appointment(s): ${pending.map((a) => `#${a.id} ${a.dateLabel} ${a.timeLabel} (${a.status})`).join("; ")}.` };
  }
  if (intent.kind === "unknown") return { reply: "I did not understand that request. Say \"help\" to see the supported actions.", error: intent.reason };

  const type = intent.kind === "cancel_appointment" ? "appointment.cancel" : "enquiry.set_status";
  const params = intent.kind === "cancel_appointment" ? { id: intent.id } : { id: intent.id, status: intent.status };

  const preview = await previewAction(type, params, options);
  if (!preview.ok) {
    return { reply: `I could not prepare that change: ${preview.error ?? "unknown reason"}.`, error: preview.error };
  }

  const grant = await issueActionGrant({ type, params }, options);
  if (!grant.ok) {
    return { reply: `I could not prepare that change: ${grant.error}.`, error: grant.status };
  }

  return {
    reply: `Prepared: ${preview.summary ?? ACTIONS[type].label}. Confirm to apply it, or discard.`,
    proposal: {
      nonce: grant.nonce,
      token: grant.token,
      expiresAt: grant.expiresAt,
      type,
      summary: preview.summary ?? ACTIONS[type].label,
      level: preview.level ?? ACTIONS[type].level,
      reversible: preview.reversible ?? ACTIONS[type].reversible,
      requiresConfirmation: preview.requiresConfirmation ?? true,
      requiresApproval: preview.requiresApproval ?? ACTIONS[type].requiresApproval,
      before: preview.before ?? {},
    },
  };
}

export interface ConfirmResult {
  ok: boolean;
  status: "completed" | "expired" | "already_used" | "forbidden" | "failed" | "interrupted";
  message: string;
  verified?: Record<string, unknown>;
}

/** Confirms and executes exactly once, then verifies against the database. */
export async function confirm(
  input: { nonce: string; token: string },
  options: { resolver?: SessionResolver; now?: number } = {},
): Promise<ConfirmResult> {
  const result = await executeAction({ nonce: input.nonce, token: input.token }, options);
  if (result.ok) return { ok: true, status: "completed", message: result.summary ?? "Completed.", verified: result.verified };
  const map: Record<string, ConfirmResult["status"]> = {
    expired: "expired",
    already_used: "already_used",
    forbidden: "forbidden",
    unauthorized: "forbidden",
    interrupted: "interrupted",
    invalid: "forbidden",
    config_unavailable: "failed",
    failed: "failed",
  };
  return { ok: false, status: map[result.status] ?? "failed", message: result.error ?? "The change did not complete." };
}

export async function cancel(nonce: string, options: { resolver?: SessionResolver } = {}): Promise<{ ok: boolean; message: string }> {
  const { defaultSessionResolver } = await import("./admin-actions");
  const session = await (options.resolver ?? defaultSessionResolver)();
  if (!session.ok) return { ok: false, message: "Not signed in." };
  const removed = revokeGrant(nonce);
  return removed ? { ok: true, message: "Proposal discarded. Nothing was changed." } : { ok: false, message: "Nothing to cancel." };
}

/** Provider-down mode: deterministic replies continue, nothing is silently lost. */
export function assistantMode(env: NodeJS.ProcessEnv = process.env): "deterministic" | "ai" {
  return env.DEEPSEEK_API_KEY?.trim() ? "ai" : "deterministic";
}
