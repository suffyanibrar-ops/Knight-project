import { randomBytes } from "node:crypto";

/**
 * Internal admin-session constants shared by the Node runtime (server actions,
 * server components) and the proxy (`src/proxy.ts`, Node.js runtime).
 *
 * Nothing here is imported by client components, so it never reaches the
 * browser bundle. There is NO built-in admin password — when nothing is
 * configured, sign-in is disabled (see `expectedPasswordDigest`).
 *
 * Deployments may override everything with environment variables:
 *   ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET
 */

export const FALLBACK_ADMIN_PEPPER = "kmb-admin-session-v1-2026";

/**
 * Internal environment slot used to share the generated per-process signing key
 * between the proxy bundle and the server bundle. They are separate module
 * instances inside the same Node.js process, so a module-scope variable alone
 * would give them different keys and break our own sessions. The value is only
 * ever written here, never read from operator configuration.
 */
const PER_PROCESS_SECRET_ENV = "__KMB_PER_PROCESS_SESSION_SECRET";
let perProcessSecret: string | undefined;

function perProcessSessionSecret(): string {
  const shared = process.env[PER_PROCESS_SECRET_ENV];
  if (shared) return shared;
  if (!perProcessSecret) {
    perProcessSecret = randomBytes(32).toString("hex");
    process.env[PER_PROCESS_SECRET_ENV] = perProcessSecret;
  }
  return perProcessSecret;
}

/**
 * Signing key for the admin session cookie.
 * In production a dedicated ADMIN_SESSION_SECRET should be set. When it is
 * absent, an unpredictable per-process key is generated once instead: cookies
 * cannot be forged from public source values, and tokens we issue still verify
 * for the lifetime of this process (a restart rotates the key).
 */
export function sessionSecret(): string {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (process.env.NODE_ENV === "production") return perProcessSessionSecret();
  return process.env.ADMIN_PASSWORD_HASH ?? FALLBACK_ADMIN_PEPPER;
}

/**
 * Digest expected by the legacy ADMIN_PASSWORD_HASH path.
 * `null` means no admin password is configured at all: sign-in is disabled in
 * every environment — there is no built-in default password.
 */
export function expectedPasswordDigest(): string | null {
  if (process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH;
  const plain = process.env.ADMIN_PASSWORD;
  if (plain) {
    // Runtime-only convenience: derive a digest from a plaintext env var.
    return `${FALLBACK_ADMIN_PEPPER}:plain:${plain}`;
  }
  return null;
}
