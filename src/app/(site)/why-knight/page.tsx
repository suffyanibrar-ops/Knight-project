import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, HeartHandshake, ShieldCheck } from "lucide-react";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { JsonLd } from "@/components/structured-data";
import { pageMetadata, breadcrumbSchema } from "@/lib/seo";
import { photo } from "@/lib/photos";
import { leadership, processSteps, site } from "@/lib/site";
import { Reveal, SectionLabel } from "@/components/ui";

export const metadata: Metadata = pageMetadata({
  title: "Why Providers Choose Knight Medical Billing",
  description: "Why practices choose Knight: billing inside your existing software, a dedicated team, named ownership, clear reporting and disciplined A/R follow-up.",
  path: "/why-knight",
  keywords: ["why choose Knight Medical Billing", "medical billing company for independent practices"],
});

const differentiators = [
  { title: "We work in your software", detail: "No rip-and-replace and no parallel billing system. Where access allows, our team works inside the platform your practice already uses." },
  { title: "A dedicated team, not a queue", detail: "Clients receive a named account team and a direct path for questions, escalations and the monthly performance review." },
  { title: "Clean-claim review before submission", detail: "Eligibility, authorization, coding and payer edits are checked before claims leave the team. Rework is more expensive than prevention." },
  { title: "A/R follow-up with an owner", detail: "Aged balances are segmented by payer and filing deadline, assigned and worked — not left as a monthly total on a slide." },
  { title: "Denial work that closes the loop", detail: "Denials are investigated, appealed inside deadlines and tracked by reason so the upstream cause can be corrected." },
  { title: "Transparent reporting", detail: "Monthly reporting connects collections, claim acceptance, denials and A/R to a next action. You should not need a translator to understand your revenue cycle." },
];

export default function WhyKnightPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Company", path: "/about" }, { name: "Why Knight", path: "/why-knight" }])} />
      <PageHero
        eyebrow="Why Knight"
        title={<>Why independent practices choose <span className="display-serif text-brand-600">Knight Medical Billing.</span></>}
        description="You do not need a larger back office to get more control over the revenue cycle. You need a team that owns the detail, works inside your software and explains what is happening in plain language."
        image={photo.whyKnightTeamCollaboration}
        imageAlt="Knight Medical Billing team collaborating in a bright office"
        badges={["Dedicated team", "Works in your software", "No prepayment"]}
        crumbs={[{ label: "Company", href: "/about" }, { label: "Why Knight" }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: "Meet the team", href: "/about" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <SectionLabel>What we focus on</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">The difference is in what gets <span className="display-serif text-brand-600">owned.</span></h2>
            <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">We do not claim every practice will see the same result. We do commit to a defined operating model: the right work, assigned to the right person, reported clearly.</p>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {differentiators.map((item, index) => (
              <Reveal key={item.title} delay={Math.min(index * 0.05, 0.25)}>
                <div className="h-full rounded-3xl border border-mist-200 bg-gradient-to-b from-white to-mist-50/60 p-5">
                  <BadgeCheck className="h-5 w-5 text-mint-600" />
                  <h3 className="mt-3 text-[0.94rem] font-extrabold text-ink-950">{item.title}</h3>
                  <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-600/75">{item.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <Reveal>
            <SectionLabel>Our operating model</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink-950">A structured start, not a rushed handoff.</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">The first weeks set the tone. We review the current workflow, agree on access and scope, assign the team and stabilize the work before making promises about a future month.</p>
            <Link href="/our-process" className="btn btn-light mt-5">See the onboarding process <ArrowRight className="h-4 w-4" /></Link>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {processSteps.map((step) => (
              <div key={step.step} className="rounded-2xl border border-mist-200 bg-surface p-4">
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-700">{step.step} · {step.duration}</p>
                <p className="mt-1.5 text-[0.88rem] font-extrabold text-ink-950">{step.title}</p>
                <p className="mt-1 text-[0.76rem] leading-relaxed text-ink-600/75">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <Reveal>
            <SectionLabel>Leadership</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink-950">A clinician-founded team.</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">Knight Medical Billing was founded by Dr. Fianko after seeing the administrative burden that can get between providers and patient care. That perspective shapes how we communicate and what we take off your team&apos;s desk.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/about" className="btn btn-light">About Knight <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/contact" className="btn btn-light">Contact us</Link>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="rounded-3xl border border-mist-200 bg-mist-50 p-5">
              {leadership.map((person) => (
                <div key={person.name}>
                  <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Founder</p>
                  <p className="mt-2 text-xl font-extrabold text-ink-950">{person.name}</p>
                  <p className="text-[0.78rem] font-bold text-ink-600/80">{person.role}</p>
                  <p className="mt-3 text-[0.8rem] leading-relaxed text-ink-600/80">{person.bio}</p>
                  <p className="mt-2 text-[0.76rem] leading-relaxed text-ink-600/70">{person.detail}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-8 lg:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Security and privacy", detail: "HIPAA-conscious handling, limited access and documented data flow are part of the onboarding conversation.", href: "/hipaa-compliance", label: "HIPAA & security" },
            { icon: HeartHandshake, title: "Your team stays with patients", detail: "We take the billing work that consumes front-office time so clinical staff can focus on care.", href: "/who-we-serve/private-practices", label: "Independent practices" },
            { icon: Check, title: "Clear next step", detail: "A consultation reviews your current workflow and scope before pricing or commitment.", href: "/schedule-form", label: "Talk With Knight" },
          ].map(({ icon: ItemIcon, title, detail, href, label }) => (
            <Reveal key={title}>
              <div className="rounded-3xl border border-mist-200 bg-surface p-5">
                <ItemIcon className="h-5 w-5 text-brand-700" />
                <h2 className="mt-3 text-[0.95rem] font-extrabold text-ink-950">{title}</h2>
                <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-600/75">{detail}</p>
                <Link href={href} className="mt-4 inline-flex items-center gap-1 text-[0.76rem] font-extrabold text-brand-700">{label} <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand title="Start with a conversation about your revenue cycle." description={`Call ${site.phone} or request a consultation. We will review the current workflow and explain what a dedicated Knight team would own.`} />
    </>
  );
}
