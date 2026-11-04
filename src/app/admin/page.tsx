import { ArrowRight, Download, Mail, MailWarning, MessageSquare, PieChart, Users } from "lucide-react";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages, emailOutbox, leads } from "@/db/schema";
import { countRoiEstimates, countSubscribers, isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { AdminPageHeader, EmptyState, StatCard, StatusPill, formatDate } from "@/components/admin/ui";
import { OWNER_EMAIL } from "@/lib/email";

import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-05" (SQLite `date()`) → "Nov 05" for the weekly trend bars. */
function trendDayLabel(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  if (!month || !date) return day;
  return `${MONTH_LABELS[month - 1] ?? ""} ${String(date).padStart(2, "0")}`;
}

export default async function AdminOverviewPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const [leadRows, contactRows, outboxRows] = await Promise.all([
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(6),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(4),
    db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(5),
  ]);

  const [leadCount] = await db.select({ count: sql<number>`count(*)` }).from(leads);
  const [contactCount] = await db.select({ count: sql<number>`count(*)` }).from(contactMessages);
  const [newLeadCount] = await db.select({ count: sql<number>`count(*)` }).from(leads).where(sql`${leads.status} = 'new'`);
  const [queuedEmailCount] = await db.select({ count: sql<number>`count(*)` }).from(emailOutbox).where(sql`${emailOutbox.status} <> 'sent'`);

  const subscriberCount = countSubscribers();
  const roiEstimateCount = countRoiEstimates();

  // SQLite stores created_at as epoch milliseconds, so the day bucket and the
  // rolling window are computed with SQLite's own date functions.
  const weekTrend = await db
    .select({
      day: sql<string>`date(${leads.createdAt} / 1000, 'unixepoch')`,
      total: sql<number>`count(*)`,
    })
    .from(leads)
    .where(sql`${leads.createdAt} > ${Date.now() - SEVEN_DAYS_MS}`)
    .groupBy(sql`date(${leads.createdAt} / 1000, 'unixepoch')`)
    .orderBy(sql`date(${leads.createdAt} / 1000, 'unixepoch')`);

  const maxTrend = Math.max(1, ...weekTrend.map((row) => Number(row.total)));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description={`Every form submission is stored here and forwarded to ${OWNER_EMAIL}. If a delivery channel is unavailable, the message stays queued in Email delivery.`}
        actions={
          <>
            <Link href="/admin/submissions" className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600">
              View submissions <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a href="/api/admin/export?type=leads" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Consultation requests" value={leadCount?.count ?? 0} hint={`${newLeadCount?.count ?? 0} awaiting response`} tone="brand" />
        <StatCard label="Contact messages" value={contactCount?.count ?? 0} hint="From the contact form" />
        <StatCard label="Newsletter subscribers" value={subscriberCount} hint="Opt-in email list" tone="good" />
        <StatCard label="ROI estimates" value={roiEstimateCount} hint="Calculator completions" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <section className="rounded-2xl border border-mist-200 bg-surface">
          <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-[0.82rem] font-extrabold text-ink-950">
              <MessageSquare className="h-4 w-4 text-brand-600" /> Latest consultation requests
            </h2>
            <Link href="/admin/submissions" className="text-[0.68rem] font-bold text-brand-700 hover:text-brand-500">
              View all
            </Link>
          </div>
          {leadRows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No requests yet" description="When a visitor submits the consultation form, it appears here instantly and is emailed to the owner inbox." />
            </div>
          ) : (
            <ul className="divide-y divide-mist-100">
              {leadRows.map((lead) => (
                <li key={lead.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.84rem] font-extrabold text-ink-950">{lead.name}</p>
                    <p className="truncate text-[0.72rem] text-ink-600/70">
                      {lead.email}
                      {lead.practice ? ` · ${lead.practice}` : ""}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-ink-600/70">
                      {lead.specialty || "Specialty not given"} · {formatDate(lead.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={lead.emailStatus === "sent" ? "sent" : lead.emailStatus} />
                    <StatusPill status={lead.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <h2 className="flex items-center gap-2 text-[0.82rem] font-extrabold text-ink-950">
              <PieChart className="h-4 w-4 text-brand-600" /> Requests · last 7 days
            </h2>
            {weekTrend.length === 0 ? (
              <p className="mt-3 text-[0.74rem] text-ink-600/80">No submissions in the last seven days.</p>
            ) : (
              <div className="mt-4 flex h-24 items-end gap-2">
                {weekTrend.map((row) => (
                  <div key={row.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[0.6rem] font-extrabold text-ink-700">{Number(row.total)}</span>
                    <div style={{ height: `${(Number(row.total) / maxTrend) * 100}%` }} className="w-full rounded-t bg-gradient-to-t from-brand-200 to-brand-500" />
                    <span className="text-[0.52rem] font-semibold text-ink-600/70">{trendDayLabel(row.day)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[0.82rem] font-extrabold text-ink-950">
                <Mail className="h-4 w-4 text-brand-600" /> Email delivery
              </h2>
              <Link href="/admin/outbox" className="text-[0.68rem] font-bold text-brand-700 hover:text-brand-500">
                Open
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-mist-50 px-3 py-2.5">
              <MailWarning className="h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-[0.72rem] font-semibold text-ink-700">
                {queuedEmailCount?.count ?? 0} queued · {outboxRows.filter((row) => row.status === "sent").length} recent sent
              </p>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {outboxRows.slice(0, 3).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 text-[0.7rem]">
                  <span className="truncate text-ink-700">{row.subject}</span>
                  <StatusPill status={row.status} />
                </li>
              ))}
              {outboxRows.length === 0 && <li className="text-[0.7rem] text-ink-600/75">No notifications yet.</li>}
            </ul>
          </section>

          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <h2 className="flex items-center gap-2 text-[0.82rem] font-extrabold text-ink-950">
              <Users className="h-4 w-4 text-brand-600" /> Recent contact messages
            </h2>
            <ul className="mt-2.5 space-y-2">
              {contactRows.map((message) => (
                <li key={message.id} className="rounded-xl bg-mist-50 px-3 py-2">
                  <p className="truncate text-[0.74rem] font-bold text-ink-900">{message.name}</p>
                  <p className="truncate text-[0.66rem] text-ink-600/80">{message.topic ?? "General"} · {formatDate(message.createdAt)}</p>
                </li>
              ))}
              {contactRows.length === 0 && <li className="text-[0.7rem] text-ink-600/75">No messages yet.</li>}
            </ul>
          </section>
        </div>
      </div>

      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[0.72rem] leading-relaxed text-amber-800">
        <strong>Email delivery:</strong> submissions are always saved in this console. To send an independent copy to {OWNER_EMAIL}, add a `RESEND_API_KEY` or SMTP credentials to the environment — the delivery layer picks them up automatically and retries queued messages.
      </p>
    </div>
  );

}
