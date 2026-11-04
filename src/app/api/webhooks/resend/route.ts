import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { updateOutboxByProviderMessageId } from "@/lib/sqlite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resend delivery webhook.
 *
 * Resend signs webhook calls with Svix. The signature is an HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` using the base64 key from the
 * `whsec_…` signing secret. We verify it before touching the database, so a
 * third party cannot forge "delivered"/"bounced" events for our messages.
 *
 * Configure the endpoint in the Resend dashboard and set RESEND_WEBHOOK_SECRET
 * in the hosting environment. Events subscribed: email.delivered,
 * email.bounced, email.complained, email.delivery_delayed, email.failed.
 *
 * Without the secret the endpoint refuses every request (503) rather than
 * accepting unauthenticated writes.
 */

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

type ResendEvent = {
  type?: string;
  data?: { email_id?: string; bounced?: { message?: string }; bounce?: { message?: string }; error?: string };
};

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifySvix(headers: Headers, rawBody: string): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return { ok: false, reason: "webhook secret not configured" };

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return { ok: false, reason: "missing signature headers" };

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return { ok: false, reason: "invalid timestamp" };
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");

  // svix-signature holds one or more space-separated "v1,<signature>" entries.
  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : part));

  if (!candidates.some((candidate) => secureEqual(candidate, expected))) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

const STATUS_BY_EVENT: Record<string, "delivered" | "bounced" | "complained" | "failed" | undefined> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifySvix(request.headers, rawBody);
  if (!verified.ok) {
    console.warn(`[resend-webhook] rejected: ${verified.reason}`);
    return NextResponse.json({ ok: false, error: verified.reason }, { status: verified.reason === "webhook secret not configured" ? 503 : 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const type = event.type ?? "";
  const messageId = event.data?.email_id;

  if (type === "email.delivery_delayed") {
    console.warn(`[resend-webhook] delivery delayed for ${messageId ?? "unknown"}`);
    return NextResponse.json({ ok: true, handled: type, updated: false });
  }

  const status = STATUS_BY_EVENT[type];
  if (!status) {
    // Other events (opened, clicked, sent) are acknowledged but ignored.
    return NextResponse.json({ ok: true, handled: type, updated: false });
  }

  if (!messageId) {
    console.warn(`[resend-webhook] ${type} without email_id`);
    return NextResponse.json({ ok: false, error: "missing email_id" }, { status: 400 });
  }

  const detail = event.data?.bounced?.message ?? event.data?.bounce?.message ?? event.data?.error ?? null;
  const updated = updateOutboxByProviderMessageId(messageId, status, detail);
  console.info(`[resend-webhook] ${type} ${messageId} -> outbox ${updated ? "updated" : "not found"}`);
  return NextResponse.json({ ok: true, handled: type, updated });
}
