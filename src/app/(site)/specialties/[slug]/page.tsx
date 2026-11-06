import { JsonLd } from "@/components/structured-data";
import { pageMetadata, serviceSchema, breadcrumbSchema } from "@/lib/seo";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/cta-band";
import { NextSteps } from "@/components/next-steps";
import { Icon } from "@/components/icon";
import { TiltCard } from "@/components/motion/tilt-card";
import { PageHero } from "@/components/page-hero";
import { specialtyVisuals } from "@/components/sections/visuals";
import { ArrowLink, Reveal, SectionLabel } from "@/components/ui";
import { getSpecialties, getSpecialty } from "@/lib/data";

export const dynamic = "force-dynamic";

const leakPoints = [
  "Denials that are logged but never appealed",
  "Modifier and bundling errors caught after submission",
  "Underpaid claims accepted at face value",
  "Authorizations tracked on paper, not to expiration",
  "Charges entered late, losing documentation detail",
  "Credentialing gaps that pause billing entirely",
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const specialty = await getSpecialty(slug);
  if (!specialty) return { title: "Specialty not found" };
  return pageMetadata({
    title: `${specialty.name} Medical Billing | Knight Medical Billing`,
    description: `${specialty.name} medical billing and coding by Knight Medical Billing. ${specialty.blurb}`.slice(0, 158),
    path: `/specialties/${specialty.slug}`,
    keywords: [`${specialty.name.toLowerCase()} medical billing`, `${specialty.name.toLowerCase()} medical coding`],
  });
}

export default async function SpecialtyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const specialty = await getSpecialty(slug);
  if (!specialty) notFound();

  const list = await getSpecialties();
  const index = Math.max(list.findIndex((item) => item.slug === specialty.slug), 0);
  const image = specialtyVisuals[index % specialtyVisuals.length];
  const related = list.filter((item) => item.slug !== specialty.slug && item.group === specialty.group).slice(0, 3);
  const relatedItems = related.length ? related : list.filter((item) => item.slug !== specialty.slug).slice(0, 3);

  return (
    <>
      <JsonLd data={[serviceSchema({ name: `${specialty.name} medical billing`, description: specialty.blurb, path: `/specialties/${specialty.slug}` }), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Specialties", path: "/specialties" }, { name: specialty.name, path: `/specialties/${specialty.slug}` }])]} />
      <PageHero

        eyebrow={`${specialty.group} billing`}
        title={
          <>
            {specialty.name} medical billing, <span className="display-serif text-brand-600">dialed in.</span>
          </>
        }
        description={`${specialty.blurb} Your billing team knows this specialty's code hierarchies, payer policies and documentation standards before your first claim goes out.`}
        image={image}
        imageAlt={`Photograph representing ${specialty.name} medical billing`}
        badges={specialty.focus.slice(0, 3)}
        crumbs={[{ label: "Specialties", href: "/specialties" }, { label: specialty.name }]}
        stat={{ value: "Specialty", label: "Coding context" }}
      />

      <section className="bg-surface py-14 sm:py-20">
        <div className="shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <Reveal>
              <SectionLabel>What we handle</SectionLabel>
              <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950">
                The {specialty.name.toLowerCase()} revenue cycle, end to end
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-600/85">
                From eligibility and prior authorization through coding, claim filing, payment posting and appeals, one accountable team owns every step. No handoffs between vendors and no orphaned workqueues.
              </p>
            </Reveal>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {specialty.focus.map((item, focusIndex) => (
                <Reveal key={item} delay={focusIndex * 0.04} className="h-full">
                  <TiltCard className="group h-full">
                    <div className="flex h-full items-start gap-2.5 rounded-2xl border border-mist-200 bg-mist-50/60 p-4 transition-colors group-hover:border-brand-300 group-hover:bg-white">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-brand-700">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <p className="text-[0.83rem] font-semibold leading-snug text-ink-800">{item}</p>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-10">
              <h2 className="text-[clamp(1.4rem,2.8vw,1.85rem)] font-extrabold tracking-[-0.03em] text-ink-950">Where revenue typically leaks</h2>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-600/80">We audit for these patterns and install the checks that prevent them from recurring.</p>
              <ul className="mt-4 space-y-2">
                {leakPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 border-b border-mist-100 pb-2 text-[0.86rem] text-ink-700/85">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="mt-10 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-mint-50 p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-brand-700 shadow-sm">
                  <Icon name={specialty.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[1.05rem] font-extrabold tracking-tight text-ink-950">What you can expect</p>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-600/80">Certified coders, clean-claim review, denial follow-up and reporting you can act on — with a dedicated account manager.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {[
                  { value: "Every claim", label: "Reviewed before submission" },
                  { value: "Daily", label: "Claim worklist" },
                  { value: "Monthly", label: "Reporting" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white bg-white/80 p-3">
                    <p className="text-lg font-extrabold text-ink-950">{stat.value}</p>
                    <p className="mt-0.5 text-[0.65rem] font-bold text-ink-600/80">{stat.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <div className="overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-soft">
                <div className="relative bg-night p-5 text-white">
                  <div className="dot-grid absolute inset-0 opacity-20" />
                  <div className="relative">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-200">
                      <Sparkles className="h-3 w-3" /> {specialty.name}
                    </span>
                    <p className="mt-3 text-lg font-extrabold leading-snug tracking-tight">Review your {specialty.name.toLowerCase()} billing — free.</p>
                    <p className="mt-1.5 text-[0.78rem] text-white/60">A specialist in your field reviews claims, denials and outstanding A/R.</p>
                  </div>
                </div>
                <div className="p-5">
                  <ul className="space-y-2.5">
                    {["No prepayment", "No hidden fees", "Your software stays in place", "Dedicated account manager"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[0.8rem] font-semibold text-ink-800">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-mint-600" strokeWidth={2.4} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/schedule-form" className="btn btn-primary mt-5 w-full">
                    Talk With Knight <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/our-process" className="btn btn-light mt-2 w-full">
                    How we start
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="mt-4">
              <div className="rounded-3xl border border-mist-200 bg-mist-50 p-5">
                <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">Other {specialty.group.toLowerCase()} specialties</p>
                <div className="mt-3 space-y-2">
                  {relatedItems.map((item) => (
                    <Link key={item.slug} href={`/specialties/${item.slug}`} className="group flex items-center gap-3 rounded-xl bg-surface p-2.5 transition-colors hover:bg-brand-50">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-500 group-hover:text-white">
                        <Icon name={item.icon} className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-[0.8rem] font-bold text-ink-900 group-hover:text-brand-700">{item.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-600/30 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </Link>
                  ))}
                </div>
                <div className="mt-4">
                  <ArrowLink href="/specialties">All specialties</ArrowLink>
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>

      <NextSteps />

      <CtaBand title={`${specialty.name} billing, with a team that knows the codes.`} description={`Talk with us about where ${specialty.name.toLowerCase()} revenue slows down and how a dedicated team would take responsibility. The consultation is free and there is no prepayment.`} />
    </>
  );
}
