import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, contentWorkflows } from "@/db/schema";
import { createPost, getAdminPost, listAdminPosts, setPostStatus, type BlogPostSummary } from "./blog";
import { getArticles } from "./data";
import type { LiveSearch, SearchConsoleData } from "./search-research";
import { sanitizeBlogHtml } from "./blog-sanitize";
import { primaryNav, serviceGroups, site } from "./site";

/**
 * AI-assisted editorial pipeline.
 *
 * Stage names are deliberately explicit: research → topic_plan → draft →
 * seo_review → approved → published. Nothing in this module publishes on its
 * own; `publishApprovedWorkflow` is called only by a human admin action. AI
 * output is stored as JSON alongside the existing draft post, not in a second
 * CMS.
 */
export const WORKFLOW_STAGES = ["research", "topic_plan", "draft", "seo_review", "approved", "scheduled", "published", "rejected"] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export type WorkflowSource = { title: string; url: string; note?: string };
export type WorkflowOutlineItem = { heading: string; purpose?: string };
export type WorkflowInternalLink = { label: string; href: string; reason?: string };

export type WorkflowResearch = {
  summary?: string;
  searchIntent?: string;
  audience?: string;
  existingCoverage?: string;
  contentGaps?: string[];
  competitorNotes?: string;
  sources?: WorkflowSource[];
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  longTailKeywords?: string[];
};

export type WorkflowPlan = {
  title?: string;
  slug?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  longTailKeywords?: string[];
  outline?: WorkflowOutlineItem[];
  internalLinks?: WorkflowInternalLink[];
  schemaType?: string;
  notes?: string;
};

export type WorkflowReviewIssue = { severity: "critical" | "warning" | "info"; message: string; area?: string };
export type WorkflowReview = {
  passed?: boolean;
  score?: number;
  summary?: string;
  issues?: WorkflowReviewIssue[];
  checkedAt?: string;
  aiAssisted?: boolean;
};

export type WorkflowDraft = {
  title?: string;
  slug?: string;
  excerpt?: string;
  contentHtml?: string;
  seoTitle?: string;
  seoDescription?: string;
  sourceNotes?: string;
  sources?: WorkflowSource[];
  internalLinks?: WorkflowInternalLink[];
  schemaType?: string;
};

export type WorkflowData = {
  blogPostId?: number;
  liveSearch?: LiveSearch;
  searchConsole?: SearchConsoleData;
  research?: WorkflowResearch;
  plan?: WorkflowPlan;
  draft?: WorkflowDraft;
  review?: WorkflowReview;
  approvedAt?: string;
  publishedAt?: string;
  scheduledFor?: string;
  error?: string;
};

export type WorkflowView = {
  id: number;
  topic: string;
  audience: string | null;
  stage: WorkflowStage;
  data: WorkflowData;
  blogPostId: number | null;
  post: Pick<BlogPostSummary, "id" | "title" | "slug" | "status" | "scheduledFor" | "updatedAt"> | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseJson(value: string | null): WorkflowData {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as WorkflowData) : {};
  } catch {
    return {};
  }
}

function asStage(value: string): WorkflowStage {
  return (WORKFLOW_STAGES as readonly string[]).includes(value) ? (value as WorkflowStage) : "research";
}

function cleanString(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function cleanSources(value: unknown): WorkflowSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const title = cleanString(source.title, 200);
    const url = cleanString(source.url, 500);
    if (!title || !url || !/^https?:\/\//i.test(url)) return [];
    return [{ title, url, note: cleanString(source.note, 400) }];
  }).slice(0, 20);
}

function cleanStrings(value: unknown, maxItems = 12, maxLength = 160): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, maxLength)).filter((item): item is string => Boolean(item)).slice(0, maxItems);
}

export function sanitizeResearch(input: unknown): WorkflowResearch {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    summary: cleanString(raw.summary, 1800),
    searchIntent: cleanString(raw.searchIntent, 800),
    audience: cleanString(raw.audience, 500),
    existingCoverage: cleanString(raw.existingCoverage, 1200),
    contentGaps: cleanStrings(raw.contentGaps, 10, 300),
    competitorNotes: cleanString(raw.competitorNotes, 1200),
    sources: cleanSources(raw.sources),
    primaryKeyword: cleanString(raw.primaryKeyword, 120),
    secondaryKeywords: cleanStrings(raw.secondaryKeywords, 15, 120),
    longTailKeywords: cleanStrings(raw.longTailKeywords, 15, 180),
  };
}

