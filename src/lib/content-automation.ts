import "server-only";
import { createHash } from "node:crypto";
import {
  createCategory,
  createTag,
  getAdminPost,
  listAdminCategories,
  listAdminPosts,
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
  knownInternalPaths,
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
  type WorkflowCorrection,
  type WorkflowFinding,
  type WorkflowReview,
  type WorkflowReviewIssue,
  type WorkflowStage,
  type WorkflowView,
} from "./content-workflow";
import { fetchLiveSearch, fetchSearchConsoleMetrics } from "./search-research";
import { getArticles } from "./data";
import { jiroExtract } from "./jiro-client";

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
    findings: existing?.findings ?? [],
    technicalFixes: existing?.technicalFixes ?? [],
    unresolved: existing?.unresolved ?? [],
    steps: {
      research: data.research && data.plan ? "completed" : "pending",
      generate: data.blogPostId ? "completed" : "pending",
      review: "pending", taxonomy: "pending", finalize: "pending",
      ...(existing?.steps ?? {}),
    },
    maxCorrectionPasses: Math.max(3, existing?.maxCorrectionPasses ?? MAX_CORRECTION_PASSES),
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

type IssueGroup = "auto" | "research" | "human";

function findingKey(issue: WorkflowReviewIssue): string {
  return `${(issue.area ?? "general").toLowerCase()}|${issue.message.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()}`;
}

function findingId(key: string): string {
  return `f-${createHash("sha1").update(key).digest("hex").slice(0, 12)}`;
}

function tokenSet(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 3));
}

function similarFinding(existing: WorkflowFinding[], issue: WorkflowReviewIssue): WorkflowFinding | undefined {
  const key = findingKey(issue);
  const exact = existing.find((finding) => finding.key === key);
  if (exact) return exact;
  const tokens = tokenSet(issue.message);
  if (tokens.size < 3) return undefined;
  return existing.find((finding) => {
    if (finding.group !== (issue.group ?? classifyIssue(issue))) return false;
    if ((finding.area ?? "general") !== (issue.area ?? "general")) return false;
    const other = tokenSet(finding.message);
    let overlap = 0;
    for (const token of tokens) if (other.has(token)) overlap += 1;
    return overlap / Math.max(tokens.size, other.size || 1) >= 0.6;
  });
}

function reconcileFindings(existing: WorkflowFinding[], issues: WorkflowReviewIssue[], correctionRan: boolean): WorkflowFinding[] {
  const nowIso = now();
  const next = existing.map((finding) => ({ ...finding }));
  const seen = new Set<string>();
  for (const issue of issues) {
    const match = similarFinding(next, issue);
    if (match) {
      match.message = issue.message;
      match.area = issue.area;
      match.severity = issue.severity;
      match.group = issue.group ?? classifyIssue(issue);
      match.lastSeenAt = nowIso;
      if (match.status === "fixed") match.status = "open";
      if (!["fixed", "optional"].includes(match.status)) {
        match.status = match.group === "human" ? "human" : "open";
      }
      if (match.status === "open") match.attempts += correctionRan ? 1 : 0;
      seen.add(match.id);
      continue;
    }
    const key = findingKey(issue);
    const id = findingId(key);
    next.push({
      id, key, message: issue.message, area: issue.area, severity: issue.severity,
      group: issue.group ?? classifyIssue(issue),
      status: issue.group === "human" ? "human" : "open",
      attempts: 0, firstSeenAt: nowIso, lastSeenAt: nowIso,
    });
    seen.add(id);
  }
  for (const finding of next) {
    if (seen.has(finding.id)) continue;
    if (finding.status === "open" && correctionRan) {
      finding.status = "fixed";
      finding.resolution = "Re-review no longer detected this issue after correction.";
    }
  }
  return next;
}


function classifyIssue(issue: WorkflowReviewIssue): IssueGroup {
  const area = (issue.area ?? "").toLowerCase();
  const text = `${area} ${issue.message}`.toLowerCase();
  if (/\b(brand|positioning|business[- ]specific|reputation|legal|regulatory|compliance|expert|judgment)\b/.test(text)) return "human";
  if (/\b(accuracy|source|sources|citation|statistic|study|research|fact|claim|claims|payer|coding|medical|guarantee|guaranteed|evidence|verification)\b/.test(text)) return "research";
  return "auto";
}

