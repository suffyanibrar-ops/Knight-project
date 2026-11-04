import { NextResponse } from "next/server";
import { setSubmissionEmailStatus } from "@/lib/sqlite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records the outcome of the client-side Web3Forms notification so the admin
 * panel can show whether the owner email was accepted by the provider.
 * Only the three known states are accepted.
 */
export async function POST(request: Request) {
  let body: { id?: unknown; ok?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; ok?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  setSubmissionEmailStatus(id, body.ok === true ? "sent" : "failed");
  return NextResponse.json({ ok: true });
}
