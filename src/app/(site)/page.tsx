import Image from "next/image";
import type { Metadata } from "next";
import { JsonLd } from "@/components/structured-data";
import { pageMetadata, faqSchema, breadcrumbSchema } from "@/lib/seo";
import { AlertCircle, ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronRight, Clock, FileCheck2, Headphones, LineChart, Mail, MapPin, Phone, Quote, ShieldCheck, Sparkles, TrendingUp, Workflow } from "lucide-react";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { Hero } from "@/components/hero";
import { RevenuePipeline } from "@/components/interactive/revenue-pipeline";
import { AnimatedMetric } from "@/components/interactive/animated-metric";
import { Icon } from "@/components/icon";
import { TiltCard } from "@/components/motion/tilt-card";
import { ParallaxImage } from "@/components/motion/parallax";
import { photo } from "@/lib/photos";
import { TextReveal } from "@/components/motion/text-reveal";
import { StickySteps } from "@/components/motion/sticky-steps";
import { BeforeAfter } from "@/components/motion/before-after";
import { CardShuffle } from "@/components/motion/card-shuffle";
import { TestimonialsCarousel } from "@/components/testimonials";
import { perspectives } from "@/lib/testimonials";
import { ProcessTimeline } from "@/components/process-timeline";
import { SpecialtyExplorer } from "@/components/specialty-explorer";
import { Accordion, ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { getArticles, getFaqs, getSpecialties } from "@/lib/data";
import { audiences, benefits, billingSoftware, coreValues, faqs as staticFaqs, kpis, payerLogos, rcmLifecycle, services, site, stats } from "@/lib/site";

const homeTitle = "Knight Medical Billing | Custom Tailored Medical Billing & RCM";
const homeMetadata = pageMetadata({ title: homeTitle, description: 'Knight Medical Billing provides medical billing, coding and revenue cycle management for independent practices, multi-provider groups, hospitals, health systems, emergency departments and urgent care organizations. Dedicated teams, clear reporting, no prepayment.', path: '/', keywords: ['medical billing company', 'medical billing services', 'revenue cycle management', 'custom tailored medical billing'] });

// Keep the brand first in the browser tab / search result title. The shared
// title template appends the brand only when it is not already leading.
export const metadata: Metadata = { ...homeMetadata, title: { absolute: homeTitle } };

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [specialties, articles, faqRows] = await Promise.all([getSpecialties(), getArticles(), getFaqs()]);
  const faqs = faqRows.length ? faqRows : staticFaqs;
  const practiceAudiences = audiences.filter((audience) => audience.segment === "practices");
  const facilityAudiences = audiences.filter((audience) => audience.segment === "facilities");

  return (
    <>
      <JsonLd data={[faqSchema(faqs.slice(0, 8)), breadcrumbSchema([{ name: "Home", path: "/" }])]} />
      <Hero />

      <section className="border-y border-mist-200 bg-surface py-6">
        <div className="shell flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <p className="shrink-0 text-center text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-ink-600/70 sm:text-left">Payers we work with</p>
          <div className="mask-fade-x flex w-full items-center gap-8 overflow-hidden">
            <div className="animate-marquee flex w-max items-center gap-10 hover:[animation-play-state:paused]">
              {[...payerLogos, ...payerLogos, ...payerLogos].map((payer, index) => (
                <span key={`${payer}-${index}`} className="flex items-center gap-8 whitespace-nowrap text-[0.78rem] font-bold uppercase tracking-[0.14em] text-ink-600/80">
                  {payer}
                  <span className="h-1 w-1 rounded-full bg-brand-300" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-16">
        <div className="shell">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
            <Reveal>
              <SectionLabel>Problems we solve</SectionLabel>
              <TextReveal
                as="h2"
                text="If any of these sound familiar, the revenue cycle needs attention."
                highlight={["attention."]}
                className="mt-3 block text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-ink-950"
              />
              <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
                These are the issues healthcare organizations describe most often — from independent practices to multi-facility systems. Each one has a process cause and a place to start.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/schedule-form" className="btn btn-primary">Talk With Knight <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/services" className="btn btn-light">Explore our services</Link>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[
                  { title: "Claims sit unpaid", detail: "Balances age past 90 days because follow-up lives at the bottom of someone's list." },
                  { title: "Denials keep repeating", detail: "The same denial reasons come back because the front-end cause is never fixed." },
                  { title: "Front desk is overloaded", detail: "Eligibility calls, authorizations and patient questions consume clinical staff time." },
                  { title: "Underpayments go unnoticed", detail: "Payments post below the contracted rate and are adjusted away without review." },
                  { title: "Enrollment stalls", detail: "A provider is credentialed but the payer file or EDI setup is incomplete." },
                  { title: "No clear reporting", detail: "Nobody can say what days in A/R, clean-claim acceptance or denial rate actually are." },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-mist-200 bg-surface p-4">
                    <p className="flex items-start gap-2 text-[0.85rem] font-extrabold leading-snug text-ink-950">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
                        <AlertCircle className="h-3 w-3" strokeWidth={2.6} />
                      </span>
                      {item.title}
                    </p>
                    <p className="mt-1.5 pl-7 text-[0.78rem] leading-relaxed text-ink-600/75">{item.detail}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <RevenuePipeline />

      <section className="bg-surface py-16 sm:py-24">
        <div className="shell">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionLabel className="justify-center">How the work moves</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              From the visit to the payment, <span className="display-serif text-brand-600">one accountable path.</span>
            </h2>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-600/85">
              Scroll through the four stages our team owns. Each stage hands clean data to the next, which is why fewer claims stall.
            </p>
          </Reveal>
          <Reveal className="mt-10">
            <StickySteps
              steps={[
                {
                  id: "access",
                  step: "01",
                  title: "Patient access & eligibility",
                  body: "Coverage, benefits and authorisation requirements are confirmed before the visit, so the claim starts with correct data.",
                  points: ["Eligibility and benefits verified", "Authorisation requirements flagged", "Estimate shared with the patient"],
                  image: photo.reception,
                  alt: "Receptionist welcoming a patient at a modern practice front desk",
                },
                {
                  id: "coding",
                  step: "02",
                  title: "Coding & charge integrity",
                  body: "Certified coders review documentation against the codes billed, so what is submitted matches what was documented.",
                  points: ["Specialty-matched coding review", "Modifier and bundling checks", "Documentation queries raised early"],
                  image: photo.laptopNotes,
                  alt: "Certified coder reviewing clinical documentation at a laptop",
                },
                {
                  id: "claims",
                  step: "03",
                  title: "Claims, scrubbing & submission",
                  body: "Each claim is checked against payer rules and submitted from a daily worklist, leaving room to correct anything rejected.",
                  points: ["Payer-specific edits applied", "Daily submission worklist", "Acknowledgements monitored"],
                  image: photo.stethoscopeNotes,
                  alt: "Stethoscope resting on clinical notes during a documentation review",
                },
                {
                  id: "payment",
                  step: "04",
                  title: "Posting, follow-up & reporting",
                  body: "Payments post against contracted rates, variances become work, and you see the results in a monthly report.",
                  points: ["ERAs posted and reconciled", "Underpayments flagged", "Reporting with an action plan"],
                  image: photo.analyticsLaptop,
                  alt: "Revenue analyst reviewing performance charts on a laptop",
                },
              ]}
            />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-16 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <Reveal>
            <SectionLabel>The admin reality</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              From paperwork backlog to <span className="display-serif text-brand-600">a clear worklist.</span>
            </h2>
            <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-600/85">
              Nothing changes overnight, but the difference between a practice drowning in unworked claims and one that knows exactly what to chase next is process. Drag the handle to compare.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                { title: "Before", detail: "Claims logged but not worked · denials repeating · no reliable A/R figure" },
                { title: "After", detail: "Every claim owned · root causes fixed · five metrics reported monthly" },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-mist-200 bg-surface p-4">
                  <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-brand-700">{item.title}</p>
                  <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-600">{item.detail}</p>
                </div>
              ))}
            </div>
            <Link href="/our-process" className="btn btn-primary mt-5">
              See our onboarding process <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal delay={0.08}>
            <BeforeAfter
              before="/images/before-after-before.jpg"
              after="/images/before-after-after.jpg"
              beforeAlt="A medical office desk covered in stacks of paper claim forms"
              afterAlt="The same desk cleared, with a laptop showing a clean dashboard"
            />
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-surface py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-end">
            <Reveal>
              <SectionLabel>What we measure</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.8rem,3.8vw,2.7rem)] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink-950">
                Custom tailored billing, <span className="display-serif text-brand-600">measurable results.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-xl text-[0.95rem] leading-relaxed text-ink-600/80 lg:ml-auto">
                From the moment your patient walks in until payment is received, our RCM team supports your growth by focusing on the problem areas in your revenue cycle — and reporting on them honestly.
              </p>
            </Reveal>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi, index) => (
              <Reveal key={kpi.label} delay={index * 0.05}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-mist-200 bg-gradient-to-b from-white to-mist-50/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_24px_50px_-34px_rgba(4,20,31,0.45)]">
                  <p className="text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold leading-none tracking-tight text-ink-950"><AnimatedMetric value={kpi.value} /></p>
                  <p className="mt-2 text-sm font-extrabold tracking-tight text-ink-900">{kpi.label}</p>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-600/70">{kpi.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-mist-200 bg-surface py-14 sm:py-16">
        <div className="shell">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <SectionLabel className="justify-center">In 30 seconds</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.1] tracking-[-0.035em] text-ink-950">
                We are a medical billing company. <span className="display-serif text-brand-600">You treat patients, we get you paid.</span>
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/80">
                Knight Medical Billing takes over the paperwork between your patient&apos;s visit and your bank account — eligibility checks, coding, claim filing, payment posting, denials and patient billing — using your existing software.
              </p>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { step: "01", title: "Who we help", detail: "Hospitals, healthcare systems, emergency rooms, urgent cares and private practices across the United States.", href: "/who-we-serve", cta: "See who we serve" },
              { step: "02", title: "What we handle", detail: "Coding, claims, A/R, credentialing, out-of-network negotiation, authorizations and patient billing.", href: "/services", cta: "Explore services" },
              { step: "03", title: "How we start", detail: "A structured onboarding around your software, access and existing A/R — with scope and timing agreed first.", href: "/our-process", cta: "See the process" },
            ].map((item, index) => (
              <Reveal key={item.step} delay={index * 0.06}>
                <Link href={item.href} className="group flex h-full flex-col rounded-3xl border border-mist-200 bg-gradient-to-b from-white to-mist-50/70 p-5 transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-night-soft text-[0.7rem] font-extrabold text-white transition-colors group-hover:bg-brand-500">{item.step}</span>
                  <p className="mt-3 text-[1rem] font-extrabold tracking-tight text-ink-950">{item.title}</p>
                  <p className="mt-1.5 flex-1 text-[0.83rem] leading-relaxed text-ink-600/75">{item.detail}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[0.74rem] font-extrabold text-brand-700">
                    {item.cta} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl bg-night px-4 py-3 text-white">
              {[
                { label: "Every claim reviewed before submission", icon: BadgeCheck },
                { label: "Daily claim and denial worklists", icon: Clock },
                { label: "No prepayment, no hidden fees", icon: ShieldCheck },
                { label: "Dedicated account team", icon: Headphones },
              ].map(({ label, icon: TrustIcon }) => (
                <span key={label} className="flex items-center gap-1.5 text-[0.72rem] font-bold text-white/80">
                  <TrustIcon className="h-3.5 w-3.5 text-mint-300" /> {label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-mist-50 py-16 sm:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-brand-100/60 blur-[90px]" />
          <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-mint-100/70 blur-[90px]" />
        </div>
        <div className="shell relative">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-2xl">
              <SectionLabel>Medical billing services we offer</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                Complete medical billing, <span className="display-serif text-brand-600">fully managed.</span>
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/80">A complete service line across the revenue cycle, plus specialist support — engage the full cycle or start with the stage that is costing you most.</p>
            </Reveal>
            <Reveal delay={0.1}>
              <ArrowLink href="/services">All services</ArrowLink>
            </Reveal>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {services.map((service, index) => (
              <Reveal key={service.slug} delay={Math.min(index * 0.04, 0.3)}>
                <TiltCard className="group relative h-full overflow-hidden rounded-3xl border border-mist-200 bg-surface transition-all duration-300 hover:border-brand-300 hover:shadow-[0_30px_60px_-38px_rgba(4,20,31,0.45)]">
                <Link href={`/services/${service.slug}`} className="relative flex h-full flex-col overflow-hidden p-5">
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white">
                      <Icon name={service.icon} className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-ink-600/25 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </div>
                  <h3 className="mt-4 text-[0.96rem] font-extrabold leading-snug tracking-tight text-ink-950">{service.short}</h3>
                  <p className="mt-2 flex-1 text-[0.78rem] leading-relaxed text-ink-600/75">{service.tagline}</p>
                </Link>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-24">
        <div className="shell grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <Reveal className="relative">
            <div className="relative">
              <div className="absolute -left-3 -top-3 h-full w-full rounded-[2rem] border border-brand-200" />
              <div className="relative aspect-[4/4.3] overflow-hidden rounded-[1.9rem] shadow-[0_40px_80px_-50px_rgba(4,20,31,0.6)]">
                <Image src={photo.doctorPortrait} alt="Doctor standing in a modern clinical workspace" fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-5 -right-2 w-48 rounded-2xl border border-white bg-surface p-4 shadow-[0_24px_50px_-28px_rgba(4,20,31,0.45)] sm:-right-6 sm:w-56">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-mint-50 text-mint-700">
                    <BadgeCheck className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  <p className="text-[0.72rem] font-extrabold leading-tight text-ink-900">No prepayment</p>
                </div>
                <p className="mt-2 text-[0.68rem] leading-relaxed text-ink-600/70">No hidden fees. A dedicated account manager from day one.</p>
              </div>
              <div className="absolute -left-2 top-6 hidden items-center gap-2 rounded-full border border-white bg-surface px-3 py-2 shadow-lg sm:flex">
                <ShieldCheck className="h-4 w-4 text-mint-600" />
                <span className="text-[0.7rem] font-extrabold text-ink-900">HIPAA compliant</span>
              </div>
            </div>
          </Reveal>

          <div>
            <Reveal>
              <SectionLabel>An extension of your staff</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                You heal. <span className="display-serif text-brand-600">Leave the revenue to us.</span>
              </h2>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-600/80">
                Your doctors, nurses, front desk and techs each serve a purpose: providing the best care for your patients. We become part of that team — handling the billing, follow-up and payer conversations that keep the lights on.
              </p>
            </Reveal>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {benefits.slice(0, 6).map((benefit, index) => (
                <Reveal key={benefit.title} delay={index * 0.04}>
                  <div className="group flex h-full items-start gap-3 rounded-2xl border border-mist-200 bg-surface p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-night-soft group-hover:text-white">
                      <Icon name={benefit.icon} className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[0.84rem] font-extrabold leading-tight text-ink-950">{benefit.title}</p>
                      <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-600/70">{benefit.detail}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2}>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/about" className="btn btn-primary">
                  Why practices choose KMB <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/results" className="btn btn-light">
                  See how we measure results
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-night py-16 text-white sm:py-20">
        <div className="absolute inset-0">
          <Image src={photo.teamOffice} alt="" fill className="object-cover opacity-[0.34]" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/85 to-ink-950/55" />
        </div>
        <div className="dot-grid absolute inset-0 opacity-[0.1]" />
        <div className="shell relative">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-2xl">
              <SectionLabel tone="light">Who we serve</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em]">
                From large health systems to <span className="display-serif text-brand-300">small practices.</span>
              </h2>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-white/60">
                Knight Medical Billing is a recognized medical billing organization serving a range of facilities — hospitals, emergency rooms, urgent cares, private practices and multi-site healthcare systems.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <ArrowLink href="/who-we-serve" tone="light">Explore who we serve</ArrowLink>
            </Reveal>
          </div>

          <div className="mt-9 space-y-8">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-brand-300">Independent &amp; growing practices</p>
                <Link href="/who-we-serve/private-practices" className="text-[0.72rem] font-bold text-brand-200 hover:text-white">Practice support →</Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {practiceAudiences.map((audience) => (
                  <Link key={audience.slug} href={`/who-we-serve/${audience.slug}`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-400/25 bg-white/[0.06] transition-all hover:-translate-y-1 hover:border-brand-400/50 hover:bg-white/[0.09] sm:row-span-2">
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image src={audience.image} alt={audience.name} fill className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-[1.05]" sizes="(max-width: 768px) 100vw, 50vw" />
                      <div className="absolute inset-0 bg-gradient-to-t from-night via-ink-950/30 to-transparent" />
                      <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur">
                        <Icon name={audience.icon} className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-[1rem] font-extrabold leading-tight text-white">{audience.name}</p>
                      <p className="mt-1.5 flex-1 text-[0.76rem] leading-relaxed text-white/55">Independent, growing and multi-provider groups — with support that fits the stage you are in.</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-[0.72rem] font-bold text-brand-300">Explore practice support <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
                    </div>
                  </Link>
                ))}
                <Link href="/services/complete-rcm-services" className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.07]">
                  <div>
                    <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-brand-300">Smaller or growing?</p>
                    <p className="mt-2 text-[0.95rem] font-extrabold leading-snug text-white">Start with the stage that is costing you most.</p>
                    <p className="mt-1.5 text-[0.76rem] leading-relaxed text-white/50">You do not need a full RCM handover to begin. Clean-up, A/R or credentialing support can be the first step.</p>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[0.72rem] font-bold text-brand-300">Explore services <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </div>
            </div>

            <div>
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-white/40">Hospitals, systems &amp; facilities</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {facilityAudiences.map((audience, index) => (
                  <Reveal key={audience.slug} delay={index * 0.05}>
                    <Link href={`/who-we-serve/${audience.slug}`} className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-all hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.07]">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <Image src={audience.image} alt={audience.name} fill className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-[1.05]" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                        <div className="absolute inset-0 bg-gradient-to-t from-night via-ink-950/30 to-transparent" />
                        <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur">
                          <Icon name={audience.icon} className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <p className="text-[0.92rem] font-extrabold leading-tight text-white">{audience.name}</p>
                        <p className="mt-1.5 flex-1 text-[0.72rem] leading-relaxed text-white/50">{audience.eyebrow}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-[0.7rem] font-bold text-brand-300">
                          Learn more <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-24">
        <div className="shell">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-2xl">
              <SectionLabel>Specialties</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                Certified coders across <span className="display-serif text-brand-600">{specialties.length}+ specialties.</span>
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/80">CPC and CIC certified coders with working experience in specialty clinics, emergency rooms, urgent cares, hospitals and health systems.</p>
            </Reveal>
            <Reveal delay={0.1}>
              <ArrowLink href="/specialties">All specialties</ArrowLink>
            </Reveal>
          </div>
          <Reveal className="mt-9">
            <SpecialtyExplorer specialties={specialties} limit={8} />
          </Reveal>
        </div>
      </section>

      <section className="bg-mist-50 py-16 sm:py-24">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
            <Reveal>
              <SectionLabel>Our process</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                A structured start <span className="display-serif text-brand-600">around your operation.</span>
              </h2>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-600/80">
                We learn how your organization works, agree on scope and access, then build a billing and coding team around your facility. No prepayment, no hidden fees, and no long implementation project.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Workflow, label: "Works in your software" },
                  { icon: ShieldCheck, label: "HIPAA-compliant handling" },
                  { icon: Clock, label: "Daily claim worklists" },
                  { icon: Sparkles, label: "Dedicated account manager" },
                ].map(({ icon: FeatureIcon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-surface px-3 py-3 text-[0.76rem] font-bold text-ink-800">
                    <FeatureIcon className="h-4 w-4 shrink-0 text-brand-600" />
                    {label}
                  </div>
                ))}
              </div>
              <Link href="/schedule-form" className="btn btn-primary mt-6">
                Talk With Knight <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
            <Reveal delay={0.1}>
              <ProcessTimeline />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-24">
        <div className="shell grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <Reveal>
            <SectionLabel>Leadership</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Founded by a provider, <span className="display-serif text-brand-600">for providers.</span>
            </h2>
            <div className="mt-5 space-y-3.5 text-[0.92rem] leading-relaxed text-ink-600/85">
              <p>
                Dr. Fianko, CEO and founder of Knight Medical Billing, is a visionary leader driven by a commitment to improving healthcare. With a background as a mental health and addiction therapist, he brings over five years of clinical experience and a deep understanding of the challenges providers face.
              </p>
              <p>
                As the founder of Limelight Recovery, he experienced firsthand the financial burdens and administrative complexity that hinder quality care — which led him to revolutionize revenue cycle management.
              </p>
            </div>
            <div className="mt-6 rounded-2xl border border-mist-200 bg-mist-50 p-4">
              <p className="flex items-center gap-2 text-[0.8rem] font-extrabold text-ink-900">
                <Quote className="h-4 w-4 text-brand-600" /> Also founder of Educational Communities Worldwide
              </p>
              <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-600/75">A non-profit providing educational resources to underprivileged students in Africa — the same mission-driven approach applied to healthcare revenue.</p>
            </div>
            <div className="mt-6">
              <ArrowLink href="/about">Read the full story</ArrowLink>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-mist-200 bg-surface p-3 shadow-[0_36px_70px_-45px_rgba(4,20,31,0.5)]">
              <div className="relative aspect-[4/4.4] overflow-hidden rounded-2xl">
                <Image src="/images/ceo-dr-fianko.jpg" alt="Dr. Fianko, CEO and Founder of Knight Medical Billing" fill className="object-cover object-top" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/25 bg-white/15 p-3 backdrop-blur-md">
                  <p className="text-[0.95rem] font-extrabold text-white">Dr. Fianko</p>
                  <p className="text-[0.68rem] font-semibold text-white/70">CEO & Founder, Knight Medical Billing</p>
                </div>
              </div>
            </div>
            <div className="animate-float absolute -left-3 top-8 rounded-2xl border border-mist-200 bg-surface p-3 shadow-lg">
              <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/75">Clinician-led</p>
              <p className="mt-1 text-[0.8rem] font-extrabold text-ink-950">Provider-first RCM</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="why-change" className="bg-mist-50 py-16 sm:py-24">
        <div className="shell">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-14">
            <Reveal>
              <SectionLabel>Why organizations consider a change</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                Busy is not the same as <span className="display-serif text-brand-600">in control.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="max-w-xl text-[0.94rem] leading-relaxed text-ink-600/80 lg:ml-auto">
                Most organizations do not start by looking for a new billing company. They start by noticing that the current process is working harder than the visibility it provides.
              </p>
            </Reveal>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "“The team is busy, but I cannot see what is stuck.”", detail: "Worklists are moving, yet leadership has no clear view of denials, aged A/R or the next action." },
              { title: "“Denials get worked, but too late.”", detail: "The same reasons repeat because the front-end cause is never fixed." },
              { title: "“A/R keeps getting older.”", detail: "Follow-up happens when someone has time, not on a consistent ownership cadence." },
              { title: "“We are growing faster than the process.”", detail: "New providers and locations add volume without adding proportional control." },
              { title: "“Reporting tells me what happened, not what to do.”", detail: "Monthly totals arrive without an owner, an explanation or a follow-up plan." },
              { title: "“We need more accountability.”", detail: "Questions go to a queue instead of a named person who knows the account." },
            ].map((item) => (
              <Reveal key={item.title}>
                <div className="h-full rounded-2xl border border-mist-200 bg-surface p-5">
                  <p className="text-[0.9rem] font-extrabold leading-snug tracking-tight text-ink-950">{item.title}</p>
                  <p className="mt-2 text-[0.79rem] leading-relaxed text-ink-600/75">{item.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/switching-medical-billing" className="btn btn-primary">
              Compare your current process <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/results" className="btn btn-light">See how we measure the work</Link>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-24">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <Reveal>
              <SectionLabel>Technology</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                We work in <span className="display-serif text-brand-600">your system.</span>
              </h2>
              <p className="mt-4 text-[0.94rem] leading-relaxed text-ink-600/80">
                Billing software is central to the revenue cycle. Our team has hands-on expertise across major platforms, so you do not have to migrate or retrain your staff.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {billingSoftware.map((tool) => (
                  <span key={tool} className="rounded-lg border border-mist-200 bg-surface px-2.5 py-1.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700">
                    {tool}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative overflow-hidden rounded-3xl border border-mist-200 bg-night p-6 text-white sm:p-8">
                <div className="dot-grid absolute inset-0 opacity-[0.12]" />
                <div className="relative">
                  <p className="eyebrow text-brand-300">The full revenue cycle</p>
                  <h3 className="mt-2 text-xl font-extrabold tracking-tight">Every step our team owns</h3>
                  <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
                    {rcmLifecycle.map((step, index) => (
                      <li key={step} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-2 text-[0.72rem] font-semibold text-white/75">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500 text-[0.55rem] font-extrabold text-white">{index + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <Link href="/services/complete-rcm-services" className="mt-5 inline-flex items-center gap-1.5 text-[0.78rem] font-bold text-brand-300 hover:text-white">
                    Explore complete RCM services <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-mist-50 py-16 sm:py-24">
        <div className="shell">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-2xl">
              <SectionLabel>Resources</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                Billing education from <span className="display-serif text-brand-600">our specialists.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <ArrowLink href="/insights">Browse all resources</ArrowLink>
            </Reveal>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.slice(0, 3).map((article, index) => (
              <Reveal key={article.slug} delay={index * 0.06}>
                <Link href={`/insights/${article.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image src={article.image} alt="" fill className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-brand-700 backdrop-blur">{article.category}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-[1rem] font-extrabold leading-snug tracking-tight text-ink-950 group-hover:text-brand-700">{article.title}</h3>
                    <p className="mt-2 flex-1 text-[0.8rem] leading-relaxed text-ink-600/75">{article.excerpt}</p>
                    <div className="mt-4 flex items-center justify-between text-[0.66rem] font-semibold text-ink-600/80">
                      <span>{new Date(article.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span>{article.readTime}</span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mist-50 py-16 sm:py-24">
        <div className="shell">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
            <Reveal>
              <SectionLabel>The difference</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                In-house billing vs. <span className="display-serif text-brand-600">Knight Medical Billing.</span>
              </h2>
              <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
                Keeping billing in-house means hiring, training, covering vacations and absorbing turnover. A dedicated Knight team gives you coders, collectors and a manager — inside the software you already use.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/schedule-form" className="btn btn-primary">
                  Talk With Knight <ArrowRight className="h-4 w-4" />
                </Link>
                <a href={site.phoneHref} className="btn btn-light">
                  <Phone className="h-4 w-4" /> {site.phone}
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-soft">
                <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-mist-200 bg-mist-50/80 text-[0.66rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">
                  <span className="px-4 py-3">Consideration</span>
                  <span className="px-3 py-3 text-center">In-house</span>
                  <span className="bg-brand-50/70 px-3 py-3 text-center text-brand-800">Knight</span>
                </div>
                {[
                  ["Claim review", "Depends on capacity", "Every claim checked"],
                  ["Submission cadence", "Often delayed", "Daily worklist"],
                  ["Upfront cost", "Salaries + benefits", "No prepayment"],
                  ["Sick days & turnover", "Paid time off", "Covered by the team"],
                  ["Coding certifications", "Per hire", "CPC & CIC team"],
                  ["Out-of-network negotiation", "Rarely", "Specialist team"],
                  ["Dedicated account manager", "—", "Included"],
                ].map(([label, inhouse, knight]) => (
                  <div key={label} className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-mist-100 last:border-0 text-[0.76rem]">
                    <span className="px-4 py-2.5 font-semibold text-ink-800">{label}</span>
                    <span className="px-3 py-2.5 text-center text-ink-600/80">{inhouse}</span>
                    <span className="bg-brand-50/40 px-3 py-2.5 text-center font-extrabold text-brand-800">{knight}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-24">
        <div className="shell grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal>
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Questions practices ask <span className="display-serif text-brand-600">before switching.</span>
            </h2>
            <p className="mt-4 text-[0.94rem] leading-relaxed text-ink-600/80">Call or email us directly — we answer questions the same day during business hours.</p>
            <div className="mt-6 space-y-2.5">
              <a href={site.phoneHref} className="flex items-center gap-3 rounded-2xl border border-mist-200 bg-surface p-3.5 transition-colors hover:border-brand-300">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/75">Call</p>
                  <p className="text-[0.86rem] font-extrabold text-ink-950">{site.phone}</p>
                </div>
              </a>
              <a href={`mailto:${site.email}`} className="flex items-center gap-3 rounded-2xl border border-mist-200 bg-surface p-3.5 transition-colors hover:border-brand-300">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Mail className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/75">Email</p>
                  <p className="truncate text-[0.86rem] font-extrabold text-ink-950">{site.email}</p>
                </div>
              </a>
              <div className="flex items-center gap-3 rounded-2xl border border-mist-200 bg-surface p-3.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/75">Office</p>
                  <p className="text-[0.8rem] font-semibold leading-snug text-ink-950">{site.address}</p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Accordion items={faqs.slice(0, 8)} />
            <div className="mt-5">
              <ArrowLink href="/faq">See all frequently asked questions</ArrowLink>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-night py-16 text-white sm:py-24">
        <div aria-hidden className="animated-gradient absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full opacity-20 blur-[110px]" />
        <div aria-hidden className="dot-grid absolute inset-0 opacity-[0.1]" />
        <div className="shell relative">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-2xl">
              <SectionLabel tone="light">Practice perspectives</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em]">
                The themes we hear from <span className="display-serif text-brand-300">practice leaders.</span>
              </h2>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-white/60">
                Anonymised feedback themes gathered in our conversations with administrators and clinicians — not published client endorsements.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.58rem] font-extrabold uppercase tracking-[0.16em] text-white/35">
                <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand-300" /> Four recurring themes</span>
                <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-mint-300" /> Administrator &amp; clinician conversations</span>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <Link href="/results" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-[0.78rem] font-bold text-white/85 transition-colors hover:border-brand-300 hover:text-white">
                See how we measure results <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Reveal>
          </div>
          <Reveal className="mt-9">
            <TestimonialsCarousel items={perspectives} />
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
            <Reveal>
              <SectionLabel>Explore by focus</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                Not sure where to start? <span className="display-serif text-brand-600">Shuffle the priorities.</span>
              </h2>
              <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/85">
                Most practices begin with one urgent problem rather than a full engagement. These are the starting points we see most often — shuffle to see another set.
              </p>
              <div className="mt-5">
                <Link href="/schedule-form" className="btn btn-primary">
                  Talk With Knight <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <CardShuffle
                cards={[
                  { id: "denials", title: "Denials are piling up", body: "Appeal what is still within the payer window, then fix the front-end cause.", meta: "Denial management", icon: <Workflow className="h-4 w-4" /> },
                  { id: "ar", title: "Aged A/R is unmanaged", body: "Segment by payer and filing deadline, then work the collectible balances first.", meta: "Accounts receivable", icon: <TrendingUp className="h-4 w-4" /> },
                  { id: "claims", title: "Claims get rejected", body: "Scrub against payer edits before submission to cut preventable rework.", meta: "Claims management", icon: <FileCheck2 className="h-4 w-4" /> },
                  { id: "eligibility", title: "Front desk is overloaded", body: "Move eligibility and authorisation checks to the billing team.", meta: "Patient access", icon: <ShieldCheck className="h-4 w-4" /> },
                  { id: "reporting", title: "No clear reporting", body: "Track collections, acceptance, denials, days in A/R and charge lag.", meta: "Performance reporting", icon: <LineChart className="h-4 w-4" /> },
                  { id: "credentialing", title: "Enrollment stalled", body: "Complete payer files, EDI and roster updates before billing starts.", meta: "Credentialing", icon: <BadgeCheck className="h-4 w-4" /> },
                ]}
              />
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
