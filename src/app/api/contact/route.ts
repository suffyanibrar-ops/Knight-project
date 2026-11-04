import { NextResponse } from "next/server";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { buildContactEmail, buildVisitorConfirmationEmail } from "@/lib/email";
import { queueSubmissionEmails } from "@/lib/notify";
import { findRecentDuplicate, isSqliteAvailable } from "@/lib/sqlite";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const limit = checkRateLimit({ key: `contact:${clientKey(request)}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many messages. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const message = String(body.message ?? "").trim();

    if (name.length < 2) return NextResponse.json({ ok: false, error: "Please share your name." }, { status: 400 });
    if (!emailPattern.test(email)) return NextResponse.json({ ok: false, error: "Please share a valid email." }, { status: 400 });
    if (message.length < 5) return NextResponse.json({ ok: false, error: "Tell us a little about what you need." }, { status: 400 });

    // Single embedded store: the CRM message lives in SQLite alongside the
    // submission row written by POST /api/submissions. No external database.
    const row = (
      await db
        .insert(contactMessages)
        .values({
          name: name.slice(0, 160),
          email: email.slice(0, 200),
          phone: String(body.phone ?? "").trim().slice(0, 40) || null,
          topic: String(body.topic ?? "General").slice(0, 120),
          message: message.slice(0, 5000),
          status: "new",
          emailStatus: "pending",
        })
        .returning({ id: contactMessages.id })
    )[0];

    // Email delivery for a website message is owned by POST /api/submissions
    // (the route the contact form calls first). This route records the CRM
    // message, so only send when the primary route did not already handle it.
    const alreadyEmailed = isSqliteAvailable() && findRecentDuplicate(email, message, 5) !== null;

    if (!alreadyEmailed) {
      const submittedAt = new Date();
      const details = {
        name,
        email,
        phone: String(body.phone ?? "") || null,
        topic: String(body.topic ?? "") || null,
        message,
        submittedAt,
      };
      queueSubmissionEmails({
        kind: "contact",
        owner: {
          kind: "contact",
          ...buildContactEmail(details),
          replyTo: email,
          relatedType: "contact",
          relatedId: row?.id,
        },
        visitor: {
          kind: "contact",
          ...buildVisitorConfirmationEmail("contact", details),
          to: email,
        },
      });
    }

    return NextResponse.json({ ok: true, message: "Message received. We reply within one business hour, Monday–Friday." });
  } catch (error) {
    console.error("contact error", error);
    return NextResponse.json({ ok: false, error: "We could not send your message. Try again or email admin@knightmedicalbilling.com." }, { status: 500 });
  }
}
