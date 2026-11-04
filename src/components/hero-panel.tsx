"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, Check, Clock3, FileCheck2, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { DURATION, EASE, usePrefersReducedMotion } from "@/lib/motion";

/**
 * Live "revenue cycle" panel that replaces the hero photograph.
 *
 * It animates on its own — claims advance through four stages, then the totals
 * update — so visitors see the product idea rather than a stock photo. Values
 * are illustrative and labelled as such; they are not client results.
 */
const stages = [
  { id: "eligibility", label: "Eligibility verified", icon: ShieldCheck },
  { id: "coded", label: "Coded & reviewed", icon: FileCheck2 },
  { id: "filed", label: "Filed to payer", icon: Clock3 },
  { id: "posted", label: "Payment posted", icon: TrendingUp },
] as const;

export function HeroPanel() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setActive((value) => {
        if (value === stages.length - 1) {
          setCycle((count) => count + 1);
          return 0;
        }
        return value + 1;
      });
    }, 1700);
    return () => window.clearInterval(timer);
  }, [reduced]);

  const current = stages[active];

  return (
    <div className="glass relative overflow-hidden rounded-[1.75rem] border border-white/60 p-5 shadow-[0_40px_80px_-50px_rgba(4,20,31,0.5)] sm:p-6">
      <div aria-hidden className="animated-gradient pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-brand-700">Live claim flow</p>
          <p className="mt-1 text-[1.02rem] font-extrabold leading-tight tracking-tight text-ink-950">From visit to payment</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-mint-200 bg-mint-50 px-2.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-mint-700">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-600" />
          </span>
          Running
        </span>
      </div>

      {/* Stage progress rail */}
      <div className="relative mt-5">
        <span aria-hidden className="absolute left-[1.05rem] top-3 bottom-3 w-px bg-mist-200" />
        <span aria-hidden className="absolute left-[1.05rem] top-3 bottom-3 w-px bg-gradient-to-b from-brand-500 to-mint-500 transition-all duration-500" style={{ clipPath: `inset(0 0 ${100 - ((active + 1) / stages.length) * 100}% 0)` }} />
        <ol className="relative space-y-2.5">
          {stages.map((stage, index) => {
            const done = index < active;
            const isActive = index === active;
            return (
              <li key={stage.id} className="flex items-center gap-3">
                <span
                  className={`relative z-10 grid h-[1.35rem] w-[1.35rem] shrink-0 place-items-center rounded-full border-2 transition-all duration-300 ${
                    done
                      ? "border-mint-500 bg-mint-500 text-white"
                      : isActive
                        ? "border-brand-500 bg-surface text-brand-700"
                        : "border-mist-200 bg-surface text-ink-600/60"
                  }`}
                  aria-hidden
                >
                  {done ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <stage.icon className="h-2.5 w-2.5" />}
                </span>
                <span className={`flex-1 text-[0.8rem] font-bold transition-colors ${isActive ? "text-ink-950" : done ? "text-ink-700" : "text-ink-600/70"}`}>
                  {stage.label}
                </span>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      initial={reduced ? false : { opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: DURATION.fast, ease: EASE }}
                      className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.54rem] font-extrabold uppercase tracking-[0.08em] text-brand-700"
                    >
                      Now
                    </motion.span>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Illustrative metrics */}
      <div className="relative mt-5 grid grid-cols-3 gap-2">
        {[
          { label: "Filed in", value: "24h" },
          { label: "Clean claims", value: "99.9%" },
          { label: "Cycles run", value: String(1200 + cycle).replace(/\B(?=(\d{3})+(?!\d))/g, ",") },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-mist-200 bg-surface/70 p-2.5">
            <p className="text-[0.92rem] font-extrabold leading-none tracking-tight text-ink-950">{metric.value}</p>
            <p className="mt-1 text-[0.54rem] font-bold uppercase tracking-[0.08em] text-ink-600/80">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-3 flex items-center gap-2 rounded-xl bg-night/95 px-3 py-2.5">
        <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden />
        <p className="text-[0.66rem] font-semibold leading-snug text-white/70">
          Every stage has an owner. <span className="text-white">Nothing sits unworked.</span>
        </p>
      </div>

      <p className="relative mt-2.5 text-[0.58rem] leading-relaxed text-ink-600/70">
        Illustrative workflow · figures reflect our stated service standards, not client results.
      </p>
    </div>
  );
}
