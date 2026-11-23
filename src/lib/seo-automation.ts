import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, seoAuditRuns, seoAutomationRuns, seoOpportunities, seoSettings, contentWorkflows } from "@/db/schema";
import { listAdminPosts } from "./blog";
import { getArticles } from "./data";
import { generateOpportunityAnalysis } from "./content-ai";
import { createContentWorkflow, knownInternalPaths } from "./content-workflow";
import { jiroConfigured, jiroExtract, jiroHealth, jiroSearch } from "./jiro-client";
import { getGscConnectionSummary } from "./gsc-oauth";
import { SITE_URL } from "./seo";
import { getOAuthAccessToken } from "./gsc-oauth";
import { requireBingKey } from "./seo/bing-sync";
import { settledDates, SYNC_SETTING_DEFAULTS, isSyncTask, runSyncTask, syncIntervalHours, type BingStepInput, type GscStepInput, type SyncTask } from "./seo/scheduler";
import { runConsolidationTask, runCrawlTask } from "./seo/pipeline";
import { recordSyncRun } from "./seo/observe";

export const SEO_TASK_TYPES = [
  "opportunity_discovery",
  "technical_audit",
  "content_refresh",
  // Sync tasks reuse the same run table, locks and interval mechanism.
  "gsc_sync",
  "bing_sync",
  // Pipeline tasks: crawl produces observations, consolidation produces findings.
  "crawl_audit",
  "consolidate_findings",
] as const;
export type SeoTaskType = (typeof SEO_TASK_TYPES)[number];

export const SEO_SETTING_DEFAULTS: Record<string, string> = {
  enabled: "false",
  discovery_interval_hours: "24",
  audit_interval_hours: "168",
  refresh_interval_hours: "168",
  refresh_min_age_days: "90",
  max_queries_per_run: "6",
  max_competitor_pages: "2",
  max_opportunities_per_run: "15",
  daily_ai_runs: "6",
  ...SYNC_SETTING_DEFAULTS,
  crawl_interval_hours: "24",
  crawl_max_pages: "120",
  consolidate_interval_hours: "6",
  findings_lookback_days: "14",
};

const TASK_LABELS: Record<SeoTaskType, string> = {
  opportunity_discovery: "Opportunity discovery",
  technical_audit: "Technical SEO audit",
  content_refresh: "Content refresh review",
  gsc_sync: "Search Console sync",
  bing_sync: "Bing Webmaster sync",
  crawl_audit: "Technical crawl",
  consolidate_findings: "Findings consolidation",
};

/**
 * Seed queries supply topic breadth, not a fixed reader. They intentionally span
 * services, facility settings and specialty workflows so generation does not
 * collapse into a single "independent practice" theme.
 */
export const DEFAULT_SEED_QUERIES = [
  "medical billing services for healthcare organizations",
  "revenue cycle management for hospitals",
  "emergency department billing services",
  "urgent care billing services",
  "mental health billing services",
  "behavioral health authorization and denials",
  "physical therapy billing services",
  "podiatry billing services",
  "medical credentialing services",
  "denial management medical billing services",
  "accounts receivable recovery medical billing",
  "medical billing software support services",
];

export type SeoAutomationSettings = Record<string, string>;

