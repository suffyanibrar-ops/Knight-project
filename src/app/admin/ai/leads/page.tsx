import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { listLeads } from "@/lib/ai-session";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiDate, AiPanel } from "@/components/admin/ai/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI leads · Admin", robots: { index: false, follow: false } };

export default async function AdminAiLeadsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const leads = listLeads(300);
  return (
    <div className="space-y-5">
      <AdminPageHeader title="AI-qualified leads" description="Contact and qualification details visitors shared with the agent. No patient information is collected." />
      <AiPanel title={`${leads.length} lead${leads.length === 1 ? "" : "s"}`}>
        {leads.length === 0 ? <p className="rounded-xl border border-dashed border-mist-200 bg-mist-50 px-4 py-8 text-center text-[0.78rem] text-ink-600/70">No leads captured yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-[0.74rem]">
            <thead><tr className="border-b border-mist-200 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">
              <th className="pb-2 pr-3">Created</th><th className="pb-2 pr-3">Name</th><th className="pb-2 pr-3">Email</th><th className="pb-2 pr-3">Phone</th><th className="pb-2 pr-3">Organization</th><th className="pb-2 pr-3">Specialty</th><th className="pb-2 pr-3">Challenge</th><th className="pb-2 pr-3">Interest</th><th className="pb-2">Status</th>
            </tr></thead>
            <tbody>{leads.map((lead) => (
              <tr key={lead.id} className="border-b border-mist-100 last:border-0 align-top">
                <td className="py-2 pr-3 whitespace-nowrap"><AiDate value={lead.createdAt} /></td>
                <td className="py-2 pr-3 font-bold text-ink-900">{lead.name ?? "—"}</td>
                <td className="py-2 pr-3">{lead.email ?? "—"}</td>
                <td className="py-2 pr-3">{lead.phone ?? "—"}</td>
                <td className="py-2 pr-3">{lead.organization ?? "—"}</td>
                <td className="py-2 pr-3">{lead.specialty ?? "—"}</td>
                <td className="py-2 pr-3 max-w-[16rem]">{lead.challenge ?? "—"}</td>
                <td className="py-2 pr-3">{lead.servicesInterest ?? "—"}</td>
                <td className="py-2"><AiBadge tone={lead.status === "new" ? "warn" : "good"}>{lead.status}</AiBadge></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </AiPanel>
    </div>
  );
}
