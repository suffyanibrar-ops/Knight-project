"use client";

import Link from "next/link";
import { Activity, ArrowRight, BadgeCheck, CheckCircle2, PenLine, Search, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/components/ui";
import type { AiTeamDashboard, TeamRoleKey } from "@/lib/ai-team";

const ROLE_ICON: Record<TeamRoleKey, typeof Search> = {
  seo: Search,
  content: PenLine,
  quality: BadgeCheck,
  growth: TrendingUp,
  operations: Activity,
};

const STATUS_TONE = {
  ready: "border-mint-200 bg-mint-50 text-mint-800",
  review: "border-brand-200 bg-brand-50 text-brand-700",
  attention: "border-amber-200 bg-amber-50 text-amber-800",
  unavailable: "border-mist-200 bg-mist-50 text-ink-600",
} as const;

export function AiTeamView({ data }: { data: AiTeamDashboard }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-brand-700"><Sparkles className="h-3 w-3" /> Today’s focus</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-200 bg-white/70 px-2.5 py-1 text-[0.6rem] font-bold text-mint-800"><CheckCircle2 className="h-3 w-3" /> You approve every article</span>
          </div>
          <div className="mt-2 divide-y divide-brand-100/70">
            {data.focus.map((item) => (
              <Link key={item.label} href={item.href} className="group flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block text-[0.78rem] font-extrabold text-ink-900 group-hover:text-brand-700">{item.label}</span>
                  <span className="mt-0.5 block text-[0.68rem] text-ink-600/70">{item.detail}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="ai-roles-title">
        <div className="mb-2 flex items-end justify-between gap-2">
          <h2 id="ai-roles-title" className="text-[0.9rem] font-extrabold tracking-tight text-ink-950">The team</h2>
          <span className="text-[0.64rem] text-ink-600/55">Live status</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data.roles.map((role) => {
            const Icon = ROLE_ICON[role.key];
            return (
              <article key={role.key} className="flex flex-col rounded-2xl border border-mist-200 bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-4 w-4" /></span>
                    <div>
                      <h3 className="text-[0.82rem] font-extrabold text-ink-950">{role.name}</h3>
                      <span className="text-[0.56rem] font-extrabold uppercase tracking-[0.12em] text-brand-600">AI teammate</span>
                    </div>
                  </div>
                  <span className={cn("rounded-full border px-2 py-1 text-[0.56rem] font-bold", STATUS_TONE[role.status])}>{role.statusLabel}</span>
                </div>
                <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-600/70">{role.job}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-mist-100 pt-2.5">
                  {role.metrics.map((metric) => <div key={metric.label}><p className="text-[0.56rem] font-bold uppercase tracking-[0.08em] text-ink-600/55">{metric.label}</p><p className="mt-0.5 text-[0.74rem] font-extrabold text-ink-900">{metric.value}</p></div>)}
                </div>
                <Link href={role.action.href} className="mt-3 inline-flex items-center gap-1 text-[0.66rem] font-bold text-brand-700 hover:underline">{role.action.label} <ArrowRight className="h-3 w-3" /></Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[0.9rem] font-extrabold tracking-tight text-ink-950">Recent teamwork</h2>
          <span className="text-[0.62rem] text-ink-600/55">{data.activity.length ? "Latest activity" : "Nothing yet"}</span>
        </div>
        {data.activity.length === 0 ? (
          <p className="mt-2 text-[0.72rem] leading-relaxed text-ink-600/65">No activity yet. Once the team runs research, audits or content work, it will appear here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-mist-100">
            {data.activity.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="truncate text-[0.72rem] font-bold text-ink-800">{item.title}</p><p className="mt-0.5 text-[0.64rem] text-ink-600/60">{item.detail}</p></div>
                <span className={cn("shrink-0 text-[0.62rem] font-semibold", item.tone === "warn" ? "text-amber-700" : item.tone === "good" ? "text-mint-700" : "text-ink-600/55")}>{item.when}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!data.analyticsAvailable && <p className="text-[0.62rem] leading-relaxed text-ink-600/55">Traffic data is not available yet. This team shows an honest empty metric rather than an estimate.</p>}
    </div>
  );
}
