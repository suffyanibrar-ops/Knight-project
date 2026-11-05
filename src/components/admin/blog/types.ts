/**
 * Client-safe mirrors of the blog CMS JSON contracts.
 *
 * `src/lib/blog.ts` is server-only, so the editor/dashboard client components
 * cannot import its types. These declarations match the exact JSON emitted by
 * `/api/admin/blog/*` (Drizzle `Date` values are serialised as ISO strings).
 */

export const BLOG_STATUSES = ["draft", "scheduled", "published", "unpublished", "trashed"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export type BlogSort = "newest" | "oldest" | "updated";

export interface BlogCategoryRef {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface BlogTagRef {
  id: number;
  slug: string;
  name: string;
}

export interface BlogCategoryWithCount extends BlogCategoryRef {
  postCount: number;
}

export interface BlogTagWithCount extends BlogTagRef {
  postCount: number;
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
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedAt: string;
  createdAt: string;
  readingTime: number;
  author: string;
  category: BlogCategoryRef | null;
  tags: BlogTagRef[];
  media: BlogMediaRef | null;
  viewCount: number;
}

export interface BlogHeading {
  id: string;
  text: string;
  level: 2 | 3 | 4;
}

export interface BlogPostFull extends BlogPostSummary {
  contentHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  socialImage: string | null;
  sourceNotes: string | null;
  deletedAt: string | null;
  headings: BlogHeading[];
}

export interface PostsPage {
  posts: BlogPostSummary[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ media */

export interface ImportedMedia {
  id: number;
  width: number;
  height: number;
  format: string;
  src: string;
  srcSet: string;
  widths: number[];
  alt: string | null;
  caption: string | null;
  sourceUrl: string | null;
  license: string | null;
  attribution: string | null;
  deduplicated: boolean;
}

export interface ExternalMedia {
  mode: "external";
  url: string;
  warning: string;
  width: number | null;
  height: number | null;
}

export type MediaResponse = { ok: true; mode: "imported"; media: ImportedMedia } | { ok: true; mode: "external"; media: ExternalMedia };

/** Normalised media ready to use as a featured image or inside the article. */
export interface ResolvedMedia {
  mode: "imported" | "external";
  src: string;
  mediaId: number | null;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  license: string | null;
  attribution: string | null;
  warning: string | null;
}

export type PostAction = "publish" | "unpublish" | "schedule" | "duplicate" | "trash" | "restore";
