import { JsonLd } from "@/components/structured-data";
import { breadcrumbSchema } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo";
import { BadgeCheck, Check, Clock3, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { DemoForm } from "@/components/demo-form";
import { ParallaxImage } from "@/components/motion/parallax";
import { PageHero } from "@/components/page-hero";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { photo } from "@/lib/photos";
import { Reveal } from "@/components/ui";
import { kpis, site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Schedule a Free Consultation | Knight Medical Billing', description: 'Schedule a free medical billing consultation. We review your billing process, identify revenue leakage and build a dedicated team around your facility.', path: '/schedule-form', keywords: ['medical billing consultation'] });

const promises = [
  { icon: Clock3, title: "Fast, easy process", detail: "Most facilities are live with a dedicated team within five days." },
  { icon: WalletIcon, title: "No prepayment", detail: "No prepayment and no hidden fees to get started. Ever." },
  { icon: ShieldCheck, title: "HIPAA compliant", detail: "Complete data and document security from the first conversation." },
];

function WalletIcon(props: React.ComponentProps<typeof BadgeCheck>) {
  return <BadgeCheck {...props} />;
}

export default function SchedulePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Schedule a consultation", path: "/schedule-form" }])} />
      <PageHero

        eyebrow="Schedule a consultation"
        title={
          <>
            Let&apos;s build your <span className="display-serif text-brand-600">billing team.</span>
          </>
        }
        description="Tell us about your facility and current billing process. We will review it with you, identify the problem areas in your revenue cycle and show you how a dedicated Knight team would take over — with no prepayment required."
        image={pageHeroVisuals.schedule}
        imageAlt="Photograph of a clinician in a video consultation at a desk"
        badges={["Free · no obligation", "No hidden fees", "24/5 support"]}
        crumbs={[{ label: "Schedule a consultation" }]}
        primaryCta={{ label: `Call ${site.phone}`, href: site.phoneHref }}
        secondaryCta={{ label: "Email us", href: `mailto:${site.email}` }}
      />

      <section className="bg-surface py-12 sm:py-16">
        <div className="shell grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
          <div className="min-w-0">
            <Reveal>
              <div className="grid gap-2.5">
                {promises.map(({ icon: PromiseIcon, title, detail }) => (
                  <div key={title} className="flex gap-3.5 rounded-2xl border border-mist-200 bg-surface p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <PromiseIcon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-[0.9rem] font-extrabold text-ink-950">{title}</p>
                      <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-600/75">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.08} className="mt-6">
              <div className="relative overflow-hidden rounded-3xl bg-night p-6 text-white">
                <ParallaxImage src={photo.documentsReview} distance={26} className="opacity-35" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-night via-ink-950/95 to-ink-950/60" />
                <div className="dot-grid absolute inset-0 opacity-[0.12]" />
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-200">
                    <Sparkles className="h-3 w-3" /> What you can expect
                  </span>
                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    {kpis.slice(0, 3).map((kpi) => (
                      <div key={kpi.label} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                        <p className="text-lg font-extrabold leading-none">{kpi.value}</p>
                        <p className="mt-1.5 text-[0.6rem] font-bold leading-tight text-white/45">{kpi.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    {["Claims filed within 24 hours", "99.9% claim acceptance rate", "A dedicated account manager"].map((item) => (
                      <p key={item} className="flex items-center gap-2 text-[0.76rem] font-semibold text-white/70">
                        <Check className="h-3.5 w-3.5 text-mint-300" strokeWidth={3} /> {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12} className="mt-4">
              <div className="rounded-2xl border border-mist-200 bg-mist-50 p-4">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/75">Prefer to reach us directly?</p>
                <div className="mt-2.5 space-y-2 text-[0.82rem] font-semibold text-ink-800">
                  <a href={site.phoneHref} className="flex items-center gap-2 hover:text-brand-700">
                    <Phone className="h-4 w-4 text-brand-600" /> {site.phone}
                  </a>
                  <a href={`mailto:${site.email}`} className="flex items-center gap-2 break-all hover:text-brand-700">
                    <Mail className="h-4 w-4 shrink-0 text-brand-600" /> {site.email}
                  </a>
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {site.address}
                  </p>
                  <p className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {site.hours}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.05} className="min-w-0">
            <div className="lg:sticky lg:top-28">
              <DemoForm />
              <p className="mt-3 text-center text-[0.68rem] text-ink-600/75">We respond during business hours, Monday–Friday 8:00 AM – 5:00 PM ET.</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
