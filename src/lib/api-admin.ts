import "server-only";
import { headers } from "next/headers";
import { isAdminAuthenticated } from "./auth";
import { checkPersistentRateLimit, clientKeyFromHeaders } from "./rate-limit";
import { isSameOrigin } from "./request-security";

/** Shared guard for every /api/admin/blog/* handler. */
export async function requireAdmin(request: Request): Promise<Response | null> {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method !== "GET" && request.method !== "HEAD" && !isSameOrigin(request)) {
    return Response.json({ ok: false, error: "Cross-origin writes are not allowed." }, { status: 403 });
  }
  return null;
}

/** Per-IP rate limit for an admin blog endpoint. */
export async function limitAdmin(bucket: string, limit = 120, windowMs = 60_000): Promise<Response | null> {
  const requestHeaders = await headers();
  const key = `admin-blog:${bucket}:${clientKeyFromHeaders(requestHeaders)}`;
  const result = checkPersistentRateLimit({ key, limit, windowMs });
  if (result.allowed) return null;
  return Response.json({ ok: false, error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(result.retryAfter) } });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad body");
    return body as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

export function toId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id.");
  return id;
}

export function str(value: unknown, max = 1000): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

export function nullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}

export function failure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return Response.json({ ok: false, error: message }, { status: 400 });
}
