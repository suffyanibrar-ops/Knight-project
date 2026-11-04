import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { contactMessages } from "@/db/schema";
import { buildContactEmail } from "@/lib/email";
import { queueOwnerNotification } from "@/lib/notify";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";
import { isPostgresConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const limit = checkRateLimit({ key: `contact:${clientKey(request)}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many messages. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Message storage is not configured on this deployment. Please email admin@knightmedicalbilling.com." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const message = String(body.message ?? "").trim();

    if (name.length < 2) return NextResponse.json({ ok: false, error: "Please share your name." }, { status: 400 });
    if (!emailPattern.test(email)) return NextResponse.json({ ok: false, error: "Please share a valid email." }, { status: 400 });
    if (message.length < 5) return NextResponse.json({ ok: false, error: "Tell us a little about what you need." }, { status: 400 });

    const row = isDatabaseConfigured()
      ? (await db
      .insert(contactMessages)
      .values({
        name: name.slice(0, 160),
        email: email.slice(0, 200),
        phone: String(body.phone ?? "").trim().slice(0, 40) || null,
        topic: String(body.topic ?? "General").slice(0, 120),
        message: message.slice(0, 5000),
      })
      .returning({ id: contactMessages.id }))[0]
      : undefined;

    queueOwnerNotification(
      {
        kind: "contact",
        ...buildContactEmail({ name, email, phone: String(body.phone ?? "") || null, topic: String(body.topic ?? "") || null, message }),
        replyTo: email,
        relatedType: "contact",
        relatedId: row?.id,
      },
      { type: "contact", id: row?.id },
    );

    return NextResponse.json({ ok: true, message: "Message received. We reply within one business hour, Monday–Friday." });
  } catch (error) {
    console.error("contact error", error);
    return NextResponse.json({ ok: false, error: "We could not send your message. Try again or email admin@knightmedicalbilling.com." }, { status: 500 });
  }
}
