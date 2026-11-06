import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { Icon } from "@/components/icon";
import { TiltCard } from "@/components/motion/tilt-card";
import { PageHero } from "@/components/page-hero";
import { ProcessTimeline } from "@/components/process-timeline";
import { pageHeroVisuals, serviceVisuals } from "@/components/sections/visuals";
import { Accordion, ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { getFaqs } from "@/lib/data";
import { benefits, serviceGroups, services } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Medical Billing Services | Knight Medical Billing', description: 'Complete medical billing services: medical billing and coding, accounts receivable management, credentialing and contracting, out-of-network negotiation, eligibility verification and full RCM.', path: '/services', keywords: ['medical billing services', 'medical coding services'] });

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const faqs = await getFaqs();

  return (
    <>
      <PageHero path={"/services"}

        eyebrow="Medical billing services we offer"
        title={
          <>
            Complete medical billing services, <span className="display-serif text-brand-600">custom tailored.</span>
          </>
        }
        description="We offer complete medical billing services spanning coding, accounts receivable, credentialing, out-of-network negotiation, eligibility verification and full revenue cycle management — delivered by a dedicated team built around your facility."
        image={pageHeroVisuals.services}
        imageAlt="Photograph of two healthcare professionals reviewing billing information on a tablet"
        badges={["Every service under one team", "Daily worklists", "No prepayment"]}
        crumbs={[{ label: "Services" }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: "Who we serve", href: "/who-we-serve" }}
        stat={{ value: "One team", label: "Across the revenue cycle" }}
      />

      <section className="border-b border-mist-200 bg-mist-50 py-4">
        <div className="shell flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-[0.8rem] leading-relaxed text-ink-600/80">
            Not sure which service your practice needs first? Trace where the revenue cycle is losing momentum.
          </p>
          <Link href="/#revenue-leak" className="group inline-flex shrink-0 items-center gap-1.5 text-[0.76rem] font-extrabold text-brand-700 transition-colors hover:text-brand-500">
            Open the revenue-leak diagnostic <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-20">
        <div className="shell">
          <div className="space-y-12">
            {serviceGroups.map((group) => {
              const groupServices = services.filter((service) => (group.slugs as readonly string[]).includes(service.slug));
              return (
                <div key={group.title}>
                  <div className="mb-4 max-w-2xl">
                    <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-brand-700">{group.title}</p>
                    <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-600/80">{group.description}</p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {groupServices.map((service, index) => (
              <Reveal key={service.slug} delay={Math.min(index * 0.05, 0.3)} className="h-full">
                <TiltCard className="group h-full">
                  <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-300 hover:shadow-[0_32px_64px_-40px_rgba(4,20,31,0.45)]">
                    <div className="relative aspect-[16/9] overflow-hidden bg-night-soft">
                      <Image src={serviceVisuals[service.slug] ?? service.image} alt={`Photograph representing ${service.name}`} fill className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.04]" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/20 to-transparent" />
                      <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/25 bg-white/15 text-white backdrop-blur-md">
                          <Icon name={service.icon} className="h-4 w-4" />
                        </span>
                        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[0.6rem] font-extrabold text-ink-900">{service.metrics[0].value} {service.metrics[0].label}</span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="text-[1.08rem] font-extrabold tracking-tight text-ink-950">{service.name}</h2>
                      <p className="mt-1.5 text-[0.8rem] font-semibold text-brand-700">{service.tagline}</p>
                      <p className="mt-2.5 flex-1 text-[0.82rem] leading-relaxed text-ink-600/75">{service.intro}</p>
                      <ul className="mt-3.5 space-y-1.5">
                        {service.bullets.slice(0, 3).map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2 text-[0.76rem] font-semibold text-ink-700">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                      <Link href={`/services/${service.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold text-brand-700 transition-colors hover:text-brand-500">
                        Explore {service.short.toLowerCase()} <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </article>
                </TiltCard>
                      </Reveal>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-mist-50 py-16 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <Reveal>
            <SectionLabel>Why outsource to KMB</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              A one-stop shop for your <span className="display-serif text-brand-600">financial performance.</span>
            </h2>
            <p className="mt-4 text-[0.94rem] leading-relaxed text-ink-600/80">
              We are experts across medical billing and coding, and we work as an extension of your staff. Here is what clients gain when they hand the revenue cycle to Knight.
            </p>
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="flex items-start gap-2.5 rounded-xl border border-mist-200 bg-surface p-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon name={benefit.icon} className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[0.78rem] font-bold leading-snug text-ink-800">{benefit.title}</p>
                </div>
              ))}
            </div>
            <Link href="/about" className="btn btn-primary mt-6">
              More about Knight <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-mist-200 bg-surface p-6 shadow-soft">
              <p className="eyebrow text-brand-700">Onboarding</p>
              <h3 className="mt-2 text-xl font-extrabold tracking-tight text-ink-950">A structured handover</h3>
              <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-600/80">A dedicated team built around your facility, with scope and timing agreed around your operation.</p>
              <div className="mt-5">
                <ProcessTimeline />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <SectionLabel>Common questions</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Straight answers before <span className="display-serif text-brand-600">you switch.</span>
            </h2>
            <div className="mt-5 rounded-2xl border border-mist-200 bg-mist-50 p-5">
              <p className="text-[0.85rem] leading-relaxed text-ink-700/80">Want a recommendation for your facility? A short consultation with our team is usually enough.</p>
              <Link href="/contact" className="btn btn-primary mt-4">
                Talk to our team <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Accordion items={faqs.slice(0, 8)} />
            <div className="mt-6">
              <ArrowLink href="/our-process">See our onboarding process</ArrowLink>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
