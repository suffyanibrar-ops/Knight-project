import "server-only";
import { db, isSqliteAvailable } from "@/db";
import { emailOutbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isEmailSuppressed } from "./sqlite";

export const OWNER_EMAIL = process.env.ADMIN_EMAIL ?? "admin@knightmedicalbilling.com";
/**
 * Sender identity for every outbound message. The domain must be verified in
 * Resend and authorized for RESEND_API_KEY — otherwise Resend rejects the send
 * with "not authorized to send emails from <domain>".
 *
 * PRODUCTION NOTE: the requested subdomain `send.knightmedicalbilling.com` is
 * not currently authorized for the configured API key, while the root domain
 * `knightmedicalbilling.com` is. Set MAIL_FROM in the hosting environment once
 * the subdomain is verified in Resend; until then the root-domain sender below
 * is the one that actually delivers.
 */
const MAIL_FROM = process.env.MAIL_FROM ?? "Knight Medical Billing <website@knightmedicalbilling.com>";
const ADMIN_APP_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.knightmedicalbilling.com") + "/admin";

/**
 * Legitimate business contact details shown in transactional email footers.
 * Real information in a footer is a trust signal; promotional copy is not.
 */
export const BUSINESS_CONTACT = "Knight Medical Billing · 585 Grove St Ste 145, Herndon, VA 20170-4790 · (812) 994-0046 · admin@knightmedicalbilling.com";

export type MailKind = "consultation" | "contact" | "subscriber" | "roi" | "test" | "appointment" | "handoff" | "ai_lead";

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

type DeliveryResult = { status: "sent" | "failed" | "queued"; provider?: string; error?: string; messageId?: string; outboxId?: number };

/** Strips CR/LF and control characters so user input cannot inject mail headers. */
function cleanHeader(value: string | undefined | null) {
  if (!value) return undefined;
  return value.replace(/[\r\n\t\u0000-\u001f]+/g, " ").slice(0, 240);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Human-readable submission timestamp (US Eastern, the business timezone) plus
 * the exact ISO instant, so the owner can see when a form was submitted
 * regardless of the server's own timezone.
 */
export function formatSubmissionDate(value: Date = new Date()): string {
  const human = value.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${human} (${value.toISOString()})`;
}

type ShellOptions = {
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Optional paragraph under the title. */
  intro?: string;
  /** Optional call-to-action button; `null` hides it. */
  cta?: { label: string; href: string } | null;
};

function shell(
  title: string,
  rows: { label: string; value: string }[],
  footer = "Knight Medical Billing · 585 Grove St Ste 145, Herndon, VA 20170-4790",
  options: ShellOptions = {},
) {
  const body = rows
    .filter((row) => row.value && row.value.trim().length > 0)
    .map(
      (row) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #e1ebf1;font:600 12px/1.4 Helvetica,Arial,sans-serif;color:#5b7686;text-transform:uppercase;letter-spacing:.06em;width:34%;vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e1ebf1;font:15px/1.55 Helvetica,Arial,sans-serif;color:#071f2f">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");
  const eyebrow = options.eyebrow ?? "New website submission";
  const intro = options.intro
    ? `<tr><td style="padding:0 24px 12px"><p style="margin:0;font:15px/1.6 Helvetica,Arial,sans-serif;color:#33505f">${escapeHtml(options.intro)}</p></td></tr>`
    : "";
  const cta = options.cta === null
    ? ""
    : `<tr><td style="padding:0 24px 24px"><a href="${escapeHtml(options.cta?.href ?? ADMIN_APP_URL)}" style="display:inline-block;background:#0e83ab;color:#fff;font:700 13px/1 Helvetica,Arial,sans-serif;padding:12px 18px;border-radius:999px;text-decoration:none">${escapeHtml(options.cta?.label ?? "Open admin panel")}</a></td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f5fafc;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e1ebf1;border-radius:16px;overflow:hidden">
    <tr><td style="background:#071f2f;padding:20px 24px"><div style="font:800 18px/1 Helvetica,Arial,sans-serif;color:#fff">Knight Medical Billing</div><div style="margin-top:6px;font:600 11px/1 Helvetica,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#7cd7f2">${escapeHtml(eyebrow)}</div></td></tr>
    <tr><td style="padding:22px 24px 6px"><h1 style="margin:0;font:800 21px/1.3 Helvetica,Arial,sans-serif;color:#071f2f">${escapeHtml(title)}</h1></td></tr>
    ${intro}
    <tr><td style="padding:10px 24px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #e1ebf1">${body}</table></td></tr>
    ${cta}
    <tr><td style="background:#f7fafc;padding:14px 24px;font:12px/1.5 Helvetica,Arial,sans-serif;color:#5b7686">${escapeHtml(footer)}</td></tr>
  </table></body></html>`;
}

export function buildConsultationEmail(lead: {
  name: string; email: string; phone?: string | null; practice?: string | null; specialty?: string | null;
  practiceSize?: string | null; providers?: string | null; interests?: string[] | null; message?: string | null; source?: string;
  submittedAt?: Date;
}) {
  const rows = [
    { label: "Name", value: lead.name },
    { label: "Email", value: lead.email },
    { label: "Phone", value: lead.phone ?? "" },
    { label: "Practice / facility", value: lead.practice ?? "" },
    { label: "Facility type", value: lead.practiceSize ?? "" },
    { label: "Specialty", value: lead.specialty ?? "" },
    { label: "Provider count", value: lead.providers ?? "" },
    { label: "Interested in", value: (lead.interests ?? []).join(", ") },
    { label: "Message", value: lead.message ?? "" },
    { label: "Source", value: lead.source ?? "website" },
    { label: "Submitted", value: formatSubmissionDate(lead.submittedAt ?? new Date()) },
  ];
  const who = lead.name.trim() || "Website visitor";
  return {
    subject: `New consultation request — ${who}${lead.practice ? ` (${lead.practice})` : ""}`,
    text: [
      "A new consultation request was submitted on the Knight Medical Billing website.",
      "",
      ...rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`),
      "",
      `Reply to this email to contact ${who} directly at ${lead.email}.`,
      "",
      BUSINESS_CONTACT,
    ].join("\n"),
    html: shell("New consultation request", rows, BUSINESS_CONTACT, { eyebrow: "New consultation request" }),
  };
}

