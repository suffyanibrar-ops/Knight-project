"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { DURATION, EASE, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui";

/**
 * Interactive revenue-leak diagnostic.
 *
 * Each stage is a real point in the revenue cycle. Selecting a stage explains
 * the typical failure mode and the corresponding Knight service — qualitative
 * language only, never invented financial claims or benchmarks.
 */
export interface RevenueStage {
  id: string;
  label: string;
  short: string;
  leak: string;
  impact: string;
  fix: string;
  service: string;
  serviceHref: string;
}

export const REVENUE_STAGES: RevenueStage[] = [
  {
    id: "eligibility", label: "Eligibility", short: "Coverage checked before care",
    leak: "Coverage or benefits are confirmed late — sometimes after the visit has already happened.",
    impact: "A claim can be denied for coverage or authorization reasons, and the patient can receive an unexpected balance.",
    fix: "We verify eligibility and benefits before the visit, document what was confirmed and flag authorization requirements early.",
    service: "Eligibility & benefits verification", serviceHref: "/services/eligibility-and-benefits-verification",
  },
  {
    id: "coding", label: "Coding", short: "Documentation becomes a claim",
    leak: "Codes, modifiers or supporting documentation do not fully match the encounter.",
    impact: "The payer may reject the claim or pay a different amount, creating rework before revenue can post.",
    fix: "Certified coders review documentation, apply the right modifiers and look for preventable errors before submission.",
    service: "Medical billing & coding", serviceHref: "/services/medical-billing-and-coding",
  },
  {
    id: "charge-capture", label: "Charge capture", short: "Every service is recorded",
    leak: "Charges are entered late, missed or disconnected from the correct encounter.",
    impact: "Services that were delivered may never be billed, or may fall outside timely-filing limits.",
    fix: "We reconcile encounters and charges, work the exception list and keep the path from visit to claim complete.",
    service: "Billing clean-up", serviceHref: "/services/clean-up-billing",
  },
  {
    id: "submission", label: "Submission", short: "Clean claims reach the payer",
    leak: "Claims sit in a queue, carry correctable errors or miss the payer's filing window.",
    impact: "Delayed submission ages the claim before it has a chance to pay and adds avoidable denial work.",
    fix: "Claims are scrubbed, corrected and filed within our stated 24-hour window, with submission status tracked.",
    service: "Claims management", serviceHref: "/services/claims-management",
  },
  {
    id: "denials", label: "Denials", short: "Root causes get resolved",
    leak: "Denials are logged but never owned, or appealed without fixing the upstream cause.",
    impact: "The same denial reasons recur, and collectible revenue expires while the backlog rebuilds.",
    fix: "We work denials inside payer deadlines, correct the cause and feed the pattern back to coding and front-end teams.",
    service: "Denial management", serviceHref: "/services/denial-management",
  },
  {
    id: "ar", label: "A/R follow-up", short: "Aging balances get worked",
    leak: "Receivables age without a segmented worklist, clear ownership or timely-filing tracking.",
    impact: "Collectible balances become write-offs simply because nobody reached them in time.",
    fix: "We segment A/R by payer, age and filing deadline, then work the highest-value, most collectible accounts first.",
    service: "Accounts receivable management", serviceHref: "/services/accounts-receivable-management",
  },
  {
    id: "patient", label: "Patient billing", short: "Balances are communicated clearly",
    leak: "Patient responsibility is unclear, statements are delayed or questions have nowhere to go.",
    impact: "Patient balances age quietly and the front office absorbs avoidable calls and confusion.",
    fix: "Statements, payment posting and patient questions are handled by a team that can explain the balance.",
    service: "Patient billing", serviceHref: "/services/complete-patient-billing",
  },
  {
    id: "posting", label: "Payment posting", short: "Payments match contracted rates",
    leak: "Payments post without a contracted-rate check, so underpayments are adjusted away.",
    impact: "The claim looks closed, but the practice may have been paid less than the agreement allows.",
    fix: "ERAs are posted and reconciled, variances are flagged and underpayments become follow-up work rather than silent leakage.",
    service: "Payment posting", serviceHref: "/services/payment-posting",
  },
];

