import { cookies } from "next/headers";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request-security";
import { getAiSettings } from "@/lib/ai-config";
import { AI_PRIVACY_NOTICE, buildSystemPrompt } from "@/lib/ai-prompt";
import { ensureKnowledgeIndexed, renderKnowledgeContext, searchKnowledge } from "@/lib/ai-knowledge";
import { DEEPSEEK_MODEL, runAgentTurn, type ChatMessage } from "@/lib/ai-deepseek";
import { AI_TOOLS, executeAiTool } from "@/lib/ai-tools";
import { formatContextForPrompt, getConversationContext, inferVisitorDetails, updateConversationContext } from "@/lib/ai-context";
import {
  AI_SESSION_COOKIE,
  appendMessage,
  createConversation,
  findConversationByToken,
  issueSessionToken,
  recordUsage,
  recentMessages,
  touchConversation,
} from "@/lib/ai-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 2000;

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function cleanMessage(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s{3,}/g, "  ")
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  const headers = await request.headers;
  const ip = clientKeyFromHeaders(headers);
  const testMode = process.env.AI_TEST_MODE === "1";
  if (!testMode) {
    const ipLimit = checkRateLimit({ key: `ai-chat:ip:${ip}`, limit: 20, windowMs: 60_000 });
    if (!ipLimit.allowed) {
      return Response.json({ ok: false, error: "You're sending messages too quickly. Please wait a moment." }, { status: 429 });
    }
  }

  let body: { message?: unknown; channel?: unknown; voice?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const message = cleanMessage(body.message);
  const channel: "text" | "voice" = body.channel === "voice" || body.voice === true ? "voice" : "text";
  if (!message) {
    return Response.json({ ok: false, error: "Please type a message." }, { status: 400 });
  }

  const settings = getAiSettings();
  if (!settings.enabled) {
    return Response.json({ ok: false, error: "The AI assistant is currently offline. Please use the contact form or call us." }, { status: 503 });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json({ ok: false, error: "The AI assistant is not configured yet. Please use the contact form or call us." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const existing = findConversationByToken(cookieStore.get(AI_SESSION_COOKIE)?.value);
  const session = existing ? { conversation: existing, token: null as string | null } : createConversation(channel);
  if (!existing) {
    cookieStore.set(AI_SESSION_COOKIE, session.token!, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  const conversation = session.conversation;
  if (!testMode) {
    const conversationLimit = checkRateLimit({ key: `ai-chat:conv:${conversation.id}`, limit: 30, windowMs: 60_000 });
    if (!conversationLimit.allowed) {
      return Response.json({ ok: false, error: "This conversation is moving too fast. Please wait a moment." }, { status: 429 });
    }
  }

  touchConversation(conversation.id, channel);
  appendMessage({ conversationId: conversation.id, role: "user", content: message });

  try {
    await ensureKnowledgeIndexed();
  } catch { /* retrieval failure falls back to company facts */ }

  const history = recentMessages(conversation.id, 18).map<ChatMessage>((item) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: item.content,
  }));
  // recentMessages includes the message we just stored; avoid duplicating it.
  const last = history[history.length - 1];
  if (last && last.role === "user" && last.content === message) history.pop();

  try {
    const inferred = inferVisitorDetails([...history.filter((item) => item.role === "user").map((item) => item.content), message]);
    if (Object.keys(inferred).length) updateConversationContext(conversation.id, inferred);
  } catch { /* inference is best-effort */ }
  const hits = searchKnowledge(message, channel === "voice" ? 4 : 6);
  const conversationContext = getConversationContext(conversation.id);
  const systemPrompt = buildSystemPrompt(renderKnowledgeContext(hits), {
    channel,
    contextBlock: formatContextForPrompt(conversationContext),
  });
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }];

  const startedAt = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try { controller.enqueue(encoder.encode(sse(payload))); } catch { /* client gone */ }
      };
      send({ type: "start", conversationId: conversation.id, channel });
      let assistantText = "";
      try {
        const result = await runAgentTurn({
          messages,
          tools: AI_TOOLS,
          maxTokens: channel === "voice" ? 320 : 650,
          maxRounds: 3,
          signal: request.signal,
          executeTool: (name, args) => executeAiTool(name, args, { conversationId: conversation.id, channel }),
          onToken: (token) => {
            assistantText += token;
            send({ type: "token", text: token });
          },
          onTool: (event) => send({ type: event.phase === "start" ? "tool_start" : "tool_done", name: event.name, summary: event.summary }),
        });
        if (!assistantText.trim()) {
          assistantText = result.text.trim() || "I'm sorry, I couldn't answer that. Would you like me to arrange a human follow-up?";
          send({ type: "token", text: assistantText });
        }
        appendMessage({ conversationId: conversation.id, role: "assistant", content: assistantText });
        recordUsage({
          conversationId: conversation.id,
          model: DEEPSEEK_MODEL,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          latencyMs: Date.now() - startedAt,
          costMicros: Math.round((result.usage.promptTokens / 1_000_000) * 0.3 * 1_000_000 + (result.usage.completionTokens / 1_000_000) * 1.2 * 1_000_000),
        });
        const updated = findConversationByToken(cookieStore.get(AI_SESSION_COOKIE)?.value) ?? conversation;
        const finalContext = getConversationContext(conversation.id);
        send({
          type: "done",
          conversationId: conversation.id,
          usage: result.usage,
          toolInvocations: result.toolInvocations,
          leadId: updated.leadId,
          appointmentId: updated.appointmentId,
          handoffId: updated.handoffId,
          stage: finalContext.stage,
          scheduling: {
            timezone: finalContext.timezone,
            preferredDate: finalContext.preferredDate,
            preferredTime: finalContext.preferredTime,
          },
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const friendly = error instanceof Error && error.message.includes("timed out")
          ? "The assistant took too long to respond. Please try again, or ask for a human follow-up."
          : "The assistant is temporarily unavailable. You can try again, use the contact form, or ask me to arrange a human follow-up.";
        recordUsage({
          conversationId: conversation.id,
          model: DEEPSEEK_MODEL,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: Date.now() - startedAt,
          costMicros: 0,
          error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
        });
        send({ type: "error", message: friendly, privacyNotice: AI_PRIVACY_NOTICE });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
