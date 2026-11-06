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

export const metadata: Metadata = pageMetadata({ title: 'Request a Consultation | Knight Medical Billing', description: 'Request a medical billing consultation. Tell us about your organization and what you need help with. We will review it and follow up to arrange the conversation.', path: '/schedule-form', keywords: ['medical billing consultation'] });

const promises = [
  { icon: Clock3, title: "A clear next step", detail: "We review your information first, then agree on scope, access and a realistic start plan." },
  { icon: WalletIcon, title: "No prepayment", detail: "No prepayment and no hidden fees to get started. Ever." },
  { icon: ShieldCheck, title: "Security from the start", detail: "We discuss data handling and access requirements before any work begins." },
];

function WalletIcon(props: React.ComponentProps<typeof BadgeCheck>) {
  return <BadgeCheck {...props} />;
}

export default function SchedulePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Request a consultation", path: "/schedule-form" }])} />
      <PageHero

        eyebrow="Request a consultation"
        title={
          <>
            Tell us what is <span className="display-serif text-brand-600">not working yet.</span>
          </>
        }
        description="Tell us about your organization and what you need help with. We will review the information and follow up during business hours to arrange the conversation — with no prepayment required."
        image={pageHeroVisuals.schedule}
        imageAlt="Photograph of a clinician in a video consultation at a desk"
        badges={["Free · no obligation", "No hidden fees", "Business-hours follow-up"]}
        crumbs={[{ label: "Request a consultation" }]}
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
                    {["A clean-claim review process", "A daily claim and denial worklist", "A dedicated account manager"].map((item) => (
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

      <section className="border-t border-mist-200 bg-mist-50 py-12 sm:py-16">
        <div className="shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-brand-700">What happens next</p>
            <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold tracking-[-0.03em] text-ink-950">A request, a review, then a conversation.</h2>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-600/80">This form requests a consultation. It does not instantly book a confirmed appointment.</p>
          </div>
          <ol className="mx-auto mt-7 grid max-w-4xl gap-3 sm:grid-cols-3">
            {[
              { step: "01", title: "Tell us about your organization", detail: "Share your setting, specialty, size and the revenue-cycle problem you want to solve." },
              { step: "02", title: "We review your needs", detail: "The team reads the details and identifies the most useful starting point." },
              { step: "03", title: "We arrange the conversation", detail: "We follow up during business hours to agree on a time and prepare for the call." },
            ].map((item) => (
              <li key={item.step} className="rounded-2xl border border-mist-200 bg-surface p-5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-night-soft text-[0.68rem] font-extrabold text-white">{item.step}</span>
                <p className="mt-3 text-[0.9rem] font-extrabold text-ink-950">{item.title}</p>
                <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-600/75">{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
