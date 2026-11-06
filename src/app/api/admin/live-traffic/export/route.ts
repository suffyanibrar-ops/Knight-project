import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAnalyticsRange } from "@/lib/analytics";
import { sqliteHandle } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

/** Export first-party pageviews for the selected range. Hashed IDs are omitted. */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const range = resolveAnalyticsRange(url.searchParams.get("range"), url.searchParams.get("start"), url.searchParams.get("end"));
  const db = sqliteHandle();
  if (!db) return NextResponse.json({ ok: false, error: "Analytics database unavailable." }, { status: 503 });

  let rows: Record<string, unknown>[] = [];
  try {
    rows = db.prepare(
      `SELECT p.entered_at, p.path, p.title, p.duration_seconds, p.scroll_depth,
        s.source, s.medium, s.referrer, s.country, s.region, s.device, s.browser, s.os, s.landing_path, s.exit_path
       FROM analytics_pageviews p LEFT JOIN analytics_sessions s ON s.session_id = p.session_id
       WHERE p.entered_at >= ? AND p.entered_at < ?
       ORDER BY p.entered_at ASC LIMIT 50000`,
    ).all(range.startMs, range.endMs) as Record<string, unknown>[];
  } catch {
    return NextResponse.json({ ok: false, error: "Could not query analytics." }, { status: 500 });
  }

  const headers = ["timestamp_utc", "path", "title", "duration_seconds", "scroll_depth", "source", "medium", "referrer", "country", "region", "device", "browser", "os", "landing_path", "exit_path"];
  const body = [headers.join(","), ...rows.map((row) => [new Date(Number(row.entered_at)).toISOString(), row.path, row.title, row.duration_seconds, row.scroll_depth, row.source, row.medium, row.referrer, row.country, row.region, row.device, row.browser, row.os, row.landing_path, row.exit_path].map(csv).join(","))].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="knight-traffic-${range.key}.csv"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
