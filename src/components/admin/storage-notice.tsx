/**
 * Shown when the embedded SQLite file cannot be opened (read-only filesystem,
 * missing persistent volume, bad SQLITE_PATH). There is no external database to
 * fall back to, so the page explains exactly what to fix instead of pretending
 * the data is unavailable for another reason.
 */
export function StorageNotice() {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
      <h2 className="text-lg font-extrabold tracking-tight text-amber-900">Local database unavailable</h2>
      <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-amber-800">
        This deployment cannot open its SQLite file, so the records on this page cannot be read or written. The
        directory must exist and be writable, and it must persist across restarts and deploys.
      </p>
      <ul className="mt-3 space-y-1 text-[0.82rem] leading-relaxed text-amber-800">
        <li>
          Set <code className="rounded bg-amber-100 px-1">SQLITE_PATH</code> to a file on a persistent volume, e.g.
          <code className="ml-1 rounded bg-amber-100 px-1">/var/lib/knight/app.db</code>.
        </li>
        <li>Do not point it at a temporary directory or a public/static directory.</li>
        <li>
          Current status is reported by <code className="rounded bg-amber-100 px-1">GET /api/health</code> under
          <code className="ml-1 rounded bg-amber-100 px-1">stores.sqlite</code>.
        </li>
      </ul>
    </div>
  );
}
