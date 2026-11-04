"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Typewriter that cycles a short list of phrases.
 *
 * - Respects the OS/panel reduced-motion setting (shows the first phrase).
 * - Reserves width with a hidden longest phrase so the layout never jumps.
 * - Screen readers get the full phrase list once via a visually hidden node.
 */
export function Typewriter({
  phrases,
  className,
  typeSpeed = 62,
  deleteSpeed = 34,
  holdMs = 1900,
}: {
  phrases: string[];
  className?: string;
  typeSpeed?: number;
  deleteSpeed?: number;
  holdMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced || phrases.length === 0) return;
    const current = phrases[index % phrases.length];

    if (!deleting && text === current) {
      const timer = window.setTimeout(() => setDeleting(true), holdMs);
      return () => window.clearTimeout(timer);
    }

    // Advance to the next phrase on a timer rather than synchronously in the
    // effect body (avoids a cascading render).
    if (deleting && text === "") {
      const timer = window.setTimeout(() => {
        setDeleting(false);
        setIndex((value) => (value + 1) % phrases.length);
      }, deleteSpeed);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(
      () => {
        setText((value) => (deleting ? current.slice(0, value.length - 1) : current.slice(0, value.length + 1)));
      },
      deleting ? deleteSpeed : typeSpeed,
    );
    return () => window.clearTimeout(timer);
  }, [text, deleting, index, phrases, reduced, typeSpeed, deleteSpeed, holdMs]);

  const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a), "");

  return (
    <span className={cn("relative inline-flex items-baseline", className)}>
      <span className="sr-only">{phrases.join(", ")}</span>
      {/* Invisible longest phrase reserves the width — no reflow while typing */}
      <span aria-hidden className="invisible whitespace-pre">{longest}</span>
      <span aria-hidden className="absolute inset-0 flex items-baseline">
        <span className="whitespace-pre">{reduced ? phrases[0] : text}</span>
        {!reduced && (
          <span className="ml-0.5 inline-block h-[0.95em] w-[2px] translate-y-[0.08em] animate-pulse bg-current" />
        )}
      </span>
    </span>
  );
}
