import { Download, Trash2 } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { AdminPageHeader, EmptyState, StatCard, formatDate } from "@/components/admin/ui";
import { deleteSubmissionAction } from "../actions";

import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { PostgresNotice } from "@/components/admin/postgres-notice";

export const dynamic = "force-dynamic";

export default async function SubscribersPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isDatabaseConfigured()) return <PostgresNotice />;
  const rows = await db.select().from(subscribers).orderBy(desc(subscribers.createdAt));

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
        <StatCard label="Total subscribers" value={rows.length} tone="brand" />
        <StatCard label="Latest opt-in" value={rows[0] ? formatDate(rows[0].createdAt) : "—"} hint="Most recent subscription" />
      </div>

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
