import { NextResponse } from "next/server";
import { createPost, listAdminPosts, type BlogSort, type BlogStatus, BLOG_STATUSES } from "@/lib/blog";
import { failure, limitAdmin, readJson, requireAdmin, str, toId } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("posts-list");
  if (limited) return limited;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "all";
  const status = statusParam === "all" || (BLOG_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as BlogStatus | "all") : "all";
  const sortParam = url.searchParams.get("sort") ?? "newest";
  const sort: BlogSort = sortParam === "oldest" || sortParam === "updated" ? sortParam : "newest";
  const result = await listAdminPosts({
    q: url.searchParams.get("q") ?? undefined,
    status,
    categoryId: optionalNumber(url.searchParams.get("category")),
    sort,
    page: optionalNumber(url.searchParams.get("page")) ?? 1,
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("posts-write", 60);
  if (limited) return limited;
  try {
    const body = await readJson(request);
    const title = str(body.title, 240);
    if (!title) throw new Error("A title is required.");
    const scheduledFor = body.scheduledFor ? new Date(String(body.scheduledFor)) : null;
    const id = await createPost({
      title,
      slug: str(body.slug, 120) ?? undefined,
      excerpt: str(body.excerpt, 600),
      contentHtml: typeof body.contentHtml === "string" ? body.contentHtml : "",
      featuredImage: str(body.featuredImage, 600),
      featuredImageAlt: str(body.featuredImageAlt, 300),
      featuredImageWidth: optionalNumber(body.featuredImageWidth) ?? null,
      featuredImageHeight: optionalNumber(body.featuredImageHeight) ?? null,
      featuredMediaId: optionalNumber(body.featuredMediaId) ?? null,
      author: str(body.author, 120) ?? undefined,
      categoryId: optionalNumber(body.categoryId) ?? null,
      tagIds: Array.isArray(body.tagIds) ? (body.tagIds as unknown[]).map((v) => toId(v)).filter(Boolean) : [],
      status: (BLOG_STATUSES as readonly string[]).includes(String(body.status)) ? (body.status as BlogStatus) : "draft",
      scheduledFor,
      seoTitle: str(body.seoTitle, 70),
      seoDescription: str(body.seoDescription, 200),
      canonicalUrl: str(body.canonicalUrl, 400),
      socialImage: str(body.socialImage, 600),
      sourceNotes: str(body.sourceNotes, 4000),
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
