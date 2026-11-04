import { Download, MailCheck, RefreshCw, Send, TestTube2 } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { AdminPageHeader, EmptyState, StatCard, StatusPill, formatDate } from "@/components/admin/ui";
import { emailChannelStatus, OWNER_EMAIL } from "@/lib/email";
import { retryAllQueuedAction, retryEmailAction, sendTestEmailAction } from "../actions";

import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { PostgresNotice } from "@/components/admin/postgres-notice";

export const dynamic = "force-dynamic";

export default async function OutboxPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isDatabaseConfigured()) return <PostgresNotice />;
  const rows = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(100);
  const sent = rows.filter((row) => row.status === "sent").length;
  const queued = rows.filter((row) => row.status !== "sent").length;
  const channels = emailChannelStatus();
  const configured = Number(channels.resend) + Number(channels.smtp) + Number(channels.relay);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Email delivery"
        description={`Every submission generates an owner notification addressed to ${OWNER_EMAIL}. Sent messages are confirmed by the provider; queued messages can be retried here once a delivery channel is configured.`}
        actions={
          <>
            <form action={sendTestEmailAction}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white hover:bg-brand-600">
                <TestTube2 className="h-3.5 w-3.5" /> Send test email
              </button>
            </form>
            <form action={retryAllQueuedAction}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300">
                <RefreshCw className="h-3.5 w-3.5" /> Retry queued
              </button>
            </form>
            <a href="/api/admin/export?type=outbox" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300">
              <Download className="h-3.5 w-3.5" /> Export outbox
            </a>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Delivered" value={sent} hint="Confirmed by provider" tone="good" />
        <StatCard label="Queued" value={queued} hint="Waiting for a channel" tone={queued ? "warn" : "default"} />
        <StatCard label="Active channels" value={configured} hint={`Resend ${channels.resend ? "on" : "off"} · SMTP ${channels.smtp ? "on" : "off"} · relay ${channels.relay ? "on" : "off"}`} tone={configured ? "good" : "warn"} />
      </div>

      <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
        <p className="flex items-center gap-2 text-[0.76rem] font-extrabold text-brand-900">
          <Send className="h-4 w-4" /> How delivery works
        </p>
        <ol className="mt-2 grid gap-1.5 text-[0.74rem] leading-relaxed text-ink-700/80">
          <li>1. A visitor submits a form — the entry is stored in the database immediately.</li>
          <li>2. The notification is written to this outbox, then sent to {OWNER_EMAIL} through the first available channel.</li>
          <li>3. If no channel is configured, the message stays queued (never lost) and can be resent in one click.</li>
        </ol>
        <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-600/70">
          <strong>To activate email delivery:</strong> add <code className="rounded bg-surface px-1 py-0.5">RESEND_API_KEY</code> (plus a verified <code className="rounded bg-surface px-1 py-0.5">MAIL_FROM</code> domain) or SMTP credentials
          <code className="ml-1 rounded bg-surface px-1 py-0.5">SMTP_HOST</code> / <code className="rounded bg-surface px-1 py-0.5">SMTP_USER</code> / <code className="rounded bg-surface px-1 py-0.5">SMTP_PASS</code> to the environment, then press <strong>Send test email</strong>.
          Every queued message can then be delivered with <strong>Retry queued</strong> — no submissions are lost in the meantime.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Outbox is empty" description="Owner notifications will appear here as soon as a visitor submits a form." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-mist-200 bg-mist-50/70">
                  {["Created", "Type", "Subject", "Recipient", "Status", "Provider", "Action"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-mist-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[0.68rem] text-ink-600/80">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-2.5 text-[0.68rem] font-semibold capitalize text-ink-700">{row.kind}</td>
                    <td className="max-w-[20rem] px-3 py-2.5">
                      <p className="truncate text-[0.74rem] font-bold text-ink-900">{row.subject}</p>
                      {row.lastError && <p className="mt-0.5 line-clamp-1 text-[0.62rem] text-amber-700">{row.lastError}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-[0.68rem] text-ink-700">{row.toEmail}</td>
                    <td className="px-3 py-2.5"><StatusPill status={row.status} /></td>
                    <td className="px-3 py-2.5 text-[0.68rem] text-ink-700">{row.provider ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {row.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 text-[0.66rem] font-bold text-mint-700"><MailCheck className="h-3.5 w-3.5" /> Sent</span>
                      ) : (
                        <form action={retryEmailAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[0.64rem] font-bold text-brand-700 hover:bg-brand-500 hover:text-white">
                            <RefreshCw className="h-3 w-3" /> Retry
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
