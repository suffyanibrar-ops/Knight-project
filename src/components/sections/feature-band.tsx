import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ParallaxFrame } from "./parallax-frame";

/**
 * A calm, two-column visual band: illustration on one side, a short proof point
 * on the other. Used to bring a unique visual onto pages that were previously
 * all text, without removing or reordering any existing section.
 */
export function FeatureBand({
  eyebrow,
  title,
  description,
  points = [],
  visual,
  alt,
  cta,
  reverse = false,
  tone = "mist",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  points?: string[];
  visual: string;
  alt: string;
  cta?: { label: string; href: string };
  reverse?: boolean;
  tone?: "mist" | "surface";
  className?: string;
}) {
  return (
    <section className={cn(tone === "mist" ? "bg-mist-50" : "bg-surface", "py-14 sm:py-20", className)}>
      <div className="shell grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <Reveal className={reverse ? "lg:order-2" : undefined}>
          <SectionLabel>{eyebrow}</SectionLabel>
          <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
            {title}
          </h2>
          {description ? <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-600/80">{description}</p> : null}
          {points.length > 0 ? (
            <ul className="mt-5 space-y-2.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[0.85rem] font-semibold text-ink-800">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-50 text-mint-700">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
          {cta ? (
            <Link href={cta.href} className="btn btn-primary mt-6">
              {cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </Reveal>

        <ParallaxFrame
          src={visual}
          alt={alt}
          aspect="aspect-[4/3]"
          className={cn("w-full", reverse ? "lg:order-1" : undefined)}
        />
      </div>
    </section>
  );
}
