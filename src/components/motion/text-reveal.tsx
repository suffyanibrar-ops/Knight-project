"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion, wordChild, wordParent } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Splits a headline into words and reveals them in sequence.
 * The full string stays in the DOM for assistive tech via aria-label on the
 * wrapper, and each word is aria-hidden to avoid stuttering announcements.
 */
export function TextReveal({
  text,
  className,
  as: Tag = "span",
  highlight,
}: {
  text: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3";
  /** Words (exact match) rendered with the serif italic accent. */
  highlight?: string[];
}) {
  const reduced = usePrefersReducedMotion();
  const words = text.split(" ");

  // Same DOM shape in both modes; only the animation is switched off, so
  // hydration always matches.
  return (
    <Tag className={cn(className)} aria-label={text}>
      <motion.span
        variants={reduced ? undefined : wordParent}
        initial={reduced ? undefined : "hidden"}
        whileInView={reduced ? undefined : "show"}
        viewport={{ once: true, margin: "-60px" }}
        className="inline"
      >
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="inline-block overflow-hidden pb-[0.06em] align-bottom" aria-hidden="true">
            <motion.span variants={wordChild} className={cn("inline-block", highlight?.includes(word) && "display-serif text-brand-600")}>
              {word}
              {index < words.length - 1 ? "\u00A0" : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

/** Reveals children line-by-line with a stagger — for short paragraphs. */
export function StaggeredLines({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {children}
    </motion.div>
  );
}
