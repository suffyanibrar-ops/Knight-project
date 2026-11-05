import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHandoff, findConversationByToken, notifyHandoff, AI_SESSION_COOKIE } from "@/lib/ai-session";
import { isSameOrigin } from "@/lib/request-security";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  const headers = await request.headers;
  const limit = checkRateLimit({ key: `ai-handoff:${clientKeyFromHeaders(headers)}`, limit: 5, windowMs: 10 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests. Please try again shortly." }, { status: 429 });
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* optional body */ }
  const cookieStore = await cookies();
  const conversation = findConversationByToken(cookieStore.get(AI_SESSION_COOKIE)?.value);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : null;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : null;
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : null;
  const reason = (typeof body.reason === "string" && body.reason.trim()) || "Visitor requested a human representative from the chat widget.";
  try {
    if (!conversation) return NextResponse.json({ ok: false, error: "Start a conversation before requesting a human." }, { status: 400 });
    const id = createHandoff({ conversationId: conversation.id, reason, name, email, phone });
    const notified = await notifyHandoff({ id, reason, name, email, phone });
    return NextResponse.json({ ok: true, handoffId: id, notified }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create the request." }, { status: 500 });
  }
}
