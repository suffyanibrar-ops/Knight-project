import "server-only";
import { sqliteHandle } from "@/lib/sqlite";
import { claimGrant, issueGrant, revokeGrant } from "./admin-grants";

/**
 * Controlled admin action layer (Phase 8, hardened).
 *
 *  V1 — every entry point resolves the admin session itself; route-level auth
 *       is never trusted alone and the default resolver fails closed.
 *  V2 — the actor comes from that session, never from the caller.
 *  V3 — execution requires a server-issued HMAC grant bound to type, params,
 *       actor and expiry, claimed atomically (one use).
 *  Atomicity — mutation + audit share one SQLite transaction.
 *  Verification — the result is read back before success is reported.
 */

export type ActionLevel = "A" | "B" | "C";

export interface ActionDefinition {
  type: string;
  label: string;
  level: ActionLevel;
  reversible: boolean;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  params: string[];
  describe: (params: Record<string, unknown>) => string;
}

export const ACTIONS: Record<string, ActionDefinition> = {
  "appointment.cancel": {
    type: "appointment.cancel",
    label: "Cancel an appointment",
    level: "C",
    reversible: false,
    requiresConfirmation: true,
    requiresApproval: true,
    params: ["id"],
    describe: (params) => `Cancel appointment #${params.id}. The slot is released and the record moves to history.`,
  },
  "enquiry.set_status": {
    type: "enquiry.set_status",
    label: "Change an enquiry status",
    level: "B",
    reversible: true,
    requiresConfirmation: true,
    requiresApproval: false,
    params: ["id", "status"],
    describe: (params) => `Set enquiry #${params.id} to "${params.status}" and append the change to its history.`,
  },
};

const STATUSES = ["pending", "contacted", "resolved", "cancelled"] as const;

export interface AdminSession { ok: true; actor: string }
export type SessionResolver = () => Promise<AdminSession | { ok: false; reason: string }>;

/** Fail closed: no session, no actor, no action. */
export const defaultSessionResolver: SessionResolver = async () => {
  try {
    const { isAdminAuthenticated } = await import("./auth");
    if (!(await isAdminAuthenticated())) return { ok: false, reason: "unauthenticated" };
    return { ok: true, actor: "admin" }; // single-operator console identity
  } catch {
    return { ok: false, reason: "unauthenticated" };
  }
};

export interface Preview {
  ok: boolean;
  type?: string;
  summary?: string;
  level?: ActionLevel;
  reversible?: boolean;
  requiresConfirmation?: boolean;
  requiresApproval?: boolean;
  before?: Record<string, unknown>;
  error?: string;
  reason?: "unauthorized" | "invalid";
}

function coerce(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && /^\d+$/.test(value)) out[key] = Number(value);
    else out[key] = typeof value === "string" ? value.trim().slice(0, 200) : value;
  }
  return out;
}

function validate(action: ActionDefinition, params: Record<string, unknown>): { ok: boolean; error?: string } {
  for (const key of action.params) {
    if (params[key] === undefined || params[key] === null || params[key] === "") return { ok: false, error: `Missing "${key}".` };
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "id must be a positive integer." };
  if (action.type === "enquiry.set_status" && !(STATUSES as readonly string[]).includes(String(params.status))) {
    return { ok: false, error: `status must be one of: ${STATUSES.join(", ")}.` };
  }
  return { ok: true };
}

function readAppointment(id: number): { id: number; status: string } | null {
  const db = sqliteHandle();
  if (!db) return null;
  const row = db.prepare("SELECT id, status FROM ai_appointments WHERE id = ?").get(id) as { id: number; status: string } | undefined;
  return row ? { id: Number(row.id), status: String(row.status) } : null;
}

function readEnquiry(id: number): { id: number; status: string | null } | null {
  const db = sqliteHandle();
  if (!db) return null;
  const row = db.prepare("SELECT id, status FROM submissions WHERE id = ?").get(id) as { id: number; status: string | null } | undefined;
  return row ? { id: Number(row.id), status: row.status ?? null } : null;
}

/** Read-only preview. Requires a session because it exposes record state. */
export async function previewAction(
  type: string,
  rawParams: Record<string, unknown>,
  options: { resolver?: SessionResolver } = {},
): Promise<Preview> {
  const session = await (options.resolver ?? defaultSessionResolver)();
  if (!session.ok) return { ok: false, error: "Not signed in.", reason: "unauthorized" };

  const action = ACTIONS[type];
  if (!action) return { ok: false, error: `Unknown action "${type}".`, reason: "invalid" };
  const params = coerce(rawParams);
  const checked = validate(action, params);
  if (!checked.ok) return { ok: false, error: checked.error ?? "Invalid parameters.", reason: "invalid" };

  const id = Number(params.id);
  const before = type === "appointment.cancel" ? readAppointment(id) : readEnquiry(id);
  if (!before) return { ok: false, error: `No record found with id ${id}.`, reason: "invalid" };

  return {
    ok: true,
    type,
    summary: action.describe(params),
    level: action.level,
    reversible: action.reversible,
    requiresConfirmation: action.requiresConfirmation,
    requiresApproval: action.requiresApproval,
    before: { ...before },
  };
}

