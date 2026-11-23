"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ScanText } from "lucide-react";

import { analysisFingerprint } from "@/lib/content-originality";

type Severity = "critical" | "warning" | "suggestion" | "passed";
type Source = "saved" | "live";
interface Finding { id: string; category: string; severity: Severity; title: string; detail: string; where?: string; fix: string }
interface Result { findings: Finding[]; counts: Record<Severity, number>; metrics: { words: number; paragraphs: number; headings: number; internalLinks: number; similarityMax: number }; limitations: string }

const TONE: Record<Severity, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  suggestion: "border-brand-200 bg-brand-50 text-brand-800",
  passed: "border-mint-200 bg-mint-50 text-mint-800",
};

/** Deterministic originality check for one article. Read-only: it never edits or publishes. */
export function OriginalityPanel(props: {
  posts?: { id: number; title: string }[];
  /** Live editor state. When present, analysis runs on this, not on the saved copy. */
  live?: { title: string; contentHtml: string };
}) {
  const posts = props.posts ?? [];
  const [postId, setPostId] = useState<number | "">(posts[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [analysed, setAnalysed] = useState<{ fingerprint: string; source: Source } | null>(null);

  const liveFingerprint = props.live ? analysisFingerprint(props.live.title, props.live.contentHtml) : null;
  const stale = Boolean(analysed && liveFingerprint && analysed.source === "live" && analysed.fingerprint !== liveFingerprint);
  const usingLive = Boolean(props.live);

  async function run() {
    const payloadBody = props.live
      ? { title: props.live.title, contentHtml: props.live.contentHtml }
      : postId === "" ? null : { postId };
    if (!payloadBody) return;
    const fingerprint = props.live
      ? analysisFingerprint(props.live.title, props.live.contentHtml)
      : analysisFingerprint(`post:${postId}`, "");
    setState("loading"); setError(""); setResult(null); setAnalysed(null);
    try {
      const response = await fetch("/api/admin/blog/originality", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Analysis failed.");
      setResult(payload.result as Result);
      setAnalysed({ fingerprint, source: props.live ? "live" : "saved" });
      setState("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis failed.");
      setState("error");
    }
  }

  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.92rem] font-extrabold tracking-tight text-ink-950">Originality &amp; quality check</h2>
          <p className="mt-0.5 text-[0.72rem] text-ink-600/80">
            Deterministic, local checks. Nothing is sent to an external service and nothing is published.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {usingLive ? null : <label className="sr-only" htmlFor="originality-post">Article</label>}
          {usingLive ? null : <select
            id="originality-post"
            value={postId}
            onChange={(event) => setPostId(event.target.value === "" ? "" : Number(event.target.value))}
            className="max-w-[16rem] rounded-xl border border-mist-200 bg-surface px-3 py-2 text-[0.74rem] font-semibold text-ink-800 outline-none focus:border-brand-400"
          >
            {posts.length === 0 ? <option value="">No articles yet</option> : null}
            {posts.map((post) => <option key={post.id} value={post.id}>{post.title}</option>)}
          </select>}
          <button type="button" onClick={run} disabled={state === "loading" || (!usingLive && postId === "")} className="btn btn-primary px-3.5 py-2 text-[0.72rem] disabled:opacity-60">
            {state === "loading" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing…</> : <><ScanText className="h-3.5 w-3.5" /> Analyse</>}
          </button>
        </div>
      </div>

      {stale ? (
        <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.72rem] font-semibold text-amber-900">
          The editor content changed after this analysis. These results describe the earlier version — run the check again.
        </p>
      ) : null}

      {state === "error" ? (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.74rem] font-semibold text-rose-800">{error}</p>
      ) : null}

      {state === "done" && result ? (
        <div className="mt-4 space-y-3">
          <p className="text-[0.66rem] font-bold text-ink-600/80">
            Analysed: {analysed?.source === "live" ? "current unsaved draft" : "saved article"}
            {stale ? " (superseded by later edits)" : ""}
          </p>
          <div className="flex flex-wrap gap-2 text-[0.64rem] font-extrabold uppercase tracking-[0.08em]">
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800">Critical {result.counts.critical}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">Warnings {result.counts.warning}</span>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-brand-800">Suggestions {result.counts.suggestion}</span>
            <span className="rounded-full border border-mist-200 px-2 py-1 text-ink-700">{result.metrics.words} words · {result.metrics.headings} headings · {result.metrics.internalLinks} internal links</span>
          </div>

          <ul className="space-y-2">
            {result.findings.map((finding) => (
              <li key={finding.id} className={`rounded-xl border px-3 py-2.5 ${TONE[finding.severity]}`}>
                <p className="flex items-center gap-1.5 text-[0.78rem] font-extrabold">
                  {finding.severity === "passed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {finding.title}
                </p>
                <p className="mt-0.5 text-[0.74rem] leading-relaxed">{finding.detail}</p>
                {finding.where ? <p className="mt-0.5 text-[0.68rem] opacity-80">Where: {finding.where}</p> : null}
                <p className="mt-1 text-[0.7rem] font-semibold">Fix: {finding.fix}</p>
              </li>
            ))}
          </ul>
          <p className="text-[0.66rem] leading-relaxed text-ink-600/70">{result.limitations}</p>
        </div>
      ) : null}

      {state === "idle" ? (
        <p className="mt-3 rounded-xl border border-dashed border-mist-200 bg-mist-50 px-3 py-6 text-center text-[0.74rem] text-ink-600/70">
          {usingLive ? "Run the check to analyse the draft exactly as it stands in the editor." : "Choose an article and run the check to see duplicate, repetition, thin-content, keyword, link and claim findings."}
        </p>
      ) : null}
    </section>
  );
}
