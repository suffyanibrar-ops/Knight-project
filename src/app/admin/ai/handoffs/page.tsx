import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { listHandoffs } from "@/lib/ai-session";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiDate, AiPanel, adminButton, adminInput, adminLabel } from "@/components/admin/ai/ui";
import { updateHandoffAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI handoffs · Admin", robots: { index: false, follow: false } };

export default async function AdminAiHandoffsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const handoffs = listHandoffs(200);
  return (
    <div className="space-y-5">
      <AdminPageHeader title="Human handoffs" description="Visitors who asked for a person or needed help beyond the agent. The agent never claims a human is live." />
      {handoffs.length === 0 ? <p className="rounded-2xl border border-dashed border-mist-200 bg-mist-50 px-4 py-8 text-center text-[0.8rem] text-ink-600/70">No handoff requests.</p> : (
        <div className="space-y-3">
          {handoffs.map((handoff) => (
            <AiPanel key={handoff.id} title={`${handoff.name ?? handoff.email ?? "Anonymous visitor"}`} description={`Requested ${new Date(handoff.createdAt).toLocaleString("en-US")}`} actions={
              <div className="flex items-center gap-2">
                <AiBadge tone={handoff.status === "resolved" ? "good" : handoff.status === "in_progress" ? "brand" : "warn"}>{handoff.status.replace("_", " ")}</AiBadge>
                {handoff.conversationId ? <Link href={`/admin/ai/conversations/${handoff.conversationId}`} className="text-[0.7rem] font-bold text-brand-700 hover:text-brand-500">Transcript</Link> : null}
              </div>
            }>
              <p className="rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-[0.78rem] leading-relaxed text-ink-800">{handoff.reason}</p>
              <p className="mt-2 text-[0.7rem] text-ink-600">{handoff.email ?? "No email"}{handoff.phone ? ` · ${handoff.phone}` : ""} · Notified: {handoff.notifiedAt ? <AiDate value={handoff.notifiedAt} /> : "no"}</p>
              <form action={updateHandoffAction} className="mt-3 grid items-end gap-2 sm:grid-cols-[0.8fr_2fr_auto]">
                <input type="hidden" name="id" value={handoff.id} />
                <label className={adminLabel}>Status
                  <select name="status" defaultValue={handoff.status} className={adminInput}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label className={adminLabel}>Internal note
                  <input name="adminNote" defaultValue={handoff.adminNote ?? ""} maxLength={2000} placeholder="Optional notes…" className={adminInput} />
                </label>
                <button type="submit" className={adminButton}>Update</button>
              </form>
            </AiPanel>
          ))}
        </div>
      )}
    </div>
  );
}
