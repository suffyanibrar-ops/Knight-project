import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminPasswordResets } from "@/db/schema";
import { saveAdminPassword } from "./admin-password";
import { adminEmail, siteUrl } from "./config";
import { sendPasswordResetEmail } from "./email";

/**
 * Admin password recovery.
 *
 * Security properties:
 *  - Tokens are 256-bit random values and only their SHA-256 hash is stored.
 *  - Links expire after 30 minutes and are claimed once.
 *  - Requesting a new link invalidates older unused links for the owner.
 *  - The request flow always returns the same public result, whether or not the
 *    supplied address is the configured owner email.
 *  - The reset link is not persisted in the email outbox; only the hash lives in
 *    SQLite.
 */
const RESET_TTL_MS = 30 * 60 * 1000;
export const RESET_EXPIRES_MINUTES = 30;
export const RESET_MIN_PASSWORD_LENGTH = 12;
export const RESET_MAX_PASSWORD_LENGTH = 128;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function configuredOwner(): string {
  return adminEmail().trim().toLowerCase();
}

/**
 * Creates and emails a reset link only when the address matches the configured
 * owner inbox. Callers must always show a generic response.
 */
export async function requestAdminPasswordReset(emailInput: string): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  if (!email || email !== configuredOwner()) return;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);

  // Invalidate any outstanding links before issuing a new one.
  await db.delete(adminPasswordResets).where(and(eq(adminPasswordResets.email, email), isNull(adminPasswordResets.usedAt)));
  await db.insert(adminPasswordResets).values({ tokenHash, email, expiresAt, createdAt: now });

  const resetUrl = `${siteUrl()}/admin/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail({ email, resetUrl, expiresMinutes: RESET_EXPIRES_MINUTES });
}

/** Returns the reset row only if it is present, unused and unexpired. */
export async function validPasswordReset(token: string) {
  if (!token || token.length < 20 || token.length > 300) return null;
  try {
    const rows = await db
    .select()
    .from(adminPasswordResets)
    .where(
      and(
        eq(adminPasswordResets.tokenHash, hashToken(token)),
        isNull(adminPasswordResets.usedAt),
        gt(adminPasswordResets.expiresAt, new Date()),
      ),
    )
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export function validateResetPassword(password: string): string | null {
  if (password.length < RESET_MIN_PASSWORD_LENGTH) return `Use at least ${RESET_MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > RESET_MAX_PASSWORD_LENGTH) return "Password is too long.";
  return null;
}

/**
 * Claims and consumes a token exactly once, then stores the new scrypt password.
 * The caller must not reveal whether a token existed.
 */
export async function resetAdminPassword(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const policyError = validateResetPassword(password);
  if (policyError) return { ok: false, error: policyError };
  const record = await validPasswordReset(token);
  if (!record) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };

  // Claim first so concurrent submissions cannot both use the same token.
  const claimed = await db
    .update(adminPasswordResets)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(adminPasswordResets.id, record.id),
        isNull(adminPasswordResets.usedAt),
        gt(adminPasswordResets.expiresAt, new Date()),
      ),
    )
    .returning({ id: adminPasswordResets.id });
  if (!claimed.length) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };

  const saved = saveAdminPassword(password);
  if (!saved.ok) return { ok: false, error: saved.error ?? "The new password could not be saved." };

  // Any other outstanding reset links are dead once the password changes.
  await db.delete(adminPasswordResets).where(and(eq(adminPasswordResets.email, record.email), isNull(adminPasswordResets.usedAt)));
  return { ok: true };
}
