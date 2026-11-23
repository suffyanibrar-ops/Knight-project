import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { listWorkspacePosts } from "@/lib/blog";
import { BlogWorkspace } from "@/components/admin/blog/blog-workspace";
import { BlogStatusBadge } from "@/components/admin/blog/status-badge";
import { OriginalityPanel } from "@/components/admin/blog/originality-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog workspace · Admin", robots: { index: false, follow: false } };

/**
 * Editorial workspace: ideas, research, AI planning and unpublished drafts.
 * Published articles are excluded by the query, not hidden in the UI.
 */
export default async function BlogWorkspacePage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const drafts = await listWorkspacePosts(30);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[0.95rem] font-extrabold tracking-tight text-ink-950">Unpublished drafts</h2>
            <p className="mt-0.5 text-[0.72rem] text-ink-600/80">Drafts and unpublished articles waiting for editorial work. Published articles live in Published Articles.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/blog/published" className="rounded-xl border border-mist-200 px-3 py-2 text-[0.72rem] font-bold text-ink-700 hover:border-brand-300">Published articles</Link>
            <Link href="/admin/blog/editor/new" className="rounded-xl bg-night-soft px-3 py-2 text-[0.72rem] font-bold text-white hover:bg-brand-600">New article</Link>
          </div>
        </div>

        {drafts.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-mist-200 bg-mist-50 px-4 py-6 text-center text-[0.76rem] text-ink-600/70">No unpublished drafts. Start an idea below or write a new article.</p>
        ) : (
          <ul className="mt-3 divide-y divide-mist-100">
            {drafts.map((post) => (
              <li key={post.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/admin/blog/editor/${post.id}`} className="text-[0.8rem] font-extrabold text-ink-950 hover:text-brand-700">{post.title}</Link>
                  <p className="mt-0.5 truncate text-[0.66rem] text-ink-600/70">/blog/{post.slug} · updated {new Date(post.updatedAt).toISOString().slice(0, 10)}</p>
                </div>
                <BlogStatusBadge status={post.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <OriginalityPanel posts={[...drafts.map((post) => ({ id: post.id, title: post.title }))]} />

      <BlogWorkspace />
    </div>
  );
}
