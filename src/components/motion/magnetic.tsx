"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { ReactNode } from "react";
import { usePointerFine, usePrefersReducedMotion } from "@/lib/motion";

/**
 * Magnetic hover: the element drifts a few pixels toward the pointer.
 * Only active on fine-pointer desktops and never under reduced-motion, so
 * touch users get the plain, predictable target.
 */
export function Magnetic({ children, strength = 8 }: { children: ReactNode; strength?: number }) {
  const fine = usePointerFine(1024);
  const reduced = usePrefersReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 22, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 260, damping: 22, mass: 0.35 });
  const rotate = useTransform(springX, [-strength, strength], [-1.2, 1.2]);

  const active = fine && !reduced;

  return (
    <motion.div
      className="inline-block"
      style={active ? { x: springX, y: springY, rotate } : undefined}
      onPointerMove={(event) => {
        if (!active) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
        const offsetY = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
        x.set(offsetX * strength);
        y.set(offsetY * strength);
      }}
      onPointerLeave={() => {
        if (!active) return;
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