export type SeoOpportunityView = {
  id: number;
  topic: string;
  primaryKeyword: string | null;
  intent: string | null;
  cluster: string | null;
  targetPath: string | null;
  contentType: string | null;
  score: number;
  status: string;
  evidence: OpportunityEvidence;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityEvidence = {
  query?: string;
  summary?: string;
  searchIntent?: string;
  audience?: string;
  factors?: string[];
  sources?: { title: string; url: string; extractedAt?: string; note?: string }[];
  competitors?: { url: string; title: string | null; headings: string[]; excerpt?: string; extractedAt: string; error?: string }[];
  outline?: { heading: string; purpose?: string }[];
  internalLinks?: { label: string; href: string; reason?: string }[];
  existingContent?: string[];
  searchProvider?: string;
  generatedAt?: string;
};

type OpportunityDraft = {
  topic: string;
  primaryKeyword: string;
  intent: "informational" | "commercial" | "transactional" | "navigational";
  cluster: string;
  contentType: string;
  targetPath: string;
  summary: string;
  searchIntent: string;
  audience: string;
  factors: string[];
  score: number;
  outline: { heading: string; purpose?: string }[];
  internalLinks: { label: string; href: string; reason?: string }[];
};

function nowIso() { return new Date().toISOString(); }
function clean(value: unknown, max = 500) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : ""; }
function num(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

export async function getSeoSettings(): Promise<SeoAutomationSettings> {
  try {
    const rows = await db.select().from(seoSettings);
    return { ...SEO_SETTING_DEFAULTS, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  } catch {
    return { ...SEO_SETTING_DEFAULTS };
  }
}

export async function setSeoSettings(patch: Record<string, unknown>): Promise<SeoAutomationSettings> {
  const allowed = new Set(Object.keys(SEO_SETTING_DEFAULTS));
  const entries = Object.entries(patch).filter(([key]) => allowed.has(key));
  for (const [key, value] of entries) {
    const normalized = String(value).trim().slice(0, 120);
    await db.insert(seoSettings).values({ key, value: normalized }).onConflictDoUpdate({
      target: seoSettings.key,
      set: { value: normalized, updatedAt: new Date() },
    });
  }
  return getSeoSettings();
}

function intervalMs(settings: SeoAutomationSettings, task: SeoTaskType): number {
  // Sync intervals are clamped to 1–168h so a bad setting cannot poll hard or stall forever.
  if (isSyncTask(task)) return syncIntervalHours(task, settings) * 60 * 60 * 1000;
  if (task === "crawl_audit") return Math.min(168, Math.max(1, num(settings.crawl_interval_hours, 24))) * 60 * 60 * 1000;
  if (task === "consolidate_findings") return Math.min(168, Math.max(1, num(settings.consolidate_interval_hours, 6))) * 60 * 60 * 1000;
  const key = task === "opportunity_discovery" ? "discovery_interval_hours" : task === "technical_audit" ? "audit_interval_hours" : "refresh_interval_hours";
  return Math.max(1, num(settings[key], 24)) * 60 * 60 * 1000;
}

export async function latestRun(task?: SeoTaskType) {
  const rows = await db.select().from(seoAutomationRuns)
    .where(task ? eq(seoAutomationRuns.taskType, task) : undefined)
    .orderBy(desc(seoAutomationRuns.startedAt)).limit(1);
  return rows[0] ?? null;
}

export async function dueTasks(now = Date.now()): Promise<SeoTaskType[]> {
  const settings = await getSeoSettings();
  if (settings.enabled !== "true") return [];
  const due: { task: SeoTaskType; last: number; index: number }[] = [];
  for (const [index, task] of SEO_TASK_TYPES.entries()) {
    const latest = await latestRun(task);
    const retryDue = latest?.status === "failed" && latest.retryCount < 3 && now - latest.startedAt.getTime() >= 10 * 60 * 1000;
    if (!latest || retryDue || now - latest.startedAt.getTime() >= intervalMs(settings, task)) {
      due.push({ task, last: latest?.startedAt.getTime() ?? 0, index });
    }
  }
  // Fair ordering: the task that has waited longest runs first, so adding sync
  // tasks cannot starve (or be starved by) the original three.
  due.sort((a, b) => a.last - b.last || a.index - b.index);
  // Keep one tick bounded; the next tick handles the remainder.
  return due.slice(0, 2).map((entry) => entry.task);
}

async function beginRun(task: SeoTaskType): Promise<{ id: number; executionId: string }> {
  const executionId = randomUUID();
  const previous = await latestRun(task);
  const retryCount = previous?.status === "failed" ? Math.min(3, previous.retryCount + 1) : 0;
  const [row] = await db.insert(seoAutomationRuns).values({
    executionId, taskType: task, status: "running", startedAt: new Date(), retryCount,
  }).returning({ id: seoAutomationRuns.id });
  return { id: row.id, executionId };
}

async function finishRun(id: number, startedAt: number, status: "completed" | "failed" | "skipped", meta: Record<string, unknown>, error?: string) {
  const completedAt = new Date();
  await db.update(seoAutomationRuns).set({
    status, completedAt, durationMs: Date.now() - startedAt,
    error: error ? error.slice(0, 1000) : null,
    metaJson: JSON.stringify(meta).slice(0, 20_000),
  }).where(eq(seoAutomationRuns.id, id));
}

async function existingOpportunityKeys(): Promise<Set<string>> {
  const rows = await db.select({ topic: seoOpportunities.topic, keyword: seoOpportunities.primaryKeyword }).from(seoOpportunities);
  return new Set(rows.flatMap((row) => [normaliseKey(row.topic), normaliseKey(row.keyword ?? "")]).filter(Boolean));
}

function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanInternalPath(value: string): string {
  const path = value.split(/[?#]/)[0] || "";
  return knownInternalPaths().includes(path) ? path : "/insights";
}

async function runOpportunityDiscovery(settings: SeoAutomationSettings): Promise<{ opportunities: number; queries: number; competitors: number; warnings: string[] }> {
  if (!jiroConfigured()) throw new Error("Jiro is not configured or its loopback token file is unavailable.");
  const health = await jiroHealth();
  if (!health.ok) throw new Error(health.error ?? "Jiro health check failed.");
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayRuns = await db.select({ id: seoAutomationRuns.id }).from(seoAutomationRuns)
    .where(and(eq(seoAutomationRuns.taskType, "opportunity_discovery"), gte(seoAutomationRuns.startedAt, startOfDay)));
  if (todayRuns.length >= Math.max(1, num(settings.daily_ai_runs, 4))) throw new Error("Daily AI discovery run limit reached. Increase the budget deliberately in settings or wait until tomorrow.");
  const maxQueries = Math.min(10, Math.max(1, num(settings.max_queries_per_run, 6)));
  const maxCompetitors = Math.min(4, Math.max(0, num(settings.max_competitor_pages, 2)));
  // 15 is the owner-facing research ceiling. Each AI call returns at most 4
  // ideas (the model output budget), so discovery makes a few bounded calls and
  // deduplicates rather than risking a truncated 15-item JSON response.
  const maxOpportunities = Math.min(15, Math.max(1, num(settings.max_opportunities_per_run, 15)));
  const queries = DEFAULT_SEED_QUERIES.slice(0, maxQueries);
  const searchPackets = [];
  const warnings: string[] = [];
  for (const query of queries) {
    const result = await jiroSearch(query, { limit: 5 });
    if (!result.available) {
      warnings.push(`${query}: ${result.error ?? result.note}`);
      continue;
    }
    searchPackets.push({ query, provider: result.provider, note: result.note, results: result.results });
  }
  if (!searchPackets.length) throw new Error(`Jiro returned no usable search data. ${warnings.join(" ")}`.slice(0, 900));

  const competitorUrls = [...new Set(searchPackets.flatMap((packet) => packet.results.map((result) => result.url)))].slice(0, maxCompetitors);
  const competitors = [];
  for (const url of competitorUrls) {
    const extract = await jiroExtract(url);
    competitors.push({ url, title: extract.title, headings: extract.headings, excerpt: extract.content.slice(0, 1200), extractedAt: extract.fetchedAt, ...(extract.error ? { error: extract.error } : {}) });
  }

  const existing = await existingArticleContextTitles();
  const known = await existingOpportunityKeys();
  // Batch the AI calls: the model has a bounded JSON output, so asking for 15
  // ideas in one response risks truncation. Four per call, deduplicated across
  // calls, keeps every response valid while still reaching the 15-idea ceiling.
  const selected: Awaited<ReturnType<typeof generateOpportunityAnalysis>>["opportunities"] = [];
  const avoid = new Set<string>();
  for (let batch = 0; batch < Math.ceil(maxOpportunities / 4) && selected.length < maxOpportunities; batch += 1) {
    const remaining = maxOpportunities - selected.length;
    const analysis = await generateOpportunityAnalysis({
      evidence: { searchPackets, competitors },
      existingTitles: existing,
      maxOpportunities: Math.min(4, remaining),
      avoidTopics: [...avoid],
    });
    let added = 0;
    for (const raw of analysis.opportunities) {
      const keys = [normaliseKey(raw.topic), normaliseKey(raw.primaryKeyword)];
      if (keys.some((key) => !key || known.has(key) || avoid.has(key))) continue;
      for (const key of keys) avoid.add(key);
      selected.push(raw);
      added += 1;
      if (selected.length >= maxOpportunities) break;
    }
    if (added === 0) break;
  }
  const inserted: number[] = [];
  for (const raw of selected) {
    const topic = clean(raw.topic, 240);
    const keyword = clean(raw.primaryKeyword, 160);
    if (!topic || !keyword) continue;
    const keys = [normaliseKey(topic), normaliseKey(keyword)];
    if (keys.some((key) => known.has(key))) continue;
    const internalLinks = raw.internalLinks
      .filter((link) => link && typeof link.href === "string")
      .map((link) => ({ label: clean(link.label, 120) || "Related service", href: cleanInternalPath(link.href), reason: clean(link.reason, 300) }))
      .slice(0, 6);
    const evidence: OpportunityEvidence = {
      query: searchPackets[0]?.query,
      summary: clean(raw.summary, 1500),
      searchIntent: clean(raw.searchIntent, 800),
      audience: clean(raw.audience, 300),
      factors: raw.factors.map((factor) => clean(factor, 240)).filter(Boolean).slice(0, 8),
      sources: [...new Map(competitors.map((item) => [item.url, { title: item.title ?? item.url, url: item.url, extractedAt: item.extractedAt }])).values()],
      competitors,
      outline: raw.outline.map((item) => ({ heading: clean(item.heading, 180), purpose: clean(item.purpose, 400) })).filter((item) => item.heading).slice(0, 12),
      internalLinks,
      existingContent: existing.slice(0, 30),
      searchProvider: "jiro",
      generatedAt: nowIso(),
    };
    await db.insert(seoOpportunities).values({
      topic, primaryKeyword: keyword, intent: clean(raw.intent, 40) || "informational",
      cluster: clean(raw.cluster, 120) || "medical billing",
      targetPath: cleanInternalPath(raw.targetPath),
      contentType: clean(raw.contentType, 80) || "Article",
      evidenceJson: JSON.stringify(evidence).slice(0, 60_000),
      score: Math.max(0, Math.min(100, Math.round(num(raw.score, 50)))),
      status: "new",
    });
    for (const key of keys) known.add(key);
    inserted.push(1);
  }
  return { opportunities: inserted.length, queries: searchPackets.length, competitors: competitors.length, warnings };
}

async function existingArticleContextTitles(): Promise<string[]> {
  const [posts, articles] = await Promise.all([listAdminPosts({ page: 1, perPage: 100 }).catch(() => ({ posts: [] })), getArticles().catch(() => [])]);
  return [...posts.posts.map((post) => post.title), ...articles.map((article) => article.title)].slice(0, 120);
}

function parseSitemapUrls(xml: string, base: string): string[] {
  const locations = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim());
  return [...new Set(locations.flatMap((location) => {
    try {
      const url = new URL(location);
      return url.origin === new URL(base).origin && !url.pathname.startsWith("/admin") && !url.pathname.startsWith("/api") ? [url.toString()] : [];
    } catch { return []; }
  }))];
}

function meta(html: string, name: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i"))?.[0];
  const value = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return value ? value.replace(/&amp;/g, "&").trim() : null;
}

async function runTechnicalAudit(settings: SeoAutomationSettings): Promise<{ pages: number; issues: number; warnings: string[] }> {
  const base = SITE_URL.replace(/\/$/, "");
  const warnings: string[] = [];
  let urls: string[] = [];
  try {
    const response = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (response.ok) urls = parseSitemapUrls(await response.text(), base);
    else warnings.push(`Sitemap returned HTTP ${response.status}.`);
  } catch (error) { warnings.push(`Sitemap fetch failed: ${error instanceof Error ? error.message.slice(0, 120) : "unknown"}`); }
  if (!urls.length) urls = ["/", "/services", "/specialties", "/software", "/insights", "/results", "/why-knight", "/contact"].map((path) => `${base}${path}`);
  urls = urls.slice(0, 30);
  const issues: { severity: "critical" | "high" | "medium" | "low" | "info"; path: string; detail: string }[] = [];
  let checked = 0;
  for (const url of urls) {
    const path = (() => { try { return new URL(url).pathname; } catch { return url; } })();
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "KnightSEOAudit/1.0" }, cache: "no-store" });
      if (response.status !== 200) {
        issues.push({ severity: response.status >= 500 ? "critical" : "high", path, detail: `HTTP ${response.status}` });
        continue;
      }
      const html = (await response.text()).slice(0, 500_000);
      checked += 1;
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
      const description = meta(html, "description");
      const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ?? null;
      const robots = meta(html, "robots") ?? "";
      const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => match[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean);
      if (!title) issues.push({ severity: "high", path, detail: "Missing title" });
      if (!description) issues.push({ severity: "medium", path, detail: "Missing meta description" });
      if (!canonical) issues.push({ severity: "medium", path, detail: "Missing canonical" });
      if (h1s.length !== 1) issues.push({ severity: "high", path, detail: `Expected exactly one H1, found ${h1s.length}` });
      if (/noindex/i.test(robots)) issues.push({ severity: "high", path, detail: "Public page marked noindex" });
    } catch (error) {
      issues.push({ severity: "high", path, detail: `Fetch failed: ${error instanceof Error ? error.message.slice(0, 160) : "unknown"}` });
    }
  }
  const [row] = await db.insert(seoAuditRuns).values({
    status: issues.length ? "completed_with_issues" : "completed",
    summaryJson: JSON.stringify({ pages: checked, issues: issues.length, base, warnings }).slice(0, 20_000),
    issuesJson: JSON.stringify(issues).slice(0, 80_000),
    pagesChecked: checked, startedAt: new Date(), completedAt: new Date(),
  }).returning({ id: seoAuditRuns.id });
  return { pages: checked, issues: issues.length, warnings: [...warnings, `audit_run=${row.id}`] };
}

