import { ArrowRight, Tag } from "lucide-react";
import Link from "next/link";
import type { BlogCategoryRef, BlogTagRef } from "@/lib/blog";
import { cn } from "@/lib/utils";

/**
 * Category and tag navigation for the public blog.
 * Counts come from the data layer and only published posts are counted.
 */
export function BlogSidebar({
  categories,
  tags,
  activeCategory,
  activeTag,
  className,
}: {
  categories: (BlogCategoryRef & { count: number })[];
  tags: (BlogTagRef & { postCount: number })[];
  activeCategory?: string;
  activeTag?: string;
  className?: string;
}) {
  const visibleCategories = categories.filter((category) => category.count > 0);
  const visibleTags = tags.filter((tag) => tag.postCount > 0);

  return (
    <div className={cn("space-y-4", className)}>
      {visibleCategories.length > 0 ? (
        <section className="rounded-3xl border border-mist-200 bg-surface p-5">
          <h2 className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Browse by category</h2>
          <ul className="mt-3.5 space-y-1">
            {visibleCategories.map((category) => {
              const active = activeCategory === category.slug;
              return (
                <li key={category.slug}>
                  <Link
                    href={`/blog/category/${category.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-[0.8rem] font-bold transition-colors",
                      active ? "bg-brand-50 text-brand-700" : "text-ink-800 hover:bg-mist-50 hover:text-brand-700",
                    )}
                  >
                    <span className="min-w-0 truncate">{category.name}</span>
                    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[0.62rem] font-extrabold", active ? "bg-surface text-brand-700" : "bg-mist-100 text-ink-600/70")}>
                      {category.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {visibleTags.length > 0 ? (
        <section className="rounded-3xl border border-mist-200 bg-surface p-5">
          <h2 className="flex items-center gap-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">
            <Tag aria-hidden className="h-3 w-3 text-brand-600" /> Tags
          </h2>
          <ul className="mt-3.5 flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => {
              const active = activeTag === tag.slug;
              return (
                <li key={tag.slug}>
                  <Link
                    href={`/blog/tag/${tag.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-bold transition-colors",
                      active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-mist-200 bg-mist-50 text-ink-700 hover:border-brand-300 hover:text-brand-700",
                    )}
                  >
                    {tag.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl bg-night p-5 text-white">
        <div aria-hidden className="dot-grid absolute inset-0 opacity-20" />
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/25 blur-2xl" />
        <div className="relative">
          <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-300">Free consultation</p>
          <p className="mt-2 text-[1.02rem] font-extrabold leading-snug tracking-tight">See what this looks like in your facility.</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-white/60">We review your billing process, claim acceptance and outstanding A/R — no prepayment required.</p>
          <Link href="/schedule-form" className="btn btn-accent mt-4 w-full px-4 py-3 text-[0.8rem]">
            Schedule a consultation <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
