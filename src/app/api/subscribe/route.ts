import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { subscribers } from "@/db/schema";
import { buildSubscriberEmail } from "@/lib/email";
import { queueOwnerNotification } from "@/lib/notify";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const limit = checkRateLimit({ key: `subscribe:${clientKey(request)}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!emailPattern.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });

    if (isDatabaseConfigured()) {
      await db.insert(subscribers).values({ email: email.slice(0, 200) }).onConflictDoNothing();
    }
    queueOwnerNotification({ kind: "subscriber", ...buildSubscriberEmail(email), replyTo: email }, { type: "subscriber", email });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("subscribe error", error);
    return NextResponse.json({ ok: false, error: "Subscription failed. Please try again." }, { status: 500 });
  }
}