export function buildContactEmail(message: {
  name: string; email: string; phone?: string | null; topic?: string | null; message: string; submittedAt?: Date;
}) {
  const rows = [
    { label: "Name", value: message.name },
    { label: "Email", value: message.email },
    { label: "Phone", value: message.phone ?? "" },
    { label: "Topic", value: message.topic ?? "" },
    { label: "Message", value: message.message },
    { label: "Submitted", value: formatSubmissionDate(message.submittedAt ?? new Date()) },
  ];
  return {
    subject: `New contact message — ${message.name}${message.topic ? ` · ${message.topic}` : ""}`,
    text: `New contact message\n\n${rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`).join("\n")}\n\nReply directly to this email to reach ${message.name} at ${message.email}.`,
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

export type VisitorConfirmationKind = "consultation" | "contact";

/**
 * Visitor-facing confirmation. It echoes back what was submitted (so the visitor
 * has a record), never contains internal notes, and has no admin link.
 */
export function buildVisitorConfirmationEmail(
  kind: VisitorConfirmationKind,
  details: {
    name: string; email: string; phone?: string | null; practice?: string | null; specialty?: string | null;
    practiceSize?: string | null; providers?: string | null; interests?: string[] | null;
    topic?: string | null; message?: string | null; submittedAt?: Date;
  },
) {
  const firstName = details.name.trim().split(/\s+/)[0] || "there";
  const submitted = formatSubmissionDate(details.submittedAt ?? new Date());

  if (kind === "contact") {
    const rows = [
      { label: "Name", value: details.name },
      { label: "Email", value: details.email },
      { label: "Topic", value: details.topic ?? "" },
      { label: "Your message", value: details.message ?? "" },
      { label: "Submitted", value: submitted },
    ];
    return {
      subject: "We received your message — Knight Medical Billing",
      text: [`Hi ${firstName},`, "", "Thank you for contacting Knight Medical Billing. Your message was received successfully and is with our team.", "", "A member of our team replies within one business hour, Monday to Friday, 8am-8pm ET. If you need us sooner, call (812) 994-0046.", "", "Here is a copy of what you submitted:", "", ...rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`), "", "If anything above is incorrect, reply to this email and let us know.", "", BUSINESS_CONTACT].join("\n"),
      html: shell(
        "Thanks — your message is with our team",
        rows,
        BUSINESS_CONTACT,
        {
          eyebrow: "Message received",
          intro: `Hi ${firstName}, thanks for contacting Knight Medical Billing. This is a confirmation that your message reached our team. A member of our team replies within one business hour, Monday–Friday, 8am–8pm ET.`,
          cta: null,
        },
      ),
    };
  }

  const rows = [
    { label: "Name", value: details.name },
    { label: "Email", value: details.email },
    { label: "Phone", value: details.phone ?? "" },
    { label: "Practice / facility", value: details.practice ?? "" },
    { label: "Specialty", value: details.specialty ?? "" },
    { label: "Facility type", value: details.practiceSize ?? "" },
    { label: "Provider count", value: details.providers ?? "" },
    { label: "Interested in", value: (details.interests ?? []).join(", ") },
    { label: "Your message", value: details.message ?? "" },
    { label: "Submitted", value: submitted },
  ];
  return {
    subject: "We received your consultation request — Knight Medical Billing",
    text: [
      `Hi ${firstName},`,
      "",
      "Thank you for contacting Knight Medical Billing. Your consultation request was received successfully and is with our team.",
      "",
      "What happens next:",
      "1. A member of our team reviews the information you submitted.",
      "2. We contact you using the details below, normally within one business day (Monday to Friday).",
      "3. We arrange a time to review your current billing process.",
      "",
      "Here is a copy of what you submitted:",
      "",
      ...rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`),
      "",
      "If anything above is incorrect, reply to this email and let us know.",
      "",
      "You are receiving this email because you submitted a consultation request on knightmedicalbilling.com. If you did not submit it, please ignore this message.",
      "",
      BUSINESS_CONTACT,
    ].join("\n"),
    html: shell(
      "Your consultation request was received",
      rows,
      BUSINESS_CONTACT,
      {
        eyebrow: "Consultation request received",
        intro: `Hi ${firstName}, thank you for contacting Knight Medical Billing. Your request was received successfully. A member of our team will review it and contact you using the details below, normally within one business day (Monday to Friday).`,
        cta: null,
      },
    ),
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Delivery timed out")), ms))]);
}

async function viaResend(payload: MailPayload): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "failed", error: "RESEND_API_KEY not configured" };

  // Replies to a visitor confirmation must land in the monitored business
  // inbox, not on the no-reply sending address; owner mail already sets the
  // visitor as Reply-To. Both improve the engagement signal Gmail scores.
  const replyTo = cleanHeader(payload.replyTo) ?? (payload.to && payload.to !== OWNER_EMAIL ? OWNER_EMAIL : undefined);

  const response = await withTimeout(
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [payload.to ?? OWNER_EMAIL],
        reply_to: replyTo,
        subject: cleanHeader(payload.subject),
        text: payload.text,
        html: payload.html,
        // Transactional markers: an auto-submitted notice suppresses vacation
        // responders, and the reference id makes each send traceable without
        // turning it into a bulk/broadcast message.
        headers: {
          "X-Entity-Ref-ID": `${payload.kind}-${Date.now()}`,
          "X-Auto-Response-Suppress": "All",
          "Auto-Submitted": "auto-generated",
          // Gmail complaint attribution (Postmaster Tools): campaign:customer:type:sender
          "Feedback-ID": `website-transactional:knightmedicalbilling:${payload.kind}:resend`,
        },
      }),
    }),
    9000,
  );
  if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  return { status: "sent", provider: "resend", messageId: typeof body?.id === "string" ? body.id : undefined };
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
  const recipient = payload.to ?? OWNER_EMAIL;
  const suppressed = isEmailSuppressed(recipient);
  const persist = isSqliteAvailable();
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
        status: suppressed ? "suppressed" : "pending",
        relatedType: payload.relatedType ?? null,
        relatedId: payload.relatedId ?? null,
      })
      .returning({ id: emailOutbox.id });
    outboxId = row?.id;
  } catch (error) {
    console.error("outbox insert failed", error);
  }

  if (suppressed) {
    console.warn(`[email] skipped ${payload.kind}: recipient ${recipient} is on the bounce/complaint suppression list`);
    return { status: "failed", error: "Recipient suppressed after a bounce or complaint", outboxId };
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
            .set({
              status: "sent",
              provider: result.provider,
              providerMessageId: result.messageId ?? null,
              sentAt: new Date(),
              attempts: 1,
              lastError: null,
            })
            .where(eq(emailOutbox.id, outboxId));
        }
        return { status: "sent", provider: result.provider, messageId: result.messageId, outboxId };
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

/**
 * Deliver a visitor-facing confirmation. Visitor mail is transactional, so the
 * owner-oriented FormSubmit relay is deliberately excluded: only Resend (or
 * SMTP when configured) is used. Failures are logged and never reach the
 * visitor — their submission is already stored, and the owner copy is measured
 * separately.
 */
export async function sendVisitorConfirmation(payload: MailPayload): Promise<DeliveryResult> {
  const message: MailPayload = { ...payload, replyTo: payload.replyTo ?? OWNER_EMAIL };
  const recipient = message.to ?? OWNER_EMAIL;
  const suppressed = isEmailSuppressed(recipient);

  // Visitor confirmations are logged in the same outbox as owner mail, under a
  // distinct kind, so delivery, bounces and complaints are traceable for both
  // messages and the Resend webhook can update either one.
  let outboxId: number | undefined;
  if (isSqliteAvailable()) {
    try {
      const [row] = await db
        .insert(emailOutbox)
        .values({
          kind: `${payload.kind}_visitor`,
          toEmail: message.to ?? OWNER_EMAIL,
          replyTo: cleanHeader(message.replyTo) ?? null,
          subject: cleanHeader(message.subject) ?? "Confirmation",
          textBody: message.text,
          htmlBody: message.html,
          status: suppressed ? "suppressed" : "pending",
          relatedType: payload.relatedType ?? null,
          relatedId: payload.relatedId ?? null,
        })
        .returning({ id: emailOutbox.id });
      outboxId = row?.id;
    } catch (error) {
      console.error("visitor outbox insert failed", error);
    }
  }

  if (suppressed) {
    console.warn(`[email] skipped visitor confirmation: ${recipient} is on the bounce/complaint suppression list`);
    return { status: "failed", error: "Recipient suppressed after a bounce or complaint", outboxId };
  }

  const providers: ((p: MailPayload) => Promise<DeliveryResult>)[] = [];
  if (process.env.RESEND_API_KEY) providers.push(viaResend);
  if (process.env.SMTP_HOST) providers.push(viaSmtp);
  if (providers.length === 0) {
    const notice = "No email channel configured (set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS)";
    console.error(`[email] visitor confirmation skipped: ${notice}`);
    if (outboxId) {
      await db.update(emailOutbox).set({ status: "queued", lastError: notice }).where(eq(emailOutbox.id, outboxId));
    }
    return { status: "queued", error: notice, outboxId };
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider(message);
      if (result.status === "sent") {
        if (outboxId) {
          await db
            .update(emailOutbox)
            .set({ status: "sent", provider: result.provider, providerMessageId: result.messageId ?? null, sentAt: new Date(), attempts: 1, lastError: null })
            .where(eq(emailOutbox.id, outboxId));
        }
        console.info(`[email] visitor confirmation sent to ${message.to ?? "unknown"} via ${result.provider}${result.messageId ? ` (${result.messageId})` : ""}`);
        return { ...result, outboxId };
      }
      if (result.error) errors.push(result.error);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown provider error");
    }
  }
  const failure = errors.join(" | ").slice(0, 600) || "Visitor confirmation failed";
  console.error(`[email] visitor confirmation to ${message.to ?? "unknown"} failed: ${failure}`);
  if (outboxId) {
    await db.update(emailOutbox).set({ status: "queued", lastError: failure.slice(0, 900) }).where(eq(emailOutbox.id, outboxId));
  }
  return { status: "failed", error: failure, outboxId };
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
