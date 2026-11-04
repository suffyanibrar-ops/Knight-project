import { NextResponse } from "next/server";
import { pingDatabase } from "@/db";
import { sqliteStatus } from "@/lib/sqlite";
import { configStatus, isProduction } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Deployment health report.
 * Never returns secret values — only booleans and actionable messages.
 *
 * The application has a single embedded store (SQLite), so the top-level `ok`
 * is true only when that store opens AND answers a query. There is no external
 * database to report.
 */
export async function GET() {
  const database = pingDatabase();
  const sqlite = sqliteStatus();
  const status = configStatus();
  const errors = status.issues.filter((issue) => issue.severity === "error");

  return NextResponse.json(
    {
      ok: database.ok,
      service: "knight-medical-billing",
      environment: status.environment,
      siteUrl: status.siteUrl,
      stores: {
        sqlite: {
          role: "primary and only store — submissions, CRM leads, email outbox, subscribers, ROI estimates, audit and content",
          available: database.ok,
          path: sqlite.path,
          driver: sqlite.driver,
          error: database.error ?? sqlite.error,
        },
      },
      email: status.email,
      config: { blockingErrors: errors.length, issues: status.issues },
      fallbackContent: !database.ok,
      production: isProduction,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
