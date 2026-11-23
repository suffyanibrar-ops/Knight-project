import "server-only";
import { sqliteHandle } from "@/lib/sqlite";
import { evidenceHash, type Observation } from "./observations";
import type { ConsolidatedFinding } from "./findings";

/**
 * Persistence for the evidence layer (P6.1).
 *
 * Observations are append-only and idempotent on `evidence_hash`, so a re-run of
 * the same measurement inserts nothing new. Findings are upserted on
 * `finding_key`, preserving the original `first_seen` while refreshing recency,
 * confidence and priority.
 */

export function saveObservations(observations: Observation[], runId: number | null = null): number {
  const db = sqliteHandle();
  if (!db) return 0;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO seo_observations
      (run_id, source, check_id, subject_type, subject_key, observed_at, window_start, window_end,
       severity, completeness, provenance, metrics_json, evidence_json, evidence_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let inserted = 0;
  db.exec("BEGIN");
  try {
    for (const observation of observations) {
      const result = insert.run(
        runId,
        observation.source,
        observation.checkId,
        observation.subjectType,
        observation.subjectKey,
        observation.observedAt,
        observation.windowStart ?? null,
        observation.windowEnd ?? null,
        observation.severity ?? null,
        observation.completeness ?? null,
        observation.provenance ?? null,
        observation.metrics ? JSON.stringify(observation.metrics) : null,
        observation.evidence ? JSON.stringify(observation.evidence) : null,
        evidenceHash(observation),
      ) as { changes?: number };
      inserted += Number(result?.changes ?? 0);
    }
    db.exec("COMMIT");
    return inserted;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

export function saveFindings(findings: ConsolidatedFinding[]): number {
  const db = sqliteHandle();
  if (!db) return 0;
  const upsert = db.prepare(
    `INSERT INTO seo_findings
      (finding_key, check_id, subject_type, subject_key, claim_class, level, severity, status,
       confidence, priority_score, priority_version, factors_json, explanation, observation_count,
       source_names_json, disagreement, first_seen, last_seen, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(finding_key) DO UPDATE SET
       claim_class = excluded.claim_class,
       level = excluded.level,
       severity = excluded.severity,
       confidence = excluded.confidence,
       priority_score = excluded.priority_score,
       priority_version = excluded.priority_version,
       factors_json = excluded.factors_json,
       explanation = excluded.explanation,
       observation_count = excluded.observation_count,
       source_names_json = excluded.source_names_json,
       disagreement = excluded.disagreement,
       last_seen = excluded.last_seen,
       -- Re-open only when the incoming observation is newer than the moment the
       -- finding was verified as resolved. Re-consolidating the same historical
       -- observations must not resurrect an issue a later crawl proved fixed.
       status = CASE
         WHEN seo_findings.status = 'resolved'
          AND julianday(excluded.last_seen) <= julianday(seo_findings.updated_at / 1000.0, 'unixepoch')
         THEN 'resolved' ELSE 'open' END,
       updated_at = CASE
         WHEN seo_findings.status = 'resolved'
          AND julianday(excluded.last_seen) <= julianday(seo_findings.updated_at / 1000.0, 'unixepoch')
         THEN seo_findings.updated_at ELSE excluded.updated_at END`,
  );

  let written = 0;
  db.exec("BEGIN");
  try {
    for (const finding of findings) {
      upsert.run(
        finding.key,
        finding.checkId,
        finding.subjectType,
        finding.subjectKey,
        finding.claimClass,
        finding.level,
        finding.severity,
        finding.confidence,
        finding.priority.score,
        finding.priority.factors.version,
        JSON.stringify(finding.priority.factors),
        finding.priority.explanation,
        finding.observationCount,
        JSON.stringify(finding.sourceNames),
        finding.disagreement ? 1 : 0,
        finding.firstSeen,
        finding.lastSeen,
        Date.now(),
      );
      written += 1;
    }
    db.exec("COMMIT");
    return written;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

export interface StoredFinding {
  findingKey: string;
  checkId: string;
  subjectType: string;
  subjectKey: string;
  claimClass: string;
  level: string;
  severity: string;
  status: string;
  confidence: number;
  priorityScore: number;
  explanation: string | null;
  observationCount: number;
  sources: string[];
  disagreement: boolean;
  firstSeen: string;
  lastSeen: string;
}

export type FindingStatus = "open" | "resolved" | "dismissed";

export function listFindings(limit = 100, status: FindingStatus = "open"): StoredFinding[] {
  const db = sqliteHandle();
  if (!db) return [];
  const rows = db.prepare(
    `SELECT * FROM seo_findings WHERE status = ? ORDER BY priority_score DESC, last_seen DESC LIMIT ?`,
  ).all(status, Math.min(Math.max(limit, 1), 500)) as Record<string, unknown>[];
  return rows.map((row) => ({
    findingKey: String(row.finding_key),
    checkId: String(row.check_id),
    subjectType: String(row.subject_type),
    subjectKey: String(row.subject_key),
    claimClass: String(row.claim_class),
    level: String(row.level),
    severity: String(row.severity),
    status: String(row.status),
    confidence: Number(row.confidence),
    priorityScore: Number(row.priority_score),
    explanation: row.explanation ? String(row.explanation) : null,
    observationCount: Number(row.observation_count),
    sources: safeJsonArray(row.source_names_json),
    disagreement: Number(row.disagreement) === 1,
    firstSeen: String(row.first_seen),
    lastSeen: String(row.last_seen),
  }));
}

/**
 * Verification step after a crawl.
 *
 * A deterministic URL finding is resolved only when the page was crawled in this
 * run and the check no longer produced an observation. Findings from search
 * analytics (or from a page the run did not reach) are left untouched, so this
 * can never "resolve" a defect that was not actually re-measured.
 */
export function resolveCrawledFindings(input: { crawledUrls: string[]; observedKeys: string[] }): number {
  const db = sqliteHandle();
  if (!db || input.crawledUrls.length === 0) return 0;
  const observed = new Set(input.observedKeys);
  const urls = new Set(input.crawledUrls);
  const rows = db.prepare(
    `SELECT finding_key, subject_key, claim_class, source_names_json FROM seo_findings
      WHERE status = 'open' AND subject_type = 'url'`,
  ).all() as { finding_key: string; subject_key: string; claim_class: string; source_names_json: string | null }[];
  const stale = rows.filter((row) =>
    urls.has(row.subject_key)
    && row.claim_class === "confirmed_defect"
    && !observed.has(row.finding_key)
    && safeJsonArray(row.source_names_json).some((source) => source === "rules" || source === "crawl" || source === "linkinator"),
  );
  if (stale.length === 0) return 0;
  const update = db.prepare("UPDATE seo_findings SET status = 'resolved', updated_at = ? WHERE finding_key = ? AND status = 'open'");
  const now = Date.now();
  let changed = 0;
  db.exec("BEGIN");
  try {
    for (const row of stale) changed += Number((update.run(now, row.finding_key) as { changes?: number })?.changes ?? 0);
    db.exec("COMMIT");
    return changed;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

function safeJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
