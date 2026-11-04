import "server-only";
import fs from "node:fs";
import Database from "better-sqlite3";
import { SCHEMA } from "./sqlite-schema";

/**
 * Embedded SQLite storage — a single local file, no external service, no API key
 * and no ORM. Only parameterized SQL statements are executed.
 *
 * The database file is created automatically on first use at:
 *   ./data/app.db           (override with SQLITE_PATH)
 *
 * The driver is better-sqlite3 (a bundled native module with prebuilt binaries
 * for Linux, macOS and Windows). If the file cannot be opened — for example on a
 * read-only or ephemeral serverless filesystem — every helper degrades
 * gracefully: the site keeps working and the admin panel explains the situation
 * instead of crashing.
 */

export type SqliteRunResult = { lastInsertRowid: number; changes: number };

type RawDatabase = Database.Database;

type Driver = {
  exec: (sql: string) => void;
  run: (sql: string, params: unknown[]) => SqliteRunResult;
  all: <T>(sql: string, params: unknown[]) => T[];
  get: <T>(sql: string, params: unknown[]) => T | undefined;
};

type DriverState = { driver: Driver | null; raw: RawDatabase | null; path: string; error: string | null; kind: string | null };

const globalForSqlite = globalThis as typeof globalThis & { __knightSqlite?: DriverState };

/** Default location: ./data/app.db relative to the project root. */
const DEFAULT_DB_DIR = "data";
const DEFAULT_DB_FILE = "data/app.db";

/**
 * Resolved database location.
 *
 * SQLITE_PATH may be relative (resolved from the project root) or absolute
 * (recommended in production, e.g. /var/data/app.db on a mounted volume).
 * There is deliberately NO fallback to a temporary directory: an unwritable
 * path is reported as an error rather than silently losing submissions.
 */
export function sqlitePath(): string {
  const configured = process.env.SQLITE_PATH?.trim();
  const target = configured || DEFAULT_DB_FILE;
  return target.startsWith("/") ? target : `${process.cwd()}/${target}`;
}

function parentOf(target: string): string {
  const index = target.lastIndexOf("/");
  if (index <= 0) return "/";
  return target.slice(0, index);
}

/**
 * Creates the parent directory if needed, failing fast.
 *
 * IMPORTANT: we never call mkdir() blindly. On read-only or virtual
 * filesystems (and on stalled network mounts) a recursive mkdir can block
 * indefinitely, which would hang every request. We first locate the nearest
 * existing ancestor and verify it is writable — that check returns in
 * microseconds and lets us fail with a clear message instead.
 */
function ensureDirectory(file: string) {
  const dir = parentOf(file);
  if (fs.existsSync(dir)) return;

  // Walk up to the nearest existing ancestor and confirm we may write there.
  let probe = dir;
  for (let depth = 0; depth < 32; depth += 1) {
    const next = parentOf(probe);
    if (!next || next === probe) break;
    probe = next;
    if (fs.existsSync(probe)) break;
  }

  try {
    fs.accessSync(probe, fs.constants.W_OK);
  } catch {
    throw new Error(
      `SQLite directory "${dir}" does not exist and "${probe}" is not writable by the server process. ` +
        "Set SQLITE_PATH to a writable path on a persistent volume.",
    );
  }

  fs.mkdirSync(dir, { recursive: true });
}



