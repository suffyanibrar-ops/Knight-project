import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { listConversations } from "@/lib/ai-session";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiDate, AiPanel } from "@/components/admin/ai/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI conversations · Admin", robots: { index: false, follow: false } };

export default async function AdminAiConversationsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const conversations = listConversations(200);
  return (
    <div className="space-y-5">
      <AdminPageHeader title="Conversations" description="Every AI text and voice session, with transcript access. Transcripts are retained per your retention setting; no audio is stored." />
      <AiPanel title={`${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`} description="Newest activity first.">
        {conversations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-mist-200 bg-mist-50 px-4 py-8 text-center text-[0.78rem] text-ink-600/70">No conversations yet. Open the website chat to start one.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-left text-[0.76rem]">
            <thead><tr className="border-b border-mist-200 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">
              <th className="pb-2 pr-3">Started</th><th className="pb-2 pr-3">Channel</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Messages</th><th className="pb-2 pr-3">Visitor</th><th className="pb-2 pr-3">Qualified</th><th className="pb-2 pr-3">Appointment</th><th className="pb-2 pr-3">Handoff</th><th className="pb-2">Transcript</th>
            </tr></thead>
            <tbody>{conversations.map((conversation) => (
              <tr key={conversation.id} className="border-b border-mist-100 last:border-0">
                <td className="py-2 pr-3"><AiDate value={conversation.createdAt} /></td>
                <td className="py-2 pr-3"><AiBadge tone={conversation.channel === "voice" ? "brand" : "default"}>{conversation.channel}</AiBadge></td>
                <td className="py-2 pr-3"><AiBadge tone={conversation.status === "active" ? "good" : "default"}>{conversation.status}</AiBadge></td>
                <td className="py-2 pr-3">{conversation.messageCount}</td>
                <td className="py-2 pr-3">{conversation.visitorName ?? conversation.visitorEmail ?? "Anonymous"}</td>
                <td className="py-2 pr-3">{conversation.leadId ? <AiBadge tone="good">lead</AiBadge> : "—"}</td>
                <td className="py-2 pr-3">{conversation.appointmentId ? <AiBadge tone="brand">booked</AiBadge> : "—"}</td>
                <td className="py-2 pr-3">{conversation.handoffId ? <AiBadge tone="warn">human</AiBadge> : "—"}</td>
                <td className="py-2"><Link href={`/admin/ai/conversations/${conversation.id}`} className="font-bold text-brand-700 hover:text-brand-500">Open</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </AiPanel>
    </div>
  );
}
