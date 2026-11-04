import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { parseSqliteDate, sqliteHandle } from "@/lib/sqlite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Live analytics for the owner dashboard.
 *
 * Every number is a real SQL aggregate over the embedded SQLite database — no
 * demo data. The dashboard client polls this endpoint every 15 seconds, so the
 * response is deliberately cheap: indexed counts, one 14-day GROUP BY per table
 * and the six most recent submissions.
 *
 * GET /api/admin/analytics  (admin session required)
 */

export type AnalyticsTotals = {
  submissions: number;
  submissions7d: number;
  submissions30d: number;
  subscribers: number;
  roiEstimates: number;
  emailsSent: number;
  emailsBounced: number;
  emailsComplained: number;
  emailsQueued: number;
};

export type AnalyticsSeriesPoint = {
  /** Short label, e.g. "Nov 04". */
  date: string;
  submissions: number;
  newEnquiries: number;
};

export type AnalyticsDelivery = {
  sent: number;
  queued: number;
  failed: number;
  bounced: number;
  complained: number;
  suppressed: number;
};

export type AnalyticsRankedItem = { label: string; count: number };

export type AnalyticsRecentEnquiry = {
  id: number;
  name: string;
  email: string;
  specialty: string | null;
  /** ISO-8601 (UTC) or null when the stored value cannot be parsed. */
  createdAt: string | null;
  emailStatus: string;
};

export type AnalyticsPayload = {
  ok: boolean;
  /** False when SQLite could not be opened or the aggregates failed. */
  available: boolean;
  generatedAt: string;
  totals: AnalyticsTotals;
  series: AnalyticsSeriesPoint[];
  delivery: AnalyticsDelivery;
  topSpecialties: AnalyticsRankedItem[];
  topSources: AnalyticsRankedItem[];
  recent: AnalyticsRecentEnquiry[];
  error?: string;
};

const SERIES_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-04" for a UTC instant — the same day bucket SQLite's date() uses. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Ascending list of the last `days` UTC days, ending today. */
function seriesDayKeys(days: number): string[] {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);
  return Array.from({ length: days }, (_, index) => dayKey(new Date(start.getTime() + index * DAY_MS)));
}

/** "2026-11-04" → "Nov 04". */
function shortDayLabel(key: string): string {
  const [, month, day] = key.split("-");
  return `${MONTHS[Number(month) - 1] ?? ""} ${day}`;
}

