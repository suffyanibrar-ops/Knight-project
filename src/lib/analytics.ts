import "server-only";
import { sqliteHandle } from "./sqlite";

/**
 * First-party, privacy-conscious analytics.
 *
 * Everything here is stored in the same SQLite application database. We do not
 * store raw IP addresses, form contents, passwords or patient data. The route
 * supplies salted hashes for visitor/session IDs and coarse request-derived
 * geography; this module only handles validated, non-sensitive fields.
 */

type Row = Record<string, unknown>;

export type AnalyticsRange = {
  key: string;
  label: string;
  days: number;
  startMs: number;
  endMs: number;
  previousStartMs: number;
  previousEndMs: number;
};

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveAnalyticsRange(range: string | null, start: string | null, end: string | null): AnalyticsRange {
  const customStart = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(`${start}T00:00:00Z`) : null;
  const customEnd = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? new Date(`${end}T23:59:59.999Z`) : null;
  if (customStart && customEnd && customStart.getTime() <= customEnd.getTime()) {
    const days = Math.max(1, Math.round((customEnd.getTime() - customStart.getTime()) / 86_400_000) + 1);
    const endMs = customEnd.getTime() + 1;
    return {
      key: "custom",
      label: `${isoDay(customStart)} → ${isoDay(customEnd)}`,
      days,
      startMs: customStart.getTime(),
      endMs,
      previousStartMs: customStart.getTime() - days * 86_400_000,
      previousEndMs: customStart.getTime(),
    };
  }
  const presets: Record<string, { label: string; days: number }> = {
    today: { label: "Today", days: 1 },
    "7d": { label: "Last 7 days", days: 7 },
    "30d": { label: "Last 30 days", days: 30 },
    "90d": { label: "Last 90 days", days: 90 },
  };
  const preset = presets[range ?? "7d"] ?? presets["7d"];
  const endMs = Date.now() + 1;
  const startMs = Date.now() - preset.days * 86_400_000;
  return {
    key: range && presets[range] ? range : "7d",
    label: preset.label,
    days: preset.days,
    startMs,
    endMs,
    previousStartMs: startMs - preset.days * 86_400_000,
    previousEndMs: startMs,
  };
}

function raw() {
  return sqliteHandle();
}

function all(sql: string, params: unknown[] = []): Row[] {
  const db = raw();
  if (!db) return [];
  try { return db.prepare(sql).all(...params) as Row[]; } catch { return []; }
}

function one(sql: string, params: unknown[] = []): Row | undefined {
  return all(sql, params)[0];
}

function num(value: unknown): number {
  return Number(value ?? 0) || 0;
}

export function analyticsRetentionDays(): number {
  const configured = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 90);
  return Math.max(1, Math.min(3650, Number.isFinite(configured) ? configured : 90));
}

let lastPruneAt = 0;

/** Prune at most once an hour so collection does not pay a delete on every event. */
export function pruneAnalyticsIfDue(): number {
  if (Date.now() - lastPruneAt < 60 * 60_000) return 0;
  lastPruneAt = Date.now();
  return pruneAnalytics();
}

/** Remove old sessions and their pageviews/events. Safe to run repeatedly. */
export function pruneAnalytics(): number {
  const db = raw();
  if (!db) return 0;
  const cutoff = Date.now() - analyticsRetentionDays() * 86_400_000;
  try {
    db.prepare("DELETE FROM analytics_pageviews WHERE entered_at < ?").run(cutoff);
    db.prepare("DELETE FROM analytics_events WHERE occurred_at < ?").run(cutoff);
    const result = db.prepare("DELETE FROM analytics_sessions WHERE last_seen_at < ?").run(cutoff);
    return Number(result.changes ?? 0);
  } catch {
    return 0;
  }
}

export type AnalyticsInput = {
  sessionId: string;
  visitorId: string;
  path: string;
  title?: string;
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  country?: string;
  region?: string;
  timezone?: string;
  language?: string;
  device?: string;
  browser?: string;
  os?: string;
  viewport?: string;
};

function safeEngagementSeconds(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(120, Math.round(parsed))) : 0;
}

function safeScroll(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0;
}