function wrapBetterSqlite3(instance: unknown): Driver {
  const db = instance as {
    exec: (sql: string) => unknown;
    prepare: (sql: string) => {
      run: (...params: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
      all: (...params: unknown[]) => unknown[];
      get: (...params: unknown[]) => unknown;
    };
  };
  return {
    exec: (sql) => void db.exec(sql),
    run: (sql, params) => {
      const result = db.prepare(sql).run(...params);
      return { lastInsertRowid: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    all: <T,>(sql: string, params: unknown[]) => db.prepare(sql).all(...params) as T[],
    get: <T,>(sql: string, params: unknown[]) => db.prepare(sql).get(...params) as T | undefined,
  };
}

/**
 * Schema migrations, applied in order and tracked with `PRAGMA user_version`.
 * Every statement is idempotent (`CREATE ... IF NOT EXISTS`), so an existing
 * database is upgraded in place without losing rows. Add a new entry (and bump
 * SCHEMA_VERSION) for future schema changes; never edit a shipped entry.
 */
const SCHEMA_VERSION = 2;
const MIGRATIONS: { version: number; statements: string }[] = [
  { version: 1, statements: SCHEMA },
  // v2: store the provider's message id so delivery webhooks can update a row.
  { version: 2, statements: "ALTER TABLE email_outbox ADD COLUMN provider_message_id TEXT;" },
];

function migrate(driver: Driver, raw: RawDatabase) {
  const current = Number(raw.pragma("user_version", { simple: true }) ?? 0);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    driver.exec("BEGIN");
    try {
      driver.exec(migration.statements);
      raw.pragma(`user_version = ${migration.version}`);
      driver.exec("COMMIT");
    } catch (error) {
      try {
        driver.exec("ROLLBACK");
      } catch {
        /* transaction already gone */
      }
      throw error;
    }
  }
}

function open(): DriverState {
  const file = sqlitePath();

  const attempt = (kind: string, create: () => RawDatabase): DriverState | null => {
    try {
      ensureDirectory(file);
      const raw = create();
      const driver = wrapBetterSqlite3(raw);
      // WAL: readers never block the writer. Ignore failures on unusual filesystems.
      try {
        driver.exec("PRAGMA journal_mode = WAL;");
      } catch {
        /* non-fatal */
      }
      // Wait up to 5s for a competing writer instead of failing with SQLITE_BUSY.
      driver.exec("PRAGMA busy_timeout = 5000;");
      driver.exec("PRAGMA foreign_keys = ON;");
      driver.exec("PRAGMA synchronous = NORMAL;");
      migrate(driver, raw);
      return { driver, raw, path: file, error: null, kind };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[sqlite] ${kind} unavailable: ${message}`);
      return null;
    }
  };

  const opened = attempt("better-sqlite3", () => new Database(file));
  if (opened) return opened;

  return {
    driver: null,
    raw: null,
    path: file,
    error:
      `SQLite could not open "${file}". The directory must exist and be writable by the server process. ` +
      "Set SQLITE_PATH to a persistent volume (for example /var/data/app.db) and redeploy. " +
      "Form submissions are NOT being stored until this is resolved.",
    kind: null,
  };
}

function state(): DriverState {
  if (!globalForSqlite.__knightSqlite) {
    globalForSqlite.__knightSqlite = open();
    if (globalForSqlite.__knightSqlite.driver) {
      console.info(`[sqlite] using ${globalForSqlite.__knightSqlite.kind} at ${globalForSqlite.__knightSqlite.path}`);
    }
  }
  return globalForSqlite.__knightSqlite;
}

export function isSqliteAvailable(): boolean {
  return state().driver !== null;
}

/**
 * The single better-sqlite3 connection, shared with the Drizzle query builder so
 * the whole app uses one handle (one WAL writer, one busy-timeout policy).
 * Returns null when SQLite could not be opened; callers degrade or report it.
 */
export function sqliteHandle(): RawDatabase | null {
  return state().raw;
}

/**
 * Parse a SQLite datetime value. `datetime('now')` stores UTC text as
 * "YYYY-MM-DD HH:MM:SS", which `new Date()` would otherwise interpret as local
 * time — shifting every displayed timestamp by the server's UTC offset.
 * Returns null for empty or unparsable values so callers can render a dash.
 */
export function parseSqliteDate(value: string | null | undefined): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const isoish = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text) ? `${text.replace(" ", "T")}Z` : text;
  const date = new Date(isoish);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sqliteStatus() {
  const current = state();
  return { available: current.driver !== null, driver: current.kind, path: current.path, error: current.error };
}

/* ------------------------------------------------------------------ */
/* Submissions                                                         */
/* ------------------------------------------------------------------ */

export type SubmissionInput = {
  name: string;
  email: string;
  phone?: string | null;
  practice?: string | null;
  specialty?: string | null;
  practiceSize?: string | null;
  providers?: string | null;
  interests?: string[];
  message?: string | null;
  source?: string | null;
};

export type SubmissionRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  practice: string | null;
  specialty: string | null;
  practice_size: string | null;
  providers: string | null;
  interests: string | null;
  message: string | null;
  source: string;
  email_status: string;
  created_at: string;
};

export function insertSubmission(input: SubmissionInput): { ok: boolean; id?: number; error?: string } {
  const current = state();
  if (!current.driver) return { ok: false, error: current.error ?? "SQLite unavailable" };

  try {
    const result = current.driver.run(
      `INSERT INTO submissions (name, email, phone, practice, specialty, practice_size, providers, interests, message, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.email,
        input.phone ?? null,
        input.practice ?? null,
        input.specialty ?? null,
        input.practiceSize ?? null,
        input.providers ?? null,
        JSON.stringify(input.interests ?? []),
        input.message ?? null,
        input.source ?? "website",
      ],
    );
    return { ok: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("[sqlite] insert failed", error);
    return { ok: false, error: "Could not save submission." };
  }
}

export function listSubmissions(options: { query?: string; limit?: number } = {}): SubmissionRow[] {
  const current = state();
  if (!current.driver) return [];

  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  const query = options.query?.trim();

  try {
    if (query) {
      const like = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
      return current.driver.all<SubmissionRow>(
        `SELECT * FROM submissions
         WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR practice LIKE ? ESCAPE '\\'
            OR specialty LIKE ? ESCAPE '\\' OR COALESCE(message, '') LIKE ? ESCAPE '\\'
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ?`,
        [like, like, like, like, like, limit],
      );
    }
    return current.driver.all<SubmissionRow>(
      `SELECT * FROM submissions ORDER BY datetime(created_at) DESC, id DESC LIMIT ?`,
      [limit],
    );
  } catch (error) {
    console.error("[sqlite] list failed", error);
    return [];
  }
}

export function countSubmissions(): number {
  const current = state();
  if (!current.driver) return 0;
  try {
    const row = current.driver.get<{ total: number }>("SELECT COUNT(*) AS total FROM submissions", []);
    return Number(row?.total ?? 0);
  } catch {
    return 0;
  }
}

export function deleteSubmission(id: number): boolean {
  const current = state();
  if (!current.driver) return false;
  try {
    const result = current.driver.run("DELETE FROM submissions WHERE id = ?", [id]);
    return result.changes > 0;
  } catch (error) {
    console.error("[sqlite] delete failed", error);
    return false;
  }
}

/**
 * Duplicate-submission guard: returns the existing row when the same email sent
 * an identical message within the cooldown window, so retries and double-clicks
 * do not create multiple enquiries (and therefore do not send duplicate emails).
 */
export function findRecentDuplicate(email: string, message: string | null, windowMinutes = 10): { id: number } | null {
  const current = state();
  if (!current.driver) return null;
  try {
    const row = current.driver.get<{ id: number }>(
      `SELECT id FROM submissions
       WHERE email = ?
         AND COALESCE(message, '') = COALESCE(?, '')
         AND datetime(created_at) >= datetime('now', ?)
       ORDER BY id DESC LIMIT 1`,
      [email, message, `-${Math.max(1, Math.floor(windowMinutes))} minutes`],
    );
    return row ?? null;
  } catch {
    return null;
  }
}

export function setSubmissionEmailStatus(id: number, status: "pending" | "sent" | "failed"): void {
  const current = state();
  if (!current.driver) return;
  try {
    current.driver.run("UPDATE submissions SET email_status = ? WHERE id = ?", [status, id]);
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------------------------------------------ */
/* Email outbox delivery status (updated by the Resend webhook)        */
/* ------------------------------------------------------------------ */

/**
 * Applies a delivery event to the outbox row created when the message was
 * sent. Provider message ids are unique per send, so this is safe to call for
 * duplicate webhook deliveries (Resend retries): the update is idempotent.
 */
export function updateOutboxByProviderMessageId(
  messageId: string,
  status: "delivered" | "bounced" | "complained" | "failed",
  lastError?: string | null,
): boolean {
  const current = state();
  if (!current.driver || !messageId) return false;
  try {
    const result = current.driver.run(
      "UPDATE email_outbox SET status = ?, last_error = COALESCE(?, last_error) WHERE provider_message_id = ?",
      [status, lastError ?? null, messageId],
    );
    return result.changes > 0;
  } catch (error) {
    console.error("[sqlite] outbox status update failed", error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Newsletter subscribers (primary store; Postgres is an optional mirror) */
/* ------------------------------------------------------------------ */

export type SubscriberRow = {
  id: number;
  email: string;
  email_status: string;
  created_at: string;
};

/**
 * Store a newsletter opt-in. Idempotent: subscribing the same address twice
 * returns the existing row instead of failing on the UNIQUE constraint.
 */
export function insertSubscriber(input: { email: string }): { ok: boolean; id?: number; duplicate?: boolean; error?: string } {
  const current = state();
  if (!current.driver) return { ok: false, error: current.error ?? "SQLite unavailable" };

  try {
    const existing = current.driver.get<{ id: number }>("SELECT id FROM subscribers WHERE email = ?", [input.email]);
    if (existing) return { ok: true, id: Number(existing.id), duplicate: true };
    const result = current.driver.run("INSERT INTO subscribers (email) VALUES (?)", [input.email]);
    return { ok: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("[sqlite] subscriber insert failed", error);
    return { ok: false, error: "Could not save subscriber." };
  }
}

export function listSubscribers(options: { limit?: number } = {}): SubscriberRow[] {
  const current = state();
  if (!current.driver) return [];
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  try {
    return current.driver.all<SubscriberRow>(
      "SELECT * FROM subscribers ORDER BY datetime(created_at) DESC, id DESC LIMIT ?",
      [limit],
    );
  } catch (error) {
    console.error("[sqlite] subscriber list failed", error);
    return [];
  }
}

export function countSubscribers(): number {
  const current = state();
  if (!current.driver) return 0;
  try {
    const row = current.driver.get<{ total: number }>("SELECT COUNT(*) AS total FROM subscribers", []);
    return Number(row?.total ?? 0);
  } catch {
    return 0;
  }
}

export function deleteSubscriber(id: number): boolean {
  const current = state();
  if (!current.driver) return false;
  try {
    return current.driver.run("DELETE FROM subscribers WHERE id = ?", [id]).changes > 0;
  } catch (error) {
    console.error("[sqlite] subscriber delete failed", error);
    return false;
  }
}

export function setSubscriberEmailStatus(id: number, status: "pending" | "sent" | "failed"): void {
  const current = state();
  if (!current.driver) return;
  try {
    current.driver.run("UPDATE subscribers SET email_status = ? WHERE id = ?", [status, id]);
  } catch {
    /* non-fatal */
  }
}

/** Records delivery outcome for an opt-in identified by its address. */
export function setSubscriberEmailStatusByEmail(email: string, status: "pending" | "sent" | "failed"): void {
  const current = state();
  if (!current.driver) return;
  try {
    current.driver.run("UPDATE subscribers SET email_status = ? WHERE email = ?", [status, email.toLowerCase()]);
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------------------------------------------ */
/* ROI estimates (primary store; Postgres is an optional mirror)      */
/* ------------------------------------------------------------------ */

export type RoiEstimateRow = {
  id: number;
  email: string | null;
  monthly_collections: number;
  denial_rate: number;
  days_in_ar: number;
  estimated_annual_uplift: number;
  email_status: string;
  created_at: string;
};

export type RoiEstimateInput = {
  email: string | null;
  monthlyCollections: number;
  denialRate: number;
  daysInAr: number;
  estimatedAnnualUplift: number;
};

export function insertRoiEstimate(input: RoiEstimateInput): { ok: boolean; id?: number; error?: string } {
  const current = state();
  if (!current.driver) return { ok: false, error: current.error ?? "SQLite unavailable" };

  try {
    const result = current.driver.run(
      `INSERT INTO roi_estimates (email, monthly_collections, denial_rate, days_in_ar, estimated_annual_uplift)
       VALUES (?, ?, ?, ?, ?)`,
      [input.email, input.monthlyCollections, input.denialRate, input.daysInAr, input.estimatedAnnualUplift],
    );
    return { ok: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("[sqlite] roi insert failed", error);
    return { ok: false, error: "Could not save estimate." };
  }
}

export function listRoiEstimates(options: { limit?: number } = {}): RoiEstimateRow[] {
  const current = state();
  if (!current.driver) return [];
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  try {
    return current.driver.all<RoiEstimateRow>(
      "SELECT * FROM roi_estimates ORDER BY datetime(created_at) DESC, id DESC LIMIT ?",
      [limit],
    );
  } catch (error) {
    console.error("[sqlite] roi list failed", error);
    return [];
  }
}

export function countRoiEstimates(): number {
  const current = state();
  if (!current.driver) return 0;
  try {
    const row = current.driver.get<{ total: number }>("SELECT COUNT(*) AS total FROM roi_estimates", []);
    return Number(row?.total ?? 0);
  } catch {
    return 0;
  }
}

export function deleteRoiEstimate(id: number): boolean {
  const current = state();
  if (!current.driver) return false;
  try {
    return current.driver.run("DELETE FROM roi_estimates WHERE id = ?", [id]).changes > 0;
  } catch (error) {
    console.error("[sqlite] roi delete failed", error);
    return false;
  }
}

export function setRoiEstimateEmailStatus(id: number, status: "pending" | "sent" | "failed"): void {
  const current = state();
  if (!current.driver) return;
  try {
    current.driver.run("UPDATE roi_estimates SET email_status = ? WHERE id = ?", [status, id]);
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------------------------------------------ */
/* Settings (used for the admin password)                              */
/* ------------------------------------------------------------------ */

export function getSetting(key: string): string | null {
  const current = state();
  if (!current.driver) return null;
  try {
    const row = current.driver.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function setSetting(key: string, value: string): boolean {
  const current = state();
  if (!current.driver) return false;
  try {
    current.driver.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value],
    );
    return true;
  } catch (error) {
    console.error("[sqlite] settings write failed", error);
    return false;
  }
}
