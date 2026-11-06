import { ArrowRight, Check, Phone } from "lucide-react";
import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "./logo";

export function CtaBand({
  eyebrow = "Let's get started",
  title = "Ready for a clearer revenue cycle?",
  description = "Start with a conversation. We will review your current process, the questions that matter and where a dedicated Knight team could take responsibility. No prepayment, no hidden fees.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-night py-16 text-white sm:py-20">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_15%,rgba(124,215,242,0.22),transparent_55%),radial-gradient(90%_90%_at_10%_90%,rgba(94,194,122,0.16),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/85 to-ink-950/55" />
      </div>
      <div className="dot-grid absolute inset-0 opacity-[0.1]" />
      <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-brand-500/25 blur-[100px]" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-mint-500/15 blur-[100px]" />
      <div className="shell relative grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo variant="light" markSize={40} />
            <span className="h-6 w-px bg-white/15" />
            <span className="eyebrow text-brand-200">{eyebrow}</span>
          </div>
          <h2 className="mt-5 max-w-2xl text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.035em]">{title}</h2>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-white/65">{description}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/schedule-form" className="btn btn-accent group px-6 py-4">
              Talk With Knight <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
            </Link>
            <a href={site.phoneHref} className="btn btn-ghost-light px-6 py-4">
              <Phone className="h-4 w-4" /> {site.phone}
            </a>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem] font-semibold text-white/50">
            {["No prepayment", "No hidden fees", "Works in your software"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-mint-300" strokeWidth={3} /> {item}
              </span>
            ))}
          </div>
        </div>
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm sm:p-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-white/60">What we will review</p>
          </div>
          <ul className="mt-4 space-y-3">
            {[
              "Your current billing workflow and software",
              "Claim acceptance and denial patterns",
              "Outstanding A/R and follow-up gaps",
              "Credentialing and payer contract status",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[0.82rem] text-white/75">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-mint-500/20 text-mint-300">
                  <Check className="h-2.5 w-2.5" strokeWidth={3.4} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl bg-white/[0.05] px-3.5 py-3">
            <p className="text-[0.7rem] text-white/45">Every client receives a dedicated account manager.</p>
            <p className="mt-1 text-[0.78rem] font-bold text-white">{site.email}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
