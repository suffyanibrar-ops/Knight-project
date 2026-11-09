import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, Info } from "lucide-react";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/seo";
import { photo } from "@/lib/photos";
import { perspectives } from "@/lib/testimonials";
import { Reveal, SectionLabel } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "Medical Billing Case Studies | Verified Results",
  description: "Knight Medical Billing publishes verified case studies only. Review our results framework and the practice-perspective themes we are preparing for publication.",
  path: "/results/case-studies",
  keywords: ["medical billing case studies", "medical billing results", "revenue cycle case study"],
});

export default function CaseStudiesPage() {
  return (
    <>
      <PageHero
        path="/results/case-studies"
        eyebrow="Case studies"
        title={<>Verified results, <span className="display-serif text-brand-600">never invented ones.</span></>}
        description="We are preparing case studies with documented, practice-approved outcomes. Until a result is verified and permission is in place, we will not publish a percentage, client name, logo or testimonial."
        image={photo.executiveMeeting}
        imageAlt="Healthcare leaders reviewing performance information"
        badges={["Verified only", "Practice approval required", "No fabricated outcomes"]}
        crumbs={[{ label: "Results", href: "/results" }, { label: "Case Studies" }]}
        primaryCta={{ label: "Review your billing opportunity", href: "/schedule-form" }}
        secondaryCta={{ label: "See how we measure", href: "/results" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell max-w-3xl">
          <Reveal>
            <SectionLabel>Publication standard</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">What a Knight case study will include.</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">A credible billing case study needs context, not just a headline number. Before publication, we require the practice&apos;s written approval and a documented basis for every figure.</p>
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {[
                "The practice setting, specialty and approximate provider count",
                "The baseline problem and the period it covers",
                "The work Knight actually performed",
                "The metric definition and data source",
                "The measured change, with time period and caveats",
                "The practice's approved quote and permission to publish",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 rounded-xl border border-mist-200 bg-mist-50/60 p-3.5 text-[0.8rem] font-semibold leading-relaxed text-ink-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" /> {item}
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-start gap-2 rounded-2xl border border-mist-200 bg-mist-50 p-4 text-[0.74rem] leading-relaxed text-ink-600/75">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              Until those conditions are met, this page remains a transparent placeholder. It is not evidence of a result.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="practice-perspectives" className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <SectionLabel>Practice perspectives</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">Themes, clearly labelled as themes.</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">These are anonymised operating themes shared with our team — not attributed testimonials or verified client outcomes. Each one describes what we would examine, not a claim about a named practice.</p>
          </Reveal>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {perspectives.map((perspective) => (
              <Reveal key={perspective.id}>
                <div className="h-full rounded-3xl border border-mist-200 bg-surface p-5">
                  <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">{perspective.theme}</p>
                  <blockquote className="mt-2 text-[0.9rem] leading-relaxed text-ink-800">&ldquo;{perspective.quote}&rdquo;</blockquote>
                  <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-600/60">Anonymised operating theme</p>
                  <p className="mt-1 text-[0.72rem] text-ink-600/75">{perspective.context}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/results" className="btn btn-light">Results and performance <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/insights/how-to-choose-medical-billing-company" className="btn btn-light">How to choose a billing company</Link>
          </div>
        </div>
      </section>

      <CtaBand title="Ask what we can measure in your practice." description="We would rather discuss your data than present a generic success story. A consultation starts with your current claims, A/R and reporting." />
    </>
  );
}
