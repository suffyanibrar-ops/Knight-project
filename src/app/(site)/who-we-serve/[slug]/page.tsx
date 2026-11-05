import { JsonLd } from "@/components/structured-data";
import { pageMetadata, serviceSchema, breadcrumbSchema } from "@/lib/seo";
import { ArrowRight, Check, Phone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { NextSteps } from "@/components/next-steps";
import { Icon } from "@/components/icon";
import { PageHero } from "@/components/page-hero";
import { audienceVisuals } from "@/components/sections/visuals";
import { ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { audiences, services, site } from "@/lib/site";

export function generateStaticParams() {
  return audiences.map((audience) => ({ slug: audience.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const audience = audiences.find((item) => item.slug === slug);
  if (!audience) return { title: "Not found" };
  return pageMetadata({
    title: `${audience.name} Billing | Knight Medical Billing`,
    description: audience.intro.slice(0, 158),
    path: `/who-we-serve/${audience.slug}`,
    keywords: [`${audience.name.toLowerCase()} medical billing`, "medical billing services"],
  });
}

export default async function AudiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const audience = audiences.find((item) => item.slug === slug);
  if (!audience) notFound();

  const related = audiences.filter((item) => item.slug !== audience.slug).slice(0, 4);
  const serviceLinks = services.filter((service) => audience.services.includes(service.name));

  return (
    <>
      <JsonLd data={[serviceSchema({ name: `${audience.name} medical billing`, description: audience.intro, path: `/who-we-serve/${audience.slug}` }), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Who we serve", path: "/who-we-serve" }, { name: audience.name, path: `/who-we-serve/${audience.slug}` }])]} />
      <PageHero
        eyebrow={audience.eyebrow}
        title={
          <>
            {audience.title.split(" ").slice(0, -2).join(" ")}{" "}
            <span className="display-serif text-brand-600">{audience.title.split(" ").slice(-2).join(" ")}</span>
          </>
        }
        description={audience.intro}
        image={audienceVisuals[audience.slug] ?? audience.image}
        imageAlt={`Photograph representing ${audience.name} billing support`}
        badges={audience.points.slice(0, 3)}
        crumbs={[{ label: "Who we serve", href: "/who-we-serve" }, { label: audience.name }]}
        stat={audience.stat}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <Reveal>
              <SectionLabel>{audience.eyebrow}</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">
                What we handle for {audience.name.toLowerCase()}
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/85">{audience.intro}</p>
            </Reveal>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {audience.points.map((point, index) => (
                <Reveal key={point} delay={index * 0.04}>
                  <div className="flex h-full items-start gap-2.5 rounded-2xl border border-mist-200 bg-mist-50/60 p-4">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-brand-700">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <p className="text-[0.83rem] font-semibold leading-snug text-ink-800">{point}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-9">
              <h2 className="text-[clamp(1.4rem,2.8vw,1.85rem)] font-extrabold tracking-[-0.03em] text-ink-950">Recommended services</h2>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {serviceLinks.map((service) => (
                  <Link key={service.slug} href={`/services/${service.slug}`} className="group flex items-start gap-3 rounded-2xl border border-mist-200 bg-surface p-4 transition-all hover:border-brand-300 hover:shadow-md">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-500 group-hover:text-white">
                      <Icon name={service.icon} className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[0.88rem] font-extrabold leading-tight text-ink-950 group-hover:text-brand-700">{service.short}</p>
                      <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-600/70">{service.tagline}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Reveal>

            <Reveal className="mt-9">
              <h2 className="text-[clamp(1.4rem,2.8vw,1.85rem)] font-extrabold tracking-[-0.03em] text-ink-950">Why facilities choose Knight</h2>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {[
                  "A dedicated billing and coding team assigned to your facility",
                  "Claims filed within 24 hours with a 99.9% acceptance rate",
                  "HIPAA-compliant data and document security",
                  "Real-time reporting and transparent communication",
                  "Works inside your existing billing software",
                  "No prepayment and no hidden fees",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-[0.82rem] font-semibold text-ink-800">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" strokeWidth={2.2} />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <ArrowLink href="/our-process">See the 5-day onboarding process</ArrowLink>
              </div>
            </Reveal>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <div className="overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-soft">
                <div className="relative bg-night p-5 text-white">
                  <div className="dot-grid absolute inset-0 opacity-20" />
                  <div className="relative">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10">
                      <Icon name={audience.icon} className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-lg font-extrabold leading-snug tracking-tight">Let&apos;s review your {audience.short.toLowerCase()} billing.</p>
                    <p className="mt-1.5 text-[0.78rem] text-white/60">Free consultation · no prepayment · no hidden fees.</p>
                  </div>
                </div>
                <div className="p-5">
                  <ul className="space-y-2.5">
                    {["Dedicated account manager", "24/5 multilingual support", "Certified coders", "Real-time reporting"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[0.8rem] font-semibold text-ink-800">
                        <Check className="h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={3} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/schedule-form" className="btn btn-primary mt-5 w-full">
                    Schedule a consultation <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href={site.phoneHref} className="btn btn-light mt-2 w-full">
                    <Phone className="h-4 w-4" /> {site.phone}
                  </a>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="mt-4">
              <div className="rounded-3xl border border-mist-200 bg-mist-50 p-5">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Also serving</p>
                <div className="mt-3 space-y-2">
                  {related.map((item) => (
                    <Link key={item.slug} href={`/who-we-serve/${item.slug}`} className="group flex items-center gap-3 rounded-xl bg-surface p-2.5 transition-colors hover:bg-brand-50">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-500 group-hover:text-white">
                        <Icon name={item.icon} className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-[0.8rem] font-bold text-ink-900 group-hover:text-brand-700">{item.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-600/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>

      <NextSteps />

      <CtaBand title={`Let's get your ${audience.short.toLowerCase()} billing under control.`} description="We will review your current workflow, claim acceptance and outstanding A/R, then show you how a dedicated team would take it from there." />
    </>
  );
}
