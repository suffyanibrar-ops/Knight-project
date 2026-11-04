/**
 * Internal admin-session constants shared by the Node runtime (server actions,
 * server components) and the Edge middleware.
 *
 * Nothing here is imported by client components, so it never reaches the
 * browser bundle. The value below is only a peppered SHA-256 digest — the
 * plaintext password is never stored in the repository.
 *
 * Deployments may override everything with environment variables:
 *   ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET
 */

export const FALLBACK_ADMIN_PEPPER = "kmb-admin-session-v1-2026";
export const FALLBACK_ADMIN_PASSWORD_HASH = "56a32a55ce814ee541cc0326fadc9917ff8c1ee94826b303407cbbb6fc7f8038";

/**
 * Signing key for the admin session cookie.
 * In production a dedicated ADMIN_SESSION_SECRET is required — the shared
 * development pepper is never used to sign real sessions.
 */
export function sessionSecret(): string {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    // Fail closed: an unpredictable per-boot value invalidates any token that
    // was signed with the development pepper, instead of trusting it.
    return `${FALLBACK_ADMIN_PEPPER}:unconfigured:${process.env.ADMIN_PASSWORD_HASH ?? "none"}`;
  }
  return process.env.ADMIN_PASSWORD_HASH ?? FALLBACK_ADMIN_PEPPER;
}

export function expectedPasswordDigest(): string {
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
  const plain = process.env.ADMIN_PASSWORD;
  if (plain) {
    // Runtime-only convenience: derive a digest from a plaintext env var.
    return `${FALLBACK_ADMIN_PEPPER}:plain:${plain}`;
  }
  return FALLBACK_ADMIN_PASSWORD_HASH;
}
