import { pageMetadata } from "@/lib/seo";
import { ArrowRight, BadgeCheck, BarChart3, Check, Clock, FileCheck2, Info, TrendingUp } from "lucide-react";
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
import { benefits, site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Results & Performance | How We Measure Billing",
  description:
    "See how Knight Medical Billing makes the revenue cycle visible: clean-claim review, daily submission worklists, denial follow-up, A/R aging and monthly reporting. Use the illustrative opportunity model to frame a conversation.",
  path: "/results",
  keywords: ["medical billing results", "revenue cycle reporting", "medical billing performance"],
});

const measures = [
  {
    icon: FileCheck2,
    title: "Claim review",
    detail: "Coding, modifiers and payer edits are checked before a claim is submitted. The goal is fewer correctable errors leaving the team.",
    value: "Every claim",
  },
  {
    icon: Clock,
    title: "Submission worklist",
    detail: "Claims move through a daily queue with payer filing deadlines visible, rather than waiting for someone to have time.",
    value: "Daily",
  },
  {
    icon: TrendingUp,
    title: "Denial ownership",
    detail: "Denials are assigned, worked inside payer deadlines and fed back to the front end so the same reason does not keep returning.",
    value: "Root causes",
  },
  {
    icon: BarChart3,
    title: "A/R visibility",
    detail: "Outstanding balances are aged by payer and owner, with a next action attached — not just a total on a monthly slide.",
    value: "Payer-level",
  },
];

export default function ResultsPage() {
  return (
    <>
      <PageHero
        path={"/results"}
        eyebrow="Results & performance"
        title={
          <>
            Performance you can see, <span className="display-serif text-brand-600">not just numbers to trust.</span>
          </>
        }
        description="We would rather show you the work we measure, report and own than make outcome promises. This page explains the operating discipline behind a healthier revenue cycle — and gives you a model to frame the conversation."
        image={pageHeroVisuals.results}
        imageAlt="Photograph of a specialist reviewing revenue reports on a laptop"
        badges={["Every claim reviewed", "Daily worklists", "Monthly reporting"]}
        crumbs={[{ label: "Results" }]}
        primaryCta={{ label: "Review your billing opportunity", href: "/schedule-form" }}
        secondaryCta={{ label: `Call ${site.phone}`, href: site.phoneHref }}
        stat={{ value: "Monthly", label: "Performance review" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <SectionLabel>What we measure</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Four things that make the work <span className="display-serif text-brand-600">visible.</span>
            </h2>
            <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
              These are operating measures, not a promise of a specific client outcome. They tell you whether the process is being run — and where it needs attention.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {measures.map((measure, index) => (
              <Reveal key={measure.title} delay={index * 0.05} className="h-full">
                <TiltCard className="group h-full">
                  <div className="flex h-full gap-4 rounded-3xl border border-mist-200 bg-gradient-to-b from-white to-mist-50/60 p-5 transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                      <measure.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="text-xl font-extrabold tracking-tight text-ink-950">{measure.value}</p>
                        <p className="text-[0.8rem] font-extrabold text-ink-800">{measure.title}</p>
                      </div>
                      <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-600/75">{measure.detail}</p>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 flex items-start gap-2 rounded-2xl border border-mist-200 bg-mist-50 p-4 text-[0.76rem] leading-relaxed text-ink-600/75">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            We do not publish client outcome statistics without a verified basis. Ask us during a consultation what we can measure in your specific billing system and payer mix.
          </p>
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
              We do not chase metrics directly. We fix the steps that produce them: eligibility before the visit, clean-claim review, disciplined submission, accurate posting and persistent A/R follow-up.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                "Eligibility and authorization checked before the visit where possible",
                "Coding and documentation reviewed before submission",
                "Claims submitted and acknowledged from a daily worklist",
                "Payments reconciled against contracted rates",
                "Denials worked inside payer deadlines with root-cause feedback",
                "A/R aged by payer and owner, with a next action",
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
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-300">Monthly review</p>
                <span className="flex items-center gap-1.5 rounded-full bg-mint-500/15 px-2.5 py-1 text-[0.6rem] font-bold text-mint-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-400" /> Reported consistently
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "Collections and payer mix",
                  "Claim review and submission status",
                  "Denial reasons and appeal status",
                  "Days in A/R and aged balances",
                  "Charge lag and documentation issues",
                  "What changed, why it changed and who owns the next action",
                ].map((item, index) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[0.6rem] font-extrabold text-brand-200">{String(index + 1).padStart(2, "0")}</span>
                    <p className="text-[0.8rem] font-semibold text-white/75">{item}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-night-soft/60 p-3.5 text-[0.68rem] leading-relaxed text-white/45">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This is the structure of the review. The figures come from your billing system — not from a generic benchmark.
              </p>
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
                <SectionLabel>Illustrative model</SectionLabel>
                <h3 className="mt-2 text-xl font-extrabold tracking-tight text-ink-950">Frame the revenue opportunity</h3>
                <p className="mt-2 text-[0.78rem] leading-relaxed text-ink-600/75">
                  Use the sliders to explore a modelled opportunity. Actual outcomes depend on specialty, payer mix, claim volume, current processes, reimbursement and other factors.
                </p>
                <div className="mt-4">
                  <RoiCalculator compact />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Review your billing opportunity with a real conversation."
        description="We will review your current process, what is visible, what is not and where a dedicated Knight team could take responsibility. No prepayment, no hidden fees."
      />
    </>
  );
}
