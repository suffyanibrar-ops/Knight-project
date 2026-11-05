import { NextResponse } from "next/server";
import { countDueScheduled, publishDuePosts } from "@/lib/blog";
import { limitAdmin, requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Promote every scheduled post whose time has arrived. */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("publish-due", 30);
  if (limited) return limited;
  const before = await countDueScheduled();
  const published = await publishDuePosts();
  return NextResponse.json({ ok: true, due: before, published });
}
