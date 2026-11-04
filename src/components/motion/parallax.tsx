"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Gentle vertical parallax for decorative background imagery.
 * The image is oversized inside a clipped container so the movement never
 * causes overflow, and the effect is disabled under reduced-motion.
 */
export function ParallaxImage({
  src,
  alt = "",
  className,
  distance = 40,
  sizes = "100vw",
}: {
  src: string;
  alt?: string;
  className?: string;
  distance?: number;
  sizes?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const raw = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  const y = useSpring(raw, { stiffness: 90, damping: 24, mass: 0.4 });

  return (
    <div ref={ref} className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <motion.div style={reduced ? undefined : { y }} className="absolute -inset-y-16 inset-x-0">
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      </motion.div>
    </div>
  );
}
