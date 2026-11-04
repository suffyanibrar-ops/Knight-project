"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DURATION, EASE, usePrefersReducedMotion } from "@/lib/motion";

export type ShuffleCard = { id: string; title: string; body: string; meta?: string; icon?: ReactNode };

/**
 * Card shuffle: visitors can reshuffle a small set of service cards to see a
 * different subset. Real reordering with layout animation, keyboard accessible,
 * and state persists until they shuffle again.
 */
export function CardShuffle({ cards, visible = 3 }: { cards: ShuffleCard[]; visible?: number }) {
  const reduced = usePrefersReducedMotion();
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);

  // Rotate automatically so the value is visible without any interaction.
  useEffect(() => {
    if (reduced || paused) return;
    const timer = window.setInterval(() => setOffset((value) => (value + 1) % cards.length), 4200);
    return () => window.clearInterval(timer);
  }, [reduced, paused, cards.length]);

  const ordered = [...cards.slice(offset), ...cards.slice(0, offset)].slice(0, visible);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.78rem] font-semibold text-ink-600">
          Showing <span className="font-extrabold text-ink-900">{Math.min(visible, cards.length)}</span> of {cards.length} focus areas
          {!reduced && <span className="ml-1.5 text-ink-600/70">· rotates automatically</span>}
        </p>
        <button
          type="button"
          onClick={() => setOffset((value) => (value + 1) % cards.length)}
          aria-label="Show another set of priorities"
          className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.74rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden />
          Next set
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {ordered.map((card) => (
            <motion.article
              key={card.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: 14, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -10, rotate: 1 }}
              transition={{ duration: DURATION.base, ease: EASE }}
              className="group relative overflow-hidden rounded-2xl border border-mist-200 bg-surface p-5 transition-colors hover:border-brand-300"
            >
              <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-brand-50 transition-transform duration-500 group-hover:scale-150" />
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">{card.icon}</span>
              <h3 className="relative mt-3 text-[0.92rem] font-extrabold tracking-tight text-ink-950">{card.title}</h3>
              <p className="relative mt-1.5 text-[0.79rem] leading-relaxed text-ink-600">{card.body}</p>
              {card.meta && <p className="relative mt-3 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-brand-700">{card.meta}</p>}
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
