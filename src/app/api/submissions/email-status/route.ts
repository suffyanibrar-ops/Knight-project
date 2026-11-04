import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/admin-session";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";
import { setSubmissionEmailStatus } from "@/lib/sqlite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Records the outcome of the client-side Web3Forms notification so the admin
 * panel can show whether the owner email was accepted by the provider.
 *
 * This is called by the PUBLIC form (visitor, not admin), so an admin session
 * cannot be required. Instead it requires the id-bound HMAC capability token
 * issued by POST /api/submissions when the submission was created. The token
 * proves possession, is bound to one submission id, and is domain-separated
 * from admin session tokens — so an unauthenticated caller cannot rewrite the
 * email status of somebody else's submission. Cross-origin writes are also
 * rejected and the endpoint is rate limited like its sibling public routes.
 *
 * Only the two known states are accepted.
 */
const EMAIL_STATUS_TOKEN_DOMAIN = "submission-email-status.v1";

/** Must match the signer in src/app/api/submissions/route.ts. */
function hasValidToken(id: number, token: unknown): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/i.test(token)) return false;
  const expected = createHmac("sha256", sessionSecret()).update(`${EMAIL_STATUS_TOKEN_DOMAIN}:${id}`).digest();
  const actual = Buffer.from(token, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const limit = checkRateLimit({ key: `email-status:${clientKey(request)}`, limit: 20, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  let body: { id?: unknown; ok?: unknown; token?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; ok?: unknown; token?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  if (!hasValidToken(id, body.token)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing token" }, { status: 401 });
  }

  setSubmissionEmailStatus(id, body.ok === true ? "sent" : "failed");
  return NextResponse.json({ ok: true });
}