export function RevenuePipeline() {
  const [active, setActive] = useState(0);
  const reduced = usePrefersReducedMotion();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = REVENUE_STAGES[active];
  const progress = (active / (REVENUE_STAGES.length - 1)) * 100;

  const move = (next: number) => {
    const index = (next + REVENUE_STAGES.length) % REVENUE_STAGES.length;
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  return (
    <section id="revenue-leak" className="relative overflow-hidden bg-mist-50 py-16 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute -right-32 top-0 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-[110px]" />
      <div className="shell relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <SectionLabel>Revenue leak diagnostic</SectionLabel>
            <h2 className="mt-3 text-[clamp(1.85rem,4vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink-950">
              Revenue doesn&apos;t disappear all at once. <span className="display-serif text-brand-600">It leaks stage by stage.</span>
            </h2>
            <p className="mt-3 max-w-xl text-[0.94rem] leading-relaxed text-ink-600/85">
              Select a point in the cycle to see where momentum is usually lost — and what Knight does to keep it moving.
            </p>
          </div>
          <Link href="/schedule-form" className="btn btn-light w-fit">
            Review your pipeline <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-9 overflow-hidden rounded-[2rem] border border-mist-200 bg-surface shadow-[0_30px_70px_-50px_rgba(4,20,31,0.45)]">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="min-w-0 border-b border-mist-200 p-4 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between px-1">
                <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.18em] text-ink-600/65">The cycle, in motion</p>
                <p className="text-[0.58rem] font-bold tracking-[0.08em] text-ink-600/45">{String(active + 1).padStart(2, "0")} / 08</p>
              </div>

              <div role="tablist" aria-orientation="vertical" aria-label="Revenue cycle stages" className="relative mt-3">
                <span aria-hidden className="absolute bottom-4 left-[1.35rem] top-4 w-px bg-mist-200" />
                <span aria-hidden className="absolute left-[1.35rem] top-4 w-px bg-gradient-to-b from-brand-500 to-mint-500 transition-[height] duration-500 ease-out motion-reduce:transition-none" style={{ height: progress ? `calc(${progress}% - 0.5rem)` : "0px" }} />
                <div className="space-y-0.5">
                  {REVENUE_STAGES.map((item, index) => {
                    const isActive = index === active;
                    const isDone = index < active;
                    return (
                      <button
                        key={item.id}
                        ref={(node) => { tabRefs.current[index] = node; }}
                        type="button"
                        role="tab"
                        id={`revenue-tab-${item.id}`}
                        aria-selected={isActive}
                        aria-controls="revenue-stage-panel"
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setActive(index)}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); move(active + 1); }
                          else if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); move(active - 1); }
                          else if (event.key === "Home") { event.preventDefault(); move(0); }
                          else if (event.key === "End") { event.preventDefault(); move(REVENUE_STAGES.length - 1); }
                        }}
                        className={cn(
                          "group relative z-10 flex w-full items-center gap-3 rounded-2xl px-1.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
                          isActive ? "bg-brand-50/80" : "hover:bg-mist-50",
                        )}
                      >
                        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[0.58rem] font-extrabold transition-colors", isDone ? "border-mint-500 bg-mint-500 text-white" : isActive ? "border-brand-500 bg-surface text-brand-700" : "border-mist-200 bg-surface text-ink-600/55")}>
                          {isDone ? <Check className="h-3 w-3" strokeWidth={3.5} /> : String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[0.82rem] font-extrabold leading-tight", isActive ? "text-ink-950" : "text-ink-800")}>{item.label}</span>
                          <span className="mt-0.5 block truncate text-[0.64rem] font-semibold text-ink-600/60">{item.short}</span>
                        </span>
                        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isActive ? "translate-x-0 text-brand-600" : "-translate-x-1 text-ink-600/20 group-hover:translate-x-0 group-hover:text-brand-500")} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative min-w-0 overflow-hidden bg-night p-5 text-white sm:p-8" role="tabpanel" id="revenue-stage-panel" aria-labelledby={`revenue-tab-${stage.id}`}>
              <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.08]" />
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-300/30 bg-brand-500/10 px-2.5 py-1 text-[0.56rem] font-extrabold uppercase tracking-[0.14em] text-brand-200">
                    Stage {String(active + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[0.56rem] font-bold uppercase tracking-[0.14em] text-white/35">Revenue cycle</span>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={stage.id}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: DURATION.fast, ease: EASE }}
                  >
                    <h3 className="mt-4 text-[1.55rem] font-extrabold leading-tight tracking-tight sm:text-[1.75rem]">{stage.label}</h3>
                    <p className="mt-1 text-[0.76rem] font-semibold text-brand-200/80">{stage.short}</p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                        <p className="text-[0.54rem] font-extrabold uppercase tracking-[0.16em] text-white/40">Where it leaks</p>
                        <p className="mt-2 text-[0.8rem] leading-relaxed text-white/75">{stage.leak}</p>
                        <p className="mt-2 text-[0.74rem] leading-relaxed text-white/45">{stage.impact}</p>
                      </div>
                      <div className="rounded-2xl border border-mint-300/20 bg-mint-500/[0.07] p-4">
                        <p className="text-[0.54rem] font-extrabold uppercase tracking-[0.16em] text-mint-200/70">How Knight closes it</p>
                        <p className="mt-2 text-[0.8rem] leading-relaxed text-white/80">{stage.fix}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <Link href={stage.serviceHref} className="group inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold text-brand-200 transition-colors hover:text-white">
                        Explore {stage.service} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <Link href="/schedule-form" className="text-[0.72rem] font-semibold text-white/40 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/80">
                        Talk through your pipeline
                      </Link>
                    </div>

                    <div className="mt-7 border-t border-white/10 pt-4">
                      <div aria-hidden className="flex items-center gap-1">
                        {REVENUE_STAGES.map((item, index) => (
                          <span key={item.id} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${index < active ? "bg-brand-300/45" : index === active ? "bg-brand-300" : "bg-white/10"}`} />
                        ))}
                      </div>
                      <p className="mt-2 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-white/30">
                        Stage {String(active + 1).padStart(2, "0")} of 08 · follow the same revenue through a different failure point
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="sr-only">
          {REVENUE_STAGES.map((item) => (
            <div key={item.id}>
              <h3>{item.label}</h3>
              <p>{item.leak} {item.impact}</p>
              <p>{item.fix}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
