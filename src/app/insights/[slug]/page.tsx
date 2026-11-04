import Image from "next/image";
import { JsonLd } from "@/components/structured-data";
import { pageMetadata, articleSchema, breadcrumbSchema } from "@/lib/seo";
import { ArrowLeft, ArrowRight, Check, Clock, Share2, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { ArrowLink, Reveal } from "@/components/ui";
import { getArticle, getArticles } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  return pageMetadata({
    title: `${article.title}`,
    description: article.excerpt.slice(0, 158),
    path: `/insights/${article.slug}`,
    image: article.image,
    type: "article",
    publishedTime: article.date,
    keywords: [article.category.toLowerCase(), "medical billing guide"],
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const all = await getArticles();
  const related = all.filter((item) => item.slug !== article.slug).slice(0, 3);
  const date = new Date(article.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <JsonLd data={[articleSchema({ title: article.title, description: article.excerpt, path: `/insights/${article.slug}`, image: article.image, date: article.date, author: article.author }), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Resources", path: "/insights" }, { name: article.title, path: `/insights/${article.slug}` }])]} />
      <article>
        <section className="relative overflow-hidden border-b border-mist-200 bg-gradient-to-b from-mist-50 to-white">
          <div className="grid-lines pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
          <div className="shell relative max-w-4xl py-12 sm:py-16">
            <Link href="/insights" className="inline-flex items-center gap-1.5 text-[0.75rem] font-bold text-ink-600/80 transition-colors hover:text-brand-700">
              <ArrowLeft className="h-3.5 w-3.5" /> All insights
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-brand-700">{article.category}</span>
              <span className="flex items-center gap-1 text-[0.68rem] font-semibold text-ink-600/80"><Clock className="h-3 w-3" /> {article.readTime}</span>
              <span className="flex items-center gap-1 text-[0.68rem] font-semibold text-ink-600/80"><User className="h-3 w-3" /> {article.author}</span>
              <span className="text-[0.68rem] font-semibold text-ink-600/80">· {date}</span>
            </div>
            <h1 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] font-extrabold leading-[1.06] tracking-[-0.04em] text-ink-950">{article.title}</h1>
            <p className="mt-4 max-w-2xl text-[1rem] leading-relaxed text-ink-600/80">{article.excerpt}</p>
          </div>
        </section>

        <section className="bg-surface py-10 sm:py-14">
          <div className="shell grid gap-10 lg:grid-cols-[1fr_18rem] lg:gap-14">
            <div className="max-w-3xl">
              <Reveal className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-mist-200">
                <Image src={article.image} alt={article.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" priority />
              </Reveal>

              <div className="prose-knight mt-8">
                {article.body.map((section, index) => (
                  <div key={index}>
                    {section.heading && <h2>{section.heading}</h2>}
                    {section.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex}>{paragraph}</p>
                    ))}
                    {section.list && (
                      <ul>
                        {section.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-mist-200 bg-mist-50 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-brand-700">
                    <Share2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[0.8rem] font-extrabold text-ink-900">Worth sharing with your team?</p>
                    <p className="text-[0.7rem] text-ink-600/80">Send it along — no email required.</p>
                  </div>
                </div>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent((process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.knightmedicalbilling.com") + "/insights/" + article.slug)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-light px-4 py-2.5 text-[0.78rem]"
                >
                  Share on LinkedIn <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-soft">
                <div className="relative bg-night p-5 text-white">
                  <div className="dot-grid absolute inset-0 opacity-20" />
                  <p className="relative text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-300">Free consultation</p>
                  <p className="relative mt-2 text-[1.02rem] font-extrabold leading-snug">See what this looks like in your facility.</p>
                </div>
                <div className="p-5">
                  <ul className="space-y-2">
                    {["Review of your current billing process", "Claim acceptance and A/R review", "Denial and follow-up review", "No prepayment required"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[0.78rem] font-semibold text-ink-800">
                        <Check className="h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} /> {item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/schedule-form" className="btn btn-primary mt-4 w-full">
                    Schedule a consultation <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="mt-4 rounded-3xl border border-mist-200 bg-mist-50 p-5">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Keep reading</p>
                <div className="mt-3 space-y-2">
                  {related.map((item) => (
                    <Link key={item.slug} href={`/insights/${item.slug}`} className="group block rounded-xl bg-surface p-3 transition-colors hover:bg-brand-50">
                      <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-700">{item.category}</p>
                      <p className="mt-1 text-[0.8rem] font-bold leading-snug text-ink-900 group-hover:text-brand-700">{item.title}</p>
                    </Link>
                  ))}
                </div>
                <div className="mt-4">
                  <ArrowLink href="/insights">All insights</ArrowLink>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </article>

      <CtaBand />
    </>
  );
}
