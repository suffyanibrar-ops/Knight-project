"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import type { ReactNode } from "react";
import { usePointerFine, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Subtle 3D tilt with a soft pointer-following highlight.
 * Desktop-only, disabled for reduced-motion, and capped at a small angle so it
 * reads as polish rather than a gimmick. Content stays flat and legible.
 */
export function TiltCard({ children, className, max = 5 }: { children: ReactNode; className?: string; max?: number }) {
  const fine = usePointerFine(1280);
  const reduced = usePrefersReducedMotion();

  const rotateX = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(220px circle at ${glowX}% ${glowY}%, rgba(25,163,205,0.10), transparent 70%)`;

  const active = fine && !reduced;

  return (
    <motion.div
      className={cn("relative [transform-style:preserve-3d]", className)}
      style={active ? { rotateX, rotateY } : undefined}
      onPointerMove={(event) => {
        if (!active) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        rotateY.set((px - 0.5) * max * 2);
        rotateX.set((0.5 - py) * max * 2);
        glowX.set(px * 100);
        glowY.set(py * 100);
      }}
      onPointerLeave={() => {
        if (!active) return;
        rotateX.set(0);
        rotateY.set(0);
      }}
    >
      {active && (
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glow }} />
      )}
      {children}
    </motion.div>
  );
}
