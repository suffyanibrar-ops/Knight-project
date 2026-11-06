import Image from "next/image";
import { ArrowRight, BadgeCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { JsonLd } from "./structured-data";
import { breadcrumbSchema } from "@/lib/seo";

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  badges = [],
  crumbs = [],
  path,
  primaryCta = { label: "Talk With Knight", href: "/schedule-form" },
  secondaryCta,
  aside,
  stat,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  image?: string;
  imageAlt?: string;
  badges?: string[];
  crumbs?: { label: string; href?: string }[];
  /** Current public path, used to emit BreadcrumbList structured data. */
  path?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  aside?: ReactNode;
  stat?: { value: string; label: string };
}) {
  const breadcrumbItems = [{ name: "Home", path: "/" }, ...crumbs.map((crumb) => ({ name: crumb.label, path: crumb.href ?? path ?? "/" }))];

  return (
    <>
      {path && crumbs.length > 0 && <JsonLd data={breadcrumbSchema(breadcrumbItems)} />}
    <section className="relative overflow-hidden border-b border-mist-200 bg-gradient-to-b from-mist-50 to-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-lines absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="absolute -right-32 -top-24 h-[26rem] w-[26rem] rounded-full bg-brand-200/35 blur-[100px]" />
      </div>
      <div className="shell relative py-10 lg:py-16">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold text-ink-600/80">
            <Link href="/" className="transition-colors hover:text-brand-700">
              Home
            </Link>
            {crumbs.map((crumb) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 text-ink-600/30" />
                {crumb.href ? (
                  <Link href={crumb.href} className="transition-colors hover:text-brand-700">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink-800">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        <div className={cn("grid min-w-0 items-center gap-10", image || aside ? "lg:grid-cols-[1.1fr_0.9fr] lg:gap-14" : "")}>
          <div className={cn("min-w-0", !image && !aside && "max-w-3xl")}>
            <span className="eyebrow text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {eyebrow}
            </span>
            <h1 className="mt-4 text-[clamp(2.1rem,4.8vw,3.55rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink-950">{title}</h1>
            <p className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-ink-600/85">{description}</p>

            {badges.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                {badges.map((badge) => (
                  <span key={badge} className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink-700">
                    <BadgeCheck className="h-4 w-4 text-mint-600" strokeWidth={2.2} /> {badge}
                  </span>
                ))}
              </div>
            )}

            {(primaryCta || secondaryCta) && (
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                {primaryCta && (
                  <Link href={primaryCta.href} className="btn btn-primary group px-6 py-4">
                    {primaryCta.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                  </Link>
                )}
                {secondaryCta && (
                  <Link href={secondaryCta.href} className="btn btn-light px-6 py-4">
                    {secondaryCta.label}
                  </Link>
                )}
              </div>
            )}
          </div>

          {image && (
            <div className="relative mx-auto w-full max-w-[32rem]">
              <div className="absolute -inset-3 -z-10 rounded-[2.4rem] bg-gradient-to-tr from-brand-100 via-white to-mint-100" />
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.8rem] border border-white bg-surface shadow-[0_40px_80px_-45px_rgba(4,20,31,0.55)]">
                <Image src={image} alt={imageAlt ?? ""} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/55 via-transparent to-transparent" />
                {stat && (
                  <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/25 bg-white/15 p-3.5 backdrop-blur-md">
                    <p className="text-xl font-extrabold leading-none text-white">{stat.value}</p>
                    <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/70">{stat.label}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {aside && <div>{aside}</div>}
        </div>
      </div>
    </section>
    </>
  );
}
