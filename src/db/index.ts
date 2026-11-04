import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { isSqliteAvailable, sqliteHandle, sqlitePath, sqliteStatus } from "@/lib/sqlite";

/**
 * Query layer for the embedded SQLite database.
 *
 * There is no external database and no connection string: every query runs on
 * the single better-sqlite3 file owned by `src/lib/sqlite.ts` (WAL mode,
 * busy_timeout, migrations). This module only attaches Drizzle's typed query
 * builder to that same connection so pages and routes keep their concise
 * queries.
 *
 * If the file cannot be opened (read-only host, bad SQLITE_PATH), the proxy
 * throws a clear error on first use; callers that must keep the public site up
 * guard with `isSqliteAvailable()` or catch the error and fall back.
 */

const globalForDb = globalThis as typeof globalThis & {
  __knightDrizzle?: BetterSQLite3Database<Record<string, never>>;
};

function getDb(): BetterSQLite3Database<Record<string, never>> {
  if (!globalForDb.__knightDrizzle) {
    const handle = sqliteHandle();
    if (!handle) {
      throw new Error(
        `SQLite is unavailable at "${sqlitePath()}". Set SQLITE_PATH to a writable, persistent directory (for example /var/data/app.db).`,
      );
    }
    globalForDb.__knightDrizzle = drizzle(handle);
  }
  return globalForDb.__knightDrizzle;
}

/** Lazy proxy: the connection is resolved on first query, never at import time. */
export const db = new Proxy({} as BetterSQLite3Database<Record<string, never>>, {
  get(_target, property, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has() {
    return isSqliteAvailable();
  },
});

/**
 * Health probe for /api/health. Synchronous: SQLite either opens and answers,
 * or it does not.
 */
export function pingDatabase(): { ok: boolean; configured: boolean; path: string; error?: string } {
  const status = sqliteStatus();
  if (!isSqliteAvailable()) {
    return { ok: false, configured: true, path: status.path, error: status.error ?? "SQLite unavailable" };
  }
  try {
    const handle = sqliteHandle();
    if (!handle) throw new Error("SQLite handle missing");
    handle.prepare("select 1 as ok").get();
    return { ok: true, configured: true, path: status.path };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      path: status.path,
      error: error instanceof Error ? error.message : "unknown SQLite error",
    };
  }
}

export { isSqliteAvailable, sqlitePath, sqliteStatus };
