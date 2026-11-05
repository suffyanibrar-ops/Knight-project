"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/motion/toast";
import { trackConversion } from "@/lib/tracking";
import { cn } from "./ui";

const topics = ["Medical billing & coding", "Accounts receivable", "Credentialing & contracting", "Out-of-network negotiation", "Eligibility & benefits", "Complete RCM services", "Patient billing", "Other"];

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3.5 py-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: topics[0], message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const { toast } = useToast();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      // 1. Save to the embedded SQLite database first — source of truth.
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, specialty: form.topic, source: "contact-form" }),
      });
      const saved = (await response.json().catch(() => null)) as { ok?: boolean; id?: number; error?: string } | null;

      if (!response.ok || !saved?.ok) {
        const backup = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }).catch(() => null);
        if (!backup?.ok) throw new Error(saved?.error ?? "We could not save your message. Please try again or email admin@knightmedicalbilling.com.");
      }

      // 2. Email delivery (owner notification + visitor confirmation) is queued
      //    server-side by POST /api/submissions through Resend. The browser
      //    never touches an email provider or an API credential.

      // 3. Existing contact mirror (Postgres). Best effort — the server skips
      //    its own email for this message because /api/submissions already sent it.
      void fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).catch(() => undefined);

      setStatus("done");
      trackConversion("generate_lead", { form: "contact" });
      toast({ tone: "success", title: "Message sent", description: "Our team replies within one business hour, Monday–Friday." });
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      toast({ tone: "error", title: "Message not sent", description: "Please try again, or call (812) 994-0046." });
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-3xl border border-mint-200 bg-surface p-7 shadow-soft sm:p-8">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mint-500 text-white">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} />
        </span>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink-950">Message received.</h2>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-600/80">
          Thanks {form.name.split(" ")[0] || "there"} — your message is with our team. We reply within one business hour, Monday through Friday, 8am–8pm ET.
        </p>
        <button type="button" onClick={() => setStatus("idle")} className="btn btn-light mt-5">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-mist-200 bg-surface p-6 shadow-soft sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[0.78rem] font-bold text-ink-800">Full name *</span>
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Jordan Ellis" className={fieldClass} autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-[0.78rem] font-bold text-ink-800">Work email *</span>
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="jordan@practice.com" className={fieldClass} autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-[0.78rem] font-bold text-ink-800">Phone</span>
          <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(555) 000-0000" className={fieldClass} autoComplete="tel" />
        </label>
        <label className="block">
          <span className="text-[0.78rem] font-bold text-ink-800">What is this about?</span>
          <select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} className={fieldClass}>
            {topics.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-[0.78rem] font-bold text-ink-800">How can we help? *</span>
        <textarea required rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Tell us about your facility — specialty, current billing software and what you would like to improve." className={fieldClass} />
      </label>
      {status === "error" && <p role="alert" aria-live="assertive" className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-[0.75rem] font-semibold text-rose-700">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={status === "loading"} className={cn("btn btn-primary px-6 py-3.5", status === "loading" && "opacity-70")}>
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {status === "loading" ? "Sending…" : "Send message"}
        </button>
        <p className="text-[0.7rem] text-ink-600/80">We never share your information. HIPAA safeguards apply.</p>
      </div>
    </form>
  );
}
