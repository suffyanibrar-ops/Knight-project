import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import { roiEstimates } from "@/db/schema";
import { buildRoiEmail } from "@/lib/email";
import { queueOwnerNotification } from "@/lib/notify";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";
import { insertRoiEstimate } from "@/lib/sqlite";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const limit = checkRateLimit({ key: `roi:${clientKey(request)}`, limit: 10, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many estimates. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const monthlyCollections = Number(body.monthlyCollections);
    const denialRate = Number(body.denialRate);
    const daysInAr = Number(body.daysInAr);
    const estimatedAnnualUplift = Number(body.estimatedAnnualUplift);
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!Number.isFinite(monthlyCollections) || monthlyCollections < 0) {
      return NextResponse.json({ ok: false, error: "Invalid collections value." }, { status: 400 });
    }

    const values = {
      email: email.includes("@") ? email.slice(0, 200) : null,
      monthlyCollections: Math.round(monthlyCollections),
      denialRate: Number.isFinite(denialRate) ? Math.round(denialRate) : 0,
      daysInAr: Number.isFinite(daysInAr) ? Math.round(daysInAr) : 0,
      estimatedAnnualUplift: Number.isFinite(estimatedAnnualUplift) ? Math.round(estimatedAnnualUplift) : 0,
    };

    // SQLite is the primary store, so an estimate is never reported as saved
    // unless a store actually accepted it. Postgres is an optional mirror.
    const local = insertRoiEstimate(values);

    let mirrored: { id?: number } | undefined;
    if (isDatabaseConfigured()) {
      try {
        mirrored = (await db.insert(roiEstimates).values(values).returning({ id: roiEstimates.id }))[0];
      } catch (error) {
        console.error("[roi] Postgres mirror failed", error);
      }
    }

    if (!local.ok && mirrored === undefined) {
      console.error("[roi] no store accepted the estimate", { sqlite: local.error });
      return NextResponse.json(
        { ok: false, error: "We could not save your estimate right now. Please try again or email us directly." },
        { status: 503 },
      );
    }

    const storedId = local.id ?? mirrored?.id;

    queueOwnerNotification(
      { kind: "roi", ...buildRoiEmail(values), replyTo: values.email ?? undefined, relatedType: "roi", relatedId: storedId },
      { type: "roi", id: storedId },
    );

    return NextResponse.json({ ok: true, id: storedId, stored: local.ok ? "sqlite" : "postgres" });
  } catch (error) {
    console.error("roi error", error);
    return NextResponse.json({ ok: false, error: "Could not save estimate." }, { status: 500 });
  }
}
