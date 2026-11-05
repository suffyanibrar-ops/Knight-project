"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Play, SearchCheck } from "lucide-react";
import { StatCard } from "@/components/admin/ui";
import type { SeoAuditResult, SeoIssueRow, SeoIssueKey } from "./types";

type IssueSectionConfig = { key: SeoIssueKey; title: string; hint: string };

const ISSUE_SECTIONS: IssueSectionConfig[] = [
  { key: "pageStatus", title: "Page status problems", hint: "Public routes that did not return HTTP 200." },
  { key: "fetchErrors", title: "Fetch errors", hint: "Routes that could not be fetched at all." },
  { key: "redirects", title: "Route redirects", hint: "Public routes that redirect instead of serving 200 directly." },
  { key: "missingTitles", title: "Missing titles", hint: "Pages without a non-empty <title>." },
  { key: "missingDescriptions", title: "Missing meta descriptions", hint: "Pages without a non-empty meta description." },
  { key: "missingCanonicals", title: "Missing canonicals", hint: "Pages without a <link rel=\"canonical\">." },
  { key: "canonicalMismatch", title: "Canonical mismatches", hint: "Canonical URLs that point at a different path." },
  { key: "noindexLeaks", title: "Noindex leaks", hint: "Public pages that are accidentally marked noindex." },
  { key: "h1Issues", title: "Heading issues", hint: "Pages that do not have exactly one H1." },
  { key: "missingLang", title: "Missing lang attribute", hint: "Pages whose <html> element has no lang attribute." },
  { key: "missingAlt", title: "Images without alt", hint: "Images with no alt attribute at all (alt=\"\" is acceptable)." },
  { key: "invalidJsonLd", title: "Invalid JSON-LD", hint: "Structured-data blocks that fail to parse as JSON." },
  { key: "missingJsonLd", title: "Missing JSON-LD", hint: "Pages with no structured-data block." },
  { key: "brokenLinks", title: "Broken internal links", hint: "Internal links returning 4xx/5xx or failing to load." },
  { key: "linkRedirects", title: "Internal link redirects", hint: "Internal links that redirect instead of returning 200 directly." },
  { key: "brokenImages", title: "Broken images", hint: "Image URLs that return 4xx/5xx or fail to load." },
];

export function SeoAudit() {
  const [result, setResult] = useState<SeoAuditResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/seo/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const record = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
      if (!response.ok || record?.ok !== true) {
        const message = typeof record?.error === "string" ? record.error : `The audit request failed (HTTP ${response.status}).`;
        throw new Error(message);
      }
      setResult(payload as SeoAuditResult);
    } catch (auditFailure) {
      setError(auditFailure instanceof Error && auditFailure.message ? auditFailure.message : "The audit could not be completed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-extrabold tracking-tight text-ink-950">
              <SearchCheck className="h-4 w-4 text-brand-600" /> Live technical crawl
            </h2>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-600/80">
              Every audit fetches the real public pages and checks the served HTML. Nothing is simulated: counts and tables below come from the
              response of that crawl, and an audit can take up to a minute depending on how many pages are published.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runAudit()}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Crawling the public site…" : result ? "Run audit again" : "Run audit"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[0.76rem] font-semibold text-rose-700">
            {error}
          </p>
        )}
      </section>

      {!result && !running && (
        <div className="rounded-2xl border border-dashed border-mist-300 bg-surface p-10 text-center">
          <p className="text-sm font-extrabold text-ink-900">No audit has run in this session.</p>
          <p className="mx-auto mt-1.5 max-w-md text-[0.8rem] leading-relaxed text-ink-600/80">
            Run the audit to crawl the live public site and list real metadata, indexability, link, image and structured-data problems. Results are
            never cached or invented.
          </p>
        </div>
      )}

      {running && !result && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-mist-200 bg-surface p-10 text-[0.82rem] font-semibold text-ink-600/80">
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> Auditing the public site — this can take up to a minute…
        </div>
      )}

      {result && <AuditReport result={result} />}
    </div>
  );
}

