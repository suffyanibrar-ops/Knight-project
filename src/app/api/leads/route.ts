import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { leads } from "@/db/schema";
import { buildConsultationEmail, buildVisitorConfirmationEmail } from "@/lib/email";
import { queueSubmissionEmails } from "@/lib/notify";
import { findRecentDuplicate, isSqliteAvailable } from "@/lib/sqlite";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";
import { isPostgresConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const limit = checkRateLimit({ key: `leads:${clientKey(request)}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Enquiry storage is not configured on this deployment. Please call (812) 994-0046 or email admin@knightmedicalbilling.com." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (name.length < 2) return NextResponse.json({ ok: false, error: "Please share your name." }, { status: 400 });
    if (!emailPattern.test(email)) return NextResponse.json({ ok: false, error: "Please share a valid email." }, { status: 400 });

    const interests = Array.isArray(body.interests) ? body.interests.map(String).slice(0, 12) : [];

    const lead = isDatabaseConfigured()
      ? (await db
      .insert(leads)
      .values({
        name: name.slice(0, 160),
        email: email.slice(0, 200),
        phone: String(body.phone ?? "").trim().slice(0, 40) || null,
        practice: String(body.practice ?? "").trim().slice(0, 200) || null,
        specialty: String(body.specialty ?? "").trim().slice(0, 120) || null,
        practiceSize: String(body.practiceSize ?? "").trim().slice(0, 80) || null,
        monthlyCollections: String(body.monthlyCollections ?? "").trim().slice(0, 80) || null,
        interests,
        message: String(body.message ?? "").trim().slice(0, 4000) || null,
        source: String(body.source ?? "schedule-form").slice(0, 120),
      })
      .returning({ id: leads.id }))[0]
      : undefined;

    // Email delivery for a website enquiry is owned by POST /api/submissions.
    // This route runs immediately after it as a Postgres mirror — or as the
    // fallback when SQLite is unavailable. Send only when the primary route did
    // not already handle this same enquiry, so the owner never gets two copies.
    const messageText = String(body.message ?? "").trim();
    const alreadyEmailed = isSqliteAvailable() && findRecentDuplicate(email, messageText || null, 5) !== null;

    if (!alreadyEmailed) {
      const submittedAt = new Date();
      const details = {
        name,
        email,
        phone: String(body.phone ?? "") || null,
        practice: String(body.practice ?? "") || null,
        specialty: String(body.specialty ?? "") || null,
        practiceSize: String(body.practiceSize ?? "") || null,
        monthlyCollections: String(body.monthlyCollections ?? "") || null,
        interests,
        message: messageText || null,
        source: String(body.source ?? "schedule-form"),
        submittedAt,
      };
      queueSubmissionEmails({
        kind: "consultation",
        owner: {
          kind: "consultation",
          ...buildConsultationEmail(details),
          replyTo: email,
          relatedType: "lead",
          relatedId: lead?.id,
        },
        visitor: {
          kind: "consultation",
          ...buildVisitorConfirmationEmail("consultation", details),
          to: email,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      id: lead?.id ?? null,
      message: "Your consultation request is in. Our team will reach out during business hours.",
    });
  } catch (error) {
    console.error("lead error", error);
    return NextResponse.json({ ok: false, error: "We could not save your request. Please try again or call us." }, { status: 500 });
  }
}