async function runContentRefresh(settings: SeoAutomationSettings): Promise<{ recommendations: number }> {
  const cutoff = Date.now() - Math.max(30, num(settings.refresh_min_age_days, 90)) * 24 * 60 * 60 * 1000;
  const rows = await db.select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, publishedAt: blogPosts.publishedAt, updatedAt: blogPosts.updatedAt })
    .from(blogPosts).where(and(eq(blogPosts.status, "published"))).orderBy(desc(blogPosts.publishedAt)).limit(50);
  const known = await existingOpportunityKeys();
  let count = 0;
  for (const post of rows) {
    if (!post.publishedAt || post.publishedAt.getTime() > cutoff) continue;
    const key = normaliseKey(`refresh ${post.title}`);
    if (known.has(key)) continue;
    await db.insert(seoOpportunities).values({
      topic: `Refresh: ${post.title}`,
      primaryKeyword: null,
      intent: "informational",
      cluster: "content refresh",
      targetPath: `/blog/${post.slug}`,
      contentType: "Existing page improvement",
      score: 60,
      status: "new",
      evidenceJson: JSON.stringify({ summary: "Published content has crossed the refresh review age threshold.", existingContent: [post.title], factors: ["Content age", "Existing published URL", "Human review required"], generatedAt: nowIso() }),
    });
    known.add(key); count += 1;
  }
  return { recommendations: count };
}

