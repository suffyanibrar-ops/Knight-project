import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderTree, Newspaper, PenSquare, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { AdminPageHeader, EmptyState, StatCard, formatDate } from "@/components/admin/ui";
import { getBlogStats, listAdminCategories, listAdminPosts, listTags } from "@/lib/blog";
import { getArticles } from "@/lib/data";
import { ContentStudio } from "@/components/admin/content-studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Content · Admin", robots: { index: false, follow: false } };

export default async function AdminContentPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const [stats, recent, categories, tags, articles] = await Promise.all([
    getBlogStats(),
    listAdminPosts({ page: 1 }),
    listAdminCategories(),
    listTags(),
    getArticles(),
  ]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Content"
        description="One place to understand what is published. Manage blog posts, categories, tags, SEO metadata and scheduled publishing from the blog editor; the curated Insights library is shown here for visibility."
        actions={
          <>
            <Link href="/admin/blog" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300"><Newspaper className="h-3.5 w-3.5" /> Manage blog</Link>
            <Link href="/admin/blog/new" className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white hover:bg-brand-600"><PenSquare className="h-3.5 w-3.5" /> New post</Link>
          </>
        }
      />

      <ContentStudio />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Blog posts" value={stats.total} hint={`${stats.published} published · ${stats.drafts} drafts`} tone="brand" />
        <StatCard label="Scheduled" value={stats.scheduled} hint="Publishes on next public read after due date" />
        <StatCard label="Categories" value={categories.length} hint={`${tags.length} tags`} />
        <StatCard label="Insights resources" value={articles.length} hint="Curated educational library" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
          <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
            <div><p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Blog</p><h2 className="mt-0.5 text-[0.95rem] font-extrabold tracking-tight text-ink-950">Recent posts</h2></div>
            <Link href="/admin/blog" className="text-[0.7rem] font-extrabold text-brand-700 hover:text-brand-500">Open editor <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          {recent.posts.length === 0 ? <div className="p-5"><EmptyState title="No blog posts yet" description="Create the first post to start publishing editorial content. Existing public URLs and the blog editor remain unchanged." /></div> : (
            <ul className="divide-y divide-mist-100">
              {recent.posts.slice(0, 6).map((post) => (
                <li key={post.id}>
                  <Link href={`/admin/blog/${post.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-mist-50/70">
                    <span className="min-w-0"><span className="block truncate text-[0.78rem] font-extrabold text-ink-900">{post.title}</span><span className="mt-0.5 block text-[0.68rem] text-ink-600/65">/{post.slug} · {formatDate(post.updatedAt)}</span></span>
                    <span className="shrink-0 rounded-full border border-mist-200 bg-mist-50 px-2 py-0.5 text-[0.6rem] font-extrabold capitalize text-ink-700">{post.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Taxonomy</p>
            <div className="mt-3 space-y-2">
              <Link href="/admin/blog/categories" className="flex items-center justify-between rounded-xl border border-mist-200 bg-mist-50/60 px-3 py-2.5 text-[0.74rem] font-bold text-ink-800 hover:border-brand-300"><span className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5 text-brand-700" /> Categories & tags</span><span className="text-ink-600/55">{categories.length} / {tags.length}</span></Link>
              <Link href="/admin/blog" className="flex items-center justify-between rounded-xl border border-mist-200 bg-mist-50/60 px-3 py-2.5 text-[0.74rem] font-bold text-ink-800 hover:border-brand-300"><span className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-brand-700" /> Search & filters</span><ArrowRight className="h-3 w-3" /></Link>
            </div>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-600/60">SEO titles, descriptions, canonical URLs, social images, slugs, featured images and scheduling are edited inside each blog post.</p>
          </section>
          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Insights library</p>
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-ink-600/65">Curated website content used by the public Insights pages and the AI knowledge index. It is not edited through the blog editor.</p>
            <ul className="mt-3 space-y-1.5">
              {articles.slice(0, 6).map((article) => <li key={article.slug}><Link href={`/insights/${article.slug}`} target="_blank" className="flex items-center justify-between gap-2 text-[0.72rem] font-semibold text-ink-700 hover:text-brand-700"><span className="min-w-0 truncate">{article.title}</span><ArrowRight className="h-3 w-3 shrink-0" /></Link></li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
