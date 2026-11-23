import "server-only";
import { randomUUID } from "node:crypto";
import { sqliteHandle } from "@/lib/sqlite";

/**
 * Per-administrator chat log (Phase 8).
 *
 * Stored as one bounded JSON value in the existing `settings` table, keyed by the
 * authenticated administrator id — no migration, and ownership is structural:
 * an id can only ever read its own key.
 */

export const MAX_TURNS = 40;

export interface ChatProposal {
  nonce: string;
  token: string;
  type: string;
  summary: string;
  level: string;
  reversible: boolean;
  requiresApproval: boolean;
  before: Record<string, unknown>;
  expiresAt: number;
  status: "pending" | "completed" | "discarded" | "expired" | "already_used" | "forbidden" | "interrupted" | "failed";
}

export interface ChatTurn {
  id: string;
  role: "admin" | "assistant";
  text: string;
  at: string;
  proposal?: ChatProposal;
}

const keyFor = (actor: string) => `ai:chat:${actor}`;

function sanitise(actor: string): string {
  return actor.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "unknown";
}

export function loadChat(actor: string): ChatTurn[] {
  const db = sqliteHandle();
  if (!db) return [];
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(keyFor(sanitise(actor))) as { value?: string } | undefined;
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as ChatTurn[]) : [];
  } catch {
    return [];
  }
}

function write(actor: string, turns: ChatTurn[]): void {
  const db = sqliteHandle();
  if (!db) return;
  const capped = turns.slice(-MAX_TURNS);
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
  ).run(keyFor(sanitise(actor)), JSON.stringify(capped));
}

export function appendTurns(actor: string, ...turns: Omit<ChatTurn, "id" | "at">[]): ChatTurn[] {
  const existing = loadChat(actor);
  const next = [...existing, ...turns.map((turn) => ({ ...turn, id: randomUUID(), at: new Date().toISOString() }))];
  write(actor, next);
  return next;
}

/** Updates the newest pending proposal with the outcome of a confirmation. */
export function settleProposal(actor: string, nonce: string, status: ChatProposal["status"]): ChatTurn[] {
  const turns = loadChat(actor).map((turn) =>
    turn.proposal && turn.proposal.nonce === nonce
      ? { ...turn, proposal: { ...turn.proposal, status } }
      : turn,
  );
  write(actor, turns);
  return turns;
}

export function clearChat(actor: string): void {
  const db = sqliteHandle();
  if (!db) return;
  db.prepare("DELETE FROM settings WHERE key = ?").run(keyFor(sanitise(actor)));
}

export function pendingProposal(turns: ChatTurn[]): ChatProposal | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const proposal = turns[index]?.proposal;
    if (proposal && proposal.status === "pending") return proposal;
  }
  return null;
}