function emptyPayload(available: boolean, error?: string): AnalyticsPayload {
  return {
    ok: true,
    available,
    generatedAt: new Date().toISOString(),
    totals: {
      submissions: 0,
      submissions7d: 0,
      submissions30d: 0,
      subscribers: 0,
      roiEstimates: 0,
      emailsSent: 0,
      emailsBounced: 0,
      emailsComplained: 0,
      emailsQueued: 0,
    },
    series: seriesDayKeys(SERIES_DAYS).map((key) => ({ date: shortDayLabel(key), submissions: 0, newEnquiries: 0 })),
    delivery: { sent: 0, queued: 0, failed: 0, bounced: 0, complained: 0, suppressed: 0 },
    topSpecialties: [],
    topSources: [],
    recent: [],
    ...(error ? { error } : {}),
  };
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const raw = sqliteHandle();
  if (!raw) {
    // The page normally shows StorageNotice before this call; still return a
    // valid, empty snapshot so the live charts never crash.
    return NextResponse.json(emptyPayload(false), { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const count = (sqlText: string, ...params: unknown[]): number => {
      const row = raw.prepare(sqlText).get(...params) as { n?: number } | undefined;
      return Number(row?.n ?? 0);
    };

    /* ---------------------------------------------------------------- */
    /* Totals                                                            */
    /* ---------------------------------------------------------------- */

    const statusRows = raw
      .prepare("SELECT status, COUNT(*) AS n FROM email_outbox GROUP BY status")
      .all() as { status: string; n: number }[];
    const byStatus = new Map(statusRows.map((row) => [String(row.status), Number(row.n)]));
    const statusCount = (status: string): number => byStatus.get(status) ?? 0;

    // Successful delivery: rows marked sent, or delivered by a provider webhook.
    const emailsSent = statusCount("sent") + statusCount("delivered");
    const emailsQueued = statusCount("pending") + statusCount("queued");
    const emailsBounced = statusCount("bounced");
    const emailsComplained = statusCount("complained");

    let suppressed = 0;
    try {
      suppressed = count("SELECT COUNT(*) AS n FROM email_suppressions");
    } catch {
      // Older databases may predate the suppression migration.
      suppressed = 0;
    }

    const totals: AnalyticsTotals = {
      submissions: count("SELECT COUNT(*) AS n FROM submissions"),
      submissions7d: count("SELECT COUNT(*) AS n FROM submissions WHERE datetime(created_at) >= datetime('now', '-7 days')"),
      submissions30d: count("SELECT COUNT(*) AS n FROM submissions WHERE datetime(created_at) >= datetime('now', '-30 days')"),
      subscribers: count("SELECT COUNT(*) AS n FROM subscribers"),
      roiEstimates: count("SELECT COUNT(*) AS n FROM roi_estimates"),
      emailsSent,
      emailsBounced,
      emailsComplained,
      emailsQueued,
    };

    /* ---------------------------------------------------------------- */
    /* 14-day series (missing days filled with 0)                        */
    /* ---------------------------------------------------------------- */

    const dayKeys = seriesDayKeys(SERIES_DAYS);
    const windowStart = dayKeys[0] ?? dayKey(new Date());
    const windowStartMs = Date.parse(`${windowStart}T00:00:00Z`);

    const submissionsByDay = new Map<string, number>();
    const submissionRows = raw
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS n
         FROM submissions
         WHERE created_at >= ?
         GROUP BY day`,
      )
      .all(windowStart) as { day: string; n: number }[];
    for (const row of submissionRows) submissionsByDay.set(String(row.day), Number(row.n));

    // Enquiries captured in the relational tables store epoch milliseconds.
    const enquiriesByDay = new Map<string, number>();
    const enquiryRows = raw
      .prepare(
        `SELECT day, SUM(n) AS n FROM (
           SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n
           FROM leads WHERE created_at >= ? GROUP BY day
           UNION ALL
           SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n
           FROM contact_messages WHERE created_at >= ? GROUP BY day
         ) GROUP BY day`,
      )
      .all(windowStartMs, windowStartMs) as { day: string; n: number }[];
    for (const row of enquiryRows) enquiriesByDay.set(String(row.day), Number(row.n));

    const series: AnalyticsSeriesPoint[] = dayKeys.map((key) => ({
      date: shortDayLabel(key),
      submissions: submissionsByDay.get(key) ?? 0,
      newEnquiries: enquiriesByDay.get(key) ?? 0,
    }));

    /* ---------------------------------------------------------------- */
    /* Delivery breakdown                                                */
    /* ---------------------------------------------------------------- */

    const delivery: AnalyticsDelivery = {
      sent: emailsSent,
      queued: emailsQueued,
      failed: statusCount("failed"),
      bounced: emailsBounced,
      complained: emailsComplained,
      suppressed,
    };

    /* ---------------------------------------------------------------- */
    /* Rankings and recent enquiries                                     */
    /* ---------------------------------------------------------------- */

    const topSpecialties = (
      raw
        .prepare(
          `SELECT COALESCE(NULLIF(TRIM(specialty), ''), 'Not specified') AS label, COUNT(*) AS count
           FROM submissions
           GROUP BY label
           ORDER BY count DESC, label ASC
           LIMIT 5`,
        )
        .all() as { label: string; count: number }[]
    ).map((row) => ({ label: String(row.label), count: Number(row.count) }));

    const topSources = (
      raw
        .prepare(
          `SELECT COALESCE(NULLIF(TRIM(source), ''), 'website') AS label, COUNT(*) AS count
           FROM submissions
           GROUP BY label
           ORDER BY count DESC, label ASC
           LIMIT 5`,
        )
        .all() as { label: string; count: number }[]
    ).map((row) => ({ label: String(row.label), count: Number(row.count) }));

    const recentRows = raw
      .prepare(
        `SELECT id, name, email, specialty, email_status, created_at
         FROM submissions
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT 6`,
      )
      .all() as { id: number; name: string; email: string; specialty: string | null; email_status: string; created_at: string | null }[];

    const recent: AnalyticsRecentEnquiry[] = recentRows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      email: String(row.email),
      specialty: row.specialty === null ? null : String(row.specialty),
      // Stored as UTC text; normalise so the browser shows the correct time.
      createdAt: parseSqliteDate(row.created_at)?.toISOString() ?? null,
      emailStatus: String(row.email_status),
    }));

    const payload: AnalyticsPayload = {
      ok: true,
      available: true,
      generatedAt: new Date().toISOString(),
      totals,
      series,
      delivery,
      topSpecialties,
      topSources,
      recent,
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[analytics] aggregate query failed", error);
    return NextResponse.json(emptyPayload(false, "Analytics could not be read from SQLite."), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
