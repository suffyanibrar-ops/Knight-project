import "server-only";
import {
  createCategory,
  createTag,
  getAdminPost,
  listAdminCategories,
  listTags,
  setPostTaxonomy,
  slugify,
  updatePost,
  type BlogPostFull,
  type PostInput,
} from "./blog";
import {
  generateAutoCorrection,
  generateContentDraft,
  generateContentResearch,
  generateEditorialReview,
  generateTaxonomy,
} from "./content-ai";
import {
  buildDraftSourceNotes,
  createDraftFromWorkflow,
  existingArticleContext,
  getContentWorkflow,
  normalizeGeneratedHtml,
  runLocalSeoChecks,
  sanitizeDraft,
  sanitizePlan,
  sanitizeResearch,
  updateContentWorkflow,
  validateInternalLinks,
  type WorkflowAutomation,
  type WorkflowData,
  type WorkflowDraft,
  type WorkflowReview,
  type WorkflowReviewIssue,
  type WorkflowStage,
  type WorkflowView,
} from "./content-workflow";
import { fetchLiveSearch, fetchSearchConsoleMetrics } from "./search-research";

export const AUTOMATION_STEPS = ["research", "generate", "review", "taxonomy", "finalize"] as const;
export type AutomationStep = (typeof AUTOMATION_STEPS)[number];

const MAX_CORRECTION_PASSES = 2;

function now(): string { return new Date().toISOString(); }

function initialAutomation(data: WorkflowData): WorkflowAutomation {
  const existing = data.automation;
  return {
    status: existing?.status ?? "idle",
    step: existing?.step ?? "",
    startedAt: existing?.startedAt ?? now(),
    updatedAt: now(),
    completedAt: existing?.completedAt ?? null,
    attempts: existing?.attempts ?? 0,
    lastError: existing?.lastError ?? null,
    corrections: existing?.corrections ?? [],
    unresolved: existing?.unresolved ?? [],
    steps: {
      research: data.research && data.plan ? "completed" : "pending",
      generate: data.blogPostId ? "completed" : "pending",
      review: "pending", taxonomy: "pending", finalize: "pending",
      ...(existing?.steps ?? {}),
    },
    maxCorrectionPasses: existing?.maxCorrectionPasses ?? MAX_CORRECTION_PASSES,
    taxonomy: existing?.taxonomy,
  };
}

function safeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "The automation step failed.";
  if (/DeepSeek|AI service|AI returned|token/i.test(message)) return "The AI service did not complete this step. Progress was saved; retry when it is available.";
  return message.slice(0, 300);
}

async function save(id: number, data: WorkflowData, stage: WorkflowStage, automation: WorkflowAutomation): Promise<void> {
  automation.updatedAt = now();
  data.automation = automation;
  await updateContentWorkflow(id, data, stage);
}

