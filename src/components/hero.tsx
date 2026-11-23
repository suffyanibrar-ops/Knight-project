"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroCanvas } from "./motion/hero-canvas";
import { AmbientField } from "./motion/ambient-field";
import { HeroPanel } from "./hero-panel";
import { TiltCard } from "./motion/tilt-card";
import { Magnetic } from "./motion/magnetic";

/**
 * Homepage hero. One clear identity, one problem, two next steps.
 * Everything else (audiences, services, specialties, software) belongs lower
 * on the page, where the visitor can choose to go deeper.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-mist-50 via-white to-white">
      <div className="pointer-events-none absolute inset-0">
        <HeroCanvas />
        <AmbientField variant="hero" intensity={0.7} />
        <div className="grid-lines absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
      </div>

      <div data-hero-reveal className="shell relative grid items-center gap-10 pb-12 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-16 lg:pt-14">
        <div>
          <p className="hero-fade-up flex items-center gap-2 text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-brand-700">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Medical billing &amp; revenue cycle management
          </p>

          <h1 className="hero-heading-in mt-5 max-w-[19ch] text-[clamp(2.1rem,5.2vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-ink-950">
            A better-run revenue cycle starts with <span className="display-serif text-brand-600">knowing what needs fixing.</span>
          </h1>

          <p className="hero-fade-up hero-delay-2 mt-5 max-w-xl text-[1rem] leading-relaxed text-ink-600/90 sm:text-[1.06rem]">
            Knight Medical Billing works inside the systems your practice already uses to manage claims, denials, A/R and payment posting.
          </p>

          <div className="hero-fade-up hero-delay-3 mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Magnetic strength={7}>
              <Link href="/schedule-form" className="btn btn-primary group px-6 py-4 text-[0.94rem]">
                Review Your Revenue Cycle
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
              </Link>
            </Magnetic>
            <Magnetic strength={5}>
              <Link href="/our-process" className="btn btn-light group px-6 py-4 text-[0.94rem]">
                See How Knight Works
                <ArrowRight className="h-4 w-4 text-brand-600 transition-transform group-hover:translate-x-1" strokeWidth={2.2} />
              </Link>
            </Magnetic>
          </div>

          <p className="hero-fade-up hero-delay-4 mt-5 text-[0.7rem] font-semibold text-ink-600/75">
            No prepayment · No hidden fees · HIPAA-conscious handling of patient information
          </p>

          <p className="hero-fade-up hero-delay-5 mt-5 text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/60">
            Claims <span className="mx-1.5 text-brand-400">·</span> Denials <span className="mx-1.5 text-brand-400">·</span> A/R <span className="mx-1.5 text-brand-400">·</span> Payment posting <span className="mx-1.5 text-brand-400">·</span> Reporting
          </p>
        </div>

        <div className="hero-panel-in relative mx-auto w-full max-w-[30rem] lg:max-w-none">
          <div aria-hidden className="absolute -inset-3 -z-10 rounded-[2.2rem] bg-gradient-to-tr from-brand-100/70 via-surface/40 to-mint-100/70" />
          <TiltCard max={4} className="relative">
            <HeroPanel />
          </TiltCard>
        </div>
      </div>

      <div className="shell relative pb-8 sm:pb-10">
        <div data-hero-flow-line className="hero-flow" aria-hidden="true">
          <span className="hero-flow__track" />
          {["Claims", "Denials", "A/R", "Payments"].map((label, index) => (
            <span key={label} className="hero-flow__node" style={{ left: `${(index / 3) * 100}%` }}>
              <span className={`hero-flow__dot ${index >= 2 ? "hero-flow__dot--mint" : ""}`} />
              <span className="hero-flow__label">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
