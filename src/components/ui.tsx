"use client";

import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, ChevronDown, Minus, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export { cn };

const easing = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-70px" }}
      transition={{ duration: 0.65, delay, ease: easing }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
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

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easing } } }}
    >
      {children}
    </motion.div>
  );
}

export function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 55, damping: 18 });
  const display = useTransform(spring, (latest) =>
    `${prefix}${latest.toFixed(decimals)}${suffix}`,
  );

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, motionValue, value]);

  return (
    <span ref={ref} className={className}>
      <motion.span>{display}</motion.span>
    </span>
  );
}

export function StarRow({ rating = 5 }: { rating?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn("h-4 w-4", index < rating ? "fill-gold-400 text-gold-400" : "text-mist-300")}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export function ArrowLink({
  href,
  children,
  className,
  tone = "brand",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  tone?: "brand" | "light";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-bold tracking-tight transition-colors",
        tone === "brand" ? "text-brand-700 hover:text-brand-500" : "text-white/85 hover:text-white",
        className,
      )}
    >
      {children}
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full border transition-all duration-300 group-hover:translate-x-1",
          tone === "brand" ? "border-brand-200 bg-brand-50 text-brand-700" : "border-white/25 bg-white/10 text-white",
        )}
      >
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
    </Link>
  );
}

export function SectionLabel({
  children,
  tone = "dark",
  className,
}: {
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "eyebrow",
        tone === "dark" ? "text-brand-700" : "text-brand-200",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone === "dark" ? "bg-brand-500" : "bg-brand-300")} />
      {children}
    </span>
  );
}

export function Accordion({
  items,
  className,
  defaultOpen = 0,
}: {
  items: { q: string; a: string }[];
  className?: string;
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className={cn("divide-y divide-mist-200 border-y border-mist-200", className)}>
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : index)}
              aria-expanded={isOpen}
              className="flex w-full items-start justify-between gap-6 py-5 text-left"
            >
              <span className={cn("text-[1.0625rem] font-bold leading-snug transition-colors", isOpen ? "text-brand-700" : "text-ink-900")}>
                {item.q}
              </span>
              <span
                className={cn(
                  "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-300",
                  isOpen ? "rotate-180 border-brand-500 bg-brand-500 text-white" : "border-mist-300 text-ink-800",
                )}
              >
                {isOpen ? <Minus className="h-4 w-4" strokeWidth={2.4} /> : <Plus className="h-4 w-4" strokeWidth={2.4} />}
              </span>
            </button>
            <motion.div
              initial={false}
              animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
              transition={{ duration: 0.35, ease: easing }}
              className="overflow-hidden"
            >
              <p className="max-w-3xl pb-6 pr-10 text-[0.95rem] leading-relaxed text-ink-600/85">{item.a}</p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export function Tabs({
  tabs,
  initial = 0,
  className,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  initial?: number;
  className?: string;
}) {
  const [active, setActive] = useState(initial);
  return (
    <div className={className}>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition-colors",
              active === index ? "text-white" : "text-ink-700 hover:text-brand-700",
            )}
          >
            {active === index && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-night-soft"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tabs.map((tab, index) => (
          <div key={tab.id} hidden={active !== index}>
            {active === index && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easing }}>
                {tab.content}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const doubled = [...items, ...items];
  return (
    <div className={cn("mask-fade-x overflow-hidden", className)}>
      <div className="animate-marquee flex w-max items-center gap-10 hover:[animation-play-state:paused]">
        {doubled.map((item, index) => (
          <span key={`${item}-${index}`} className="flex items-center gap-10 whitespace-nowrap text-sm font-bold uppercase tracking-[0.16em] text-ink-600/80">
            {item}
            <span className="h-1 w-1 rounded-full bg-brand-300" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function ScrollCue({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-ink-600/75">
      <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
      {label}
    </div>
  );
}
