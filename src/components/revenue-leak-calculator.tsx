"use client";

import { ArrowRight, Calculator, Info, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

export function RevenueLeakCalculator() {
  const [charges, setCharges] = useState(300000);
  const [collections, setCollections] = useState(270000);
  const [ar, setAr] = useState(180000);
  const [ar90, setAr90] = useState(42000);
  const [denialRate, setDenialRate] = useState(10);
  const [providers, setProviders] = useState(3);
  const [billingCost, setBillingCost] = useState(18000);

  const result = useMemo(() => {
    const collectionRate = charges > 0 ? (collections / charges) * 100 : 0;
    const ar90Share = ar > 0 ? (ar90 / ar) * 100 : 0;
    const denialExposure = collections * (denialRate / 100);
    const netCollections = collections - billingCost;
    const indicators: string[] = [];
    if (collectionRate < 95) indicators.push("Collection rate is below 95% of charges — review charge capture, contractual adjustments and unposted payments.");
    if (ar90Share > 25) indicators.push("More than a quarter of A/R is over 90 days — prioritize collectability and timely-filing exposure.");
    if (denialRate > 8) indicators.push("Denial rate is above 8% — review denial reasons by payer and the upstream cause.");
    if (billingCost > collections * 0.08) indicators.push("Billing cost is high relative to collections — compare scope, volume and contract structure.");
    if (providers > 0 && ar / providers > 50000) indicators.push("A/R per provider is above $50,000 — inspect aged balances and follow-up ownership.");
    if (!indicators.length) indicators.push("No single indicator stands out. Use the numbers as a starting point for a payer-level review; one month does not prove a trend.");
    return { collectionRate, ar90Share, denialExposure, netCollections, indicators };
  }, [charges, collections, ar, ar90, denialRate, providers, billingCost]);

  const fields = [
    { label: "Monthly charges", value: charges, set: setCharges, min: 0, step: 5000 },
    { label: "Monthly collections", value: collections, set: setCollections, min: 0, step: 5000 },
    { label: "Total A/R", value: ar, set: setAr, min: 0, step: 5000 },
    { label: "A/R over 90 days", value: ar90, set: setAr90, min: 0, step: 1000 },
    { label: "Denial rate (%)", value: denialRate, set: setDenialRate, min: 0, step: 1 },
    { label: "Number of providers", value: providers, set: setProviders, min: 1, step: 1 },
    { label: "Monthly billing cost", value: billingCost, set: setBillingCost, min: 0, step: 1000 },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
      <div className="rounded-3xl border border-mist-200 bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-2 border-b border-mist-200 pb-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Calculator className="h-4 w-4" /></span>
          <div>
            <p className="text-[0.82rem] font-extrabold text-ink-950">Your practice numbers</p>
            <p className="text-[0.7rem] text-ink-600/75">Use a recent month. Estimates only — no data is submitted.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.label} className="block">
              <span className="text-[0.75rem] font-bold text-ink-800">{field.label}</span>
              <input
                type="number"
                min={field.min}
                step={field.step}
                value={field.value}
                onChange={(event) => field.set(Math.max(field.min, Number(event.target.value) || 0))}
                className="mt-1.5 w-full rounded-xl border border-mist-200 bg-mist-50 px-3 py-2.5 text-[0.82rem] font-semibold text-ink-900 outline-none focus:border-brand-400"
              />
            </label>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-mist-200 bg-mist-50 p-3 text-[0.7rem] leading-relaxed text-ink-600/75">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          This tool does not collect personal or protected health information and does not send your numbers anywhere.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Collection rate", value: `${result.collectionRate.toFixed(1)}%`, note: "Collections ÷ charges" },
            { label: "A/R over 90 days", value: `${result.ar90Share.toFixed(1)}%`, note: "90+ A/R ÷ total A/R" },
            { label: "Denial exposure indicator", value: money(result.denialExposure), note: "Collections × denial rate — not a calculated loss" },
            { label: "Net after billing cost", value: money(result.netCollections), note: "Collections − entered billing cost" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-mist-200 bg-surface p-4">
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70">{item.label}</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-ink-950">{item.value}</p>
              <p className="mt-1 text-[0.67rem] leading-relaxed text-ink-600/70">{item.note}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-mint-50 p-5">
          <p className="flex items-center gap-2 text-[0.82rem] font-extrabold text-ink-950"><TrendingUp className="h-4 w-4 text-brand-700" /> Areas worth investigating</p>
          <ul className="mt-3 space-y-2">
            {result.indicators.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[0.77rem] leading-relaxed text-ink-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.68rem] leading-relaxed text-ink-600/70">
            These are indicators, not a promise of recoverable revenue. Actual results depend on specialty, payer mix, claim volume, documentation, contracts and the current state of the revenue cycle.
          </p>
          <Link href="/schedule-form" className="btn btn-primary mt-4 w-full">Review the indicators with our team <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </div>
  );
}
