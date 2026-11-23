import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { analyseContent, type CorpusItem } from "@/lib/content-originality";
import { getAdminPost, listAdminPosts } from "@/lib/blog";
import { isSameOrigin } from "@/lib/request-security";
import { checkPersistentRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deterministic originality analysis for one article.
 *
 * Server-side only: drafts never leave this process. Accepts either an existing
 * post id or an in-editor draft, and always compares against the *other* articles
 * (the article being analysed is excluded from its own corpus).
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });

  const limit = checkPersistentRateLimit({ key: `admin-originality:${clientKey(request)}`, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many analyses. Wait a minute." }, { status: 429 });

  let body: { postId?: unknown; title?: unknown; contentHtml?: unknown } = {};
  try { body = await request.json(); } catch { /* invalid JSON handled below */ }

  const postId = Number(body.postId);
  let title = typeof body.title === "string" ? body.title.slice(0, 300) : "";
  let contentHtml = typeof body.contentHtml === "string" ? body.contentHtml.slice(0, 400_000) : "";

  if (Number.isInteger(postId) && postId > 0) {
    const post = await getAdminPost(postId);
    if (!post) return NextResponse.json({ ok: false, error: "Article not found" }, { status: 404 });
    title = title || post.title;
    contentHtml = contentHtml || post.contentHtml;
  }
  if (!contentHtml.trim()) return NextResponse.json({ ok: false, error: "Nothing to analyse." }, { status: 400 });

  // Summaries omit body copy, so fetch each candidate's full record. Bounded to
  // keep the analysis cheap; the newest 40 articles are the realistic duplicate
  // risk for an active blog.
  const { posts } = await listAdminPosts({ perPage: 40 });
  const corpus: CorpusItem[] = [];
  for (const summary of posts) {
    if (summary.id === postId) continue;
    const full = await getAdminPost(summary.id);
    if (full) corpus.push({ id: full.id, title: full.title, contentHtml: full.contentHtml });
  }

  return NextResponse.json(
    { ok: true, result: analyseContent({ title, contentHtml, corpus }) },
    { headers: { "cache-control": "no-store" } },
  );
}
