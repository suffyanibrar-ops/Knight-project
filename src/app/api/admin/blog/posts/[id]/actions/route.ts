import { NextResponse } from "next/server";
import { duplicatePost, restorePost, setPostStatus, trashPost } from "@/lib/blog";
import { failure, limitAdmin, nullableDate, readJson, requireAdmin, toId } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("posts-actions", 60);
  if (limited) return limited;
  try {
    const id = toId((await context.params).id);
    const body = await readJson(request);
    const action = String(body.action ?? "");
    if (action === "publish") await setPostStatus(id, "published");
    else if (action === "unpublish") await setPostStatus(id, "unpublished");
    else if (action === "schedule") await setPostStatus(id, "scheduled", nullableDate(body.scheduledFor));
    else if (action === "restore") await restorePost(id);
    else if (action === "trash") await trashPost(id);
    else if (action === "duplicate") {
      const newId = await duplicatePost(id);
      return NextResponse.json({ ok: true, id: newId });
    } else throw new Error("Unknown action.");
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return failure(error);
  }
}
