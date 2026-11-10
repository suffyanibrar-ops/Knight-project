import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock, User } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { BlogImage, blogImageUrl } from "@/components/blog/blog-image";
import { formatPostDateLong, isoDate, readingTimeLabel } from "@/components/blog/format";
import { PostCard } from "@/components/blog/post-card";
import { BlogProseStyles } from "@/components/blog/prose-styles";
import { ShareLinks } from "@/components/blog/share-links";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { JsonLd } from "@/components/structured-data";
import { getAdjacentPosts, getPublicPost, getRelatedPosts } from "@/lib/blog";
import { SITE_URL, breadcrumbSchema, stripBrandSuffix } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

const DEFAULT_OG_IMAGE = "/images/og-knight-medical-billing.jpg";

type ArticleParams = Promise<{ slug: string }>;

function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function canonicalUrlFor(post: { canonicalUrl: string | null; slug: string }): string {
  const canonical = post.canonicalUrl?.trim();
  if (!canonical) return `${SITE_URL}/blog/${post.slug}`;
  return /^https?:\/\//i.test(canonical) ? canonical : `${SITE_URL}${canonical.startsWith("/") ? canonical : `/${canonical}`}`;
}

export async function generateMetadata({ params }: { params: ArticleParams }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicPost(slug);
  // Throwing here (rather than returning fallback metadata) lets the router set
  // a real 404 status before any streaming starts.
  if (!result) notFound();
  if ("redirectTo" in result) permanentRedirect(result.redirectTo);

  const post = result.post;
  const title = stripBrandSuffix(post.seoTitle?.trim() || post.title);
  const description = (post.seoDescription?.trim() || post.excerpt?.trim() || site.description).slice(0, 200);
  const canonical = canonicalUrlFor(post);
  const image = post.socialImage?.trim() || blogImageUrl(post) || DEFAULT_OG_IMAGE;
  const imageUrl = /^https?:\/\//i.test(image) ? image : `${SITE_URL}${image}`;

  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName: site.name,
      locale: "en_US",
      publishedTime: isoDate(post.publishedAt),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.author],
      section: post.category?.name,
      tags: post.tags.map((tag) => tag.name),
      images: [{ url: imageUrl, alt: post.featuredImageAlt?.trim() || post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };

  return metadata;
}

