import { JsonLd } from "@/components/structured-data";
import { pageMetadata, serviceSchema, breadcrumbSchema } from "@/lib/seo";
import { ArrowRight, Check, CheckCircle2, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { NextSteps } from "@/components/next-steps";
import { Icon } from "@/components/icon";
import { PageHero } from "@/components/page-hero";
import { ParallaxFrame } from "@/components/sections/parallax-frame";
import { serviceInlineVisuals, serviceVisuals } from "@/components/sections/visuals";
import { Accordion, ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { services, site } from "@/lib/site";

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) return { title: "Service not found" };
  return pageMetadata({
    title: `${service.name} | Knight Medical Billing`,
    description: service.intro.slice(0, 158),
    path: `/services/${service.slug}`,
    keywords: [service.name.toLowerCase(), "medical billing services", "revenue cycle management"],
  });
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();

  const related = services.filter((item) => item.slug !== service.slug).slice(0, 3);
  const heroVisual = serviceVisuals[service.slug] ?? service.image;
  const inlineVisual = serviceInlineVisuals[service.slug] ?? service.image;

  return (
    <>
      <JsonLd data={[serviceSchema({ name: service.name, description: service.intro, path: `/services/${service.slug}` }), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }, { name: service.short, path: `/services/${service.slug}` }])]} />
      <PageHero
        eyebrow={service.short}
        title={
          <>
            {service.name.split(" ").slice(0, 1).join(" ")}{" "}
            <span className="display-serif text-brand-600">{service.name.split(" ").slice(1).join(" ")}</span>
          </>
        }
        description={service.intro}
        image={heroVisual}
        imageAlt={`Photograph representing ${service.name} at Knight Medical Billing`}
        badges={service.bullets.slice(0, 3)}
        crumbs={[{ label: "Services", href: "/services" }, { label: service.short }]}
        stat={{ value: service.metrics[0].value, label: service.metrics[0].label }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div>
            <Reveal>
              <SectionLabel>{service.tagline}</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950">{service.highlights[0].title}</h2>
              <div className="mt-4 space-y-4 text-[0.95rem] leading-relaxed text-ink-600/85">
                <p>{service.highlights[0].detail}</p>
                <p>{service.highlights[1].detail}</p>
              </div>
            </Reveal>

            <Reveal delay={0.05} className="mt-8 grid gap-3 sm:grid-cols-3">
              {service.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-mist-200 bg-mist-50/70 p-4">
                  <p className="text-xl font-extrabold tracking-tight text-ink-950">{metric.value}</p>
                  <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-600/80">{metric.label}</p>
                </div>
              ))}
            </Reveal>

            <Reveal className="mt-10">
              <ParallaxFrame
                src={inlineVisual}
                alt={`${service.name} workflow illustration`}
                aspect="aspect-[16/8]"
                caption={service.tagline}
              />
            </Reveal>

            <Reveal className="mt-10">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.03em] text-ink-950">{service.highlights[1].title}</h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/85">{service.highlights[1].detail}</p>
            </Reveal>

            <Reveal className="mt-8">
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.03em] text-ink-950">{service.highlights[2].title}</h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/85">{service.highlights[2].detail}</p>
            </Reveal>

            <Reveal className="mt-10">
              <h2 className="text-[clamp(1.4rem,2.8vw,1.8rem)] font-extrabold tracking-[-0.03em] text-ink-950">What is included</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {service.included.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 rounded-xl border border-mist-200 bg-surface p-3 text-[0.82rem] font-semibold text-ink-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" strokeWidth={2.2} />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="mt-12">
              <h2 className="text-[clamp(1.4rem,2.8vw,1.8rem)] font-extrabold tracking-[-0.03em] text-ink-950">Questions about {service.short.toLowerCase()}</h2>
              <Accordion className="mt-4" items={service.faqs} defaultOpen={0} />
            </Reveal>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <div className="overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-soft">
                <div className="relative bg-night p-5 text-white">
                  <div className="dot-grid absolute inset-0 opacity-20" />
                  <div className="relative">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10">
                      <Icon name={service.icon} className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-lg font-extrabold leading-snug tracking-tight">Ready to collect more, faster?</p>
                    <p className="mt-1.5 text-[0.78rem] text-white/60">Free consultation. No prepayment, no hidden fees.</p>
                  </div>
                </div>
                <div className="p-5">
                  <ul className="space-y-2.5">
                    {["99.9% claim acceptance rate", "Claims filed within 24 hours", "Dedicated account manager", "24/5 multilingual support"].map((item) => (
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
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Related services</p>
                <div className="mt-3 space-y-2">
                  {related.map((item) => (
                    <Link key={item.slug} href={`/services/${item.slug}`} className="group flex items-center gap-3 rounded-xl bg-surface p-2.5 transition-colors hover:bg-brand-50">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-500 group-hover:text-white">
                        <Icon name={item.icon} className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-[0.8rem] font-bold text-ink-900 group-hover:text-brand-700">{item.short}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-600/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </Link>
                  ))}
                </div>
                <div className="mt-4">
                  <ArrowLink href="/specialties">Find your specialty</ArrowLink>
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>

      <NextSteps currentService={service.slug} />

      <CtaBand title={`Put ${service.short.toLowerCase()} in expert hands.`} description="We will review your current process, show you where revenue is leaking and explain exactly how a dedicated Knight team would take over. No prepayment required." />
    </>
  );
}
