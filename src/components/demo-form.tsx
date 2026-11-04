"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, CheckCircle2, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { collectionBands, services, site, specialties } from "@/lib/site";
import { useToast } from "./motion/toast";
import { cn } from "./ui";

const steps = ["About you", "Your facility", "What you need"];

const facilityTypes = ["Private practice", "Hospital", "Healthcare system", "Emergency room / free-standing ER", "Urgent care", "Billing company / other"];
const providerCounts = ["Solo provider", "2–5 providers", "6–15 providers", "16–50 providers", "50+ providers"];

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3.5 py-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function DemoForm({ source = "schedule-form" }: { source?: string }) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    practice: "",
    specialty: "",
    practiceSize: "",
    monthlyCollections: "",
    message: "",
    interests: [] as string[],
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function validateStep() {
    const next: Record<string, string> = {};
    if (step === 0) {
      if (form.name.trim().length < 2) next.name = "Please share your name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) next.email = "A valid email is required.";
    }
    if (step === 1) {
      if (!form.practice.trim()) next.practice = "Your practice or facility name helps us prepare.";
      if (!form.practiceSize) next.practiceSize = "Choose a facility type.";
      if (!form.specialty) next.specialty = "Choose your specialty.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep()) return;
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    setStatus("loading");
    setError("");

    const payload = { ...form, source };

    try {
      // 1. Save to the embedded SQLite database — this is the source of truth.
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = (await response.json().catch(() => null)) as { ok?: boolean; id?: number; error?: string } | null;

      if (!response.ok || !saved?.ok) {
        // Local SQLite may be unavailable on read-only hosting. Fall back to the
        // Postgres-backed enquiry pipeline so the lead is never lost, and only
        // surface an error if both routes fail.
        const backup = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => null);
        if (!backup?.ok) throw new Error(saved?.error ?? "We could not save your request. Please try again or call (812) 994-0046.");
      }

      // 2. Email delivery (owner notification + visitor confirmation) is queued
      //    server-side by POST /api/submissions through Resend. The browser
      //    never touches an email provider or an API credential.

      // 3. Existing CRM mirror (Postgres). Best effort — the server skips its
      //    own email for this enquiry because /api/submissions already sent it.
      void fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => undefined);

      setStatus("done");
      toast({ tone: "success", title: "Request received", description: "We will be in touch during business hours to arrange your consultation." });
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      toast({ tone: "error", title: "Could not submit", description: "Please try again, or call (812) 994-0046." });
    }
  }

  if (status === "done") {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-mint-200 bg-surface p-7 shadow-soft sm:p-9">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-mint-50" />
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-mint-500 text-white">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} />
        </span>
        <h2 className="relative mt-5 text-2xl font-extrabold tracking-tight text-ink-950">Your consultation request is in.</h2>
        <p className="relative mt-2 text-[0.92rem] leading-relaxed text-ink-600/80">
          Thank you, {form.name.split(" ")[0] || "there"}. A member of our team will contact you to schedule your consultation and review your current billing process. There is no prepayment and no obligation.
        </p>
        <div className="relative mt-6 space-y-3">
          {[
            "We review your workflow, payers and software",
            "We identify where revenue is leaking",
            "We build a dedicated team around your facility",
          ].map((item, index) => (
            <div key={item} className="flex items-start gap-3 rounded-xl border border-mist-200 bg-mist-50/60 p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[0.65rem] font-extrabold text-brand-700">{index + 1}</span>
              <p className="text-[0.82rem] font-semibold text-ink-800">{item}</p>
            </div>
          ))}
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <a href={site.phoneHref} className="btn btn-primary">
            <Phone className="h-4 w-4" /> Call {site.phone}
          </a>
          <Link href="/services" className="btn btn-light">
            Explore services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative overflow-hidden rounded-3xl border border-mist-200 bg-surface p-6 shadow-soft sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-brand-700">Free consultation</p>
          <p className="mt-1 text-[1.05rem] font-extrabold tracking-tight text-ink-950">Step {step + 1} of {steps.length} · {steps[step]}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700">
          <CalendarCheck className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 flex gap-1.5">
        {steps.map((label, index) => (
          <div key={label} className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist-100">
            <motion.div animate={{ width: index <= step ? "100%" : "0%" }} transition={{ duration: 0.4 }} className="h-full rounded-full bg-gradient-to-r from-brand-500 to-mint-500" />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="mt-6 space-y-4">
          {step === 0 && (
            <>
              <label className="block">
                <span className="text-[0.78rem] font-bold text-ink-800">Full name *</span>
                <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Dr. Jordan Ellis" className={cn(fieldClass, errors.name && "border-rose-300")} autoComplete="name" />
                {errors.name && <span className="mt-1 block text-[0.7rem] font-semibold text-rose-500">{errors.name}</span>}
              </label>
              <label className="block">
                <span className="text-[0.78rem] font-bold text-ink-800">Email *</span>
                <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@practice.com" className={cn(fieldClass, errors.email && "border-rose-300")} autoComplete="email" />
                {errors.email && <span className="mt-1 block text-[0.7rem] font-semibold text-rose-500">{errors.email}</span>}
              </label>
              <label className="block">
                <span className="text-[0.78rem] font-bold text-ink-800">Phone number</span>
                <input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(812) 994-0046" className={fieldClass} autoComplete="tel" />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <label className="block">
                <span className="text-[0.78rem] font-bold text-ink-800">Practice / facility name *</span>
                <input value={form.practice} onChange={(event) => update("practice", event.target.value)} placeholder="Northside Family Practice" className={cn(fieldClass, errors.practice && "border-rose-300")} autoComplete="organization" />
                {errors.practice && <span className="mt-1 block text-[0.7rem] font-semibold text-rose-500">{errors.practice}</span>}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[0.78rem] font-bold text-ink-800">Facility type *</span>
                  <select value={form.practiceSize} onChange={(event) => update("practiceSize", event.target.value)} className={cn(fieldClass, errors.practiceSize && "border-rose-300")}>
                    <option value="">Select type</option>
                    {facilityTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {errors.practiceSize && <span className="mt-1 block text-[0.7rem] font-semibold text-rose-500">{errors.practiceSize}</span>}
                </label>
                <label className="block">
                  <span className="text-[0.78rem] font-bold text-ink-800">Providers</span>
                  <select value={form.monthlyCollections} onChange={(event) => update("monthlyCollections", event.target.value)} className={fieldClass}>
                    <option value="">Select count</option>
                    {providerCounts.map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-[0.78rem] font-bold text-ink-800">Specialty *</span>
                <select value={form.specialty} onChange={(event) => update("specialty", event.target.value)} className={cn(fieldClass, errors.specialty && "border-rose-300")}>
                  <option value="">Select specialty</option>
                  {specialties.map((specialty) => (
                    <option key={specialty.slug} value={specialty.name}>{specialty.name}</option>
                  ))}
                  <option value="Multi-specialty">Multi-specialty group</option>
                  <option value="Other">Other</option>
                </select>
                {errors.specialty && <span className="mt-1 block text-[0.7rem] font-semibold text-rose-500">{errors.specialty}</span>}
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <span className="text-[0.78rem] font-bold text-ink-800">What do you need help with?</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {services.slice(0, 6).map((service) => {
                    const checked = form.interests.includes(service.short);
                    return (
                      <button
                        key={service.slug}
                        type="button"
                        onClick={() => update("interests", checked ? form.interests.filter((item) => item !== service.short) : [...form.interests, service.short])}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[0.76rem] font-semibold transition-colors",
                          checked ? "border-brand-400 bg-brand-50 text-brand-700" : "border-mist-200 text-ink-700 hover:border-brand-200",
                        )}
                      >
                        <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border", checked ? "border-brand-500 bg-brand-500 text-white" : "border-mist-300")}>
                          {checked && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                        </span>
                        {service.short}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="text-[0.78rem] font-bold text-ink-800">Roughly monthly collections</span>
                <select value={form.message ? form.message : ""} onChange={(event) => update("message", event.target.value)} className={fieldClass} aria-label="Monthly collections">
                  <option value="">Select a range (optional)</option>
                  {collectionBands.map((band) => (
                    <option key={band} value={`Monthly collections: ${band}`}>{band}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[0.78rem] font-bold text-ink-800">Anything else we should know?</span>
                <textarea rows={3} value={form.message} onChange={(event) => update("message", event.target.value)} placeholder="Current billing software, biggest billing frustration, timeline…" className={fieldClass} />
              </label>
              <p className="text-[0.68rem] leading-relaxed text-ink-600/80">By submitting you agree to be contacted about your consultation. We never sell your information, and HIPAA handling applies to any data shared.</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {status === "error" && <p role="alert" aria-live="assertive" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-[0.75rem] font-semibold text-rose-700">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep((value) => value - 1)} className="btn btn-light px-4 py-3 text-[0.82rem]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}
        <button type="submit" disabled={status === "loading"} className="btn btn-primary flex-1 px-4 py-3.5 text-[0.85rem] disabled:opacity-70">
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : step === steps.length - 1 ? (
            <>
              Request my consultation <CalendarCheck className="h-4 w-4" />
            </>
          ) : (
            <>
              Continue <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
