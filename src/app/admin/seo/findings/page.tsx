import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { listFindings, type FindingStatus } from "@/lib/seo/store";
import { CATEGORIES, SEVERITIES, categoryOf, filterFindings, isFindingStale, isPageSubject, isStale, parseFilters, recommendationFor, summarise, summariseMetrics, summariseTaskRuns } from "@/lib/seo/findings-view";
import { sqliteHandle } from "@/lib/sqlite";
import { AdminPageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SEO findings · Admin", robots: { index: false, follow: false } };

const CLASS_LABEL: Record<string, string> = {
  confirmed_defect: "Confirmed defect",
  probable_opportunity: "Probable opportunity",
  ai_hypothesis: "AI hypothesis",
  verified_improvement: "Verified improvement",
};

const CLASS_TONE: Record<string, string> = {
  confirmed_defect: "border-rose-200 bg-rose-50 text-rose-700",
  probable_opportunity: "border-brand-200 bg-brand-50 text-brand-700",
  ai_hypothesis: "border-amber-200 bg-amber-50 text-amber-800",
  verified_improvement: "border-mint-200 bg-mint-50 text-mint-700",
};

type SyncRow = { provider: string; status: string; started_at: number; finished_at: number | null; rows_written: number; error: string | null };

function syncHealth(): SyncRow[] {
  const db = sqliteHandle();
  if (!db) return [];
  try {
    return db.prepare("SELECT provider, status, started_at, finished_at, rows_written, error FROM seo_sync_runs ORDER BY started_at DESC LIMIT 6").all() as SyncRow[];
  } catch {
    return [];
  }
}

/**
 * Read-only intelligence view. Findings are produced by the evidence pipeline;
 * this page never executes an action, so approval buttons are intentionally
 * absent until the action layer (Level A/B executor) exists.
 */
export default async function SeoFindingsPage({ searchParams }: { searchParams: Promise<{ severity?: string; category?: string; q?: string; status?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const params = await searchParams;
  const filters = parseFilters(params);
  const status: FindingStatus = params.status === "resolved" ? "resolved" : "open";
  const all = listFindings(200, status);
  const findings = filterFindings(all, filters);
  const db = sqliteHandle();
  const taskRuns = db ? (db.prepare("SELECT task_type AS taskType, status, started_at AS startedAt, completed_at AS finishedAt, error FROM seo_automation_runs ORDER BY started_at DESC LIMIT 120").all() as { taskType: string; status: string; startedAt: number; finishedAt: number | null; error: string | null }[]) : [];
  const metricRows = db ? (db.prepare("SELECT source, date, clicks, impressions FROM seo_metrics_daily ORDER BY date DESC LIMIT 5000").all() as { source: string; date: string; clicks: number | null; impressions: number | null }[]) : [];
  const tasks = summariseTaskRuns(taskRuns);
  const metrics = summariseMetrics(metricRows);
  const summary = summarise(all);
  const stale = isStale(all);
  const sync = syncHealth();
  const counts = summary.bySeverity;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="SEO findings"
        description="Evidence-backed findings from Search Console, Bing, the crawler and deterministic rules. Read-only: no change is applied from this page."
      />

      {stale ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.74rem] font-semibold text-amber-900">
          These findings are older than 48 hours. Run a crawl and consolidation from the SEO page before trusting them as current.
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {SEVERITIES.map((severity) => (
          <div key={severity} className="rounded-2xl border border-mist-200 bg-surface p-4">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">{severity}</p>
            <p className="mt-1 text-[1.4rem] font-extrabold text-ink-950">{counts[severity] ?? 0}</p>
          </div>
        ))}
      </div>

      <form action="/admin/seo/findings" className="flex flex-col gap-2 rounded-2xl border border-mist-200 bg-surface p-3 sm:flex-row sm:items-center">
        <input name="q" defaultValue={filters.query} placeholder="Search URL or check…" aria-label="Search findings" className="min-w-0 flex-1 rounded-xl border border-mist-200 px-3 py-2 text-[0.8rem] outline-none focus:border-brand-400" />
        <input type="hidden" name="status" value={status} />
        <select name="severity" defaultValue={filters.severity} aria-label="Filter by severity" className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-[0.76rem] font-semibold text-ink-800">
          <option value="all">Any severity</option>
          {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity} ({counts[severity] ?? 0})</option>)}
        </select>
        <select name="category" defaultValue={filters.category} aria-label="Filter by category" className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-[0.76rem] font-semibold text-ink-800">
          <option value="all">Any category</option>
          {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <button type="submit" className="rounded-xl bg-night-soft px-4 py-2 text-[0.76rem] font-bold text-white hover:bg-brand-600">Apply</button>
      </form>

      <nav aria-label="Finding status" className="flex flex-wrap gap-2">
        <Link
          href={`/admin/seo/findings${status === "open" ? "" : "?status=open"}`}
          aria-current={status === "open" ? "page" : undefined}
          className={`rounded-full border px-3 py-1.5 text-[0.7rem] font-bold ${status === "open" ? "border-night-soft bg-night-soft text-white" : "border-mist-200 bg-surface text-ink-700"}`}
        >
          Open findings
        </Link>
        <Link
          href="/admin/seo/findings?status=resolved"
          aria-current={status === "resolved" ? "page" : undefined}
          className={`rounded-full border px-3 py-1.5 text-[0.7rem] font-bold ${status === "resolved" ? "border-night-soft bg-night-soft text-white" : "border-mist-200 bg-surface text-ink-700"}`}
        >
          Resolved (verified by a later crawl)
        </Link>
      </nav>

      <p className="text-[0.7rem] text-ink-600/70">
        {summary.total} {status} finding{summary.total === 1 ? "" : "s"} across {summary.affectedUrls} page URL{summary.affectedUrls === 1 ? "" : "s"} · showing {findings.length}
        {summary.worstSeverity ? ` · worst severity ${summary.worstSeverity}` : ""}
      </p>

      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <h2 className="text-[0.9rem] font-extrabold text-ink-950">Scheduler</h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-[0.76rem] text-ink-600/70">No scheduler runs recorded yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-mist-100">
            {tasks.map((task) => (
              <li key={task.task} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[0.74rem]">
                <span className="font-bold text-ink-900">{task.task.replace(/_/g, " ")}</span>
                <span className={task.status === "completed" ? "text-mint-700" : task.status === "failed" ? "text-rose-600" : "text-amber-700"}>{task.status}</span>
                <span className="text-ink-600/70">{new Date(task.lastRun).toISOString().slice(0, 16).replace("T", " ")}Z</span>
                <span className="text-ink-600/70">{task.durationMs === null ? "—" : `${Math.round(task.durationMs / 1000)}s`} · {task.failures} failure{task.failures === 1 ? "" : "s"}</span>
                {task.error ? <span className="w-full truncate text-[0.68rem] text-rose-600">{task.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <h2 className="text-[0.9rem] font-extrabold text-ink-950">Search performance (stored)</h2>
        {metrics.length === 0 ? (
          <p className="mt-2 text-[0.76rem] text-ink-600/70">No search-engine rows stored yet. Run a Google or Bing sync to populate this — nothing is estimated.</p>
        ) : (
          <ul className="mt-2 divide-y divide-mist-100">
            {metrics.map((row) => (
              <li key={row.source} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[0.74rem]">
                <span className="font-bold uppercase text-ink-900">{row.source}</span>
                <span className="text-ink-700">{row.clicks.toLocaleString()} clicks · {row.impressions.toLocaleString()} impressions</span>
                <span className="text-ink-600/70">{row.days} rows · latest {row.latest || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <h2 className="text-[0.9rem] font-extrabold text-ink-950">Recent syncs</h2>
        {sync.length === 0 ? (
          <p className="mt-2 text-[0.76rem] text-ink-600/70">No sync has run yet. Search Console and Bing stay disconnected from this view until the scheduler runs.</p>
        ) : (
          <ul className="mt-2 divide-y divide-mist-100">
            {sync.map((row, index) => (
              <li key={`${row.provider}-${row.started_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[0.74rem]">
                <span className="font-bold uppercase text-ink-900">{row.provider}</span>
                <span className={row.status === "completed" ? "text-mint-700" : row.status === "failed" ? "text-rose-600" : "text-amber-700"}>{row.status}</span>
                <span className="text-ink-600/70">{new Date(Number(row.started_at)).toISOString().slice(0, 16).replace("T", " ")}Z</span>
                <span className="text-ink-600/70">{row.rows_written} rows</span>
                {row.error ? <span className="w-full truncate text-[0.68rem] text-rose-600">{row.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {findings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-mist-200 bg-mist-50 px-4 py-10 text-center text-[0.8rem] text-ink-600/70">
          {all.length === 0 ? "No findings yet. Run a sync and a crawl to populate the evidence layer." : "No findings match these filters."}
        </p>
      ) : (
        <ol className="space-y-2">
          {findings.map((finding) => (
            <li key={finding.findingKey} className="rounded-2xl border border-mist-200 bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-[0.08em] ${CLASS_TONE[finding.claimClass] ?? CLASS_TONE.probable_opportunity}`}>
                  {CLASS_LABEL[finding.claimClass] ?? finding.claimClass}
                </span>
                <span className="rounded-full border border-mist-200 px-2 py-0.5 text-[0.58rem] font-bold uppercase text-ink-600">Level {finding.level}</span>
                <span className="text-[0.68rem] font-bold text-ink-600/80">priority {finding.priorityScore}</span>
                {finding.disagreement ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.58rem] font-bold uppercase text-amber-800">tools disagree</span> : null}
                <span className="ml-auto text-[0.66rem] text-ink-600/60">{finding.sources.join(" + ") || "n/a"}</span>
              </div>
              <p className="mt-1.5 text-[0.82rem] font-extrabold text-ink-950">{finding.checkId.replace(/_/g, " ")}</p>
              <p className="mt-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.08em] text-ink-600/60">
                {categoryOf(finding.checkId)} · {finding.severity} · {finding.status}
                {isFindingStale(finding) ? " · stale" : ""}
              </p>
              <p className="mt-0.5 break-words text-[0.72rem] text-ink-700">
                {isPageSubject(finding)
                  ? <a href={finding.subjectKey} target="_blank" rel="noreferrer" className="text-brand-700 underline">{finding.subjectKey}</a>
                  : <span>{finding.subjectKey} <span className="text-ink-600/60">({finding.subjectType === "site" ? "reporting period, not a page" : finding.subjectType})</span></span>}
              </p>
              <p className="mt-1 text-[0.7rem] text-ink-700"><span className="font-bold">Fix:</span> {recommendationFor(finding.checkId)}</p>
              {finding.explanation ? <p className="mt-1 text-[0.68rem] text-ink-600/70">{finding.explanation}</p> : null}
              <p className="mt-1 text-[0.62rem] text-ink-600/50">
                {finding.observationCount} observation{finding.observationCount === 1 ? "" : "s"} · confidence {finding.confidence} · first seen {finding.firstSeen.slice(0, 10)} · last seen {finding.lastSeen.slice(0, 10)}
              </p>
            </li>
          ))}
        </ol>
      )}

      <Link href="/admin/seo" className="inline-flex text-[0.74rem] font-bold text-brand-700 underline">Back to SEO</Link>
    </div>
  );
}
