import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { listPublicPosts } from "@/lib/blog";
import type { Metadata } from "next";
import { CtaBand } from "@/components/cta-band";
import { InsightsExplorer } from "@/components/insights-explorer";
import { PageHero } from "@/components/page-hero";
import { NewsletterForm } from "@/components/newsletter-form";
import { articleVisuals, pageHeroVisuals } from "@/components/sections/visuals";
import { Reveal, SectionLabel } from "@/components/ui";
import { getArticles } from "@/lib/data";

export const metadata: Metadata = pageMetadata({ title: 'Billing Resources & Guides | Knight Medical Billing', description: 'Practical medical billing and coding guides from our specialists: clean claim checks, eligibility verification, A/R follow-up, credentialing and out-of-network negotiation.', path: '/insights', keywords: ['medical billing resources', 'revenue cycle guides'] });

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [articles, cmsPosts] = await Promise.all([getArticles(), listPublicPosts({ page: 1, perPage: 6 })]);
  const illustrated = articles.map((article) => ({
    ...article,
    image: articleVisuals[article.slug] ?? article.image,
  }));

  return (
    <>
      <PageHero path={"/insights"}

        eyebrow="Resources"
        title={
          <>
            Playbooks from the <span className="display-serif text-brand-600">revenue front line.</span>
          </>
        }
        description="Short, practical guides from our billing and coding specialists: clean claim checks, eligibility verification, A/R follow-up, credentialing, out-of-network negotiation and revenue cycle audits."
        image={pageHeroVisuals.insights}
        imageAlt="Photograph of a billing specialist working at a laptop with documentation"
        badges={["Updated monthly", "Written by operators", "Free to use"]}
        crumbs={[{ label: "Insights" }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: "Talk to our team", href: "/contact" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <InsightsExplorer articles={illustrated} />

          {cmsPosts.posts.length > 0 && (
            <Reveal className="mt-12">
              <div className="rounded-3xl border border-mist-200 bg-mist-50 p-5 sm:p-7">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">From the blog</p>
                    <h2 className="mt-1 text-[1.35rem] font-extrabold tracking-tight text-ink-950">Latest published articles</h2>
                  </div>
                  <span className="text-[0.72rem] font-semibold text-ink-600/65">Updates from the Knight team</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {cmsPosts.posts.map((post) => (
                    <Link key={post.slug} href={`/blog/${post.slug}`} className="group rounded-xl border border-mist-200 bg-surface p-4 transition-colors hover:border-brand-300">
                      <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-700">{post.category?.name ?? "Article"}</p>
                      <p className="mt-1 text-[0.85rem] font-extrabold leading-snug text-ink-950 group-hover:text-brand-700">{post.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          <Reveal className="mt-12">
            <div id="newsletter" className="relative overflow-hidden rounded-3xl bg-night p-6 text-white sm:p-10">
              <div className="dot-grid absolute inset-0 opacity-[0.12]" />
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/25 blur-[90px]" />
              <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <SectionLabel tone="light">The revenue briefing</SectionLabel>
                  <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold leading-tight tracking-[-0.03em]">Billing insights, straight to your inbox</h2>
                  <p className="mt-2 max-w-lg text-[0.88rem] leading-relaxed text-white/60">Occasional guides and updates from our team. No spam, and you can unsubscribe at any time.</p>
                </div>
                <div>
                  <NewsletterForm />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand title="Prefer a conversation to reading?" description="Call (812) 994-0046 or send us a message. We answer revenue cycle questions directly, with no gated content." />
    </>
  );
}
