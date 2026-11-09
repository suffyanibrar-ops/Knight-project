import "server-only";
import { sqliteHandle } from "./sqlite";

/**
 * Small in-process rate limiter for public endpoints.
 * Per-instance only (resets on restart / does not span replicas) — enough to
 * blunt form spam and credential stuffing on a single Node server. For
 * multi-instance deployments put a shared limiter at the edge.
 *
 * Keys MUST be built from clientKey()/clientKeyFromHeaders(), never from a
 * raw header value: the bucket key is only as trustworthy as the address it
 * is derived from.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Hard cap on distinct keys held in memory (approx. one small object each). */
const MAX_BUCKETS = 10_000;
/** Expired buckets are swept at most this often, on the write path. */
const PRUNE_INTERVAL_MS = 60_000;

let lastPruneAt = 0;

export type LimitOptions = { key: string; limit: number; windowMs: number };

export function checkRateLimit({ key, limit, windowMs }: LimitOptions): { allowed: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();

  if (now - lastPruneAt >= PRUNE_INTERVAL_MS) pruneBucketsAt(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // Never grow past the cap: first reclaim expired entries, then evict the
      // oldest inserted key. Map iteration order is insertion order, so this
      // drops the longest-lived bucket without touching newer, active ones.
      pruneBucketsAt(now);
      if (buckets.size >= MAX_BUCKETS) evictOldestBucket();
    }
    if (bucket) buckets.delete(key); // refresh insertion order for eviction
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, remaining: limit - 1 };
  }

  bucket.count += 1;
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  if (bucket.count > limit) return { allowed: false, retryAfter, remaining: 0 };
  return { allowed: true, retryAfter, remaining: limit - bucket.count };
}

/**
 * Client identifier used for rate limiting.
 *
 * TRUST_PROXY expectation (default trusted):
 *   This app is expected to run behind a single trusted reverse proxy (Vercel,
 *   Cloudflare, nginx, a load balancer). That proxy APPENDS the address of the
 *   peer that connected to it to X-Forwarded-For, so the LAST hop is the only
 *   entry the client cannot forge — we use it. Earlier entries are ignored on
 *   purpose: they are whatever the client chose to send.
 *   If several proxy layers are chained, the last hop becomes an internal
 *   address and buckets are shared by everyone behind it, so terminate the
 *   chain at one trusted proxy layer.
 *
 *   TRUST_PROXY=0 disables header trust for deployments exposed directly to
 *   the internet. A Web `Request` exposes no socket address, so all callers
 *   then share the single "direct" bucket — that keeps the Map bounded but
 *   cannot isolate clients; rely on an upstream limiter in that mode.
 */
export function clientKeyFromHeaders(headers: { get(name: string): string | null }): string {
  const trustProxy = (process.env.TRUST_PROXY ?? "1").trim().toLowerCase();
  if (trustProxy === "0" || trustProxy === "false" || trustProxy === "no") return "direct";

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Best-effort client identifier for a route handler request. */
export function clientKey(request: Request): string {
  return clientKeyFromHeaders(request.headers);
}

/** Drop expired buckets so the map cannot grow unbounded. */
export function pruneBuckets() {
  pruneBucketsAt(Date.now());
}

function pruneBucketsAt(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  lastPruneAt = now;
}

function evictOldestBucket() {
  const oldest = buckets.keys().next();
  if (!oldest.done) buckets.delete(oldest.value);
}

/** In-process fallback used only when SQLite is unavailable. */
const fallbackFailures = new Map<string, { count: number; resetAt: number }>();
function peekInProcess(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const row = fallbackFailures.get(key);
  if (!row || row.resetAt <= now) return { allowed: true };
  if (row.count >= limit) return { allowed: false, retryAfter: Math.ceil((row.resetAt - now) / 1000) };
  return { allowed: true };
}
function recordInProcess(key: string, _limit: number, windowMs: number): void {
  const now = Date.now();
  const row = fallbackFailures.get(key);
  if (!row || row.resetAt <= now) fallbackFailures.set(key, { count: 1, resetAt: now + windowMs });
  else fallbackFailures.set(key, { count: row.count + 1, resetAt: row.resetAt });
}
function clearInProcess(key: string): void { fallbackFailures.delete(key); }

/* -------------------------------------------------------------------------
 * Persistent SQLite buckets for low-volume security/admin actions.
 *
 * The in-process map above is still used for high-volume public traffic (for
 * example analytics events), where writing every request into SQLite would be
 * wasteful. Login, password-reset and admin write limits use the table added in
 * schema v10 so a process restart does not reset protection.
 * ---------------------------------------------------------------------- */

type PersistentRow = { count: number; reset_at: number };

function persistentBucket(key: string): PersistentRow | null {
  try {
    const driver = sqliteHandle();
    if (!driver) return null;
    const row = driver.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as PersistentRow | undefined;
    if (!row) return null;
    if (Number(row.reset_at) <= Date.now()) {
      driver.prepare("DELETE FROM rate_limits WHERE key = ?").run(key);
      return null;
    }
    return { count: Number(row.count), reset_at: Number(row.reset_at) };
  } catch {
    return null;
  }
}

/** Incrementing limiter used by password-reset requests and expensive admin actions. */
export function checkPersistentRateLimit({ key, limit, windowMs }: LimitOptions): { allowed: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  try {
    const driver = sqliteHandle();
    if (!driver) return checkRateLimit({ key, limit, windowMs });
    const resetAt = now + windowMs;
    driver.prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END`,
    ).run(key, resetAt, now, now, resetAt);
    const row = driver.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as PersistentRow | undefined;
    if (!row) return { allowed: true, retryAfter: 0, remaining: limit - 1 };
    const count = Number(row.count);
    const reset = Number(row.reset_at);
    return {
      allowed: count <= limit,
      retryAfter: count <= limit ? 0 : Math.max(1, Math.ceil((reset - now) / 1000)),
      remaining: Math.max(0, limit - count),
    };
  } catch {
    return checkRateLimit({ key, limit, windowMs });
  }
}

/** Non-incrementing failure check for login attempts. Falls back in-process. */
export function peekPersistentRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  try {
    const driver = sqliteHandle();
    if (!driver) {
      const fallback = peekInProcess(key, limit, windowMs);
      return fallback;
    }
    const row = persistentBucket(key);
    if (!row) return { allowed: true };
    if (row.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.reset_at - Date.now()) / 1000)) };
    return { allowed: true };
  } catch {
    return peekInProcess(key, limit, windowMs);
  }
}

/** Record a failed login attempt. The window is fixed from the first failure. */
export function recordPersistentFailure(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  try {
    const driver = sqliteHandle();
    if (!driver) {
      recordInProcess(key, limit, windowMs);
      return;
    }
    driver.prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END`,
    ).run(key, now + windowMs, now, now, now + windowMs);
    const row = driver.prepare("SELECT count FROM rate_limits WHERE key = ?").get(key) as { count: number } | undefined;
    if (row && Number(row.count) >= limit) driver.prepare("UPDATE rate_limits SET reset_at = ? WHERE key = ?").run(now + windowMs, key);
  } catch {
    recordInProcess(key, limit, windowMs);
  }
}

export function clearPersistentFailure(key: string): void {
  try {
    const driver = sqliteHandle();
    if (driver) driver.prepare("DELETE FROM rate_limits WHERE key = ?").run(key);
  } catch {
    /* fallback below */
  }
  clearInProcess(key);
}
