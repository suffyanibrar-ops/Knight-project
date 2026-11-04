import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/admin-session";
import { isAdminAuthenticated } from "@/lib/auth";
import { findRecentDuplicate, insertSubmission, isSqliteAvailable, listSubmissions, sqliteStatus } from "@/lib/sqlite";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Embedded SQLite submissions endpoint (plain SQL, no ORM).
 *
 * POST  — validate → insert with a parameterized statement
 * GET   — admin-only listing (used by the admin panel / CSV export)
 */

/**
 * Capability token for the public email-status callback
 * (src/app/api/submissions/email-status/route.ts).
 *
 * The callback runs in the visitor's browser, so it cannot require an admin
 * session — but without proof of possession it would let anyone rewrite the
 * email status of an arbitrary submission id. The token is an HMAC bound to
 * exactly one submission id and domain-separated from admin session tokens, so
 * it is useless for any other id (or for signing in). Keep the domain string
 * in sync with the verifier in the callback route.
 */
const EMAIL_STATUS_TOKEN_DOMAIN = "submission-email-status.v1";

function emailStatusToken(id: number): string {
  return createHmac("sha256", sessionSecret()).update(`${EMAIL_STATUS_TOKEN_DOMAIN}:${id}`).digest("hex");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const LIMITS = {
  name: 120,
  email: 200,
  phone: 40,
  practice: 200,
  specialty: 120,
  practiceSize: 80,
  providers: 80,
  interest: 120,
  interests: 12,
  message: 4000,
  source: 120,
} as const;

function text(value: unknown, max: number): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

export async function POST(request: Request) {
  // 1. Cross-origin writes are rejected.
  if (!isSameOrigin(request)) return forbiddenResponse();

  // 2. Throttle: 5 submissions per 10 minutes per IP.
  const limit = checkRateLimit({ key: `submissions:${clientKey(request)}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions from this connection. Please try again shortly or call (812) 994-0046." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  if (!isSqliteAvailable()) {
    const status = sqliteStatus();
    console.error("[submissions] SQLite unavailable:", status.error);
    return NextResponse.json(
      { ok: false, error: "The local database is not writable on this host. Please call (812) 994-0046 or email admin@knightmedicalbilling.com." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const name = text(body.name, LIMITS.name);
  const email = text(body.email, LIMITS.email).toLowerCase();
  const phone = text(body.phone, LIMITS.phone);
  const practice = text(body.practice ?? body.facility, LIMITS.practice);
  const specialty = text(body.specialty, LIMITS.specialty);
  const practiceSize = text(body.practiceSize ?? body.facilityType, LIMITS.practiceSize);
  const providers = text(body.providers ?? body.providerCount ?? body.monthlyCollections, LIMITS.providers);
  const message = text(body.message, LIMITS.message);
  const source = text(body.source, LIMITS.source) || "schedule-form";

  const rawInterests = Array.isArray(body.interests) ? body.interests : [];
  const interests = rawInterests
    .slice(0, LIMITS.interests)
    .map((item) => text(item, LIMITS.interest))
    .filter(Boolean);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please enter your name (at least 2 characters).";
  if (!EMAIL_PATTERN.test(email)) errors.email = "Please enter a valid email address.";
  if (specialty.length === 0 && Array.isArray(body.interests) && body.interests.length === 0) {
    // Specialty is required on the consultation form but optional on generic forms.
    if (practice.length > 0) errors.specialty = "Please choose a specialty.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, error: Object.values(errors)[0], errors }, { status: 400 });
  }

  // 3. Duplicate protection — same email + same message within 10 minutes.
  const duplicate = findRecentDuplicate(email, message || null);
  if (duplicate) {
    return NextResponse.json(
      { ok: true, id: duplicate.id, token: emailStatusToken(duplicate.id), duplicate: true, message: "We already received this request. Our team will be in touch." },
      { status: 200 },
    );
  }

  const result = insertSubmission({
    name,
    email,
    phone: phone || null,
    practice: practice || null,
    specialty: specialty || null,
    practiceSize: practiceSize || null,
    providers: providers || null,
    interests,
    message: message || null,
    source,
  });

  if (!result.ok || result.id === undefined) {
    return NextResponse.json({ ok: false, error: result.error ?? "Could not save your submission." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.id, token: emailStatusToken(result.id), message: "Your submission was saved." }, { status: 201 });
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const rows = listSubmissions({ query: query || undefined });
  return NextResponse.json({ ok: true, count: rows.length, submissions: rows }, { headers: { "Cache-Control": "no-store" } });
}
