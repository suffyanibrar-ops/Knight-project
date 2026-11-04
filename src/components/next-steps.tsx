import Link from "next/link";
import { ArrowRight, BadgeCheck, Layers, Stethoscope } from "lucide-react";
import { services, specialties } from "@/lib/site";

/**
 * Cross-link band used at the end of every detail page.
 * Gives each page a clear "where to go next" instead of a dead end — the single
 * biggest usability gap on deep pages.
 */
export function NextSteps({ currentService }: { currentService?: string }) {
  const others = services.filter((service) => service.slug !== currentService).slice(0, 4);
  const topSpecialties = specialties.slice(0, 6);

  return (
    <section className="border-t border-mist-200 bg-mist-50 py-12">
      <div className="shell grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div>
          <p className="eyebrow text-brand-700">
            <Layers className="h-3.5 w-3.5" aria-hidden /> Keep exploring
          </p>
          <h2 className="mt-2 text-[1.25rem] font-extrabold tracking-tight text-ink-950">Related services</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {others.map((service) => (
              <li key={service.slug}>
                <Link
                  href={`/services/${service.slug}`}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-mist-200 bg-surface px-3.5 py-2.5 text-[0.82rem] font-bold text-ink-900 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="min-w-0 truncate">{service.short}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-600/50 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/services" className="mt-4 inline-flex items-center gap-1.5 text-[0.8rem] font-extrabold text-brand-700 hover:text-brand-500">
            All services <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div>
          <p className="eyebrow text-brand-700">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden /> Specialty coverage
          </p>
          <h2 className="mt-2 text-[1.25rem] font-extrabold tracking-tight text-ink-950">Browse by specialty</h2>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {topSpecialties.map((specialty) => (
              <Link
                key={specialty.slug}
                href={`/specialties/${specialty.slug}`}
                className="rounded-full border border-mist-200 bg-surface px-3 py-1.5 text-[0.74rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                {specialty.name}
              </Link>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-brand-100 bg-surface p-4">
            <p className="flex items-center gap-1.5 text-[0.78rem] font-extrabold text-ink-950">
              <BadgeCheck className="h-4 w-4 text-mint-600" aria-hidden /> Not sure which applies?
            </p>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-600">
              A free consultation starts with your current workflow, not a sales pitch.
            </p>
            <Link href="/schedule-form" className="btn btn-primary mt-3 w-full py-2.5 text-[0.8rem]">
              Request a free consultation <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
