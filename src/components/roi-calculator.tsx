"use client";

import { motion } from "framer-motion";
import { trackConversion } from "@/lib/tracking";
import { ArrowRight, Check, Info, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

const sliderClass =
  "mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-mist-200 accent-brand-500 outline-none";

export function RoiCalculator({ compact = false }: { compact?: boolean }) {
  const [collections, setCollections] = useState(240000);
  const [denialRate, setDenialRate] = useState(11);
  const [daysInAr, setDaysInAr] = useState(48);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [started, setStarted] = useState(false);

  function markStarted() {
    if (started) return;
    setStarted(true);
    trackConversion("calculator_started", { form: "roi" });
  }

  const results = useMemo(() => {
    const annual = collections * 12;
    const denialRecovery = annual * (denialRate / 100) * 0.6;
    const cleanClaimGain = annual * 0.035;
    const underpaymentRecovery = annual * 0.012;
    const annualUplift = Math.round(denialRecovery + cleanClaimGain + underpaymentRecovery);
    const cashUnlocked = Math.round(collections * Math.max(daysInAr - 32, 4) / 30);
    const investment = Math.round(annual * 0.065);
    const roi = annualUplift / Math.max(investment, 1);
    return { annualUplift, cashUnlocked, investment, roi, annual };
  }, [collections, denialRate, daysInAr]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes("@")) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const response = await fetch("/api/roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          monthlyCollections: collections,
          denialRate,
          daysInAr,
          estimatedAnnualUplift: results.annualUplift,
        }),
      });
      if (!response.ok) throw new Error("failed");
      setState("done");
      trackConversion("roi_estimate", { form: "roi" });
      trackConversion("calculator_completed", { form: "roi" });
    } catch {
      setState("error");
    }
  }

  return (
    <div className={`grid gap-8 ${compact ? "" : "lg:grid-cols-[1.05fr_0.95fr] lg:gap-12"}`}>
      <div>
        <div className="space-y-6">
          <label className="block">
            <span className="flex items-center justify-between text-[0.82rem] font-bold text-ink-800">
              Monthly collections
              <span className="rounded-lg bg-mist-100 px-2 py-1 font-extrabold text-ink-950">{currency(collections)}</span>
            </span>
            <input
              type="range"
              min={20000}
              max={1500000}
              step={10000}
              value={collections}
              onChange={(event) => { markStarted(); setCollections(Number(event.target.value)); }}
              className={sliderClass}
              aria-label="Monthly collections"
            />
            <span className="mt-1.5 flex justify-between text-[0.65rem] font-semibold text-ink-600/75">
              <span>$20k</span>
              <span>$1.5M</span>
            </span>
          </label>

          <label className="block">
            <span className="flex items-center justify-between text-[0.82rem] font-bold text-ink-800">
              Current denial rate
              <span className="rounded-lg bg-mist-100 px-2 py-1 font-extrabold text-ink-950">{denialRate}%</span>
            </span>
            <input
              type="range"
              min={2}
              max={25}
              step={1}
              value={denialRate}
              onChange={(event) => { markStarted(); setDenialRate(Number(event.target.value)); }}
              className={sliderClass}
              aria-label="Current denial rate"
            />
            <span className="mt-1.5 flex justify-between text-[0.65rem] font-semibold text-ink-600/75">
              <span>2% (elite)</span>
              <span>25% (high)</span>
            </span>
          </label>

          <label className="block">
            <span className="flex items-center justify-between text-[0.82rem] font-bold text-ink-800">
              Days in A/R
              <span className="rounded-lg bg-mist-100 px-2 py-1 font-extrabold text-ink-950">{daysInAr} days</span>
            </span>
            <input
              type="range"
              min={20}
              max={90}
              step={1}
              value={daysInAr}
              onChange={(event) => { markStarted(); setDaysInAr(Number(event.target.value)); }}
              className={sliderClass}
              aria-label="Days in accounts receivable"
            />
            <span className="mt-1.5 flex justify-between text-[0.65rem] font-semibold text-ink-600/75">
              <span>20 days</span>
              <span>90 days</span>
            </span>
          </label>
        </div>

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-mist-50 p-3 text-[0.72rem] leading-relaxed text-ink-600/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          An illustrative model only, built on denial recovery, clean-claim recapture and underpayment recovery assumptions. Your free consultation replaces these with actual numbers from your revenue cycle.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-night p-6 text-white sm:p-7">
        <div className="dot-grid absolute inset-0 opacity-[0.12]" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-200">
            <Sparkles className="h-3 w-3" /> Illustrative model
          </span>

          <div className="mt-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/50">Illustrative annual opportunity</p>
            <motion.p key={results.annualUplift} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-1 text-[clamp(2rem,5vw,2.9rem)] font-extrabold leading-none tracking-tight">
              {currency(results.annualUplift)}
            </motion.p>
            <p className="mt-1.5 text-[0.72rem] text-white/50">≈ {currency(Math.round(results.annualUplift / 12))} per month, modelled — not a guarantee</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white/45">Illustrative cash unlocked</p>
              <p className="mt-1 text-xl font-extrabold">{currency(results.cashUnlocked)}</p>
              <p className="text-[0.6rem] text-white/40">based on the A/R assumption</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white/45">Illustrative return multiple</p>
              <p className="mt-1 text-xl font-extrabold text-mint-300">{results.roi.toFixed(1)}×</p>
              <p className="text-[0.6rem] text-white/40">modelled, not a guarantee</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/[0.04] p-3.5 text-[0.7rem] text-white/55">
            <span className="flex items-center justify-between">
              <span>Illustrative annual investment</span>
              <span className="font-bold text-white/80">{currency(results.investment)}</span>
            </span>
            <span className="mt-1 flex items-center justify-between">
              <span>Current annual collections</span>
              <span className="font-bold text-white/80">{currency(results.annual)}</span>
            </span>
          </div>

          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[0.64rem] leading-relaxed text-white/40">
            Illustrative only. Actual outcomes depend on specialty, payer mix, claim volume, current processes, reimbursement and other factors. This is not a guarantee of revenue or savings.
          </p>

          {state === "done" ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-mint-400/30 bg-mint-500/15 p-3.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint-300" />
              <p className="text-[0.78rem] font-semibold text-mint-100">Your estimate is saved. Our team will follow up during business hours to review your actual revenue cycle.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 p-1.5 pl-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setState("idle");
                  }}
                  placeholder="Email for the full breakdown"
                  aria-label="Work email"
                  className="min-w-0 flex-1 bg-transparent text-[0.8rem] text-white outline-none placeholder:text-white/40"
                />
                <button type="submit" disabled={state === "loading"} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-400 disabled:opacity-70" aria-label="Send my estimate">
                  {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
              {state === "error" && <p className="mt-2 text-[0.7rem] font-semibold text-rose-300">Enter a valid email and try again.</p>}
              <p className="mt-2 text-[0.62rem] text-white/35">Illustrative only. No commitment, no spam.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