export function sanitizePlan(input: unknown): WorkflowPlan {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const outline = Array.isArray(raw.outline)
    ? raw.outline.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const heading = cleanString(row.heading, 180);
      if (!heading) return [];
      return [{ heading, purpose: cleanString(row.purpose, 500) }];
    }).slice(0, 16)
    : [];
  const internalLinks = Array.isArray(raw.internalLinks)
    ? raw.internalLinks.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const href = cleanString(row.href, 300);
      const label = cleanString(row.label, 120);
      if (!href || !label) return [];
      return [{ href, label, reason: cleanString(row.reason, 300) }];
    }).slice(0, 12)
    : [];
  return {
    title: cleanString(raw.title, 120),
    slug: cleanString(raw.slug, 120),
    primaryKeyword: cleanString(raw.primaryKeyword, 120),
    secondaryKeywords: cleanStrings(raw.secondaryKeywords, 15, 120),
    longTailKeywords: cleanStrings(raw.longTailKeywords, 15, 180),
    outline,
    internalLinks,
    schemaType: cleanString(raw.schemaType, 60),
    notes: cleanString(raw.notes, 1000),
  };
}

export function sanitizeDraft(input: unknown): WorkflowDraft {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    title: cleanString(raw.title, 180),
    slug: cleanString(raw.slug, 120),
    excerpt: cleanString(raw.excerpt, 500),
    contentHtml: cleanString(raw.contentHtml, 120_000),
    seoTitle: cleanString(raw.seoTitle, 70),
    seoDescription: cleanString(raw.seoDescription, 200),
    sourceNotes: cleanString(raw.sourceNotes, 6000),
    sources: cleanSources(raw.sources),
    internalLinks: Array.isArray(raw.internalLinks) ? sanitizePlan({ internalLinks: raw.internalLinks }).internalLinks : [],
    schemaType: cleanString(raw.schemaType, 60),
  };
}

