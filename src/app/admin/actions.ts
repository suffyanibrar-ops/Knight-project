"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages, emailOutbox, leads } from "@/db/schema";
import {
  ADMIN_COOKIE,
  clearFailures,
  createSessionToken,
  isAdminAuthenticated,
  isAdminLoginConfigured,
  logAdminAction,
  rateLimit,
  recordFailure,
  sessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/auth";
import { OWNER_EMAIL, retryOutboxItem, sendOwnerNotification } from "@/lib/email";
import { clientKeyFromHeaders } from "@/lib/rate-limit";
import { deleteSubscriber, isSqliteAvailable } from "@/lib/sqlite";

export type LoginState = { error?: string; lockedSeconds?: number };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const requestHeaders = await headers();
  // Same trust model as the public API routes: the last X-Forwarded-For hop is
  // set by the trusted reverse proxy, earlier entries are client-supplied.
  const ip = clientKeyFromHeaders(requestHeaders);
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/admin");

  // Explicit setup error when no password exists at all. Sign-in fails closed in
  // every environment (there is no built-in default), so this is not prod-only.
  if (!isAdminLoginConfigured()) {
    await logAdminAction("login.blocked", "no admin password configured", ip);
    return { error: "Admin sign-in is not available yet: no admin password is configured on the server. Set ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH), or change it from the admin panel. Contact the site owner." };
  }

  const limit = rateLimit(ip);
  if (!limit.allowed) {
    await logAdminAction("login.blocked", `rate limited from ${ip}`, ip);
    return { error: "Too many attempts. Please try again later.", lockedSeconds: limit.retryAfter };
  }

  if (!password || !verifyAdminPassword(password)) {
    recordFailure(ip);
    await logAdminAction("login.failed", `failed attempt from ${ip}`, ip);
    return { error: "Incorrect password. Please try again." };
  }

  clearFailures(ip);
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionToken(), sessionCookieOptions);
  await logAdminAction("login.success", `signed in from ${ip}`, ip);

  const safeNext = nextPath.startsWith("/admin") ? nextPath : "/admin";
  redirect(safeNext);
}

export async function logoutAction() {
  const store = await cookies();
  const ip = clientKeyFromHeaders(await headers());
  store.delete(ADMIN_COOKIE);
  await logAdminAction("logout", null, ip);
  redirect("/admin/login");
}

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

export async function updateStatusAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type") ?? "");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "new").slice(0, 40);
  if (!Number.isFinite(id)) return;

  if (type === "lead") await db.update(leads).set({ status }).where(eq(leads.id, id));
  if (type === "contact") await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id));
  await logAdminAction("submission.status", `${type} #${id} → ${status}`, null);
  revalidatePath("/admin");
  revalidatePath("/admin/submissions");
}

export async function deleteSubmissionAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type") ?? "");
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  if (type === "lead") await db.delete(leads).where(eq(leads.id, id));
  if (type === "contact") await db.delete(contactMessages).where(eq(contactMessages.id, id));
  if (type === "subscriber") {
    // Newsletter opt-ins are stored only in the embedded SQLite file.
    if (isSqliteAvailable()) deleteSubscriber(id);
  }
  await logAdminAction("submission.delete", `${type} #${id}`, null);
  revalidatePath("/admin");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/subscribers");
  revalidatePath("/admin/estimates");
}

export async function sendTestEmailAction() {
  await requireAdmin();
  const result = await sendOwnerNotification({
    kind: "test",
    subject: `Knight Medical Billing — test notification (${new Date().toISOString().slice(0, 16).replace("T", " ")})`,
    text: "This is a test notification from your Knight Medical Billing admin console. If you received it, owner notifications are working.",
    html: '<div style="font-family:Helvetica,Arial,sans-serif;padding:20px"><h2 style="color:#071f2f">Test notification</h2><p style="color:#33505f">This is a test from your Knight Medical Billing admin console. If you received it, owner email notifications are working.</p></div>',
    to: OWNER_EMAIL,
  });
  await logAdminAction("email.test", `test notification → ${result.status}`, null);
  revalidatePath("/admin/outbox");
}

export async function retryAllQueuedAction() {
  await requireAdmin();
  const queued = await db.select({ id: emailOutbox.id }).from(emailOutbox).where(ne(emailOutbox.status, "sent")).orderBy(desc(emailOutbox.createdAt)).limit(25);
  for (const row of queued) {
    await retryOutboxItem(row.id);
  }
  await logAdminAction("email.retryAll", `${queued.length} queued messages retried`, null);
  revalidatePath("/admin/outbox");
}

export async function retryEmailAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const result = await retryOutboxItem(id);
  await logAdminAction("email.retry", `outbox #${id} → ${result.status}`, null);
  revalidatePath("/admin/outbox");
  revalidatePath("/admin");
}
