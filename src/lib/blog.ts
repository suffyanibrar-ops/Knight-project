import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNull, like, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  blogCategories,
  blogMedia,
  blogPostTags,
  blogPosts,
  blogRedirects,
  blogRevisions,
  blogTags,
} from "@/db/schema";
import { estimateReadingTime, extractHeadings, sanitizeBlogHtml, type BlogHeading } from "./blog-sanitize";

/**
 * Blog data layer.
 *
 * All public reads go through the "published and due" predicate, so drafts,
 * scheduled-in-the-future, unpublished and trashed rows can never leak into a
 * listing, an article page, a related-articles rail or the sitemap. Scheduled
 * posts are promoted lazily on read (no browser tab or external cron required)
 * and the same sweep can be triggered from the admin dashboard.
 */

export const BLOG_STATUSES = ["draft", "scheduled", "published", "unpublished", "trashed"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export type BlogSort = "newest" | "oldest" | "updated";

export interface BlogTagRef {
  id: number;
  slug: string;
  name: string;
}

export interface BlogCategoryRef {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface BlogMediaRef {
  id: number;
  width: number;
  height: number;
  alt: string | null;
  caption: string | null;
  sourceUrl: string | null;
  license: string | null;
  attribution: string | null;
}

export interface BlogPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  featuredImageWidth: number | null;
  featuredImageHeight: number | null;
  status: BlogStatus;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  updatedAt: Date;
  createdAt: Date;
  readingTime: number;
  author: string;
  category: BlogCategoryRef | null;
  tags: BlogTagRef[];
  media: BlogMediaRef | null;
  viewCount: number;
}

export interface BlogPostFull extends BlogPostSummary {
  contentHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  socialImage: string | null;
  sourceNotes: string | null;
  deletedAt: Date | null;
  headings: BlogHeading[];
}

export interface PaginatedPosts {
  posts: BlogPostSummary[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface BlogStats {
  total: number;
  published: number;
  drafts: number;
  scheduled: number;
  unpublished: number;
  trashed: number;
  categories: number;
  tags: number;
  recentlyUpdated: BlogPostSummary[];
}

export interface PostInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  contentHtml?: string;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  featuredImageWidth?: number | null;
  featuredImageHeight?: number | null;
  featuredMediaId?: number | null;
  author?: string;
  categoryId?: number | null;
  tagIds?: number[];
  status?: BlogStatus;
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  socialImage?: string | null;
  sourceNotes?: string | null;
}

const PER_PAGE_DEFAULT = 9;

/** URL-safe slug from arbitrary text. */
export function slugify(input: string, fallback = "post"): string {
  const base = (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90)
    .replace(/-+$/g, "");
  return base || fallback;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Promote scheduled posts whose time has arrived. Safe to call on any read. */
export async function publishDuePosts(): Promise<number> {
  try {
    const due = await db
      .select({ id: blogPosts.id, scheduledFor: blogPosts.scheduledFor })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.status, "scheduled"),
          isNull(blogPosts.deletedAt),
          lte(blogPosts.scheduledFor, new Date()),
        ),
      );
    if (!due.length) return 0;
    const now = new Date();
    for (const row of due) {
      await db
        .update(blogPosts)
        .set({ status: "published", publishedAt: row.scheduledFor ?? now, scheduledFor: null, updatedAt: now })
        .where(eq(blogPosts.id, row.id));
    }
    return due.length;
  } catch {
    return 0;
  }
}

function visiblePublicConditions() {
  return and(
    eq(blogPosts.status, "published"),
    isNull(blogPosts.deletedAt),
    lte(blogPosts.publishedAt, new Date()),
  );
}