export function normalizeGeneratedHtml(html: string): string {
  const withoutFence = html.replace(/^\s*```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  // The page template owns the single H1; generated content must begin at H2.
  const noH1 = withoutFence.replace(/<h1(\s[^>]*)?>/gi, "<h2>").replace(/<\/h1>/gi, "</h2>");
  return sanitizeBlogHtml(noH1);
}

/** Conservative HTML checks that don't rely on the model grading itself. */
export function runLocalSeoChecks(draft: WorkflowDraft): WorkflowReviewIssue[] {
  const issues: WorkflowReviewIssue[] = [];
  const title = draft.seoTitle ?? draft.title ?? "";
  const description = draft.seoDescription ?? draft.excerpt ?? "";
  const html = draft.contentHtml ?? "";
  if (title.length < 30 || title.length > 65) issues.push({ severity: "warning", area: "title", message: `SEO title is ${title.length} characters; aim for roughly 30–65.` });
  if (description.length < 110 || description.length > 175) issues.push({ severity: "warning", area: "meta", message: `Meta description is ${description.length} characters; aim for roughly 110–175.` });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug ?? "")) issues.push({ severity: "critical", area: "slug", message: "Slug must use lowercase words separated by hyphens." });
  const h2s = (html.match(/<h2\b/gi) ?? []).length;
  if (h2s < 2) issues.push({ severity: "critical", area: "structure", message: "Article needs at least two H2 sections beneath the page H1." });
  const internalLinks = html.match(/href="(\/[^"#?]*)/g) ?? [];
  if (internalLinks.length === 0) issues.push({ severity: "warning", area: "links", message: "Add at least one relevant internal link to a service, specialty or consultation page." });
  if (/\b(guarantee|guaranteed|100%|always|never)\b/i.test(html)) issues.push({ severity: "warning", area: "claims", message: "Review absolute or guarantee-style claims before publishing." });
  if (/(\$[\d,]+|\b\d+(?:\.\d+)?\s?%|\b(?:statistics|survey|study|research shows|studies show)\b)/i.test(html) && (draft.sources ?? []).length === 0) {
    issues.push({ severity: "critical", area: "sources", message: "Numeric or research-style claims require a credible source. Remove the claim or supply a verified source." });
  }
  if (/\b(CPT|ICD-10|CMS|Medicare|Medicaid|payer policy|timely filing)\b/i.test(html) && (draft.sources ?? []).length === 0) {
    issues.push({ severity: "warning", area: "policy", message: "Payer/coding references need human verification against current official guidance." });
  }
  if (!cleanString(draft.sourceNotes, 6000) && (draft.sources ?? []).length === 0) {
    issues.push({ severity: "warning", area: "sources", message: "No source notes or citations were supplied. Keep factual claims general and verifiable." });
  }
  return issues;
}

export function knownInternalPaths(): string[] {
  const paths = new Set<string>(["/", "/contact", "/schedule-form", "/blog", "/insights", "/services", "/specialties", "/who-we-serve", "/results", "/faq", "/about", "/our-process"]);
  for (const item of primaryNav) {
    paths.add(item.href);
    for (const child of [...(item.children ?? []), ...(item.columns?.flatMap((column) => column.items) ?? [])]) paths.add(child.href);
  }
  for (const group of serviceGroups) for (const slug of group.slugs) paths.add(`/services/${slug}`);
  return [...paths];
}

export function validateInternalLinks(links: WorkflowInternalLink[] | undefined): WorkflowInternalLink[] {
  const allowed = new Set(knownInternalPaths());
  return (links ?? []).filter((link) => {
    if (!link.href.startsWith("/") || link.href.startsWith("//")) return false;
    const path = link.href.split(/[?#]/)[0];
    return allowed.has(path);
  }).slice(0, 8);
}

export async function listContentWorkflows(limit = 30): Promise<WorkflowView[]> {
  try {
    const rows = await db
      .select({
        id: contentWorkflows.id,
        topic: contentWorkflows.topic,
        audience: contentWorkflows.audience,
        stage: contentWorkflows.stage,
        dataJson: contentWorkflows.dataJson,
        blogPostId: contentWorkflows.blogPostId,
        createdAt: contentWorkflows.createdAt,
        updatedAt: contentWorkflows.updatedAt,
        postId: blogPosts.id,
        postTitle: blogPosts.title,
        postSlug: blogPosts.slug,
        postStatus: blogPosts.status,
        postScheduledFor: blogPosts.scheduledFor,
        postUpdatedAt: blogPosts.updatedAt,
      })
      .from(contentWorkflows)
      .leftJoin(blogPosts, eq(contentWorkflows.blogPostId, blogPosts.id))
      .orderBy(desc(contentWorkflows.updatedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      audience: row.audience,
      stage: asStage(row.stage),
      data: parseJson(row.dataJson),
      blogPostId: row.blogPostId,
      post: row.postId ? {
        id: row.postId,
        title: row.postTitle ?? "",
        slug: row.postSlug ?? "",
        status: row.postStatus as BlogPostSummary["status"],
        scheduledFor: row.postScheduledFor,
        updatedAt: row.postUpdatedAt ?? new Date(),
        excerpt: null,
        featuredImage: null,
        featuredImageAlt: null,
        featuredImageWidth: null,
        featuredImageHeight: null,
        publishedAt: null,
        createdAt: row.postUpdatedAt ?? new Date(),
        readingTime: 0,
        author: "Knight Medical Billing",
        category: null,
        tags: [],
        media: null,
        viewCount: 0,
      } : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getContentWorkflow(id: number): Promise<WorkflowView | null> {
  const all = await listContentWorkflows(100);
  return all.find((row) => row.id === id) ?? null;
}

export async function createContentWorkflow(input: { topic: string; audience?: string; data: WorkflowData; stage: WorkflowStage }): Promise<number> {
  const [row] = await db.insert(contentWorkflows).values({
    topic: input.topic.slice(0, 240),
    audience: input.audience?.slice(0, 300) || null,
    stage: input.stage,
    dataJson: JSON.stringify(input.data),
  }).returning({ id: contentWorkflows.id });
  return row.id;
}

export async function updateContentWorkflow(id: number, data: WorkflowData, stage?: WorkflowStage): Promise<void> {
  await db.update(contentWorkflows).set({
    dataJson: JSON.stringify(data),
    ...(stage ? { stage } : {}),
    updatedAt: new Date(),
  }).where(eq(contentWorkflows.id, id));
}

export async function attachWorkflowPost(id: number, postId: number, data: WorkflowData, stage: WorkflowStage): Promise<void> {
  await db.update(contentWorkflows).set({
    blogPostId: postId,
    dataJson: JSON.stringify(data),
    stage,
    updatedAt: new Date(),
  }).where(eq(contentWorkflows.id, id));
}

export async function existingArticleContext(): Promise<{ titles: string[]; posts: { title: string; slug: string; excerpt: string | null }[] }> {
  const [result, insights] = await Promise.all([listAdminPosts({ page: 1, perPage: 100 }), getArticles()]);
  return {
    titles: [...result.posts.map((post) => post.title), ...insights.map((article) => article.title)],
    posts: result.posts.map((post) => ({ title: post.title, slug: post.slug, excerpt: post.excerpt })),
  };
}

export function buildDraftSourceNotes(data: WorkflowData): string {
  const sources = data.draft?.sources ?? data.research?.sources ?? [];
  const lines = [
    "AI-assisted draft. Human editorial and factual review completed before approval.",
    data.research?.summary ? `Research summary: ${data.research.summary}` : "",
    data.plan?.notes ? `Planning notes: ${data.plan.notes}` : "",
    ...sources.map((source) => `${source.title} — ${source.url}${source.note ? ` (${source.note})` : ""}`),
    "Do not treat any generated claim as verified without checking the linked source.",
  ];
  return lines.filter(Boolean).join("\n").slice(0, 6000);
}

export async function createDraftFromWorkflow(id: number, data: WorkflowData): Promise<{ postId: number; data: WorkflowData }> {
  const draft = data.draft;
  if (!draft?.title || !draft.contentHtml) throw new Error("The workflow has no completed draft.");
  const links = validateInternalLinks(draft.internalLinks ?? data.plan?.internalLinks);
  const postId = await createPost({
    title: draft.title,
    slug: draft.slug || data.plan?.slug || draft.title,
    excerpt: draft.excerpt,
    contentHtml: draft.contentHtml,
    author: "Knight Medical Billing",
    status: "draft", // AI output is never auto-published.
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    sourceNotes: draft.sourceNotes || buildDraftSourceNotes(data),
  });
  const nextData: WorkflowData = {
    ...data,
    blogPostId: postId,
    draft: { ...draft, internalLinks: links },
    plan: { ...(data.plan ?? {}), internalLinks: links },
  };
  await attachWorkflowPost(id, postId, nextData, "draft");
  return { postId, data: nextData };
}

export async function approveContentWorkflow(id: number, data: WorkflowData): Promise<WorkflowData> {
  if (!data.review) throw new Error("Run the SEO/factual review before approving.");
  if (data.review.passed !== true) throw new Error("Resolve critical review issues before approving.");
  const next = { ...data, approvedAt: new Date().toISOString() };
  await updateContentWorkflow(id, next, "approved");
  return next;
}

export async function publishApprovedWorkflow(id: number, data: WorkflowData): Promise<void> {
  if (!data.approvedAt || !data.blogPostId) throw new Error("Approve the workflow before publishing.");
  const post = await getAdminPost(data.blogPostId);
  if (!post) throw new Error("The draft post no longer exists.");
  await setPostStatus(data.blogPostId, "published");
  await updateContentWorkflow(id, { ...data, publishedAt: new Date().toISOString() }, "published");
}

export async function scheduleApprovedWorkflow(id: number, data: WorkflowData, scheduledFor: Date): Promise<void> {
  if (!data.approvedAt || !data.blogPostId) throw new Error("Approve the workflow before scheduling.");
  await setPostStatus(data.blogPostId, "scheduled", scheduledFor);
  await updateContentWorkflow(id, { ...data, scheduledFor: scheduledFor.toISOString() }, "scheduled");
}

export const contentSite = site;
