import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sqliteHandle } from "./sqlite";
import { getAiSettings } from "./ai-config";
import { sendOwnerNotification } from "./email";
import { site } from "./site";

/**
 * Conversation/session persistence for the AI agent. Sessions are identified by
 * a random HttpOnly cookie value; only its SHA-256 hash is stored, so a database
 * leak cannot be replayed as a session. No audio is stored and no PHI fields
 * exist by design.
 */

export const AI_SESSION_COOKIE = "kmb_ai_session";

type Raw = NonNullable<ReturnType<typeof sqliteHandle>>;

function db(): Raw {
  const handle = sqliteHandle();
  if (!handle) throw new Error("The AI agent is temporarily unavailable.");
  return handle;
}

export interface ConversationRow {
  id: number;
  channel: string;
  status: string;
  messageCount: number;
  leadId: number | null;
  appointmentId: number | null;
  handoffId: number | null;
  createdAt: number;
  lastActivityAt: number;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function findConversationByToken(token: string | undefined | null): ConversationRow | null {
  if (!token || token.length < 20 || token.length > 200) return null;
  try {
    const row = db().prepare("SELECT * FROM ai_conversations WHERE session_hash = ? LIMIT 1").get(hashToken(token)) as Record<string, unknown> | undefined;
    return row ? mapConversation(row) : null;
  } catch {
    return null;
  }
}

function mapConversation(row: Record<string, unknown>): ConversationRow {
  return {
    id: Number(row.id),
    channel: String(row.channel),
    status: String(row.status),
    messageCount: Number(row.message_count),
    leadId: row.lead_id ? Number(row.lead_id) : null,
    appointmentId: row.appointment_id ? Number(row.appointment_id) : null,
    handoffId: row.handoff_id ? Number(row.handoff_id) : null,
    createdAt: Number(row.created_at),
    lastActivityAt: Number(row.last_activity_at),
  };
}

export function createConversation(channel: "text" | "voice"): { conversation: ConversationRow; token: string } {
  const token = issueSessionToken();
  const retention = getAiSettings().retentionDays;
  const now = Date.now();
  const result = db()
    .prepare("INSERT INTO ai_conversations (session_hash, channel, status, created_at, last_activity_at, expires_at) VALUES (?, ?, 'active', ?, ?, ?)")
    .run(hashToken(token), channel, now, now, now + retention * 24 * 60 * 60 * 1000);
  const conversation = db().prepare("SELECT * FROM ai_conversations WHERE id = ?").get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  return { conversation: mapConversation(conversation), token };
}

export function touchConversation(id: number, channel?: "text" | "voice", status?: string): void {
  const now = Date.now();
  if (channel) db().prepare("UPDATE ai_conversations SET last_activity_at = ?, channel = ? WHERE id = ?").run(now, channel, id);
  else db().prepare("UPDATE ai_conversations SET last_activity_at = ? WHERE id = ?").run(now, id);
  if (status) db().prepare("UPDATE ai_conversations SET status = ? WHERE id = ?").run(status, id);
}

export function appendMessage(input: {
  conversationId: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string | null;
  toolArgs?: string | null;
  toolResult?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs?: number | null;
}): number {
  const sql = db();
  const result = sql
    .prepare("INSERT INTO ai_messages (conversation_id, role, content, tool_name, tool_args, tool_result, tokens_in, tokens_out, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      input.conversationId,
      input.role,
      input.content.slice(0, 20000),
      input.toolName ?? null,
      input.toolArgs ? input.toolArgs.slice(0, 4000) : null,
      input.toolResult ? input.toolResult.slice(0, 8000) : null,
      input.tokensIn ?? null,
      input.tokensOut ?? null,
      input.latencyMs ?? null,
      Date.now(),
    );
  if (input.role === "user" || input.role === "assistant") {
    sql.prepare("UPDATE ai_conversations SET message_count = message_count + 1, last_activity_at = ? WHERE id = ?").run(Date.now(), input.conversationId);
  }
  return Number(result.lastInsertRowid);
}

export interface StoredMessage { role: string; content: string; createdAt: number; toolName: string | null; toolResult: string | null }

export function recentMessages(conversationId: number, limit = 20): StoredMessage[] {
  try {
    const rows = db()
      .prepare("SELECT role, content, created_at, tool_name, tool_result FROM ai_messages WHERE conversation_id = ? AND role IN ('user','assistant') ORDER BY created_at DESC LIMIT ?")
      .all(conversationId, limit) as Record<string, unknown>[];
    return rows.reverse().map((row) => ({
      role: String(row.role),
      content: String(row.content ?? ""),
      createdAt: Number(row.created_at),
      toolName: row.tool_name ? String(row.tool_name) : null,
      toolResult: row.tool_result ? String(row.tool_result) : null,
    }));
  } catch {
    return [];
  }
}

export function recordUsage(input: {
  conversationId: number | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costMicros: number;
  error?: string | null;
}): void {
  try {
    db().prepare("INSERT INTO ai_usage_logs (conversation_id, model, prompt_tokens, completion_tokens, total_tokens, cost_micros, latency_ms, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        input.conversationId,
        input.model,
        Math.max(0, Math.round(input.promptTokens)),
        Math.max(0, Math.round(input.completionTokens)),
        Math.max(0, Math.round(input.promptTokens + input.completionTokens)),
        Math.max(0, Math.round(input.costMicros)),
        Math.round(input.latencyMs),
        input.error?.slice(0, 500) ?? null,
        Date.now(),
      );
  } catch { /* usage logging must never break a conversation */ }
}

/* ------------------------------------------------------------------ leads */

export interface LeadInput {
  conversationId: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  specialty?: string | null;
  providers?: string | null;
  currentSetup?: string | null;
  challenge?: string | null;
  servicesInterest?: string | null;
  preferredContact?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function saveLead(input: LeadInput): { id: number; created: boolean; email: string | null } {
  const sql = db();
  const email = input.email?.trim().toLowerCase() ?? null;
  if (email && (!EMAIL_RE.test(email) || email.length > 200)) throw new Error("That email address doesn't look valid.");
  const existing = sql.prepare("SELECT id, email FROM ai_leads WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1").get(input.conversationId) as { id: number; email: string | null } | undefined;
  const now = Date.now();
  const clean = (value: string | null | undefined, max: number) => (value ? String(value).trim().slice(0, max) || null : null);
  if (existing) {
    sql.prepare(
      `UPDATE ai_leads SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone),
       organization = COALESCE(?, organization), specialty = COALESCE(?, specialty), providers = COALESCE(?, providers),
       current_setup = COALESCE(?, current_setup), challenge = COALESCE(?, challenge), services_interest = COALESCE(?, services_interest),
       preferred_contact = COALESCE(?, preferred_contact), updated_at = ? WHERE id = ?`,
    ).run(
      clean(input.name, 120), email, clean(input.phone, 40), clean(input.organization, 160), clean(input.specialty, 120),
      clean(input.providers, 40), clean(input.currentSetup, 300), clean(input.challenge, 600), clean(input.servicesInterest, 300),
      clean(input.preferredContact, 40), now, existing.id,
    );
    sql.prepare("UPDATE ai_conversations SET lead_id = ?, visitor_name = COALESCE(?, visitor_name), visitor_email = COALESCE(?, visitor_email), last_activity_at = ? WHERE id = ?")
      .run(existing.id, clean(input.name, 120), email, now, input.conversationId);
    return { id: existing.id, created: false, email: email ?? existing.email ?? null };
  }
  const result = sql.prepare(
    `INSERT INTO ai_leads (conversation_id, name, email, phone, organization, specialty, providers, current_setup, challenge, services_interest, preferred_contact, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
  ).run(
    input.conversationId, clean(input.name, 120), email, clean(input.phone, 40), clean(input.organization, 160), clean(input.specialty, 120),
    clean(input.providers, 40), clean(input.currentSetup, 300), clean(input.challenge, 600), clean(input.servicesInterest, 300), clean(input.preferredContact, 40), now, now,
  );
  const id = Number(result.lastInsertRowid);
  sql.prepare("UPDATE ai_conversations SET lead_id = ?, visitor_name = COALESCE(?, visitor_name), visitor_email = COALESCE(?, visitor_email), last_activity_at = ? WHERE id = ?")
    .run(id, clean(input.name, 120), email, now, input.conversationId);
  return { id, created: true, email };
}

export async function notifyNewLead(lead: { name: string | null; email: string | null; organization: string | null; challenge: string | null }): Promise<void> {
  const settings = getAiSettings();
  try {
    await sendOwnerNotification({
      kind: "ai_lead",
      subject: `New AI-qualified lead${lead.organization ? ` — ${lead.organization}` : ""}`,
      text: `The AI agent collected a new lead.\n\nName: ${lead.name ?? "not provided"}\nEmail: ${lead.email ?? "not provided"}\nOrganization: ${lead.organization ?? "not provided"}\nChallenge: ${lead.challenge ?? "not provided"}\n\nReview conversations in the admin console: ${site.url}/admin/ai/conversations`,
      html: `<h2>New AI-qualified lead</h2><ul><li>Name: ${lead.name ?? "not provided"}</li><li>Email: ${lead.email ?? "not provided"}</li><li>Organization: ${lead.organization ?? "not provided"}</li><li>Challenge: ${lead.challenge ?? "not provided"}</li></ul><p><a href="${site.url}/admin/ai/conversations">Review in the admin console</a></p>`,
      to: settings.notificationEmail || undefined,
      relatedType: "ai_lead",
    });
  } catch { /* email failure must not lose the lead */ }
}

/* ---------------------------------------------------------------- handoffs */

export function createHandoff(input: { conversationId: number; reason: string; name?: string | null; email?: string | null; phone?: string | null }): number {
  const reason = input.reason?.trim();
  if (!reason) throw new Error("A handoff reason is required.");
  const sql = db();
  const now = Date.now();
  const result = sql.prepare(
    "INSERT INTO ai_handoffs (conversation_id, name, email, phone, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
  ).run(
    input.conversationId,
    input.name?.slice(0, 120) ?? null,
    input.email?.slice(0, 200) ?? null,
    input.phone?.slice(0, 40) ?? null,
    reason.slice(0, 1000),
    now,
    now,
  );
  const id = Number(result.lastInsertRowid);
  sql.prepare("UPDATE ai_conversations SET handoff_id = ?, visitor_name = COALESCE(?, visitor_name), visitor_email = COALESCE(?, visitor_email), last_activity_at = ? WHERE id = ?")
    .run(id, input.name?.slice(0, 120) ?? null, input.email?.slice(0, 200) ?? null, now, input.conversationId);
  return id;
}

export async function notifyHandoff(handoff: { id: number; reason: string; name: string | null; email: string | null; phone: string | null }): Promise<boolean> {
  const settings = getAiSettings();
  try {
    const result = await sendOwnerNotification({
      kind: "handoff",
      subject: "AI agent requested a human handoff",
      text: `A website visitor asked for a human.\n\nReason: ${handoff.reason}\nName: ${handoff.name ?? "not provided"}\nEmail: ${handoff.email ?? "not provided"}\nPhone: ${handoff.phone ?? "not provided"}\n\nOpen the queue: ${site.url}/admin/ai/handoffs`,
      html: `<h2>Human handoff requested</h2><p><strong>Reason:</strong> ${handoff.reason}</p><ul><li>Name: ${handoff.name ?? "not provided"}</li><li>Email: ${handoff.email ?? "not provided"}</li><li>Phone: ${handoff.phone ?? "not provided"}</li></ul><p><a href="${site.url}/admin/ai/handoffs">Open the handoff queue</a></p>`,
      to: settings.handoffEmail || undefined,
      relatedType: "ai_handoff",
      relatedId: handoff.id,
    });
    if (result.status !== "failed") {
      db().prepare("UPDATE ai_handoffs SET notified_at = ? WHERE id = ?").run(Date.now(), handoff.id);
      return true;
    }
  } catch { /* surfaced to admin as not notified */ }
  return false;
}

/* ------------------------------------------------------------------ admin */

export interface ConversationSummary {
  id: number; channel: string; status: string; messageCount: number; visitorName: string | null; visitorEmail: string | null;
  leadId: number | null; appointmentId: number | null; handoffId: number | null; createdAt: number; lastActivityAt: number;
}

export function listConversations(limit = 100): ConversationSummary[] {
  try {
    const rows = db().prepare("SELECT * FROM ai_conversations ORDER BY last_activity_at DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id), channel: String(row.channel), status: String(row.status), messageCount: Number(row.message_count),
      visitorName: row.visitor_name ? String(row.visitor_name) : null, visitorEmail: row.visitor_email ? String(row.visitor_email) : null,
      leadId: row.lead_id ? Number(row.lead_id) : null, appointmentId: row.appointment_id ? Number(row.appointment_id) : null,
      handoffId: row.handoff_id ? Number(row.handoff_id) : null, createdAt: Number(row.created_at), lastActivityAt: Number(row.last_activity_at),
    }));
  } catch { return []; }
}

export function getConversationDetail(id: number): { conversation: ConversationSummary; messages: { role: string; content: string; createdAt: number }[] } | null {
  const all = listConversations(500);
  const conversation = all.find((item) => item.id === id);
  if (!conversation) return null;
  try {
    const rows = db().prepare("SELECT role, content, created_at FROM ai_messages WHERE conversation_id = ? AND role IN ('user','assistant') ORDER BY created_at ASC LIMIT 300").all(id) as Record<string, unknown>[];
    return { conversation, messages: rows.map((row) => ({ role: String(row.role), content: String(row.content), createdAt: Number(row.created_at) })) };
  } catch { return { conversation, messages: [] }; }
}

export function listLeads(limit = 200) {
  try {
    const rows = db().prepare("SELECT * FROM ai_leads ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id), conversationId: row.conversation_id ? Number(row.conversation_id) : null,
      name: row.name ? String(row.name) : null, email: row.email ? String(row.email) : null, phone: row.phone ? String(row.phone) : null,
      organization: row.organization ? String(row.organization) : null, specialty: row.specialty ? String(row.specialty) : null,
      providers: row.providers ? String(row.providers) : null, currentSetup: row.current_setup ? String(row.current_setup) : null,
      challenge: row.challenge ? String(row.challenge) : null, servicesInterest: row.services_interest ? String(row.services_interest) : null,
      preferredContact: row.preferred_contact ? String(row.preferred_contact) : null, status: String(row.status),
      createdAt: Number(row.created_at),
    }));
  } catch { return []; }
}

export function listHandoffs(limit = 200) {
  try {
    const rows = db().prepare("SELECT * FROM ai_handoffs ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id), conversationId: row.conversation_id ? Number(row.conversation_id) : null,
      name: row.name ? String(row.name) : null, email: row.email ? String(row.email) : null, phone: row.phone ? String(row.phone) : null,
      reason: String(row.reason), status: String(row.status), adminNote: row.admin_note ? String(row.admin_note) : null,
      notifiedAt: row.notified_at ? Number(row.notified_at) : null, createdAt: Number(row.created_at),
    }));
  } catch { return []; }
}

export function updateHandoff(id: number, status: "pending" | "in_progress" | "resolved", adminNote?: string | null): void {
  if (!["pending", "in_progress", "resolved"].includes(status)) throw new Error("Invalid handoff status.");
  db().prepare("UPDATE ai_handoffs SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = ? WHERE id = ?")
    .run(status, adminNote?.slice(0, 2000) ?? null, Date.now(), id);
}

export interface AiStats {
  conversations: number; messages: number; voiceConversations: number; leads: number; appointments: number;
  pendingHandoffs: number; totalTokens: number; costMicros: number; errors: number; todayConversations: number;
}

export function getAiStats(): AiStats {
  try {
    const sql = db();
    const one = (query: string, ...params: unknown[]) => Number((sql.prepare(query).get(...params) as { n: number }).n);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const usage = sql.prepare("SELECT COALESCE(SUM(total_tokens),0) AS t, COALESCE(SUM(cost_micros),0) AS c, COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END),0) AS e FROM ai_usage_logs").get() as { t: number; c: number; e: number };
    return {
      conversations: one("SELECT COUNT(*) AS n FROM ai_conversations"),
      messages: one("SELECT COUNT(*) AS n FROM ai_messages"),
      voiceConversations: one("SELECT COUNT(*) AS n FROM ai_conversations WHERE channel = 'voice'"),
      leads: one("SELECT COUNT(*) AS n FROM ai_leads"),
      appointments: one("SELECT COUNT(*) AS n FROM ai_appointments WHERE status IN ('pending','confirmed','rescheduled')"),
      pendingHandoffs: one("SELECT COUNT(*) AS n FROM ai_handoffs WHERE status <> 'resolved'"),
      totalTokens: Number(usage.t),
      costMicros: Number(usage.c),
      errors: Number(usage.e),
      todayConversations: one("SELECT COUNT(*) AS n FROM ai_conversations WHERE created_at >= ?", todayStart.getTime()),
    };
  } catch {
    return { conversations: 0, messages: 0, voiceConversations: 0, leads: 0, appointments: 0, pendingHandoffs: 0, totalTokens: 0, costMicros: 0, errors: 0, todayConversations: 0 };
  }
}

/** Delete conversations past their retention date (messages cascade). */
export function pruneExpiredConversations(): number {
  try {
    const result = db().prepare("DELETE FROM ai_conversations WHERE expires_at IS NOT NULL AND expires_at < ?").run(Date.now());
    return result.changes;
  } catch { return 0; }
}
