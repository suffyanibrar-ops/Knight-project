import Link from "next/link";
import { Download, Search, Trash2 } from "lucide-react";
import { isSqliteAvailable, listSubscribers, parseSqliteDate } from "@/lib/sqlite";
import { AdminPageHeader, EmptyState, StatCard, formatDate } from "@/components/admin/ui";
import { deleteSubmissionAction } from "../actions";

import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { StorageNotice } from "@/components/admin/storage-notice";

export const dynamic = "force-dynamic";

/** The shape this page renders. */
type SubscriberRecord = {
  id: number;
  email: string;
  emailStatus: string;
  createdAt: Date | null;
};

/** Newsletter opt-ins live only in the embedded SQLite file. */
function loadSubscribers(): SubscriberRecord[] {
  return listSubscribers().map((row) => ({
    id: row.id,
    email: row.email,
    emailStatus: row.email_status,
    createdAt: parseSqliteDate(row.created_at),
  }));
}

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const allRows = loadSubscribers();
  const rows = query ? allRows.filter((row) => row.email.toLowerCase().includes(query.toLowerCase())) : allRows;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Newsletter subscribers"
        description="Opt-in email addresses from the website footer form. Each new subscription also notifies the owner inbox."
        actions={
          <a href="/api/admin/export?type=subscribers" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Total subscribers" value={allRows.length} tone="brand" />
        <StatCard label="Showing" value={rows.length} hint={query ? `Matching “${query}”` : "All subscribers"} />
        <StatCard label="Latest opt-in" value={allRows[0] ? formatDate(allRows[0].createdAt) : "—"} hint="Most recent subscription" />
      </div>

      <form action="/admin/subscribers" className="flex flex-col gap-2 rounded-2xl border border-mist-200 bg-surface p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/40" /><input name="q" defaultValue={query} placeholder="Search subscriber email…" aria-label="Search subscribers" className="w-full rounded-xl border border-mist-200 py-2.5 pl-9 pr-3 text-[0.8rem] outline-none focus:border-brand-400" /></div>
        <button type="submit" className="rounded-xl bg-night-soft px-4 py-2.5 text-[0.76rem] font-bold text-white hover:bg-brand-600">Search</button>
        {query && <Link href="/admin/subscribers" className="rounded-xl border border-mist-200 px-4 py-2.5 text-center text-[0.76rem] font-bold text-ink-700 hover:border-brand-300">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No subscribers yet" description="When a visitor subscribes through the footer form, their email appears here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-mist-200 bg-mist-50/70">
                {["Email", "Joined", "Owner notified", ""].map((heading) => (
                  <th key={heading} className="px-3 py-2.5 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-mist-100 last:border-0">
                  <td className="break-all px-3 py-2.5 text-[0.76rem] font-semibold text-ink-900">{row.email}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[0.7rem] text-ink-600/80">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-2.5 text-[0.7rem] capitalize text-ink-700">{row.emailStatus}</td>
                  <td className="px-3 py-2.5">
                    <form action={deleteSubmissionAction}>
                      <input type="hidden" name="type" value="subscriber" />
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" aria-label={`Remove ${row.email}`} className="grid h-7 w-7 place-items-center rounded-full text-ink-600/40 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
