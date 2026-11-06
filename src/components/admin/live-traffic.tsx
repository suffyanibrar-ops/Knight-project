"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ExternalLink, Gauge, Globe2, Info, Laptop, Loader2, MonitorSmartphone, MousePointerClick, RefreshCw, Search, Users } from "lucide-react";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type MetricChange = number | null;
type TrafficTotals = { users: number; newUsers: number; sessions: number; pageViews: number; engagedSessions: number; engagementRate: number; averageSessionDuration: number };
type GaTraffic = {
  available: boolean;
  error: string | null;
  totals: TrafficTotals;
  previous: TrafficTotals;
  change: { users: MetricChange; sessions: MetricChange; pageViews: MetricChange; engagedSessions: MetricChange };
  series: { date: string; users: number; sessions: number; pageViews: number }[];
  pages: { path: string; views: number; users: number; averageTime: number; engagementRate: number }[];
  landingPages: { path: string; users: number; sessions: number }[];
  exitPages: { path: string; users: number; sessions: number }[];
  sources: { source: string; users: number; sessions: number; engagedSessions: number; engagementRate: number }[];
  referrals: { source: string; medium: string; users: number }[];
  visitors: { newVsReturning: { label: string; users: number }[]; devices: { label: string; users: number }[]; browsers: { label: string; users: number }[]; operatingSystems: { label: string; users: number }[]; countries: { label: string; users: number }[]; regions: { label: string; users: number }[] };
  warning: string | null;
};
type GaLive = {
  available: boolean;
  error: string | null;
  activeLast5: number | null;
  activeLast30: number;
  activeBasis: "5_minutes" | "30_minutes";
  pages: { label: string; activeUsers: number }[];
  devices: { label: string; activeUsers: number }[];
  sources: { label: string; activeUsers: number }[];
  countries: { label: string; activeUsers: number }[];
  fetchedAt: string;
  warning: string | null;
};
type Payload = {
  ok: boolean;
  analytics: { connected: boolean; available: boolean; propertyIdMasked: string; error: string | null };
  range: { key: string; label: string; startDay: string; endDay: string; compareLabel: string };
  live: GaLive | null;
  traffic: GaTraffic | null;
  business: { enquiries: number; consultationRequests: number; aiLeads: number; appointmentsInRange: number; pendingHandoffs: number; emailIssues: number; emailQueued: number };
  conversions: { stages: { key: string; label: string; value: number | null; source: string }[]; rates: { key: string; label: string; value: number | null }[]; events?: { name: string; count: number }[]; note: string };
  generatedAt: string;
  cached?: boolean;
};

