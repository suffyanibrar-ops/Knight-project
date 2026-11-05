import { NextResponse } from "next/server";
import { publicAiConfig } from "@/lib/ai-config";
import { AI_PRIVACY_NOTICE } from "@/lib/ai-prompt";
import { knowledgeStatus } from "@/lib/ai-knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public bootstrap config for the chat widget (never includes secrets or instructions). */
export async function GET() {
  const config = publicAiConfig();
  return NextResponse.json(
    { ok: true, ...config, privacyNotice: AI_PRIVACY_NOTICE, knowledgeReady: knowledgeStatus().sources > 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
