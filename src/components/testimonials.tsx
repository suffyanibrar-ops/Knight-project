"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DURATION, EASE, usePrefersReducedMotion } from "@/lib/motion";

/**
 * Interactive practice-perspective carousel.
 *
 * Content is anonymised feedback themes shared with our billing team — no named
 * individuals or companies are presented, because we have not published
 * attributable client quotes. The owner can replace entries in
 * `src/lib/testimonials.ts` once written permission is available.
 */
export type Perspective = {
  id: string;
  theme: string;
  quote: string;
  role: string;
  context: string;
  image: string;
};

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
      className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="group"
      aria-roledescription="carousel"
      aria-label="Practice perspectives"
    >
      {/* Quote panel */}
      <div className="relative min-h-[19rem] overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] p-6 backdrop-blur-md sm:p-8">
        <Quote className="absolute -right-3 -top-3 h-24 w-24 text-white/[0.06]" strokeWidth={1} aria-hidden />
        <div aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: DURATION.base, ease: EASE }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-300/40 bg-brand-500/10 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-brand-200">
                {active.theme}
              </span>
              <blockquote className="mt-4 text-[1.02rem] leading-relaxed text-white/90 sm:text-[1.1rem]">
                &ldquo;{active.quote}&rdquo;
              </blockquote>
              <footer className="mt-5 border-t border-white/10 pt-4">
                <p className="text-[0.82rem] font-extrabold text-white">{active.role}</p>
                <p className="mt-0.5 text-[0.72rem] text-white/55">{active.context}</p>
              </footer>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5" role="tablist" aria-label="Choose a perspective">
            {items.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={itemIndex === index}
                aria-label={`Perspective ${itemIndex + 1}: ${item.theme}`}
                onClick={() => setIndex(itemIndex)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  itemIndex === index ? "w-7 bg-brand-300" : "w-3 bg-white/25 hover:bg-white/45"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous perspective" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next perspective" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Visual + thumbnails */}
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/12">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.image}
              initial={reduced ? false : { opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: DURATION.base, ease: EASE }}
              className="absolute inset-0"
            >
              <Image src={active.image} alt={active.context} fill sizes="(max-width: 1024px) 92vw, 480px" className="object-cover" />
            </motion.div>
          </AnimatePresence>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night/80 via-night/10 to-transparent" />
          <p className="absolute inset-x-4 bottom-3 text-[0.72rem] font-semibold text-white/80">
            Anonymised feedback · not a client endorsement
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {items.slice(0, 4).map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(itemIndex)}
              aria-label={`Show ${item.theme}`}
              aria-current={itemIndex === index}
              className={`flex items-center justify-between gap-1.5 rounded-xl border px-3 py-2 text-left text-[0.7rem] font-bold transition-colors ${
                itemIndex === index ? "border-brand-300/60 bg-white/10 text-white" : "border-white/12 text-white/55 hover:border-white/30 hover:text-white"
              }`}
            >
              <span className="truncate">{item.theme}</span>
              {itemIndex === index ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : <ChevronLeft className="h-3 w-3 shrink-0 opacity-0" aria-hidden />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
