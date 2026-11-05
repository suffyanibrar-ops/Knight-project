import { pageMetadata } from "@/lib/seo";
import { ArrowRight, Check, Clock, Headphones, Phone, ShieldCheck, Timer, Workflow } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { ProcessTimeline } from "@/components/process-timeline";
import { ParallaxFrame } from "@/components/sections/parallax-frame";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { photo } from "@/lib/photos";
import { Reveal, SectionLabel } from "@/components/ui";
import { billingSoftware, processSteps, rcmLifecycle, site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Our Process | Fast & Easy 5-Day Start', description: 'Our onboarding is a fast, easy five-day process: consultation, a dedicated billing team, revenue cycle stabilization and ongoing reporting. No prepayment required.', path: '/our-process', keywords: ['medical billing onboarding', 'revenue cycle management process'] });

const supportPoints = [
  { icon: Timer, title: "Claims filed in 24 hours", detail: "Every claim is built clean and filed the next business day." },
  { icon: Headphones, title: "24/5 multilingual support", detail: "Patients and staff get answers in the language they need." },
  { icon: ShieldCheck, title: "HIPAA-compliant process", detail: "Secure data flow, strict quality control and confidentiality." },
];

export default function OurProcessPage() {
  return (
    <>
      <PageHero path={"/our-process"}

        eyebrow="Our process"
        title={
          <>
            A fast, easy <span className="display-serif text-brand-600">5-day start.</span>
          </>
        }
        description="No prepayment, no hidden fees, no six-month implementation. We interview you about what you are looking for, then build a billing and coding team dedicated to your facility — and get to work."
        image={pageHeroVisuals.process}
        imageAlt="Photograph of a team presentation during onboarding"
        badges={["5-day onboarding", "No prepayment", "24/5 support"]}
        crumbs={[{ label: "Our process" }]}
        primaryCta={{ label: "Start with a consultation", href: "/schedule-form" }}
        secondaryCta={{ label: `Call ${site.phone}`, href: site.phoneHref }}
        stat={{ value: "5 days", label: "To a dedicated team" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionLabel className="justify-center">How we start</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.8rem,3.8vw,2.6rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Four steps. <span className="display-serif text-brand-600">Zero disruption.</span>
            </h2>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-600/80">Click any step to see what happens.</p>
          </Reveal>
          <Reveal className="mt-9" delay={0.08}>
            <ProcessTimeline />
          </Reveal>
        </div>
      </section>

      <section className="bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <Reveal>
            <SectionLabel>What we take over</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              The whole cycle, <span className="display-serif text-brand-600">owned by one team.</span>
            </h2>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-600/80">
              Revenue cycle management begins with the patient&apos;s appointment and ends when the provider receives all payments. These are the steps our team runs for your facility.
            </p>
            <ol className="mt-5 grid gap-1.5 sm:grid-cols-2">
              {rcmLifecycle.map((step, index) => (
                <li key={step} className="flex items-start gap-2 rounded-xl border border-mist-200 bg-surface px-3 py-2.5 text-[0.78rem] font-semibold text-ink-800">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500 text-[0.55rem] font-extrabold text-white">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="relative overflow-hidden rounded-3xl border border-mist-200 bg-surface p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Workflow className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Software we support</p>
                  <p className="text-[0.95rem] font-extrabold text-ink-950">We adapt to your system</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {billingSoftware.map((tool) => (
                  <span key={tool} className="rounded-lg border border-mist-200 bg-mist-50 px-2 py-1.5 text-[0.7rem] font-bold text-ink-800">
                    {tool}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[0.8rem] leading-relaxed text-ink-600/75">
                Billing software is central to the revenue cycle. Our team has hands-on experience across major platforms, so you never have to migrate or retrain staff to work with us.
              </p>
              <div className="mt-4 space-y-2.5 border-t border-mist-100 pt-4">
                {supportPoints.map(({ icon: PointIcon, title, detail }) => (
                  <div key={title} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-mint-50 text-mint-700">
                      <PointIcon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[0.8rem] font-extrabold leading-tight text-ink-950">{title}</p>
                      <p className="mt-0.5 text-[0.74rem] text-ink-600/70">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="relative order-2 lg:order-1">
            <ParallaxFrame
              src={photo.documentsDesk}
              alt="Photograph of revenue cycle reporting documents"
              aspect="aspect-[4/3]"
              className="border-mist-200 shadow-[0_36px_70px_-45px_rgba(4,20,31,0.5)]"
            >
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md">
                <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-white/70">An extension of your staff</p>
                <p className="mt-1 text-[0.95rem] font-extrabold leading-snug text-white">You heal. Leave the revenue management to us.</p>
              </div>
            </ParallaxFrame>
          </div>
          <Reveal delay={0.08} className="order-1 lg:order-2">
            <SectionLabel>Reporting</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              You will know exactly <span className="display-serif text-brand-600">what is happening.</span>
            </h2>
            <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
              We keep you informed with accessible data and performance. You will know what is happening with your revenue cycle management and the changes that can be made to improve it.
            </p>
            <div className="mt-5 space-y-2.5">
              {[
                "Claim acceptance and denial reporting",
                "Outstanding A/R by age and payer",
                "Payment posting and credit balance review",
                "Coding and documentation feedback",
                "Credentialing and contract status",
                "Dedicated account manager access",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-[0.85rem] font-semibold text-ink-800">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-50 text-mint-700">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/results" className="btn btn-primary">
                See how we measure results <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={site.phoneHref} className="btn btn-light">
                <Phone className="h-4 w-4" /> {site.phone}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-mist-50 py-14">
        <div className="shell grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <Reveal key={step.step}>
              <div className="h-full rounded-2xl border border-mist-200 bg-surface p-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-brand-700">
                  <Clock className="h-2.5 w-2.5" /> {step.duration}
                </span>
                <p className="mt-2 text-[0.9rem] font-extrabold text-ink-950">{step.title}</p>
                <p className="mt-1 text-[0.76rem] leading-relaxed text-ink-600/75">{step.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand title="Ready to start your 5-day onboarding?" />
    </>
  );
}
