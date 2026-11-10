"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, ExternalLink, ImagePlus, Loader2, PenLine, Play, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = "research" | "topic_plan" | "draft" | "seo_review" | "approved" | "scheduled" | "published" | "rejected";
type AutomationStatus = "idle" | "researching" | "generating" | "reviewing" | "fixing" | "rechecking" | "ready" | "needs_attention" | "failed" | "approved" | "scheduled" | "published";
type Issue = { severity: "critical" | "warning" | "info"; area?: string; message: string };
type Workflow = {
  id: number;
  topic: string;
  audience: string | null;
  stage: Stage;
  blogPostId: number | null;
  createdAt: string;
  updatedAt: string;
  post: { id: number; title: string; slug: string; status: string; scheduledFor: string | null; updatedAt: string } | null;
  data: {
    plan?: { title?: string };
    review?: { passed?: boolean; score?: number; summary?: string; issues?: Issue[]; checkedAt?: string };
    automation?: {
      status: AutomationStatus;
      step: string;
      attempts: number;
      lastError?: string | null;
      steps: Record<string, "pending" | "running" | "completed" | "failed" | "skipped">;
      corrections?: { pass: number; summary: string; changedFields: string[]; issuesAddressed: string[] }[];
      unresolved?: string[];
      taxonomy?: { categoryName: string | null; tagNames: string[] };
    };
    taxonomy?: { categoryName: string | null; tagNames: string[] };
    approvedAt?: string;
    publishedAt?: string;
    error?: string;
  };
};

const STEPS = ["research", "generate", "review", "taxonomy", "finalize"] as const;
type Step = (typeof STEPS)[number];

