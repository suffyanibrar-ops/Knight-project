import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { isDatabaseConfigured } from "@/db";
import { adminAudit } from "@/db/schema";
import { expectedPasswordDigest, FALLBACK_ADMIN_PEPPER, sessionSecret } from "./admin-session";
import { getStoredPasswordHash, verifyPasswordHash } from "./admin-password";
import { hasConfiguredAdminPassword, isProduction } from "./config";

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
 *   4. Development-only built-in default — DISABLED in production
 *
 * In production, if no password has been configured at all, verification always
 * fails: sign-in is closed rather than falling back to a publicly known default.
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

  // Production with no configured password: refuse every attempt.
  if (isProduction && !hasConfiguredAdminPassword()) {
    console.error("[auth] Sign-in blocked: ADMIN_PASSWORD is not configured in production.");
    return false;
  }

  // 3. Legacy peppered digest (ADMIN_PASSWORD_HASH).
  const expected = expectedPasswordDigest();

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
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined | null): { valid: boolean; expires?: number } {
  if (!token) return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false };
  const [scope, expiresRaw, signature] = parts;
  const payload = `${scope}.${expiresRaw}`;
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

/** Simple in-memory brute-force protection (per IP, resets on restart). */
type Attempt = { count: number; firstAt: number; blockedUntil?: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function rateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = attempts.get(key);
  if (record?.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }
  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 0, firstAt: now });
  }
  return { allowed: true };
}

export function recordFailure(key: string) {
  const now = Date.now();
  const record = attempts.get(key) ?? { count: 0, firstAt: now };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) record.blockedUntil = now + WINDOW_MS;
  attempts.set(key, record);
}

export function clearFailures(key: string) {
  attempts.delete(key);
}

export async function logAdminAction(action: string, detail: string | null, ip: string | null) {
  if (!isDatabaseConfigured()) return;
  try {
    await db.insert(adminAudit).values({ action: action.slice(0, 80), detail: detail?.slice(0, 2000) ?? null, ip: ip?.slice(0, 80) ?? null });
  } catch {
    // audit logging must never break the request
  }
}
