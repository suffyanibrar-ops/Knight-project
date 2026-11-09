import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { runAutomationTick } from "@/lib/seo-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SECRET_FILE = "/home/knight/jiro/automation-secret";

function expectedSecret(): string {
  const inline = process.env.SEO_AUTOMATION_SECRET?.trim();
  if (inline) return inline;
  const file = process.env.SEO_AUTOMATION_SECRET_FILE?.trim() || DEFAULT_SECRET_FILE;
  try { return existsSync(file) ? readFileSync(file, "utf8").trim() : ""; } catch { return ""; }
}

function authorised(request: Request): Promise<boolean> | boolean {
  const supplied = request.headers.get("x-knight-automation-secret")?.trim() ?? "";
  const expected = expectedSecret();
  if (expected && supplied) {
    const a = createHmac("sha256", expected).update(supplied).digest();
    const b = createHmac("sha256", expected).update(expected).digest();
    return timingSafeEqual(a, b);
  }
  return isAdminAuthenticated();
}

export async function POST(request: Request) {
  if (!(await authorised(request))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const result = await runAutomationTick();
  return NextResponse.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  if (!(await authorised(request))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, note: "POST to run due SEO automation tasks." });
}