const TABS = [
  { key: "live", label: "Live" },
  { key: "traffic", label: "Traffic" },
  { key: "pages", label: "Pages" },
  { key: "sources", label: "Sources" },
  { key: "visitors", label: "Visitors" },
  { key: "conversions", label: "Conversions" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmt(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}
function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
function duration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}m ${String(rounded % 60).padStart(2, "0")}s`;
}
function pathLabel(path: string) {
  return path || "/";
}
function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-600/45">no comparison</span>;
  const positive = value >= 0;
  return <span className={cn("inline-flex items-center gap-0.5 font-bold", positive ? "text-mint-700" : "text-rose-600")}>{positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{pct(value)}</span>;
}

function AnalyticsEmpty({ unavailable = false, error }: { unavailable?: boolean; error?: string | null }) {
  return (
    <div className="rounded-2xl border border-mist-200 bg-surface p-5">
      <p className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-900"><Info className="h-4 w-4 text-brand-600" /> {unavailable ? "First-party analytics is unavailable" : "No first-party traffic yet"}</p>
      <p className="mt-1.5 max-w-2xl text-[0.78rem] leading-relaxed text-ink-600/75">
        {unavailable
          ? "The analytics store could not be queried. Check database health in Settings; no visitor data is invented while it is offline."
          : "The privacy-conscious tracker is installed on the public site. Real visitor data will appear here after the first pageview — there is no seeded or fabricated traffic."}
      </p>
      {error && <p className="mt-2 text-[0.7rem] font-semibold text-ink-600/60">{error}</p>}
      <Link href="/admin/settings" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-mist-50 px-3 py-1.5 text-[0.7rem] font-extrabold text-ink-700 hover:border-brand-300">Review analytics settings <ExternalLink className="h-3 w-3" /></Link>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
      <p className="text-[0.86rem] font-extrabold text-rose-800">Unable to load analytics</p>
      <p className="mt-1 text-[0.76rem] text-rose-700/75">{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-surface px-3 py-1.5 text-[0.7rem] font-extrabold text-rose-700"><RefreshCw className="h-3 w-3" /> Try again</button>
    </div>
  );
}

function EmptyData({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-mist-300 bg-surface p-8 text-center"><p className="text-[0.82rem] font-extrabold text-ink-900">{title}</p><p className="mx-auto mt-1 max-w-md text-[0.74rem] leading-relaxed text-ink-600/70">{description}</p></div>;
}

function TrendChart({ series, reduced = false }: { series: GaTraffic["series"]; reduced?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (series.length === 0) return <EmptyData title="No traffic data yet" description="No first-party pageviews have been recorded for this range yet." />;
  const w = 760;
  const h = 230;
  const pad = { top: 16, right: 14, bottom: 30, left: 38 };
  const max = Math.max(1, ...series.flatMap((point) => [point.users, point.pageViews]));
  const points = (key: "users" | "pageViews") => series.map((point, index) => {
    const x = pad.left + (index / Math.max(series.length - 1, 1)) * (w - pad.left - pad.right);
    const y = pad.top + (1 - point[key] / max) * (h - pad.top - pad.bottom);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="rounded-2xl border border-mist-200 bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.72rem] font-extrabold text-ink-900">Daily trend</p>
        <div className="flex items-center gap-3 text-[0.64rem] font-bold text-ink-600/70"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Users</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> Page views</span></div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full overflow-visible" role="img" aria-label="Daily users and page views trend">
        <defs><linearGradient id={`trend-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0b6f88" stopOpacity="0.18" /><stop offset="100%" stopColor="#0b6f88" stopOpacity="0" /></linearGradient></defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1={pad.left} x2={w - pad.right} y1={pad.top + ratio * (h - pad.top - pad.bottom)} y2={pad.top + ratio * (h - pad.top - pad.bottom)} stroke="#e3ebef" strokeDasharray="3 5" />)}
        <polyline points={points("pageViews")} fill="none" stroke="#5e9f74" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        <polyline points={points("users")} fill="none" stroke="#0b6f88" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((point, index) => {
          const x = pad.left + (index / Math.max(series.length - 1, 1)) * (w - pad.left - pad.right);
          const y = pad.top + (1 - point.users / max) * (h - pad.top - pad.bottom);
          return <circle key={point.date} cx={x} cy={y} r="2.5" fill="#0b6f88" />;
        })}
        {series.filter((_, index) => index % Math.max(1, Math.ceil(series.length / 6)) === 0).map((point, index, visible) => {
          const original = series.indexOf(point);
          const x = pad.left + (original / Math.max(series.length - 1, 1)) * (w - pad.left - pad.right);
          return <text key={point.date} x={x} y={h - 8} textAnchor={index === 0 ? "start" : index === visible.length - 1 ? "end" : "middle"} className="fill-ink-600/60 text-[10px]">{point.date.slice(4, 6)}/{point.date.slice(6, 8)}</text>;
        })}
      </svg>
      {reduced ? null : <span className="sr-only">Chart updates when the selected date range changes.</span>}
    </div>
  );
}

