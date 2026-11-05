"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion system.
 *
 * One easing curve and three durations keep every animation feeling like part
 * of the same product. Animations only ever touch `transform` and `opacity`,
 * which stay on the compositor and avoid layout shift.
 */

/** Primary ease — a soft, confident deceleration. */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** Secondary ease for exits and small UI responses. */
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  /** Button/link feedback. */
  micro: 0.16,
  /** Hover and small state changes. */
  fast: 0.22,
  /** Standard reveal. */
  base: 0.5,
  /** Larger sectional transition. */
  slow: 0.75,
  /** Scroll-led storytelling (used sparingly). */
  story: 1.1,
} as const;

/** Shared IntersectionObserver margin for reveals. */
export const REVEAL_MARGIN = "-80px";

export const transition = (duration: number = DURATION.base, delay = 0): Transition => ({
  duration,
  delay,
  ease: EASE,
});

/** Fade + rise, used for almost every scroll reveal. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: transition(DURATION.base) },
};

/** Parent that staggers its children. */
export const staggerParent = (stagger = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Word-by-word headline reveal. */
export const wordParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

export const wordChild: Variants = {
  hidden: { opacity: 0, y: "0.5em" },
  show: { opacity: 1, y: 0, transition: transition(DURATION.base) },
};

/**
 * Media-query hook backed by useSyncExternalStore.
 *
 * The server snapshot is always `false`, and the first client render uses the
 * same snapshot, so markup is identical during hydration. The real value is
 * read immediately afterwards — no hydration mismatch (React #418).
 */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True when the visitor asked the OS for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * True only for fine-pointer devices wide enough for hover effects, so
 * tilt/magnetic behaviour never runs on touch devices.
 */
export function usePointerFine(minWidth = 1024): boolean {
  return useMediaQuery(`(hover: hover) and (pointer: fine) and (min-width: ${minWidth}px)`);
}