function draftFromPost(post: BlogPostFull, data: WorkflowData): WorkflowDraft {
  return {
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
}

function reviewDraft(post: BlogPostFull, data: WorkflowData): WorkflowDraft {
  return draftFromPost(post, data);
}


function postInputFrom(post: BlogPostFull, data: WorkflowData, correction: { title?: string; seoTitle?: string; seoDescription?: string; excerpt?: string; contentHtml?: string }): PostInput {
  return {
    title: correction.title || post.title,
    slug: post.slug,
    excerpt: correction.excerpt ?? post.excerpt,
    contentHtml: correction.contentHtml ?? post.contentHtml,
    featuredImage: post.featuredImage,
    featuredImageAlt: post.featuredImageAlt,
    featuredImageWidth: post.featuredImageWidth,
    featuredImageHeight: post.featuredImageHeight,
    featuredMediaId: post.media?.id ?? null,
    author: post.author,
    categoryId: post.category?.id ?? null,
    tagIds: post.tags.map((tag) => tag.id),
    status: post.status,
    publishedAt: post.publishedAt,
    scheduledFor: post.scheduledFor,
    seoTitle: correction.seoTitle ?? post.seoTitle,
    seoDescription: correction.seoDescription ?? post.seoDescription,
    canonicalUrl: post.canonicalUrl,
    socialImage: post.socialImage,
    sourceNotes: post.sourceNotes || buildDraftSourceNotes(data),
  };
}

async function runResearch(id: number, data: WorkflowData, automation: WorkflowAutomation): Promise<WorkflowData> {
  automation.status = "researching";
  automation.step = "research";
  automation.steps.research = "running";
  automation.attempts += 1;
  await save(id, data, "topic_plan", automation);

  const existing = await existingArticleContext();
  const topic = (await getContentWorkflow(id))?.topic ?? "";
  const [liveSearch, searchConsole] = await Promise.all([fetchLiveSearch(topic), fetchSearchConsoleMetrics(topic)]);
  const generated = await generateContentResearch({
    topic,
    audience: (await getContentWorkflow(id))?.audience ?? undefined,
    existingPosts: existing.posts,
    existingTitles: existing.titles,
    providedSources: data.research?.sources ?? [],
    liveSearch,
    searchConsole,
  });
  data = { ...data, liveSearch, searchConsole, research: sanitizeResearch(generated.research), plan: sanitizePlan(generated.plan) };
  automation.steps.research = "completed";
  automation.status = "idle";
  await save(id, data, "topic_plan", automation);
  return data;
}

async function runGenerate(id: number, data: WorkflowData, automation: WorkflowAutomation): Promise<WorkflowData> {
  if (!data.research || !data.plan) throw new Error("Research is not complete.");
  automation.status = "generating";
  automation.step = "generate";
  automation.steps.generate = "running";
  automation.attempts += 1;
  await save(id, data, "topic_plan", automation);

  if (data.blogPostId) {
    const existingPost = await getAdminPost(data.blogPostId);
    if (existingPost) {
      data = { ...data, draft: draftFromPost(existingPost, data) };
      automation.steps.generate = "completed";
      automation.status = "idle";
      await save(id, data, "draft", automation);
      return data;
    }
  }

  if (!data.draft?.contentHtml) {
    const generated = await generateContentDraft({
      topic: (await getContentWorkflow(id))?.topic ?? data.plan.title ?? "",
      research: data.research,
      plan: data.plan,
      sources: data.research.sources ?? [],
      existingTitles: (await existingArticleContext()).titles,
    });
    if (generated.contentHtml) generated.contentHtml = normalizeGeneratedHtml(generated.contentHtml);
    generated.internalLinks = validateInternalLinks(generated.internalLinks ?? data.plan.internalLinks);
    generated.slug = generated.slug || data.plan.slug;
    data = { ...data, draft: sanitizeDraft(generated) };
  }
  if (!data.draft?.title || !data.draft.contentHtml) throw new Error("The article draft could not be generated.");
  const created = await createDraftFromWorkflow(id, data);
  data = created.data;
  automation.steps.generate = "completed";
  automation.status = "idle";
  await save(id, data, "draft", automation);
  return data;
}

async function runReview(id: number, data: WorkflowData, automation: WorkflowAutomation): Promise<WorkflowData> {
  const postId = data.blogPostId;
  if (!postId) throw new Error("Create a draft before reviewing.");
  automation.status = "reviewing";
  automation.step = "review";
  automation.steps.review = "running";
  automation.attempts += 1;
  await save(id, data, "draft", automation);

  let review: WorkflowReview | undefined;
  const unresolved = [...new Set(automation.unresolved)];
  const corrections = [...automation.corrections];

  for (let pass = 0; pass <= automation.maxCorrectionPasses; pass += 1) {
    const post = await getAdminPost(postId);
    if (!post) throw new Error("The draft no longer exists.");
    const draft = reviewDraft(post, data);
    const localIssues = runLocalSeoChecks(draft);
    const aiReview = await generateEditorialReview({ research: data.research ?? {}, plan: data.plan ?? {}, draft, localIssues });
    const issues = [...localIssues, ...aiReview.issues];
    const critical = issues.filter((issue) => issue.severity === "critical");
    review = {
      passed: critical.length === 0,
      score: Math.min(aiReview.score, critical.length ? 60 : 100),
      summary: aiReview.summary,
      issues,
      checkedAt: now(),
      aiAssisted: true,
    };
    data = { ...data, review };
    await save(id, data, "draft", automation);

    if (!issues.length) break;
    if (pass >= automation.maxCorrectionPasses) break;

    automation.status = "fixing";
    automation.step = `fixing pass ${pass + 1}`;
    automation.steps.review = "running";
    await save(id, data, "draft", automation);

    // Never send factual/medical/payer-risk issues to the rewriter. Those must
    // stay for human judgment; the correction model only gets objective polish.
    const safeCorrectionAreas = new Set(["title", "meta", "seo", "structure", "links", "formatting", "tone"]);
    const correctableIssues = issues.filter((issue) => {
      const area = (issue.area ?? "").toLowerCase();
      if (["accuracy", "sources", "policy", "claims", "medical", "legal"].includes(area)) return false;
      if (!safeCorrectionAreas.has(area)) return false;
      return !/\b(source|citation|statistic|guarantee|payer|coding|medical|legal|fact|claim)\b/i.test(issue.message);
    });
    if (!correctableIssues.length) {
      unresolved.push(...issues.filter((issue) => issue.severity !== "info").map((issue) => issue.message).slice(0, 5));
      break;
    }
    const correction = await generateAutoCorrection({
      title: post.title,
      seoTitle: post.seoTitle ?? "",
      seoDescription: post.seoDescription ?? "",
      excerpt: post.excerpt ?? "",
      contentHtml: post.contentHtml,
      issues: correctableIssues,
      sources: data.research?.sources ?? [],
      allowedInternalPaths: (await import("./content-workflow")).knownInternalPaths(),
    });
    let correctedHtml = post.contentHtml;
    let appliedEdits = 0;
    for (const edit of correction.edits) {
      if (!correctedHtml.includes(edit.find) || correctedHtml.indexOf(edit.find) !== correctedHtml.lastIndexOf(edit.find)) {
        unresolved.push("AI proposed an edit that did not match exactly once; it was not applied.");
        continue;
      }
      correctedHtml = correctedHtml.replace(edit.find, edit.replace);
      appliedEdits += 1;
    }
    const changedFields = [
      correction.title ? "title" : "", correction.seoTitle ? "seoTitle" : "",
      correction.seoDescription ? "seoDescription" : "", correction.excerpt ? "excerpt" : "",
      appliedEdits ? "contentHtml" : "",
    ].filter(Boolean);
    unresolved.push(...correction.unresolved.slice(0, 5));
    if (!changedFields.length) {
      if (correction.unresolved.length) break;
      continue;
    }
    const beforeLinks = new Set([...post.contentHtml.matchAll(/href="(https?:\/\/[^"#]+)"/gi)].map((match) => match[1]));
    const allowedExternal = new Set((data.research?.sources ?? []).map((source) => source.url));
    const introduced = [...correctedHtml.matchAll(/href="(https?:\/\/[^"#]+)"/gi)]
      .map((match) => match[1])
      .filter((url) => !beforeLinks.has(url) && !allowedExternal.has(url));
    if (introduced.length) {
      unresolved.push("AI proposed an unverified external link; it was not applied.");
      break;
    }
    const correctionFields = {
      title: correction.title,
      seoTitle: correction.seoTitle,
      seoDescription: correction.seoDescription,
      excerpt: correction.excerpt,
      contentHtml: appliedEdits ? correctedHtml : undefined,
    };
    await updatePost(post.id, postInputFrom(post, data, correctionFields));
    const corrected = await getAdminPost(post.id);
    if (corrected) data = { ...data, draft: draftFromPost(corrected, data) };
    corrections.push({
      pass: pass + 1,
      summary: correction.changes[0] ?? "Safe editorial corrections applied.",
      changedFields,
      issuesAddressed: issues.slice(0, 8).map((issue) => issue.message),
      at: now(),
    });
    automation.corrections = corrections;
    automation.status = "rechecking";
    automation.step = `checking pass ${pass + 2}`;
    await save(id, data, "draft", automation);
  }

  automation.unresolved = [...new Set(unresolved)].slice(0, 12);
  automation.steps.review = "completed";
  // Taxonomy and final validation still need to run; "ready" is reserved for the
  // completed pipeline so the admin never sees a prematurely approvable article.
  automation.status = "idle";
  automation.completedAt = null;
  await save(id, data, "seo_review", automation);
  return data;
}

function normalName(value: string): string { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim(); }

async function runTaxonomy(id: number, data: WorkflowData, automation: WorkflowAutomation): Promise<WorkflowData> {
  const postId = data.blogPostId;
  if (!postId) throw new Error("Create a draft before assigning taxonomy.");
  automation.status = "reviewing";
  automation.step = "taxonomy";
  automation.steps.taxonomy = "running";
  automation.attempts += 1;
  await save(id, data, "seo_review", automation);

  const post = await getAdminPost(postId);
  if (!post) throw new Error("The draft no longer exists.");
  if (post.category && post.tags.length) {
    data = {
      ...data,
      taxonomy: { categoryId: post.category.id, categoryName: post.category.name, categoryCreated: false, tagIds: post.tags.map((tag) => tag.id), tagNames: post.tags.map((tag) => tag.name), tagsCreated: [], at: now() },
    };
    automation.taxonomy = data.taxonomy;
    automation.steps.taxonomy = "completed";
    automation.status = "idle";
    await save(id, data, "seo_review", automation);
    return data;
  }

  const [categories, tags] = await Promise.all([listAdminCategories(), listTags()]);
  const choice = await generateTaxonomy({
    title: post.title,
    excerpt: post.excerpt ?? "",
    contentText: post.contentHtml.replace(/<[^>]+>/g, " ").slice(0, 7000),
    categories: categories.map((category) => ({ id: category.id, name: category.name })),
    tags: tags.map((tag) => ({ id: tag.id, name: tag.name })),
  });

  let categoryId: number | null = null;
  let categoryName: string | null = null;
  let categoryCreated = false;
  const exactCategory = categories.find((category) =>
    category.id === choice.categoryId || (choice.categoryName && normalName(category.name) === normalName(choice.categoryName)),
  );
  if (exactCategory) {
    categoryId = exactCategory.id;
    categoryName = exactCategory.name;
  } else if (choice.createCategory && choice.categoryName) {
    const existing = categories.find((category) => normalName(category.name) === normalName(choice.categoryName!));
    if (existing) { categoryId = existing.id; categoryName = existing.name; }
    else { categoryId = await createCategory({ name: choice.categoryName }); categoryName = choice.categoryName; categoryCreated = true; }
  } else if (categories[0]) {
    categoryId = categories[0].id;
    categoryName = categories[0].name;
  } else {
    throw new Error("No suitable blog category is available. Add one category before running taxonomy assignment.");
  }

  const selected: { id: number; name: string }[] = [];
  const createdTags: string[] = [];
  for (const id of choice.tagIds) {
    const tag = tags.find((item) => item.id === id);
    if (tag && !selected.some((item) => item.id === tag.id)) selected.push({ id: tag.id, name: tag.name });
  }
  for (const name of choice.newTags) {
    if (selected.length >= 5) break;
    const normalized = normalName(name);
    if (!normalized) continue;
    const existing = tags.find((tag) => normalName(tag.name) === normalized);
    if (existing) {
      if (!selected.some((item) => item.id === existing.id)) selected.push({ id: existing.id, name: existing.name });
      continue;
    }
    if (selected.some((tag) => normalName(tag.name) === normalized)) continue;
    const tagId = await createTag({ name });
    createdTags.push(name);
    selected.push({ id: tagId, name });
  }
  if (selected.length < 2) {
    for (const tag of tags.slice(0, 5)) {
      if (selected.length >= 2) break;
      if (!selected.some((item) => item.id === tag.id)) selected.push({ id: tag.id, name: tag.name });
    }
  }
  if (!selected.length) throw new Error("No suitable tags are available. Add tags or retry taxonomy assignment.");
  await setPostTaxonomy(postId, categoryId, selected.map((tag) => tag.id));
  data = {
    ...data,
    taxonomy: { categoryId, categoryName, categoryCreated, tagIds: selected.map((tag) => tag.id), tagNames: selected.map((tag) => tag.name), tagsCreated: createdTags, at: now() },
  };
  automation.taxonomy = data.taxonomy;
  automation.steps.taxonomy = "completed";
  automation.status = "idle";
  await save(id, data, "seo_review", automation);
  return data;
}

async function runFinalize(id: number, data: WorkflowData, automation: WorkflowAutomation): Promise<WorkflowData> {
  const postId = data.blogPostId;
  if (!postId) throw new Error("Create a draft before final validation.");
  automation.status = "reviewing";
  automation.step = "final validation";
  automation.steps.finalize = "running";
  automation.attempts += 1;
  await save(id, data, "seo_review", automation);

  const post = await getAdminPost(postId);
  if (!post) throw new Error("The draft no longer exists.");
  const draft = reviewDraft(post, data);
  const localIssues = runLocalSeoChecks(draft);
  const prior = data.review?.issues ?? [];
  const issues = [...prior, ...localIssues.filter((issue) => !prior.some((item) => item.message === issue.message))];
  if (!post.category) issues.push({ severity: "critical", area: "taxonomy", message: "Assign a blog category before approval." });
  if (!post.tags.length) issues.push({ severity: "critical", area: "taxonomy", message: "Assign at least one blog tag before approval." });
  const critical = issues.filter((issue) => issue.severity === "critical");
  const review: WorkflowReview = {
    passed: critical.length === 0 && (data.review?.passed ?? false),
    score: data.review?.score ?? 0,
    summary: data.review?.summary ?? "AI review completed.",
    issues,
    checkedAt: now(),
    aiAssisted: true,
  };
  data = { ...data, review, automation };
  automation.unresolved = [...new Set([...automation.unresolved, ...issues.filter((issue) => issue.severity === "critical").map((issue) => issue.message)])].slice(0, 12);
  automation.steps.finalize = "completed";
  automation.status = review.passed ? "ready" : "needs_attention";
  automation.completedAt = now();
  await save(id, data, "seo_review", automation);
  return data;
}

/** Run exactly one persisted step. Failed steps can be retried without regenerating completed work. */
export async function runAutomationStep(id: number, step: AutomationStep): Promise<WorkflowView | null> {
  const view = await getContentWorkflow(id);
  if (!view) throw new Error("Content workflow not found.");
  if (view.stage === "published") throw new Error("Published articles cannot be re-run through automation.");
  if (view.stage === "approved") throw new Error("This article is already approved. Reopen it before changing it.");
  let data: WorkflowData = { ...view.data, blogPostId: view.blogPostId ?? view.data.blogPostId };
  const automation = initialAutomation(data);
  const runningStatuses = new Set(["researching", "generating", "reviewing", "fixing", "rechecking"]);
  const staleAfterMs = 5 * 60_000;
  if (runningStatuses.has(automation.status) && Date.now() - new Date(automation.updatedAt).getTime() < staleAfterMs) {
    throw new Error("This workflow is already processing. Wait for the current step to finish.");
  }
  if (automation.status === "ready" && step !== "finalize" && step !== "taxonomy") {
    throw new Error("This article is already ready for review. Approve it or reopen it before running more AI steps.");
  }
  automation.lastError = null;
  data.automation = automation;
  automation.steps[step] = "running";
  await save(id, data, view.stage === "topic_plan" ? "topic_plan" : view.stage, automation);
  try {
    if (step === "research") data = await runResearch(id, data, automation);
    else if (step === "generate") data = await runGenerate(id, data, automation);
    else if (step === "review") data = await runReview(id, data, automation);
    else if (step === "taxonomy") data = await runTaxonomy(id, data, automation);
    else if (step === "finalize") data = await runFinalize(id, data, automation);
    else throw new Error("Unknown automation step.");
    automation.lastError = null;
    await save(id, data, step === "research" || step === "generate" ? "topic_plan" : "seo_review", automation);
    return getContentWorkflow(id);
  } catch (error) {
    automation.steps[step] = "failed";
    automation.status = "failed";
    automation.step = step;
    automation.lastError = safeFailure(error);
    await save(id, data, view.stage === "topic_plan" ? "topic_plan" : view.stage, automation);
    console.error("[content-automation]", JSON.stringify({ workflowId: id, step, errorName: error instanceof Error ? error.name : "UnknownError", safe: automation.lastError }));
    throw error;
  }
}