function BarList({ items, valueKey = "activeUsers", label = "Label" }: { items: { label?: string; path?: string; activeUsers?: number; users?: number }[]; valueKey?: "activeUsers" | "users"; label?: string }) {
  const max = Math.max(1, ...items.map((item) => item[valueKey] ?? 0));
  if (items.length === 0) return <p className="rounded-xl border border-mist-200 bg-mist-50 p-4 text-[0.74rem] text-ink-600/70">No data for this section.</p>;
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const value = item[valueKey] ?? 0;
        const text = item.label ?? item.path ?? "(not set)";
        return (
          <div key={`${text}-${index}`} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-[0.72rem] font-semibold text-ink-800" title={text}>{text}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist-100"><div className="h-full rounded-full bg-brand-500/75" style={{ width: `${Math.max(3, (value / max) * 100)}%` }} /></div>
            </div>
            <p className="text-right text-[0.72rem] font-extrabold tabular-nums text-ink-800">{fmt(value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-surface"><table className="w-full min-w-[34rem] border-collapse text-left text-[0.74rem]">{children}</table></div>;
}

function LivePanel({ payload }: { payload: Payload }) {
  if (!payload.analytics.available || !payload.live) return <AnalyticsEmpty unavailable error={payload.analytics.error ?? payload.live?.error} />;
  const live = payload.live;
  const online = live.activeLast5 ?? live.activeLast30;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-mint-200 bg-mint-50/60 px-4 py-3">
        <p className="flex items-center gap-2 text-[0.76rem] font-extrabold text-mint-800"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-mint-600" /></span> Live first-party activity</p>
        <p className="text-[0.65rem] font-semibold text-mint-800/65">Refreshes every 8 seconds · active in the last 5 minutes</p>
      </div>
      {live.activeLast30 === 0 && <AnalyticsEmpty />}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={live.activeBasis === "5_minutes" ? "Active last 5 min" : "Active last 30 min"} value={fmt(online)} hint={live.activeBasis === "5_minutes" ? "Near realtime" : "Provider window is 30 min"} tone="good" />
        <StatCard label="Active last 30 min" value={fmt(live.activeLast30)} hint="First-party sessions" tone="brand" />
        <StatCard label="Pages active now" value={live.pages.length} hint="Pages with active users" />
        <StatCard label="Countries active" value={live.countries.length} hint="Aggregate, not individual visitors" />
      </div>
      {live.warning && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.72rem] text-amber-900/80">{live.warning}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Current pages</p><BarList items={live.pages} /></section>
        <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Device</p><BarList items={live.devices} /></section>
        <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Traffic source</p><BarList items={live.sources} /></section>
        <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Country</p><BarList items={live.countries} /></section>
      </div>
      <p className="flex items-start gap-1.5 text-[0.64rem] leading-relaxed text-ink-600/55"><Info className="mt-0.5 h-3 w-3 shrink-0" /> Aggregate first-party data only. This panel never identifies individual visitors.</p>
    </div>
  );
}

function TrafficPanel({ traffic }: { traffic: GaTraffic }) {
  if (!traffic.available) return <ErrorPanel message={traffic.error ?? "Analytics is unavailable."} onRetry={() => window.location.reload()} />;
  return (
    <div className="space-y-4">
      {traffic.totals.sessions === 0 && <AnalyticsEmpty />}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={fmt(traffic.totals.users)} hint={<>vs previous: <Change value={traffic.change.users} /></>} tone="brand" />
        <StatCard label="New users" value={fmt(traffic.totals.newUsers)} hint={`${fmt(traffic.totals.sessions)} sessions`} />
        <StatCard label="Page views" value={fmt(traffic.totals.pageViews)} hint={<>vs previous: <Change value={traffic.change.pageViews} /></>} />
        <StatCard label="Engaged sessions" value={fmt(traffic.totals.engagedSessions)} hint={`${(traffic.totals.engagementRate * 100).toFixed(1)}% engagement rate`} tone="good" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard label="Avg engagement time" value={duration(traffic.totals.averageSessionDuration)} hint="Per session" />
        <StatCard label="Pages / session" value={traffic.totals.sessions ? (traffic.totals.pageViews / traffic.totals.sessions).toFixed(2) : "—"} hint="Derived from pageviews and sessions" />
        <StatCard label="Returning share" value={traffic.totals.users ? `${Math.max(0, ((traffic.totals.users - traffic.totals.newUsers) / traffic.totals.users) * 100).toFixed(1)}%` : "—"} hint="Users minus new users" />
      </div>
      <TrendChart series={traffic.series} />
      {traffic.warning && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.72rem] text-amber-900/80">{traffic.warning}</p>}
      <p className="text-[0.64rem] text-ink-600/55">Comparing the selected range with the previous equal-length range. Percentages appear only when the previous range contains data.</p>
    </div>
  );
}

function PagesPanel({ traffic }: { traffic: GaTraffic }) {
  if (!traffic.available) return <AnalyticsEmpty unavailable error={traffic.error} />;
  return (
    <div className="space-y-4">
      <TableShell>
        <thead><tr className="border-b border-mist-200 bg-mist-50/80 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60"><th className="px-3 py-2.5">Page</th><th className="px-3 py-2.5 text-right">Views</th><th className="px-3 py-2.5 text-right">Users</th><th className="px-3 py-2.5 text-right">Avg time</th><th className="px-3 py-2.5 text-right">Engagement</th></tr></thead>
        <tbody>{traffic.pages.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-[0.74rem] text-ink-600/60">No page data for this range.</td></tr> : traffic.pages.map((page) => <tr key={page.path} className="border-b border-mist-100 last:border-0"><td className="max-w-[22rem] truncate px-3 py-2.5 font-semibold text-ink-800" title={page.path}>{pathLabel(page.path)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(page.views)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(page.users)}</td><td className="px-3 py-2.5 text-right tabular-nums">{duration(page.averageTime)}</td><td className="px-3 py-2.5 text-right tabular-nums">{page.engagementRate ? `${(page.engagementRate * 100).toFixed(1)}%` : "—"}</td></tr>)}</tbody>
      </TableShell>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Landing pages</p><BarList items={traffic.landingPages.map((page) => ({ label: page.path, users: page.users }))} valueKey="users" /></section>
        <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Exit pages</p><BarList items={traffic.exitPages.map((page) => ({ label: page.path, users: page.users }))} valueKey="users" /></section>
      </div>
    </div>
  );
}

function SourcesPanel({ traffic }: { traffic: GaTraffic }) {
  if (!traffic.available) return <AnalyticsEmpty unavailable error={traffic.error} />;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Acquisition channels</p>
        <BarList items={traffic.sources.map((source) => ({ label: `${source.source} · ${(source.engagementRate * 100).toFixed(0)}% engaged`, users: source.users }))} valueKey="users" />
      </section>
      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Referral sources</p>
        {traffic.referrals.length === 0 ? <p className="text-[0.74rem] text-ink-600/65">No referral data for this range.</p> : <div className="space-y-2.5">{traffic.referrals.map((ref) => <div key={`${ref.source}-${ref.medium}`} className="flex items-center justify-between gap-2 rounded-xl border border-mist-100 bg-mist-50/60 px-3 py-2"><span className="min-w-0 truncate text-[0.72rem] font-semibold text-ink-800">{ref.source} <span className="text-ink-600/55">/ {ref.medium}</span></span><span className="text-[0.72rem] font-extrabold tabular-nums">{fmt(ref.users)}</span></div>)}</div>}
      </section>
      <section className="rounded-2xl border border-mist-200 bg-surface p-4 lg:col-span-2">
        <p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Source detail</p>
        <TableShell><thead><tr className="border-b border-mist-200 bg-mist-50/80 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60"><th className="px-3 py-2.5">Channel</th><th className="px-3 py-2.5 text-right">Users</th><th className="px-3 py-2.5 text-right">Sessions</th><th className="px-3 py-2.5 text-right">Engaged sessions</th><th className="px-3 py-2.5 text-right">Engagement rate</th></tr></thead><tbody>{traffic.sources.map((source) => <tr key={source.source} className="border-b border-mist-100 last:border-0"><td className="px-3 py-2.5 font-semibold text-ink-800">{source.source}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(source.users)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(source.sessions)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(source.engagedSessions)}</td><td className="px-3 py-2.5 text-right tabular-nums">{(source.engagementRate * 100).toFixed(1)}%</td></tr>)}</tbody></TableShell>
      </section>
    </div>
  );
}

function VisitorsPanel({ traffic }: { traffic: GaTraffic }) {
  if (!traffic.available) return <AnalyticsEmpty unavailable error={traffic.error} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60"><Users className="h-3 w-3" /> New vs returning</p><BarList items={traffic.visitors.newVsReturning.map((item) => ({ label: item.label, users: item.users }))} valueKey="users" /></section>
      <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60"><MonitorSmartphone className="h-3 w-3" /> Device</p><BarList items={traffic.visitors.devices.map((item) => ({ label: item.label, users: item.users }))} valueKey="users" /></section>
      <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60"><Laptop className="h-3 w-3" /> Browser</p><BarList items={traffic.visitors.browsers.map((item) => ({ label: item.label, users: item.users }))} valueKey="users" /></section>
      <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60"><Globe2 className="h-3 w-3" /> Country</p><BarList items={traffic.visitors.countries.map((item) => ({ label: item.label, users: item.users }))} valueKey="users" /></section>
      <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Operating system</p><BarList items={traffic.visitors.operatingSystems.map((item) => ({ label: item.label, users: item.users }))} valueKey="users" /></section>
      <section className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Regions</p><BarList items={traffic.visitors.regions.map((item) => ({ label: item.label, users: item.users }))} valueKey="users" /></section>
    </div>
  );
}

