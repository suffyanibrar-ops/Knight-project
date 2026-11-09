import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Workflow } from "lucide-react";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { softwareHub, softwarePlatforms, otherSoftware } from "@/lib/seo-content";
import { pageMetadata } from "@/lib/seo";
import { photo } from "@/lib/photos";
import { Reveal, SectionLabel } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: softwareHub.title,
  description: softwareHub.description,
  path: "/software",
  keywords: ["medical billing software", "EHR billing", "AdvancedMD billing", "eClinicalWorks billing", "NextGen billing", "Tebra billing"],
});

export default function SoftwareHubPage() {
  return (
    <>
      <PageHero
        path="/software"
        eyebrow={softwareHub.eyebrow}
        title={<>{softwareHub.h1}</>}
        description={softwareHub.intro}
        image={photo.medicalBillingSoftwareHub}
        imageAlt="Billing specialist reviewing revenue-cycle software"
        badges={["Works in your system", "No platform migration", "Billing team, not software vendor"]}
        crumbs={[{ label: "Software & EHR Expertise" }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: "Explore services", href: "/services" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <SectionLabel>Platforms we work in</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Choose your system. <span className="display-serif text-brand-600">Keep it.</span>
            </h2>
            <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
              We are a billing partner, not a software vendor. These pages explain how we work inside each system and what we can manage around it. We do not claim official partnerships or certifications.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {softwarePlatforms.map((platform, index) => (
              <Reveal key={platform.slug} delay={Math.min(index * 0.05, 0.25)}>
                <Link href={`/software/${platform.slug}`} className="group flex h-full flex-col rounded-3xl border border-mist-200 bg-surface p-5 transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                      <Workflow className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-600/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </div>
                  <h3 className="mt-4 text-[1.05rem] font-extrabold tracking-tight text-ink-950">{platform.name}</h3>
                  {platform.formerName && <p className="mt-0.5 text-[0.7rem] font-bold text-brand-700">{platform.formerName}</p>}
                  <p className="mt-2 flex-1 text-[0.82rem] leading-relaxed text-ink-600/75">{platform.intro.split(". ").slice(0, 2).join(". ")}.</p>
                  <span className="mt-4 text-[0.74rem] font-extrabold text-brand-700">How we work in {platform.name} <ArrowRight className="ml-1 inline h-3 w-3" /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <Reveal>
            <SectionLabel>What this means in practice</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">
              Your team keeps its workflow. <span className="display-serif text-brand-600">The revenue work gets an owner.</span>
            </h2>
            <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
              Software does not collect a claim by itself. Eligibility, authorization, charge review, submission, posting, denials and A/R follow-up still need a team with the capacity and accountability to work them.
            </p>
          </Reveal>
          <Reveal delay={0.06} className="grid gap-2.5 sm:grid-cols-2">
            {[
              "We work in the systems practices already use, not from a spreadsheet outside them.",
              "We do not describe ourselves as a software vendor or claim unverified integrations.",
              "Your clinical, scheduling and patient systems can stay where they are.",
              "Every engagement starts with a review of access, scope and current workflow.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 rounded-2xl border border-mist-200 bg-surface p-4 text-[0.82rem] font-semibold leading-relaxed text-ink-800">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" strokeWidth={3} /> {item}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <Reveal>
            <SectionLabel>Also listed by our team</SectionLabel>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink-950">Other systems we can discuss</h2>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-600/75">
              We only publish dedicated pages for systems we can describe with confidence. For other platforms, ask during a consultation and we will confirm the current workflow before proposing anything.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {otherSoftware.map((item) => (
                <span key={item} className="rounded-full border border-mist-200 bg-mist-50 px-2.5 py-1.5 text-[0.72rem] font-bold text-ink-800">{item}</span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-mint-50 p-6">
              <BadgeCheck className="h-6 w-6 text-mint-600" />
              <h2 className="mt-3 text-lg font-extrabold text-ink-950">Need a specialist review?</h2>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-600/80">
                If your practice uses a system not listed here, tell us what it is and how your team uses it. We will confirm whether it is a supported workflow before any commitment.
              </p>
              <Link href="/schedule-form" className="btn btn-primary mt-4">Talk With Knight <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/insights/how-to-choose-medical-billing-company" className="mt-3 block text-[0.78rem] font-extrabold text-brand-700">Read the billing-company buyer&apos;s guide</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand title="Keep your software. Improve the revenue cycle." />
    </>
  );
}