/**
 * Provider wiring for the sync tasks. Both functions build the step input from
 * existing configuration only; no request is made here.
 */
async function gscStepDependencies(settings: SeoAutomationSettings): Promise<GscStepInput> {
  const auth = await getOAuthAccessToken();
  if (!auth || !auth.siteUrl) throw new Error("gsc_not_connected: Search Console authorization is missing.");
  const lookback = Math.max(1, Math.min(14, Number(settings.gsc_lookback_days) || 3));
  const maxRequests = Math.min(60, Math.max(1, Number(settings.gsc_max_requests_per_run) || 20));
  return {
    token: auth.token,
    propertyKey: auth.siteUrl,
    propertyKind: auth.siteUrl.startsWith("sc-domain:") ? "domain" : "url_prefix",
    dates: settledDates(lookback),
    maxRequests,
    fetchImpl: async ({ url, body, token }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      const json = await response.json().catch(() => null);
      return { status: response.status, json };
    },
  };
}

async function bingStepDependencies(): Promise<BingStepInput> {
  const key = requireBingKey();
  return {
    key,
    siteUrl: SITE_URL,
    verifyFirst: true,
    fetchImpl: async ({ url }) => {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      const json = await response.json().catch(() => null);
      return { status: response.status, json };
    },
  };
}

