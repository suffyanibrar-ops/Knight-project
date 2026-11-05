"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Restrained count-up for existing, verified metrics.
 *
 * The final value is present in the initial markup (crawlable and useful without
 * JavaScript). The count runs once when the value enters the viewport, and is
 * skipped entirely for reduced-motion visitors.
 */
export function AnimatedMetric({ value, className }: { value: string; className?: string }) {
  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(value);
  const target = match ? Number(match[1]) : null;
  const suffix = match?.[2] ?? "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const [display, setDisplay] = useState(value);
  const startedRef = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (target === null || reduced || startedRef.current) return;
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    let start = 0;

    const step = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(`${(target * eased).toFixed(decimals)}${suffix}`);
      if (progress < 1) frame = requestAnimationFrame(step);
      else setDisplay(value);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        startedRef.current = true;
        setDisplay(`${(0).toFixed(decimals)}${suffix}`);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4, rootMargin: "-40px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [decimals, reduced, suffix, target, value]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)} aria-label={value}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
