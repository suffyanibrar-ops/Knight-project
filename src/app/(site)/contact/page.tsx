import { pageMetadata } from "@/lib/seo";
import { ArrowRight, CalendarCheck, Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { CopyButton } from "@/components/motion/copy-button";
import { MapEmbed } from "@/components/map-embed";
import { PageHero } from "@/components/page-hero";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { Reveal, SectionLabel } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Contact Us | Knight Medical Billing', description: 'Contact Knight Medical Billing at (812) 994-0046 or admin@knightmedicalbilling.com. Office: 585 Grove St Ste 145, Herndon, VA 20170-4790.', path: '/contact', keywords: ['contact medical billing company'] });

const contactCards = [
  { icon: Phone, label: "Call us", value: site.phone, href: site.phoneHref, detail: "Mon–Fri · 8:00 AM – 5:00 PM ET" },
  { icon: Mail, label: "Email us", value: site.email, href: `mailto:${site.email}`, detail: "For consultations and support" },
  { icon: MapPin, label: "Visit / mail", value: site.address, href: site.mapLink, detail: "Herndon, Virginia" },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Get in touch with <span className="display-serif text-brand-600">our team.</span>
          </>
        }
        description="Call, email or send us a message. Tell us about your facility, your specialty and roughly what you collect each month — we will respond with a clear next step. No prepayment, no hidden fees, no pressure."
        image={pageHeroVisuals.contact}
        imageAlt="Photograph of a welcoming medical office reception desk"
        badges={["HIPAA compliant", "24/5 multilingual support", "Free consultation"]}
        crumbs={[{ label: "Contact" }]}
        primaryCta={{ label: `Call ${site.phone}`, href: site.phoneHref }}
        secondaryCta={{ label: "Schedule a consultation", href: "/schedule-form" }}
      />

      <section className="bg-surface py-12 sm:py-16">
        <div className="shell grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div className="min-w-0">
            <Reveal>
              <SectionLabel>Contact details</SectionLabel>
              <h2 className="mt-2 text-[clamp(1.6rem,3.2vw,2.2rem)] font-extrabold tracking-[-0.03em] text-ink-950">We answer questions directly.</h2>
            </Reveal>
            <div className="mt-6 space-y-2.5">
              {contactCards.map(({ icon: CardIcon, label, value, href, detail }, index) => (
                <Reveal key={label} delay={index * 0.05}>
                  <div className="group flex items-start gap-3.5 rounded-2xl border border-mist-200 bg-surface p-4 transition-all hover:border-brand-300 hover:bg-brand-50/30">
                  <a href={href} className="flex min-w-0 flex-1 items-start gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                      <CardIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/75">{label}</p>
                      <p className="mt-1 break-words text-[0.9rem] font-extrabold text-ink-950">{value}</p>
                      <p className="mt-0.5 text-[0.72rem] text-ink-600/80">{detail}</p>
                    </div>
                  </a>
                    <span className="ml-auto mt-2 flex shrink-0 items-center gap-1.5">
                      {(label === "Call us" || label === "Email us") && <CopyButton value={value} label={label} />}
                      <ArrowRight aria-hidden className="h-4 w-4 text-ink-600/25 transition-all group-hover:translate-x-1 group-hover:text-brand-600" />
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1} className="mt-4">
              <div className="rounded-2xl border border-mist-200 bg-mist-50 p-4">
                <p className="flex items-center gap-2 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/75">
                  <Clock className="h-3.5 w-3.5 text-brand-600" /> Work hours
                </p>
                <p className="mt-2 text-[0.86rem] font-semibold leading-relaxed text-ink-800">Mon – Fri: 08:00 AM – 05:00 PM ET</p>
                <p className="text-[0.8rem] text-ink-600/70">Sat – Sun: Closed</p>
                <p className="mt-3 flex items-center gap-2 text-[0.72rem] font-semibold text-mint-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> Client support available 24/5 in multiple languages
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.12} className="mt-4">
              <h2 className="mb-2 text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-ink-600">Find our office</h2>
              <MapEmbed height={280} />
            </Reveal>
          </div>

          <Reveal delay={0.08} className="min-w-0">
            <ContactForm />
            <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2.5">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                <p className="text-[0.8rem] leading-relaxed text-ink-700/85">
                  <span className="font-extrabold text-ink-950">Prefer a scheduled call?</span> Book a free consultation and we will review your billing process together.
                </p>
              </div>
              <Link href="/schedule-form" className="shrink-0 rounded-full bg-night-soft px-4 py-2.5 text-[0.75rem] font-bold text-white transition-colors hover:bg-brand-600">
                Schedule now
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
