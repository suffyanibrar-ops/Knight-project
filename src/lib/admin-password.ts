import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { deleteAdminPasswordResets, getSetting, setSetting } from "./sqlite";

/**
 * Admin password storage.
 *
 * Resolution order (first match wins):
 *   1. A hash changed from the admin panel — stored in SQLite (`settings` table)
 *   2. The ADMIN_PASSWORD environment variable
 *   3. The legacy digest (ADMIN_PASSWORD_HASH env; there is no built-in default)
 *
 * Hashes use scrypt with a per-password random salt. No plaintext password is
 * ever written to disk, logged, or shipped to the browser.
 */

const SETTING_KEY = "admin_password";
const KEY_LEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasswordHash(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, digest] = parts;
  try {
    const derived = scryptSync(plain, salt, KEY_LEN);
    const expected = Buffer.from(digest, "hex");
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Stored override created from the admin panel, if any. */
export function getStoredPasswordHash(): string | null {
  const value = getSetting(SETTING_KEY);
  return value && value.startsWith("scrypt$") ? value : null;
}

export function saveAdminPassword(plain: string): { ok: boolean; error?: string } {
  if (plain.length < 8) return { ok: false, error: "Use at least 8 characters." };
  if (plain.length > 128) return { ok: false, error: "Password is too long (128 characters maximum)." };
  const saved = setSetting(SETTING_KEY, hashPassword(plain));
  if (saved) deleteAdminPasswordResets();
  return saved ? { ok: true } : { ok: false, error: "Could not save the new password — the local database is unavailable." };
}

export function isPasswordManagedInPanel(): boolean {
  return getStoredPasswordHash() !== null;
}
