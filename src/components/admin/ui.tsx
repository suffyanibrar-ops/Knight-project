import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-mist-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-brand-700">Knight Medical Billing</p>
        <h1 className="mt-1.5 text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-ink-950 sm:text-[1.8rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.82rem] leading-relaxed text-ink-600/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string | number; hint?: ReactNode; tone?: "default" | "good" | "warn" | "brand" }) {
  const tones = {
    default: "border-mist-200 bg-surface text-ink-950",
    good: "border-mint-200 bg-mint-50/60 text-mint-700",
    warn: "border-amber-200 bg-amber-50/70 text-amber-700",
    brand: "border-brand-100 bg-brand-50/60 text-brand-800",
  } as const;
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.14em] opacity-60">{label}</p>
      <p className="mt-1.5 text-[1.7rem] font-extrabold leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-1.5 text-[0.68rem] opacity-60">{hint}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-brand-50 text-brand-700 border-brand-100",
    contacted: "bg-mint-50 text-mint-700 border-mint-200",
    quoted: "bg-amber-50 text-amber-700 border-amber-200",
    won: "bg-mint-500 text-white border-mint-500",
    closed: "bg-mist-100 text-ink-600 border-mist-200",
    sent: "bg-mint-50 text-mint-700 border-mint-200",
    queued: "bg-amber-50 text-amber-700 border-amber-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-rose-50 text-rose-600 border-rose-200",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-extrabold capitalize", map[status] ?? map.new)}>{status}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-mist-300 bg-surface p-10 text-center">
      <p className="text-sm font-extrabold text-ink-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.8rem] leading-relaxed text-ink-600/80">{description}</p>
    </div>
  );
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  // SQLite stores datetime('now') as UTC text ("YYYY-MM-DD HH:MM:SS"). A bare
  // value like that would be parsed as LOCAL time by Date, shifting the shown
  // time by the viewer's offset, so mark it explicitly as UTC first.
  const text = typeof value === "string" ? value.trim() : "";
  const normalised = typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)
    ? `${text.replace(" ", "T")}Z`
    : value;
  const date = typeof normalised === "string" ? new Date(normalised) : normalised;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
