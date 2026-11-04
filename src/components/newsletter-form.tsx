"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";

export function NewsletterForm({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes("@")) {
      setState("error");
      setMessage("Enter a valid work email.");
      return;
    }
    setState("loading");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("failed");
      setState("done");
      setMessage("You're in. Watch for the next RCM briefing.");
      setEmail("");
    } catch {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div
        className={`flex items-center gap-2 rounded-full border p-1.5 pl-4 transition-colors ${
          tone === "dark" ? "border-white/20 bg-white/5 focus-within:border-brand-300" : "border-mist-200 bg-surface focus-within:border-brand-400"
        }`}
      >
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setState("idle");
          }}
          required
          placeholder="Work email"
          aria-label="Work email"
          className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
            tone === "dark" ? "text-white placeholder:text-white/40" : "text-ink-900 placeholder:text-ink-600/70"
          }`}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-70 ${
            state === "done" ? "bg-mint-500 text-white" : tone === "dark" ? "bg-brand-500 text-white hover:bg-brand-400" : "bg-night-soft text-white hover:bg-brand-700"
          }`}
          aria-label="Subscribe"
        >
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "done" ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs font-semibold ${state === "error" ? "text-rose-400" : tone === "dark" ? "text-mint-300" : "text-mint-700"}`}>{message}</p>
      )}
      {!message && <p className={`mt-2 text-[0.7rem] ${tone === "dark" ? "text-white/40" : "text-ink-600/80"}`}>Occasional billing insights. No spam, unsubscribe anytime.</p>}
    </form>
  );
}