async function hydrate(rows: (typeof blogPosts.$inferSelect)[]): Promise<BlogPostSummary[]> {
  if (!rows.length) return [];
  const categoryIds = [...new Set(rows.map((row) => row.categoryId).filter((id): id is number => typeof id === "number"))];
  const mediaIds = [...new Set(rows.map((row) => row.featuredMediaId).filter((id): id is number => typeof id === "number"))];
  const [categories, media, tagRows] = await Promise.all([
    categoryIds.length ? db.select().from(blogCategories).where(inArray(blogCategories.id, categoryIds)) : Promise.resolve([]),
    mediaIds.length ? db.select().from(blogMedia).where(inArray(blogMedia.id, mediaIds)) : Promise.resolve([]),
    db
      .select({ postId: blogPostTags.postId, id: blogTags.id, slug: blogTags.slug, name: blogTags.name })
      .from(blogPostTags)
      .innerJoin(blogTags, eq(blogPostTags.tagId, blogTags.id))
      .where(inArray(blogPostTags.postId, rows.map((row) => row.id))),
  ]);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const mediaMap = new Map(media.map((item) => [item.id, item]));
  const tagsByPost = new Map<number, BlogTagRef[]>();
  for (const tag of tagRows) {
    const list = tagsByPost.get(tag.postId) ?? [];
    list.push({ id: tag.id, slug: tag.slug, name: tag.name });
    tagsByPost.set(tag.postId, list);
  }
  return rows.map((row) => {
    const category = row.categoryId ? categoryMap.get(row.categoryId) : undefined;
    const item = row.featuredMediaId ? mediaMap.get(row.featuredMediaId) : undefined;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      featuredImage: row.featuredImage,
      featuredImageAlt: row.featuredImageAlt,
      featuredImageWidth: row.featuredImageWidth,
      featuredImageHeight: row.featuredImageHeight,
      status: row.status as BlogStatus,
      publishedAt: row.publishedAt,
      scheduledFor: row.scheduledFor,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      readingTime: row.readingTime,
      author: row.author,
      category: category ? { id: category.id, slug: category.slug, name: category.name, description: category.description } : null,
      tags: (tagsByPost.get(row.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      media: item
        ? { id: item.id, width: item.width, height: item.height, alt: item.alt, caption: item.caption, sourceUrl: item.sourceUrl, license: item.license, attribution: item.attribution }
        : null,
      viewCount: row.viewCount,
    };
  });
}

function fullFromSummary(summary: BlogPostSummary, row: typeof blogPosts.$inferSelect): BlogPostFull {
  return {
    ...summary,
    contentHtml: row.contentHtml,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    socialImage: row.socialImage,
    sourceNotes: row.sourceNotes,
    deletedAt: row.deletedAt,
    headings: extractHeadings(row.contentHtml),
  };
}

/* ------------------------------------------------------------------ public */

export async function listPublicPosts(options: {
  page?: number;
  perPage?: number;
  q?: string;
  categorySlug?: string;
  tagSlug?: string;
  sort?: "newest" | "oldest";
} = {}): Promise<PaginatedPosts> {
  await publishDuePosts();
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const perPage = Math.min(24, Math.max(1, Math.floor(options.perPage ?? PER_PAGE_DEFAULT)));
  try {
    const conditions = [visiblePublicConditions()];
    const q = options.q?.trim();
    if (q) {
      const pattern = `%${escapeLike(q.slice(0, 120))}%`;
      conditions.push(
        or(
          like(blogPosts.title, pattern),
          like(blogPosts.excerpt, pattern),
          like(blogPosts.contentHtml, pattern),
        )!,
      );
    }
    if (options.categorySlug) {
      const category = await db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, options.categorySlug)).limit(1);
      if (!category.length) return { posts: [], total: 0, page, perPage, totalPages: 0 };
      conditions.push(eq(blogPosts.categoryId, category[0].id));
    }
    if (options.tagSlug) {
      const tagged = db
        .select({ postId: blogPostTags.postId })
        .from(blogPostTags)
        .innerJoin(blogTags, eq(blogPostTags.tagId, blogTags.id))
        .where(eq(blogTags.slug, options.tagSlug));
      conditions.push(inArray(blogPosts.id, tagged));
    }
    const where = and(...conditions);
    const [{ value: total }] = await db.select({ value: count() }).from(blogPosts).where(where);
    const rows = await db
      .select()
      .from(blogPosts)
      .where(where)
      .orderBy(options.sort === "oldest" ? asc(blogPosts.publishedAt) : desc(blogPosts.publishedAt))
      .limit(perPage)
      .offset((page - 1) * perPage);
    const posts = await hydrate(rows);
    return { posts, total: Number(total), page, perPage, totalPages: Math.ceil(Number(total) / perPage) };
  } catch {
    return { posts: [], total: 0, page, perPage, totalPages: 0 };
  }
}

