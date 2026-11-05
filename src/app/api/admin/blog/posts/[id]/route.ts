import { NextResponse } from "next/server";
import { deletePostForever, getAdminPost, setPostStatus, trashPost, updatePost, type BlogStatus, BLOG_STATUSES } from "@/lib/blog";
import { failure, limitAdmin, nullableDate, readJson, requireAdmin, str, toId } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(request: Request, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const id = toId((await params).id);
    const post = await getAdminPost(id);
    if (!post) return NextResponse.json({ ok: false, error: "Post not found." }, { status: 404 });
    return NextResponse.json({ ok: true, post });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("posts-write", 60);
  if (limited) return limited;
  try {
    const id = toId((await params).id);
    const current = await getAdminPost(id);
    if (!current) return NextResponse.json({ ok: false, error: "Post not found." }, { status: 404 });
    const body = await readJson(request);

    const statusValue = String(body.status ?? current.status);
    const status = (BLOG_STATUSES as readonly string[]).includes(statusValue) ? (statusValue as BlogStatus) : current.status;
    const scheduledFor = body.scheduledFor === undefined ? current.scheduledFor : nullableDate(body.scheduledFor);
    const categoryId = optionalNumber(body.categoryId);
    const featuredMediaId = optionalNumber(body.featuredMediaId);

    await updatePost(id, {
      title: str(body.title, 240) ?? current.title,
      slug: str(body.slug, 120) ?? current.slug,
      excerpt: body.excerpt === undefined ? current.excerpt : str(body.excerpt, 600),
      contentHtml: typeof body.contentHtml === "string" ? body.contentHtml : current.contentHtml,
      featuredImage: body.featuredImage === undefined ? current.featuredImage : str(body.featuredImage, 600),
      featuredImageAlt: body.featuredImageAlt === undefined ? current.featuredImageAlt : str(body.featuredImageAlt, 300),
      featuredImageWidth: body.featuredImageWidth === undefined ? current.featuredImageWidth : optionalNumber(body.featuredImageWidth),
      featuredImageHeight: body.featuredImageHeight === undefined ? current.featuredImageHeight : optionalNumber(body.featuredImageHeight),
      featuredMediaId: featuredMediaId === undefined ? current.media?.id ?? null : featuredMediaId,
      author: str(body.author, 120) ?? current.author,
      categoryId: categoryId === undefined ? current.category?.id ?? null : categoryId,
      tagIds: body.tagIds === undefined ? current.tags.map((tag) => tag.id) : Array.isArray(body.tagIds) ? body.tagIds.map((v) => toId(v)) : [],
      status,
      scheduledFor,
      seoTitle: body.seoTitle === undefined ? current.seoTitle : str(body.seoTitle, 70),
      seoDescription: body.seoDescription === undefined ? current.seoDescription : str(body.seoDescription, 200),
      canonicalUrl: body.canonicalUrl === undefined ? current.canonicalUrl : str(body.canonicalUrl, 400),
      socialImage: body.socialImage === undefined ? current.socialImage : str(body.socialImage, 600),
      sourceNotes: body.sourceNotes === undefined ? current.sourceNotes : str(body.sourceNotes, 4000),
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("posts-write", 60);
  if (limited) return limited;
  try {
    const id = toId((await params).id);
    const url = new URL(request.url);
    if (url.searchParams.get("permanent") === "1") {
      await deletePostForever(id);
      return NextResponse.json({ ok: true, permanent: true });
    }
    await trashPost(id);
    return NextResponse.json({ ok: true, trashed: true });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const id = toId((await params).id);
    const body = await readJson(request);
    const status = String(body.status ?? "");
    if (!(BLOG_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status.");
    await setPostStatus(id, status as BlogStatus, nullableDate(body.scheduledFor));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return failure(error);
  }
}