export async function runSeoTask(task: SeoTaskType): Promise<{ ok: boolean; status: string; meta: Record<string, unknown>; error?: string }> {
  const settings = await getSeoSettings();

  // Pipeline tasks use the same run table as the original three, so the
  // scheduler's history and overlap guard cover them too.
  if (task === "crawl_audit" || task === "consolidate_findings") {
    const started = Date.now();
    const run = await beginRun(task);
    try {
      const meta = task === "crawl_audit"
        ? await (async () => {
            const result = await runCrawlTask({
              origin: SITE_URL,
              maxPages: Math.min(150, Math.max(1, Number(settings.crawl_max_pages) || 120)),
              fetchImpl: async (url) => {
                const response = await fetch(url, { headers: { "user-agent": "KnightSeoAudit/1.0" }, signal: AbortSignal.timeout(20_000) });
                const html = (await response.text()).slice(0, 400_000);
                return { status: response.status, finalUrl: response.url || url, redirectChain: [url], html };
              },
            });
            recordSyncRun({ provider: "gsc", kind: "crawl", status: "completed", startedAt: started, finishedAt: Date.now(), requests: result.pages, rows: result.stored });
            return { ...result } as Record<string, unknown>;
          })()
        : await (async () => {
            const result = runConsolidationTask({ sinceDays: Math.min(120, Math.max(1, Number(settings.findings_lookback_days) || 14)) });
            recordSyncRun({ provider: "gsc", kind: "consolidate", status: "completed", startedAt: started, finishedAt: Date.now(), requests: 0, rows: result.written });
            return { ...result } as Record<string, unknown>;
          })();
      await finishRun(run.id, started, "completed", meta);
      return { ok: true, status: "completed", meta };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Pipeline task failed.";
      await finishRun(run.id, started, "failed", { task, error: message }, message);
      return { ok: false, status: "failed", meta: {}, error: message };
    }
  }

  // Sync tasks own their run row + lock + quota accounting inside the scheduler.
  if (isSyncTask(task)) {
    const outcome = await runSyncTask(task as SyncTask, {
      settings,
      gsc: () => gscStepDependencies(settings),
      bing: () => bingStepDependencies(),
    });
    return {
      ok: outcome.status === "completed",
      status: outcome.status,
      meta: outcome.meta,
      ...(outcome.error ? { error: outcome.error } : {}),
    };
  }

  const started = Date.now();
  const run = await beginRun(task);
  try {
    let meta: Record<string, unknown>;
    if (task === "opportunity_discovery") meta = await runOpportunityDiscovery(settings);
    else if (task === "technical_audit") meta = await runTechnicalAudit(settings);
    else meta = await runContentRefresh(settings);
    await finishRun(run.id, started, "completed", meta);
    return { ok: true, status: "completed", meta };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "SEO task failed.";
    await finishRun(run.id, started, "failed", { task, error: message }, message);
    return { ok: false, status: "failed", meta: {}, error: message };
  }
}

