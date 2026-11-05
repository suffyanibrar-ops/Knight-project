import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Clock, Eye, PenSquare, User } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { formatDate } from "@/components/admin/ui";
import { getAdminPost } from "@/lib/blog";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";
import { BlogStatusBadge } from "@/components/admin/blog/status-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post preview · Admin Console",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/** Public article typography is defined globally as `.prose-knight`; the extras below cover the HTML the editor can produce. */
const ARTICLE_BODY_CLASS = [
  "prose-knight mt-8 max-w-none",
  "[&_a]:text-brand-700 [&_a]:underline [&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:pl-4 [&_blockquote]:italic",
  "[&_code]:rounded [&_code]:bg-mist-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_figcaption]:mt-1.5 [&_figcaption]:text-center [&_figcaption]:text-[0.72rem] [&_figcaption]:text-ink-600/70",
  "[&_figure]:my-6 [&_figure]:space-y-2 [&_h4]:mt-6 [&_h4]:text-[1.1rem] [&_h4]:font-extrabold [&_h4]:text-ink-900 [&_hr]:my-6 [&_hr]:border-mist-200",
  "[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6",
  "[&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-mist-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-left",
  "[&_th]:border [&_th]:border-mist-200 [&_th]:bg-mist-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left",
].join(" ");

export default async function BlogPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  const post = await getAdminPost(postId);
  if (!post) notFound();

  // Stored HTML is already sanitised on write; run the policy again before it is
  // injected into the DOM so a legacy row can never bypass it.
  const contentHtml = sanitizeBlogHtml(post.contentHtml);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/admin/blog/${post.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.7rem] font-bold text-white transition-colors hover:bg-brand-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to editor
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-700">
            <Eye className="h-3.5 w-3.5" /> Preview
          </span>
          <BlogStatusBadge status={post.status} />
        </div>
        <div className="flex items-center gap-2">
          {post.status === "published" && (
            <a
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
            >
              Open public page ↗
            </a>
          )}
          <Link
            href={`/admin/blog/${post.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
          >
            <PenSquare className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      </div>

      <article className="mx-auto w-full max-w-3xl rounded-2xl border border-mist-200 bg-surface p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {post.category && (
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-brand-700">{post.category.name}</span>
          )}
          {post.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-mist-100 px-2 py-0.5 text-[0.6rem] font-bold text-ink-700">
              #{tag.name}
            </span>
          ))}
        </div>

        <h1 className="mt-3 text-[clamp(1.7rem,3.5vw,2.4rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950">{post.title}</h1>
        {post.excerpt && <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/80">{post.excerpt}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-y border-mist-100 py-3 text-[0.68rem] font-semibold text-ink-600/70">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" /> {post.author}
          </span>
          <span>
            {post.publishedAt ? `Published ${formatDate(post.publishedAt)}` : post.scheduledFor ? `Scheduled for ${formatDate(post.scheduledFor)}` : "Not published yet"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {post.readingTime} min read
          </span>
        </div>

        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element -- featured media can be imported WebP or a trusted hotlink
          <img src={post.featuredImage} alt={post.featuredImageAlt ?? ""} className="mt-5 aspect-[16/9] w-full rounded-2xl border border-mist-200 object-cover" />
        )}

        {contentHtml ? (
          <div className={ARTICLE_BODY_CLASS} dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : (
          <p className="mt-8 rounded-xl border border-dashed border-mist-300 bg-mist-50 px-4 py-6 text-center text-[0.8rem] text-ink-600/70">
            This post has no body content yet.
          </p>
        )}
      </article>

      <p className="text-center text-[0.66rem] text-ink-600/50">Private preview — this page is noindex and is never linked from the public site.</p>
    </div>
  );
}
