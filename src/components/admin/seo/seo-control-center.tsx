"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database, ExternalLink, Loader2, Play, RefreshCw, Search, Settings2, XCircle } from "lucide-react";
import { StatCard } from "@/components/admin/ui";
import { cn } from "@/components/ui";

type Opportunity = {
  id: number; topic: string; primaryKeyword: string | null; intent: string | null; cluster: string | null;
  targetPath: string | null; contentType: string | null; score: number; status: string;
  evidence: { summary?: string; searchIntent?: string; factors?: string[]; sources?: { title: string; url: string; extractedAt?: string }[]; competitors?: { url: string; title: string | null; headings: string[]; error?: string }[]; outline?: { heading: string }[] };
  createdAt: string;
};
type Run = { id: number; taskType: string; status: string; startedAt: string; completedAt: string | null; durationMs: number | null; error: string | null; meta: Record<string, unknown> };
type Audit = { id: number; status: string; pagesChecked: number; startedAt: string; summary: Record<string, unknown>; issues: { severity: string; path: string; detail: string }[] };
type Dashboard = {
  settings: Record<string, string>;
  opportunities: Opportunity[];
  runs: Run[];
  audits: Audit[];
  health: { ok: boolean; version?: string; uptimeSeconds?: number; error?: string };
  searchConsole: { connected: boolean; siteUrl: string | null };
  publishedCount: number;
  workflowsCount: number;
  taskLabels: Record<string, string>;
  checkedAt: string;
};

