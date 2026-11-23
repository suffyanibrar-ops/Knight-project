"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { defaultSessionResolver } from "@/lib/admin-actions";
import { cancel, confirm, propose } from "@/lib/admin-assistant";
import { appendTurns, clearChat, settleProposal } from "@/lib/admin-chat";

/** Every action re-resolves the session; identity never comes from the form. */
async function requireActor(): Promise<string> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const session = await defaultSessionResolver();
  if (!session.ok) redirect("/admin/login");
  return session.actor;
}

export async function sendMessageAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const message = String(formData.get("message") ?? "").trim().slice(0, 500);
  if (!message) return;
  appendTurns(actor, { role: "admin", text: message });
  const turn = await propose(message);
  appendTurns(actor, { role: "assistant", text: turn.reply, ...(turn.proposal ? { proposal: { ...turn.proposal, status: "pending" as const } } : {}) });
  revalidatePath("/admin/assistant");
}

export async function confirmProposalAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const nonce = String(formData.get("nonce") ?? "");
  const token = String(formData.get("token") ?? "");
  if (!nonce || !token) return;
  const result = await confirm({ nonce, token });
  settleProposal(actor, nonce, result.status);
  appendTurns(actor, { role: "assistant", text: result.message });
  revalidatePath("/admin/assistant");
}

export async function discardProposalAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const nonce = String(formData.get("nonce") ?? "");
  if (!nonce) return;
  const result = await cancel(nonce);
  settleProposal(actor, nonce, "discarded");
  appendTurns(actor, { role: "assistant", text: result.message });
  revalidatePath("/admin/assistant");
}

export async function clearChatAction(): Promise<void> {
  const actor = await requireActor();
  clearChat(actor);
  revalidatePath("/admin/assistant");
}
