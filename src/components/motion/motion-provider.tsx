"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Global motion policy.
 *
 * `reducedMotion="user"` tells framer-motion to drop transform/opacity
 * animations for visitors who set "reduce motion" in their OS. Content appears
 * immediately and in its final state — nothing stays hidden behind an
 * animation that never plays.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
