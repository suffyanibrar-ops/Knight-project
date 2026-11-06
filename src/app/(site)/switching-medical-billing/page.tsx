import type { Metadata } from "next";
import Link from "next/link";
import { Check, ClipboardCheck, FileSearch, Handshake, MessageSquare, ShieldCheck, Workflow } from "lucide-react";
import { JsonLd } from "@/components/structured-data";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { CtaBand } from "@/components/cta-band";
import { TrackedLink } from "@/components/tracked-link";
import { PageHero } from "@/components/page-hero";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { Accordion, Reveal, SectionLabel } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Switching Medical Billing Partners | Knight Medical Billing",
  description: "A practical guide to switching medical billing partners: existing A/R, open claims, software, reporting, communication and what a transition actually involves.",
  path: "/switching-medical-billing",
  keywords: ["switching medical billing companies", "change medical billing partner", "billing transition"],
});

const transitionSteps = [
  { step: "01", title: "Understand the current state", detail: "We review your software, payer mix, open claims, aged A/R, credentialing status and who owns each step today. This is a working session, not a sales presentation." },
  { step: "02", title: "Agree on scope and access", detail: "We define what Knight will own, what stays with your team and what access is required. You receive a written scope before work begins." },
  { step: "03", title: "Build the transition plan", detail: "We sequence account access, team assignment, documentation standards, worklists and communication. Timing depends on your environment — not a generic countdown." },
  { step: "04", title: "Stabilize the work", detail: "Open claims and A/R are worked against filing and appeal deadlines. We document root causes rather than simply clearing a queue." },
  { step: "05", title: "Operate and report", detail: "Daily worklists continue, denials are owned and monthly reporting explains what changed and what happens next." },
];

const questions = [
  { q: "What happens to our existing A/R?", a: "We review the aged balances by payer, filing deadline and collectability, then agree on what Knight will work and what stays with your team. We do not promise that every historical balance is recoverable; we do promise a documented work plan and visibility into what is happening." },
  { q: "What happens to open claims?", a: "Open claims are reviewed against payer filing and appeal deadlines. Correctable claims are worked first; anything outside a payer window is documented so the decision is explicit rather than silent." },
  { q: "Will we have to change billing software?", a: "No. Knight works inside your existing billing system and clearinghouse where access and functionality allow. We agree on access and workflow before the transition starts. If a tool cannot support the work, we raise it during scoping rather than after go-live." },
  { q: "Who manages the transition?", a: "A named account lead is your point of contact. They coordinate scope, access, questions and reporting with the operational team. You should not have to chase multiple people to find out what is happening." },
  { q: "How long does implementation take?", a: "It depends on access, payer mix, the state of the existing A/R and how quickly decisions can be made. We agree on a plan and milestones after the assessment. We do not publish a fixed number of days and then blame the practice when it slips." },
  { q: "What happens to our existing billing team?", a: "That is your decision. Some organizations keep an in-house team for patient-facing work and hand off selected functions; others transition the full revenue cycle. We document who owns each step so nothing falls between the two teams." },
  { q: "How will reporting and communication work?", a: "Reporting is built from your billing system and reviewed on a consistent cadence. It covers collections, claim review and submission, denials, days in A/R and charge lag, with an explanation of what changed and who owns the next action." },
  { q: "What do you need from us before we start?", a: "A clear scope, appropriate system access, payer and credentialing information, an administrative escalation contact and a shared understanding of the current process. We provide a checklist during scoping." },
];

const pricingFactors = [
  "Number of providers and facilities",
  "Monthly claim volume and specialty complexity",
  "Scope: full RCM, selected services or a one-time clean-up",
  "Current A/R and denial backlog",
  "Credentialing and payer enrollment needs",
  "Payer mix and out-of-network exposure",
  "Software and clearinghouse access",
  "Reporting and communication requirements",
];

