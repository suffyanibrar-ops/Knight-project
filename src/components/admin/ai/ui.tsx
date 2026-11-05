import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AiStat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "good" | "warn" | "brand" }) {
  return (
    <div className={cn("rounded-2xl border bg-surface p-4", tone === "warn" ? "border-amber-200" : tone === "brand" ? "border-brand-200" : "border-mist-200")}>
      <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70">{label}</p>
      <p className={cn("mt-1.5 text-[1.5rem] font-extrabold leading-none tracking-tight", tone === "warn" ? "text-amber-700" : tone === "good" ? "text-mint-700" : "text-ink-950")}>{value}</p>
      {hint && <p className="mt-1.5 text-[0.66rem] text-ink-600/70">{hint}</p>}
    </div>
  );
}

export function AiPanel({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-extrabold tracking-tight text-ink-950">{title}</h2>
          {description && <p className="mt-0.5 text-[0.72rem] leading-relaxed text-ink-600/70">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AiBadge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "warn" | "bad" | "brand" }) {
  const styles = {
    default: "border-mist-200 bg-mist-50 text-ink-700",
    good: "border-mint-200 bg-mint-50 text-mint-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    brand: "border-brand-200 bg-brand-50 text-brand-700",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.06em]", styles)}>{children}</span>;
}

export function AiDate({ value }: { value: number | string | Date | null }) {
  if (!value) return <span className="text-ink-600/50">—</span>;
  const date = typeof value === "number" ? new Date(value) : typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return <span className="text-ink-600/50">—</span>;
  return <span>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}</span>;
}

export const adminInput = "mt-1 w-full rounded-xl border border-mist-200 bg-surface px-3 py-2 text-[0.8rem] text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
export const adminLabel = "text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70";
export const adminButton = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-night-soft px-3.5 py-2 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-40";
export const adminButtonLight = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-mist-200 bg-surface px-3.5 py-2 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300";
