import { pageMetadata } from "@/lib/seo";
import { ArrowRight, BadgeCheck, BarChart3, Check, Clock, FileCheck2, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { RoiCalculator } from "@/components/roi-calculator";
import { TiltCard } from "@/components/motion/tilt-card";
import { ParallaxImage } from "@/components/motion/parallax";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { photo } from "@/lib/photos";
import { Reveal, SectionLabel } from "@/components/ui";
import { benefits, kpis, site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Results & Performance | 99.9% Claim Acceptance', description: 'See how Knight Medical Billing measures performance: 99.9% claim acceptance, claims filed within 24 hours, revenue uplift of at least 10% and 20%+ reimbursement gains.', path: '/results', keywords: ['medical billing results', 'claim acceptance rate'] });

const measures = [
  { icon: FileCheck2, title: "Claim acceptance rate", detail: "We build a clean claim, carefully looking for any errors. Our claim acceptance rate is 99.9%.", value: "99.9%" },
  { icon: Clock, title: "Claim filing window", detail: "All claims for practices are filed within 24 hours of charge entry.", value: "24 hrs" },
  { icon: TrendingUp, title: "Revenue growth", detail: "We routinely boost our clients' revenue by at least 10% while making billing efficient and compliant.", value: "10%+" },
  { icon: BarChart3, title: "Reimbursement uplift", detail: "Healthcare systems and hospitals we support can raise reimbursement by more than 20%.", value: "20%+" },
];

export default function ResultsPage() {
  return (
    <>
      <PageHero
        eyebrow="Results & performance"
        title={
          <>
            Numbers we are <span className="display-serif text-brand-600">glad to be asked about.</span>
          </>
        }
        description="We would rather show you how we measure performance than make promises. These are the metrics we track, report on and hold ourselves to for every client."
        image={pageHeroVisuals.results}
        imageAlt="Photograph of a specialist reviewing revenue reports on a laptop"
        badges={["99.9% acceptance", "24-hour filing", "Real-time reporting"]}
        crumbs={[{ label: "Results" }]}
        primaryCta={{ label: "Schedule a consultation", href: "/schedule-form" }}
        secondaryCta={{ label: `Call ${site.phone}`, href: site.phoneHref }}
        stat={{ value: "99.9%", label: "Claim acceptance rate" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <SectionLabel>What we measure</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Four numbers that matter <span className="display-serif text-brand-600">to every facility.</span>
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {measures.map((measure, index) => (
              <Reveal key={measure.title} delay={index * 0.05} className="h-full">
                <TiltCard className="group h-full">
                  <div className="group flex h-full gap-4 rounded-3xl border border-mist-200 bg-gradient-to-b from-white to-mist-50/60 p-5 transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                      <measure.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-extrabold tracking-tight text-ink-950">{measure.value}</p>
                        <p className="text-[0.8rem] font-extrabold text-ink-800">{measure.title}</p>
                      </div>
                      <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-600/75">{measure.detail}</p>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-night py-14 text-white sm:py-20">
        <ParallaxImage src={photo.analyticsLaptop} distance={32} className="opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/85 to-ink-950/55" aria-hidden />
        <div className="shell relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-14">
          <Reveal>
            <SectionLabel tone="light">How we improve performance</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.06] tracking-[-0.035em]">
              Every number traces back to a <span className="display-serif text-brand-300">process.</span>
            </h2>
            <p className="mt-4 text-[0.92rem] leading-relaxed text-white/60">
              We do not chase metrics directly. We fix the steps that produce them: eligibility before the visit, clean claim construction, 24-hour filing, payment posting accuracy and persistent A/R follow-up.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                "Front-end denials reduced by 20% for our clients",
                "Faster account receivable process and on-time follow-up",
                "Improved accuracy of fees and collections",
                "Payment posting and refunds adjusted to improve cash flow",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-[0.84rem] font-semibold text-white/80">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-500/20 text-mint-300">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-7">
              <Link href="/services/clean-up-billing" className="btn btn-accent">
                Start with a clean-up audit <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-300">Performance snapshot</p>
                <span className="flex items-center gap-1.5 rounded-full bg-mint-500/15 px-2.5 py-1 text-[0.6rem] font-bold text-mint-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-400" /> Monthly
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {kpis.slice(0, 4).map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                    <p className="text-lg font-extrabold leading-none">{kpi.value}</p>
                    <p className="mt-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/45">{kpi.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-night-soft/60 p-4">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white/40">Claims filed on time</p>
                <div className="mt-3 flex h-20 items-end gap-1.5">
                  {[72, 84, 88, 93, 96, 98, 99, 99.9].map((value, index) => (
                    <div key={index} className="group relative flex h-full flex-1 items-end">
                      <div style={{ height: `${value}%` }} className="w-full rounded-t-sm bg-gradient-to-t from-brand-600/60 to-brand-300 transition-all group-hover:from-mint-500 group-hover:to-mint-300" />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[0.58rem] font-semibold text-white/30">
                  <span>Q1</span>
                  <span>Now</span>
                </div>
              </div>
              <p className="mt-3 text-[0.66rem] leading-relaxed text-white/35">Illustrative trend of the metric we manage to — 99.9% claim acceptance, with claims filed within 24 hours.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <Reveal>
            <SectionLabel>Beyond the claim</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              What better billing <span className="display-serif text-brand-600">actually changes.</span>
            </h2>
            <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
              Accurate billing does more than raise collections. It reduces administrative load, improves the patient experience and protects your practice.
            </p>
            <div className="mt-6 grid gap-2.5">
              {benefits.slice(0, 5).map((benefit) => (
                <div key={benefit.title} className="flex items-start gap-2.5 rounded-xl border border-mist-200 bg-mist-50/60 p-3.5">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" strokeWidth={2.2} />
                  <div>
                    <p className="text-[0.82rem] font-extrabold text-ink-950">{benefit.title}</p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-600/70">{benefit.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-3xl border border-mist-200 bg-mist-50 p-1">
              <div className="rounded-[1.35rem] bg-surface p-5 sm:p-6">
                <SectionLabel>Model your potential</SectionLabel>
                <h3 className="mt-2 text-xl font-extrabold tracking-tight text-ink-950">Estimate your revenue opportunity</h3>
                <div className="mt-4">
                  <RoiCalculator compact />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand title="Let's find out what your revenue cycle is missing." description="Schedule a free consultation. We will review your billing process, claim acceptance and outstanding A/R, and tell you honestly where the money is." />
    </>
  );
}
