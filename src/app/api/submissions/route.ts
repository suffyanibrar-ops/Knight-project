import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { buildConsultationEmail, buildContactEmail, buildVisitorConfirmationEmail } from "@/lib/email";
import { queueSubmissionEmails } from "@/lib/notify";
import { findRecentDuplicate, insertSubmission, isSqliteAvailable, listSubmissions, sqliteStatus } from "@/lib/sqlite";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Embedded SQLite submissions endpoint (plain SQL, no ORM).
 *
 * POST  — validate → insert with a parameterized statement → queue the owner
 *         notification and the visitor confirmation (both sent through Resend)
 * GET   — admin-only listing (used by the admin panel / CSV export)
 */

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
  const providers = text(body.providers ?? body.providerCount, LIMITS.providers);
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
    // Duplicate guard: the original submission already queued its emails, so a
    // retry/double-click must not send a second pair.
    return NextResponse.json(
      { ok: true, id: duplicate.id, duplicate: true, message: "We already received this request. Our team will be in touch." },
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

  // Both emails are queued after the response is flushed, so the visitor never
  // waits on Resend. The row is already committed: a mail failure cannot lose
  // the enquiry, it is recorded on the submission and logged for the operator.
  const submittedAt = new Date();
  const isContact = source === "contact-form";
  const topic = specialty || "General enquiry";

  const ownerMail = isContact
    ? buildContactEmail({ name, email, phone: phone || null, topic, message: message || "(no message provided)", submittedAt })
    : buildConsultationEmail({
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
        submittedAt,
      });

  const visitorMail = buildVisitorConfirmationEmail(isContact ? "contact" : "consultation", {
    name,
    email,
    phone: phone || null,
    practice: practice || null,
    specialty: specialty || null,
    practiceSize: practiceSize || null,
    providers: providers || null,
    interests,
    topic,
    message: message || null,
    submittedAt,
  });

  queueSubmissionEmails({
    kind: isContact ? "contact" : "consultation",
    submissionId: result.id,
    owner: {
      kind: isContact ? "contact" : "consultation",
      ...ownerMail,
      to: undefined,
      replyTo: email,
      relatedType: isContact ? "contact" : "lead",
      relatedId: result.id,
    },
    visitor: {
      kind: isContact ? "contact" : "consultation",
      ...visitorMail,
      to: email,
      relatedType: isContact ? "contact" : "lead",
      relatedId: result.id,
    },
  });

  return NextResponse.json(
    { ok: true, id: result.id, message: "Your request was saved. Our team will be in touch during business hours." },
    { status: 201 },
  );
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const rows = listSubmissions({ query: query || undefined });
  return NextResponse.json({ ok: true, count: rows.length, submissions: rows }, { headers: { "Cache-Control": "no-store" } });
}
