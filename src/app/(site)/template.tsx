"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE, usePrefersReducedMotion } from "@/lib/motion";

export default function Template({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
