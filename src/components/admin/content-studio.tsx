"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FileText,
  Loader2,
  PenLine,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/components/ui";

type ReviewIssue = { severity: "critical" | "warning" | "info"; message: string; area?: string };
type Workflow = {
  id: number;
  topic: string;
  audience: string | null;
  stage: string;
  blogPostId: number | null;
  createdAt: string;
  updatedAt: string;
  post: { id: number; title: string; slug: string; status: string; scheduledFor: string | null } | null;
  data: {
    research?: {
      summary?: string;
      searchIntent?: string;
      existingCoverage?: string;
      contentGaps?: string[];
      competitorNotes?: string;
      primaryKeyword?: string;
      secondaryKeywords?: string[];
      longTailKeywords?: string[];
      sources?: { title: string; url: string; note?: string }[];
    };
    plan?: {
      title?: string;
      slug?: string;
      primaryKeyword?: string;
      outline?: { heading: string; purpose?: string }[];
      internalLinks?: { label: string; href: string; reason?: string }[];
      schemaType?: string;
    };
    draft?: { title?: string; seoTitle?: string; seoDescription?: string; sources?: { title: string; url: string }[] };
    review?: { passed?: boolean; score?: number; summary?: string; issues?: ReviewIssue[]; checkedAt?: string };
    approvedAt?: string;
    scheduledFor?: string;
    error?: string;
  };
};

const STAGE_LABEL: Record<string, string> = {
  research: "Research",
  topic_plan: "Topic plan",
  draft: "Draft",
  seo_review: "SEO review",
  approved: "Approved · human",
  scheduled: "Scheduled",
  published: "Published",
  rejected: "Rejected",
};

const STAGE_TONE: Record<string, string> = {
  topic_plan: "border-brand-200 bg-brand-50 text-brand-700",
  draft: "border-mist-200 bg-mist-50 text-ink-700",
  seo_review: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-mint-200 bg-mint-50 text-mint-800",
  scheduled: "border-brand-200 bg-brand-50 text-brand-700",
  published: "border-mint-200 bg-mint-50 text-mint-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const inputClass = "mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3.5 py-2.5 text-[0.82rem] text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelClass = "text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70";

function formatWhen(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function StageBadge({ stage }: { stage: string }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-[0.05em]", STAGE_TONE[stage] ?? "border-mist-200 bg-mist-50 text-ink-700")}>{STAGE_LABEL[stage] ?? stage}</span>;
}

export function ContentStudio() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [showResearch, setShowResearch] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/content/workflows", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; workflows?: Workflow[]; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Could not load the editorial pipeline.");
      setWorkflows(body.workflows ?? []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the editorial pipeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/content/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; workflow?: Workflow } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "The editorial operation failed.");
      if (body.workflow) setWorkflows((current) => [body.workflow!, ...current.filter((item) => item.id !== body.workflow!.id)]);
      return body.workflow;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The editorial operation failed.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function startResearch() {
    if (topic.trim().length < 8) { setError("Enter a more specific topic first."); return; }
    const sources = sourceTitle.trim() && /^https?:\/\//i.test(sourceUrl.trim())
      ? [{ title: sourceTitle.trim(), url: sourceUrl.trim() }]
      : [];
    const result = await post("research", { topic: topic.trim(), audience: audience.trim(), editorNotes: notes.trim(), sources });
    if (result) {
      setTopic("");
      setAudience("");
      setNotes("");
      setSourceTitle("");
      setSourceUrl("");
      setShowResearch(false);
      setNotice("Research and topic plan created. Review the angle before generating a draft.");
    }
  }

  async function act(action: string, workflow: Workflow, extra: Record<string, unknown> = {}) {
    const result = await post(action, { id: workflow.id, ...extra });
    if (!result) return;
    const messages: Record<string, string> = {
      draft: "Draft created as a private blog draft. It was not published.",
      review: "SEO/factual review completed. A human decision is still required.",
      approve: "Workflow approved. The blog post remains a draft until you explicitly publish or schedule it.",
      publish: "Article published.",
      schedule: "Article scheduled. It will publish on the next due-date sweep.",
      reject: "Workflow marked rejected.",
    };
    setNotice(messages[action] ?? "Workflow updated.");
  }

  const active = workflows.filter((workflow) => !["published", "rejected"].includes(workflow.stage));
  const history = workflows.filter((workflow) => ["published", "rejected"].includes(workflow.stage));

  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5" aria-labelledby="content-studio-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700"><Sparkles className="h-3 w-3" /> AI-assisted editorial</p>
          <h2 id="content-studio-title" className="mt-1 text-[1.05rem] font-extrabold tracking-tight text-ink-950">Content Studio</h2>
          <p className="mt-1 max-w-2xl text-[0.74rem] leading-relaxed text-ink-600/70">
            Research → topic plan → draft → SEO review → human approval → publish. AI output is always saved as a draft; nothing is auto-published. No live SERP or search-volume dataset is connected, so external research must be supplied by you and is never invented.
          </p>
        </div>
        <button type="button" onClick={() => setShowResearch((value) => !value)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white hover:bg-brand-600">
          <PenLine className="h-3.5 w-3.5" /> {showResearch ? "Close research form" : "Research a topic"}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[0.74rem] font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-xl border border-mint-200 bg-mint-50 px-3 py-2.5 text-[0.74rem] font-semibold text-mint-800">{notice}</p>}

      {showResearch && (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block lg:col-span-2"><span className={labelClass}>Topic / working question</span><input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={220} placeholder="e.g. How independent practices can reduce claim denials without adding staff" className={inputClass} /></label>
            <label className="block"><span className={labelClass}>Audience (optional)</span><input value={audience} onChange={(event) => setAudience(event.target.value)} maxLength={300} placeholder="Independent primary-care practice owners" className={inputClass} /></label>
            <label className="block"><span className={labelClass}>Schema (optional context)</span><input disabled value="AI will suggest Article / FAQPage" className={`${inputClass} opacity-60`} /></label>
            <label className="block lg:col-span-2"><span className={labelClass}>Editor-supplied research / competitor notes (optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={4000} placeholder="Paste verified notes, sources, competitor observations or internal priorities. Do not paste patient information. The AI will not claim to have browsed the web." className={inputClass} /></label>
            <label className="block"><span className={labelClass}>Verified source title (optional)</span><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} maxLength={200} placeholder="CMS Medicare guidance" className={inputClass} /></label>
            <label className="block"><span className={labelClass}>Verified source URL (optional)</span><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} maxLength={500} placeholder="https://www.cms.gov/..." className={inputClass} /></label>
          </div>
          <p className="mt-2 text-[0.64rem] leading-relaxed text-ink-600/60">Only sources you add here can be cited. Without a source, the model is instructed to keep factual claims general and flag uncertainty.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void startResearch()} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-[0.72rem] font-bold text-white hover:bg-brand-700 disabled:opacity-50">
              {busy === "research" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Research &amp; create topic plan
            </button>
            <button type="button" onClick={() => setShowResearch(false)} className="rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-700 hover:border-brand-300">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/75">Pipeline &amp; calendar · {active.length} active</h3>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[0.66rem] font-bold text-brand-700 hover:text-brand-500"><RefreshCw className="h-3 w-3" /> Refresh</button>
        </div>
        {loading ? <p className="mt-3 flex items-center gap-2 text-[0.74rem] text-ink-600/60"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading editorial pipeline…</p> : null}
        {!loading && workflows.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-mist-200 bg-mist-50/50 px-4 py-6 text-center">
            <FileSearch className="mx-auto h-6 w-6 text-ink-600/30" />
            <p className="mt-2 text-[0.8rem] font-extrabold text-ink-800">No AI-assisted content yet</p>
            <p className="mt-1 text-[0.7rem] text-ink-600/60">Start with a topic. You will review the plan before any draft is created.</p>
          </div>
        ) : null}
        <div className="mt-3 space-y-3">
          {active.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} busy={busy} onAction={act} />)}
        </div>
      </div>

      {history.length > 0 && (
        <details className="mt-5 rounded-xl border border-mist-200 bg-mist-50/50 p-3">
          <summary className="cursor-pointer text-[0.72rem] font-extrabold text-ink-700">Published / rejected history ({history.length})</summary>
          <div className="mt-3 space-y-2">
            {history.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} busy={busy} onAction={act} compact />)}
          </div>
        </details>
      )}
    </section>
  );
}