export async function runAutomationTick(): Promise<{ enabled: boolean; ran: { task: SeoTaskType; ok: boolean; error?: string }[] }> {
  const settings = await getSeoSettings();
  if (settings.enabled !== "true") return { enabled: false, ran: [] };
  const active = await db.select({ id: seoAutomationRuns.id, startedAt: seoAutomationRuns.startedAt }).from(seoAutomationRuns)
    .where(eq(seoAutomationRuns.status, "running")).orderBy(desc(seoAutomationRuns.startedAt)).limit(1);
  if (active[0] && Date.now() - active[0].startedAt.getTime() < 20 * 60 * 1000) return { enabled: true, ran: [] };
  const tasks = await dueTasks();
  const ran: { task: SeoTaskType; ok: boolean; error?: string }[] = [];
  for (const task of tasks) {
    const result = await runSeoTask(task);
    ran.push({ task, ok: result.ok, ...(result.error ? { error: result.error } : {}) });
  }
  return { enabled: true, ran };
}

export async function listOpportunities(limit = 50): Promise<SeoOpportunityView[]> {
  const rows = await db.select().from(seoOpportunities).orderBy(desc(seoOpportunities.createdAt)).limit(Math.min(100, Math.max(1, limit)));
  return rows.map((row) => ({
    id: row.id, topic: row.topic, primaryKeyword: row.primaryKeyword, intent: row.intent,
    cluster: row.cluster, targetPath: row.targetPath, contentType: row.contentType, score: row.score,
    status: row.status,
    evidence: (() => { try { return JSON.parse(row.evidenceJson) as OpportunityEvidence; } catch { return {}; } })(),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listRuns(limit = 30) {
  const rows = await db.select().from(seoAutomationRuns).orderBy(desc(seoAutomationRuns.startedAt)).limit(Math.min(100, Math.max(1, limit)));
  return rows.map((row) => ({
    id: row.id, executionId: row.executionId, taskType: row.taskType, status: row.status,
    startedAt: row.startedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
    durationMs: row.durationMs, error: row.error, retryCount: row.retryCount,
    meta: (() => { try { return JSON.parse(row.metaJson) as Record<string, unknown>; } catch { return {}; } })(),
  }));
}

export async function listAuditRuns(limit = 20) {
  const rows = await db.select().from(seoAuditRuns).orderBy(desc(seoAuditRuns.startedAt)).limit(Math.min(50, Math.max(1, limit)));
  return rows.map((row) => ({
    id: row.id, status: row.status, pagesChecked: row.pagesChecked,
    startedAt: row.startedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
    summary: (() => { try { return JSON.parse(row.summaryJson) as Record<string, unknown>; } catch { return {}; } })(),
    issues: (() => { try { return JSON.parse(row.issuesJson) as { severity: string; path: string; detail: string }[]; } catch { return []; } })(),
    error: row.error,
  }));
}

export async function updateOpportunityStatus(id: number, status: "accepted" | "dismissed" | "new"): Promise<SeoOpportunityView | null> {
  await db.update(seoOpportunities).set({ status, updatedAt: new Date() }).where(eq(seoOpportunities.id, id));
  const rows = await db.select().from(seoOpportunities).where(eq(seoOpportunities.id, id)).limit(1);
  if (!rows[0]) return null;
  const view = await listOpportunities(100);
  return view.find((item) => item.id === id) ?? null;
}

export async function acceptOpportunityIntoWorkflow(id: number): Promise<{ workflowId: number }> {
  const rows = await db.select().from(seoOpportunities).where(eq(seoOpportunities.id, id)).limit(1);
  if (!rows[0]) throw new Error("Opportunity not found.");
  const opportunity = rows[0];
  let evidence: OpportunityEvidence = {};
  try { evidence = JSON.parse(opportunity.evidenceJson) as OpportunityEvidence; } catch { /* ignore */ }
  const workflowId = await createContentWorkflow({
    topic: opportunity.topic,
    audience: evidence.audience || "Independent medical practices",
    stage: "topic_plan",
    data: {
      research: {
        summary: evidence.summary,
        searchIntent: evidence.searchIntent,
        audience: evidence.audience,
        existingCoverage: (evidence.existingContent ?? []).join("; ").slice(0, 1200),
        competitorNotes: evidence.competitors?.length ? `Competitor extracts: ${evidence.competitors.map((item) => item.url).join(", ")}` : "No competitor extracts were available.",
        sources: evidence.sources ?? [],
        primaryKeyword: opportunity.primaryKeyword ?? undefined,
      },
      plan: {
        title: opportunity.topic,
        slug: undefined,
        primaryKeyword: opportunity.primaryKeyword ?? undefined,
        outline: evidence.outline ?? [],
        internalLinks: evidence.internalLinks ?? [],
        schemaType: opportunity.contentType === "FAQ" ? "FAQPage" : "Article",
        notes: "Created from an accepted SEO opportunity. Human approval is still required before publishing.",
      },
    },
  });
  await db.update(seoOpportunities).set({ status: "accepted", workflowId, updatedAt: new Date() }).where(eq(seoOpportunities.id, id));
  return { workflowId };
}

export async function getSeoAutomationDashboard() {
  const [settings, opportunities, runs, audits, health, published] = await Promise.all([
    getSeoSettings(),
    listOpportunities(50),
    listRuns(20),
    listAuditRuns(10),
    jiroHealth(),
    db.select({ id: blogPosts.id, status: blogPosts.status, title: blogPosts.title, slug: blogPosts.slug, updatedAt: blogPosts.updatedAt }).from(blogPosts).where(eq(blogPosts.status, "published")).limit(100),
  ]);
  const searchConsole = getGscConnectionSummary();
  const workflows = await db.select({ id: contentWorkflows.id, stage: contentWorkflows.stage }).from(contentWorkflows).limit(100).catch(() => []);
  return {
    settings,
    opportunities,
    runs,
    audits,
    health,
    searchConsole,
    publishedCount: published.length,
    workflowsCount: workflows.length,
    taskLabels: TASK_LABELS,
    checkedAt: nowIso(),
  };
}

export async function recordFullAudit(summary: Record<string, unknown>, issueCount: number, pages: number, issues: unknown): Promise<void> {
  await db.insert(seoAuditRuns).values({
    status: issueCount ? "completed_with_issues" : "completed",
    summaryJson: JSON.stringify(summary).slice(0, 60_000),
    issuesJson: JSON.stringify(issues).slice(0, 120_000),
    pagesChecked: pages, startedAt: new Date(), completedAt: new Date(),
  });
}
