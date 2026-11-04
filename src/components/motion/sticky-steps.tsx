"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { Check } from "lucide-react";
import { DURATION, EASE, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type StickyStep = { id: string; step: string; title: string; body: string; points: string[]; image: string; alt: string };

/**
 * Sticky scroll storytelling.
 * Desktop: a pinned visual stays in view while the steps scroll past and the
 * active step is derived from scroll progress.
 * Mobile: collapses to a simple vertical list — no pinned viewport, no jank.
 */
export function StickySteps({ steps }: { steps: StickyStep[] }) {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start center", "end center"] });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (value) => {
      const next = Math.min(steps.length - 1, Math.max(0, Math.floor(value * steps.length)));
      setActive(next);
    });
    return () => unsubscribe();
  }, [scrollYProgress, steps.length]);

  const current = steps[active];

  return (
    <div ref={containerRef} className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
      {/* Pinned visual — desktop only */}
      <div className="hidden lg:block">
        <div className="sticky top-28 overflow-hidden rounded-3xl border border-mist-200 bg-night">
          <div className="relative aspect-[4/3.4]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.image}
                initial={reduced ? false : { opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: DURATION.base, ease: EASE }}
                className="absolute inset-0"
              >
                <Image src={current.image} alt={current.alt} fill sizes="480px" className="object-cover" />
              </motion.div>
            </AnimatePresence>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
            <div className="absolute inset-x-5 bottom-4">
              <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-brand-300">Step {current.step}</p>
              <p className="mt-1 text-[1rem] font-extrabold leading-snug text-white">{current.title}</p>
            </div>
          </div>
          <div className="h-1 w-full bg-white/10">
            <motion.div style={reduced ? { width: "100%" } : { scaleX, transformOrigin: "left" }} className="h-full bg-brand-400" />
          </div>
        </div>
      </div>

      {/* Steps */}
      <ol className="relative space-y-3">
        <span aria-hidden className="absolute left-[1.15rem] top-3 bottom-3 w-px bg-mist-200" />
        {steps.map((step, index) => {
          const isActive = index === active;
          return (
            <li key={step.id} className="relative">
              <div
                className={cn(
                  "flex gap-3.5 rounded-2xl border p-4 transition-all duration-300",
                  isActive ? "border-brand-300 bg-surface shadow-[0_18px_40px_-28px_rgba(4,20,31,0.4)]" : "border-transparent",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-[0.7rem] font-extrabold transition-colors",
                    isActive ? "border-brand-500 bg-brand-500 text-white" : "border-mist-200 bg-surface text-ink-600",
                  )}
                  aria-hidden
                >
                  {isActive ? <Check className="h-4 w-4" strokeWidth={3} /> : step.step}
                </span>
                <div className="min-w-0">
                  <h3 className={cn("text-[0.95rem] font-extrabold tracking-tight transition-colors", isActive ? "text-ink-950" : "text-ink-800")}>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[0.83rem] leading-relaxed text-ink-600">{step.body}</p>
                  {/* Mobile: show the image inline for the active step */}
                  <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-xl lg:hidden">
                    <Image src={step.image} alt={step.alt} fill sizes="(max-width: 1024px) 92vw, 480px" className="object-cover" />
                  </div>
                  <ul className="mt-2.5 grid gap-1.5">
                    {step.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-[0.77rem] font-semibold text-ink-700">
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-mint-50 text-mint-700">
                          <Check className="h-2.5 w-2.5" strokeWidth={3.4} />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
