import { NextResponse } from "next/server";
import { pingDatabase } from "@/db";
import { isSqliteAvailable, sqliteStatus } from "@/lib/sqlite";
import { configIssues, isProduction, siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Deployment health report.
 * Never returns secret values — only booleans and actionable messages.
 */
export async function GET() {
  const postgres = await pingDatabase();
  const sqlite = sqliteStatus();
  const issues = configIssues();
  const errors = issues.filter((issue) => issue.severity === "error");

  return NextResponse.json(
    {
      ok: true,
      service: "knight-medical-billing",
      environment: process.env.NODE_ENV ?? "development",
      siteUrl: siteUrl(),
      stores: {
        sqlite: {
          role: "primary form storage",
          available: isSqliteAvailable(),
          path: sqlite.path,
          driver: sqlite.driver,
          error: sqlite.error,
        },
        postgres: {
          role: "CRM mirror, content, outbox",
          configured: postgres.configured,
          status: postgres.configured ? (postgres.ok ? "connected" : "unavailable") : "not-configured",
        },
      },
      config: { blockingErrors: errors.length, issues },
      fallbackContent: !postgres.ok,
      production: isProduction,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
