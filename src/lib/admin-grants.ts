import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sqliteHandle } from "@/lib/sqlite";

/**
 * Confirmation grants (Phase 8 hardening, V3).
 *
 * A grant is the only thing that authorises a state change:
 *  - token = HMAC-SHA256(secret, type|params|nonce|actor|expiresAt)
 *  - the secret is ADMIN_SESSION_SECRET; missing or short ⇒ fail closed
 *  - the grant must exist server-side, match the actor, be unexpired, and is
 *    deleted atomically so exactly one caller can claim it
 */

export const GRANT_TTL_MS = 10 * 60 * 1000;
const PREFIX = "ai:grant:";
const SECRET_ENV = "ADMIN_SESSION_SECRET";
const MIN_SECRET_LENGTH = 16;

export type GrantStatus = "expired" | "unknown" | "forbidden" | "invalid" | "config";

export interface GrantRecord {
  type: string;
  params: Record<string, unknown>;
  actor: string;
  expiresAt: number;
}

export interface IssuedGrant { nonce: string; token: string; expiresAt: number }

export function grantSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env[SECRET_ENV]?.trim() ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function mac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signGrant(input: {
  secret: string;
  type: string;
  params: Record<string, unknown>;
  nonce: string;
  actor: string;
  expiresAt: number;
}): string {
  return mac(input.secret, `${input.type}|${JSON.stringify(input.params)}|${input.nonce}|${input.actor}|${input.expiresAt}`);
}

const key = (nonce: string) => `${PREFIX}${nonce}`;

export function issueGrant(input: {
  type: string;
  params: Record<string, unknown>;
  actor: string;
  ttlMs?: number;
  now?: number;
}): IssuedGrant | { error: "config_unavailable" | "storage_unavailable" } {
  const secret = grantSecret();
  if (!secret) return { error: "config_unavailable" };
  const db = sqliteHandle();
  if (!db) return { error: "storage_unavailable" };

  const nonce = randomBytes(16).toString("hex");
  const expiresAt = (input.now ?? Date.now()) + (input.ttlMs ?? GRANT_TTL_MS);
  const token = signGrant({ secret, type: input.type, params: input.params, nonce, actor: input.actor, expiresAt });
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key(nonce), JSON.stringify({ type: input.type, params: input.params, actor: input.actor, expiresAt }));
  return { nonce, token, expiresAt };
}

function readGrant(nonce: string): GrantRecord | null {
  const db = sqliteHandle();
  if (!db) return null;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key(nonce)) as { value?: string } | undefined;
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value) as GrantRecord;
    return { type: String(parsed.type), params: parsed.params ?? {}, actor: String(parsed.actor), expiresAt: Number(parsed.expiresAt) };
  } catch {
    return null;
  }
}

/** Atomic single-use claim: the DELETE is the lock. */
function claim(nonce: string): boolean {
  const db = sqliteHandle();
  if (!db) return false;
  return Number(db.prepare("DELETE FROM settings WHERE key = ?").run(key(nonce)).changes) === 1;
}

export type ClaimOutcome = { ok: true; grant: GrantRecord } | { ok: false; status: GrantStatus };

/**
 * Verify and consume a grant. Order matters: existence → expiry → actor →
 * signature → atomic claim. Nothing is consumed unless every check passes.
 */
export function claimGrant(input: { nonce: string; token: string; actor: string; type?: string; now?: number }): ClaimOutcome {
  const secret = grantSecret();
  if (!secret) return { ok: false, status: "config" };
  const grant = readGrant(input.nonce);
  if (!grant) return { ok: false, status: "unknown" };

  const now = input.now ?? Date.now();
  if (grant.expiresAt <= now) {
    claim(input.nonce);
    return { ok: false, status: "expired" };
  }
  if (grant.actor !== input.actor) return { ok: false, status: "forbidden" };
  if (input.type && grant.type !== input.type) return { ok: false, status: "invalid" };

  const expected = signGrant({ secret, type: grant.type, params: grant.params, nonce: input.nonce, actor: grant.actor, expiresAt: grant.expiresAt });
  const supplied = input.token ?? "";
  if (supplied.length !== expected.length) return { ok: false, status: "invalid" };
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return { ok: false, status: "invalid" };

  if (!claim(input.nonce)) return { ok: false, status: "unknown" };
  return { ok: true, grant };
}

export function revokeGrant(nonce: string): boolean {
  const db = sqliteHandle();
  if (!db) return false;
  return Number(db.prepare("DELETE FROM settings WHERE key = ?").run(key(nonce)).changes) === 1;
}

export function purgeExpiredGrants(now = Date.now()): number {
  const db = sqliteHandle();
  if (!db) return 0;
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE ?").all(`${PREFIX}%`) as { key: string; value: string }[];
  let removed = 0;
  for (const row of rows) {
    let expired = true;
    try { expired = Number(JSON.parse(row.value).expiresAt) <= now; } catch { expired = true; }
    if (expired) removed += Number(db.prepare("DELETE FROM settings WHERE key = ?").run(row.key).changes);
  }
  return removed;
}

export const GRANT_KEY_PREFIX = PREFIX;