export async function getPublicPost(slug: string): Promise<{ post: BlogPostFull } | { redirectTo: string } | null> {
  await publishDuePosts();
  try {
    const rows = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    if (!rows.length) {
      const redirect = await lookupRedirect(`/blog/${slug}`);
      return redirect ? { redirectTo: redirect } : null;
    }
    const row = rows[0];
    const isVisible = row.status === "published" && !row.deletedAt && row.publishedAt && row.publishedAt.getTime() <= Date.now();
    if (!isVisible) {
      const redirect = await lookupRedirect(`/blog/${slug}`);
      return redirect ? { redirectTo: redirect } : null;
    }
    // Defence in depth: re-run the allow-list at render time as well, so a row
    // written by an older build (or edited directly in SQLite) can never emit
    // unsafe markup to visitors.
    const renderRow = { ...row, contentHtml: sanitizeBlogHtml(row.contentHtml) };
    const [summary] = await hydrate([renderRow]);
    return { post: fullFromSummary(summary, renderRow) };
  } catch {
    return null;
  }
}

export async function lookupRedirect(fromPath: string): Promise<string | null> {
  try {
    const rows = await db.select({ toPath: blogRedirects.toPath }).from(blogRedirects).where(eq(blogRedirects.fromPath, fromPath)).limit(1);
    return rows[0]?.toPath ?? null;
  } catch {
    return null;
  }
}

export async function getRelatedPosts(post: BlogPostFull, limit = 3): Promise<BlogPostSummary[]> {
  try {
    const conditions = [visiblePublicConditions(), ne(blogPosts.id, post.id)];
    const categoryId = post.category?.id ?? null;
    const rows = categoryId
      ? await db.select().from(blogPosts).where(and(...conditions, eq(blogPosts.categoryId, categoryId))).orderBy(desc(blogPosts.publishedAt)).limit(limit)
      : [];
    if (rows.length >= limit) return hydrate(rows);
    const seen = new Set(rows.map((row) => row.id));
    const filler = await db.select().from(blogPosts).where(and(...conditions)).orderBy(desc(blogPosts.publishedAt)).limit(limit + 3);
    const merged = [...rows, ...filler.filter((row) => !seen.has(row.id))].slice(0, limit);
    return hydrate(merged);
  } catch {
    return [];
  }
}

export async function getAdjacentPosts(post: BlogPostFull): Promise<{ previous: BlogPostSummary | null; next: BlogPostSummary | null }> {
  try {
    const publishedAt = post.publishedAt ?? new Date(0);
    const [older, newer] = await Promise.all([
      db.select().from(blogPosts).where(and(visiblePublicConditions(), gt(blogPosts.publishedAt, publishedAt))).orderBy(asc(blogPosts.publishedAt)).limit(1),
      db.select().from(blogPosts).where(and(visiblePublicConditions(), lte(blogPosts.publishedAt, publishedAt), ne(blogPosts.id, post.id))).orderBy(desc(blogPosts.publishedAt)).limit(1),
    ]);
    const [previous] = older.length ? await hydrate(older) : [];
    const [next] = newer.length ? await hydrate(newer) : [];
    return { previous: previous ?? null, next: next ?? null };
  } catch {
    return { previous: null, next: null };
  }
}

export async function getCategoryBySlug(slug: string): Promise<BlogCategoryRef | null> {
  try {
    const rows = await db.select().from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
    const row = rows[0];
    return row ? { id: row.id, slug: row.slug, name: row.name, description: row.description } : null;
  } catch {
    return null;
  }
}

export async function getTagBySlug(slug: string): Promise<BlogTagRef | null> {
  try {
    const rows = await db.select().from(blogTags).where(eq(blogTags.slug, slug)).limit(1);
    const row = rows[0];
    return row ? { id: row.id, slug: row.slug, name: row.name } : null;
  } catch {
    return null;
  }
}

