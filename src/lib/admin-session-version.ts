import "server-only";
import { randomBytes } from "node:crypto";
import { getSetting, setSetting } from "./sqlite";

/**
 * Server-side session generation shared by every admin session.
 *
 * The signed cookie includes this value. Changing the password rotates it, so
 * every previously issued cookie fails `readSessionToken` immediately even
 * though its HMAC and expiry are otherwise valid. The proxy can only verify the
 * signature (it has no database), so page/layout/API guards perform the version
 * check; all admin pages and APIs already call that guard.
 */
const KEY = "admin_session_version";
const INITIAL = "v1";

export function getAdminSessionVersion(): string {
  const stored = getSetting(KEY);
  return stored && stored.length >= 8 ? stored : INITIAL;
}

export function rotateAdminSessionVersion(): string {
  const next = randomBytes(24).toString("base64url");
  const saved = setSetting(KEY, next);
  if (!saved) {
    // Still return a fresh value for this process; persistence failure means the
    // DB is unhealthy, and password writes would already have failed.
    return next;
  }
  return next;
}
