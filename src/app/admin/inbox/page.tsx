import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, Download, Inbox, Mail, Search, Trash2 } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { countSubmissions, isSqliteAvailable, listSubmissions, sqliteStatus } from "@/lib/sqlite";
import { AdminPageHeader, EmptyState, StatCard, formatDate } from "@/components/admin/ui";
import { deleteInboxSubmissionAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Consultation inbox backed by the embedded SQLite file (./data/app.db).
 * Output is rendered through React, which escapes all text automatically.
 * No raw HTML is ever injected here.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { q, id } = await searchParams;
  const query = (q ?? "").trim();
  const selectedId = Number(id);
  const rows = listSubmissions({ query: query || undefined });
  const total = countSubmissions();
  const status = sqliteStatus();
  const selected = rows.find((row) => row.id === selectedId);
  const emailSent = rows.filter((row) => row.email_status === "sent").length;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Consultation inbox"
        description="Every website form submission, stored in the embedded SQLite database (data/app.db). Newest first — search, open, or delete a row."
        actions={
          <a href="/api/admin/inbox-export" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        }
      />

      {!isSqliteAvailable() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-amber-700">Storage unavailable</p>
          <h2 className="mt-1.5 text-lg font-extrabold tracking-tight text-ink-950">The local database could not be opened</h2>
          <p className="mt-1.5 max-w-xl text-[0.82rem] leading-relaxed text-amber-900/80">
            {status.error ?? "The data directory is not writable."}
          </p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-amber-900/70">
            SQLite needs a writable, persistent filesystem (a VPS, Docker volume, Render/Railway disk, or a Node server).
            On read-only serverless platforms, set <code className="rounded bg-surface px-1.5 py-0.5 font-bold">SQLITE_PATH</code> to a mounted
            volume, or use the PostgreSQL-backed pages instead.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total submissions" value={total} tone="brand" />
        <StatCard label="Showing" value={rows.length} hint={query ? `Matching “${query}”` : "Newest 200"} />
        <StatCard label="Owner emailed" value={emailSent} hint="Accepted by Web3Forms" tone="good" />
        <StatCard label="Storage" value={status.available ? "SQLite" : "Offline"} hint={status.driver ?? "No driver"} tone={status.available ? "good" : "warn"} />
      </div>

      <form action="/admin/inbox" className="flex flex-col gap-2 rounded-2xl border border-mist-200 bg-surface p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/40" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name, email, facility, specialty or message…"
            aria-label="Search submissions"
            className="w-full rounded-xl border border-mist-200 py-2.5 pl-9 pr-3 text-[0.8rem] outline-none focus:border-brand-400"
          />
        </div>
        <button type="submit" className="rounded-xl bg-night-soft px-4 py-2.5 text-[0.76rem] font-bold text-white hover:bg-brand-600">
          Search
        </button>
        {query && (
          <Link href="/admin/inbox" className="rounded-xl border border-mist-200 px-4 py-2.5 text-center text-[0.76rem] font-bold text-ink-700 hover:border-brand-300">
            Clear
          </Link>
        )}
      </form>

      {selected && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[0.92rem] font-extrabold text-ink-950">
              <Inbox className="h-4 w-4 text-brand-700" /> Submission #{selected.id} · {selected.name}
            </h2>
            <Link href="/admin/inbox" className="text-[0.7rem] font-bold text-brand-700 hover:text-brand-500">Close</Link>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["Name", selected.name],
              ["Email", selected.email],
              ["Phone", selected.phone ?? "—"],
              ["Practice / facility", selected.practice ?? "—"],
              ["Facility type", selected.practice_size ?? "—"],
              ["Specialty", selected.specialty ?? "—"],
              ["Providers", selected.providers ?? "—"],
              ["Interested in", safeInterests(selected.interests)],
              ["Source", selected.source],
              ["Owner email", selected.email_status],
              ["Received", formatDate(selected.created_at)],
              ["Message", selected.message ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface px-3 py-2">
                <dt className="text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">{label}</dt>
                <dd className="mt-0.5 break-words text-[0.78rem] font-semibold text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`mailto:${encodeURIComponent(selected.email)}`} className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.7rem] font-bold text-white hover:bg-brand-600">
              <Mail className="h-3.5 w-3.5" /> Reply by email
            </a>
            {selected.phone && (
              <a href={`tel:${encodeURIComponent(selected.phone)}`} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-800 hover:border-brand-300">
                Call {selected.phone}
              </a>
            )}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title={query ? "No submissions match your search" : "No submissions yet"}
          description={query ? "Try a different name, email or keyword." : "When a visitor submits a form on the website, the enquiry appears here immediately."}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-mist-200 bg-mist-50/70">
                  {["Received", "Name", "Contact", "Facility", "Specialty", "Email", "Open", "Delete"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-mist-100 last:border-0 hover:bg-brand-50/30">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[0.68rem] text-ink-600/80">{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2.5 text-[0.78rem] font-extrabold text-ink-950">{row.name}</td>
                    <td className="px-3 py-2.5 text-[0.7rem] text-ink-700">
                      <span className="block max-w-[13rem] truncate">{row.email}</span>
                      <span className="text-ink-600/80">{row.phone ?? "—"}</span>
                    </td>
                    <td className="max-w-[11rem] truncate px-3 py-2.5 text-[0.7rem] text-ink-700">{row.practice ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[0.7rem] text-ink-700">{row.specialty ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6rem] font-extrabold capitalize ${
                        row.email_status === "sent" ? "border-mint-200 bg-mint-50 text-mint-700" : row.email_status === "failed" ? "border-rose-200 bg-rose-50 text-rose-600" : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}>
                        {row.email_status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/inbox?${new URLSearchParams({ ...(query ? { q: query } : {}), id: String(row.id) }).toString()}`} className="rounded-lg bg-brand-50 px-2.5 py-1 text-[0.64rem] font-bold text-brand-700 hover:bg-brand-500 hover:text-white">
                        View
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <form action={deleteInboxSubmissionAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" aria-label={`Delete submission from ${row.name}`} className="grid h-7 w-7 place-items-center rounded-full text-ink-600/40 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 rounded-2xl border border-mist-200 bg-surface px-4 py-3 text-[0.72rem] leading-relaxed text-ink-600/70">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        Storage file: <code className="mx-1 rounded bg-mist-100 px-1.5 py-0.5 font-semibold text-ink-900">{status.path}</code>
        — plain SQL, parameterized queries. Keep the data directory on a persistent volume in production.
      </p>
    </div>
  );
}

/** Interests are stored as a JSON string; render them safely as text. */
function safeInterests(raw: string | null): string {
  if (!raw) return "—";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const items = parsed.filter((item): item is string => typeof item === "string").slice(0, 20);
      return items.length ? items.join(", ") : "—";
    }
  } catch {
    /* fall through to raw text */
  }
  return raw.slice(0, 500);
}