const TASK_KEYS = ["opportunity_discovery", "technical_audit", "content_refresh"] as const;
const SETTING_FIELDS: { key: string; label: string; hint: string; type?: string }[] = [
  { key: "discovery_interval_hours", label: "Discovery interval (hours)", hint: "How often Jiro + DeepSeek look for new opportunities." },
  { key: "audit_interval_hours", label: "Technical audit interval (hours)", hint: "Scheduled deterministic crawl interval." },
  { key: "refresh_interval_hours", label: "Refresh task interval (hours)", hint: "How often the refresh review task runs." },
  { key: "refresh_min_age_days", label: "Minimum content age (days)", hint: "Only recommend refreshing content older than this." },
  { key: "max_queries_per_run", label: "Queries per run", hint: "Maximum Jiro queries per discovery run (1–6)." },
  { key: "max_competitor_pages", label: "Competitor extracts per run", hint: "Maximum public pages extracted through Jiro (0–4)." },
  { key: "max_opportunities_per_run", label: "Opportunities per run", hint: "Maximum AI-proposed opportunities saved (1–8)." },
  { key: "daily_ai_runs", label: "Daily AI run budget", hint: "Operational budget marker; shown to the operator." },
];

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
    setError(null); setNotice(null);
    try {
      const response = await fetch("/api/admin/seo/automation", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "busyKey")) }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; dashboard?: Dashboard; error?: string; workflowId?: number } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Automation request failed.");
      if (body.dashboard) { setData(body.dashboard); setDraftSettings(body.dashboard.settings); }
      setNotice(action === "accept_opportunity" ? `Accepted into Content Studio workflow #${body.workflowId ?? ""}. Human approval is still required.` : "Updated.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Automation request failed.");
    } finally { setBusy(null); }
  }

  if (loading) return <div className="flex items-center gap-2 rounded-2xl border border-mist-200 bg-surface p-6 text-[0.8rem] font-semibold text-ink-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading SEO automation…</div>;
  if (!data) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-[0.8rem] font-semibold text-rose-700">{error ?? "SEO automation unavailable."}</div>;

  const enabled = data.settings.enabled === "true";
  const activeOpportunities = data.opportunities.filter((item) => item.status === "new");
  const auditIssues = data.audits[0]?.issues?.length ?? 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700"><Database className="h-3 w-3" /> SEO Control Center</p>
            <h2 className="mt-1 text-[1.1rem] font-extrabold tracking-tight text-ink-950">Research, audits and scheduled automation</h2>
            <p className="mt-1 max-w-2xl text-[0.75rem] leading-relaxed text-ink-600/70">Jiro provides live search and extraction. DeepSeek analyses only the supplied evidence. Search Console is a separate, optional data source and is not estimated.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-700 hover:border-brand-300">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.74rem] font-semibold text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-xl border border-mint-200 bg-mint-50 px-3 py-2 text-[0.74rem] font-semibold text-mint-800">{notice}</p>}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Jiro search" value={data.health.ok ? "Connected" : "Unavailable"} hint={data.health.ok ? `v${data.health.version ?? "?"} · internal` : data.health.error ?? "Check local service"} tone={data.health.ok ? "good" : "warn"} />
          <StatCard label="Search Console" value={data.searchConsole.connected ? "Connected" : "Not connected"} hint={data.searchConsole.connected ? data.searchConsole.siteUrl ?? "Property configured" : "No performance data is fabricated"} />
          <StatCard label="Opportunities" value={activeOpportunities.length} hint={`${data.opportunities.length} total · human review`} tone="brand" />
          <StatCard label="Automation" value={enabled ? "Enabled" : "Paused"} hint={enabled ? "Scheduled ticks active" : "Kill switch is on"} tone={enabled ? "good" : "warn"} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => void post("settings", { settings: { enabled: enabled ? "false" : "true" } })} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.7rem] font-bold text-white disabled:opacity-50", enabled ? "bg-rose-600 hover:bg-rose-700" : "bg-mint-700 hover:bg-mint-800")}>
            {busy === "settings" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : enabled ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {enabled ? "Pause automation" : "Enable automation"}
          </button>
          {TASK_KEYS.map((task) => (
            <button key={task} type="button" disabled={Boolean(busy)} onClick={() => void post("run_task", { task, busyKey: `run_task:${task}` })} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-2 text-[0.7rem] font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              {busy === `run_task:${task}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run {data.taskLabels[task] ?? task}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[0.64rem] text-ink-600/55">Manual runs can be used while automation is paused. Discovery makes paid DeepSeek calls only after live Jiro evidence is collected.</p>
      </section>

      <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-[0.95rem] font-extrabold tracking-tight text-ink-950"><Search className="h-4 w-4 text-brand-600" /> Keyword & content opportunities</h3>
            <p className="mt-1 text-[0.72rem] text-ink-600/65">Scores are editorial prioritisation from the displayed evidence, not Google ranking factors. Metrics such as volume and difficulty are deliberately unavailable.</p>
          </div>
          <span className="text-[0.66rem] font-semibold text-ink-600/55">Checked {new Date(data.checkedAt).toLocaleString()}</span>
        </div>
        {data.opportunities.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-mist-300 bg-mist-50 p-8 text-center"><p className="text-[0.82rem] font-extrabold text-ink-800">No opportunities yet.</p><p className="mt-1 text-[0.72rem] text-ink-600/65">Run opportunity discovery after Jiro is connected. Nothing is invented when the provider is unavailable.</p></div>
        ) : (
          <div className="mt-4 space-y-3">
            {data.opportunities.slice(0, 30).map((item) => (
              <article key={item.id} className="rounded-xl border border-mist-200 bg-mist-50/40 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.58rem] font-extrabold text-brand-700">{item.primaryKeyword ?? "keyword pending"}</span><span className="rounded-full border border-mist-200 bg-surface px-2 py-0.5 text-[0.58rem] font-bold capitalize text-ink-600">{item.intent ?? "informational"}</span><span className="rounded-full border border-mist-200 bg-surface px-2 py-0.5 text-[0.58rem] font-bold text-ink-600">{item.contentType ?? "Article"}</span><span className="text-[0.62rem] font-bold text-ink-600/55">Score {item.score}/100</span></div>
                    <h4 className="mt-2 text-[0.85rem] font-extrabold leading-snug text-ink-950">{item.topic}</h4>
                    <p className="mt-1 max-w-3xl text-[0.72rem] leading-relaxed text-ink-600/75">{item.evidence.summary ?? "No summary supplied."}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {item.status === "new" && <>
                      <button type="button" disabled={Boolean(busy)} onClick={() => void post("accept_opportunity", { id: item.id })} className="rounded-full bg-brand-600 px-3 py-1.5 text-[0.64rem] font-bold text-white hover:bg-brand-700 disabled:opacity-50">Accept to workflow</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => void post("opportunity_status", { id: item.id, status: "dismissed" })} className="rounded-full border border-mist-200 bg-surface px-3 py-1.5 text-[0.64rem] font-bold text-ink-600 hover:border-rose-300">Dismiss</button>
                    </>}
                    <span className="px-2 py-1.5 text-[0.62rem] font-bold capitalize text-ink-600/65">{item.status}</span>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[0.66rem] font-bold text-brand-700">Evidence and recommendation</summary>
                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    <div className="rounded-lg border border-mist-200 bg-surface p-2.5"><p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">Factors</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-[0.68rem] text-ink-700">{item.evidence.factors?.length ? item.evidence.factors.map((factor) => <li key={factor}>{factor}</li>) : <li>No factors supplied.</li>}</ul><p className="mt-2 text-[0.64rem] text-ink-600/65">{item.evidence.searchIntent ?? ""}</p></div>
                    <div className="rounded-lg border border-mist-200 bg-surface p-2.5"><p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">Sources checked</p>{item.evidence.sources?.length ? item.evidence.sources.slice(0, 6).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener" className="mt-1 flex items-center gap-1 truncate text-[0.66rem] text-brand-700 hover:underline"><ExternalLink className="h-3 w-3 shrink-0" /> {source.title}</a>) : <p className="mt-1 text-[0.66rem] text-ink-600/65">No public sources were extracted.</p>}</div>
                  </div>
                  {item.evidence.outline?.length ? <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[0.68rem] text-ink-700">{item.evidence.outline.map((section) => <li key={section.heading}>{section.heading}</li>)}</ol> : null}
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-[0.95rem] font-extrabold tracking-tight text-ink-950"><Settings2 className="h-4 w-4 text-brand-600" /> Automation settings</h3>
          <p className="mt-1 text-[0.72rem] text-ink-600/65">Cron calls <code className="rounded bg-mist-50 px-1">/api/admin/seo/automation/tick</code>. Publishing approval remains human-only.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SETTING_FIELDS.map((field) => <label key={field.key} className="block"><span className="text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/65">{field.label}</span><input value={draftSettings[field.key] ?? ""} onChange={(event) => setDraftSettings((current) => ({ ...current, [field.key]: event.target.value }))} inputMode="numeric" className="mt-1 w-full rounded-lg border border-mist-200 bg-surface px-2.5 py-2 text-[0.72rem] text-ink-900 outline-none focus:border-brand-400" /><span className="mt-0.5 block text-[0.6rem] text-ink-600/55">{field.hint}</span></label>)}
          </div>
          <button type="button" disabled={Boolean(busy)} onClick={() => void post("settings", { settings: draftSettings })} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy === "settings" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings2 className="h-3 w-3" />} Save settings</button>
          <p className="mt-3 text-[0.64rem] text-ink-600/55">Search Console: <strong>not connected</strong>. It is a separate integration and is not replaced by Jiro search results.</p>
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-[0.95rem] font-extrabold tracking-tight text-ink-950"><AlertTriangle className="h-4 w-4 text-amber-600" /> Task and audit history</h3>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {data.runs.length === 0 ? <p className="text-[0.72rem] text-ink-600/65">No automation runs yet.</p> : data.runs.map((run) => <div key={run.id} className="rounded-lg border border-mist-200 bg-mist-50/50 p-2.5"><div className="flex flex-wrap items-center justify-between gap-1"><span className="text-[0.68rem] font-extrabold text-ink-800">{data.taskLabels[run.taskType] ?? run.taskType}</span><span className={cn("text-[0.6rem] font-extrabold uppercase", run.status === "failed" ? "text-rose-700" : run.status === "completed" ? "text-mint-700" : "text-amber-700")}>{run.status}</span></div><p className="mt-0.5 text-[0.62rem] text-ink-600/60">{new Date(run.startedAt).toLocaleString()}{run.durationMs != null ? ` · ${Math.round(run.durationMs / 1000)}s` : ""}</p>{run.error && <p className="mt-1 text-[0.62rem] font-semibold text-rose-700">{run.error}</p>}</div>)}
          </div>
          <div className="mt-3 border-t border-mist-100 pt-3">
            <div className="flex items-center justify-between"><p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">Scheduled audit history</p><span className="text-[0.62rem] text-ink-600/55">{auditIssues} open issues in latest scheduled audit</span></div>
            <div className="mt-2 space-y-1">{data.audits.slice(0, 4).map((audit) => <div key={audit.id} className="flex items-center justify-between gap-2 text-[0.66rem] text-ink-700"><span>{new Date(audit.startedAt).toLocaleDateString()} · {audit.pagesChecked} pages</span><span className="font-bold text-ink-600/65">{audit.issues.length} issues</span></div>)}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/content" className="text-[0.68rem] font-bold text-brand-700 hover:underline">Open Content Studio →</Link>
            <Link href="/admin/blog" className="text-[0.68rem] font-bold text-brand-700 hover:underline">Open blog editor →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