function normaliseIssues(issues: WorkflowReviewIssue[]): WorkflowReviewIssue[] {
  const seen = new Set<string>();
  return issues.flatMap((issue) => {
    const message = issue.message.trim().slice(0, 600);
    if (!message) return [];
    const group = classifyIssue(issue);
    const key = `${group}|${(issue.area ?? "").toLowerCase()}|${message.toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...issue, message, group }];
  }).slice(0, 40);
}

const OFFICIAL_SOURCE_DOMAINS = [
  "hhs.gov", "cms.gov", "medicare.gov", "ocr.hhs.gov", "cms.hhs.gov",
  "ama-assn.org", "hfma.org", "mgma.com", "ahrq.gov", "cdc.gov",
];

function isOfficialSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return OFFICIAL_SOURCE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch { return false; }
}

function claimTokens(message: string): string[] {
  return [...new Set(message.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((token) => token.length >= 5 && !["about", "which", "should", "would", "could", "there", "their", "these", "those", "article", "content", "claim", "claims", "source", "sources"].includes(token)))]
    .slice(0, 8);
}

/**
 * Try to retrieve an official source for factual findings using the existing
 * Jiro provider. A source is accepted only when it is on an official/recognized
 * domain and its extracted page contains multiple terms from the finding.
 * This never fabricates a source and never implies universal payer rules.
 */
async function resolveResearchSources(data: WorkflowData, issues: WorkflowReviewIssue[]): Promise<{ data: WorkflowData; found: number; providerError: string | null }> {
  const sources = [...(data.research?.sources ?? [])];
  const known = new Set(sources.map((source) => source.url));
  let found = 0;
  let providerError: string | null = null;
  for (const issue of issues.slice(0, 2)) {
    try {
      const query = `${data.draft?.title ?? data.plan?.title ?? ""} ${issue.message}`.slice(0, 220);
      const search = await fetchLiveSearch(query);
      if (!search.available) { providerError = search.note; continue; }
      for (const result of search.results.filter((item) => isOfficialSource(item.url)).slice(0, 2)) {
        if (known.has(result.url)) continue;
        const extraction = await jiroExtract(result.url);
        if (!extraction.available || !extraction.content) continue;
        const haystack = `${extraction.title ?? result.title} ${extraction.content}`.toLowerCase();
        const tokens = claimTokens(issue.message);
        const hits = tokens.filter((token) => haystack.includes(token));
        if (tokens.length && hits.length >= Math.min(3, tokens.length)) {
          sources.push({
            title: (extraction.title ?? result.title).slice(0, 200),
            url: result.url,
            organization: new URL(result.url).hostname.replace(/^www\./, ""),
            accessedAt: new Date().toISOString(),
            verified: true,
            note: "Retrieved from an official/recognized source by the editorial research step.",
          });
          known.add(result.url);
          found += 1;
        }
      }
    } catch (error) {
      providerError = error instanceof Error ? error.message.slice(0, 200) : "Research provider unavailable.";
    }
  }
  return {
    data: { ...data, research: { ...(data.research ?? {}), sources } },
    found,
    providerError,
  };
}

async function applyCorrections(
  post: Awaited<ReturnType<typeof getAdminPost>>,
  data: WorkflowData,
  issues: WorkflowReviewIssue[],
  mode: "auto" | "qualify",
): Promise<{ post: NonNullable<Awaited<ReturnType<typeof getAdminPost>>>; correction: Awaited<ReturnType<typeof generateAutoCorrection>>; changedFields: string[] } | null> {
  if (!post) return null;
  const correction = await generateAutoCorrection({
    title: post.title,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    excerpt: post.excerpt ?? "",
    contentHtml: post.contentHtml,
    issues,
    sources: data.research?.sources ?? [],
    allowedInternalPaths: knownInternalPaths(),
    mode,
  });
  let correctedHtml = post.contentHtml;
  for (const edit of correction.edits) {
    if (!correctedHtml.includes(edit.find) || correctedHtml.indexOf(edit.find) !== correctedHtml.lastIndexOf(edit.find)) continue;
    correctedHtml = correctedHtml.replace(edit.find, edit.replace);
  }
  const changedFields = [
    correction.title ? "title" : "", correction.seoTitle ? "seoTitle" : "",
    correction.seoDescription ? "seoDescription" : "", correction.excerpt ? "excerpt" : "",
    correctedHtml !== post.contentHtml ? "contentHtml" : "",
  ].filter(Boolean);
  if (!changedFields.length) return null;

  const beforeLinks = new Set([...post.contentHtml.matchAll(/href="(https?:\/\/[^"#]+)"/gi)].map((match) => match[1]));
  const allowedExternal = new Set((data.research?.sources ?? []).map((source) => source.url));
  const introduced = [...correctedHtml.matchAll(/href="(https?:\/\/[^"#]+)"/gi)]
    .map((match) => match[1])
    .filter((url) => !beforeLinks.has(url) && !allowedExternal.has(url));
  if (introduced.length) return null;

  await updatePost(post.id, postInputFrom(post, data, {
    title: correction.title,
    seoTitle: correction.seoTitle,
    seoDescription: correction.seoDescription,
    excerpt: correction.excerpt,
    contentHtml: correctedHtml !== post.contentHtml ? correctedHtml : undefined,
  }));
  const updated = await getAdminPost(post.id);
  return updated ? { post: updated, correction, changedFields } : null;
}

async function verifiedInternalPaths(): Promise<Set<string>> {
  const paths = new Set(knownInternalPaths());
  try {
    const [posts, articles] = await Promise.all([listAdminPosts({ page: 1, perPage: 100 }), getArticles()]);
    for (const post of posts.posts) paths.add(`/blog/${post.slug}`);
    for (const article of articles) paths.add(`/insights/${article.slug}`);
  } catch { /* Keep the static allow-list; do not remove a link merely because a query failed. */ }
  return paths;
}

/** Verify, de-duplicate and cap internal links. Broken destinations are removed. */
async function repairInternalLinks(post: NonNullable<Awaited<ReturnType<typeof getAdminPost>>>, automation: WorkflowAutomation): Promise<string | null> {
  const allowed = await verifiedInternalPaths();
  const seen = new Set<string>();
  let internalCount = 0;
  let changed = false;
  const fixed: string[] = [];
  const html = post.contentHtml.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (full, href: string, inner: string) => {
    if (!href.startsWith("/") || href.startsWith("//")) return full;
    const clean = (href.split(/[?#]/)[0] || "/").replace(/\/$/, "") || "/";
    const valid = allowed.has(clean);
    const duplicate = seen.has(clean);
    internalCount += 1;
    if (!valid || duplicate || internalCount > 8) {
      changed = true;
      fixed.push(!valid ? `Removed broken internal link ${clean}` : `Removed duplicate/excess internal link ${clean}`);
      return inner;
    }
    seen.add(clean);
    return full;
  });
  if (!changed) return null;
  await updatePost(post.id, postInputFrom(post, {}, { contentHtml: html }));
  automation.technicalFixes = [...new Set([...automation.technicalFixes, ...fixed])].slice(0, 20);
  return html;
}

async function runReview(id: number, data: WorkflowData, automation: WorkflowAutomation): Promise<WorkflowData> {
  const postId = data.blogPostId;
  if (!postId) throw new Error("Create a draft before reviewing.");
  automation.status = "reviewing";
  automation.step = "review";
  automation.steps.review = "running";
  automation.attempts += 1;
  await save(id, data, "draft", automation);

  let findings: WorkflowFinding[] = [...automation.findings];
  let currentIssues: WorkflowReviewIssue[] = [];
  let review: WorkflowReview | undefined;
  const corrections: WorkflowCorrection[] = [...automation.corrections];
  const unresolved = new Set<string>();
  // Three correction opportunities after the initial review.
  const maxPasses = Math.max(3, automation.maxCorrectionPasses) + 1;
  let correctionRan = false;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let post = await getAdminPost(postId);
    if (!post) throw new Error("The draft no longer exists.");
    const repaired = await repairInternalLinks(post, automation);
    if (repaired) {
      post = await getAdminPost(postId);
      if (!post) throw new Error("The draft no longer exists after link validation.");
    }
    const draft = reviewDraft(post, data);
    const localIssues = runLocalSeoChecks(draft);
    const aiReview = await generateEditorialReview({ research: data.research ?? {}, plan: data.plan ?? {}, draft, localIssues });
    const issues = normaliseIssues([...localIssues, ...aiReview.issues]);
    currentIssues = issues;

    // Reconcile against the persisted findings. A finding is only marked fixed
    // after a later review no longer detects it following a correction pass.
    findings = reconcileFindings(findings, issues, correctionRan);
    correctionRan = false;
    automation.findings = findings;
    const openCurrent = findings.filter((finding) => ["open", "unresolved", "human"].includes(finding.status));
    const blocking = openCurrent.filter((finding) => finding.group === "auto" && finding.severity !== "info");
    review = {
      passed: blocking.length === 0,
      score: Math.min(aiReview.score, blocking.some((finding) => finding.severity === "critical") ? 60 : 100),
      summary: aiReview.summary,
      issues: openCurrent.map((finding) => ({
        severity: finding.severity, message: finding.message, area: finding.area, group: finding.group,
        status: finding.status === "human" ? "human" : "open", resolution: finding.resolution,
      })),
      checkedAt: now(),
      aiAssisted: true,
      foundCount: findings.length,
      correctedCount: findings.filter((finding) => finding.status === "fixed").length,
      humanCount: findings.filter((finding) => finding.status === "human").length,
      autoRemaining: blocking.length,
      optionalCount: findings.filter((finding) => finding.status === "optional").length,
      unresolvedCount: findings.filter((finding) => finding.status === "unresolved").length,
      escalationCount: findings.filter((finding) => finding.status === "human").length,
    };
    data = { ...data, review, automation };
    await save(id, data, "draft", automation);

    const autoIssues = issues.filter((issue) => issue.group === "auto");
    const researchIssues = issues.filter((issue) => issue.group === "research");
    if (!autoIssues.length && !researchIssues.length) break;
    if (pass >= maxPasses - 1) break;

    automation.status = "fixing";
    automation.step = `fixing pass ${pass + 1}`;
    automation.steps.review = "running";
    await save(id, data, "draft", automation);

    let changed = false;
    let correctionSummary: string | undefined;
    let correctionFields: string[] = [];
    const addressedIds = new Set<string>();
    if (autoIssues.length) {
      const applied = await applyCorrections(post, data, autoIssues, "auto");
      if (applied) {
        changed = true;
        correctionSummary = applied.correction.changes[0] ?? "Objective editorial corrections applied.";
        correctionFields = applied.changedFields;
        for (const message of applied.correction.unresolved.slice(0, 5)) unresolved.add(message);
        data = { ...data, draft: draftFromPost(applied.post, data) };
        for (const issue of autoIssues) {
          const finding = similarFinding(findings, issue);
          if (finding) addressedIds.add(finding.id);
        }
      }
    }
    if (researchIssues.length) {
      const researchResult = await resolveResearchSources(data, researchIssues).catch(() => ({ data, found: 0, providerError: "Research provider unavailable." }));
      data = researchResult.data;
      if (researchResult.providerError && !researchResult.found) unresolved.add(`Research provider unavailable; factual claims were qualified or escalated. ${researchResult.providerError.slice(0, 160)}`);
      const latest = await getAdminPost(postId);
      const applied = latest ? await applyCorrections(latest, data, researchIssues, "qualify") : null;
      if (applied) {
        changed = true;
        correctionSummary = correctionSummary ?? applied.correction.changes[0] ?? "Unsupported claims were safely qualified.";
        correctionFields = [...new Set([...correctionFields, ...applied.changedFields])];
        for (const message of applied.correction.unresolved.slice(0, 5)) unresolved.add(message);
        data = { ...data, draft: draftFromPost(applied.post, data) };
        for (const issue of researchIssues) {
          const finding = similarFinding(findings, issue);
          if (finding) addressedIds.add(finding.id);
        }
      }
    }

    if (!changed) break;
    corrections.push({
      pass: pass + 1,
      summary: correctionSummary ?? "Safe editorial corrections applied.",
      changedFields: correctionFields,
      issuesAddressed: [...autoIssues, ...researchIssues].slice(0, 12).map((issue) => issue.message),
      findingIds: [...addressedIds],
      at: now(),
    });
    automation.corrections = corrections;
    correctionRan = true;
    automation.status = "rechecking";
    automation.step = `checking pass ${pass + 2}`;
    await save(id, data, "draft", automation);
  }

  // No automatic finding may silently disappear when the retry limit is hit.
  const finalFindings = findings.map((finding) => {
    if (finding.status !== "open") return finding;
    if (finding.group === "auto" && finding.severity === "info") return { ...finding, status: "optional" as const };
    if (finding.group === "auto") return { ...finding, status: "unresolved" as const, resolution: "Automatic correction did not resolve this finding after the allowed passes." };
    return { ...finding, status: "human" as const, resolution: "Requires research or human judgment." };
  });
  automation.findings = finalFindings;
  const blockingAuto = finalFindings.filter((finding) => finding.status === "unresolved" || (finding.status === "open" && finding.group === "auto" && finding.severity !== "info"));
  const humanRemaining = finalFindings.filter((finding) => finding.status === "human");
  const optional = finalFindings.filter((finding) => finding.status === "optional");
  const fixed = finalFindings.filter((finding) => finding.status === "fixed");
  const displayIssues: WorkflowReviewIssue[] = [...humanRemaining, ...blockingAuto].map((finding) => ({
    severity: finding.severity,
    message: finding.message,
    area: finding.area,
    group: finding.group,
    status: finding.status === "human" ? "human" : "open",
    resolution: finding.resolution,
  }));
  if (review) {
    review = {
      ...review,
      passed: blockingAuto.length === 0,
      issues: displayIssues,
      foundCount: finalFindings.length,
      correctedCount: fixed.length,
      humanCount: humanRemaining.length,
      autoRemaining: blockingAuto.length,
      optionalCount: optional.length,
      unresolvedCount: blockingAuto.length,
      escalationCount: humanRemaining.length,
    };
    data = { ...data, review };
  }
  automation.unresolved = [...new Set([...unresolved, ...humanRemaining.map((finding) => finding.message), ...blockingAuto.map((finding) => finding.message)])].slice(0, 20);
  automation.steps.review = "completed";
  automation.status = blockingAuto.length ? "needs_attention" : "idle";
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
      taxonomy: { categoryId: post.category.id, categoryName: post.category.name, categoryCreated: false, tagIds: post.tags.map((tag) => tag.id), tagNames: post.tags.map((tag) => tag.name), tagsCreated: [], summary: "Existing taxonomy retained and verified.", categoryReason: "The draft already had a verified category.", tagReasons: post.tags.map((tag) => ({ name: tag.name, reason: "Existing tag already assigned to this article." })), at: now() },
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
  } else {
    throw new Error("No existing category genuinely matches this article. Retry taxonomy assignment so AI can propose a new category.");
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
  if (selected.length < 2) throw new Error("AI did not select at least two relevant tags. Retry taxonomy assignment.");
  await setPostTaxonomy(postId, categoryId, selected.map((tag) => tag.id));
  const taxonomyCheck = await getAdminPost(postId);
  if (!taxonomyCheck?.category || taxonomyCheck.category.id !== categoryId || taxonomyCheck.tags.length < 2) {
    throw new Error("Taxonomy was generated but could not be verified on the post.");
  }
  data = {
    ...data,
    taxonomy: {
      categoryId, categoryName, categoryCreated,
      tagIds: selected.map((tag) => tag.id), tagNames: selected.map((tag) => tag.name), tagsCreated: createdTags,
      imageSuggestions: choice.imageSuggestions, summary: choice.summary,
      categoryReason: choice.categoryReason, tagReasons: choice.tagReasons,
      at: now(),
    },
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
  if (automation.steps.review !== "completed" || !data.review?.aiAssisted) throw new Error("Complete the AI review before final validation.");
  automation.status = "reviewing";
  automation.step = "final validation";
  automation.steps.finalize = "running";
  automation.attempts += 1;
  await save(id, data, "seo_review", automation);

  const post = await getAdminPost(postId);
  if (!post) throw new Error("The draft no longer exists.");
  const draft = reviewDraft(post, data);
  const prior = data.review?.issues ?? [];
  const localIssues: WorkflowReviewIssue[] = runLocalSeoChecks(draft);
  if (!post.category) localIssues.push({ severity: "critical", area: "taxonomy", message: "A relevant category must be assigned before approval." });
  if (post.tags.length < 2) localIssues.push({ severity: "critical", area: "taxonomy", message: "At least two relevant tags must be assigned before approval." });
  const issues = normaliseIssues([...prior, ...localIssues]);
  const findings = automation.findings ?? [];
  const blockingAuto = findings.filter((finding) => finding.status === "unresolved" || (finding.status === "open" && finding.group === "auto" && finding.severity !== "info"));
  const humanFindings = findings.filter((finding) => finding.status === "human");
  const optionalFindings = findings.filter((finding) => finding.status === "optional");
  const fixedFindings = findings.filter((finding) => finding.status === "fixed");
  const review: WorkflowReview = {
    passed: blockingAuto.length === 0,
    score: data.review?.score ?? 0,
    summary: data.review?.summary ?? "AI review completed.",
    issues: [...humanFindings, ...blockingAuto].map((finding) => ({ severity: finding.severity, message: finding.message, area: finding.area, group: finding.group, status: finding.status === "human" ? "human" : "open", resolution: finding.resolution })),
    checkedAt: now(),
    aiAssisted: true,
    foundCount: Math.max(findings.length, data.review?.foundCount ?? 0),
    correctedCount: fixedFindings.length,
    humanCount: humanFindings.length,
    autoRemaining: blockingAuto.length,
    optionalCount: optionalFindings.length,
    unresolvedCount: blockingAuto.length,
    escalationCount: humanFindings.length,
  };
  data = { ...data, review };
  automation.unresolved = [...new Set([...humanFindings.map((finding) => finding.message), ...blockingAuto.map((finding) => finding.message)])].slice(0, 16);
  automation.steps.finalize = "completed";
  automation.status = blockingAuto.length ? "needs_attention" : "ready";
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
