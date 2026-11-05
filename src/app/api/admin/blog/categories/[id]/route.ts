import { NextResponse } from "next/server";
import { deleteCategory, updateCategory } from "@/lib/blog";
import { failure, limitAdmin, readJson, requireAdmin, str, toId } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("taxonomy-write", 60);
  if (limited) return limited;
  try {
    const id = toId((await context.params).id);
    const body = await readJson(request);
    const name = str(body.name, 120);
    if (!name) throw new Error("A category name is required.");
    await updateCategory(id, { name, slug: str(body.slug, 120) ?? undefined, description: str(body.description, 400) });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    await deleteCategory(toId((await context.params).id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
