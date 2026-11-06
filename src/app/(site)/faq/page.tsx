import { JsonLd } from "@/components/structured-data";
import { faqSchema, breadcrumbSchema } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo";
import { ArrowRight, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { TiltCard } from "@/components/motion/tilt-card";
import { PageHero } from "@/components/page-hero";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { Accordion, Reveal, SectionLabel } from "@/components/ui";
import { getFaqs } from "@/lib/data";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Frequently Asked Questions | Knight Medical Billing', description: 'Answers about our services, structured onboarding, claim review, supported billing software, out-of-network negotiation, HIPAA security and how to contact our team.', path: '/faq', keywords: ['medical billing faq'] });

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const faqs = await getFaqs();

  return (
    <>
      <JsonLd data={[faqSchema(faqs), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])]} />
      <PageHero

        eyebrow="FAQ"
        title={
          <>
            Everything you want to ask <span className="display-serif text-brand-600">before you call.</span>
          </>
        }
        description="Pricing, onboarding, software, compliance and what happens to claims in progress. If your question is not here, call or email us — we answer directly."
        image={pageHeroVisuals.faq}
        imageAlt="Photograph of a support specialist ready to answer questions"
        crumbs={[{ label: "FAQ" }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: "Contact us", href: "/contact" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <SectionLabel>Straight answers</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.6rem,3.2vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">
                No scripted sales <span className="display-serif text-brand-600">answers.</span>
              </h2>
              <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-600/80">
                We have supported hospitals, emergency rooms, urgent cares and private practices. The questions below are the ones we hear most often.
              </p>
              <div className="mt-5 space-y-2">
                <a href={site.phoneHref} className="btn btn-primary w-full">
                  <Phone className="h-4 w-4" /> {site.phone}
                </a>
                <a href={`mailto:${site.email}`} className="btn btn-light w-full break-all px-3">
                  <Mail className="h-4 w-4 shrink-0" /> {site.email}
                </a>
              </div>
              <div className="mt-5 rounded-2xl border border-mist-200 bg-mist-50 p-4 text-[0.78rem] leading-relaxed text-ink-600/75">
                <span className="font-extrabold text-ink-900">Work hours:</span> {site.hours}. Client support is available during business hours.
              </div>
            </Reveal>
          </aside>

          <Reveal delay={0.08}>
            <Accordion items={faqs} defaultOpen={0} />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <TiltCard className="group h-full">
                <Link href="/services" className="group flex h-full flex-col rounded-2xl border border-mist-200 bg-surface p-5 transition-all hover:border-brand-300 hover:shadow-md">
                  <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-brand-700">Services</p>
                  <p className="mt-1.5 text-[0.95rem] font-extrabold text-ink-950 group-hover:text-brand-700">Complete billing and RCM</p>
                  <p className="mt-1 text-[0.78rem] text-ink-600/70">Ten services from coding to out-of-network negotiation.</p>
                </Link>
              </TiltCard>
              <TiltCard className="group h-full">
                <Link href="/our-process" className="group flex h-full flex-col rounded-2xl border border-mist-200 bg-surface p-5 transition-all hover:border-brand-300 hover:shadow-md">
                  <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-brand-700">Our process</p>
                  <p className="mt-1.5 text-[0.95rem] font-extrabold text-ink-950 group-hover:text-brand-700">Live in 5 days</p>
                  <p className="mt-1 text-[0.78rem] text-ink-600/70">Consultation, dedicated team, stabilization, reporting.</p>
                </Link>
              </TiltCard>
            </div>
            <div className="mt-5">
              <Link href="/contact" className="inline-flex items-center gap-1.5 text-[0.8rem] font-extrabold text-brand-700 hover:text-brand-500">
                Still have a question? Send us a message <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
