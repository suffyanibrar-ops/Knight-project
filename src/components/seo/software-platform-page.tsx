import { ArrowRight, Check, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { JsonLd } from "@/components/structured-data";
import { Accordion, ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { faqSchema, serviceSchema } from "@/lib/seo";
import { services } from "@/lib/site";
import type { SoftwarePlatform } from "@/lib/seo-content";
import { softwarePlatforms, specialtyBillingGuides } from "@/lib/seo-content";

export function SoftwarePlatformPage({ platform }: { platform: SoftwarePlatform }) {
  const relatedServices = services.filter((service) => platform.serviceSlugs.includes(service.slug));
  const relatedSpecialties = specialtyBillingGuides.filter((guide) => platform.specialtySlugs.includes(guide.slug));
  const relatedSoftware = softwarePlatforms.filter((item) => platform.relatedSoftware.includes(item.slug));

  return (
    <>
      <JsonLd data={[
        serviceSchema({ name: `${platform.name} medical billing`, description: platform.description, path: `/software/${platform.slug}` }),
        faqSchema(platform.faqs),
      ]} />
      <PageHero
        path={`/software/${platform.slug}`}
        eyebrow={platform.eyebrow}
        title={<>{platform.h1}</>}
        description={platform.intro}
        image={platform.image}
        imageAlt={platform.imageAlt}
        badges={platform.badges}
        crumbs={[{ label: "Software & EHR Expertise", href: "/software" }, { label: platform.name }]}
        primaryCta={{ label: "Talk With Knight", href: "/schedule-form" }}
        secondaryCta={{ label: "See all software expertise", href: "/software" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <Reveal>
              <SectionLabel>Why practices choose Knight</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">
                The software handles the transaction. <span className="display-serif text-brand-600">We own the follow-through.</span>
              </h2>
              <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-600/85">
                {platform.formerName ? `${platform.name} (${platform.formerName})` : platform.name} can hold the right claim information while balances still age because no one owns the exception. Our team works inside your existing workflow and keeps the revenue-cycle work visible.
              </p>
            </Reveal>
            <div className="mt-6 grid gap-3">
              {platform.why.map((item, index) => (
                <Reveal key={item.title} delay={index * 0.04}>
                  <div className="flex gap-3 rounded-2xl border border-mist-200 bg-mist-50/60 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" strokeWidth={2.4} />
                    <div>
                      <p className="text-[0.88rem] font-extrabold text-ink-950">{item.title}</p>
                      <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-600/80">{item.detail}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={0.06}>
            <div className="rounded-3xl border border-mist-200 bg-night p-5 text-white sm:p-7">
              <p className="eyebrow text-brand-300">How we work inside it</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight">A workflow, not a software claim.</h2>
              <ol className="mt-5 space-y-4">
                {platform.workflow.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[0.62rem] font-extrabold text-brand-200">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="text-[0.85rem] font-extrabold text-white">{step.title}</p>
                      <p className="mt-1 text-[0.76rem] leading-relaxed text-white/60">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-[0.68rem] leading-relaxed text-white/50">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300" />
                We work within your existing platform where access and permissions allow. We are a billing partner, not a software vendor.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <Reveal>
            <SectionLabel>What we can manage</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">
              The revenue-cycle work around <span className="display-serif text-brand-600">{platform.name}.</span>
            </h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/80">
              Scope is agreed before onboarding. These are the functions we can own where access, staffing and payer requirements support them.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {platform.serviceSlugs.slice(0, 5).map((slug) => {
                const service = services.find((item) => item.slug === slug);
                return service ? (
                  <Link key={slug} href={`/services/${slug}`} className="rounded-full border border-mist-200 bg-surface px-3 py-1.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700">
                    {service.short}
                  </Link>
                ) : null;
              })}
            </div>
          </Reveal>
          <Reveal delay={0.06} className="grid gap-2.5 sm:grid-cols-2">
            {platform.manages.map((item) => (
              <div key={item} className="flex items-start gap-2.5 rounded-xl border border-mist-200 bg-surface p-3 text-[0.8rem] font-semibold text-ink-800">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} />
                {item}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <SectionLabel>What stays the same</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950">You do not have to change everything to improve the revenue cycle.</h2>
            <ul className="mt-5 space-y-2.5">
              {platform.unchanged.map((item) => (
                <li key={item} className="flex items-start gap-2.5 border-b border-mist-100 pb-2.5 text-[0.86rem] text-ink-700/85">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.06}>
            <SectionLabel>Problems worth investigating</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950">Where the revenue cycle usually leaks.</h2>
            <div className="mt-5 space-y-2.5">
              {platform.problems.map((problem) => (
                <div key={problem.title} className="rounded-2xl border border-mist-200 bg-mist-50/70 p-4">
                  <p className="text-[0.85rem] font-extrabold text-ink-950">{problem.title}</p>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-600/80">{problem.detail}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-mist-50 py-14 sm:py-20">
        <div className="shell">
          <Reveal>
            <SectionLabel>Reporting and visibility</SectionLabel>
            <h2 className="mt-3 max-w-2xl text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">Numbers should lead to a next action.</h2>
          </Reveal>
          <div className="mt-7 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {platform.reporting.map((item, index) => (
              <Reveal key={item} delay={index * 0.04} className="rounded-2xl border border-mist-200 bg-surface p-4">
                <p className="text-[0.78rem] font-bold leading-snug text-ink-900">{item}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/results" className="btn btn-light">How we measure results <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/insights/revenue-cycle-clean-up-audit" className="btn btn-light">Read the clean-up audit guide</Link>
          </div>
        </div>
      </section>

      {(relatedServices.length > 0 || relatedSpecialties.length > 0) && (
        <section className="bg-surface py-14 sm:py-20">
          <div className="shell grid gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <SectionLabel>Relevant services</SectionLabel>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink-950">Where this work connects</h2>
              <div className="mt-4 space-y-2">
                {relatedServices.map((service) => (
                  <Link key={service.slug} href={`/services/${service.slug}`} className="group flex items-center justify-between gap-3 rounded-xl border border-mist-200 bg-mist-50/60 px-3.5 py-2.5 text-[0.8rem] font-bold text-ink-900 transition-colors hover:border-brand-300 hover:text-brand-700">
                    {service.short}
                    <ArrowRight className="h-3.5 w-3.5 text-ink-600/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </Link>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <SectionLabel>Relevant specialties</SectionLabel>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink-950">Specialty context matters</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedSpecialties.map((specialty) => (
                  <Link key={specialty.slug} href={`/specialties/${specialty.slug}`} className="rounded-full border border-mist-200 bg-surface px-3 py-1.5 text-[0.74rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700">
                    {specialty.name} billing
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell max-w-3xl">
          <Reveal>
            <SectionLabel>FAQs</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.5rem,3.2vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950">{platform.name} billing questions</h2>
            <Accordion className="mt-5" items={platform.faqs} defaultOpen={0} />
          </Reveal>
        </div>
      </section>

      {relatedSoftware.length > 0 && (
        <section className="bg-surface py-12">
          <div className="shell">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Other software expertise</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedSoftware.map((item) => (
                <Link key={item.slug} href={`/software/${item.slug}`} className="rounded-full border border-mist-200 bg-mist-50 px-3 py-1.5 text-[0.74rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700">
                  {item.name}
                </Link>
              ))}
              <ArrowLink href="/software">All software expertise</ArrowLink>
            </div>
          </div>
        </section>
      )}

      <CtaBand
        title={`Put your ${platform.name} billing in experienced hands.`}
        description="We will review your current workflow, your payer mix and the exceptions that are slowing revenue. No prepayment, no hidden fees, and no requirement to replace your software."
      />
    </>
  );
}