function AuditReport({ result }: { result: SeoAuditResult }) {
  const { summary } = result;
  const missingMetadata = summary.missingTitles + summary.missingDescriptions + summary.missingCanonicals + summary.canonicalMismatches;
  const indexabilityIssues = summary.noindexLeaks + summary.h1Issues;

  const duplicateRows = [
    ...result.duplicateTitles.map((row) => ({ path: row.paths.join(" · "), detail: `${row.detail} Title: “${row.title}”` })),
    ...result.duplicateDescriptions.map((row) => ({ path: row.paths.join(" · "), detail: `${row.detail} Description: “${row.description}”` })),
  ];

  const sections = ISSUE_SECTIONS.map((section) => ({ ...section, rows: result.issues[section.key] ?? [] }));
  const totalIssues = sections.reduce((sum, section) => sum + section.rows.length, 0) + duplicateRows.length;

  return (
    <div className="space-y-4">
      <p className="text-[0.7rem] font-semibold text-ink-600/70">
        Last audit: {new Date(result.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} ·{" "}
        {result.auditedRoutes} routes checked · base {result.baseUrl}
        {result.truncated ? " · capped at 80 routes (the route inventory was longer)" : ""}
      </p>

      {result.truncated && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.74rem] font-semibold leading-relaxed text-amber-900">
          The inventory contained more than 80 routes, so this audit only checked the first 80 (static pages, detail pages, then blog posts/categories/tags).
        </p>
      )}

      {(summary.fetchErrors ?? 0) > 0 && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[0.74rem] font-semibold leading-relaxed text-rose-800">
          {summary.fetchErrors} routes could not be fetched from <span className="font-mono">{summary.auditBaseUrl ?? result.baseUrl}</span>. The audit crawls the
          configured public site URL, so the running site must answer on that exact origin. Fix <span className="font-mono">NEXT_PUBLIC_SITE_URL</span> (or start the
          server on that origin) and re-run.
        </p>
      )}

      {result.warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.72rem] font-semibold leading-relaxed text-amber-900">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total pages checked" value={summary.totalPages} hint={`${summary.checkedOk} with no issues`} tone="brand" />
        <StatCard label="Pages with issues" value={summary.pagesWithIssues} tone={summary.pagesWithIssues > 0 ? "warn" : "good"} />
        <StatCard
          label="Missing metadata"
          value={missingMetadata}
          hint={`${summary.missingTitles} titles · ${summary.missingDescriptions} descriptions · ${summary.missingCanonicals} canonicals · ${summary.canonicalMismatches} canonical mismatches`}
          tone={missingMetadata > 0 ? "warn" : "good"}
        />
        <StatCard label="Broken links" value={summary.brokenLinks} hint={`${result.issues.linkRedirects.length} internal links redirect`} tone={summary.brokenLinks > 0 ? "warn" : "good"} />
        <StatCard label="Broken images" value={summary.brokenImages} tone={summary.brokenImages > 0 ? "warn" : "good"} />
        <StatCard label="Images missing alt" value={summary.missingAlt} hint="No alt attribute at all" tone={summary.missingAlt > 0 ? "warn" : "good"} />
        <StatCard
          label="Indexability issues"
          value={indexabilityIssues}
          hint={`${summary.noindexLeaks} noindex leaks · ${summary.h1Issues} heading issues`}
          tone={indexabilityIssues > 0 ? "warn" : "good"}
        />
        <StatCard label="Invalid JSON-LD" value={summary.invalidJsonLd} hint={`${summary.redirects} route redirects`} tone={summary.invalidJsonLd > 0 ? "warn" : "good"} />
      </div>

      {totalIssues === 0 && (summary.fetchErrors ?? 0) === 0 ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-mint-200 bg-mint-50 px-4 py-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-700" />
          <div>
            <p className="text-[0.82rem] font-extrabold text-mint-800">No issues found in this audit.</p>
            <p className="mt-0.5 text-[0.74rem] leading-relaxed text-mint-700">
              All {summary.totalPages} audited routes returned 200 with a single title, description, canonical, one H1, complete alt attributes and valid structured data.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {duplicateRows.length > 0 && (
            <IssueSection title="Duplicate titles / descriptions" hint="Identical metadata reused across multiple pages." rows={duplicateRows} />
          )}
          {sections
            .filter((section) => section.rows.length > 0)
            .map((section) => (
              <IssueSection key={section.key} title={section.title} hint={section.hint} rows={section.rows} />
            ))}
        </div>
      )}
    </div>
  );
}

function IssueSection({ title, hint, rows }: { title: string; hint: string; rows: SeoIssueRow[] }) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-mist-200 bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[0.82rem] font-extrabold text-ink-950">{title}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.6rem] font-extrabold text-amber-700">{rows.length}</span>
          </span>
          <span className="mt-0.5 block text-[0.68rem] font-medium text-ink-600/70">{hint}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-600/60 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="overflow-x-auto border-t border-mist-100">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="bg-mist-50/70">
              <th scope="col" className="w-[16rem] px-3 py-2 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">
                Path
              </th>
              <th scope="col" className="px-3 py-2 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">
                Detail
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.path}-${index}`} className="border-t border-mist-100 align-top">
                <td className="px-3 py-2 font-mono text-[0.7rem] font-semibold text-ink-800">{row.path}</td>
                <td className="px-3 py-2 text-[0.74rem] leading-relaxed text-ink-700">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
