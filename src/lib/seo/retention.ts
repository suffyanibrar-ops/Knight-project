import "server-only";
import { sqliteHandle } from "@/lib/sqlite";

/**
 * Retention (Phase 6, P6.9).
 *
 * Search Console only exposes ~16 months, so raw daily metrics older than that
 * are worthless; observations and crawl snapshots are pruned sooner. Findings,
 * actions and measurements are retained indefinitely because they are the audit
 * trail that makes the system explainable later.
 */

export const RETENTION_DAYS = {
  metrics: 500,
  observations: 400,
  crawlPages: 90,
  syncRuns: 120,
  indexEvents: 400,
} as const;

const DAY = 24 * 60 * 60 * 1000;

export interface PruneResult {
  metrics: number;
  observations: number;
  crawlPages: number;
  syncRuns: number;
  indexEvents: number;
}

const changes = (result: { changes?: number } | undefined): number => Number(result?.changes ?? 0);

export function pruneSeoData(now = Date.now()): PruneResult {
  const db = sqliteHandle();
  if (!db) return { metrics: 0, observations: 0, crawlPages: 0, syncRuns: 0, indexEvents: 0 };

  const cutoff = (days: number) => new Date(now - days * DAY);

  const metricsCutoff = cutoff(RETENTION_DAYS.metrics).toISOString().slice(0, 10);
  const observationsCutoff = cutoff(RETENTION_DAYS.observations).toISOString();
  const crawlCutoff = cutoff(RETENTION_DAYS.crawlPages).getTime();
  const runsCutoff = cutoff(RETENTION_DAYS.syncRuns).getTime();
  const indexCutoff = cutoff(RETENTION_DAYS.indexEvents).getTime();

  db.exec("BEGIN");
  try {
    const result: PruneResult = {
      // Metric rows are keyed by report date, not insertion time.
      metrics: changes(db.prepare("DELETE FROM seo_metrics_daily WHERE date < ?").run(metricsCutoff) as { changes?: number }),
      observations: changes(db.prepare("DELETE FROM seo_observations WHERE observed_at < ?").run(observationsCutoff) as { changes?: number }),
      crawlPages: changes(db.prepare("DELETE FROM seo_pages WHERE crawled_at < ?").run(crawlCutoff) as { changes?: number }),
      // Only finished runs are pruned; an in-flight row is a live lock.
      syncRuns: changes(db.prepare("DELETE FROM seo_sync_runs WHERE finished_at IS NOT NULL AND finished_at < ?").run(runsCutoff) as { changes?: number }),
      indexEvents: changes(db.prepare("DELETE FROM seo_index_events WHERE submitted_at < ?").run(indexCutoff) as { changes?: number }),
    };
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}
