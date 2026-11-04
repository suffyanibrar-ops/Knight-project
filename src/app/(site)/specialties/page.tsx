import { pageMetadata } from "@/lib/seo";
import { ArrowRight, Check, ShieldCheck, Stethoscope, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { TiltCard } from "@/components/motion/tilt-card";
import { PageHero } from "@/components/page-hero";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { SpecialtyExplorer } from "@/components/specialty-explorer";
import { ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { getSpecialties } from "@/lib/data";
import { kpis } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Medical Billing by Specialty | 30+ Specialties', description: 'Medical billing and coding for 30+ specialties including cardiology, anesthesia, radiology, orthopedics, oncology, behavioral health, emergency rooms and urgent care.', path: '/specialties', keywords: ['specialty medical billing', 'medical coding by specialty'] });

export const dynamic = "force-dynamic";

export default async function SpecialtiesPage() {
  const specialties = await getSpecialties();
  const groups = Array.from(new Set(specialties.map((item) => item.group)));

  return (
    <>
      <PageHero
        eyebrow="All specialties"
        title={
          <>
            Your specialty. Your payer rules. <span className="display-serif text-brand-600">Our certified coders.</span>
          </>
        }
        description="We provide medical billing services to providers across specialties. Our certified coders hold CPC and CIC credentials with hands-on exposure in specialty clinics, emergency rooms, urgent cares, hospitals and healthcare systems."
        image={pageHeroVisuals.specialties}
        imageAlt="Abstract illustration of specialty coding and payer rules"
        badges={["CPC & CIC certified", "ICD-10-CM, CPT & E/M", "99.9% acceptance"]}
        crumbs={[{ label: "Specialties" }]}
        primaryCta={{ label: "Ask about my specialty", href: "/schedule-form" }}
        secondaryCta={{ label: "See our services", href: "/services" }}
        stat={{ value: `${specialties.length}+`, label: "Specialties served" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-2xl">
              <SectionLabel>Directory</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                Search the specialties we bill <span className="display-serif text-brand-600">every day.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="text-[0.8rem] font-semibold text-ink-600/80">{specialties.length} listed across {groups.length} groups · ask us about others</p>
            </Reveal>
          </div>
          <Reveal className="mt-8">
            <SpecialtyExplorer specialties={specialties} showSearch />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-mist-200 bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <Reveal>
            <SectionLabel>Why specialty matters</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Generalists cost you in <span className="display-serif text-brand-600">silent ways.</span>
            </h2>
            <p className="mt-4 text-[0.94rem] leading-relaxed text-ink-600/80">
              A missed modifier, an unsupported diagnosis or a bundling error does not announce itself. It becomes a denial weeks later. Certified specialty coders catch those issues before the claim is filed.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                { title: "Certified coding across specialties", detail: "CPC and CIC certified coders with ICD-10-CM, CPT and evaluation and management expertise.", icon: Stethoscope },
                { title: "Payer rules applied before submission", detail: "Medical necessity, authorization and bundling checks specific to your specialty and payers.", icon: ShieldCheck },
                { title: "Documentation feedback that helps", detail: "We query gaps and coach your providers so claims are supported — without pushing unsupported coding.", icon: Target },
              ].map(({ title, detail, icon: ItemIcon }) => (
                <TiltCard key={title} className="group">
                  <div className="flex gap-3.5 rounded-2xl border border-mist-200 bg-surface p-4 transition-colors group-hover:border-brand-300">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <ItemIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[0.88rem] font-extrabold text-ink-950">{title}</p>
                      <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-600/75">{detail}</p>
                    </div>
                  </div>
                </TiltCard>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="grid gap-3 sm:grid-cols-2">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-mist-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                <p className="text-[1.8rem] font-extrabold leading-none tracking-tight text-ink-950">{kpi.value}</p>
                <p className="mt-2 text-[0.78rem] font-extrabold text-ink-900">{kpi.label}</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-600/85">{kpi.detail}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell">
          <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-mint-50 p-6 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <SectionLabel>Don&apos;t see yours?</SectionLabel>
                <h2 className="mt-2 text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.03em] text-ink-950">If you bill insurance, we can support it.</h2>
                <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-ink-600/80">
                  The specialties above are the ones we bill most often, but our coders cover every major specialty. Tell us yours and we will map the approach before you commit.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/schedule-form" className="btn btn-primary">
                  Ask about my specialty <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/who-we-serve" className="btn btn-light">
                  Who we serve
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {["Cardiology", "Anesthesia", "Radiology", "Orthopedics", "Oncology", "Behavioral health", "Emergency rooms", "Urgent care"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-600/70">
                <Check className="h-3.5 w-3.5 text-mint-600" strokeWidth={3} /> {item}
              </span>
            ))}
            <ArrowLink href="/services" className="ml-auto">
              Explore our services
            </ArrowLink>
          </div>
        </div>
      </section>

      <CtaBand title="Specialty coding, custom tailored to your practice." />
    </>
  );
}
