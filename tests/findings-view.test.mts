let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };

type F = {
  findingKey: string; checkId: string; subjectType: string; subjectKey: string; claimClass: string;
  level: string; severity: string; confidence: number; priorityScore: number; explanation: string | null;
  observationCount: number; sources: string[]; disagreement: boolean; firstSeen: string; lastSeen: string;
};
const mk = (checkId: string, severity: string, url = "https://www.knightmedicalbilling.com/a", lastSeen = new Date().toISOString()): F => ({
  findingKey: `${checkId}-${url}`, checkId, subjectType: "url", subjectKey: url, claimClass: "confirmed_defect",
  level: "B", severity, confidence: 0.8, priorityScore: 50, explanation: null, observationCount: 1,
  sources: ["rules"], disagreement: false, firstSeen: lastSeen, lastSeen,
});

try {
  const v = await import("../src/lib/seo/findings-view");

  ok("categories map from check ids", v.categoryOf("title_length_out_of_range") === "metadata"
    && v.categoryOf("canonical_mismatch") === "canonical"
    && v.categoryOf("robots_noindex") === "indexability"
    && v.categoryOf("schema_invalid_json") === "schema"
    && v.categoryOf("h1_multiple") === "headings"
    && v.categoryOf("image_alt_missing") === "images"
    && v.categoryOf("content_thin") === "content"
    && v.categoryOf("unknown_check") === "other");

  const data = [mk("title_missing", "critical"), mk("meta_description_missing", "medium", "https://www.knightmedicalbilling.com/b"), mk("h1_multiple", "low")];
  const all = v.filterFindings(data as never, v.parseFilters({}));
  ok("no filters returns everything", all.length === 3);

  ok("severity filter", v.filterFindings(data as never, v.parseFilters({ severity: "critical" })).length === 1);
  ok("category filter", v.filterFindings(data as never, v.parseFilters({ category: "metadata" })).length === 2);
  ok("url search", v.filterFindings(data as never, v.parseFilters({ q: "/b" })).length === 1);
  ok("search matches check id too", v.filterFindings(data as never, v.parseFilters({ q: "h1" })).length === 1);
  ok("search is case-insensitive", v.filterFindings(data as never, v.parseFilters({ q: "/B" })).length === 1);
  ok("combined filters", v.filterFindings(data as never, v.parseFilters({ category: "metadata", severity: "critical" })).length === 1);

  ok("invalid severity falls back to all", v.parseFilters({ severity: "banana" }).severity === "all");
  ok("invalid category falls back to all", v.parseFilters({ category: "banana" }).category === "all");
  ok("query is trimmed and bounded", v.parseFilters({ q: "  x  " }).query === "x" && v.parseFilters({ q: "y".repeat(300) }).query.length === 120);

  const summary = v.summarise(data as never);
  ok("summary counts by severity", summary.bySeverity.critical === 1 && summary.bySeverity.medium === 1);
  ok("summary counts affected urls", summary.affectedUrls === 2);
  ok("summary reports worst severity", summary.worstSeverity === "critical");
  ok("empty summary is honest", (() => { const s = v.summarise([]); return s.total === 0 && s.worstSeverity === null && s.affectedUrls === 0; })());

  // A site-level reporting period (or a malformed API field) is not a page URL.
  const withPeriod = v.summarise([
    ...data,
    { ...mk("bing_traffic_stats", "info"), subjectType: "site", subjectKey: "/Date(1794" },
  ] as never);
  ok("non-page subjects are not counted as affected URLs", withPeriod.affectedUrls === 2, String(withPeriod.affectedUrls));
  ok("non-URL subjects are not linkable", v.isPageSubject({ subjectType: "site", subjectKey: "2026-11-15" }) === false);
  ok("malformed url subjects are not linkable", v.isPageSubject({ subjectType: "url", subjectKey: "/Date(1794" }) === false);
  ok("real page subjects stay linkable", v.isPageSubject({ subjectType: "url", subjectKey: "https://www.knightmedicalbilling.com/a" }) === true);
  ok("heading structure maps to the headings category", v.categoryOf("content_heading_structure") === "headings");
  ok("every check gets a concrete recommendation",
    ["image_alt_missing", "title_missing", "canonical_mismatch", "bing_traffic_stats", "content_readability_hard"].every((id) => v.recommendationFor(id).length > 20));

  const fresh = [mk("title_missing", "high", undefined, new Date().toISOString())];
  const old = [mk("title_missing", "high", undefined, new Date(Date.now() - 72 * 3600_000).toISOString())];
  ok("per-finding staleness matches dataset staleness", v.isFindingStale(fresh[0] as never) === false && v.isFindingStale(old[0] as never) === true);
  ok("fresh data is not stale", v.isStale(fresh as never) === false);
  ok("old data is stale", v.isStale(old as never) === true);
  ok("empty set is never reported stale", v.isStale([]) === false);
  ok("unparseable timestamps are treated as stale", v.isStale([{ ...mk("x", "low"), lastSeen: "not-a-date" }] as never) === true);

  // ---- scheduler visibility ----
  const runs = [
    { taskType: "gsc_sync", status: "completed", startedAt: 2000, finishedAt: 5000, error: null },
    { taskType: "gsc_sync", status: "failed", startedAt: 1000, finishedAt: 1500, error: "HTTP 429" },
    { taskType: "crawl_audit", status: "running", startedAt: 3000, finishedAt: null, error: null },
  ];
  const tasks = v.summariseTaskRuns(runs as never);
  ok("one row per task type", tasks.length === 2);
  ok("newest run wins", tasks.find((t) => t.task === "gsc_sync")?.status === "completed");
  ok("failures are counted", tasks.find((t) => t.task === "gsc_sync")?.failures === 1);
  ok("duration computed from timestamps", tasks.find((t) => t.task === "gsc_sync")?.durationMs === 3000);
  ok("running job has no duration", tasks.find((t) => t.task === "crawl_audit")?.durationMs === null);
  ok("tasks sorted for stable display", tasks.map((t) => t.task).join(",") === "crawl_audit,gsc_sync");

  // ---- stored search performance ----
  const rows = [
    { source: "gsc", date: "2026-11-10", clicks: 3, impressions: 100 },
    { source: "gsc", date: "2026-11-11", clicks: 2, impressions: 50 },
    { source: "bing", date: "2026-11-11", clicks: null, impressions: null },
  ];
  const metrics = v.summariseMetrics(rows as never);
  ok("metrics grouped per engine", metrics.length === 2);
  ok("clicks and impressions summed", metrics.find((m) => m.source === "gsc")?.clicks === 5);
  ok("latest date reported", metrics.find((m) => m.source === "gsc")?.latest === "2026-11-11");
  ok("null metrics are not inflating totals", metrics.find((m) => m.source === "bing")?.clicks === 0);
  ok("empty metric set stays empty", v.summariseMetrics([]).length === 0);

  console.log(`RESULT pass=${passed} fail=0`);
} catch (e) { console.error(e instanceof Error ? e.message : e); console.log("RESULT pass=0 fail=1"); process.exitCode = 1; }
