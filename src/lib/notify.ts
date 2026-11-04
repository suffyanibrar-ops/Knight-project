import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, isDatabaseConfigured } from "@/db";
import { contactMessages, leads, roiEstimates, subscribers } from "@/db/schema";
import { sendOwnerNotification, sendVisitorConfirmation, type MailPayload } from "./email";
import { setSubmissionEmailStatus } from "./sqlite";

type NotifyTarget = { type: "lead" | "contact" | "subscriber" | "roi"; id?: number; email?: string };

export type SubmissionEmails = {
  kind: "consultation" | "contact";
  /** SQLite submission id, used to record the owner-notification outcome. */
  submissionId?: number;
  /** Owner notification (sent to ADMIN_EMAIL, Reply-To set to the visitor). */
  owner: MailPayload;
  /** Visitor confirmation (sent to the address collected by the form). */
  visitor: MailPayload;
};

/**
 * Sends BOTH emails for one consultation/contact submission, after the HTTP
 * response has been flushed:
 *
 *   1. the owner notification to ADMIN_EMAIL with Reply-To: <visitor email>
 *   2. the visitor confirmation to the address the visitor typed
 *
 * The submission is already committed, so a mail failure never turns a saved
 * enquiry into an error for the visitor. The owner copy's outcome is written
 * back to the SQLite row, and a visitor-copy failure is logged for the operator.
 */
export function queueSubmissionEmails(input: SubmissionEmails) {
  const task = async () => {
    try {
      const ownerResult = await sendOwnerNotification(input.owner);
      if (input.submissionId !== undefined) {
        setSubmissionEmailStatus(input.submissionId, ownerResult.status === "sent" ? "sent" : "failed");
      }
      if (ownerResult.status !== "sent") {
        console.warn(`[notify] owner notification not delivered (${input.kind}): ${ownerResult.error ?? ownerResult.status}`);
      }

      const visitorResult = await sendVisitorConfirmation(input.visitor);
      if (visitorResult.status !== "sent") {
        console.warn(`[notify] visitor confirmation not delivered (${input.kind}): ${visitorResult.error ?? visitorResult.status}`);
      }
    } catch (error) {
      console.error("submission notification failed", error);
      if (input.submissionId !== undefined) setSubmissionEmailStatus(input.submissionId, "failed");
    }
  };

  try {
    after(task);
  } catch {
    // Some hosts do not expose the request scope needed by after().
    void task();
  }
}

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
