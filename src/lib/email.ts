import "server-only";
import { db, isDatabaseConfigured } from "@/db";
import { emailOutbox } from "@/db/schema";
import { eq } from "drizzle-orm";

export const OWNER_EMAIL = process.env.ADMIN_EMAIL ?? "admin@knightmedicalbilling.com";
const MAIL_FROM = process.env.MAIL_FROM ?? "Knight Medical Billing <notifications@knightmedicalbilling.com>";
const ADMIN_APP_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.knightmedicalbilling.com") + "/admin";

export type MailKind = "consultation" | "contact" | "subscriber" | "roi" | "test";

export type MailPayload = {
  kind: MailKind;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  relatedType?: string;
  relatedId?: number;
  to?: string;
};

type DeliveryResult = { status: "sent" | "failed" | "queued"; provider?: string; error?: string };

/** Strips CR/LF and control characters so user input cannot inject mail headers. */
function cleanHeader(value: string | undefined | null) {
  if (!value) return undefined;
  return value.replace(/[\r\n\t\u0000-\u001f]+/g, " ").slice(0, 240);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shell(title: string, rows: { label: string; value: string }[], footer = "Knight Medical Billing · 585 Grove St Ste 145, Herndon, VA 20170-4790") {
  const body = rows
    .filter((row) => row.value && row.value.trim().length > 0)
    .map(
      (row) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #e1ebf1;font:600 12px/1.4 Helvetica,Arial,sans-serif;color:#5b7686;text-transform:uppercase;letter-spacing:.06em;width:34%;vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e1ebf1;font:15px/1.55 Helvetica,Arial,sans-serif;color:#071f2f">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f5fafc;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e1ebf1;border-radius:16px;overflow:hidden">
    <tr><td style="background:#071f2f;padding:20px 24px"><div style="font:800 18px/1 Helvetica,Arial,sans-serif;color:#fff">Knight Medical Billing</div><div style="margin-top:6px;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#7cd7f2">New website submission</div></td></tr>
    <tr><td style="padding:22px 24px 6px"><h1 style="margin:0;font:800 21px/1.3 Helvetica,Arial,sans-serif;color:#071f2f">${escapeHtml(title)}</h1></td></tr>
    <tr><td style="padding:10px 24px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #e1ebf1">${body}</table></td></tr>
    <tr><td style="padding:0 24px 24px"><a href="${ADMIN_APP_URL}" style="display:inline-block;background:#0e83ab;color:#fff;font:700 13px/1 Helvetica,Arial,sans-serif;padding:12px 18px;border-radius:999px;text-decoration:none">Open admin panel</a></td></tr>
    <tr><td style="background:#f7fafc;padding:14px 24px;font:12px/1.5 Helvetica,Arial,sans-serif;color:#5b7686">${escapeHtml(footer)}</td></tr>
  </table></body></html>`;
}

export function buildConsultationEmail(lead: {
  name: string; email: string; phone?: string | null; practice?: string | null; specialty?: string | null;
  practiceSize?: string | null; monthlyCollections?: string | null; interests?: string[] | null; message?: string | null; source?: string;
}) {
  const rows = [
    { label: "Name", value: lead.name },
    { label: "Email", value: lead.email },
    { label: "Phone", value: lead.phone ?? "" },
    { label: "Facility", value: lead.practice ?? "" },
    { label: "Facility type", value: lead.practiceSize ?? "" },
    { label: "Specialty", value: lead.specialty ?? "" },
    { label: "Providers", value: lead.monthlyCollections ?? "" },
    { label: "Interested in", value: (lead.interests ?? []).join(", ") },
    { label: "Message", value: lead.message ?? "" },
    { label: "Source", value: lead.source ?? "website" },
  ];
  return {
    subject: `New consultation request — ${lead.name}${lead.practice ? ` (${lead.practice})` : ""}`,
    text: `New consultation request\n\n${rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`).join("\n")}\n\nReply directly to this email to reach ${lead.name} at ${lead.email}.`,
    html: shell("New consultation request", rows),
  };
}

export function buildContactEmail(message: { name: string; email: string; phone?: string | null; topic?: string | null; message: string }) {
  const rows = [
    { label: "Name", value: message.name },
    { label: "Email", value: message.email },
    { label: "Phone", value: message.phone ?? "" },
    { label: "Topic", value: message.topic ?? "" },
    { label: "Message", value: message.message },
  ];
  return {
    subject: `New contact message — ${message.name}${message.topic ? ` · ${message.topic}` : ""}`,
    text: `New contact message\n\n${rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`).join("\n")}`,
    html: shell("New contact message", rows),
  };
}

export function buildSubscriberEmail(email: string) {
  const rows = [{ label: "Email", value: email }, { label: "Source", value: "Website newsletter form" }];
  return {
    subject: `New newsletter subscriber — ${email}`,
    text: `New newsletter subscriber: ${email}`,
    html: shell("New newsletter subscriber", rows),
  };
}

export function buildRoiEmail(estimate: { monthlyCollections: number; denialRate: number; daysInAr: number; estimatedAnnualUplift: number; email?: string | null }) {
  const rows = [
    { label: "Email", value: estimate.email ?? "Not provided" },
    { label: "Monthly collections", value: `$${estimate.monthlyCollections.toLocaleString("en-US")}` },
    { label: "Denial rate", value: `${estimate.denialRate}%` },
    { label: "Days in A/R", value: `${estimate.daysInAr}` },
    { label: "Estimated annual opportunity", value: `$${estimate.estimatedAnnualUplift.toLocaleString("en-US")}` },
  ];
  return {
    subject: `New ROI estimate — $${estimate.estimatedAnnualUplift.toLocaleString("en-US")} annual opportunity`,
    text: `New ROI estimate\n\n${rows.map((r) => `${r.label}: ${r.value}`).join("\n")}`,
    html: shell("New ROI estimate", rows),
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Delivery timed out")), ms))]);
}

async function viaResend(payload: MailPayload): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "failed", error: "RESEND_API_KEY not configured" };
  const response = await withTimeout(
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [payload.to ?? OWNER_EMAIL], reply_to: cleanHeader(payload.replyTo), subject: cleanHeader(payload.subject), text: payload.text, html: payload.html }),
    }),
    9000,
  );
  if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return { status: "sent", provider: "resend" };
}

async function viaSmtp(payload: MailPayload): Promise<DeliveryResult> {
  if (!process.env.SMTP_HOST) return { status: "failed", error: "SMTP not configured" };
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await withTimeout(
    transport.sendMail({ from: MAIL_FROM, to: payload.to ?? OWNER_EMAIL, replyTo: cleanHeader(payload.replyTo), subject: cleanHeader(payload.subject) ?? "Website notification", text: payload.text, html: payload.html }),
    12000,
  );
  return { status: "sent", provider: "smtp" };
}

async function viaFormSubmit(payload: MailPayload): Promise<DeliveryResult> {
  if (process.env.DISABLE_FORM_SUBMIT === "1") return { status: "failed", error: "FormSubmit disabled" };
  const response = await withTimeout(
    fetch(`https://formsubmit.co/ajax/${encodeURIComponent(payload.to ?? OWNER_EMAIL)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: cleanHeader(payload.subject),
        _template: "table",
        _captcha: "false",
        name: payload.subject,
        message: payload.text,
        replyto: cleanHeader(payload.replyTo) ?? OWNER_EMAIL,
      }),
    }),
    5000,
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`FormSubmit ${response.status}: ${body.slice(0, 160)}`);
  return { status: "sent", provider: "formsubmit" };
}

