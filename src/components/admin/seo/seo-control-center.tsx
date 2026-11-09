"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/components/ui";

type Opportunity = {
  id: number;
  topic: string;
  primaryKeyword: string | null;
  score: number;
  status: string;
  evidence: {
    summary?: string;
    factors?: string[];
    sources?: { title: string; url: string }[];
    outline?: { heading: string }[];
  };
};

type Run = {
  id: number;
  taskType: string;
  status: string;
  startedAt: string;
  error: string | null;
};

type Audit = {
  id: number;
  pagesChecked: number;
  issues: { severity: string; path: string; detail: string }[];
};

type Dashboard = {
  settings: Record<string, string>;
  opportunities: Opportunity[];
  runs: Run[];
  audits: Audit[];
  health: { ok: boolean; error?: string };
  searchConsole: { connected: boolean };
};

const TASK_LABELS: Record<string, string> = {
  opportunity_discovery: "Find new opportunities",
  technical_audit: "Run site audit",
  content_refresh: "Check content updates",
};

const INTERVAL_OPTIONS = {
  discovery_interval_hours: [
    { value: "24", label: "Every day" },
    { value: "72", label: "Every 3 days" },
    { value: "168", label: "Every week" },
  ],
  audit_interval_hours: [
    { value: "168", label: "Every week" },
    { value: "336", label: "Every 2 weeks" },
    { value: "720", label: "Every month" },
  ],
  refresh_min_age_days: [
    { value: "90", label: "After 3 months" },
    { value: "180", label: "After 6 months" },
    { value: "365", label: "After 12 months" },
  ],
  daily_ai_runs: [
    { value: "2", label: "2 runs per day" },
    { value: "4", label: "4 runs per day" },
    { value: "6", label: "6 runs per day" },
  ],
} as const;

const SELECT_KEYS = Object.keys(INTERVAL_OPTIONS) as (keyof typeof INTERVAL_OPTIONS)[];

function StatusPill({ label, value, tone }: { label: string; value: string; tone: "good" | "muted" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-mist-50/60 px-3 py-1.5 text-[0.68rem] font-semibold text-ink-700">
      <span className={cn("h-1.5 w-1.5 rounded-full", tone === "good" ? "bg-mint-500" : "bg-ink-600/30")} />
      <span className="text-ink-600/60">{label}</span>
      {value}
    </span>
  );
}

