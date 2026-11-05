import { ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog";
import { cn } from "@/lib/utils";
import { BlogImage } from "./blog-image";
import { formatPostDate, isoDate, readingTimeLabel } from "./format";

/**
 * Article card used on /blog and on both archive pages.
 * The whole card is one link; category and tag links live on the article page
 * so the markup never nests interactive elements.
 */
export function PostCard({
  post,
  featured = false,
  priority = false,
  className,
}: {
  post: BlogPostSummary;
  featured?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const date = formatPostDate(post.publishedAt);

  if (featured) {
    return (
      <article className={cn("group", className)}>
        <Link
          href={`/blog/${post.slug}`}
          className="card-hover grid h-full overflow-hidden rounded-3xl border border-mist-200 bg-surface sm:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="relative min-h-[15rem] overflow-hidden bg-night sm:min-h-[20rem]">
            <BlogImage post={post} priority={priority} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 52vw, 640px" imageClassName="transition-transform duration-700 group-hover:scale-[1.04]" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/15 to-transparent" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-white backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-400" /> Latest article
            </span>
          </div>
          <div className="flex flex-col p-6 sm:p-8">
            {post.category ? (
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">{post.category.name}</p>
            ) : (
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Billing insights</p>
            )}
            <h2 className="mt-2.5 text-[clamp(1.3rem,2.6vw,1.7rem)] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink-950 transition-colors group-hover:text-brand-700">
              {post.title}
            </h2>
            {post.excerpt ? <p className="mt-3 text-[0.88rem] leading-relaxed text-ink-600/80">{post.excerpt}</p> : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.7rem] font-semibold text-ink-600/70">
              {date ? (
                <time dateTime={isoDate(post.publishedAt)}>{date}</time>
              ) : null}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden /> {readingTimeLabel(post.readingTime)}
              </span>
              {post.author ? <span>{post.author}</span> : null}
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[0.8rem] font-extrabold text-brand-700">
              Read the article
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className={cn("group h-full", className)}>
      <Link href={`/blog/${post.slug}`} className="card-hover flex h-full flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface">
        <div className="relative aspect-[16/10] overflow-hidden bg-night">
          <BlogImage post={post} priority={priority} imageClassName="transition-transform duration-700 group-hover:scale-[1.04]" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-ink-950/10 to-transparent" />
          {post.category ? (
            <span className="absolute left-3.5 top-3.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-md">
              {post.category.name}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.66rem] font-semibold text-ink-600/70">
            {date ? <time dateTime={isoDate(post.publishedAt)}>{date}</time> : null}
            <span className="h-1 w-1 rounded-full bg-mist-300" aria-hidden />
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden /> {readingTimeLabel(post.readingTime)}
            </span>
          </div>
          <h3 className="mt-2 text-[1.05rem] font-extrabold leading-snug tracking-tight text-ink-950 transition-colors group-hover:text-brand-700">{post.title}</h3>
          {post.excerpt ? <p className="mt-2 line-clamp-3 text-[0.82rem] leading-relaxed text-ink-600/75">{post.excerpt}</p> : null}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[0.76rem] font-extrabold text-brand-700">
            Read article
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </article>
  );
}
