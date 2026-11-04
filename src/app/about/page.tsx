import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import { ArrowRight, Building2, Check, Globe2, HeartHandshake, Quote, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/cta-band";
import { Lightbox } from "@/components/motion/lightbox";
import { Icon } from "@/components/icon";
import { PageHero } from "@/components/page-hero";
import { Reveal, SectionLabel } from "@/components/ui";
import { benefits, coreValues, leadership, site, stats } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'About Us | Knight Medical Billing', description: 'Meet Knight Medical Billing: a clinician-led team with 25 years of combined billing and coding experience, dedicated to easing the financial burden of healthcare providers.', path: '/about', keywords: ['about knight medical billing', 'medical billing company indianapolis'] });

const promises = [
  "A dedicated, accessible team member for every client",
  "Transparent communication at every step",
  "Timely filing on every claim",
  "Personalized account management",
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Knight Medical Billing"
        title={
          <>
            The keystone of your <span className="display-serif text-brand-600">financial performance.</span>
          </>
        }
        description="Led by a seasoned medical billing and coding team, Knight Medical Billing is dedicated to easing the financial management burden of healthcare providers. Several of our team members have worked as healthcare providers themselves — they understand the demands of practice."
        image="/images/section-about.jpg"
        imageAlt="The Knight Medical Billing team"
        badges={["25 years combined experience", "Clinician-led", "Herndon, Virginia"]}
        crumbs={[{ label: "About" }]}
        primaryCta={{ label: "Schedule a consultation", href: "/schedule-form" }}
        secondaryCta={{ label: "Talk to our team", href: "/contact" }}
        stat={{ value: "25 yrs", label: "Combined experience" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <Reveal>
            <SectionLabel>Our story</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-ink-950">
              Payment and billing, <span className="display-serif text-brand-600">on time.</span>
            </h2>
            <div className="mt-4 space-y-4 text-[0.94rem] leading-relaxed text-ink-600/85">
              <p>
                Knight Medical Billing is dedicated to easing the financial management burden of healthcare providers. Our team of proficient billers and coders brings a cumulative 25 years of experience in the industry.
              </p>
              <p>
                Our team is known for two exceptional qualities, as cited by satisfied clients: <span className="font-bold text-ink-900">accessibility and knowledge</span>. We are committed to personalized service, ensuring every client receives a dedicated team member who is highly knowledgeable and accessible.
              </p>
              <p>
                We work as an extension of your staff. Your doctors, nurses, front desk and techs serve one purpose — providing the best care for your patients. We take care of the rest of the revenue cycle so that purpose is never compromised.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {[
                { icon: HeartHandshake, text: "Personalized service" },
                { icon: Globe2, text: "Serving facilities across the US" },
                { icon: Target, text: "Accuracy in every claim" },
                { icon: Building2, text: "Herndon, Virginia office" },
              ].map(({ icon: ItemIcon, text }) => (
                <div key={text} className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50/60 px-3 py-3 text-[0.76rem] font-bold text-ink-800">
                  <ItemIcon className="h-4 w-4 shrink-0 text-brand-600" />
                  {text}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08} className="relative">
            <div className="relative aspect-[4/3.4] overflow-hidden rounded-3xl border border-white shadow-[0_40px_80px_-50px_rgba(4,20,31,0.55)]">
              <Image src="/images/section-about.jpg" alt="Knight Medical Billing team at work" fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md">
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-white/70">Our promise</p>
                <p className="mt-1 text-[0.95rem] font-extrabold leading-snug text-white">Never just another number in a vast medical billing company.</p>
              </div>
            </div>
            <div className="animate-float absolute -right-3 top-6 rounded-2xl border border-mist-200 bg-surface p-3.5 shadow-lg">
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/75">Claim acceptance</p>
              <p className="mt-1 text-xl font-extrabold text-ink-950">99.9%</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-mist-50 py-14 sm:py-20">
        <div className="shell grid gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-mist-200 bg-surface p-6 sm:p-8">
              <SectionLabel>Our mission</SectionLabel>
              <h2 className="mt-3 text-[1.5rem] font-extrabold tracking-[-0.03em] text-ink-950">Revolutionizing medical billing</h2>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/85">
                At Knight Medical Billing, our mission is to revolutionize medical billing and revenue cycle management. We are passionate about empowering healthcare providers and organizations to thrive by relieving the financial burdens that hinder their growth. Through accuracy, efficiency and personalized service, we aim to be the catalyst that propels our clients toward success.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="h-full rounded-3xl border border-mist-200 bg-surface p-6 sm:p-8">
              <SectionLabel>Our vision</SectionLabel>
              <h2 className="mt-3 text-[1.5rem] font-extrabold tracking-[-0.03em] text-ink-950">Effortless financial health</h2>
              <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-600/85">
                We strive to create a seamless and transformative experience for our clients, where the complexities of medical billing become effortless and the financial health of their organizations thrives. We envision long-term partnerships based on trust, mutual growth and shared success.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="shell mt-4">
          <Reveal>
            <div className="rounded-3xl border border-mist-200 bg-surface p-6 sm:p-8">
              <SectionLabel>Core values</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.03em] text-ink-950">Five commitments we work by</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {coreValues.map((value) => (
                  <div key={value.title} className="group rounded-2xl border border-mist-200 bg-mist-50/60 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                      <Icon name={value.icon} className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-[0.9rem] font-extrabold text-ink-950">{value.title}</p>
                    <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-600/75">{value.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <Reveal className="relative">
            <div className="relative aspect-[4/4.6] overflow-hidden rounded-3xl border border-mist-200 bg-surface p-3 shadow-[0_36px_70px_-45px_rgba(4,20,31,0.5)]">
              <div className="relative h-full w-full overflow-hidden rounded-2xl">
                <Image src={leadership[0].image} alt={leadership[0].name} fill className="object-cover object-top" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-transparent to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/25 bg-white/15 p-3 backdrop-blur-md">
                  <p className="text-[0.95rem] font-extrabold text-white">{leadership[0].name}</p>
                  <p className="text-[0.68rem] font-semibold text-white/70">{leadership[0].role}</p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <SectionLabel>Leadership</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.75rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              CEO & founder, <span className="display-serif text-brand-600">Lawrence Fianko</span>
            </h2>
            <div className="mt-4 space-y-3.5 text-[0.92rem] leading-relaxed text-ink-600/85">
              <p>{leadership[0].bio}</p>
              <p>{leadership[0].detail}</p>
              <p>
                Combining clinical insight, entrepreneurial spirit and a commitment to social impact, Lawrence founded Knight Medical Billing to empower providers by alleviating financial burdens, streamlining billing processes and optimizing revenue cycles.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-mist-200 bg-mist-50 p-4">
              <Quote className="h-8 w-8 shrink-0 text-brand-400" strokeWidth={1.4} />
              <p className="text-[0.84rem] font-semibold leading-relaxed text-ink-800">“If you succeed, we succeed. That is our promise to every medical billing client across the US.”</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-mist-50 py-14 sm:py-20">
        <div className="shell">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-xl">
              <SectionLabel>Benefits of choosing KMB</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                We improve your overall <span className="display-serif text-brand-600">RCM operations.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="max-w-sm text-[0.84rem] leading-relaxed text-ink-600/70">Just as you are the best at what you do, we are the best at what we do. If you succeed, we succeed.</p>
            </Reveal>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <Reveal key={benefit.title} delay={index * 0.04}>
                <div className="group h-full rounded-2xl border border-mist-200 bg-surface p-5 transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                    <Icon name={benefit.icon} className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-[0.9rem] font-extrabold leading-snug text-ink-950">{benefit.title}</p>
                  <p className="mt-1 text-[0.77rem] leading-relaxed text-ink-600/75">{benefit.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8">
            <div className="flex flex-col items-center justify-between gap-5 rounded-3xl border border-mist-200 bg-surface p-6 sm:flex-row">
              <div>
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Our commitments</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {promises.map((promise) => (
                    <span key={promise} className="flex items-center gap-1.5 rounded-lg border border-mist-200 bg-mist-50 px-2.5 py-1.5 text-[0.7rem] font-bold text-ink-800">
                      <Check className="h-3 w-3 text-mint-600" strokeWidth={3} /> {promise}
                    </span>
                  ))}
                </div>
              </div>
              <Link href="/schedule-form" className="btn btn-primary shrink-0">
                Book a consultation <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal className="mt-4">
            <div className="grid gap-3 rounded-3xl border border-mist-200 bg-night p-6 text-white sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-extrabold tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-white/45">{stat.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>


      <section className="bg-mist-50 py-14 sm:py-20">
        <div className="shell">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Reveal className="max-w-2xl">
              <SectionLabel>Inside the practice</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
                The settings we support <span className="display-serif text-brand-600">every day.</span>
              </h2>
              <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-600/80">
                Independent practices, specialty groups, urgent cares and hospital teams. Select an image to view it larger.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="max-w-xs text-[0.78rem] leading-relaxed text-ink-600/80">
                Use the arrow keys to move between images, or press Escape to close.
              </p>
            </Reveal>
          </div>
          <Reveal className="mt-8">
            <Lightbox
              items={[
                { src: "/images/section-facilities.jpg", alt: "Modern clinic reception area supported by our billing team", caption: "Independent practice teams" },
                { src: "/images/section-specialties.jpg", alt: "Specialty clinicians collaborating in a hospital corridor", caption: "Specialty and hospital groups" },
                { src: "/images/section-process.jpg", alt: "Abstract representation of a connected revenue cycle", caption: "Multi-facility revenue cycle" },
                { src: "/images/section-services.jpg", alt: "Coding specialist reviewing documentation at a desk", caption: "Dedicated billing specialists" },
                { src: "/images/section-consultation.jpg", alt: "Billing consultant on a video call with a practice", caption: "Direct access to your team" },
                { src: "/images/section-results.jpg", alt: "Analytics visual representing monthly revenue reporting", caption: "Reporting that explains itself" },
              ]}
            />
          </Reveal>
        </div>
      </section>
      <CtaBand
        title="Talk to the team that will actually run your billing."
        description={`Call ${site.phone} or email ${site.email}. We answer questions directly, during business hours, with no prepayment required to get started.`}
      />
    </>
  );
}
