"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAdminAuthenticated, logAdminAction, rateLimit, recordFailure } from "@/lib/auth";
import { clientKeyFromHeaders } from "@/lib/rate-limit";
import { saveAdminPassword, verifyPasswordHash, getStoredPasswordHash } from "@/lib/admin-password";
import { deleteSubmission, isEnquiryStatus, updateSubmissionStatus } from "@/lib/sqlite";

export type PasswordState = { ok?: boolean; error?: string; message?: string };

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

/**
 * Update an enquiry status. The change is written to the authoritative
 * `submissions` row, appended to the status history and revalidated across every
 * module that counts enquiries.
 */
export async function updateInboxStatusAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 500) || null;
  if (!Number.isInteger(id) || id <= 0 || !isEnquiryStatus(status)) return;

  const updated = updateSubmissionStatus(id, status, "admin", note);
  if (updated) await logAdminAction("inbox.status", `submission #${id} -> ${status}`, null);
  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
}

/** Delete one SQLite submission from the inbox. */
export async function deleteInboxSubmissionAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const confirm = String(formData.get("confirm") ?? "");
  if (!Number.isInteger(id) || id <= 0) return;
  // Irreversible: the admin must type the record token before the row is removed.
  if (confirm !== `delete-${id}`) return;

  const deleted = deleteSubmission(id);
  await logAdminAction("inbox.delete", `submission #${id} deleted=${deleted}`, null);
  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
}

/**
 * Change the admin password from the panel.
 * Requires the current password, enforces a minimum length, and stores only a
 * salted scrypt hash in the embedded SQLite database.
 */
export async function changeAdminPasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  if (!(await isAdminAuthenticated())) return { error: "Your session expired. Please sign in again." };

  const requestHeaders = await headers();
  // Same trust model as loginAction: the last X-Forwarded-For hop is set by the
  // trusted reverse proxy, earlier entries are client-supplied.
  const ip = clientKeyFromHeaders(requestHeaders);
  if (!rateLimit(`password:${ip}`).allowed) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current) return { error: "Enter your current password." };
  if (next.length < 8) return { error: "The new password must be at least 8 characters." };
  if (next.length > 128) return { error: "The new password must be 128 characters or fewer." };
  if (next !== confirm) return { error: "The new passwords do not match." };
  if (next === current) return { error: "Choose a password different from your current one." };

  const stored = getStoredPasswordHash();

  // Verify the current password against whichever source is active.
  const { verifyAdminPassword } = await import("@/lib/auth");
  let currentValid = false;
  if (stored) {
    currentValid = verifyPasswordHash(current, stored);
  } else {
    currentValid = verifyAdminPassword(current);
  }

  if (!currentValid) {
    recordFailure(`password:${ip}`);
    await logAdminAction("password.change.failed", `incorrect current password from ${ip}`, ip);
    return { error: "Your current password is incorrect." };
  }

  const result = saveAdminPassword(next);
  if (!result.ok) return { error: result.error ?? "Could not change the password." };

  await logAdminAction("password.change", `password changed from ${ip}`, ip);
  return { ok: true, message: "Password updated. Use the new password the next time you sign in." };
}