export default function SwitchingPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Switching billing partners", path: "/switching-medical-billing" }])} />
      <PageHero
        path={"/switching-medical-billing"}
        eyebrow="Switching billing partners"
        title={<>Change the partner, <span className="display-serif text-brand-600">not the thread.</span></>}
        description="A billing transition should make the work more visible, not create a black box. Here is how Knight approaches existing A/R, open claims, software, communication and the first phase — without promising a timeline we cannot control."
        image={pageHeroVisuals.process}
        imageAlt="Photograph of a team reviewing a transition plan"
        badges={["Works in your software", "Named account lead", "No prepayment"]}
        crumbs={[{ label: "Switching billing partners" }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: `Call ${site.phone}`, href: site.phoneHref }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <Reveal>
            <SectionLabel>Before you switch</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">The questions that matter more than the sales deck.</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">A change of billing partner affects cash flow, patient communication and the team doing the work. These are the questions we answer before asking for a commitment.</p>
            <div className="mt-6 space-y-2.5">
              {["Who owns each step from eligibility to final payment?", "How are open claims and aged A/R handed over?", "What access is required, and how is it secured?", "How will we know what is stuck and what happens next?", "What stays with our internal team?"].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-[0.84rem] font-semibold text-ink-800">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><Check className="h-3 w-3" strokeWidth={3} /></span>
                  {item}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-3xl border border-mist-200 bg-mist-50 p-6 sm:p-7">
              <p className="flex items-center gap-2 text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-brand-700"><ShieldCheck className="h-4 w-4" /> What we will not do</p>
              <ul className="mt-4 space-y-3 text-[0.84rem] leading-relaxed text-ink-700">
                <li>Promise a recovery figure before reviewing the actual A/R.</li>
                <li>Claim every historical claim can still be collected.</li>
                <li>Hide a fixed onboarding date behind a sales timeline.</li>
                <li>Take over a process without naming who owns each step.</li>
                <li>Ask you to migrate software just to work with us.</li>
              </ul>
              <p className="mt-5 rounded-xl border border-mist-200 bg-surface p-3 text-[0.76rem] leading-relaxed text-ink-600/75">If we cannot support something, we say so during scoping. A clear no is better than a difficult transition.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-mist-50 py-14 sm:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <SectionLabel>A transition with ownership</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">Five stages. No black box.</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">The sequence is consistent. The calendar is agreed after we understand your environment.</p>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {transitionSteps.map((item, index) => (
              <Reveal key={item.step} delay={index * 0.04}>
                <div className="h-full rounded-2xl border border-mist-200 bg-surface p-5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-night-soft text-[0.68rem] font-extrabold text-white">{item.step}</span>
                  <p className="mt-3 text-[0.9rem] font-extrabold leading-snug text-ink-950">{item.title}</p>
                  <p className="mt-1.5 text-[0.76rem] leading-relaxed text-ink-600/75">{item.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <div className="mx-auto max-w-2xl text-center">
            <SectionLabel className="justify-center">Practical answers</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.65rem,3.4vw,2.3rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">Questions organizations ask before switching.</h2>
          </div>
          <div className="mx-auto mt-7 max-w-3xl"><Accordion items={questions} /></div>
        </div>
      </section>

      <section id="pricing" className="bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <Reveal>
            <SectionLabel>What shapes the proposal</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.6rem,3.2vw,2.2rem)] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink-950">Why medical billing pricing varies.</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">We do not publish a single price because the work is not the same for every organization. A proposal should reflect the scope, risk and volume — not a generic package.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {pricingFactors.map((factor) => (
                <div key={factor} className="flex items-start gap-2 rounded-xl border border-mist-200 bg-surface px-3 py-2.5 text-[0.76rem] font-semibold text-ink-800"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} /> {factor}</div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-3xl border border-mist-200 bg-surface p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: FileSearch, title: "We review before quoting", detail: "Scope and pricing follow a real look at claims, A/R, software and payer mix." },
                  { icon: ClipboardCheck, title: "Written scope", detail: "Responsibilities and access are documented before work starts." },
                  { icon: Workflow, title: "No software migration", detail: "We work in your existing billing system where access allows." },
                  { icon: Handshake, title: "Named account lead", detail: "One person coordinates the transition and the ongoing relationship." },
                  { icon: MessageSquare, title: "Plain communication", detail: "We explain what changed, what is stuck and who owns the next action." },
                  { icon: ShieldCheck, title: "Security reviewed", detail: "Data handling and access requirements are agreed before onboarding." },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-mist-200 bg-mist-50/60 p-4"><item.icon className="h-4 w-4 text-brand-700" /><p className="mt-2 text-[0.82rem] font-extrabold text-ink-950">{item.title}</p><p className="mt-1 text-[0.73rem] leading-relaxed text-ink-600/75">{item.detail}</p></div>
                ))}
              </div>
              <p className="mt-4 text-[0.73rem] leading-relaxed text-ink-600/70">Already know what you need? <TrackedLink href="/services" conversion="switching_page_cta" conversionParams={{ target: "services" }} className="font-bold text-brand-700 hover:text-brand-500">Compare the services</TrackedLink> or read <TrackedLink href="/our-process" conversion="switching_page_cta" conversionParams={{ target: "process" }} className="font-bold text-brand-700 hover:text-brand-500">how onboarding works</TrackedLink>.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand title="Compare your current process with a clearer one." description="Bring your open questions, current A/R picture and software setup. We will tell you honestly what we can take over and what we cannot." />
    </>
  );
}
