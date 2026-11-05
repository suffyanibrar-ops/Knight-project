import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getConversationDetail } from "@/lib/ai-session";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiDate, AiPanel } from "@/components/admin/ai/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI transcript · Admin", robots: { index: false, follow: false } };

export default async function AdminAiConversationPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const detail = getConversationDetail(id);
  if (!detail) notFound();
  const { conversation, messages } = detail;
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={`Conversation #${conversation.id}`}
        description={`${conversation.channel === "voice" ? "Voice" : "Text"} session · ${messages.length} messages · started ${new Date(conversation.createdAt).toLocaleString("en-US")}`}
        actions={<Link href="/admin/ai/conversations" className="text-[0.72rem] font-bold text-brand-700 hover:text-brand-500">← All conversations</Link>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.6rem] font-extrabold uppercase tracking-wide text-ink-600/60">Visitor</p><p className="mt-1 text-[0.84rem] font-bold text-ink-950">{conversation.visitorName ?? "Anonymous"}</p><p className="text-[0.7rem] text-ink-600">{conversation.visitorEmail ?? "No email captured"}</p></div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.6rem] font-extrabold uppercase tracking-wide text-ink-600/60">Last activity</p><p className="mt-1 text-[0.84rem] font-bold text-ink-950"><AiDate value={conversation.lastActivityAt} /></p></div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.6rem] font-extrabold uppercase tracking-wide text-ink-600/60">Linked records</p><div className="mt-1.5 flex flex-wrap gap-1.5">
          {conversation.leadId ? <Link href="/admin/ai/leads"><AiBadge tone="good">lead #{conversation.leadId}</AiBadge></Link> : null}
          {conversation.appointmentId ? <Link href="/admin/ai/appointments"><AiBadge tone="brand">appointment #{conversation.appointmentId}</AiBadge></Link> : null}
          {conversation.handoffId ? <Link href="/admin/ai/handoffs"><AiBadge tone="warn">handoff #{conversation.handoffId}</AiBadge></Link> : null}
          {!conversation.leadId && !conversation.appointmentId && !conversation.handoffId && <span className="text-[0.72rem] text-ink-600/60">None</span>}
        </div></div>
      </div>
      <AiPanel title="Transcript" description="Visitor and assistant messages only. Audio is never recorded.">
        {messages.length === 0 ? <p className="text-[0.78rem] text-ink-600/70">No messages recorded.</p> : (
          <ol className="space-y-2.5">{messages.map((message, index) => (
            <li key={index} className={message.role === "assistant" ? "flex justify-start" : "flex justify-end"}>
              <div className={message.role === "assistant" ? "max-w-[80%] rounded-2xl rounded-bl-md border border-mist-200 bg-mist-50 px-3.5 py-2.5 text-[0.78rem] text-ink-800" : "max-w-[80%] rounded-2xl rounded-br-md bg-brand-500 px-3.5 py-2.5 text-[0.78rem] text-white"}>
                <p className="mb-1 text-[0.56rem] font-extrabold uppercase tracking-[0.1em] opacity-60">{message.role === "assistant" ? "Assistant" : "Visitor"} · {new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                <p className="whitespace-pre-line">{message.content}</p>
              </div>
            </li>
          ))}</ol>
        )}
      </AiPanel>
      <p className="rounded-xl border border-mist-200 bg-mist-50 px-3.5 py-2.5 text-[0.68rem] leading-relaxed text-ink-600/70">
        Privacy: transcripts can contain visitor contact details. Do not add patient information here; the agent is instructed to refuse PHI.
      </p>
    </div>
  );
}
