import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { defaultSessionResolver } from "@/lib/admin-actions";
import { loadChat } from "@/lib/admin-chat";
import { AdminPageHeader } from "@/components/admin/ui";
import { clearChatAction, confirmProposalAction, discardProposalAction, sendMessageAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Assistant · Admin", robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting your confirmation",
  completed: "Completed and verified",
  discarded: "Discarded — nothing changed",
  expired: "Expired — prepare again",
  already_used: "Already used",
  forbidden: "Not permitted for this administrator",
  interrupted: "Interrupted — nothing changed",
  failed: "Failed — see the message above",
};

/** Server-rendered admin assistant. Every control posts to a guarded server action. */
export default async function AdminAssistantPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const session = await defaultSessionResolver();
  if (!session.ok) redirect("/admin/login");
  const turns = loadChat(session.actor);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Assistant"
        description="Prepare an administrative change in plain language. Nothing executes until you confirm it, and every confirmed action is verified against the database and audited."
        actions={
          turns.length > 0 ? (
            <form action={clearChatAction}>
              <button type="submit" className="rounded-xl border border-mist-200 px-3.5 py-2 text-[0.72rem] font-bold text-ink-700 hover:border-brand-300">
                Clear conversation
              </button>
            </form>
          ) : null
        }
      />

      <div className="rounded-2xl border border-mist-200 bg-surface">
        <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4" aria-live="polite">
          {turns.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[0.86rem] font-extrabold text-ink-950">No messages yet</p>
              <p className="mx-auto mt-1 max-w-md text-[0.76rem] leading-relaxed text-ink-600">
                Try <code className="rounded bg-mist-100 px-1">help</code>, <code className="rounded bg-mist-100 px-1">show pending appointments</code>,
                {" "}<code className="rounded bg-mist-100 px-1">cancel appointment 12</code> or{" "}
                <code className="rounded bg-mist-100 px-1">set enquiry 5 to contacted</code>.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className={turn.role === "admin" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[46rem] rounded-2xl px-3.5 py-2.5 text-[0.8rem] leading-relaxed ${turn.role === "admin" ? "bg-night-soft text-white" : "border border-mist-200 bg-mist-50 text-ink-800"}`}>
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                  <p className={`mt-1 text-[0.58rem] ${turn.role === "admin" ? "text-white/60" : "text-ink-600/60"}`}>
                    {turn.role === "admin" ? "You" : "Assistant"} · {turn.at.slice(11, 16)} UTC
                  </p>

                  {turn.proposal ? (
                    <div className="mt-2.5 rounded-xl border border-brand-200 bg-surface p-3 text-ink-900">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.56rem] font-extrabold uppercase tracking-[0.08em] text-brand-700">
                          {turn.proposal.level === "C" ? "Restricted" : "Controlled"}
                        </span>
                        <span className="text-[0.66rem] font-bold text-ink-700">{turn.proposal.type}</span>
                        <span className="ml-auto text-[0.6rem] font-bold text-ink-600/70">
                          {turn.proposal.reversible ? "Reversible" : "Irreversible"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[0.78rem] font-extrabold text-ink-950">{turn.proposal.summary}</p>
                      <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
                        {Object.entries(turn.proposal.before).map(([key, value]) => (
                          <div key={key} className="rounded-lg bg-mist-50 px-2 py-1">
                            <dt className="text-[0.54rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/70">Current {key}</dt>
                            <dd className="text-[0.72rem] font-bold text-ink-900">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-1.5 text-[0.62rem] text-ink-600/70">
                        {STATUS_LABEL[turn.proposal.status] ?? turn.proposal.status} · expires {new Date(turn.proposal.expiresAt).toISOString().slice(11, 16)} UTC
                      </p>
                      {turn.proposal.status === "pending" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <form action={confirmProposalAction}>
                            <input type="hidden" name="nonce" value={turn.proposal.nonce} />
                            <input type="hidden" name="token" value={turn.proposal.token} />
                            <button type="submit" className="btn btn-primary px-3 py-1.5 text-[0.7rem]">
                              {turn.proposal.requiresApproval ? "Approve and apply" : "Confirm and apply"}
                            </button>
                          </form>
                          <form action={discardProposalAction}>
                            <input type="hidden" name="nonce" value={turn.proposal.nonce} />
                            <button type="submit" className="rounded-full border border-mist-200 px-3 py-1.5 text-[0.7rem] font-bold text-ink-700 hover:border-rose-300 hover:text-rose-700">
                              Discard
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <form action={sendMessageAction} className="flex flex-col gap-2 border-t border-mist-200 p-3 sm:flex-row">
          <label className="sr-only" htmlFor="assistant-message">Message</label>
          <input
            id="assistant-message"
            name="message"
            required
            maxLength={500}
            autoComplete="off"
            placeholder="e.g. show pending appointments"
            className="min-w-0 flex-1 rounded-xl border border-mist-200 px-3 py-2.5 text-[0.82rem] outline-none focus:border-brand-400"
          />
          <button type="submit" className="btn btn-primary px-4 py-2.5 text-[0.76rem]">Send</button>
        </form>
      </div>

      <p className="text-[0.7rem] leading-relaxed text-ink-600/70">
        The assistant can prepare two changes: cancelling an appointment (restricted, irreversible) and changing an enquiry status (controlled, reversible).
        It cannot run queries, SQL or shell commands, and it never confirms a change on your behalf.
      </p>
    </div>
  );
}
