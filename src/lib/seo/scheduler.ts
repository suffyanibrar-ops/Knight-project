import "server-only";
import { randomUUID } from "node:crypto";
import { sqliteHandle } from "@/lib/sqlite";
import { runGscSync, type GscFetch } from "./gsc-sync";
import { requireBingKey, runBingSync, verifyBingSite, type BingFetch } from "./bing-sync";

/**
 * Scheduler integration for the GSC and Bing sync tasks (P6.3.1–P6.3.5).
 *
 * Design notes, derived from the existing scheduler rather than assumed:
 *  - task bookkeeping reuses `seo_automation_runs` (status running/completed/
 *    failed/skipped, retry_count, meta_json, error) — there is no second queue;
 *  - locks are rows, not files: a `running` row for the same task is the lock,
 *    acquired inside a `BEGIN IMMEDIATE` transaction so two processes cannot
 *    both insert one;
 *  - quota accounting reuses `seo_quota_ledger` (v13) with hourly + daily
 *    buckets keyed by provider;
 *  - provider budgets are our operational policy, not API limits. GSC's real
 *    documented limit is 1,200 requests/minute per site (Rev 3 §1); the daily
 *    figure here is a self-imposed budget so a bug cannot burn the quota.
 */

export const SYNC_TASKS = ["gsc_sync", "bing_sync"] as const;
export type SyncTask = (typeof SYNC_TASKS)[number];

export type SyncProvider = "gsc" | "bing";

/** 30 minutes: longer than the tick's own 20-minute overlap guard. */
export const STALE_LOCK_MS = 30 * 60 * 1000;
export const MIN_INTERVAL_HOURS = 1;
export const MAX_INTERVAL_HOURS = 168;

export const SYNC_SETTING_DEFAULTS: Record<string, string> = {
  gsc_interval_hours: "6",
  bing_interval_hours: "12",
  gsc_lookback_days: "3",
  gsc_max_requests_per_run: "20",
  gsc_daily_request_budget: "48",
  bing_daily_request_budget: "24",
};

export type SyncSettings = Record<string, string>;

export function isSyncTask(value: string): value is SyncTask {
  return (SYNC_TASKS as readonly string[]).includes(value);
}

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Interval is clamped so a misconfiguration cannot poll aggressively or never run. */
export function syncIntervalHours(task: SyncTask, settings: SyncSettings): number {
  const key = task === "gsc_sync" ? "gsc_interval_hours" : "bing_interval_hours";
  const fallback = num(SYNC_SETTING_DEFAULTS[key], 6);
  const provided = (settings[key] ?? "").trim();
  const parsed = provided === "" ? NaN : Number(provided);
  // A numeric value is clamped into range (0 means "as often as allowed");
  // a missing or non-numeric value falls back to the safe default.
  const raw = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(MAX_INTERVAL_HOURS, Math.max(MIN_INTERVAL_HOURS, Math.round(raw)));
}

export function dailyBudget(provider: SyncProvider, settings: SyncSettings): number {
  const key = provider === "gsc" ? "gsc_daily_request_budget" : "bing_daily_request_budget";
  return Math.max(1, Math.min(240, Math.round(num(settings[key], num(SYNC_SETTING_DEFAULTS[key], 12)))));
}

