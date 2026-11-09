import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { adminAudit } from "@/db/schema";
import { expectedPasswordDigest, FALLBACK_ADMIN_PEPPER, sessionSecret } from "./admin-session";
import { getStoredPasswordHash, verifyPasswordHash } from "./admin-password";
import { hasConfiguredAdminPassword } from "./config";
import { clearPersistentFailure, peekPersistentRateLimit, recordPersistentFailure } from "./rate-limit";
import { getAdminSessionVersion } from "./admin-session-version";

export const ADMIN_COOKIE = "kmb_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export { sessionSecret };

/**
 * The plaintext password never exists in the codebase or the browser bundle.
 *
 * Resolution order:
 *   1. A password changed from the admin panel (scrypt hash in SQLite)
 *   2. ADMIN_PASSWORD (constant-time comparison)
 *   3. ADMIN_PASSWORD_HASH (peppered SHA-256 digest)
 *
 * There is no built-in/default password. If none of the three sources is
 * configured, verification always fails: sign-in is disabled in every
 * environment (fail closed) rather than falling back to a public default.
 */
export function verifyAdminPassword(candidate: string): boolean {
  if (!candidate) return false;

  // 1. Password managed from the admin panel.
  const stored = getStoredPasswordHash();
  if (stored) return verifyPasswordHash(candidate, stored);

  // 2. ADMIN_PASSWORD environment variable.
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword) {
    const a = Buffer.from(createHash("sha256").update(envPassword).digest("hex"), "hex");
    const b = Buffer.from(createHash("sha256").update(candidate).digest("hex"), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // 3. Legacy peppered digest (ADMIN_PASSWORD_HASH).
  const expected = expectedPasswordDigest();
  if (!expected) {
    // No panel password, no ADMIN_PASSWORD and no ADMIN_PASSWORD_HASH:
    // sign-in is disabled in every environment — there is no default password.
    console.error(
      "[auth] Sign-in blocked: no admin password is configured. Set ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH), or change it from the admin panel.",
    );
    return false;
  }

  if (expected.startsWith(`${FALLBACK_ADMIN_PEPPER}:plain:`)) {
    const plain = expected.slice(`${FALLBACK_ADMIN_PEPPER}:plain:`.length);
    const a = Buffer.from(createHash("sha256").update(plain).digest("hex"), "hex");
    const b = Buffer.from(createHash("sha256").update(candidate).digest("hex"), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  const actual = createHash("sha256").update(sessionSecret() + candidate).digest("hex");
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when admin sign-in is possible at all (used for a clear setup error). */
export function isAdminLoginConfigured(): boolean {
  return Boolean(getStoredPasswordHash()) || hasConfiguredAdminPassword();
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const version = getAdminSessionVersion();
  const payload = `admin.${version}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined | null): { valid: boolean; expires?: number } {
  if (!token) return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false };
  const [scope, version, expiresRaw, signature] = parts;
  if (scope !== "admin" || version !== getAdminSessionVersion()) return { valid: false };
  const payload = `${scope}.${version}.${expiresRaw}`;
  const expected = sign(payload);
  if (signature.length !== expected.length) return { valid: false };
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return { valid: false };
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return { valid: false };
  return { valid: true, expires };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return readSessionToken(store.get(ADMIN_COOKIE)?.value).valid;
}

/** Persistent login-failure protection, with an in-process fallback in SQLite-less mode. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function rateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  return peekPersistentRateLimit(`admin-login:${key}`, MAX_ATTEMPTS, WINDOW_MS);
}

export function recordFailure(key: string) {
  recordPersistentFailure(`admin-login:${key}`, MAX_ATTEMPTS, WINDOW_MS);
}

export function clearFailures(key: string) {
  clearPersistentFailure(`admin-login:${key}`);
}

export async function logAdminAction(action: string, detail: string | null, ip: string | null) {
  // Audit rows live in the embedded SQLite database, which is present whenever
  // the admin console itself works.
  try {
    await db.insert(adminAudit).values({ action: action.slice(0, 80), detail: detail?.slice(0, 2000) ?? null, ip: ip?.slice(0, 80) ?? null });
  } catch {
    // audit logging must never break the request
  }
}