export async function listCategoriesWithCounts(): Promise<(BlogCategoryRef & { count: number })[]> {
  try {
    const rows = await db.select().from(blogCategories).orderBy(asc(blogCategories.name));
    const counts = await db
      .select({ categoryId: blogPosts.categoryId, value: count() })
      .from(blogPosts)
      .where(visiblePublicConditions())
      .groupBy(blogPosts.categoryId);
    const map = new Map(counts.map((row) => [row.categoryId, Number(row.value)]));
    return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, description: row.description, count: map.get(row.id) ?? 0 }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------- admin */

export async function listAdminPosts(options: {
  q?: string;
  status?: BlogStatus | "all";
  categoryId?: number;
  sort?: BlogSort;
  page?: number;
  perPage?: number;
} = {}): Promise<PaginatedPosts> {
  await publishDuePosts();
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(options.perPage ?? 20)));
  try {
    const conditions = [];
    const q = options.q?.trim();
    if (q) {
      const pattern = `%${escapeLike(q.slice(0, 120))}%`;
      conditions.push(or(like(blogPosts.title, pattern), like(blogPosts.slug, pattern), like(blogPosts.contentHtml, pattern))!);
    }
    if (options.status && options.status !== "all") conditions.push(eq(blogPosts.status, options.status));
    else conditions.push(ne(blogPosts.status, "trashed"));
    if (options.categoryId) conditions.push(eq(blogPosts.categoryId, options.categoryId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [{ value: total }] = await db.select({ value: count() }).from(blogPosts).where(where);
    const order = options.sort === "oldest" ? asc(blogPosts.createdAt) : options.sort === "updated" ? desc(blogPosts.updatedAt) : desc(blogPosts.createdAt);
    const rows = await db.select().from(blogPosts).where(where).orderBy(order).limit(perPage).offset((page - 1) * perPage);
    const posts = await hydrate(rows);
    return { posts, total: Number(total), page, perPage, totalPages: Math.ceil(Number(total) / perPage) };
  } catch {
    return { posts: [], total: 0, page, perPage, totalPages: 0 };
  }
}

export async function getAdminPost(id: number): Promise<BlogPostFull | null> {
  try {
    const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
    if (!rows.length) return null;
    const [summary] = await hydrate(rows);
    return fullFromSummary(summary, rows[0]);
  } catch {
    return null;
  }
}

export async function getBlogStats(): Promise<BlogStats> {
  await publishDuePosts();
  try {
    const groups = await db.select({ status: blogPosts.status, value: count() }).from(blogPosts).groupBy(blogPosts.status);
    const map = new Map(groups.map((row) => [row.status, Number(row.value)]));
    const [{ value: categories }] = await db.select({ value: count() }).from(blogCategories);
    const [{ value: tags }] = await db.select({ value: count() }).from(blogTags);
    const recent = await db
      .select()
      .from(blogPosts)
      .where(ne(blogPosts.status, "trashed"))
      .orderBy(desc(blogPosts.updatedAt))
      .limit(5);
    return {
      total: [...map.values()].reduce((sum, value) => sum + value, 0),
      published: map.get("published") ?? 0,
      drafts: map.get("draft") ?? 0,
      scheduled: map.get("scheduled") ?? 0,
      unpublished: map.get("unpublished") ?? 0,
      trashed: map.get("trashed") ?? 0,
      categories: Number(categories),
      tags: Number(tags),
      recentlyUpdated: await hydrate(recent),
    };
  } catch {
    return { total: 0, published: 0, drafts: 0, scheduled: 0, unpublished: 0, trashed: 0, categories: 0, tags: 0, recentlyUpdated: [] };
  }
}

async function slugTaken(slug: string, excludeId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(excludeId ? and(eq(blogPosts.slug, slug), ne(blogPosts.id, excludeId)) : eq(blogPosts.slug, slug))
    .limit(1);
  return rows.length > 0;
}

export async function ensureUniqueSlug(base: string, excludeId?: number): Promise<string> {
  const root = slugify(base);
  if (!(await slugTaken(root, excludeId))) return root;
  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await slugTaken(candidate, excludeId))) return candidate;
  }
  return `${root}-${Date.now()}`;
}

