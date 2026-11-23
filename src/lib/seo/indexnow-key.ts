/**
 * IndexNow key-file helpers (Phase 6 / P6.5).
 *
 * Pure and dependency-free so the edge proxy and the tests share one rule set.
 * The key is read from the server environment only — never rendered, never sent
 * to the browser as data, never logged.
 */

export const INDEXNOW_KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

export function isValidIndexNowKey(value: string | undefined | null): boolean {
  return INDEXNOW_KEY_RE.test((value ?? "").trim());
}

export function indexNowKeyPath(requestPath: string, key: string | undefined | null): boolean {
  const value = (key ?? "").trim();
  if (!isValidIndexNowKey(value)) return false;
  return requestPath === `/${value}.txt`;
}

export function indexNowKeyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isValidIndexNowKey(env.INDEXNOW_KEY);
}