function ConversionsPanel({ payload }: { payload: Payload }) {
  const stages = payload.conversions.stages;
  const max = Math.max(1, ...stages.map((stage) => stage.value ?? 0));
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Traffic → business</p><h2 className="mt-1 text-[1rem] font-extrabold tracking-tight text-ink-950">Conversion path</h2></div>
          <span className="rounded-full border border-mist-200 bg-mist-50 px-2.5 py-1 text-[0.62rem] font-bold text-ink-600/70">First-party + SQLite</span>
        </div>
        <div className="mt-4 space-y-2">
          {stages.map((stage, index) => (
            <div key={stage.key} className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-3">
              <div>
                <div className="flex items-center justify-between gap-2"><p className="text-[0.74rem] font-extrabold text-ink-800">{stage.label}</p><span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-ink-600/45">{stage.source}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-mist-100"><div className={cn("h-full rounded-full", index < 2 ? "bg-brand-500/75" : "bg-mint-500/80")} style={{ width: `${Math.max(3, ((stage.value ?? 0) / max) * 100)}%` }} /></div>
              </div>
              <p className="text-right text-[0.82rem] font-extrabold tabular-nums text-ink-900">{fmt(stage.value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {payload.conversions.rates.map((rate) => <div key={rate.key} className="rounded-xl border border-mist-200 bg-mist-50/70 p-3"><p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">{rate.label}</p><p className="mt-1 text-lg font-extrabold text-ink-950">{rate.value === null ? "—" : `${(rate.value * 100).toFixed(2)}%`}</p></div>)}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[0.64rem] leading-relaxed text-ink-600/60"><Info className="mt-0.5 h-3 w-3 shrink-0" /> {payload.conversions.note}</p>
        {payload.conversions.events && payload.conversions.events.length > 0 && (
          <div className="mt-4 rounded-xl border border-mist-200 bg-mist-50/60 p-3">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">Tracked conversion events</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {payload.conversions.events.map((event) => <span key={event.name} className="rounded-full border border-mist-200 bg-surface px-2.5 py-1 text-[0.66rem] font-semibold text-ink-700">{event.name.replaceAll("_", " ")} · {event.count}</span>)}
            </div>
          </div>
        )}
      </section>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enquiries" value={payload.business.enquiries} hint="Selected range · SQLite" tone="brand" />
        <StatCard label="Consultation requests" value={payload.business.consultationRequests} hint="Non-contact submissions" />
        <StatCard label="AI-qualified leads" value={payload.business.aiLeads} hint="Selected range · SQLite" tone="good" />
        <StatCard label="Appointments" value={payload.business.appointmentsInRange} hint={`${payload.business.pendingHandoffs} handoffs pending`} tone={payload.business.pendingHandoffs ? "warn" : "default"} />
      </div>
    </div>
  );
}

export function LiveTraffic() {
  const [tab, setTab] = useState<TabKey>("live");
  const [range, setRange] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useMemo(() => {
    if (range !== "custom") return `range=${encodeURIComponent(range)}`;
    const params = new URLSearchParams({ range: "custom" });
    if (customStart) params.set("start", customStart);
    if (customEnd) params.set("end", customEnd);
    return params.toString();
  }, [range, customStart, customEnd]);

  const load = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/live-traffic?${query}`, { cache: "no-store", signal });
      const body = (await response.json().catch(() => null)) as Payload | { error?: string } | null;
      if (!response.ok || !body || !("ok" in body)) throw new Error((body as { error?: string } | null)?.error ?? `Traffic request failed (${response.status}).`);
      setPayload(body as Payload);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Unable to load traffic analytics.");
    } finally {
      if (!signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const kickoff = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(kickoff); controller.abort(); };
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && tab === "live") void load(undefined, true);
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [load, tab]);

  const openTab = (key: TabKey) => setTab(key);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Live Traffic"
        description="One view of first-party website traffic, pages, acquisition, visitors and the business conversions they produce. Traffic and business records share the existing SQLite database."
        actions={<><a href={`/api/admin/live-traffic/export?${query}`} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300"><ExternalLink className="h-3.5 w-3.5" /> Export CSV</a><button type="button" onClick={() => void load(undefined, true)} disabled={loading || refreshing} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300 disabled:opacity-60"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh</button></>}
      />

      {payload && <div className="flex flex-col gap-3 rounded-2xl border border-mist-200 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/55">Range</span>
          {[["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["custom", "Custom"]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setRange(value)} className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-bold transition-colors", range === value ? "border-brand-300 bg-brand-50 text-brand-800" : "border-mist-200 text-ink-600/70 hover:border-brand-200")}>{label}</button>
          ))}
          {range === "custom" && <span className="flex flex-wrap items-center gap-1.5"><input type="date" aria-label="Custom start date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg border border-mist-200 bg-mist-50 px-2 py-1 text-[0.68rem] outline-none focus:border-brand-400" /><span className="text-ink-600/45">to</span><input type="date" aria-label="Custom end date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg border border-mist-200 bg-mist-50 px-2 py-1 text-[0.68rem] outline-none focus:border-brand-400" /><button type="button" onClick={() => void load()} disabled={!customStart || !customEnd || loading} className="rounded-full bg-night-soft px-2.5 py-1 text-[0.66rem] font-bold text-white disabled:opacity-50">Apply</button></span>}
        </div>
        <p className="flex items-center gap-1.5 text-[0.64rem] font-semibold text-ink-600/55"><CalendarDays className="h-3 w-3" /> {payload.range.label} · generated {new Date(payload.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{payload.cached ? " · cached" : ""}</p>
      </div>}

      <div role="tablist" aria-label="Live Traffic sections" className="flex flex-wrap gap-1 rounded-2xl border border-mist-200 bg-surface p-1.5">
        {TABS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => openTab(item.key)} className={cn("rounded-xl px-3.5 py-2 text-[0.74rem] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400", tab === item.key ? "bg-night-soft text-white" : "text-ink-600/70 hover:bg-mist-50 hover:text-ink-900")}>{item.label}</button>)}
      </div>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><div className="h-24 animate-pulse rounded-2xl bg-mist-100" /><div className="h-24 animate-pulse rounded-2xl bg-mist-100" /><div className="h-24 animate-pulse rounded-2xl bg-mist-100" /><div className="h-24 animate-pulse rounded-2xl bg-mist-100" /></div>
      ) : error ? (
        <ErrorPanel message={error} onRetry={() => void load()} />
      ) : !payload ? (
        <EmptyData title="No traffic data available" description="The traffic endpoint returned no data. Try refreshing." />
      ) : (
        <div role="tabpanel" aria-label={`${tab} section`}>
          {tab === "live" && <LivePanel payload={payload} />}
          {tab === "traffic" && (payload.traffic ? <TrafficPanel traffic={payload.traffic} /> : <AnalyticsEmpty unavailable error={payload.analytics.error} />)}
          {tab === "pages" && (payload.traffic ? <PagesPanel traffic={payload.traffic} /> : <AnalyticsEmpty unavailable error={payload.analytics.error} />)}
          {tab === "sources" && (payload.traffic ? <SourcesPanel traffic={payload.traffic} /> : <AnalyticsEmpty unavailable error={payload.analytics.error} />)}
          {tab === "visitors" && (payload.traffic ? <VisitorsPanel traffic={payload.traffic} /> : <AnalyticsEmpty unavailable error={payload.analytics.error} />)}
          {tab === "conversions" && <ConversionsPanel payload={payload} />}
        </div>
      )}

      {payload && !payload.analytics.available && <p className="text-[0.68rem] text-amber-700">First-party analytics is temporarily unavailable. {payload.analytics.error ?? ""}</p>}
      <div className="flex flex-wrap items-center gap-3 text-[0.62rem] text-ink-600/50"><span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Live data refreshes every 8 seconds.</span><span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> Conversions combine first-party traffic with SQLite business records.</span><span className="flex items-center gap-1"><Search className="h-3 w-3" /> No individual visitors are identified.</span></div>
    </div>
  );
}
