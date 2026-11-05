import type { Metadata } from "next";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { BlogSidebar } from "@/components/blog/blog-sidebar";
import { Pagination } from "@/components/blog/pagination";
import { PostCard } from "@/components/blog/post-card";
import { BlogSearchForm } from "@/components/blog/search-form";
import { listCategoriesWithCounts, listPublicPosts, listTags } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

const PER_PAGE = 9;

type BlogSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function currentPage(value: string | string[] | undefined): number {
  const parsed = Number(firstValue(value));
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

/** Page 1 is canonical at /blog; deeper pages canonicalise to themselves. */
function canonicalPath(page: number): string {
  return page > 1 ? `/blog?page=${page}` : "/blog";
}

export async function generateMetadata({ searchParams }: { searchParams: BlogSearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const page = currentPage(params.page);
  const query = firstValue(params.q).trim();

  if (query) {
    return pageMetadata({
      title: `Search results for “${query.slice(0, 80)}”`,
      description: `Articles on the ${site.name} blog matching “${query.slice(0, 120)}”.`,
      path: `/blog?q=${encodeURIComponent(query)}`,
      noindex: true,
    });
  }

  return pageMetadata({
    title: page > 1 ? `Billing insights — page ${page}` : "Medical billing insights, guides and playbooks",
    description:
      "Practical medical billing, coding and revenue cycle guides from the Knight Medical Billing team: clean claims, eligibility, A/R follow-up, credentialing, out-of-network negotiation and more.",
    path: canonicalPath(page),
    keywords: ["medical billing insights", "revenue cycle management guides", "medical billing blog"],
  });
}

export default async function BlogPage({ searchParams }: { searchParams: BlogSearchParams }) {
  const params = await searchParams;
  const page = currentPage(params.page);
  const query = firstValue(params.q).trim().slice(0, 120);

  const [result, categories, tags] = await Promise.all([
    listPublicPosts({ page, perPage: PER_PAGE, q: query }),
    listCategoriesWithCounts(),
    listTags(),
  ]);

  const featured = !query && page === 1 ? result.posts[0] ?? null : null;
  const posts = featured ? result.posts.slice(1) : result.posts;

  if (result.totalPages > 0 && page > result.totalPages) notFound();

  return (
    <>
      <section className="relative overflow-hidden border-b border-mist-200 bg-night text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="grid-lines absolute inset-0 opacity-[0.14]" />
          <div className="absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-brand-500/25 blur-[110px]" />
          <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-mint-500/15 blur-[100px]" />
        </div>
        <div className="shell relative py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold text-white/55">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <span aria-hidden className="text-white/25">/</span>
            <span className="text-white/85">Blog</span>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <span className="eyebrow text-brand-200">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-300" /> The Knight blog
              </span>
              <h1 className="mt-3 text-[clamp(2rem,4.6vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.04em]">
                Notes from the <span className="display-serif text-brand-300">revenue front line.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-white/65">
                Practical guides on medical billing, coding and revenue cycle management — written by the people who run the work every day, not a content agency.
              </p>
            </div>
            <div>
              <BlogSearchForm defaultValue={query} />
              <p className="mt-3 text-[0.72rem] font-semibold text-white/45">Search by topic, payer issue or workflow.</p>
            </div>
          </div>

          {categories.some((category) => category.count > 0) ? (
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-white/40">Browse</span>
              {categories
                .filter((category) => category.count > 0)
                .map((category) => (
                  <Link
                    key={category.slug}
                    href={`/blog/category/${category.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[0.72rem] font-bold text-white/80 transition-colors hover:border-brand-300/50 hover:bg-white/10 hover:text-white"
                  >
                    {category.name}
                    <span className="text-[0.6rem] font-extrabold text-white/40">{category.count}</span>
                  </Link>
                ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-surface py-12 sm:py-16">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
          <div className="min-w-0">
            {query ? (
              <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-mist-50 px-4 py-3">
                <p className="text-[0.82rem] font-semibold text-ink-700">
                  {result.total === 0 ? "No results for " : `${result.total} result${result.total === 1 ? "" : "s"} for `}
                  <span className="font-extrabold text-ink-950">“{query}”</span>
                </p>
                <Link href="/blog" className="text-[0.74rem] font-extrabold text-brand-700 hover:text-brand-500">
                  Clear search
                </Link>
              </div>
            ) : null}

            {featured ? (
              <div className="mb-8">
                <PostCard post={featured} featured priority />
              </div>
            ) : null}

            {posts.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : null}

            {result.total === 0 ? (
              <div className="rounded-3xl border border-dashed border-mist-300 bg-mist-50 px-6 py-14 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-brand-700 shadow-sm">
                  <FileText aria-hidden className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-[1.15rem] font-extrabold tracking-tight text-ink-950">
                  {query ? "No articles match that search" : "No articles published yet"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-[0.86rem] leading-relaxed text-ink-600/80">
                  {query
                    ? "Try a broader term, or browse the categories in the sidebar. New guides are added regularly."
                    : "The first articles are on their way. In the meantime, our services and process pages cover the same ground in detail."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  <Link href={query ? "/blog" : "/insights"} className="btn btn-primary px-5 py-3 text-[0.8rem]">
                    {query ? "Back to all articles" : "Browse insights"} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </Link>
                  <Link href="/services" className="btn btn-light px-5 py-3 text-[0.8rem]">
                    Our services
                  </Link>
                </div>
              </div>
            ) : null}

            <Pagination page={result.page} totalPages={result.totalPages} basePath="/blog" query={{ q: query || undefined }} />
          </div>

          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <BlogSidebar categories={categories} tags={tags} />
          </aside>
        </div>
      </section>

      <CtaBand title="Want this applied to your billing?" description="Reading is a good start. A free consultation shows you exactly where your revenue cycle is leaking — and what a dedicated Knight team would do about it." />
    </>
  );
}
