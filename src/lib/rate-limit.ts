import "server-only";

/**
 * Small in-process rate limiter for public endpoints.
 * Per-instance only (resets on restart / does not span replicas) — enough to
 * blunt form spam and credential stuffing on a single Node server. For
 * multi-instance deployments put a shared limiter at the edge.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type LimitOptions = { key: string; limit: number; windowMs: number };

export function checkRateLimit({ key, limit, windowMs }: LimitOptions): { allowed: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, remaining: limit - 1 };
  }

  bucket.count += 1;
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  if (bucket.count > limit) return { allowed: false, retryAfter, remaining: 0 };
  return { allowed: true, retryAfter, remaining: limit - bucket.count };
}

/** Best-effort client identifier from proxy headers. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip;
}

/** Periodically drop expired buckets so the map cannot grow unbounded. */
export function pruneBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
