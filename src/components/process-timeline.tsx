"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { processSteps } from "@/lib/site";
import { cn } from "./ui";

export function ProcessTimeline() {
  const [active, setActive] = useState(0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
      <ol className="relative">
        <span className="absolute left-[1.45rem] top-4 bottom-4 w-px bg-mist-200" aria-hidden />
        <motion.span
          className="absolute left-[1.45rem] top-4 w-px bg-gradient-to-b from-brand-500 to-mint-500"
          animate={{ height: `${((active + 0.55) / processSteps.length) * 100}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
        {processSteps.map((step, index) => {
          const isActive = active === index;
          return (
            <li key={step.step} className="relative pb-3 last:pb-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-expanded={isActive}
                className={cn("flex w-full items-start gap-4 rounded-2xl p-3 text-left transition-colors", isActive ? "bg-surface" : "hover:bg-white/60")}
              >
                <span
                  className={cn(
                    "relative z-10 grid h-[3rem] w-[3rem] shrink-0 place-items-center rounded-full border-2 text-sm font-extrabold transition-all duration-300",
                    isActive ? "border-brand-500 bg-brand-500 text-white shadow-[0_12px_25px_-12px_rgba(25,163,205,0.9)]" : "border-mist-200 bg-surface text-ink-600",
                  )}
                >
                  {isActive ? <Check className="h-5 w-5" strokeWidth={2.6} /> : step.step}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[1.02rem] font-extrabold tracking-tight", isActive ? "text-ink-950" : "text-ink-800")}>{step.title}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-mist-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ink-600/70">
                      <Clock className="h-2.5 w-2.5" /> {step.duration}
                    </span>
                  </span>
                  <span className={cn("mt-1.5 block text-[0.84rem] leading-relaxed text-ink-600/75 transition-all", isActive ? "opacity-100" : "opacity-70")}>{step.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative overflow-hidden rounded-3xl border border-mist-200 bg-surface p-6 shadow-[0_26px_60px_-45px_rgba(4,20,31,0.5)] sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-50" />
        <div className="relative">
          <p className="eyebrow text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Step {processSteps[active].step} of 04
          </p>
          <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-950">{processSteps[active].title}</h3>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-600/85">{processSteps[active].detail}</p>
          <ul className="mt-5 space-y-2.5">
            {processSteps[active].points.map((point, index) => (
              <motion.li key={point} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.07 }} className="flex items-start gap-2.5 text-[0.85rem] font-semibold text-ink-800">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-50 text-mint-700">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {point}
              </motion.li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-mist-100 pt-5">
            <Link href="/schedule-form" className="btn btn-primary">
              Start with step 01 <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-[0.72rem] font-semibold text-ink-600/80">Free consultation · no prepayment</span>
          </div>
        </div>
      </div>
    </div>
  );
}