function normalizeStatusInput(input: PostInput): { status: BlogStatus; publishedAt: Date | null; scheduledFor: Date | null } {
  const status = (BLOG_STATUSES as readonly string[]).includes(input.status ?? "") ? (input.status as BlogStatus) : "draft";
  const now = new Date();
  if (status === "published") return { status, publishedAt: input.publishedAt ?? now, scheduledFor: null };
  if (status === "scheduled") {
    if (!input.scheduledFor) throw new Error("A scheduled post needs a publication date.");
    if (input.scheduledFor.getTime() <= now.getTime()) return { status: "published", publishedAt: input.publishedAt ?? now, scheduledFor: null };
    return { status, publishedAt: input.publishedAt ?? null, scheduledFor: input.scheduledFor };
  }
  return { status, publishedAt: input.publishedAt ?? null, scheduledFor: input.scheduledFor ?? null };
}

async function syncTags(postId: number, tagIds: number[] | undefined): Promise<void> {
  if (!tagIds) return;
  await db.delete(blogPostTags).where(eq(blogPostTags.postId, postId));
  const unique = [...new Set(tagIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (unique.length) await db.insert(blogPostTags).values(unique.map((tagId) => ({ postId, tagId }))).onConflictDoNothing();
}

export async function createPost(input: PostInput): Promise<number> {
  if (!input.title?.trim()) throw new Error("A title is required.");
  const slug = await ensureUniqueSlug(input.slug?.trim() || input.title);
  const status = normalizeStatusInput(input);
  const contentHtml = sanitizeBlogHtml(input.contentHtml ?? "");
  const [row] = await db
    .insert(blogPosts)
    .values({
      title: input.title.trim().slice(0, 240),
      slug,
      excerpt: input.excerpt?.slice(0, 500) ?? null,
      contentHtml,
      featuredMediaId: input.featuredMediaId ?? null,
      featuredImage: input.featuredImage ?? null,
      featuredImageAlt: input.featuredImageAlt ?? null,
      featuredImageWidth: input.featuredImageWidth ?? null,
      featuredImageHeight: input.featuredImageHeight ?? null,
      author: (input.author?.trim() || "Knight Medical Billing").slice(0, 120),
      categoryId: input.categoryId ?? null,
      status: status.status,
      publishedAt: status.publishedAt,
      scheduledFor: status.scheduledFor,
      seoTitle: input.seoTitle?.slice(0, 70) ?? null,
      seoDescription: input.seoDescription?.slice(0, 200) ?? null,
      canonicalUrl: input.canonicalUrl?.slice(0, 400) ?? null,
      socialImage: input.socialImage ?? null,
      readingTime: estimateReadingTime(contentHtml),
      sourceNotes: input.sourceNotes?.slice(0, 4000) ?? null,
      updatedAt: new Date(),
    })
    .returning({ id: blogPosts.id });
  await syncTags(row.id, input.tagIds);
  await saveRevision(row.id, "created");
  return row.id;
}

export async function updatePost(id: number, input: PostInput): Promise<number> {
  const current = await getAdminPost(id);
  if (!current) throw new Error("Post not found.");
  if (!input.title?.trim()) throw new Error("A title is required.");
  const status = normalizeStatusInput(input);
  const requestedSlug = input.slug?.trim();
  let slug = current.slug;
  if (requestedSlug) {
    const candidate = slugify(requestedSlug);
    slug = (await slugTaken(candidate, id)) ? await ensureUniqueSlug(candidate, id) : candidate;
  }
  const contentHtml = sanitizeBlogHtml(input.contentHtml ?? current.contentHtml);
  const changedContent = contentHtml !== current.contentHtml;

  await db
    .update(blogPosts)
    .set({
      title: input.title.trim().slice(0, 240),
      slug,
      excerpt: input.excerpt?.slice(0, 500) ?? null,
      contentHtml,
      featuredMediaId: input.featuredMediaId ?? null,
      featuredImage: input.featuredImage ?? null,
      featuredImageAlt: input.featuredImageAlt ?? null,
      featuredImageWidth: input.featuredImageWidth ?? null,
      featuredImageHeight: input.featuredImageHeight ?? null,
      author: (input.author?.trim() || current.author).slice(0, 120),
      categoryId: input.categoryId ?? null,
      status: status.status,
      publishedAt: status.status === "published" ? current.publishedAt ?? status.publishedAt : status.publishedAt,
      scheduledFor: status.scheduledFor,
      seoTitle: input.seoTitle?.slice(0, 70) ?? null,
      seoDescription: input.seoDescription?.slice(0, 200) ?? null,
      canonicalUrl: input.canonicalUrl?.slice(0, 400) ?? null,
      socialImage: input.socialImage ?? null,
      readingTime: estimateReadingTime(contentHtml),
      sourceNotes: input.sourceNotes?.slice(0, 4000) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, id));

  // Keep the old public URL working when a published slug changes.
  if (slug !== current.slug && current.status === "published") {
    await db
      .insert(blogRedirects)
      .values({ fromPath: `/blog/${current.slug}`, toPath: `/blog/${slug}`, postId: id })
      .onConflictDoUpdate({ target: blogRedirects.fromPath, set: { toPath: `/blog/${slug}`, postId: id } });
  }

  await syncTags(id, input.tagIds ?? current.tags.map((tag) => tag.id));
  if (changedContent) await saveRevision(id, "updated");
  else await saveRevision(id, "settings");
  return id;
}

export async function saveRevision(postId: number, note: string): Promise<void> {
  try {
    const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
    if (!rows.length) return;
    const row = rows[0];
    await db.insert(blogRevisions).values({
      postId,
      title: row.title,
      excerpt: row.excerpt,
      contentHtml: row.contentHtml,
      status: `${row.status}${note ? `:${note}` : ""}`.slice(0, 40),
    });
    const old = await db
      .select({ id: blogRevisions.id })
      .from(blogRevisions)
      .where(eq(blogRevisions.postId, postId))
      .orderBy(desc(blogRevisions.createdAt))
      .limit(100);
    if (old.length > 20) {
      const stale = old.slice(20).map((item) => item.id);
      if (stale.length) await db.delete(blogRevisions).where(inArray(blogRevisions.id, stale));
    }
  } catch {
    // Revisions are a convenience; never fail the write because of them.
  }
}

export async function setPostStatus(id: number, status: BlogStatus, scheduledFor?: Date | null): Promise<void> {
  const now = new Date();
  if (status === "published") {
    await db.update(blogPosts).set({ status: "published", publishedAt: now, scheduledFor: null, deletedAt: null, updatedAt: now }).where(eq(blogPosts.id, id));
  } else if (status === "scheduled") {
    if (!scheduledFor || scheduledFor.getTime() <= now.getTime()) {
      await db.update(blogPosts).set({ status: "published", publishedAt: now, scheduledFor: null, updatedAt: now }).where(eq(blogPosts.id, id));
    } else {
      await db.update(blogPosts).set({ status: "scheduled", scheduledFor, updatedAt: now }).where(eq(blogPosts.id, id));
    }
  } else {
    await db.update(blogPosts).set({ status, updatedAt: now }).where(eq(blogPosts.id, id));
  }
}

export async function trashPost(id: number): Promise<void> {
  await db.update(blogPosts).set({ status: "trashed", deletedAt: new Date(), updatedAt: new Date() }).where(eq(blogPosts.id, id));
}

export async function restorePost(id: number): Promise<void> {
  await db.update(blogPosts).set({ status: "draft", deletedAt: null, updatedAt: new Date() }).where(eq(blogPosts.id, id));
}

export async function deletePostForever(id: number): Promise<void> {
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
}

export async function duplicatePost(id: number): Promise<number> {
  const source = await getAdminPost(id);
  if (!source) throw new Error("Post not found.");
  return createPost({
    title: `${source.title} (copy)`,
    slug: await ensureUniqueSlug(`${source.slug}-copy`),
    excerpt: source.excerpt,
    contentHtml: source.contentHtml,
    featuredImage: source.featuredImage,
    featuredImageAlt: source.featuredImageAlt,
    featuredImageWidth: source.featuredImageWidth,
    featuredImageHeight: source.featuredImageHeight,
    featuredMediaId: source.media?.id ?? null,
    author: source.author,
    categoryId: source.category?.id ?? null,
    tagIds: source.tags.map((tag) => tag.id),
    status: "draft",
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
    canonicalUrl: source.canonicalUrl,
    socialImage: source.socialImage,
    sourceNotes: source.sourceNotes,
  });
}

/* -------------------------------------------------------- categories/tags */

export async function listAdminCategories(): Promise<(BlogCategoryRef & { postCount: number })[]> {
  try {
    const rows = await db.select().from(blogCategories).orderBy(asc(blogCategories.name));
    const counts = await db.select({ categoryId: blogPosts.categoryId, value: count() }).from(blogPosts).groupBy(blogPosts.categoryId);
    const map = new Map(counts.map((row) => [row.categoryId, Number(row.value)]));
    return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, description: row.description, postCount: map.get(row.id) ?? 0 }));
  } catch {
    return [];
  }
}

