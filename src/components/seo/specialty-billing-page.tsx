import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { JsonLd } from "@/components/structured-data";
import { Accordion, SectionLabel, Reveal } from "@/components/ui";
import { faqSchema, serviceSchema } from "@/lib/seo";
import { services } from "@/lib/site";
import { softwarePlatforms, type SpecialtyBillingGuide } from "@/lib/seo-content";

export function SpecialtyBillingPage({ guide }: { guide: SpecialtyBillingGuide }) {
  const relatedServices = services.filter((service) => guide.services.includes(service.slug));
  const relatedSoftware = softwarePlatforms.filter((platform) => guide.software.includes(platform.slug));

  return (
    <>
      <JsonLd data={[serviceSchema({ name: `${guide.name} medical billing`, description: guide.description, path: `/specialties/${guide.slug}` }), faqSchema(guide.faqs)]} />
      <PageHero
        path={`/specialties/${guide.slug}`}
        eyebrow={`${guide.name} billing`}
        title={<>{guide.h1}</>}
        description={guide.intro}
        image={guide.image}
        imageAlt={guide.imageAlt}
        badges={["Specialty-aware billing", "Works in your software", "No prepayment"]}
        crumbs={[{ label: "Specialties", href: "/specialties" }, { label: `${guide.name} Billing` }]}
        primaryCta={{ label: "Ask about my specialty", href: "/schedule-form" }}
        secondaryCta={{ label: "All specialties", href: "/specialties" }}
        stat={{ value: "Specialty", label: "Documentation context" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <Reveal>
              <SectionLabel>What we watch</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.6rem,3.3vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">
                The details that decide whether a {guide.name.toLowerCase()} claim gets paid.
              </h2>
              <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-600/85">
                Billing rules are payer-specific and change. We review the documentation available to us, verify the current requirement for the payer and plan, and escalate ambiguity rather than applying a universal rule.
              </p>
            </Reveal>

            <div className="mt-7 space-y-3">
              {guide.sections.map((section, index) => (
                <Reveal key={section.title} delay={index * 0.035}>
                  <div className="rounded-2xl border border-mist-200 bg-mist-50/60 p-4">
                    <h3 className="text-[0.92rem] font-extrabold text-ink-950">{section.title}</h3>
                    <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-600/80">{section.body}</p>
                    {section.points && (
                      <ul className="mt-3 space-y-1.5">
                        {section.points.map((point) => (
                          <li key={point} className="flex items-start gap-2 text-[0.76rem] font-semibold text-ink-700/85">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} /> {point}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <div className="rounded-3xl border border-mist-200 bg-surface p-5 shadow-soft">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h2 className="mt-3 text-lg font-extrabold leading-snug tracking-tight text-ink-950">Review your {guide.name.toLowerCase()} billing workflow.</h2>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-600/80">A free consultation starts with claims, documentation, denials and A/R — not a generic sales deck.</p>
                <Link href="/schedule-form" className="btn btn-primary mt-4 w-full">Talk With Knight <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/our-process" className="btn btn-light mt-2 w-full">How we start</Link>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="mt-4">
              <div className="rounded-3xl border border-mist-200 bg-mist-50 p-5">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Relevant services</p>
                <div className="mt-3 space-y-2">
                  {relatedServices.map((service) => (
                    <Link key={service.slug} href={`/services/${service.slug}`} className="group flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5 text-[0.78rem] font-bold text-ink-900 transition-colors hover:bg-brand-50">
                      {service.short}
                      <ArrowRight className="h-3.5 w-3.5 text-ink-600/30 group-hover:text-brand-600" />
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
            {relatedSoftware.length > 0 && (
              <Reveal delay={0.12} className="mt-4">
                <div className="rounded-3xl border border-mist-200 bg-mist-50 p-5">
                  <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Software context</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {relatedSoftware.map((software) => (
                      <Link key={software.slug} href={`/software/${software.slug}`} className="rounded-full border border-mist-200 bg-surface px-2.5 py-1.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300 hover:text-brand-700">
                        {software.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </aside>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell max-w-3xl">
          <Reveal>
            <SectionLabel>FAQs</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.5rem,3.2vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950">{guide.name} billing questions</h2>
            <Accordion className="mt-5" items={guide.faqs} defaultOpen={0} />
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-10">
        <div className="shell flex flex-wrap items-center justify-between gap-4">
          <p className="text-[0.82rem] font-semibold text-ink-600/80">Explore the full specialty directory or a relevant buyer guide.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/specialties" className="btn btn-light">All specialties</Link>
            <Link href="/insights/how-to-choose-medical-billing-company" className="btn btn-light">How to choose a billing company</Link>
          </div>
        </div>
      </section>

      <CtaBand title={`${guide.name} billing, with the context to do it properly.`} description="We review the documentation, authorization and payer details that affect your claims — and tell you plainly what we can own. No prepayment, no hidden fees." />
    </>
  );
}
