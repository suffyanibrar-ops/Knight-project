import { Download, Mail, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages, leads } from "@/db/schema";
import { AdminPageHeader, EmptyState, StatCard, StatusPill, formatDate } from "@/components/admin/ui";
import { deleteSubmissionAction, updateStatusAction } from "../actions";

import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { PostgresNotice } from "@/components/admin/postgres-notice";

export const dynamic = "force-dynamic";

const statuses = ["new", "contacted", "quoted", "won", "closed"];

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; status?: string; id?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isDatabaseConfigured()) return <PostgresNotice />;
  const params = await searchParams;
  const type = params.type === "contact" ? "contact" : "consultation";
  const query = (params.q ?? "").trim().toLowerCase();
  const statusFilter = params.status ?? "all";
  const selectedId = Number(params.id);

  const [leadRows, contactRows] = await Promise.all([
    db.select().from(leads).orderBy(desc(leads.createdAt)),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)),
  ]);

  const filteredLeads = leadRows.filter((lead) => {
    const matchesQuery = !query || `${lead.name} ${lead.email} ${lead.practice ?? ""} ${lead.specialty ?? ""} ${lead.message ?? ""}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const filteredContacts = contactRows.filter((message) => {
    const matchesQuery = !query || `${message.name} ${message.email} ${message.topic ?? ""} ${message.message}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || message.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const selectedLead = type === "consultation" ? leadRows.find((row) => row.id === selectedId) : undefined;
  const selectedContact = type === "contact" ? contactRows.find((row) => row.id === selectedId) : undefined;
  const [queuedCount] = await db.select({ count: sql<number>`count(*)::int` }).from(leads).where(sql`${leads.emailStatus} <> 'sent'`);

  const base = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { type, q: params.q, status: statusFilter, ...overrides };
    Object.entries(merged).forEach(([key, value]) => {
      if (value && value !== "all" && !(key === "type" && value === "consultation")) next.set(key, value);
    });
    const qs = next.toString();
    return `/admin/submissions${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Form submissions"
        description="Every consultation request and contact message, newest first. Update the pipeline status, open full details, resend the owner notification or export to CSV."
        actions={
          <a href={`/api/admin/export?type=${type === "contact" ? "contacts" : "leads"}`} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300">
            <Download className="h-3.5 w-3.5" /> Export this list
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Consultation requests" value={leadRows.length} hint="All time" tone="brand" />
        <StatCard label="Contact messages" value={contactRows.length} hint="All time" />
        <StatCard label="Owner email queued" value={queuedCount?.count ?? 0} hint="Awaiting a delivery channel" tone={(queuedCount?.count ?? 0) > 0 ? "warn" : "good"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={base({ type: "consultation", id: undefined })} className={`rounded-full px-3.5 py-2 text-[0.74rem] font-bold ${type === "consultation" ? "bg-night-soft text-white" : "border border-mist-200 bg-surface text-ink-700 hover:border-brand-300"}`}>
          Consultations ({leadRows.length})
        </Link>
        <Link href={base({ type: "contact", id: undefined })} className={`rounded-full px-3.5 py-2 text-[0.74rem] font-bold ${type === "contact" ? "bg-night-soft text-white" : "border border-mist-200 bg-surface text-ink-700 hover:border-brand-300"}`}>
          Contact messages ({contactRows.length})
        </Link>
      </div>

      <form action="/admin/submissions" className="flex flex-col gap-2 rounded-2xl border border-mist-200 bg-surface p-3 sm:flex-row sm:items-center">
        <input type="hidden" name="type" value={type} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/40" />
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search name, email, facility, message…" className="w-full rounded-xl border border-mist-200 py-2.5 pl-9 pr-3 text-[0.8rem] outline-none focus:border-brand-400" />
        </div>
        <select name="status" defaultValue={statusFilter} className="rounded-xl border border-mist-200 px-3 py-2.5 text-[0.8rem] outline-none focus:border-brand-400">
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-night-soft px-4 py-2.5 text-[0.76rem] font-bold text-white hover:bg-brand-600">Apply</button>
      </form>

      {(selectedLead || selectedContact) && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[0.9rem] font-extrabold text-ink-950">
              {selectedLead ? `Consultation · ${selectedLead.name}` : `Message · ${selectedContact?.name}`}
            </h2>
            <Link href={base({ id: undefined })} className="text-[0.7rem] font-bold text-brand-700 hover:text-brand-500">Close</Link>
          </div>
          {selectedLead && (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["Email", selectedLead.email], ["Phone", selectedLead.phone ?? "—"], ["Facility", selectedLead.practice ?? "—"],
                ["Facility type", selectedLead.practiceSize ?? "—"], ["Specialty", selectedLead.specialty ?? "—"], ["Providers", selectedLead.monthlyCollections ?? "—"],
                ["Interests", (selectedLead.interests ?? []).join(", ") || "—"], ["Source", selectedLead.source],
                ["Owner email", `${selectedLead.emailStatus}${selectedLead.emailError ? ` · ${selectedLead.emailError}` : ""}`],
                ["Received", formatDate(selectedLead.createdAt)], ["Message", selectedLead.message ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface px-3 py-2">
                  <dt className="text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">{label}</dt>
                  <dd className="mt-0.5 break-words text-[0.78rem] font-semibold text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {selectedContact && (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["Email", selectedContact.email], ["Phone", selectedContact.phone ?? "—"], ["Topic", selectedContact.topic ?? "—"],
                ["Owner email", selectedContact.emailStatus], ["Received", formatDate(selectedContact.createdAt)], ["Message", selectedContact.message],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface px-3 py-2">
                  <dt className="text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">{label}</dt>
                  <dd className="mt-0.5 break-words text-[0.78rem] font-semibold text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`mailto:${selectedLead?.email ?? selectedContact?.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.7rem] font-bold text-white hover:bg-brand-600">
              <Mail className="h-3.5 w-3.5" /> Reply by email
            </a>
            <a href={selectedLead?.phone ? `tel:${selectedLead.phone}` : selectedContact?.phone ? `tel:${selectedContact.phone}` : "#"} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-800 hover:border-brand-300">
              Call
            </a>
          </div>
        </div>
      )}

      {type === "consultation" ? (
        filteredLeads.length === 0 ? (
          <EmptyState title="No consultation requests match" description="Try clearing the search or status filter. New submissions appear here immediately." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[54rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-mist-200 bg-mist-50/70">
                    {["Received", "Name", "Contact", "Facility", "Specialty", "Owner email", "Status", ""].map((heading) => (
                      <th key={heading} className="px-3 py-2.5 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-mist-100 last:border-0 hover:bg-brand-50/30">
                      <td className="whitespace-nowrap px-3 py-2.5 text-[0.7rem] text-ink-600/80">{formatDate(lead.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <Link href={base({ id: String(lead.id) })} className="text-[0.78rem] font-extrabold text-ink-950 hover:text-brand-700">{lead.name}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-[0.7rem] text-ink-700">
                        <span className="block max-w-[13rem] truncate">{lead.email}</span>
                        <span className="text-ink-600/80">{lead.phone ?? "—"}</span>
                      </td>
                      <td className="max-w-[11rem] truncate px-3 py-2.5 text-[0.7rem] text-ink-700">{lead.practice ?? "—"}<span className="block text-[0.62rem] text-ink-600/70">{lead.practiceSize ?? ""}</span></td>
                      <td className="px-3 py-2.5 text-[0.7rem] text-ink-700">{lead.specialty ?? "—"}</td>
                      <td className="px-3 py-2.5"><StatusPill status={lead.emailStatus} /></td>
                      <td className="px-3 py-2.5">
                        <form action={updateStatusAction} className="flex items-center gap-1">
                          <input type="hidden" name="type" value="lead" />
                          <input type="hidden" name="id" value={lead.id} />
                          <select name="status" defaultValue={lead.status} className="rounded-lg border border-mist-200 px-2 py-1 text-[0.66rem] font-semibold outline-none focus:border-brand-400">
                            {statuses.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          <button type="submit" className="rounded-lg bg-brand-50 px-2 py-1 text-[0.62rem] font-bold text-brand-700 hover:bg-brand-500 hover:text-white">Save</button>
                        </form>
                      </td>
                      <td className="px-3 py-2.5">
                        <form action={deleteSubmissionAction}>
                          <input type="hidden" name="type" value="lead" />
                          <input type="hidden" name="id" value={lead.id} />
                          <button type="submit" aria-label={`Delete submission from ${lead.name}`} className="grid h-7 w-7 place-items-center rounded-full text-ink-600/40 hover:bg-rose-50 hover:text-rose-600">
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
        )
      ) : filteredContacts.length === 0 ? (
        <EmptyState title="No contact messages match" description="Try clearing the search or status filter." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredContacts.map((message) => (
            <article key={message.id} className="rounded-2xl border border-mist-200 bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={base({ id: String(message.id) })} className="block truncate text-[0.84rem] font-extrabold text-ink-950 hover:text-brand-700">{message.name}</Link>
                  <p className="truncate text-[0.7rem] text-ink-600/80">{message.email}</p>
                </div>
                <StatusPill status={message.status} />
              </div>
              <p className="mt-2 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-brand-700">{message.topic ?? "General"}</p>
              <p className="mt-1.5 line-clamp-3 text-[0.76rem] leading-relaxed text-ink-600/80">{message.message}</p>
              <div className="mt-3 flex items-center justify-between border-t border-mist-100 pt-2.5">
                <span className="text-[0.62rem] text-ink-600/70">{formatDate(message.createdAt)} · email {message.emailStatus}</span>
                <div className="flex items-center gap-1.5">
                  <form action={updateStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="type" value="contact" />
                    <input type="hidden" name="id" value={message.id} />
                    <select name="status" defaultValue={message.status} className="rounded-lg border border-mist-200 px-1.5 py-1 text-[0.62rem] font-semibold outline-none focus:border-brand-400">
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg bg-brand-50 px-2 py-1 text-[0.6rem] font-bold text-brand-700 hover:bg-brand-500 hover:text-white">Save</button>
                  </form>
                  <form action={deleteSubmissionAction}>
                    <input type="hidden" name="type" value="contact" />
                    <input type="hidden" name="id" value={message.id} />
                    <button type="submit" aria-label="Delete message" className="grid h-7 w-7 place-items-center rounded-full text-ink-600/40 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