export async function createCategory(input: { name: string; slug?: string; description?: string | null }): Promise<number> {
  const name = input.name?.trim();
  if (!name) throw new Error("A category name is required.");
  const slug = slugify(input.slug?.trim() || name);
  const existing = await db.select({ id: blogCategories.id }).from(blogCategories).where(eq(blogCategories.slug, slug)).limit(1);
  if (existing.length) throw new Error("A category with that slug already exists.");
  const [row] = await db.insert(blogCategories).values({ name: name.slice(0, 120), slug, description: input.description?.slice(0, 400) ?? null }).returning({ id: blogCategories.id });
  return row.id;
}

export async function updateCategory(id: number, input: { name: string; slug?: string; description?: string | null }): Promise<void> {
  const name = input.name?.trim();
  if (!name) throw new Error("A category name is required.");
  const slug = slugify(input.slug?.trim() || name);
  const clash = await db.select({ id: blogCategories.id }).from(blogCategories).where(and(eq(blogCategories.slug, slug), ne(blogCategories.id, id))).limit(1);
  if (clash.length) throw new Error("Another category already uses that slug.");
  await db.update(blogCategories).set({ name: name.slice(0, 120), slug, description: input.description?.slice(0, 400) ?? null, updatedAt: new Date() }).where(eq(blogCategories.id, id));
}

