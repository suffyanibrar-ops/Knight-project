import { NextResponse } from "next/server";
import { buildSubscriberEmail } from "@/lib/email";
import { queueOwnerNotification } from "@/lib/notify";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";
import { insertSubscriber } from "@/lib/sqlite";

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

    const stored = email.slice(0, 200);

    // SQLite is the single store: a subscription is never reported as saved
    // unless the write succeeded.
    const local = insertSubscriber({ email: stored });

    if (!local.ok) {
      console.error("[subscribe] SQLite rejected the subscription", { sqlite: local.error });
      return NextResponse.json(
        { ok: false, error: "We could not save your subscription right now. Please try again or email us directly." },
        { status: 503 },
      );
    }

    queueOwnerNotification(
      { kind: "subscriber", ...buildSubscriberEmail(email), replyTo: email, relatedType: "subscriber", relatedId: local.id },
      { type: "subscriber", email },
    );

    return NextResponse.json({ ok: true, stored: "sqlite" });
  } catch (error) {
    console.error("subscribe error", error);
    return NextResponse.json({ ok: false, error: "Subscription failed. Please try again." }, { status: 500 });
  }
}