export interface IssuedActionGrant { ok: true; nonce: string; token: string; expiresAt: number; actor: string }
export type IssueOutcome = IssuedActionGrant | { ok: false; status: "unauthorized" | "invalid" | "config_unavailable" | "storage_unavailable"; error: string };

/** Validates the request and issues a single-use grant for later confirmation. */
export async function issueActionGrant(
  input: { type: string; params: Record<string, unknown> },
  options: { resolver?: SessionResolver } = {},
): Promise<IssueOutcome> {
  const session = await (options.resolver ?? defaultSessionResolver)();
  if (!session.ok) return { ok: false, status: "unauthorized", error: "Not signed in." };

  const action = ACTIONS[input.type];
  if (!action) return { ok: false, status: "invalid", error: `Unknown action "${input.type}".` };
  const params = coerce(input.params);
  const checked = validate(action, params);
  if (!checked.ok) return { ok: false, status: "invalid", error: checked.error ?? "Invalid parameters." };

  const issued = issueGrant({ type: action.type, params, actor: session.actor });
  if ("error" in issued) {
    return { ok: false, status: issued.error, error: issued.error === "config_unavailable" ? "Confirmation signing is not configured on the server." : "Storage unavailable." };
  }
  return { ok: true, nonce: issued.nonce, token: issued.token, expiresAt: issued.expiresAt, actor: session.actor };
}

export type ExecutionStatus =
  | "completed" | "unauthorized" | "expired" | "already_used" | "forbidden"
  | "invalid" | "interrupted" | "failed" | "config_unavailable";

export interface ExecutionResult {
  ok: boolean;
  status: ExecutionStatus;
  summary?: string;
  verified?: Record<string, unknown>;
  error?: string;
}

/**
 * Executes a confirmed action. The grant is the authorisation: it is verified
 * against the authenticated actor and consumed before any write happens.
 * Parameters are read from the signed grant, never from the caller.
 */
export async function executeAction(
  input: { nonce: string; token: string; type?: string },
  options: { resolver?: SessionResolver; now?: number } = {},
): Promise<ExecutionResult> {
  const session = await (options.resolver ?? defaultSessionResolver)();
  if (!session.ok) return { ok: false, status: "unauthorized", error: "Not signed in." };

  const claimed = claimGrant({ nonce: input.nonce, token: input.token, actor: session.actor, type: input.type, now: options.now });
  if (!claimed.ok) {
    if (claimed.status === "config") return { ok: false, status: "config_unavailable", error: "Confirmation signing is not configured." };
    if (claimed.status === "expired") return { ok: false, status: "expired", error: "This confirmation expired. Prepare the action again." };
    if (claimed.status === "forbidden") return { ok: false, status: "forbidden", error: "This confirmation belongs to a different administrator." };
    if (claimed.status === "invalid") return { ok: false, status: "forbidden", error: "Confirmation token is not valid for these parameters." };
    return { ok: false, status: "already_used", error: "This confirmation was already used or does not exist." };
  }

  // The action comes from the signed grant, not from the caller.
  const actionType = claimed.grant.type;
  const action = ACTIONS[actionType];
  if (!action) return { ok: false, status: "invalid", error: `Unknown action "${actionType}".` };

  const params = claimed.grant.params;
  const checked = validate(action, params);
  if (!checked.ok) return { ok: false, status: "invalid", error: checked.error ?? "Invalid parameters." };

  const id = Number(params.id);
  const db = sqliteHandle();
  if (!db) return { ok: false, status: "failed", error: "Storage unavailable." };

  const now = Date.now();
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (actionType === "appointment.cancel") {
        const result = db.prepare(
          "UPDATE ai_appointments SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
        ).run(now, session.actor, now, id);
        if (Number(result.changes) !== 1) throw new Error("Appointment not found or already removed.");
      } else {
        const status = String(params.status);
        const result = db.prepare("UPDATE submissions SET status = ? WHERE id = ?").run(status, id);
        if (Number(result.changes) !== 1) throw new Error("Enquiry not found.");
        db.prepare(
          "INSERT INTO enquiry_status_events (kind, record_id, from_status, to_status, actor, note) VALUES ('submission', ?, NULL, ?, ?, 'Confirmed admin action')",
        ).run(id, status, session.actor);
      }
      db.prepare("INSERT INTO admin_audit (action, detail, ip) VALUES (?, ?, NULL)").run(
        `ai.action.${actionType}`.slice(0, 80),
        `${action.describe(params)} — actor ${session.actor}`.slice(0, 2000),
      );
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      // The grant is consumed: nothing can be replayed. The mutation rolled back.
      const message = error instanceof Error ? error.message.slice(0, 300) : "Action failed.";
      return { ok: false, status: "interrupted", error: `${message} Nothing was changed; prepare the action again.` };
    }
  } catch (error) {
    return { ok: false, status: "failed", error: error instanceof Error ? error.message.slice(0, 300) : "Action failed." };
  }

  const after = actionType === "appointment.cancel" ? readAppointment(id) : readEnquiry(id);
  const expected = actionType === "appointment.cancel" ? "cancelled" : String(params.status);
  if (!after || after.status !== expected) {
    return { ok: false, status: "failed", error: "The change did not persist as expected." };
  }

  return { ok: true, status: "completed", summary: action.describe(params), verified: { ...after } };
}

export { revokeGrant };
