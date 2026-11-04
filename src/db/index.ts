import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * The database is OPTIONAL so the site can build and serve on any host
 * (any Node host: Vercel, Render, Railway, Cloud Run, a container, or a VPS).
 *
 * - When DATABASE_URL exists, every query runs normally.
 * - When it does not exist, `isDatabaseConfigured()` returns false and the
 *   content layer serves the built-in fallback data. Nothing throws at import
 *   time, so a missing database can never take the website down.
 */

const globalForDb = globalThis as typeof globalThis & {
  __knightPgPool?: Pool;
  __knightDrizzle?: NodePgDatabase<Record<string, never>>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

function getPool(): Pool {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!globalForDb.__knightPgPool) {
    globalForDb.__knightPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 4_000,
      allowExitOnIdle: true,
      // Managed Postgres providers (Neon, Supabase, RDS, Cloud SQL…) require TLS; local dev does not.
      // Enable TLS unless the connection string targets a local socket / disables SSL.
      //
      // Certificates are VERIFIED by default, so a DNS/MITM hijack cannot capture
      // the database credentials or patient data. Only a host whose certificate
      // chain Node cannot verify (for example a private/self-signed CA) should
      // ever opt out, and only through this explicitly named variable:
      //   DATABASE_SSL_INSECURE=1
      // Setting it disables MITM protection — never enable it on a public network.
      ssl: /localhost|127\.0\.0\.1|sslmode=disable/.test(process.env.DATABASE_URL ?? "")
        ? undefined
        : process.env.DATABASE_SSL_INSECURE === "1"
          ? { rejectUnauthorized: false }
          : { rejectUnauthorized: true },
    });
    globalForDb.__knightPgPool.on("error", (error) => {
      console.error("Postgres pool error", error.message);
    });
  }
  return globalForDb.__knightPgPool;
}

function getDb(): NodePgDatabase<Record<string, never>> {
  if (!globalForDb.__knightDrizzle) {
    globalForDb.__knightDrizzle = drizzle(getPool());
  }
  return globalForDb.__knightDrizzle;
}

/**
 * Lazy proxy: the pool is only created on first use, and only when a
 * connection string exists. Importing this module is always safe.
 */
export const db = new Proxy({} as NodePgDatabase<Record<string, never>>, {
  get(_target, property, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has() {
    return isDatabaseConfigured();
  },
});

export function getPoolIfConfigured(): Pool | null {
  return isDatabaseConfigured() ? getPool() : null;
}

export async function pingDatabase(): Promise<{ ok: boolean; configured: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, configured: false };
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("select 1");
      return { ok: true, configured: true };
    } finally {
      client.release();
    }
  } catch (error) {
    return { ok: false, configured: true, error: error instanceof Error ? error.message : "unknown database error" };
  }
}
