import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { Icon } from "@/components/icon";
import { ParallaxImage } from "@/components/motion/parallax";
import { TiltCard } from "@/components/motion/tilt-card";
import { PageHero } from "@/components/page-hero";
import { pageHeroVisuals, audienceVisuals } from "@/components/sections/visuals";
import { photo } from "@/lib/photos";
import { ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { audiences, rcmLifecycle, site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Who We Serve | Knight Medical Billing', description: 'Knight Medical Billing serves hospitals, healthcare systems, emergency rooms, urgent cares and private practices across the United States.', path: '/who-we-serve', keywords: ['hospital billing services', 'urgent care billing', 'healthcare system billing'] });

export default function WhoWeServePage() {
  return (
    <>
      <PageHero
        eyebrow="Who we serve"
        title={
          <>
            From large health systems to <span className="display-serif text-brand-600">small practices.</span>
          </>
        }
        description="Knight Medical Billing is a recognized medical billing organization serving a range of facilities — from hospitals and healthcare systems to emergency rooms, urgent cares and independent practices."
        image={pageHeroVisuals.whoWeServe}
        imageAlt="Photograph of a bright modern hospital corridor"
        badges={["Hospitals & health systems", "ER & urgent care", "Private practices"]}
        crumbs={[{ label: "Who we serve" }]}
        primaryCta={{ label: "Schedule a consultation", href: "/schedule-form" }}
        secondaryCta={{ label: `Call ${site.phone}`, href: site.phoneHref }}
        stat={{ value: "20%+", label: "Higher reimbursements" }}
      />

      <section className="bg-surface py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-5 lg:grid-cols-2">
            {audiences.map((audience, index) => (
              <Reveal key={audience.slug} delay={index * 0.05} className="h-full">
                <TiltCard className="group h-full">
                  <Link href={`/who-we-serve/${audience.slug}`} className="group grid h-full overflow-hidden rounded-3xl border border-mist-200 bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_32px_64px_-40px_rgba(4,20,31,0.45)] sm:grid-cols-[0.9fr_1.1fr]">
                    <div className="relative min-h-[12rem] overflow-hidden">
                      <Image src={audienceVisuals[audience.slug] ?? audience.image} alt={`Photograph representing ${audience.name} billing support`} fill className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/65 to-transparent" />
                      <span className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/25 bg-white/15 text-white backdrop-blur">
                        <Icon name={audience.icon} className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="flex flex-col p-5">
                      <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-700">{audience.eyebrow}</p>
                      <h2 className="mt-1.5 text-[1.1rem] font-extrabold leading-snug tracking-tight text-ink-950 group-hover:text-brand-700">{audience.title}</h2>
                      <p className="mt-2 flex-1 text-[0.82rem] leading-relaxed text-ink-600/75">{audience.intro}</p>
                      <ul className="mt-3 space-y-1.5">
                        {audience.points.slice(0, 3).map((point) => (
                          <li key={point} className="flex items-start gap-2 text-[0.75rem] font-semibold text-ink-700">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} />
                            {point}
                          </li>
                        ))}
                      </ul>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-[0.76rem] font-extrabold text-brand-700">
                        Explore {audience.short.toLowerCase()} <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-night py-16 text-white sm:py-20">
        <ParallaxImage src={photo.deskCharts} distance={32} className="opacity-40" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/85 to-ink-950/55" />
        <div className="shell relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <Reveal>
            <SectionLabel tone="light">Shared across every facility</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.8rem,3.8vw,2.6rem)] font-extrabold leading-[1.06] tracking-[-0.035em]">
              The whole revenue cycle, <span className="display-serif text-brand-300">one team.</span>
            </h2>
            <p className="mt-4 text-[0.93rem] leading-relaxed text-white/60">
              Whether you are a single clinic or a multi-facility system, the same disciplines apply. We own every step from scheduling to the final refund — and report on all of it.
            </p>
            <ol className="mt-6 grid gap-1.5 sm:grid-cols-2">
              {rcmLifecycle.map((step, index) => (
                <li key={step} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-2 text-[0.72rem] font-semibold text-white/75">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500 text-[0.55rem] font-extrabold text-white">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.1} className="grid gap-2.5 sm:grid-cols-2 lg:content-center">
            {[
              { value: "99.9%", label: "Claim acceptance rate" },
              { value: "24 hrs", label: "Claim filing window" },
              { value: "24/5", label: "Multilingual support" },
              { value: "5 days", label: "Onboarding process" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-2xl font-extrabold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-white/45">{stat.label}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-brand-400/30 bg-brand-500/10 p-5 sm:col-span-2">
              <p className="text-[0.8rem] leading-relaxed text-white/75">
                “As your medical billing service provider, we are an extension of your staff. You heal. Leave the revenue management to us.”
              </p>
              <p className="mt-2 text-[0.68rem] font-extrabold text-brand-300">Lawrence Fianko · CEO & Founder</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-18">
        <div className="shell flex flex-col items-center gap-5 text-center">
          <Reveal>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.03em] text-ink-950">Not sure which service you need?</h2>
            <p className="mx-auto mt-2 max-w-xl text-[0.9rem] leading-relaxed text-ink-600/75">Tell us about your facility and we will recommend the right starting point — often a clean-up audit of your current revenue cycle.</p>
          </Reveal>
          <Reveal delay={0.08} className="flex flex-wrap justify-center gap-3">
            <Link href="/schedule-form" className="btn btn-primary">
              Schedule a consultation <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/services/clean-up-billing" className="btn btn-light">
              Start with a clean-up audit
            </Link>
            <ArrowLink href="/specialties" className="self-center">
              View specialties
            </ArrowLink>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
