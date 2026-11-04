import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, isDatabaseConfigured } from "@/db";
import { contactMessages, leads, roiEstimates, subscribers } from "@/db/schema";
import { sendOwnerNotification, type MailPayload } from "./email";

type NotifyTarget = { type: "lead" | "contact" | "subscriber" | "roi"; id?: number; email?: string };

/**
 * Queues the owner notification to run after the HTTP response is flushed, so
 * visitors never wait on an email provider. The submission itself is already
 * committed to the database before this runs.
 */
export function queueOwnerNotification(payload: MailPayload, target: NotifyTarget) {
  const task = async () => {
    try {
      const result = await sendOwnerNotification(payload);
      const status = result.status === "sent" ? "sent" : "queued";
      const sentAt = result.status === "sent" ? new Date() : null;
      if (!isDatabaseConfigured()) return;

      if (target.type === "lead" && target.id) {
        await db.update(leads).set({ emailStatus: status, emailSentAt: sentAt, emailError: result.error ?? null }).where(eq(leads.id, target.id));
      }
      if (target.type === "contact" && target.id) {
        await db.update(contactMessages).set({ emailStatus: status, emailSentAt: sentAt, emailError: result.error ?? null }).where(eq(contactMessages.id, target.id));
      }
      if (target.type === "roi" && target.id && result.status === "sent") {
        await db.update(roiEstimates).set({ emailStatus: "sent" }).where(eq(roiEstimates.id, target.id));
      }
      if (target.type === "subscriber" && target.email && result.status === "sent") {
        await db.update(subscribers).set({ emailStatus: "sent" }).where(eq(subscribers.email, target.email));
      }
    } catch (error) {
      console.error("owner notification failed", error);
    }
  };

  try {
    after(task);
  } catch {
    // Some hosts do not expose the request scope needed by after().
    void task();
  }
}