export default async function BlogArticlePage({ params }: { params: ArticleParams }) {
  const { slug } = await params;
  const result = await getPublicPost(slug);
  if (!result) notFound();
  if ("redirectTo" in result) permanentRedirect(result.redirectTo);

  const post = result.post;
  const [related, adjacent] = await Promise.all([getRelatedPosts(post, 3), getAdjacentPosts(post)]);

  const canonical = canonicalUrlFor(post);
  const image = post.socialImage?.trim() || blogImageUrl(post) || DEFAULT_OG_IMAGE;
  const imageUrl = absoluteUrl(image);
  const published = formatPostDateLong(post.publishedAt);
  const cover = blogImageUrl(post);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    ...(post.category ? [{ name: post.category.name, path: `/blog/category/${post.category.slug}` }] : []),
    { name: post.title, path: `/blog/${post.slug}` },
  ];

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonical}#article`,
    url: canonical,
    headline: post.seoTitle?.trim() || post.title,
    description: post.seoDescription?.trim() || post.excerpt || site.description,
    image: [imageUrl],
    datePublished: isoDate(post.publishedAt),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: post.author || site.name, url: SITE_URL },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    isAccessibleForFree: true,
    articleSection: post.category?.name,
    keywords: post.tags.map((tag) => tag.name).join(", ") || undefined,
    inLanguage: "en-US",
  };

  return (
    <>
      <BlogProseStyles />
      <JsonLd data={[articleLd, breadcrumbSchema(breadcrumbs)]} />

      <article>
        <header className="relative overflow-hidden border-b border-mist-200 bg-gradient-to-b from-mist-50 to-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="grid-lines absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
            <div className="absolute -right-28 -top-24 h-80 w-80 rounded-full bg-brand-200/35 blur-[100px]" />
          </div>
          <div className="shell relative max-w-4xl py-10 sm:py-14">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold text-ink-600/75">
              <Link href="/" className="transition-colors hover:text-brand-700">
                Home
              </Link>
              <span aria-hidden className="text-ink-600/30">/</span>
              <Link href="/blog" className="transition-colors hover:text-brand-700">
                Blog
              </Link>
              {post.category ? (
                <>
                  <span aria-hidden className="text-ink-600/30">/</span>
                  <Link href={`/blog/category/${post.category.slug}`} className="transition-colors hover:text-brand-700">
                    {post.category.name}
                  </Link>
                </>
              ) : null}
            </nav>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {post.category ? (
                <Link
                  href={`/blog/category/${post.category.slug}`}
                  className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-brand-700 transition-colors hover:bg-brand-100"
                >
                  {post.category.name}
                </Link>
              ) : null}
              {published ? (
                <time dateTime={isoDate(post.publishedAt)} className="text-[0.68rem] font-semibold text-ink-600/75">
                  {published}
                </time>
              ) : null}
              <span className="flex items-center gap-1 text-[0.68rem] font-semibold text-ink-600/75">
                <Clock aria-hidden className="h-3 w-3" /> {readingTimeLabel(post.readingTime)}
              </span>
            </div>

            <h1 className="mt-4 text-[clamp(1.95rem,4.2vw,3rem)] font-extrabold leading-[1.07] tracking-[-0.04em] text-ink-950">{post.title}</h1>
            {post.excerpt ? <p className="mt-4 max-w-2xl text-[1.02rem] leading-relaxed text-ink-600/85">{post.excerpt}</p> : null}

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-mist-200 pt-4 text-[0.75rem] font-semibold text-ink-700">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-night text-white">
                <User aria-hidden className="h-3.5 w-3.5" />
              </span>
              <span className="font-extrabold text-ink-950">{post.author}</span>
              {post.author.trim().toLowerCase() !== "knight medical billing" && (
                <>
                  <span aria-hidden className="text-ink-600/30">·</span>
                  <span>Knight Medical Billing</span>
                </>
              )}
            </div>
          </div>
        </header>

        <section className="bg-surface py-10 sm:py-14">
          <div className="shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-14">
            <div className="min-w-0 max-w-3xl">
              {cover ? (
                <figure className="m-0">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-mist-200 bg-night">
                    <BlogImage post={post} priority sizes="(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 896px" />
                  </div>
                  {post.media?.caption || post.media?.attribution ? (
                    <figcaption className="mt-2 text-center text-[0.74rem] leading-relaxed text-ink-600/70">
                      {post.media?.caption}
                      {post.media?.attribution ? <span className="block text-[0.68rem] text-ink-600/55">{post.media.attribution}</span> : null}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}

              <div className="blog-prose mt-8" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

              {post.tags.length > 0 ? (
                <div className="mt-9 flex flex-wrap items-center gap-2 border-t border-mist-200 pt-5">
                  <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/70">Tagged</span>
                  {post.tags.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/blog/tag/${tag.slug}`}
                      className="inline-flex items-center rounded-full border border-mist-200 bg-mist-50 px-2.5 py-1 text-[0.7rem] font-bold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-mist-50 p-4 print:hidden">
                <ShareLinks url={canonical} title={post.title} />
                <Link href="/blog" className="inline-flex items-center gap-1.5 text-[0.74rem] font-extrabold text-brand-700 hover:text-brand-500">
                  <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> All articles
                </Link>
              </div>
            </div>

            <aside className="min-w-0 space-y-4 lg:sticky lg:top-28 lg:self-start print:hidden">
              <TableOfContents headings={post.headings} />
              <div className="relative overflow-hidden rounded-2xl bg-night p-5 text-white">
                <div aria-hidden className="dot-grid absolute inset-0 opacity-20" />
                <div className="relative">
                  <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-300">Free consultation</p>
                  <p className="mt-2 text-[0.95rem] font-extrabold leading-snug">See what this looks like in your facility.</p>
                  <p className="mt-2 text-[0.75rem] leading-relaxed text-white/60">We review your billing process, claim acceptance and outstanding A/R.</p>
                  <Link href="/schedule-form" className="btn btn-accent mt-4 w-full px-4 py-3 text-[0.78rem]">
                    Schedule a call <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
              {post.category ? (
                <Link
                  href={`/blog/category/${post.category.slug}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-mist-200 bg-surface px-4 py-3 text-[0.76rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="min-w-0 truncate">More in {post.category.name}</span>
                  <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
                </Link>
              ) : null}
            </aside>
          </div>
        </section>

        {adjacent.previous || adjacent.next ? (
          <section className="border-y border-mist-200 bg-mist-50 py-10 print:hidden">
            <div className="shell grid gap-3 sm:grid-cols-2">
              {adjacent.previous ? (
                <Link
                  href={`/blog/${adjacent.previous.slug}`}
                  className="group flex flex-col rounded-2xl border border-mist-200 bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <span className="flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/70">
                    <ArrowLeft aria-hidden className="h-3 w-3" /> Previous article
                  </span>
                  <span className="mt-2 text-[0.92rem] font-extrabold leading-snug text-ink-950 transition-colors group-hover:text-brand-700">{adjacent.previous.title}</span>
                </Link>
              ) : null}
              {adjacent.next ? (
                <Link
                  href={`/blog/${adjacent.next.slug}`}
                  className="group flex flex-col rounded-2xl border border-mist-200 bg-surface p-5 text-right transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md sm:items-end"
                >
                  <span className="flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/70">
                    Next article <ArrowRight aria-hidden className="h-3 w-3" />
                  </span>
                  <span className="mt-2 text-[0.92rem] font-extrabold leading-snug text-ink-950 transition-colors group-hover:text-brand-700">{adjacent.next.title}</span>
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="bg-surface py-12 sm:py-16 print:hidden">
            <div className="shell">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="eyebrow text-brand-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Keep reading
                  </span>
                  <h2 className="mt-2.5 text-[clamp(1.4rem,3vw,1.95rem)] font-extrabold tracking-[-0.03em] text-ink-950">
                    Related <span className="display-serif text-brand-600">articles.</span>
                  </h2>
                </div>
                <Link href="/blog" className="inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold text-brand-700 hover:text-brand-500">
                  All articles <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <PostCard key={item.id} post={item} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </article>

      <div className="print:hidden">
        <CtaBand title="Ready to collect more, faster?" description="A free consultation reviews your current billing process, claim acceptance and outstanding A/R — no prepayment, no hidden fees." />
      </div>
    </>
  );
}
