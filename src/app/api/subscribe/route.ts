import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { subscribers } from "@/db/schema";
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

    // SQLite is the primary store: it is required for the site to run, so a
    // subscription is never accepted without being written somewhere. Postgres
    // is an optional mirror and its failure must not lose the opt-in.
    const local = insertSubscriber({ email: stored });

    let mirrored = false;
    if (isDatabaseConfigured()) {
      try {
        await db.insert(subscribers).values({ email: stored }).onConflictDoNothing();
        mirrored = true;
      } catch (error) {
        console.error("[subscribe] Postgres mirror failed", error);
      }
    }

    if (!local.ok && !mirrored) {
      // Nothing accepted the write — say so instead of reporting a false success.
      console.error("[subscribe] no store accepted the subscription", { sqlite: local.error });
      return NextResponse.json(
        { ok: false, error: "We could not save your subscription right now. Please try again or email us directly." },
        { status: 503 },
      );
    }

    queueOwnerNotification(
      { kind: "subscriber", ...buildSubscriberEmail(email), replyTo: email, relatedType: "subscriber", relatedId: local.id },
      { type: "subscriber", email },
    );

    return NextResponse.json({ ok: true, stored: local.ok ? "sqlite" : "postgres" });
  } catch (error) {
    console.error("subscribe error", error);
    return NextResponse.json({ ok: false, error: "Subscription failed. Please try again." }, { status: 500 });
  }
}