/**
 * Persists every notification in the outbox, then attempts delivery through the
 * first configured provider. Failures never block the visitor's submission —
 * the message stays queued and can be resent from the admin panel.
 */
export function configuredProviders() {
  const list: ((payload: MailPayload) => Promise<DeliveryResult>)[] = [];
  if (process.env.RESEND_API_KEY) list.push(viaResend);
  if (process.env.SMTP_HOST) list.push(viaSmtp);
  if (process.env.ENABLE_FORM_SUBMIT_RELAY === "1") list.push(viaFormSubmit);
  return list;
}

export function emailChannelStatus() {
  return {
    resend: Boolean(process.env.RESEND_API_KEY),
    smtp: Boolean(process.env.SMTP_HOST),
    relay: process.env.ENABLE_FORM_SUBMIT_RELAY === "1",
    /** Human-readable setup guidance when nothing is configured. */
    setupHint:
      process.env.RESEND_API_KEY || process.env.SMTP_HOST
        ? null
        : "No server-side email channel is configured. Add RESEND_API_KEY (+ MAIL_FROM) or SMTP_HOST/SMTP_USER/SMTP_PASS to deliver owner notifications. Submissions are still saved.",
  };
}

export async function sendOwnerNotification(payload: MailPayload): Promise<DeliveryResult & { outboxId?: number }> {
  let outboxId: number | undefined;
  const persist = isDatabaseConfigured();
  if (persist) try {
    const [row] = await db
      .insert(emailOutbox)
      .values({
        kind: payload.kind,
        toEmail: payload.to ?? OWNER_EMAIL,
        replyTo: cleanHeader(payload.replyTo) ?? null,
        subject: cleanHeader(payload.subject) ?? "Website notification",
        textBody: payload.text,
        htmlBody: payload.html,
        status: "pending",
        relatedType: payload.relatedType ?? null,
        relatedId: payload.relatedId ?? null,
      })
      .returning({ id: emailOutbox.id });
    outboxId = row?.id;
  } catch (error) {
    console.error("outbox insert failed", error);
  }

  // Only attempt network delivery when a channel is actually configured.
  // This keeps form submissions instant instead of waiting on a timeout.
  const providers = configuredProviders();
  if (providers.length === 0) {
    const notice =
      "[email] SETUP REQUIRED — no server-side email channel is configured. " +
      "Set RESEND_API_KEY (+ MAIL_FROM) or SMTP_HOST/SMTP_USER/SMTP_PASS. " +
      "This notification is queued in the admin outbox and was NOT delivered.";
    if (outboxId) {
      await db.update(emailOutbox).set({ status: "queued", attempts: 0, lastError: notice }).where(eq(emailOutbox.id, outboxId));
    }
    return { status: "queued", error: notice, outboxId };
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider(payload);
      if (result.status === "sent") {
        if (outboxId) {
          await db
            .update(emailOutbox)
            .set({ status: "sent", provider: result.provider, sentAt: new Date(), attempts: 1, lastError: null })
            .where(eq(emailOutbox.id, outboxId));
        }
        return { status: "sent", provider: result.provider, outboxId };
      }
      if (result.error) errors.push(result.error);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown provider error");
    }
  }

  const message = errors.join(" | ").slice(0, 900) || "No email provider configured";
  console.error(`[email] kind=${payload.kind} delivery failed outbox=${outboxId ?? "n/a"}: ${message}`);
  if (outboxId) {
    await db.update(emailOutbox).set({ status: "queued", attempts: 3, lastError: message }).where(eq(emailOutbox.id, outboxId));
  }
  return { status: "queued", error: message, outboxId };
}

export async function retryOutboxItem(id: number) {
  const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
  if (!row) return { status: "failed" as const, error: "Not found" };
  const result = await sendOwnerNotification({
    kind: row.kind as MailKind,
    subject: row.subject,
    text: row.textBody,
    html: row.htmlBody ?? `<pre>${escapeHtml(row.textBody)}</pre>`,
    replyTo: row.replyTo ?? undefined,
    relatedType: row.relatedType ?? undefined,
    relatedId: row.relatedId ?? undefined,
    to: row.toEmail,
  });
  await db.delete(emailOutbox).where(eq(emailOutbox.id, id));
  return result;
}

export { escapeHtml, cleanHeader };