function WorkflowCard({ workflow, busy, onAction, compact = false }: { workflow: Workflow; busy: string | null; onAction: (action: string, workflow: Workflow, extra?: Record<string, unknown>) => Promise<void>; compact?: boolean }) {
  const [schedule, setSchedule] = useState("");
  const { data, post } = workflow;
  const review = data.review;
  const critical = review?.issues?.filter((issue) => issue.severity === "critical") ?? [];
  const warnings = review?.issues?.filter((issue) => issue.severity === "warning") ?? [];
  const actionsDisabled = Boolean(busy);

  return (
    <article className="rounded-2xl border border-mist-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><StageBadge stage={workflow.stage} /><span className="text-[0.62rem] font-semibold text-ink-600/50">#{workflow.id} · {formatWhen(workflow.updatedAt)}</span></div>
          <h4 className="mt-2 text-[0.9rem] font-extrabold leading-snug text-ink-950">{workflow.topic}</h4>
          {workflow.audience && <p className="mt-0.5 text-[0.68rem] text-ink-600/65">Audience: {workflow.audience}</p>}
        </div>
        {post && (
          <Link href={`/admin/blog/${post.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-mist-200 px-2.5 py-1.5 text-[0.64rem] font-bold text-ink-700 hover:border-brand-300">
            Edit draft <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {!compact && data.research && (
        <div className="mt-3 rounded-xl bg-mist-50 p-3">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/65">Research brief</p>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-700">{data.research.summary ?? "No summary returned."}</p>
          {data.research.searchIntent && <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-600/75"><strong>Intent:</strong> {data.research.searchIntent}</p>}
          {data.research.existingCoverage && <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-600/75"><strong>Existing Knight coverage:</strong> {data.research.existingCoverage}</p>}
          {data.research.competitorNotes && <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-600/60"><strong>Research caveat:</strong> {data.research.competitorNotes}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.research.primaryKeyword && <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.6rem] font-bold text-brand-700">Primary: {data.research.primaryKeyword}</span>}
            {(data.research.secondaryKeywords ?? []).slice(0, 5).map((keyword) => <span key={keyword} className="rounded-full border border-mist-200 bg-surface px-2 py-0.5 text-[0.6rem] font-semibold text-ink-600">{keyword}</span>)}
          </div>
          {data.research.contentGaps?.length ? <p className="mt-2 text-[0.66rem] leading-relaxed text-ink-600/70"><strong>Gaps:</strong> {data.research.contentGaps.join(" · ")}</p> : null}
        </div>
      )}

      {!compact && data.plan?.outline?.length ? (
        <details className="mt-2 rounded-xl border border-mist-200 px-3 py-2">
          <summary className="cursor-pointer text-[0.68rem] font-extrabold text-ink-700">Topic plan outline ({data.plan.outline.length} sections)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[0.7rem] text-ink-700">{data.plan.outline.map((item) => <li key={item.heading}><strong>{item.heading}</strong>{item.purpose ? ` — ${item.purpose}` : ""}</li>)}</ol>
          {(data.plan.internalLinks ?? []).length > 0 && <p className="mt-2 text-[0.64rem] text-ink-600/65">Suggested links: {data.plan.internalLinks!.map((link) => link.href).join(", ")}</p>}
        </details>
      ) : null}

      {!compact && data.review && (
        <div className={cn("mt-2 rounded-xl border p-3", review?.passed ? "border-mint-200 bg-mint-50/70" : "border-amber-200 bg-amber-50/70")}>
          <p className="flex items-center gap-1.5 text-[0.66rem] font-extrabold text-ink-800">
            {review?.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-mint-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            SEO/factual review {review?.passed ? "passed" : "needs attention"} · score {review?.score ?? 0}/100
          </p>
          {review?.summary && <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-700">{review.summary}</p>}
          <div className="mt-2 space-y-1">
            {critical.map((issue) => <p key={`${issue.area}-${issue.message}`} className="text-[0.66rem] font-semibold text-rose-700">Critical: {issue.message}</p>)}
            {warnings.slice(0, 4).map((issue) => <p key={`${issue.area}-${issue.message}`} className="text-[0.66rem] text-amber-800">Warning: {issue.message}</p>)}
          </div>
          <p className="mt-2 text-[0.6rem] text-ink-600/55">Checked {formatWhen(review?.checkedAt)}. AI-assisted review is not a substitution for your editorial judgement.</p>
        </div>
      )}

      {!compact && data.error && <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.7rem] font-semibold text-rose-700">{data.error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {workflow.stage === "topic_plan" && <button type="button" disabled={actionsDisabled} onClick={() => void onAction("draft", workflow)} className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy === "draft" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />} Generate draft</button>}
        {workflow.stage === "draft" && <button type="button" disabled={actionsDisabled} onClick={() => void onAction("review", workflow)} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-brand-700 disabled:opacity-50">{busy === "review" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} Run SEO review</button>}
        {workflow.stage === "seo_review" && (
          <>
            {review?.passed && <button type="button" disabled={actionsDisabled} onClick={() => void onAction("approve", workflow)} className="inline-flex items-center gap-1.5 rounded-full bg-mint-700 px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-mint-800 disabled:opacity-50">{busy === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} I reviewed this — approve</button>}
            {!review?.passed && <button type="button" disabled={actionsDisabled} onClick={() => void onAction("review", workflow)} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-2 text-[0.68rem] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"><RefreshCw className="h-3 w-3" /> Re-run review</button>}
            <button type="button" disabled={actionsDisabled} onClick={() => void onAction("reject", workflow)} className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3.5 py-2 text-[0.68rem] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle className="h-3 w-3" /> Reject</button>
          </>
        )}
        {workflow.stage === "approved" && (
          <>
            <button type="button" disabled={actionsDisabled} onClick={() => void onAction("publish", workflow)} className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-brand-600 disabled:opacity-50"><Send className="h-3 w-3" /> Publish now</button>
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} aria-label="Schedule publication" className="rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-[0.68rem] text-ink-800 outline-none focus:border-brand-400" />
              <button type="button" disabled={actionsDisabled || !schedule} onClick={() => void onAction("schedule", workflow, { scheduledFor: new Date(schedule).toISOString() })} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[0.66rem] font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50"><CalendarClock className="h-3 w-3" /> Schedule</button>
            </div>
          </>
        )}
        {post?.status === "scheduled" && post.scheduledFor && <span className="text-[0.68rem] font-semibold text-brand-700">Scheduled for {formatWhen(post.scheduledFor)}</span>}
        {post?.status === "published" && <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-mint-700 hover:text-mint-600">View published article <ExternalLink className="h-3 w-3" /></Link>}
        {workflow.stage === "rejected" && data.error && <span className="text-[0.68rem] text-rose-700">{data.error}</span>}
      </div>
    </article>
  );
}
