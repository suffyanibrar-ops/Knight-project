import type { ReactNode } from "react";

/**
 * Shown by the Postgres-backed admin pages when DATABASE_URL is not set.
 * The SQLite inbox and settings pages keep working without Postgres.
 */
export function PostgresNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-amber-700">Database not configured</p>
      <h2 className="mt-1.5 text-lg font-extrabold tracking-tight text-ink-950">This section needs PostgreSQL</h2>
      <p className="mt-1.5 max-w-xl text-[0.82rem] leading-relaxed text-amber-900/80">
        Add a <code className="rounded bg-surface px-1.5 py-0.5 font-bold">DATABASE_URL</code> environment variable and redeploy to use these
        Postgres-backed pages. The consultation inbox runs on the embedded SQLite database and works without it.
      </p>
      <p className="mt-2 text-[0.78rem] text-amber-900/70">After deploying the connection string, run: <code className="rounded bg-surface px-1.5 py-0.5">npm run db:push</code></p>
      {children}
    </div>
  );
}
