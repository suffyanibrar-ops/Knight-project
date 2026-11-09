import "server-only";

/**
 * Minimal, server-only DeepSeek client.
 *
 * - Chat Completions endpoint (https://api.deepseek.com/chat/completions)
 * - `deepseek-flash` with thinking mode DISABLED for conversational latency
 * - true SSE streaming, tool calls, usage accounting
 * - the API key never leaves the server and is never logged
 */

const BASE_URL = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
const REQUEST_TIMEOUT_MS = 60_000;

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

export interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ParsedToolCall { id: string; name: string; arguments: string }

export interface ChatResult {
  content: string;
  toolCalls: ParsedToolCall[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: string | null;
}

export class DeepSeekError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "DeepSeekError";
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new DeepSeekError("The AI agent is not configured (missing DeepSeek API key).", 0);
  return key;
}

interface StreamOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  /** Ask DeepSeek for a JSON object response (Content Studio structured stages). */
  jsonMode?: boolean;
}

/** One streamed completion. Returns accumulated text, tool calls and usage. */
export async function streamCompletion(options: StreamOptions): Promise<ChatResult> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const body: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages: options.messages,
    stream: true,
    stream_options: { include_usage: true },
    thinking: { type: "disabled" },
    temperature: options.temperature ?? 0.4,
    max_tokens: Math.max(64, Math.min(2000, options.maxTokens ?? 700)),
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }
  if (options.jsonMode) body.response_format = { type: "json_object" };

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError" || (error as Error)?.name === "TimeoutError") throw new DeepSeekError("The AI request timed out. Please try again.", 504);
    throw new DeepSeekError("The AI service could not be reached. Please try again.", 502);
  }

  if (!response.ok || !response.body) {
    let detail = "";
    try { detail = (await response.text()).slice(0, 300); } catch { /* ignore */ }
    throw new DeepSeekError(`The AI service returned an error (${response.status}).`, response.status || 502);
    // note: `detail` intentionally not surfaced to visitors
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | null = null;
  const toolCalls: { id: string; name: string; arguments: string }[] = [];
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const handleChunk = (payload: string) => {
    if (!payload || payload === "[DONE]") return;
    let json: Record<string, unknown>;
    try { json = JSON.parse(payload) as Record<string, unknown>; } catch { return; }
    const choices = Array.isArray(json.choices) ? (json.choices as Record<string, unknown>[]) : [];
    const choice = choices[0];
    if (choice) {
      const delta = (choice.delta ?? {}) as Record<string, unknown>;
      const text = typeof delta.content === "string" ? delta.content : "";
      if (text) {
        content += text;
        options.onToken?.(text);
      }
      if (typeof choice.finish_reason === "string" && choice.finish_reason) finishReason = choice.finish_reason;
      const deltas = Array.isArray(delta.tool_calls) ? (delta.tool_calls as Record<string, unknown>[]) : [];
      for (const call of deltas) {
        const index = Number(call.index ?? 0);
        const fn = (call.function ?? {}) as Record<string, unknown>;
        if (!toolCalls[index]) toolCalls[index] = { id: typeof call.id === "string" ? call.id : "", name: "", arguments: "" };
        if (typeof call.id === "string" && call.id) toolCalls[index].id = call.id;
        if (typeof fn.name === "string" && fn.name) toolCalls[index].name += fn.name;
        if (typeof fn.arguments === "string") toolCalls[index].arguments += fn.arguments;
      }
    }
    const rawUsage = json.usage as Record<string, unknown> | undefined;
    if (rawUsage) {
      usage.promptTokens = Number(rawUsage.prompt_tokens ?? usage.promptTokens);
      usage.completionTokens = Number(rawUsage.completion_tokens ?? usage.completionTokens);
      usage.totalTokens = Number(rawUsage.total_tokens ?? usage.totalTokens);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        handleChunk(trimmed.slice(5).trim());
      }
    }
    if (buffer.trim().startsWith("data:")) handleChunk(buffer.trim().slice(5).trim());
  } finally {
    reader.releaseLock();
  }

  return {
    content,
    toolCalls: toolCalls.filter((call) => call.name),
    usage,
    finishReason,
  };
}

/** Rough cost estimate in micro-dollars using DeepSeek Flash peak pricing. */
export function estimateCostMicros(promptTokens: number, completionTokens: number): number {
  const inputPricePerMillion = 0.3;
  const outputPricePerMillion = 1.2;
  const usd = (promptTokens / 1_000_000) * inputPricePerMillion + (completionTokens / 1_000_000) * outputPricePerMillion;
  return Math.round(usd * 1_000_000);
}

export interface AgentRunResult {
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  rounds: number;
  toolInvocations: { name: string; ok: boolean; summary: string }[];
}

/**
 * Run a full tool-calling conversation turn: stream, execute requested tools,
 * append results and continue until the model produces a final answer.
 */
export async function runAgentTurn(input: {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  executeTool: (name: string, args: string) => Promise<{ ok: boolean; content: string; summary: string }>;
  onToken: (token: string) => void;
  onTool?: (event: { name: string; phase: "start" | "done"; summary?: string }) => void;
  signal?: AbortSignal;
  maxRounds?: number;
  maxTokens?: number;
}): Promise<AgentRunResult> {
  const messages = [...input.messages];
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const toolInvocations: AgentRunResult["toolInvocations"] = [];
  const maxRounds = Math.max(1, Math.min(4, input.maxRounds ?? 3));
  let finalText = "";

  for (let round = 1; round <= maxRounds; round += 1) {
    const result = await streamCompletion({
      messages,
      tools: input.tools,
      temperature: 0.4,
      maxTokens: input.maxTokens ?? 700,
      signal: input.signal,
      onToken: input.onToken,
    });
    usage.promptTokens += result.usage.promptTokens;
    usage.completionTokens += result.usage.completionTokens;
    usage.totalTokens += result.usage.totalTokens;
    if (result.content) finalText = result.content;

    if (!result.toolCalls.length) {
      return { text: finalText, usage, rounds: round, toolInvocations };
    }

    messages.push({
      role: "assistant",
      content: result.content ?? "",
      tool_calls: result.toolCalls.map((call) => ({
        id: call.id || `call_${round}_${Math.random().toString(36).slice(2)}`,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments || "{}" },
      })),
    });

    for (const call of result.toolCalls) {
      const id = call.id || `call_${round}_${Math.random().toString(36).slice(2)}`;
      input.onTool?.({ name: call.name, phase: "start" });
      let executed: { ok: boolean; content: string; summary: string };
      try {
        executed = await input.executeTool(call.name, call.arguments || "{}");
      } catch (error) {
        executed = { ok: false, content: JSON.stringify({ ok: false, error: "That action could not be completed." }), summary: "failed" };
      }
      messages.push({ role: "tool", tool_call_id: id, content: executed.content });
      toolInvocations.push({ name: call.name, ok: executed.ok, summary: executed.summary });
      input.onTool?.({ name: call.name, phase: "done", summary: executed.summary });
    }
  }

  return { text: finalText || "I'm sorry, I couldn't complete that request. Would you like me to arrange a human follow-up?", usage, rounds: maxRounds, toolInvocations };
}
