import { FileText } from "lucide-react";
import Link from "next/link";
import type { BlogCategoryRef, BlogTagRef, PaginatedPosts } from "@/lib/blog";
import { CtaBand } from "@/components/cta-band";
import { BlogSidebar } from "./blog-sidebar";
import { Pagination } from "./pagination";
import { PostCard } from "./post-card";
import { BlogSearchForm } from "./search-form";

/**
 * Shared shell for /blog/category/[slug] and /blog/tag/[slug]: the same hero,
 * post grid, sidebar and pagination as the main listing.
 */
export function BlogArchiveView({
  eyebrow,
  title,
  description,
  countLabel,
  result,
  categories,
  tags,
  activeCategory,
  activeTag,
  basePath,
  emptyTitle,
  emptyDescription,
}: {
  eyebrow: string;
  title: string;
  description: string | null;
  countLabel: string;
  result: PaginatedPosts;
  categories: (BlogCategoryRef & { count: number })[];
  tags: (BlogTagRef & { postCount: number })[];
  activeCategory?: string;
  activeTag?: string;
  basePath: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-mist-200 bg-night text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="grid-lines absolute inset-0 opacity-[0.14]" />
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-brand-500/25 blur-[110px]" />
          <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-mint-500/15 blur-[100px]" />
        </div>
        <div className="shell relative py-11 sm:py-14">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold text-white/55">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <span aria-hidden className="text-white/25">/</span>
            <Link href="/blog" className="transition-colors hover:text-white">
              Blog
            </Link>
            <span aria-hidden className="text-white/25">/</span>
            <span className="text-white/85">{eyebrow}</span>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <span className="eyebrow text-brand-200">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-300" /> {eyebrow}
              </span>
              <h1 className="mt-3 text-[clamp(1.9rem,4.2vw,2.8rem)] font-extrabold leading-[1.06] tracking-[-0.04em]">{title}</h1>
              {description ? <p className="mt-3.5 max-w-2xl text-[0.93rem] leading-relaxed text-white/65">{description}</p> : null}
              <p className="mt-4 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/40">{countLabel}</p>
            </div>
            <div>
              <BlogSearchForm />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-12 sm:py-16">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
          <div className="min-w-0">
            {result.posts.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {result.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-mist-300 bg-mist-50 px-6 py-14 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-brand-700 shadow-sm">
                  <FileText aria-hidden className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-[1.15rem] font-extrabold tracking-tight text-ink-950">{emptyTitle}</h2>
                <p className="mx-auto mt-2 max-w-md text-[0.86rem] leading-relaxed text-ink-600/80">{emptyDescription}</p>
                <Link href="/blog" className="btn btn-primary mt-5 px-5 py-3 text-[0.8rem]">
                  Browse all articles
                </Link>
              </div>
            )}

            <Pagination page={result.page} totalPages={result.totalPages} basePath={basePath} />
          </div>

          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <BlogSidebar categories={categories} tags={tags} activeCategory={activeCategory} activeTag={activeTag} />
          </aside>
        </div>
      </section>

      <CtaBand title="Want these ideas applied to your billing?" description="A free consultation reviews your current process, claim acceptance and outstanding A/R — no prepayment, no hidden fees." />
    </>
  );
}
