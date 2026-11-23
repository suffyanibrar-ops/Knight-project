import "server-only";
import { sqliteHandle } from "@/lib/sqlite";

/**
 * Sync bookkeeping + metric→observation adapter (Phase 6 pipeline wiring).
 *
 * `seo_sync_runs` existed but was only read (admin page) and pruned
 * (retention) — nothing wrote it. This module is the single writer so sync
 * health finally reflects reality.
 */

export type SyncProviderName = "gsc" | "bing";

export interface SyncRunRecord {
  provider: SyncProviderName;
  kind: string;
  status: "running" | "completed" | "failed" | "skipped";
  startedAt: number;
  finishedAt?: number | null;
  requests?: number;
  rows?: number;
  cursor?: string | null;
  error?: string | null;
}

export function recordSyncRun(record: SyncRunRecord): number | null {
  const db = sqliteHandle();
  if (!db) return null;
  const result = db.prepare(
    `INSERT INTO seo_sync_runs (provider, kind, status, started_at, finished_at, requests, rows_written, cursor, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.provider,
    record.kind,
    record.status,
    record.startedAt,
    record.finishedAt ?? null,
    record.requests ?? 0,
    record.rows ?? 0,
    record.cursor ?? null,
    record.error ? record.error.slice(0, 1000) : null,
  );
  return Number(result.lastInsertRowid);
}

export interface RecentSyncRun {
  provider: string;
  kind: string;
  status: string;
  startedAt: number;
  finishedAt: number | null;
  requests: number;
  rows: number;
  error: string | null;
}

export function recentSyncRuns(limit = 10): RecentSyncRun[] {
  const db = sqliteHandle();
  if (!db) return [];
  const rows = db.prepare(
    "SELECT provider, kind, status, started_at, finished_at, requests, rows_written, error FROM seo_sync_runs ORDER BY started_at DESC LIMIT ?",
  ).all(Math.min(Math.max(limit, 1), 100)) as Record<string, unknown>[];
  return rows.map((row) => ({
    provider: String(row.provider),
    kind: String(row.kind),
    status: String(row.status),
    startedAt: Number(row.started_at),
    finishedAt: row.finished_at === null ? null : Number(row.finished_at),
    requests: Number(row.requests ?? 0),
    rows: Number(row.rows_written ?? 0),
    error: row.error ? String(row.error) : null,
  }));
}
