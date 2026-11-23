import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getBlogStats, listPublishedPosts } from "@/lib/blog";
import { AdminPageHeader } from "@/components/admin/ui";
import { PostRowActions } from "@/components/admin/blog/post-row-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Published articles · Admin", robots: { index: false, follow: false } };

const when = (value: Date | null) => (value ? new Date(value).toISOString().slice(0, 10) : "—");

/**
 * Authoritative list of live articles.
 *
 * The query requires status = published AND published_at <= now AND not deleted,
 * so drafts, scheduled-but-not-due and unpublished posts can never appear here.
 */
export default async function PublishedArticlesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const posts = await listPublishedPosts(100);
  const stats = await getBlogStats();

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Published articles"
        description="Every article currently live on the public blog. Unpublishing returns it to the workspace queue."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/blog/workspace" className="rounded-xl border border-mist-200 px-4 py-2.5 text-[0.76rem] font-bold text-ink-700 hover:border-brand-300">Workspace</Link>
            <Link href="/admin/blog/editor/new" className="rounded-xl bg-night-soft px-4 py-2.5 text-[0.76rem] font-bold text-white hover:bg-brand-600">New article</Link>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-mist-200 bg-surface p-4">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">Published</p>
          <p className="mt-1 text-[1.4rem] font-extrabold text-ink-950">{stats.published}</p>
        </div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">Scheduled</p>
          <p className="mt-1 text-[1.4rem] font-extrabold text-ink-950">{stats.scheduled}</p>
        </div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">In workspace</p>
          <p className="mt-1 text-[1.4rem] font-extrabold text-ink-950">{stats.drafts + stats.unpublished}</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-mist-200 bg-mist-50 px-4 py-10 text-center text-[0.8rem] text-ink-600/70">
          No published articles yet. Publish a draft from the editor to see it here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-[0.76rem]">
              <thead>
                <tr className="border-b border-mist-200 bg-mist-50/70 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">
                  <th className="px-3 py-2.5">Article</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Published</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-mist-100 last:border-0">
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/blog/editor/${post.id}`} className="font-extrabold text-ink-950 hover:text-brand-700">{post.title}</Link>
                      <p className="mt-0.5 truncate text-[0.66rem] text-ink-600/70">/blog/{post.slug}</p>
                    </td>
                    <td className="px-3 py-2.5 text-ink-700">{post.category?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-ink-700">{when(post.publishedAt ?? null)}</td>
                    <td className="px-3 py-2.5">
                      <PostRowActions id={post.id} status="published" slug={post.slug} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