export function recordPageview(input: AnalyticsInput): boolean {
  const db = raw();
  if (!db) return false;
  const now = Date.now();
  try {
    db.prepare(
      `INSERT INTO analytics_sessions
        (session_id, visitor_id, started_at, last_seen_at, landing_path, exit_path, referrer, source, medium, campaign, country, region, timezone, language, device, browser, os, viewport, pageview_count, engagement_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         exit_path = excluded.exit_path,
         pageview_count = analytics_sessions.pageview_count + 1`,
    ).run(
      input.sessionId,
      input.visitorId,
      now,
      now,
      input.path,
      input.path,
      input.referrer?.slice(0, 500) ?? null,
      input.source?.slice(0, 80) || "direct",
      input.medium?.slice(0, 80) ?? null,
      input.campaign?.slice(0, 120) ?? null,
      input.country?.slice(0, 80) ?? null,
      input.region?.slice(0, 120) ?? null,
      input.timezone?.slice(0, 80) ?? null,
      input.language?.slice(0, 40) ?? null,
      input.device?.slice(0, 40) || "unknown",
      input.browser?.slice(0, 60) || "unknown",
      input.os?.slice(0, 60) || "unknown",
      input.viewport?.slice(0, 40) ?? null,
      now,
    );

    // Close the previous page view for this session so exit/duration are meaningful.
    const openPage = one("SELECT id, entered_at FROM analytics_pageviews WHERE session_id = ? AND left_at IS NULL ORDER BY id DESC LIMIT 1", [input.sessionId]);
    if (openPage) {
      db.prepare("UPDATE analytics_pageviews SET left_at = ?, duration_seconds = MAX(duration_seconds, ?) WHERE id = ?").run(now, Math.max(0, Math.round((now - num(openPage.entered_at)) / 1000)), num(openPage.id));
    }
    const landing = one("SELECT COUNT(*) AS n FROM analytics_pageviews WHERE session_id = ?", [input.sessionId]);
    db.prepare(
      "INSERT INTO analytics_pageviews (session_id, visitor_id, path, title, referrer, entered_at, created_at, is_landing) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(input.sessionId, input.visitorId, input.path, input.title?.slice(0, 300) ?? null, input.referrer?.slice(0, 500) ?? null, now, now, num(landing?.n) === 0 ? 1 : 0);
    return true;
  } catch {
    return false;
  }
}

export function recordEngagement(input: AnalyticsInput & { seconds?: number; scrollDepth?: number; exit?: boolean }): boolean {
  const db = raw();
  if (!db) return false;
  const now = Date.now();
  const seconds = safeEngagementSeconds(input.seconds);
  const scroll = safeScroll(input.scrollDepth);
  try {
    db.prepare("UPDATE analytics_sessions SET last_seen_at = ?, exit_path = ?, engagement_seconds = engagement_seconds + ? WHERE session_id = ?").run(now, input.path, seconds, input.sessionId);
    const page = one("SELECT id, duration_seconds FROM analytics_pageviews WHERE session_id = ? AND path = ? ORDER BY id DESC LIMIT 1", [input.sessionId, input.path]);
    if (page) {
      db.prepare("UPDATE analytics_pageviews SET duration_seconds = duration_seconds + ?, scroll_depth = MAX(scroll_depth, ?), left_at = COALESCE(?, left_at) WHERE id = ?").run(seconds, scroll, input.exit ? now : null, num(page.id));
    }
    return true;
  } catch {
    return false;
  }
}

const ALLOWED_EVENTS = new Set([
  "generate_lead",
  "consultation_request",
  "newsletter_signup",
  "roi_estimate",
  "phone_click",
  "email_click",
  "revenue_diagnostic_started",
  "revenue_diagnostic_completed",
  "fit_assessment_started",
  "fit_assessment_completed",
  "ai_lead",
  "ai_handoff",
  "ai_appointment_started",
  "ai_appointment_confirmed",
  "ai_appointment_cancelled",
  "ai_appointment_rescheduled",
  "service_cta",
  "switching_page_cta",
  "calculator_started",
  "calculator_completed",
]);

export function isAllowedAnalyticsEvent(name: string): boolean {
  return ALLOWED_EVENTS.has(name);
}

export function recordAnalyticsEvent(input: { sessionId?: string; visitorId?: string; name: string; path?: string }): boolean {
  const db = raw();
  if (!db || !isAllowedAnalyticsEvent(input.name)) return false;
  try {
    db.prepare("INSERT INTO analytics_events (session_id, visitor_id, name, path, occurred_at) VALUES (?, ?, ?, ?, ?)").run(input.sessionId ?? null, input.visitorId ?? null, input.name, input.path?.slice(0, 300) ?? null, Date.now());
    return true;
  } catch {
    return false;
  }
}

function firstSeenMap(startMs: number, endMs: number, previousStartMs: number): { newUsers: number; returningUsers: number } {
  const rows = all("SELECT visitor_id, MIN(started_at) AS first FROM analytics_sessions WHERE started_at < ? GROUP BY visitor_id", [endMs]);
  let newUsers = 0;
  let returningUsers = 0;
  for (const row of rows) {
    const first = num(row.first);
    if (first >= startMs) newUsers += 1;
    else if (first >= previousStartMs) returningUsers += 1;
  }
  return { newUsers, returningUsers };
}

function periodTotals(startMs: number, endMs: number) {
  const session = one(
    `SELECT COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS users,
      COALESCE(SUM(pageview_count), 0) AS pageviews,
      COALESCE(SUM(engagement_seconds), 0) AS engaged_seconds,
      COALESCE(SUM(CASE WHEN engagement_seconds >= 10 THEN 1 ELSE 0 END), 0) AS engaged_sessions,
      COALESCE(AVG(MAX(last_seen_at - started_at, 0)), 0) AS average_duration_ms
     FROM analytics_sessions WHERE started_at >= ? AND started_at < ?`,
    [startMs, endMs],
  );
  return {
    sessions: num(session?.sessions),
    users: num(session?.users),
    pageViews: num(one("SELECT COUNT(*) AS n FROM analytics_pageviews WHERE entered_at >= ? AND entered_at < ?", [startMs, endMs])?.n),
    engagedSessions: num(session?.engaged_sessions),
    engagementRate: num(session?.sessions) ? num(session?.engaged_sessions) / num(session?.sessions) : 0,
    averageSessionDuration: num(session?.sessions) ? num(session?.average_duration_ms) / 1000 : 0,
    engagedSeconds: num(session?.engaged_seconds),
  };
}

function pctChange(current: number, previous: number): number | null {
  return previous ? ((current - previous) / previous) * 100 : null;
}

export type AnalyticsSnapshot = {
  available: boolean;
  error: string | null;
  totals: {
    users: number;
    newUsers: number;
    sessions: number;
    pageViews: number;
    engagedSessions: number;
    engagementRate: number;
    averageSessionDuration: number;
  };
  previous: AnalyticsSnapshot["totals"];
  change: { users: number | null; sessions: number | null; pageViews: number | null; engagedSessions: number | null };
  series: { date: string; users: number; sessions: number; pageViews: number }[];
  pages: { path: string; users: number; views: number; averageTime: number; engagementRate: number }[];
  landingPages: { path: string; users: number; sessions: number }[];
  exitPages: { path: string; users: number; sessions: number }[];
  sources: { source: string; users: number; sessions: number; engagedSessions: number; engagementRate: number }[];
  referrals: { source: string; medium: string; users: number }[];
  visitors: {
    newVsReturning: { label: string; users: number }[];
    devices: { label: string; users: number }[];
    browsers: { label: string; users: number }[];
    operatingSystems: { label: string; users: number }[];
    countries: { label: string; users: number }[];
    regions: { label: string; users: number }[];
  };
  events: { name: string; count: number }[];
  warning: string | null;
};

function emptySnapshot(error: string | null = null): AnalyticsSnapshot {
  const emptyTotals = { users: 0, newUsers: 0, sessions: 0, pageViews: 0, engagedSessions: 0, engagementRate: 0, averageSessionDuration: 0 };
  return {
    available: Boolean(raw()), error, totals: emptyTotals, previous: emptyTotals, change: { users: null, sessions: null, pageViews: null, engagedSessions: null },
    series: [], pages: [], landingPages: [], exitPages: [], sources: [], referrals: [],
    visitors: { newVsReturning: [], devices: [], browsers: [], operatingSystems: [], countries: [], regions: [] },
    events: [], warning: null,
  };
}

function groupVisitors(field: "device" | "browser" | "os" | "country" | "region", startMs: number, endMs: number): { label: string; users: number }[] {
  return all(`SELECT COALESCE(NULLIF(TRIM(${field}), ''), 'Unknown') AS label, COUNT(DISTINCT visitor_id) AS users FROM analytics_sessions WHERE started_at >= ? AND started_at < ? GROUP BY label ORDER BY users DESC LIMIT 12`, [startMs, endMs])
    .map((row) => ({ label: String(row.label), users: num(row.users) }));
}

export function getAnalyticsSnapshot(range: AnalyticsRange): AnalyticsSnapshot {
  if (!raw()) return emptySnapshot("The application database is unavailable.");
  pruneAnalyticsIfDue();
  const current = periodTotals(range.startMs, range.endMs);
  const previous = periodTotals(range.previousStartMs, range.previousEndMs);
  const firstSeen = firstSeenMap(range.startMs, range.endMs, range.previousStartMs);
  const seriesRows = all("SELECT strftime('%Y-%m-%d', started_at / 1000, 'unixepoch') AS day, COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS users, COALESCE(SUM(pageview_count), 0) AS pageviews FROM analytics_sessions WHERE started_at >= ? AND started_at < ? GROUP BY day ORDER BY day", [range.startMs, range.endMs]);
  const series = seriesRows.map((row) => ({ date: String(row.day), users: num(row.users), sessions: num(row.sessions), pageViews: num(row.pageviews) }));

  const pageRows = all(
    `SELECT p.path, COUNT(*) AS views, COUNT(DISTINCT p.visitor_id) AS users,
      COALESCE(AVG(CASE WHEN p.left_at IS NOT NULL THEN p.duration_seconds ELSE 0 END), 0) AS avg_time,
      COALESCE(AVG(CASE WHEN p.duration_seconds >= 10 THEN 1 ELSE 0 END), 0) AS engaged_share
     FROM analytics_pageviews p WHERE p.entered_at >= ? AND p.entered_at < ? GROUP BY p.path ORDER BY views DESC LIMIT 25`,
    [range.startMs, range.endMs],
  );
  const landingRows = all("SELECT landing_path AS path, COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS users FROM analytics_sessions WHERE started_at >= ? AND started_at < ? GROUP BY landing_path ORDER BY sessions DESC LIMIT 15", [range.startMs, range.endMs]);
  const exitRows = all("SELECT exit_path AS path, COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS users FROM analytics_sessions WHERE started_at >= ? AND started_at < ? AND exit_path IS NOT NULL GROUP BY exit_path ORDER BY sessions DESC LIMIT 15", [range.startMs, range.endMs]);
  const sourceRows = all(
    `SELECT COALESCE(NULLIF(TRIM(source), ''), 'direct') AS source,
      COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS users,
      COALESCE(SUM(CASE WHEN engagement_seconds >= 10 THEN 1 ELSE 0 END), 0) AS engaged_sessions
     FROM analytics_sessions WHERE started_at >= ? AND started_at < ? GROUP BY source ORDER BY users DESC LIMIT 15`,
    [range.startMs, range.endMs],
  );
  const referralRows = all(
    `SELECT referrer, COUNT(*) AS users FROM analytics_sessions WHERE started_at >= ? AND started_at < ? AND referrer IS NOT NULL AND referrer <> '' GROUP BY referrer ORDER BY users DESC LIMIT 15`,
    [range.startMs, range.endMs],
  );
  const eventRows = all("SELECT name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY count DESC", [range.startMs, range.endMs]);

  const newVsReturning = [
    { label: "New", users: firstSeen.newUsers },
    { label: "Returning", users: firstSeen.returningUsers },
  ].filter((item) => item.users > 0);
  const referrals = referralRows.map((row) => {
    let source = String(row.referrer ?? "").slice(0, 120);
    try { source = new URL(source).hostname; } catch { /* keep raw */ }
    return { source: source || "Unknown", medium: "referral", users: num(row.users) };
  });

  return {
    available: true,
    error: null,
    totals: { users: current.users, newUsers: firstSeen.newUsers, sessions: current.sessions, pageViews: current.pageViews, engagedSessions: current.engagedSessions, engagementRate: current.engagementRate, averageSessionDuration: current.averageSessionDuration },
    previous: { users: previous.users, newUsers: 0, sessions: previous.sessions, pageViews: previous.pageViews, engagedSessions: previous.engagedSessions, engagementRate: previous.engagementRate, averageSessionDuration: previous.averageSessionDuration },
    change: { users: pctChange(current.users, previous.users), sessions: pctChange(current.sessions, previous.sessions), pageViews: pctChange(current.pageViews, previous.pageViews), engagedSessions: pctChange(current.engagedSessions, previous.engagedSessions) },
    series,
    pages: pageRows.map((row) => ({ path: String(row.path), users: num(row.users), views: num(row.views), averageTime: num(row.avg_time), engagementRate: num(row.engaged_share) })),
    landingPages: landingRows.map((row) => ({ path: String(row.path), users: num(row.users), sessions: num(row.sessions) })),
    exitPages: exitRows.map((row) => ({ path: String(row.path), users: num(row.users), sessions: num(row.sessions) })),
    sources: sourceRows.map((row) => ({ source: String(row.source), users: num(row.users), sessions: num(row.sessions), engagedSessions: num(row.engaged_sessions), engagementRate: num(row.sessions) ? num(row.engaged_sessions) / num(row.sessions) : 0 })),
    referrals,
    visitors: {
      newVsReturning,
      devices: groupVisitors("device", range.startMs, range.endMs),
      browsers: groupVisitors("browser", range.startMs, range.endMs),
      operatingSystems: groupVisitors("os", range.startMs, range.endMs),
      countries: groupVisitors("country", range.startMs, range.endMs),
      regions: groupVisitors("region", range.startMs, range.endMs),
    },
    events: eventRows.map((row) => ({ name: String(row.name), count: num(row.count) })),
    warning: current.sessions === 0 ? "No first-party traffic has been recorded for this range." : null,
  };
}

export type AnalyticsLive = {
  available: boolean;
  error: string | null;
  activeLast5: number;
  activeLast30: number;
  activeBasis: "5_minutes";
  pages: { label: string; activeUsers: number }[];
  devices: { label: string; activeUsers: number }[];
  sources: { label: string; activeUsers: number }[];
  countries: { label: string; activeUsers: number }[];
  fetchedAt: string;
  warning: string | null;
};

export function getAnalyticsLive(): AnalyticsLive {
  const now = Date.now();
  const five = now - 5 * 60_000;
  const thirty = now - 30 * 60_000;
  if (!raw()) return { available: false, error: "The application database is unavailable.", activeLast5: 0, activeLast30: 0, activeBasis: "5_minutes", pages: [], devices: [], sources: [], countries: [], fetchedAt: new Date().toISOString(), warning: null };
  const count = (from: number) => num(one("SELECT COUNT(DISTINCT visitor_id) AS n FROM analytics_sessions WHERE last_seen_at >= ?", [from])?.n);
  const activeRows = all("SELECT session_id, exit_path, device, source, country FROM analytics_sessions WHERE last_seen_at >= ? ORDER BY last_seen_at DESC LIMIT 200", [five]);
  const grouped = (field: "exit_path" | "device" | "source" | "country") => {
    const map = new Map<string, number>();
    for (const row of activeRows) {
      const label = String(row[field] ?? "Unknown") || "Unknown";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, activeUsers]) => ({ label, activeUsers })).sort((a, b) => b.activeUsers - a.activeUsers).slice(0, 8);
  };
  return {
    available: true,
    error: null,
    activeLast5: count(five),
    activeLast30: count(thirty),
    activeBasis: "5_minutes",
    pages: grouped("exit_path"),
    devices: grouped("device"),
    sources: grouped("source"),
    countries: grouped("country"),
    fetchedAt: new Date().toISOString(),
    warning: null,
  };
}
