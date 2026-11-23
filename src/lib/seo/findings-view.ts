import type { StoredFinding } from "./store";

/**
 * Pure view helpers for the SEO findings dashboard (Phase 6, Stage 1).
 *
 * Filtering and counting live here so the page stays presentational and the
 * behaviour is testable without a database or a browser.
 */

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type SeverityFilter = (typeof SEVERITIES)[number] | "all";

export const CATEGORIES = ["metadata", "canonical", "indexability", "schema", "headings", "images", "links", "content", "crawl", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Check ids are namespaced by their subject, so category is derivable. */
export function categoryOf(checkId: string): Category {
  const id = checkId.toLowerCase();
  if (id.startsWith("title") || id.startsWith("meta_description")) return "metadata";
  if (id.startsWith("canonical")) return "canonical";
  if (id.startsWith("robots") || id.startsWith("http_error")) return "indexability";
  if (id.startsWith("schema")) return "schema";
  if (id.startsWith("h1") || id.startsWith("heading")) return "headings";
  if (id.startsWith("content_heading")) return "headings";
  if (id.startsWith("image")) return "images";
  if (id.includes("link")) return "links";
  if (id.startsWith("content")) return "content";
  if (id.startsWith("http_")) return "crawl";
  return "other";
}

/**
 * Short, check-specific remediation text. The dashboard previously showed only a
 * priority explanation, which tells an editor how urgent something is but not
 * what to change. This map is deliberately mechanical: one sentence per check.
 */
export function recommendationFor(checkId: string): string {
  const id = checkId.toLowerCase();
  if (id === "image_alt_missing") return "Add a descriptive alt attribute, or alt=\"\" if the image is purely decorative.";
  if (id === "title_missing") return "Add a unique, descriptive <title> that names the page topic.";
  if (id === "title_length_out_of_range") return "Rewrite the title so the primary phrase fits roughly 25–60 characters.";
  if (id === "meta_description_missing") return "Add a unique meta description that summarises the page and its next step.";
  if (id === "meta_description_length_out_of_range") return "Rewrite the description to roughly 70–160 characters without cutting a sentence.";
  if (id === "canonical_missing") return "Add a self-referencing canonical link for the page's preferred URL.";
  if (id === "canonical_mismatch") return "Point the canonical at the page's own final URL, or remove conflicting duplicates.";
  if (id === "robots_noindex") return "Remove noindex from a page that should be indexed; verify intent before changing.";
  if (id === "h1_missing") return "Add one H1 that states the page's primary topic.";
  if (id === "h1_multiple") return "Keep one H1 and demote the others to H2 or H3.";
  if (id.startsWith("content_heading")) return "Add logical H2/H3 sections and avoid skipping heading levels.";
  if (id === "content_thin") return "Expand the page with specific, useful detail, or consolidate it with a stronger page.";
  if (id === "content_readability_hard") return "Shorten sentences and paragraphs; explain specialist terms in plain language.";
  if (id === "content_passive_voice") return "Rewrite passive constructions where an active subject improves clarity.";
  if (id === "content_keyword_density") return "Write naturally: reduce repetition or make the topic explicit if the page is vague.";
  if (id === "http_error_status") return "Fix the route so it returns the intended HTTP status and content.";
  if (id === "http_redirect_chain") return "Link directly to the final URL and collapse intermediate redirects.";
  if (id === "schema_invalid_json") return "Fix the JSON-LD syntax so the block parses as valid JSON.";
  if (id === "schema_missing_type") return "Give every structured-data block a valid @type.";
  if (id.startsWith("bing_")) return "Data-quality observation from Bing. Correct the normalisation or confirm the property; do not edit a page for it.";
  if (id.startsWith("gsc_") || id.startsWith("opportunity_")) return "Editorial opportunity from search data. Review the query and page before changing content.";
  return "Review the evidence for this check and confirm on a fresh crawl before acting.";
}

export function isPageSubject(finding: Pick<StoredFinding, "subjectType" | "subjectKey">): boolean {
  if (finding.subjectType !== "url") return false;
  try {
    return /^https?:$/.test(new URL(finding.subjectKey).protocol);
  } catch {
    return false;
  }
}

export function isSeverity(value: string | undefined): value is SeverityFilter {
  return value === "all" || (SEVERITIES as readonly string[]).includes(value ?? "");
}

export function isCategory(value: string | undefined): value is Category {
  return (CATEGORIES as readonly string[]).includes(value ?? "");
}

export interface ViewFilters { severity: SeverityFilter; category: Category | "all"; query: string }

export function parseFilters(params: { severity?: string; category?: string; q?: string }): ViewFilters {
  return {
    severity: isSeverity(params.severity) ? params.severity : "all",
    category: isCategory(params.category) ? params.category : "all",
    query: (params.q ?? "").trim().slice(0, 120),
  };
}

export function filterFindings(findings: StoredFinding[], filters: ViewFilters): StoredFinding[] {
  const needle = filters.query.toLowerCase();
  return findings.filter((finding) => {
    if (filters.severity !== "all" && finding.severity !== filters.severity) return false;
    if (filters.category !== "all" && categoryOf(finding.checkId) !== filters.category) return false;
    if (needle && !finding.subjectKey.toLowerCase().includes(needle) && !finding.checkId.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export interface Summary {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  affectedUrls: number;
  worstSeverity: string | null;
}

export function summarise(findings: StoredFinding[]): Summary {
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const urls = new Set<string>();
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    const category = categoryOf(finding.checkId);
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    // Only real page subjects count as affected URLs. Site-level periods and
    // search queries are not pages, and a malformed API field must never inflate
    // this number.
    if (isPageSubject(finding)) urls.add(finding.subjectKey);
  }
  const worstSeverity = SEVERITIES.find((severity) => (bySeverity[severity] ?? 0) > 0) ?? null;
  return { total: findings.length, bySeverity, byCategory, affectedUrls: urls.size, worstSeverity };
}

/** Per-finding staleness, separate from the dataset-level warning. */
export function isFindingStale(finding: Pick<StoredFinding, "lastSeen">, now = Date.now(), maxAgeHours = 48): boolean {
  const seen = Date.parse(finding.lastSeen);
  if (!Number.isFinite(seen)) return true;
  return now - seen > maxAgeHours * 3600_000;
}

/**
 * Data is stale when the newest observation-backed finding is older than the
 * freshness window. Derived from persisted timestamps only — never guessed.
 */
export function isStale(findings: StoredFinding[], now = Date.now(), maxAgeHours = 48): boolean {
  if (findings.length === 0) return false;
  const newest = findings.reduce((latest, finding) => Math.max(latest, Date.parse(finding.lastSeen) || 0), 0);
  if (!newest) return true;
  return now - newest > maxAgeHours * 3600_000;
}

/** Scheduler visibility (Phase 6): one row per task type, newest first. */
export interface RunRow { taskType: string; status: string; startedAt: number; finishedAt: number | null; error: string | null }
export interface TaskStatus { task: string; status: string; lastRun: number; durationMs: number | null; error: string | null; failures: number }

export function summariseTaskRuns(rows: RunRow[]): TaskStatus[] {
  const byTask = new Map<string, TaskStatus>();
  for (const row of rows) {
    const existing = byTask.get(row.taskType);
    const failures = (existing?.failures ?? 0) + (row.status === "failed" ? 1 : 0);
    if (existing) { existing.failures = failures; continue; }
    byTask.set(row.taskType, {
      task: row.taskType,
      status: row.status,
      lastRun: row.startedAt,
      durationMs: row.finishedAt ? row.finishedAt - row.startedAt : null,
      error: row.error,
      failures,
    });
  }
  return [...byTask.values()].sort((a, b) => a.task.localeCompare(b.task));
}

/** Stored search-performance coverage, per engine. Never invents values. */
export interface MetricRow { source: string; date: string; clicks: number | null; impressions: number | null }
export interface MetricSummary { source: string; days: number; clicks: number; impressions: number; latest: string }

export function summariseMetrics(rows: MetricRow[]): MetricSummary[] {
  const bySource = new Map<string, MetricSummary>();
  for (const row of rows) {
    const current = bySource.get(row.source) ?? { source: row.source, days: 0, clicks: 0, impressions: 0, latest: "" };
    current.days += 1;
    current.clicks += row.clicks ?? 0;
    current.impressions += row.impressions ?? 0;
    if (row.date > current.latest) current.latest = row.date;
    bySource.set(row.source, current);
  }
  return [...bySource.values()].sort((a, b) => a.source.localeCompare(b.source));
}
