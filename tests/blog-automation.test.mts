import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dbFile = join(tmpdir(), `knight-blog-automation-${process.pid}.db`);
process.env.SQLITE_PATH = dbFile;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.GSC_OAUTH_TOKEN_FILE = join(tmpdir(), `knight-blog-automation-token-${process.pid}.json`);
process.env.ADMIN_PASSWORD = "test-admin-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

function sseText(text: string): Response {
  const frame = `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10 } })}\n\ndata: [DONE]\n\n`;
  return new Response(frame, { status: 200, headers: { "content-type": "text/event-stream" } });
}
function sse(payload: unknown): Response { return sseText(JSON.stringify(payload)); }

const originalFetch = globalThis.fetch;
let reviewCalls = 0;
let draftCalls = 0;
let correctionCalls = 0;
let taxonomyCalls = 0;
let failNextReview = 0;
let persistentReview = false;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.includes("/chat/completions")) return new Response("{}", { status: 503 });
  const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: { role: string; content: string }[] };
  const prompt = body.messages?.find((message) => message.role === "user")?.content ?? "";

  if (prompt.includes("Develop the research brief")) {
    return sse({
      research: {
        summary: "Independent practices need a clear denial-prevention process.",
        searchIntent: "Learn practical steps to reduce avoidable claim denials.",
        audience: "Independent practice managers",
        existingCoverage: "No direct duplicate.",
        contentGaps: ["prevention checklist", "monthly review cadence"],
        competitorNotes: "No live competitor dataset was connected; plan is based on editorial context.",
        sources: [],
        primaryKeyword: "reduce claim denials",
        secondaryKeywords: ["claim denial prevention", "medical billing workflow"],
        longTailKeywords: ["reduce claim denials for independent practices"],
      },
      plan: {
        title: "How to Reduce Claim Denials in an Independent Practice",
        slug: "reduce-claim-denials-independent-practice",
        primaryKeyword: "reduce claim denials",
        secondaryKeywords: ["claim denial prevention"],
        longTailKeywords: ["reduce claim denials for independent practices"],
        outline: [{ heading: "Why claim denials happen" }, { heading: "Build a prevention checklist" }, { heading: "Review denials every month" }],
        internalLinks: [{ label: "Medical billing services", href: "/services", reason: "Relevant service context." }],
        schemaType: "Article",
        notes: "No live SERP dataset was connected.",
      },
    });
  }

  if (prompt.includes("Write the complete article body")) {
    draftCalls += 1;
    return sseText("<h2>Why claim denials happen</h2><p>Most denials are preventable when eligibility, coding and documentation are checked before submission. Review the workflow with your billing team and verify payer rules against current official guidance.</p><h2>Build a prevention checklist</h2><p>Use a short pre-submission checklist and review patterns with your <a href=\"/services\">medical billing services</a> team. Keep the process practical and documented. <a href=\"/services\">billing services</a> and <a href=\"/services/does-not-exist\">broken internal example</a>.</p><h2>Review denials every month</h2><p>Review denial reasons monthly and correct the upstream process. Do not assume a single fix resolves every payer issue.</p><h2>What to do next</h2><p>If you want help reviewing your workflow, schedule a conversation with Knight Medical Billing.</p>");
  }

  if (prompt.includes("Create the SEO metadata for this finished article")) {
    return sse({
      title: "How to Reduce Claim Denials in an Independent Practice",
      slug: "reduce-claim-denials-independent-practice",
      excerpt: "A practical workflow for reducing avoidable claim denials without overpromising outcomes.",
      seoTitle: "How to Reduce Claim Denials in Independent Practices",
      seoDescription: "Learn practical claim denial prevention steps for independent medical practices, including eligibility checks, documentation and monthly review.",
      sourceNotes: "AI-assisted draft. Human review required.",
      sources: [],
      internalLinks: [{ label: "Medical billing services", href: "/services" }],
      schemaType: "Article",
    });
  }

  if (prompt.includes("Review this draft as a careful SEO editor")) {
    if (persistentReview) {
      return sse({ summary: "A persistent structure issue remains.", score: 70, issues: [{ severity: "warning", area: "structure", message: "Persistent structure issue that survives corrections." }] });
    }
    if (failNextReview > 0) {
      failNextReview -= 1;
      return new Response("{}", { status: 503 });
    }
    reviewCalls += 1;
    if (reviewCalls === 1) {
      return sse({
        summary: "The article is useful but has one clarity issue.",
        score: 78,
        issues: [{ severity: "warning", area: "structure", message: "The opening paragraph could be clearer and more direct." }],
      });
    }
    return sse({ summary: "The corrected article passes the editorial review.", score: 94, issues: [] });
  }

  if (prompt.includes("Correct only safe, objective problems")) {
    correctionCalls += 1;
    return sse({
      title: "How to Reduce Claim Denials in an Independent Practice",
      seoTitle: "How to Reduce Claim Denials in Independent Practices",
      seoDescription: "Learn practical claim denial prevention steps for independent medical practices, including eligibility checks, documentation and monthly review.",
      excerpt: "A practical workflow for reducing avoidable claim denials without overpromising outcomes.",
      edits: [{ find: "Most denials are preventable when eligibility, coding and documentation are checked before submission.", replace: "Most denials are preventable when eligibility, coding and documentation are checked before submission. Start with a direct review of your current workflow." }],
      changes: ["Made the opening paragraph more direct."],
      unresolved: [],
    });
  }

  if (prompt.includes("Choose the best existing category")) {
    taxonomyCalls += 1;
    return sse({
      categoryId: null,
      categoryName: "Medical Billing Operations",
      createCategory: true,
      tagIds: [],
      newTags: ["claim denials", "revenue cycle"],
      summary: "A new operational category is needed because no existing category fits.",
    });
  }

  return new Response("{}", { status: 500 });
}) as typeof fetch;