export async function deleteCategory(id: number): Promise<void> {
  const used = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.categoryId, id)).limit(1);
  if (used.length) throw new Error("This category is still assigned to posts. Reassign them before deleting it.");
  await db.delete(blogCategories).where(eq(blogCategories.id, id));
}

export async function listTags(): Promise<(BlogTagRef & { postCount: number })[]> {
  try {
    const rows = await db.select().from(blogTags).orderBy(asc(blogTags.name));
    const counts = await db
      .select({ tagId: blogPostTags.tagId, value: count() })
      .from(blogPostTags)
      .groupBy(blogPostTags.tagId);
    const map = new Map(counts.map((row) => [row.tagId, Number(row.value)]));
    return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, postCount: map.get(row.id) ?? 0 }));
  } catch {
    return [];
  }
}

export async function createTag(input: { name: string; slug?: string }): Promise<number> {
  const name = input.name?.trim();
  if (!name) throw new Error("A tag name is required.");
  const slug = slugify(input.slug?.trim() || name);
  const existing = await db.select({ id: blogTags.id }).from(blogTags).where(eq(blogTags.slug, slug)).limit(1);
  if (existing.length) return existing[0].id;
  const [row] = await db.insert(blogTags).values({ name: name.slice(0, 80), slug }).returning({ id: blogTags.id });
  return row.id;
}

export async function deleteTag(id: number): Promise<void> {
  await db.delete(blogTags).where(eq(blogTags.id, id));
}

/** Small helper used by the admin dashboard action. */
export async function countDueScheduled(): Promise<number> {
  try {
    const [{ value }] = await db
      .select({ value: count() })
      .from(blogPosts)
      .where(and(eq(blogPosts.status, "scheduled"), lte(blogPosts.scheduledFor, new Date())));
    return Number(value);
  } catch {
    return 0;
  }
}