export function SeoControlCenter() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftSettings, setDraftSettings] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/seo/automation", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; dashboard?: Dashboard; error?: string } | null;
      if (!response.ok || !body?.ok || !body.dashboard) throw new Error(body?.error ?? "Could not load SEO automation.");
      setData(body.dashboard);
      setDraftSettings(body.dashboard.settings);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load SEO automation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, payload: Record<string, unknown> = {}) {
    const busyKey = typeof payload.busyKey === "string" ? payload.busyKey : action;
    setBusy(busyKey);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/seo/automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "busyKey")) }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        dashboard?: Dashboard;
        error?: string;
        workflowId?: number;
        result?: { meta?: Record<string, unknown> };
      } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "That action could not be completed.");
      if (body.dashboard) {
        setData(body.dashboard);
        setDraftSettings(body.dashboard.settings);
      }
      if (action === "accept_opportunity") setNotice("Added to Content Studio. Review and generate the draft there.");
      else if (action === "opportunity_status") setNotice("Idea dismissed.");
      else if (action === "run_task") {
        const meta = body.result?.meta ?? {};
        if (payload.task === "opportunity_discovery") setNotice(`Found ${Number(meta.opportunities ?? 0)} new idea${Number(meta.opportunities ?? 0) === 1 ? "" : "s"}.`);
        else if (payload.task === "technical_audit") setNotice(`Site audit complete. ${Number(meta.issues ?? 0)} issue${Number(meta.issues ?? 0) === 1 ? "" : "s"} found.`);
        else setNotice("Content review complete.");
      } else setNotice("Saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleAutomation() {
    if (!data) return;
    await post("settings", { settings: { enabled: data.settings.enabled === "true" ? "false" : "true" }, busyKey: "toggle" });
  }

  if (loading) {
    return <div className="flex items-center gap-2 rounded-2xl border border-mist-200 bg-surface p-6 text-[0.8rem] font-semibold text-ink-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading SEO tools…</div>;
  }
  if (!data) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-[0.8rem] font-semibold text-rose-700">{error ?? "SEO tools unavailable."}</div>;
  }

  const enabled = data.settings.enabled === "true";
  const ideas = data.opportunities.filter((item) => item.status === "new");
  const latestAudit = data.audits[0];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[1rem] font-extrabold tracking-tight text-ink-950"><Sparkles className="h-4 w-4 text-brand-600" /> SEO automation</h2>
            <p className="mt-1 max-w-2xl text-[0.78rem] leading-relaxed text-ink-600/75">Find useful topics, audit the site, and keep content fresh. You still approve every article before it is published.</p>
          </div>
          <button type="button" disabled={Boolean(busy)} onClick={() => void toggleAutomation()} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[0.72rem] font-bold text-white disabled:opacity-50", enabled ? "bg-night-soft hover:bg-brand-600" : "bg-mint-700 hover:bg-mint-800")}>
            {busy === "toggle" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : enabled ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {enabled ? "Pause automation" : "Turn on automation"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusPill label="Research" value={data.health.ok ? "Ready" : "Unavailable"} tone={data.health.ok ? "good" : "muted"} />
          <StatusPill label="Search Console" value={data.searchConsole.connected ? "Connected" : "Not connected"} tone={data.searchConsole.connected ? "good" : "muted"} />
          <StatusPill label="Automation" value={enabled ? "On" : "Paused"} tone={enabled ? "good" : "muted"} />
          <StatusPill label="New ideas" value={String(ideas.length)} tone={ideas.length ? "good" : "muted"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => void post("run_task", { task: "opportunity_discovery", busyKey: "discover" })} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-[0.72rem] font-bold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy === "discover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Find new opportunities
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void post("run_task", { task: "technical_audit", busyKey: "audit" })} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-4 py-2.5 text-[0.72rem] font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50">
            {busy === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run site audit
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void post("run_task", { task: "content_refresh", busyKey: "refresh" })} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-700 hover:border-brand-300 disabled:opacity-50">
            {busy === "refresh" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check content updates
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3 py-2.5 text-[0.7rem] font-bold text-ink-600 hover:border-brand-300 disabled:opacity-50">
            <RefreshCw className={cn("h-3.5 w-3.5", busy === "load" && "animate-spin")} /> Refresh
          </button>
        </div>
        <p className="mt-2 text-[0.64rem] text-ink-600/55">{enabled ? "Automation is running on its schedule. You can still run a check manually." : "Automation is paused. Manual checks still work."}</p>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[0.74rem] font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-mint-200 bg-mint-50 px-3.5 py-2.5 text-[0.74rem] font-semibold text-mint-800">{notice}</p>}

      <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-[0.95rem] font-extrabold tracking-tight text-ink-950">Content ideas</h3>
            <p className="mt-1 text-[0.72rem] text-ink-600/65">New ideas for you to review. Nothing is written or published until you add it to Content Studio.</p>
          </div>
          {latestAudit && <span className="text-[0.66rem] font-semibold text-ink-600/55">Last audit: {latestAudit.pagesChecked} pages · {latestAudit.issues.length} issue{latestAudit.issues.length === 1 ? "" : "s"}</span>}
        </div>

        {ideas.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-mist-300 bg-mist-50 p-7 text-center">
            <p className="text-[0.82rem] font-extrabold text-ink-800">No new ideas right now.</p>
            <p className="mt-1 text-[0.72rem] text-ink-600/65">Run “Find new opportunities” when you want fresh topics.</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-mist-100">
            {ideas.slice(0, 12).map((item) => (
              <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.58rem] font-extrabold text-brand-700">{item.primaryKeyword ?? "Topic idea"}</span>
                      <span className="rounded-full border border-mist-200 bg-mist-50 px-2 py-0.5 text-[0.58rem] font-bold text-ink-600">Priority {item.score}</span>
                    </div>
                    <h4 className="mt-1.5 text-[0.84rem] font-extrabold leading-snug text-ink-950">{item.topic}</h4>
                    {item.evidence.summary && <p className="mt-1 line-clamp-2 text-[0.72rem] leading-relaxed text-ink-600/70">{item.evidence.summary}</p>}
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[0.64rem] font-bold text-brand-700">Why this idea</summary>
                      <div className="mt-1.5 space-y-1 text-[0.68rem] leading-relaxed text-ink-600/75">
                        {item.evidence.factors?.length ? <ul className="list-disc pl-4">{item.evidence.factors.map((factor) => <li key={factor}>{factor}</li>)}</ul> : null}
                        {item.evidence.sources?.length ? <p>{item.evidence.sources.slice(0, 3).map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-brand-700 hover:underline">{index > 0 ? " · " : ""}{source.title}</a>)}</p> : null}
                      </div>
                    </details>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" disabled={Boolean(busy)} onClick={() => void post("accept_opportunity", { id: item.id, busyKey: `accept:${item.id}` })} className="rounded-full bg-night-soft px-3 py-2 text-[0.66rem] font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy === `accept:${item.id}` ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Add to Content Studio"}</button>
                    <button type="button" disabled={Boolean(busy)} onClick={() => void post("opportunity_status", { id: item.id, status: "dismissed", busyKey: `dismiss:${item.id}` })} className="rounded-full border border-mist-200 px-2.5 py-2 text-[0.64rem] font-bold text-ink-600 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50">Dismiss</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 border-t border-mist-100 pt-3">
          <Link href="/admin/content" className="text-[0.68rem] font-bold text-brand-700 hover:underline">Open Content Studio →</Link>
          <Link href="/admin/blog" className="text-[0.68rem] font-bold text-brand-700 hover:underline">Open blog editor →</Link>
        </div>
      </section>

      <details className="group rounded-2xl border border-mist-200 bg-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3.5 text-[0.76rem] font-extrabold text-ink-800">
          <span className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5 text-brand-600" /> Advanced settings</span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-600/50 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-mist-100 px-4 py-3.5">
          <p className="text-[0.68rem] leading-relaxed text-ink-600/65">These are safe defaults. Change them only if you want a different research rhythm.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SELECT_KEYS.map((key) => (
              <label key={key} className="block">
                <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/65">
                  {key === "discovery_interval_hours" ? "Find ideas" : key === "audit_interval_hours" ? "Audit site" : key === "refresh_min_age_days" ? "Review older content" : "Daily research budget"}
                </span>
                <select value={draftSettings[key] ?? ""} onChange={(event) => setDraftSettings((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-mist-200 bg-surface px-2.5 py-2 text-[0.74rem] text-ink-900 outline-none focus:border-brand-400">
                  {(INTERVAL_OPTIONS[key] as readonly { value: string; label: string }[]).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={Boolean(busy)} onClick={() => void post("settings", { settings: draftSettings, busyKey: "save" })} className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save settings</button>
            <span className="text-[0.64rem] text-ink-600/55">Search Console is not connected, so performance data is not shown.</span>
          </div>
        </div>
      </details>

      <details className="group rounded-2xl border border-mist-200 bg-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3.5 text-[0.76rem] font-extrabold text-ink-800">
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Recent activity</span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-600/50 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-mist-100 px-4 py-3">
          {data.runs.length === 0 ? <p className="text-[0.72rem] text-ink-600/65">No activity yet.</p> : <div className="space-y-1.5">{data.runs.slice(0, 6).map((run) => <div key={run.id} className="flex items-center justify-between gap-3 text-[0.68rem]"><span className="font-semibold text-ink-700">{TASK_LABELS[run.taskType] ?? run.taskType}</span><span className="flex items-center gap-2"><span className={cn("font-bold uppercase", run.status === "failed" ? "text-rose-700" : "text-mint-700")}>{run.status}</span><span className="text-ink-600/55">{new Date(run.startedAt).toLocaleDateString()}</span></span></div>)}</div>}
          {data.runs.some((run) => run.error) && <p className="mt-2 text-[0.64rem] text-rose-700">A recent check failed. Try it again from the buttons above.</p>}
        </div>
      </details>
    </div>
  );
}
