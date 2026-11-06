import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bot } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAiStats, listConversations, listHandoffs } from "@/lib/ai-session";
import { listAppointments } from "@/lib/ai-appointments";
import { getAiSettings } from "@/lib/ai-config";
import { knowledgeStatus } from "@/lib/ai-knowledge";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiDate, AiPanel, AiStat, adminButton, adminButtonLight } from "@/components/admin/ai/ui";
import { toggleAgentAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI agent · Admin", robots: { index: false, follow: false } };

export default async function AdminAiOverviewPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const stats = getAiStats();
  const settings = getAiSettings();
  const knowledge = knowledgeStatus();
  const conversations = listConversations(8);
  const appointments = listAppointments(6).filter((appointment) => appointment.status !== "cancelled");
  const handoffs = listHandoffs(6).filter((handoff) => handoff.status !== "resolved");
  const deepseekConfigured = Boolean(process.env.DEEPSEEK_API_KEY);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="AI & Conversations"
        description="Conversations, qualified leads, appointments and human handoffs handled by the website assistant."
        actions={
          <form action={toggleAgentAction}>
            <input type="hidden" name="enabled" value={String(!settings.enabled)} />
            <button type="submit" className={settings.enabled ? adminButtonLight : adminButton}>
              <Bot className="h-3.5 w-3.5" /> {settings.enabled ? "Disable agent" : "Enable agent"}
            </button>
          </form>
        }
      />

      {!deepseekConfigured && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[0.78rem] font-semibold text-amber-900">
          DEEPSEEK_API_KEY is not configured on this server, so the agent cannot reply. Add it to the server environment and restart.
        </p>
      )}
      {!settings.enabled && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.78rem] font-semibold text-rose-800">
          The agent is currently disabled for website visitors.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AiStat label="Conversations" value={stats.conversations} hint={`${stats.todayConversations} started today`} tone="brand" />
        <AiStat label="Qualified leads" value={stats.leads} hint="Collected by the agent" />
        <AiStat label="Appointments" value={stats.appointments} hint="Upcoming or confirmed" />
        <AiStat label="Pending handoffs" value={stats.pendingHandoffs} hint="Awaiting a human" tone={stats.pendingHandoffs > 0 ? "warn" : "good"} />
        <AiStat label="Voice conversations" value={stats.voiceConversations} hint="Mic-based sessions" />
        <AiStat label="Tokens used" value={stats.totalTokens.toLocaleString("en-US")} hint="All DeepSeek calls" />
        <AiStat label="Estimated API cost" value={`$${(stats.costMicros / 1_000_000).toFixed(2)}`} hint="DeepSeek list price estimate" />
        <AiStat label="API errors" value={stats.errors} hint="Logged failures" tone={stats.errors > 0 ? "warn" : "good"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <AiPanel title="Recent conversations" description="Every text or voice session the agent handled." actions={<Link href="/admin/ai/conversations" className={adminButtonLight}>View all <ArrowRight className="h-3 w-3" /></Link>}>
          {conversations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-mist-200 bg-mist-50 px-4 py-6 text-center text-[0.78rem] text-ink-600/70">No conversations yet.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-left text-[0.76rem]">
              <thead><tr className="border-b border-mist-200 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60"><th className="pb-2 pr-3">Started</th><th className="pb-2 pr-3">Channel</th><th className="pb-2 pr-3">Messages</th><th className="pb-2 pr-3">Visitor</th><th className="pb-2">Links</th></tr></thead>
              <tbody>{conversations.map((conversation) => (
                <tr key={conversation.id} className="border-b border-mist-100 last:border-0">
                  <td className="py-2 pr-3"><AiDate value={conversation.createdAt} /></td>
                  <td className="py-2 pr-3"><AiBadge tone={conversation.channel === "voice" ? "brand" : "default"}>{conversation.channel}</AiBadge></td>
                  <td className="py-2 pr-3">{conversation.messageCount}</td>
                  <td className="py-2 pr-3">{conversation.visitorName ?? conversation.visitorEmail ?? "Anonymous"}</td>
                  <td className="py-2"><Link href={`/admin/ai/conversations/${conversation.id}`} className="font-bold text-brand-700 hover:text-brand-500">Transcript</Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </AiPanel>

        <div className="space-y-4">
          <AiPanel title="Upcoming appointments" description="Booked through the agent or the calendar." actions={<Link href="/admin/ai/appointments" className={adminButtonLight}>Manage</Link>}>
            {appointments.length === 0 ? <p className="text-[0.76rem] text-ink-600/70">No appointments yet.</p> : (
              <ul className="space-y-2">{appointments.map((appointment) => (
                <li key={appointment.id} className="rounded-xl border border-mist-200 px-3 py-2">
                  <p className="text-[0.78rem] font-extrabold text-ink-950">{appointment.dateLabel} · {appointment.timeLabel}</p>
                  <p className="text-[0.7rem] text-ink-600">{appointment.name} · {appointment.email}</p>
                  <AiBadge tone={appointment.status === "confirmed" ? "good" : appointment.status === "cancelled" ? "bad" : "warn"}>{appointment.status}</AiBadge>
                </li>
              ))}</ul>
            )}
          </AiPanel>
          <AiPanel title="Human handoff queue" description="Visitors waiting for a person." actions={<Link href="/admin/ai/handoffs" className={adminButtonLight}>Open queue</Link>}>
            {handoffs.length === 0 ? <p className="text-[0.76rem] text-ink-600/70">Nothing pending.</p> : (
              <ul className="space-y-2">{handoffs.map((handoff) => (
                <li key={handoff.id} className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <p className="text-[0.76rem] font-bold text-ink-900">{handoff.name ?? handoff.email ?? "Anonymous visitor"}</p>
                  <p className="line-clamp-2 text-[0.7rem] text-ink-600">{handoff.reason}</p>
                </li>
              ))}</ul>
            )}
          </AiPanel>
          <AiPanel title="Knowledge base" description="Retrieval index used for every answer." actions={<Link href="/admin/ai/knowledge" className={adminButtonLight}>Manage</Link>}>
            <dl className="grid grid-cols-2 gap-2 text-[0.74rem]">
              <div><dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-600/60">Sources</dt><dd className="font-extrabold text-ink-950">{knowledge.sources}</dd></div>
              <div><dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-600/60">Chunks</dt><dd className="font-extrabold text-ink-950">{knowledge.chunks}</dd></div>
              <div className="col-span-2"><dt className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-600/60">Last indexed</dt><dd className="text-ink-800"><AiDate value={knowledge.lastIndexedAt} /></dd></div>
            </dl>
          </AiPanel>
        </div>
      </div>
    </div>
  );
}
