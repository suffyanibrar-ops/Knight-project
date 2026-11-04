"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { DURATION, EASE } from "@/lib/motion";

export type GalleryItem = { src: string; alt: string; caption: string };

/**
 * Accessible image lightbox: focus is trapped, Escape closes, arrow keys and
 * buttons page through, and body scroll is locked while open.
 * Thumbnails are real buttons, so the whole gallery is keyboard operable.
 */
export function Lightbox({ items }: { items: GalleryItem[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setIndex(null);
    openerRef.current?.focus();
  }, []);

  const next = useCallback(() => setIndex((current) => (current === null ? null : (current + 1) % items.length)), [items.length]);
  const prev = useCallback(() => setIndex((current) => (current === null ? null : (current - 1 + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, close, next, prev]);

  const active = index === null ? null : items[index];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, itemIndex) => (
          <button
            key={item.src}
            type="button"
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setIndex(itemIndex);
            }}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-mist-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label={`Open image: ${item.caption}`}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(max-width: 640px) 45vw, 30vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" aria-hidden />
            <span className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2 text-left">
              <span className="text-[0.72rem] font-bold leading-tight text-white">{item.caption}</span>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur" aria-hidden>
                <ZoomIn className="h-3 w-3" />
              </span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-night/92 p-4 backdrop-blur-sm"
            onClick={close}
            role="presentation"
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={active.caption}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: DURATION.base, ease: EASE }}
              className="relative w-full max-w-3xl outline-none"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-night-soft">
                <Image src={active.src} alt={active.alt} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-[0.85rem] font-semibold text-white/85">{active.caption}</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={prev} aria-label="Previous image" className="grid h-9 w-9 place-items-center rounded-full border border-white/25 text-white hover:bg-white/10">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={next} aria-label="Next image" className="grid h-9 w-9 place-items-center rounded-full border border-white/25 text-white hover:bg-white/10">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={close} aria-label="Close image viewer" className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-900 hover:bg-mist-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
