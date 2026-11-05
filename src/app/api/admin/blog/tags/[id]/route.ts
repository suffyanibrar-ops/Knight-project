import { NextResponse } from "next/server";
import { deleteTag } from "@/lib/blog";
import { failure, limitAdmin, requireAdmin, toId } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("taxonomy-write", 60);
  if (limited) return limited;
  try {
    await deleteTag(toId((await context.params).id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
