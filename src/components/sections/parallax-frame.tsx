"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A rounded image frame with a gentle scroll parallax and a scroll reveal.
 *
 * The parallax is purely decorative: the image is oversized inside a clipped
 * frame so it can never cause overflow or layout shift, and both the movement
 * and the reveal are switched off for visitors who prefer reduced motion.
 */
export function ParallaxFrame({
  src,
  alt,
  className,
  aspect = "aspect-[4/3]",
  distance = 24,
  sizes = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px",
  caption,
  priority = false,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  aspect?: string;
  distance?: number;
  sizes?: string;
  caption?: ReactNode;
  priority?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const raw = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
  const y = useSpring(raw, { stiffness: 90, damping: 24, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn("relative overflow-hidden rounded-3xl border border-mist-200 bg-night shadow-[0_36px_70px_-45px_rgba(4,20,31,0.55)]", aspect, className)}
    >
      <div className="absolute inset-0">
        <motion.div style={reduced ? undefined : { y }} className="absolute -inset-y-10 inset-x-0">
          <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
        </motion.div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
      <div aria-hidden className="animated-gradient pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-2xl" />
      {caption ? (
        <p className="absolute inset-x-5 bottom-4 max-w-md text-[0.95rem] font-extrabold leading-snug text-white sm:text-[1.02rem]">{caption}</p>
      ) : null}
      {children}
    </motion.div>
  );
}