function dayStart(now: number): number {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function hourStart(now: number): number {
  return Math.floor(now / (60 * 60 * 1000)) * 60 * 60 * 1000;
}

export function quotaUsedToday(provider: SyncProvider, now = Date.now()): number {
  const db = sqliteHandle();
  if (!db) return 0;
  const row = db.prepare(
    "SELECT requests FROM seo_quota_ledger WHERE provider = ? AND window_start = ? AND window_kind = 'day'",
  ).get(provider, dayStart(now)) as { requests?: number } | undefined;
  return Number(row?.requests ?? 0);
}

export function quotaRemaining(provider: SyncProvider, settings: SyncSettings, now = Date.now()): number {
  return Math.max(0, dailyBudget(provider, settings) - quotaUsedToday(provider, now));
}

/**
 * Adds the *actual* number of HTTP calls to the hourly and daily buckets.
 * Counting happens once per run, after the summary is known, so pagination is
 * included and retries inside a run are not counted twice.
 */
export function recordQuotaUsage(provider: SyncProvider, requests: number, rows: number, now = Date.now()): void {
  if (requests <= 0) return;
  const db = sqliteHandle();
  if (!db) return;
  const write = db.prepare(
    `INSERT INTO seo_quota_ledger (provider, window_start, window_kind, requests, rows_read)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(provider, window_start, window_kind) DO UPDATE SET
       requests = requests + excluded.requests,
       rows_read = rows_read + excluded.rows_read`,
  );
  db.exec("BEGIN");
  try {
    write.run(provider, hourStart(now), "hour", requests, rows);
    write.run(provider, dayStart(now), "day", requests, rows);
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

export interface LockResult {
  acquired: boolean;
  /** Run row to finish, when acquired. */
  runId?: number;
  executionId?: string;
  /** Existing run id that still holds the lock. */
  blockedBy?: number;
  /** Stale runs marked as failed during recovery. */
  recovered?: number[];
}

/**
 * Atomic lock + run creation. `BEGIN IMMEDIATE` takes SQLite's write lock before
 * the read, so two processes cannot both observe "no running row".
 */
export function acquireTaskRun(task: SyncTask, now = Date.now()): LockResult {
  const db = sqliteHandle();
  if (!db) return { acquired: false };
  const executionId = randomUUID();

  db.exec("BEGIN IMMEDIATE");
  try {
    const running = db.prepare(
      "SELECT id, started_at FROM seo_automation_runs WHERE task_type = ? AND status = 'running' ORDER BY started_at DESC",
    ).all(task) as { id: number; started_at: number }[];

    const recovered: number[] = [];
    for (const row of running) {
      if (now - Number(row.started_at) < STALE_LOCK_MS) {
        db.exec("ROLLBACK");
        return { acquired: false, blockedBy: Number(row.id) };
      }
      // Stale: the owning process is gone or wedged. Mark it interrupted rather
      // than deleting evidence, then allow this run to take over.
      db.prepare(
        "UPDATE seo_automation_runs SET status = 'failed', error = ?, completed_at = ?, duration_ms = ? WHERE id = ? AND status = 'running'",
      ).run("Interrupted: stale lock recovered", now, Math.max(0, now - Number(row.started_at)), Number(row.id));
      recovered.push(Number(row.id));
    }

    const previous = db.prepare(
      "SELECT status, retry_count FROM seo_automation_runs WHERE task_type = ? ORDER BY started_at DESC LIMIT 1",
    ).get(task) as { status?: string; retry_count?: number } | undefined;
    const retryCount = previous?.status === "failed" ? Math.min(3, Number(previous.retry_count ?? 0) + 1) : 0;

    const result = db.prepare(
      "INSERT INTO seo_automation_runs (execution_id, task_type, status, started_at, retry_count, meta_json) VALUES (?, ?, 'running', ?, ?, '{}')",
    ).run(executionId, task, now, retryCount);
    db.exec("COMMIT");
    return { acquired: true, runId: Number(result.lastInsertRowid), executionId, recovered };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

export interface FinishOptions {
  status: "completed" | "failed" | "skipped";
  meta: Record<string, unknown>;
  error?: string;
  now?: number;
}

/** Terminal transition. Marking a run terminal is what releases the lock. */
export function finishTaskRun(runId: number, options: FinishOptions): void {
  const db = sqliteHandle();
  if (!db) return;
  const now = options.now ?? Date.now();
  const startedAt = (db.prepare("SELECT started_at FROM seo_automation_runs WHERE id = ?").get(runId) as { started_at?: number } | undefined)?.started_at;
  db.prepare(
    `UPDATE seo_automation_runs
        SET status = ?, completed_at = ?, duration_ms = ?, error = ?, meta_json = ?
      WHERE id = ?`,
  ).run(
    options.status,
    now,
    startedAt ? Math.max(0, now - Number(startedAt)) : null,
    options.error ? options.error.slice(0, 1000) : null,
    JSON.stringify(options.meta).slice(0, 20_000),
    runId,
  );
}

export interface GscStepInput {
  token: string;
  propertyKey: string;
  propertyKind?: "domain" | "url_prefix";
  dates: string[];
  fetchImpl: GscFetch;
  maxRequests: number;
}

export interface BingStepInput {
  key: string;
  siteUrl: string;
  fetchImpl: BingFetch;
  /** Extra request reserved for GetUserSites verification. */
  verifyFirst?: boolean;
}

export interface SyncSummary {
  requests: number;
  rows: number;
  pages: number;
  errors: { where: string; status: number; code: string | number | null }[];
  truncated: boolean;
  provider: SyncProvider;
}

/** GSC: settled days only (Google publishes with a 2–3 day delay). */
export function settledDates(lookbackDays: number, now = Date.now()): string[] {
  const days = Math.max(1, Math.min(14, Math.round(lookbackDays)));
  const dates: string[] = [];
  for (let offset = 2; offset <= days + 1; offset += 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

export async function runGscStep(input: GscStepInput, now = Date.now()): Promise<SyncSummary> {
  const summary = await runGscSync({
    token: input.token,
    propertyKey: input.propertyKey,
    propertyKind: input.propertyKind,
    dates: input.dates.length ? input.dates : settledDates(3, now),
    maxRequests: Math.max(1, input.maxRequests),
    fetchImpl: input.fetchImpl,
  });
  return {
    provider: "gsc",
    requests: summary.requests,
    rows: summary.rows,
    pages: summary.pages,
    errors: summary.errors.map((error) => ({ where: `${error.date}/${error.type}`, status: error.status, code: error.code })),
    truncated: summary.truncated,
  };
}

export async function runBingStep(input: BingStepInput, now = Date.now()): Promise<SyncSummary> {
  let requests = 0;
  const errors: SyncSummary["errors"] = [];

  if (input.verifyFirst !== false) {
    const host = (() => {
      try { return new URL(input.siteUrl).hostname; } catch { return input.siteUrl; }
    })();
    const verified = await verifyBingSite({ key: input.key, host, fetchImpl: input.fetchImpl });
    requests += 1;
    if (!verified.ok) {
      errors.push({ where: "GetUserSites", status: verified.status, code: null });
      return { provider: "bing", requests, rows: 0, pages: 0, errors, truncated: false };
    }
  }

  const summary = await runBingSync({
    key: input.key,
    siteUrl: input.siteUrl,
    fetchImpl: input.fetchImpl,
    observedAt: new Date(now).toISOString(),
  });
  requests += summary.requests;
  for (const error of summary.errors) {
    errors.push({ where: error.method, status: error.status, code: error.code });
  }
  return {
    provider: "bing",
    requests,
    rows: summary.observations,
    pages: summary.requests,
    errors,
    truncated: false,
  };
}

export interface SyncRunOutcome {
  status: "completed" | "failed" | "skipped";
  task: SyncTask;
  requests: number;
  rows: number;
  error?: string;
  meta: Record<string, unknown>;
}

function classifyError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (/BING_WEBMASTER_API_KEY/.test(message)) return "missing_credentials: Bing API key is not configured.";
    if (/SQLite is unavailable/.test(message)) return "database_unavailable";
    if (/timeout|aborted/i.test(message)) return "network_timeout";
    return message.slice(0, 500);
  }
  return "unknown_error";
}

/**
 * One full attempt: lock → budget check → provider step → quota → finish.
 * Every exit path marks the run terminal, which is what releases the lock.
 */
export async function runSyncTask(
  task: SyncTask,
  options: {
    settings: SyncSettings;
    now?: number;
    gsc?: () => Promise<GscStepInput>;
    bing?: () => Promise<BingStepInput>;
  },
): Promise<SyncRunOutcome> {
  const now = options.now ?? Date.now();
  const provider: SyncProvider = task === "gsc_sync" ? "gsc" : "bing";
  const lock = acquireTaskRun(task, now);

  if (!lock.acquired || lock.runId === undefined) {
    return {
      status: "skipped",
      task,
      requests: 0,
      rows: 0,
      error: lock.blockedBy ? `already_running: run ${lock.blockedBy}` : "lock_unavailable",
      meta: { reason: "already_running", blockedBy: lock.blockedBy ?? null },
    };
  }

  const meta: Record<string, unknown> = { recoveredRuns: lock.recovered ?? [] };

  const remaining = quotaRemaining(provider, options.settings, now);
  if (remaining <= 0) {
    finishTaskRun(lock.runId, { status: "skipped", meta: { ...meta, reason: "daily_budget_exhausted" }, now });
    return {
      status: "skipped",
      task,
      requests: 0,
      rows: 0,
      error: "daily_budget_exhausted",
      meta: { ...meta, reason: "daily_budget_exhausted" },
    };
  }

  try {
    const summary = task === "gsc_sync"
      ? await runGscStep(await (options.gsc?.() ?? Promise.reject(new Error("GSC dependencies unavailable."))), now)
      : await runBingStep(await (options.bing?.() ?? Promise.reject(new Error("Bing dependencies unavailable."))), now);

    recordQuotaUsage(provider, summary.requests, summary.rows, now);

    const failure = summary.errors[0];
    const failed = Boolean(failure);
    const status: "completed" | "failed" = failed ? "failed" : "completed";
    const error = failure ? `${failure.where}: HTTP ${failure.status}${failure.code !== null ? ` (${failure.code})` : ""}` : undefined;
    const fullMeta = { ...meta, requests: summary.requests, rows: summary.rows, pages: summary.pages, truncated: summary.truncated, errors: summary.errors.slice(0, 5) };

    finishTaskRun(lock.runId, { status, meta: fullMeta, error, now });
    return { status, task, requests: summary.requests, rows: summary.rows, error, meta: fullMeta };
  } catch (error) {
    const message = classifyError(error);
    finishTaskRun(lock.runId, { status: "failed", meta: { ...meta, error: message }, error: message, now });
    return { status: "failed", task, requests: 0, rows: 0, error: message, meta: { ...meta, error: message } };
  }
}

/** Provider wiring used by the scheduler; tests inject their own dependencies. */
export async function loadBingDependencies(siteUrl: string, fetchImpl: BingFetch): Promise<BingStepInput> {
  return { key: requireBingKey(), siteUrl, fetchImpl, verifyFirst: true };
}
