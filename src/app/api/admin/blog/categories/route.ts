import { NextResponse } from "next/server";
import { createCategory, listAdminCategories } from "@/lib/blog";
import { failure, limitAdmin, readJson, requireAdmin, str } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true, categories: await listAdminCategories() });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("taxonomy-write", 60);
  if (limited) return limited;
  try {
    const body = await readJson(request);
    const name = str(body.name, 120);
    if (!name) throw new Error("A category name is required.");
    const id = await createCategory({ name, slug: str(body.slug, 120) ?? undefined, description: str(body.description, 400) });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