function formatWhen(value: string | null | undefined): string {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function automationStatus(workflow: Workflow): AutomationStatus {
  if (workflow.stage === "published") return "published";
  if (workflow.stage === "approved") return "approved";
  if (workflow.stage === "scheduled") return "scheduled";
  if (workflow.stage === "rejected") return "failed";
  return workflow.data.automation?.status ?? (workflow.stage === "seo_review" ? "ready" : "idle");
}

const STATUS_LABEL: Record<AutomationStatus, string> = {
  idle: "Research ready",
  researching: "Researching",
  generating: "Generating",
  reviewing: "Reviewing",
  fixing: "Fixing issues",
  rechecking: "Rechecking",
  ready: "Ready for review",
  needs_attention: "Needs your attention",
  failed: "Failed",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
};

const TONE: Record<AutomationStatus, string> = {
  idle: "border-mist-200 bg-mist-50 text-ink-700",
  researching: "border-brand-200 bg-brand-50 text-brand-700",
  generating: "border-brand-200 bg-brand-50 text-brand-700",
  reviewing: "border-amber-200 bg-amber-50 text-amber-800",
  fixing: "border-amber-200 bg-amber-50 text-amber-800",
  rechecking: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-mint-200 bg-mint-50 text-mint-800",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-red-200 bg-red-50 text-red-700",
  approved: "border-mint-200 bg-mint-50 text-mint-800",
  scheduled: "border-brand-200 bg-brand-50 text-brand-700",
  published: "border-mint-200 bg-mint-50 text-mint-800",
};

function nextAction(workflow: Workflow): string {
  const status = automationStatus(workflow);
  if (status === "published") return "Published — view the live article or edit it in the blog editor.";
  if (status === "approved") return "Approved — publish when ready.";
  if (status === "scheduled") return "Scheduled — publishing is handled automatically when due.";
  if (status === "failed") return "The last AI step failed. Your draft is saved. Retry when ready.";
  if (status === "needs_attention") return "Review the flagged items below before approving.";
  if (status === "ready") return "The article is ready for your final review and approval.";
  if (workflow.stage === "seo_review") return "Review the AI findings, then approve or retry the review.";
  if (workflow.stage === "draft") return "Draft created. Run the AI review and corrections.";
  if (workflow.stage === "topic_plan") return "Research and plan are ready. Generate and review the draft.";
  return "Run the AI workflow to research, write and validate this article.";
}

function currentStep(workflow: Workflow): string {
  const status = automationStatus(workflow);
  if (status === "published") return "Complete";
  if (status === "approved") return "Human approval";
  if (status === "ready") return "Human approval";
  if (status === "needs_attention") return "Human attention";
  if (status === "failed") return "Retry available";
  const steps = workflow.data.automation?.steps;
  if (!steps) return workflow.stage === "topic_plan" ? "Research ready" : "Not started";
  const pending = STEPS.find((step) => steps[step] !== "completed");
  return pending ? pending[0].toUpperCase() + pending.slice(1) : "Validating";
}

async function api(body: Record<string, unknown>): Promise<{ workflow?: Workflow; error?: string }> {
  const response = await fetch("/api/admin/content/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = (await response.json().catch(() => null)) as { ok?: boolean; workflow?: Workflow; error?: string } | null;
  if (!response.ok || !result?.ok) throw new Error(result?.error ?? "The request could not be completed.");
  return result;
}

export function BlogWorkspace() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/content/workflows", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; workflows?: Workflow[]; error?: string } | null;
      if (response.status === 401) { window.location.assign("/admin/login"); return; }
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Could not load the blog workspace.");
      setWorkflows(body.workflows ?? []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the blog workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  function merge(workflow: Workflow) {
    setWorkflows((current) => [workflow, ...current.filter((item) => item.id !== workflow.id)]);
  }

  function updateFrom(workflow: Workflow) { merge(workflow); }

  async function runRemaining(start: Workflow): Promise<boolean> {
    let current = start;
    const recheck = current.data.automation?.status === "needs_attention";
    for (const step of STEPS) {
      const steps = current.data.automation?.steps;
      if (steps?.[step] === "completed" && !(recheck && (step === "review" || step === "finalize"))) continue;
      if (step === "research" && current.data.plan) continue;
      try {
        setProgress(`${step[0].toUpperCase() + step.slice(1)}…`);
        const result = await api({ action: "automation_step", id: current.id, step });
        if (!result.workflow) throw new Error("The workflow did not return an updated article.");
        current = result.workflow;
        updateFrom(current);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "The AI workflow stopped.");
        return false;
      }
    }
    setMessage("AI workflow finished. Review the article and approve when you are ready.");
    return true;
  }

  async function createAndRun() {
    if (topic.trim().length < 8) { setError("Enter a more specific topic first."); return; }
    setBusy(true); setError(null); setMessage(null); setProgress("Researching…");
    try {
      const research = await api({ action: "research", topic: topic.trim(), audience: audience.trim() });
      if (!research.workflow) throw new Error("Research did not return a workflow.");
      setTopic(""); setAudience("");
      updateFrom(research.workflow);
      const completed = await runRemaining(research.workflow);
      if (completed) setMessage("Research, draft, review, corrections, categories and tags are complete. Your final review is next.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The article could not be created.");
    } finally { setBusy(false); setProgress(null); }
  }

  async function retry(workflow: Workflow) {
    setBusy(true); setError(null); setMessage(null); setProgress("Starting…");
    try {
      const completed = await runRemaining(workflow);
      await load();
      if (!completed) return;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The workflow could not be resumed.");
    } finally { setBusy(false); setProgress(null); }
  }

  async function approve(workflow: Workflow) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await api({ action: "approve", id: workflow.id });
      if (result.workflow) updateFrom(result.workflow);
      setMessage("Approved. Nothing is live yet — publish when you are ready.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This article could not be approved.");
    } finally { setBusy(false); }
  }

  async function publish(workflow: Workflow) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await api({ action: "publish", id: workflow.id });
      if (result.workflow) updateFrom(result.workflow);
      setMessage("Published. The article is now live.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This article could not be published.");
    } finally { setBusy(false); }
  }

  const sorted = useMemo(() => [...workflows].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [workflows]);
  const active = sorted.filter((workflow) => !["published", "rejected"].includes(workflow.stage));
  const completed = sorted.filter((workflow) => ["published", "rejected"].includes(workflow.stage));

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-mist-200 bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-brand-700">Editorial</p>
            <h1 className="mt-1 text-[1.55rem] font-extrabold tracking-tight text-ink-950">Blog workspace</h1>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-600">One place to create, research, review, correct, categorize and publish blog articles. AI does the production work; you make the final call and control images.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/content" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-700 hover:border-brand-300">Advanced tools <ArrowRight className="h-3 w-3" /></Link>
            <Link href="/admin/blog" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-700 hover:border-brand-300">Blog editor <ArrowRight className="h-3 w-3" /></Link>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex items-center gap-2 text-[0.78rem] font-extrabold text-ink-950"><Sparkles className="h-4 w-4 text-brand-700" /> Start a new article</div>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-600">AI researches, drafts, reviews, fixes safe issues, checks again, and assigns relevant categories and tags. It never publishes without your approval.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_15rem_auto]">
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic, e.g. How independent practices can reduce claim denials" aria-label="Article topic" maxLength={220} className="min-h-11 rounded-xl border border-mist-200 bg-white px-3 text-[0.8rem] text-ink-900 outline-none focus:border-brand-400" />
            <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Audience (optional)" aria-label="Audience" maxLength={300} className="min-h-11 rounded-xl border border-mist-200 bg-white px-3 text-[0.8rem] text-ink-900 outline-none focus:border-brand-400" />
            <button type="button" onClick={() => void createAndRun()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-night-soft px-4 text-[0.74rem] font-extrabold text-white hover:bg-brand-600 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {busy ? "Working…" : "Create with AI"}
            </button>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-[0.75rem] font-semibold text-red-700"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
      {busy && progress && <div role="status" className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-[0.75rem] font-semibold text-brand-800"><Loader2 className="h-4 w-4 animate-spin" /> {progress} AI is working. Your article is saved as it progresses.</div>}
      {message && <div role="status" className="flex items-start gap-2 rounded-2xl border border-mint-200 bg-mint-50 p-3 text-[0.75rem] font-semibold text-mint-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-[0.95rem] font-extrabold tracking-tight text-ink-950">Your articles</h2><p className="mt-0.5 text-[0.7rem] text-ink-600/65">Everything in progress, plus what needs you next.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3 py-1.5 text-[0.66rem] font-bold text-ink-700 hover:border-brand-300 disabled:opacity-50"><RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh</button>
      </div>

      {loading ? <div className="rounded-2xl border border-mist-200 bg-surface p-8 text-center text-[0.75rem] text-ink-600"><Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-600" /><p className="mt-2">Loading the workspace…</p></div> : null}

      {!loading && active.length === 0 && completed.length === 0 ? <div className="rounded-2xl border border-dashed border-mist-300 bg-surface p-8 text-center"><p className="text-[0.9rem] font-extrabold text-ink-900">No articles yet</p><p className="mt-1 text-[0.74rem] text-ink-600">Start with a topic above. Your first AI-assisted draft will appear here.</p></div> : null}

      <div className="space-y-3">
        {[...active, ...completed].map((workflow) => {
          const status = automationStatus(workflow);
          const issues = workflow.data.review?.issues ?? [];
          const critical = issues.filter((issue) => issue.severity === "critical");
          const warnings = issues.filter((issue) => issue.severity === "warning");
          const automation = workflow.data.automation;
          const canRun = !["approved", "scheduled", "published", "rejected", "ready"].includes(status);
          return (
            <article key={workflow.id} className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mist-100 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-[0.1em]", TONE[status])}>{status === "idle" && workflow.stage === "draft" ? "Draft ready" : status === "idle" && workflow.stage === "seo_review" && workflow.data.review?.passed && !workflow.data.taxonomy ? "Categories pending" : STATUS_LABEL[status]}</span>
                    <span className="text-[0.6rem] font-semibold text-ink-600/55">Updated {formatWhen(workflow.updatedAt)}</span>
                    {automation?.attempts ? <span className="text-[0.6rem] font-semibold text-ink-600/55">{automation.attempts} AI step{automation.attempts === 1 ? "" : "s"}</span> : null}
                  </div>
                  <h3 className="mt-1.5 text-[0.95rem] font-extrabold leading-snug tracking-tight text-ink-950">{workflow.post?.title ?? workflow.data.plan?.title ?? workflow.topic}</h3>
                  <p className="mt-1 line-clamp-2 text-[0.72rem] leading-relaxed text-ink-600">{workflow.topic}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {workflow.post ? <Link href={`/admin/blog/preview/${workflow.post.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-full border border-mist-200 px-2.5 py-1.5 text-[0.64rem] font-bold text-ink-700 hover:border-brand-300"><ExternalLink className="h-3 w-3" /> Preview</Link> : null}
                  {workflow.post ? <Link href={`/admin/blog/${workflow.post.id}`} className="inline-flex items-center gap-1 rounded-full border border-mist-200 px-2.5 py-1.5 text-[0.64rem] font-bold text-ink-700 hover:border-brand-300"><PenLine className="h-3 w-3" /> Edit</Link> : null}
                  {canRun ? <button type="button" onClick={() => void retry(workflow)} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-night-soft px-2.5 py-1.5 text-[0.64rem] font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} {status === "failed" ? "Retry AI" : "Run AI"}</button> : null}
                  {status === "ready" ? <button type="button" onClick={() => void approve(workflow)} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1.5 text-[0.64rem] font-bold text-white hover:bg-brand-700 disabled:opacity-50"><CheckCircle2 className="h-3 w-3" /> Approve</button> : null}
                  {status === "approved" && workflow.post?.status !== "published" ? <button type="button" onClick={() => void publish(workflow)} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-mint-700 px-2.5 py-1.5 text-[0.64rem] font-bold text-white hover:bg-mint-600 disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Publish</button> : null}
                  {status === "published" && workflow.post ? <Link href={`/blog/${workflow.post.slug}`} target="_blank" className="inline-flex items-center gap-1 rounded-full border border-mint-200 bg-mint-50 px-2.5 py-1.5 text-[0.64rem] font-bold text-mint-800 hover:bg-mint-100">View live <ExternalLink className="h-3 w-3" /></Link> : null}
                </div>
              </div>

              <div className="grid gap-3 p-4 lg:grid-cols-[1fr_17rem]">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[0.7rem] font-bold text-ink-800"><Clock3 className="h-3.5 w-3.5 text-brand-700" /> Next: {nextAction(workflow)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {STEPS.map((step) => {
                      const state = automation?.steps?.[step] ?? (step === "finalize" && status === "ready" ? "completed" : "pending");
                      return <span key={step} className={cn("rounded-full border px-2 py-0.5 text-[0.58rem] font-bold capitalize", state === "completed" ? "border-mint-200 bg-mint-50 text-mint-800" : state === "failed" ? "border-red-200 bg-red-50 text-red-700" : state === "running" ? "border-brand-200 bg-brand-50 text-brand-700" : "border-mist-200 bg-mist-50 text-ink-600/60")}>{state === "completed" ? "✓ " : ""}{step}</span>;
                    })}
                  </div>

                  {workflow.data.review?.summary ? <p className="mt-3 rounded-xl border border-mist-200 bg-mist-50/60 p-3 text-[0.7rem] leading-relaxed text-ink-700"><strong className="text-ink-900">AI review:</strong> {workflow.data.review.summary}</p> : null}

                  {critical.length || warnings.length ? <div className="mt-3 space-y-1.5">
                    {critical.slice(0, 4).map((issue, index) => <p key={`critical-${index}`} className="flex items-start gap-1.5 text-[0.68rem] font-semibold text-red-700"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> <span>{issue.message}</span></p>)}
                    {warnings.slice(0, 4).map((issue, index) => <p key={`warning-${index}`} className="flex items-start gap-1.5 text-[0.66rem] text-amber-800"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> <span>{issue.message}</span></p>)}
                  </div> : null}

                  {automation?.unresolved?.length ? <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[0.66rem] leading-relaxed text-amber-800"><strong>Human judgment:</strong> {automation.unresolved.slice(0, 2).join(" ")}</p> : null}
                </div>

                <div className="min-w-0 rounded-xl border border-mist-200 bg-mist-50/50 p-3">
                  <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/55">What AI changed</p>
                  {automation?.corrections?.length ? <ul className="mt-1.5 space-y-1">{automation.corrections.slice(-3).map((correction, index) => <li key={`${correction.pass}-${index}`} className="text-[0.66rem] leading-relaxed text-ink-700"><span className="font-bold">Pass {correction.pass}:</span> {correction.summary}</li>)}</ul> : <p className="mt-1 text-[0.66rem] leading-relaxed text-ink-600/65">No automatic corrections yet.</p>}
                  <div className="mt-3 border-t border-mist-200 pt-2">
                    <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/55">Categories & tags</p>
                    {workflow.data.taxonomy || automation?.taxonomy ? <p className="mt-1 text-[0.66rem] leading-relaxed text-ink-700">{workflow.data.taxonomy?.categoryName ?? automation?.taxonomy?.categoryName ?? "Unassigned"}{workflow.data.taxonomy?.tagNames?.length || automation?.taxonomy?.tagNames?.length ? <span className="block text-ink-600/70">{(workflow.data.taxonomy?.tagNames ?? automation?.taxonomy?.tagNames ?? []).join(" · ")}</span> : null}</p> : <p className="mt-1 text-[0.66rem] text-ink-600/65">Assigned automatically after review.</p>}
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-[0.6rem] text-ink-600/55"><ImagePlus className="h-3 w-3" /> Images are optional and always yours.</p>
                </div>
              </div>
              {automation?.lastError ? <p className="border-t border-red-100 bg-red-50/60 px-4 py-2 text-[0.66rem] text-red-700">{automation.lastError}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
