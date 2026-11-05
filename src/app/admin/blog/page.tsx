import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FolderTree, Newspaper, PenSquare, Search } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { AdminPageHeader, EmptyState, StatCard, formatDate } from "@/components/admin/ui";
import { getBlogStats, listAdminCategories, listAdminPosts, type BlogSort, type BlogStatus } from "@/lib/blog";
import { BlogStatusBadge } from "@/components/admin/blog/status-badge";
import { PostRowActions } from "@/components/admin/blog/post-row-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog · Admin Console",
  robots: { index: false, follow: false, nocache: true },
};

type SearchParams = { q?: string; status?: string; category?: string; sort?: string; page?: string };

const STATUS_FILTERS = ["all", "draft", "scheduled", "published", "unpublished", "trashed"] as const;

function isStatus(value: string): value is BlogStatus | "all" {
  return (STATUS_FILTERS as readonly string[]).includes(value);
}

export default async function BlogDashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const statusParam = params.status ?? "all";
  const status: BlogStatus | "all" = isStatus(statusParam) ? statusParam : "all";
  const categoryValue = Number(params.category);
  const categoryId = Number.isInteger(categoryValue) && categoryValue > 0 ? categoryValue : undefined;
  const sortParam = params.sort ?? "newest";
  const sort: BlogSort = sortParam === "oldest" || sortParam === "updated" ? sortParam : "newest";
  const pageValue = Number(params.page);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;

  const [result, stats, categories] = await Promise.all([
    listAdminPosts({ q: q || undefined, status, categoryId, sort, page }),
    getBlogStats(),
    listAdminCategories(),
  ]);

  function pageHref(targetPage: number) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "all") search.set("status", status);
    if (categoryId) search.set("category", String(categoryId));
    if (sort !== "newest") search.set("sort", sort);
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return `/admin/blog${query ? `?${query}` : ""}`;
  }

  const filtered = Boolean(q) || status !== "all" || categoryId !== undefined;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Blog"
        description="Write, schedule and publish articles. Drafts and scheduled posts are visible only in this console — the public site shows published posts only."
        actions={
          <>
            <Link
              href="/admin/blog/categories"
              className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
            >
              <FolderTree className="h-3.5 w-3.5" /> Categories &amp; tags
            </Link>
            <Link
              href="/admin/blog/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600"
            >
              <PenSquare className="h-3.5 w-3.5" /> New post
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="All posts" value={stats.total} tone="brand" />
        <StatCard label="Published" value={stats.published} hint="Live on the site" tone="good" />
        <StatCard label="Drafts" value={stats.drafts} />
        <StatCard label="Scheduled" value={stats.scheduled} hint="Publish automatically" tone="warn" />
        <StatCard label="Unpublished" value={stats.unpublished} />
        <StatCard label="In trash" value={stats.trashed} />
      </div>

      <form action="/admin/blog" className="grid gap-2 rounded-2xl border border-mist-200 bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_11rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/40" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search title, slug or content…"
            aria-label="Search posts"
            className="w-full rounded-xl border border-mist-200 py-2.5 pl-9 pr-3 text-[0.8rem] text-ink-900 outline-none placeholder:text-ink-600/40 focus:border-brand-400"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter by status"
          className="rounded-xl border border-mist-200 bg-surface px-3 py-2.5 text-[0.78rem] font-semibold capitalize text-ink-800 outline-none focus:border-brand-400"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All statuses" : option}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={categoryId ? String(categoryId) : ""}
          aria-label="Filter by category"
          className="rounded-xl border border-mist-200 bg-surface px-3 py-2.5 text-[0.78rem] font-semibold text-ink-800 outline-none focus:border-brand-400"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          aria-label="Sort posts"
          className="rounded-xl border border-mist-200 bg-surface px-3 py-2.5 text-[0.78rem] font-semibold text-ink-800 outline-none focus:border-brand-400"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated">Recently updated</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="rounded-xl bg-night-soft px-4 py-2.5 text-[0.76rem] font-bold text-white transition-colors hover:bg-brand-600">
            Apply
          </button>
          {filtered && (
            <Link href="/admin/blog" className="rounded-xl border border-mist-200 px-4 py-2.5 text-center text-[0.76rem] font-bold text-ink-700 transition-colors hover:border-brand-300">
              Reset
            </Link>
          )}
        </div>
      </form>

      {stats.recentlyUpdated.length > 0 && (
        <section className="rounded-2xl border border-mist-200 bg-surface p-4">
          <h2 className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70">Recently updated</h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {stats.recentlyUpdated.map((post) => (
              <li key={post.id} className="min-w-0">
                <Link href={`/admin/blog/${post.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-mist-50">
                  <BlogStatusBadge status={post.status} />
                  <span className="truncate text-[0.74rem] font-semibold text-ink-800">{post.title}</span>
                  <span className="ml-auto shrink-0 text-[0.62rem] text-ink-600/60">{formatDate(post.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.posts.length === 0 ? (
        <EmptyState
          title={filtered ? "No posts match these filters" : "No blog posts yet"}
          description={
            filtered
              ? "Try clearing the search or choosing a different status or category."
              : "Create your first article — it stays a private draft until you publish it."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-mist-200 bg-mist-50/70">
                  {["Post", "Status", "Category", "Updated", "Actions"].map((heading) => (
                    <th
                      key={heading}
                      className={`px-3 py-2.5 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80 ${
                        heading === "Category" ? "hidden md:table-cell" : heading === "Updated" ? "hidden sm:table-cell" : ""
                      } ${heading === "Actions" ? "text-right" : ""}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.posts.map((post) => (
                  <tr key={post.id} className="border-b border-mist-100 last:border-0 hover:bg-brand-50/30">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-3">
                        {post.featuredImage ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnails may be imported media or trusted hotlinks
                          <img src={post.featuredImage} alt="" className="h-10 w-14 shrink-0 rounded-lg border border-mist-200 object-cover" />
                        ) : (
                          <span className="grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-mist-100 text-ink-600/40">
                            <Newspaper className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link href={`/admin/blog/${post.id}`} className="line-clamp-1 text-[0.82rem] font-extrabold text-ink-950 hover:text-brand-700">
                            {post.title}
                          </Link>
                          <p className="truncate text-[0.66rem] text-ink-600/70">/blog/{post.slug}</p>
                          {post.tags.length > 0 && <p className="mt-0.5 truncate text-[0.64rem] text-ink-600/60">{post.tags.map((tag) => tag.name).join(" · ")}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <BlogStatusBadge status={post.status} />
                      {post.status === "scheduled" && post.scheduledFor && (
                        <p className="mt-1 text-[0.62rem] text-ink-600/70">{formatDate(post.scheduledFor)}</p>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-[0.72rem] text-ink-700 md:table-cell">{post.category?.name ?? "—"}</td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-[0.68rem] text-ink-600/80 sm:table-cell">{formatDate(post.updatedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-[0.66rem] font-bold text-brand-700 transition-colors hover:bg-brand-500 hover:text-white"
                        >
                          Edit
                        </Link>
                        <PostRowActions id={post.id} status={post.status} slug={post.slug} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="Blog pagination" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.7rem] font-semibold text-ink-600/70">
            Page {result.page} of {result.totalPages} · {result.total} {result.total === 1 ? "post" : "posts"}
          </p>
          <div className="flex items-center gap-1.5">
            {result.page > 1 ? (
              <Link href={pageHref(result.page - 1)} className="rounded-lg border border-mist-200 bg-surface px-3 py-1.5 text-[0.7rem] font-bold text-ink-800 transition-colors hover:border-brand-300">
                ← Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-mist-100 px-3 py-1.5 text-[0.7rem] font-bold text-ink-600/30">← Previous</span>
            )}
            <span className="rounded-lg bg-night-soft px-3 py-1.5 text-[0.7rem] font-bold text-white">{result.page}</span>
            {result.page < result.totalPages ? (
              <Link href={pageHref(result.page + 1)} className="rounded-lg border border-mist-200 bg-surface px-3 py-1.5 text-[0.7rem] font-bold text-ink-800 transition-colors hover:border-brand-300">
                Next →
              </Link>
            ) : (
              <span className="rounded-lg border border-mist-100 px-3 py-1.5 text-[0.7rem] font-bold text-ink-600/30">Next →</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
