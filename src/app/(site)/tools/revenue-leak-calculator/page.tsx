import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { RevenueLeakCalculator } from "@/components/revenue-leak-calculator";
import { photo } from "@/lib/photos";
import { Reveal, SectionLabel } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "Revenue Leak Calculator | Medical Billing Indicators",
  description: "Use this educational revenue-leak calculator to review collection rate, aged A/R, denial exposure and billing-cost indicators. Estimates only — no data submitted.",
  path: "/tools/revenue-leak-calculator",
  keywords: ["medical billing calculator", "revenue cycle calculator", "A/R calculator", "denial rate calculator"],
});

export default function RevenueLeakCalculatorPage() {
  return (
    <>
      <PageHero
        path="/tools/revenue-leak-calculator"
        eyebrow="Revenue-cycle tool"
        title={<>See where the revenue cycle <span className="display-serif text-brand-600">deserves a closer look.</span></>}
        description="Enter a recent month of practice numbers to get neutral indicators for collection rate, aged A/R, denial exposure and billing cost. The result is a conversation starter — not a calculated promise or a diagnosis."
        image={photo.medicalBillingPricingCalculator}
        imageAlt="Financial reports and charts on a desk"
        badges={["No data submitted", "No PHI required", "Estimates only"]}
        crumbs={[{ label: "Resources", href: "/insights" }, { label: "Revenue Leak Calculator" }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: "Read the A/R guide", href: "/insights/ar-follow-up-that-recovers-cash" }}
      />
      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <Reveal className="mb-7 max-w-2xl">
            <SectionLabel>Educational estimate</SectionLabel>
            <h2 className="mt-2 text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.03em] text-ink-950">Start with the numbers you already have.</h2>
            <p className="mt-2 text-[0.84rem] leading-relaxed text-ink-600/80">Use one recent month and keep the inputs consistent. The tool does not transmit or store the numbers you enter.</p>
          </Reveal>
          <RevenueLeakCalculator />
        </div>
      </section>
      <CtaBand title="Turn an indicator into a real review." description="We can review your current claims, A/R and reporting and explain what we would investigate first. No prepayment, no hidden fees." />
    </>
  );
}
