import "server-only";
import { sqliteHandle } from "@/lib/sqlite";
import { crawlSite, type CrawlFetch, type CrawlResult } from "./crawl";
import { technicalObservations, type PageSnapshot } from "./rules/technical";
import { contentObservations } from "./rules/content";
import { saveObservations, saveFindings, listFindings, resolveCrawledFindings } from "./store";
import { consolidate } from "./findings";
import { repairBingSubjectKey } from "./bing-sync";
import { canonicaliseUrl, findingKey, type Observation } from "./observations";

/**
 * Pipeline tasks (Phase 6 wiring): crawl → observations → findings.
 *
 * These are the missing links found in the readiness audit. Both are pure enough
 * to test with fixtures and bounded enough to run from the existing scheduler.
 */

export interface CrawlTaskOptions {
  origin: string;
  fetchImpl: CrawlFetch;
  maxPages?: number;
  observedAt?: string;
  /** Page paths that should exist (sitemap), used for redirect/canonical checks. */
  seedUrls?: string[];
}

export interface CrawlTaskResult {
  pages: number;
  observations: number;
  stored: number;
  /** Previously-open deterministic findings this crawl verified as fixed. */
  resolved: number;
  skipped: number;
  truncated: boolean;
  checkIds: string[];
}

function storePages(result: CrawlResult): void {
  const db = sqliteHandle();
  if (!db) return;
  const upsert = db.prepare(
    `INSERT INTO seo_pages (url, status, final_url, canonical, robots, title, description, content_hash, crawled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       status = excluded.status, final_url = excluded.final_url, canonical = excluded.canonical,
       robots = excluded.robots, title = excluded.title, description = excluded.description,
       content_hash = excluded.content_hash, crawled_at = excluded.crawled_at`,
  );
  for (const page of result.pages) {
    const title = page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 300) ?? null;
    const canonical = page.html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]?.slice(0, 500) ?? null;
    const robots = page.html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i)?.[1]?.slice(0, 200) ?? null;
    upsert.run(
      page.url,
      page.status,
      page.finalUrl,
      canonical,
      robots,
      title,
      null,
      `${page.status}:${page.html.length}`,
      Date.now(),
    );
  }
}

export async function runCrawlTask(options: CrawlTaskOptions): Promise<CrawlTaskResult> {
  const observedAt = options.observedAt ?? new Date().toISOString();
  const result = await crawlSite({
    origin: options.origin,
    fetchImpl: options.fetchImpl,
    seedUrls: options.seedUrls,
    maxPages: options.maxPages ?? 25,
    concurrency: 2,
  });

  const observations: Observation[] = [];
  for (const page of result.pages) {
    const snapshot: PageSnapshot = {
      url: page.url,
      status: page.status,
      finalUrl: page.finalUrl,
      redirectChain: page.redirectChain,
      html: page.html,
    };
    observations.push(...technicalObservations(snapshot, { canonicalOrigin: options.origin, observedAt, provenance: "crawl" }));
    if (page.status >= 200 && page.status < 300) {
      observations.push(...contentObservations({ url: page.url, html: page.html }, { canonicalOrigin: options.origin, observedAt, provenance: "crawl" }));
    }
  }

  storePages(result);
  const stored = saveObservations(observations);
  // A page that no longer raises a deterministic check has been verified as
  // fixed by this crawl. Only pages this run actually fetched are considered.
  const resolved = resolveCrawledFindings({
    crawledUrls: result.pages.map((page) => canonicaliseUrl(page.url, options.origin)),
    observedKeys: [...new Set(observations.map((observation) => findingKey(observation)))],
  });

  return {
    pages: result.pages.length,
    observations: observations.length,
    stored,
    resolved,
    skipped: result.skipped.length,
    truncated: result.truncated,
    checkIds: [...new Set(observations.map((observation) => observation.checkId))].sort(),
  };
}

export interface ConsolidationOptions {
  sinceDays?: number;
  observedAt?: string;
}

export interface ConsolidationResult {
  observationsRead: number;
  findings: number;
  written: number;
}

/** Reads recent observations and rebuilds consolidated findings from them. */
export function runConsolidationTask(options: ConsolidationOptions = {}): ConsolidationResult {
  const db = sqliteHandle();
  if (!db) return { observationsRead: 0, findings: 0, written: 0 };
  const sinceDays = Math.max(1, Math.min(120, Math.round(options.sinceDays ?? 14)));
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const rows = db.prepare(
    `SELECT source, check_id, subject_type, subject_key, observed_at, window_start, window_end, severity,
            completeness, provenance, metrics_json, evidence_json
       FROM seo_observations WHERE observed_at >= ? ORDER BY id DESC LIMIT 5000`,
  ).all(since) as Record<string, unknown>[];

  const observations: Observation[] = rows.flatMap((row): Observation[] => {
    const source = String(row.source) as Observation["source"];
    const subjectType = String(row.subject_type) as Observation["subjectType"];
    if (!source || !subjectType) return [];
    // Raw Bing traffic totals are metrics, not findings. Turning each daily
    // period into an "open finding" floods the dashboard with non-actionable
    // info rows; the data already lives in seo_metrics_daily.
    if (row.check_id === "bing_traffic_stats" || row.check_id === "bing_site_stats") return [];
    const storedSubject = String(row.subject_key);
    // Historical Bing rows stored a truncated OData date as a subject. Repair it
    // on read so the next consolidation cannot present it as a website page.
    const subjectKey = source === "bing" ? repairBingSubjectKey(subjectType, storedSubject) : storedSubject;
    return [{
      source,
      checkId: String(row.check_id),
      subjectType,
      subjectKey,
      observedAt: String(row.observed_at),
      windowStart: row.window_start ? String(row.window_start) : null,
      windowEnd: row.window_end ? String(row.window_end) : null,
      severity: row.severity ? (String(row.severity) as Observation["severity"]) : undefined,
      completeness: row.completeness ? (String(row.completeness) as Observation["completeness"]) : undefined,
      provenance: row.provenance ? String(row.provenance) : undefined,
      metrics: row.metrics_json ? (safeJson(row.metrics_json) as Observation["metrics"]) : undefined,
      evidence: row.evidence_json ? (safeJson(row.evidence_json) as Observation["evidence"]) : undefined,
    }];
  });

  const findings = consolidate(observations);
  const written = saveFindings(findings);
  // Legacy Bing rows stored a truncated OData date as a "site" subject. The read
  // repair above prevents new ones; this closes the already-stored finding so a
  // data-formatting artefact is not shown as an open issue indefinitely.
  db.prepare(
    "UPDATE seo_findings SET status = 'resolved', updated_at = ? WHERE status = 'open' AND check_id LIKE 'bing_%' AND subject_type = 'site' AND subject_key LIKE '/Date(%'",
  ).run(Date.now());
  // Close the legacy daily traffic "findings" created by earlier consolidation
  // runs; they are raw metrics and should not sit in the open queue.
  db.prepare(
    "UPDATE seo_findings SET status = 'resolved', updated_at = ? WHERE status = 'open' AND check_id IN ('bing_traffic_stats','bing_site_stats')",
  ).run(Date.now());
  return { observationsRead: observations.length, findings: findings.length, written };
}

function safeJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

/** Convenience for the admin page/tests: findings currently stored. */
export function storedFindings(limit = 50) {
  return listFindings(limit);
}
