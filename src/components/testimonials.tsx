"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ChevronRight, Quote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DURATION, EASE, usePrefersReducedMotion } from "@/lib/motion";

/**
 * Practice-perspectives carousel.
 *
 * Content is anonymised feedback themes shared with our billing team — no named
 * individuals or companies are presented. Photography is representative and is
 * labelled as such. The owner can replace entries in `src/lib/testimonials.ts`
 * once written permission for attributable quotes is available.
 */
export type Perspective = {
  id: string;
  theme: string;
  quote: string;
  role: string;
  context: string;
  image: string;
  imageAlt?: string;
  signals: string[];
};

const pad = (value: number) => String(value).padStart(2, "0");

export function TestimonialsCarousel({ items }: { items: Perspective[] }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (direction: 1 | -1) => setIndex((value) => (value + direction + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => go(1), 7000);
    return () => window.clearInterval(timer);
  }, [paused, reduced, go]);

  const active = items[index];

  return (
    <div
      className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="group"
      aria-roledescription="carousel"
      aria-label="Practice perspectives"
    >
      {/* Quote panel */}
      <div className="relative flex min-h-[22rem] flex-col overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(155deg,rgba(255,255,255,0.075),rgba(255,255,255,0.028))] p-6 shadow-[0_30px_70px_-50px_rgba(0,0,0,0.9)] backdrop-blur-md sm:p-8">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/70 to-transparent" />
        <Quote className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-white/[0.055]" strokeWidth={1} aria-hidden />

        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-300/40 bg-brand-500/10 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-brand-200">
            {active.theme}
          </span>
          <span className="text-[0.62rem] font-extrabold tracking-[0.14em] text-white/35">
            {pad(index + 1)} <span className="text-white/20">/ {pad(items.length)}</span>
          </span>
        </div>

        <div aria-live="polite" aria-atomic="true" className="relative mt-5 flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: DURATION.base, ease: EASE }}
              className="flex h-full flex-col"
            >
              <blockquote className="text-[1.04rem] leading-relaxed text-white/92 sm:text-[1.14rem]">
                &ldquo;{active.quote}&rdquo;
              </blockquote>

              <div className="mt-5">
                <p className="text-[0.55rem] font-extrabold uppercase tracking-[0.16em] text-white/35">What we would examine</p>
                <ul className="mt-2 space-y-1.5">
                  {active.signals.map((signal) => (
                    <li key={signal} className="flex items-start gap-2 text-[0.76rem] leading-relaxed text-white/65">
                      <span aria-hidden className="mt-[0.36rem] h-1 w-1 shrink-0 rounded-full bg-brand-300/80" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>

              <footer className="mt-auto border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[0.82rem] font-extrabold text-white">{active.role}</p>
                    <p className="mt-0.5 text-[0.72rem] text-white/55">{active.context}</p>
                  </div>
                  <span className="rounded-full border border-white/12 px-2.5 py-1 text-[0.54rem] font-bold uppercase tracking-[0.12em] text-white/40">
                    Anonymised theme
                  </span>
                </div>
              </footer>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex gap-1.5" role="tablist" aria-label="Choose a perspective">
            {items.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={itemIndex === index}
                aria-label={`Perspective ${itemIndex + 1}: ${item.theme}`}
                onClick={() => setIndex(itemIndex)}
                className="group grid h-6 w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                <span
                  aria-hidden
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    itemIndex === index ? "w-7 bg-brand-300" : "w-3 bg-white/25 group-hover:bg-white/45"
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous perspective" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next perspective" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10 hover:text-white">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Editorial image + theme navigation */}
      <div className="flex flex-col">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/12 bg-night-soft shadow-[0_30px_70px_-50px_rgba(0,0,0,0.9)] sm:aspect-[16/10]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.image}
              initial={reduced ? false : { opacity: 0, scale: 1.035 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: DURATION.base, ease: EASE }}
              className="absolute inset-0"
            >
              <Image src={active.image} alt={active.imageAlt ?? active.context} fill sizes="(max-width: 1024px) 92vw, 480px" className="object-cover" />
            </motion.div>
          </AnimatePresence>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/10 to-transparent" />
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-night/40 px-2.5 py-1 text-[0.55rem] font-extrabold uppercase tracking-[0.14em] text-white/65 backdrop-blur-sm">
            <span className="h-1 w-1 rounded-full bg-mint-300" /> Practice perspective {pad(index + 1)}
          </div>
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.56rem] font-extrabold uppercase tracking-[0.18em] text-white/40">Theme</p>
              <p className="mt-1 text-[1.15rem] font-extrabold tracking-tight text-white">{active.theme}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(itemIndex)}
              aria-label={`Show ${item.theme}`}
              aria-current={itemIndex === index}
              className={`group relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${
                itemIndex === index ? "border-brand-300/60 bg-white/10 text-white" : "border-white/12 text-white/55 hover:border-white/30 hover:text-white"
              }`}
            >
              <span className="block text-[0.5rem] font-extrabold tracking-[0.12em] text-white/30">{pad(itemIndex + 1)}</span>
              <span className="mt-0.5 block truncate text-[0.7rem] font-bold">{item.theme}</span>
              {itemIndex === index && <span aria-hidden className="absolute inset-x-3 bottom-1.5 h-px bg-brand-300/70" />}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[0.65rem] leading-relaxed text-white/40">Shared themes from conversations, not attributed client quotes. Photos are representative.</p>
      </div>
    </div>
  );
}