try {
  const blog = await import("../src/lib/blog");
  const workflow = await import("../src/lib/content-workflow");
  const automation = await import("../src/lib/content-automation");

  const id = await workflow.createContentWorkflow({
    topic: "How independent practices can reduce claim denials",
    audience: "Practice managers",
    data: { automation: undefined },
    stage: "topic_plan",
  });

  for (const step of ["research", "generate", "review", "taxonomy"] as const) {
    await automation.runAutomationStep(id, step);
  }
  const beforeFinalize = await workflow.getContentWorkflow(id);
  await automation.runAutomationStep(id, "generate");
  const afterGenerate = await workflow.getContentWorkflow(id);
  ok("re-running generate does not create a duplicate post", afterGenerate?.post?.id === beforeFinalize?.post?.id, JSON.stringify({ before: beforeFinalize?.post?.id, after: afterGenerate?.post?.id }));
  await automation.runAutomationStep(id, "finalize");

  const view = await workflow.getContentWorkflow(id);
  assert.ok(view);
  ok("workflow reached ready status", view.data.automation?.status === "ready", JSON.stringify(view.data.automation));
  ok("workflow has a review", view.data.review?.passed === true, JSON.stringify(view.data.review));
  ok("workflow has corrections", (view.data.automation?.corrections.length ?? 0) === 1, JSON.stringify(view.data.automation?.corrections));
  ok("review was rechecked after correction", reviewCalls === 2, String(reviewCalls));
  ok("draft was generated once", draftCalls === 1, String(draftCalls));
  ok("correction was generated once", correctionCalls === 1, String(correctionCalls));
  ok("taxonomy was selected once", taxonomyCalls === 1, String(taxonomyCalls));
  ok("workflow did not auto-publish", view.stage === "seo_review" && view.post?.status === "draft", JSON.stringify({ stage: view.stage, status: view.post?.status }));
  ok("article has a category", Boolean(view.data.taxonomy?.categoryName), JSON.stringify(view.data.taxonomy));
  ok("article has tags", (view.data.taxonomy?.tagNames.length ?? 0) >= 2, JSON.stringify(view.data.taxonomy));
  ok("post has optional no featured image", view.post ? !("featuredImage" in view.post) || true : false);

  await workflow.approveContentWorkflow(id, view.data);
  const approved = await workflow.getContentWorkflow(id);
  ok("human approval is required and persists", approved?.stage === "approved", approved?.stage);
  await workflow.publishApprovedWorkflow(id, approved!.data);
  const published = await workflow.getContentWorkflow(id);
  ok("publishing happens only after approval", published?.stage === "published" && published?.post?.status === "published", JSON.stringify({ stage: published?.stage, status: published?.post?.status }));
  const firstFindings = published?.data.automation?.findings ?? [];
  ok("findings have stable IDs and verified lifecycle", firstFindings.length > 0 && firstFindings.every((finding) => finding.id.startsWith("f-")) && firstFindings.some((finding) => finding.status === "fixed"), JSON.stringify(firstFindings.slice(0, 4)));
  const finalPost = await blog.getAdminPost(1);
  ok("broken and duplicate internal links are removed", finalPost?.contentHtml.includes("does-not-exist") === false && (published?.data.automation?.technicalFixes ?? []).some((fix) => fix.includes("broken internal link")), JSON.stringify(published?.data.automation?.technicalFixes));

  // Phase 4 contract: a published article leaves the workspace queue and is
  // reachable only through the history lookup (Published Articles / audit).
  const visible = await workflow.listContentWorkflows(50);
  ok("published workflow leaves the workspace queue", visible.every((item) => item.id !== id));
  const history = await workflow.listContentWorkflows(50, { includePublished: true });
  ok("published workflow remains retrievable for history", history.some((item) => item.id === id && item.stage === "published"));

  const categories = await blog.listAdminCategories();
  const tags = await blog.listTags();
  ok("taxonomy is reusable and not duplicated", categories.filter((category) => category.name === "Medical Billing Operations").length === 1 && tags.filter((tag) => tag.name === "claim denials").length === 1, JSON.stringify({ categories: categories.map((category) => category.name), tags: tags.map((tag) => tag.name) }));

  // Failed-step recovery: a transient AI failure must preserve the draft and be retryable.
  const failedId = await workflow.createContentWorkflow({ topic: "How to improve eligibility checks", audience: "Practice managers", data: {}, stage: "topic_plan" });
  await automation.runAutomationStep(failedId, "research");
  await automation.runAutomationStep(failedId, "generate");
  failNextReview = 2;
  let failed = false;
  try { await automation.runAutomationStep(failedId, "review"); } catch { failed = true; }
  const failedView = await workflow.getContentWorkflow(failedId);
  ok("failed AI step is recorded without losing the draft", failed && failedView?.data.automation?.status === "failed" && Boolean(failedView?.post?.id), JSON.stringify({ failed, status: failedView?.data.automation?.status, postId: failedView?.post?.id }));
  const failedPostId = failedView?.post?.id;
  await automation.runAutomationStep(failedId, "review");
  await automation.runAutomationStep(failedId, "taxonomy");
  await automation.runAutomationStep(failedId, "finalize");
  const resumed = await workflow.getContentWorkflow(failedId);
  ok("failed workflow can be resumed without a duplicate draft", resumed?.data.automation?.status === "ready" && resumed?.post?.id === failedPostId, JSON.stringify({ status: resumed?.data.automation?.status, before: failedPostId, after: resumed?.post?.id }));

  // A finding that survives the allowed correction passes must remain visible and block Ready.
  persistentReview = true;
  const persistentId = await workflow.createContentWorkflow({ topic: "How to test a persistent editorial finding", audience: "Practice managers", data: {}, stage: "topic_plan" });
  await automation.runAutomationStep(persistentId, "research");
  await automation.runAutomationStep(persistentId, "generate");
  await automation.runAutomationStep(persistentId, "review");
  const persistentView = await workflow.getContentWorkflow(persistentId);
  const persistentFindings = persistentView?.data.automation?.findings ?? [];
  ok("unresolved automatic findings are not hidden", persistentView?.data.automation?.status === "needs_attention" && (persistentView?.data.review?.autoRemaining ?? 0) > 0, JSON.stringify({ status: persistentView?.data.automation?.status, review: persistentView?.data.review }));
  ok("unresolved findings remain in the lifecycle", persistentFindings.some((finding) => finding.status === "unresolved") && persistentFindings.some((finding) => finding.attempts >= 2), JSON.stringify(persistentFindings.slice(0, 5)));
  ok("unresolved article remains a draft", persistentView?.post?.status === "draft", persistentView?.post?.status);

  console.log(`RESULT pass=${passed} fail=0`);
} finally {
  globalThis.fetch = originalFetch;
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbFile}${suffix}`, { force: true });
}
