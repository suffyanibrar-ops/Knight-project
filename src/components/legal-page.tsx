import type { ReactNode } from "react";
import { PageHero } from "./page-hero";
import { Reveal } from "./ui";
import { site } from "@/lib/site";

export type LegalSection = { heading: string; paragraphs: string[]; list?: string[] };

export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  updated: string;
  intro: string;
  sections: LegalSection[];
  footer?: ReactNode;
}) {
  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        description={intro}
        crumbs={[{ label: eyebrow }]}
        primaryCta={{ label: "Contact us", href: "/contact" }}
        secondaryCta={{ label: "HIPAA & security", href: "/hipaa-compliance" }}
      />
      <section className="bg-surface py-12 sm:py-16">
        <div className="shell grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-mist-200 bg-mist-50 p-5">
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">On this page</p>
              <nav className="mt-3 space-y-1.5">
                {sections.map((section, index) => (
                  <a key={section.heading} href={`#section-${index}`} className="block rounded-lg px-2 py-1.5 text-[0.8rem] font-semibold text-ink-700 transition-colors hover:bg-white hover:text-brand-700">
                    {section.heading}
                  </a>
                ))}
              </nav>
              <p className="mt-4 border-t border-mist-200 pt-3 text-[0.7rem] text-ink-600/80">Last updated: {updated}</p>
              <p className="mt-2 text-[0.7rem] text-ink-600/80">{site.name} · {site.address}</p>
            </div>
          </aside>

          <div className="max-w-3xl">
            {sections.map((section, index) => (
              <Reveal key={section.heading} delay={Math.min(index * 0.03, 0.2)}>
                <div id={`section-${index}`} className="mb-8 scroll-mt-28">
                  <h2 className="text-[clamp(1.15rem,2.2vw,1.45rem)] font-extrabold tracking-[-0.02em] text-ink-950">{section.heading}</h2>
                  <div className="mt-2 space-y-3 text-[0.9rem] leading-relaxed text-ink-600/85">
                    {section.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex}>{paragraph}</p>
                    ))}
                    {section.list && (
                      <ul className="mt-2 space-y-2">
                        {section.list.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
            {footer && <div className="mt-10 rounded-2xl border border-mist-200 bg-mist-50 p-5 text-[0.85rem] leading-relaxed text-ink-700/85">{footer}</div>}
          </div>
        </div>
      </section>
    </>
  );
}
