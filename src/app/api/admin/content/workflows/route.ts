import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated, logAdminAction } from "@/lib/auth";
import { checkPersistentRateLimit } from "@/lib/rate-limit";
import { clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";
import { getAdminPost } from "@/lib/blog";
import { generateContentDraft, generateContentResearch, generateEditorialReview } from "@/lib/content-ai";
import { fetchLiveSearch, fetchSearchConsoleMetrics } from "@/lib/search-research";
import {
  approveContentWorkflow,
  createContentWorkflow,
  createDraftFromWorkflow,
  existingArticleContext,
  getContentWorkflow,
  listContentWorkflows,
  normalizeGeneratedHtml,
  publishApprovedWorkflow,
  runLocalSeoChecks,
  scheduleApprovedWorkflow,
  updateContentWorkflow,
  validateInternalLinks,
  type WorkflowData,
  type WorkflowSource,
} from "@/lib/content-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sourcesFrom(value: unknown): WorkflowSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim().slice(0, 200) : "";
    const url = typeof row.url === "string" ? row.url.trim().slice(0, 500) : "";
    if (!title || !/^https?:\/\//i.test(url)) return [];
    return [{ title, url, note: typeof row.note === "string" ? row.note.trim().slice(0, 400) : undefined }];
  }).slice(0, 8);
}

function workflowData(view: NonNullable<Awaited<ReturnType<typeof getContentWorkflow>>>): WorkflowData {
  return { ...view.data, blogPostId: view.blogPostId ?? view.data.blogPostId };
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, workflows: await listContentWorkflows(50) });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return forbiddenResponse();
  const limit = checkPersistentRateLimit({ key: `admin-content:${clientKey(request)}`, limit: 12, windowMs: 60_000 });
  if (!limit.allowed) return bad("Too many editorial operations. Wait a minute and try again.", 429);

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return bad("Invalid request."); }
  const action = String(body.action ?? "");

  try {
    if (action === "research") {
      const topic = String(body.topic ?? "").trim().slice(0, 220);
      if (topic.length < 8) return bad("Enter a more specific topic (at least 8 characters).");
      const audience = String(body.audience ?? "").trim().slice(0, 300) || undefined;
      const editorNotes = String(body.editorNotes ?? "").trim().slice(0, 4000);
      const providedSources = sourcesFrom(body.sources);
      const existing = await existingArticleContext();
      const [liveSearch, searchConsole] = await Promise.all([
        fetchLiveSearch(topic),
        fetchSearchConsoleMetrics(topic),
      ]);
      const generated = await generateContentResearch({
        topic,
        audience,
        editorNotes,
        existingPosts: existing.posts,
        existingTitles: existing.titles,
        providedSources,
        liveSearch,
        searchConsole,
      });
      const id = await createContentWorkflow({ topic, audience, data: { liveSearch, searchConsole, research: generated.research, plan: generated.plan }, stage: "topic_plan" });
      await logAdminAction("content.research", `workflow #${id} research/topic plan`, null);
      return NextResponse.json({ ok: true, workflow: await getContentWorkflow(id) });
    }

    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return bad("A valid workflow id is required.");
    const view = await getContentWorkflow(id);
    if (!view) return bad("Content workflow not found.", 404);
    const data = workflowData(view);

    if (action === "draft") {
      if (!data.plan || !data.research) return bad("Complete the research/topic plan first.");
      const draft = await generateContentDraft({
        topic: view.topic,
        research: data.research,
        plan: data.plan,
        sources: data.research.sources ?? [],
        existingTitles: (await existingArticleContext()).titles,
      });
      if (draft.contentHtml) draft.contentHtml = normalizeGeneratedHtml(draft.contentHtml);
      draft.internalLinks = validateInternalLinks(draft.internalLinks ?? data.plan.internalLinks);
      draft.slug = draft.slug || data.plan.slug;
      const nextData: WorkflowData = { ...data, draft };
      const created = await createDraftFromWorkflow(id, nextData);
      await logAdminAction("content.draft", `workflow #${id} draft #${created.postId}`, null);
      return NextResponse.json({ ok: true, workflow: await getContentWorkflow(id), postId: created.postId });
    }

    if (action === "review") {
      const postId = view.blogPostId ?? data.blogPostId;
      if (!postId) return bad("Create a draft before running the SEO review.");
      const post = await getAdminPost(postId);
      if (!post) return bad("The draft post could not be loaded.", 404);
      const draftForReview = {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? "",
        contentHtml: post.contentHtml,
        seoTitle: post.seoTitle ?? "",
        seoDescription: post.seoDescription ?? "",
        sourceNotes: post.sourceNotes ?? "",
        sources: data.research?.sources ?? [],
        internalLinks: data.plan?.internalLinks ?? [],
        schemaType: data.plan?.schemaType,
      };
      const localIssues = runLocalSeoChecks(draftForReview);
      const aiReview = await generateEditorialReview({
        research: data.research ?? {},
        plan: data.plan ?? {},
        draft: draftForReview,
        localIssues,
      });
      const issues = [...localIssues, ...aiReview.issues];
      const critical = issues.filter((issue) => issue.severity === "critical");
      const review = {
        passed: critical.length === 0,
        score: Math.min(aiReview.score, critical.length ? 60 : 100),
        summary: aiReview.summary,
        issues,
        checkedAt: new Date().toISOString(),
        aiAssisted: true,
      };
      const nextData: WorkflowData = { ...data, review };
      await updateContentWorkflow(id, nextData, "seo_review");
      await logAdminAction("content.review", `workflow #${id} review ${review.passed ? "passed" : "needs work"}`, null);
      return NextResponse.json({ ok: true, workflow: await getContentWorkflow(id) });
    }

    if (action === "approve") {
      const nextData = await approveContentWorkflow(id, data);
      await logAdminAction("content.approve", `workflow #${id} approved by human`, null);
      return NextResponse.json({ ok: true, workflow: await getContentWorkflow(id) });
    }

    if (action === "publish") {
      await publishApprovedWorkflow(id, data);
      await logAdminAction("content.publish", `workflow #${id} published`, null);
      revalidatePath("/blog");
      revalidatePath(`/blog/${view.post?.slug ?? ""}`);
      return NextResponse.json({ ok: true, workflow: await getContentWorkflow(id) });
    }

    if (action === "schedule") {
      const when = new Date(String(body.scheduledFor ?? ""));
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) return bad("Choose a future publication date and time.");
      await scheduleApprovedWorkflow(id, data, when);
      await logAdminAction("content.schedule", `workflow #${id} scheduled`, null);
      return NextResponse.json({ ok: true, workflow: await getContentWorkflow(id) });
    }

    if (action === "reject") {
      const nextData: WorkflowData = { ...data, error: String(body.reason ?? "Rejected by human editor").slice(0, 500) };
      await updateContentWorkflow(id, nextData, "rejected");
      await logAdminAction("content.reject", `workflow #${id} rejected`, null);
      return NextResponse.json({ ok: true, workflow: await getContentWorkflow(id) });
    }

    return bad("Unknown content action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The editorial operation failed.";
    console.error("[content-workflow]", message.slice(0, 300));
    return bad(message.includes("DeepSeek") || message.includes("AI") ? "The AI service is unavailable right now. Nothing was published; try again." : message, 502);
  }
}
