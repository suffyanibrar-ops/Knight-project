"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/auth";
import { requestAdminPasswordReset, resetAdminPassword, validateResetPassword } from "@/lib/password-reset";

export type ResetRequestState = { success?: string; error?: string };
export type ResetPasswordState = { error?: string };

const GENERIC_SENT =
  "If that address is the configured owner inbox, a password-reset email has been sent. Check the inbox and spam folder. The link expires in 30 minutes.";

/**
 * Always returns the same public outcome for an unknown address, a known
 * address, and an email-provider failure. Rate limits are per client IP.
 */
export async function requestPasswordResetAction(_prev: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const ip = clientKeyFromHeaders(await headers());
  const limit = checkRateLimit({ key: `admin-password-reset:${ip}`, limit: 3, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    await logAdminAction("password.reset_rate_limited", "reset request rate limited", ip);
    return { error: "Too many reset requests. Please wait a few minutes and try again." };
  }

  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    await requestAdminPasswordReset(email);
  } catch (error) {
    // Do not leak whether the address existed, or details of the mail provider.
    console.error("[password-reset] request failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
  }
  await logAdminAction("password.reset_requested", "owner reset request processed", ip);
  return { success: GENERIC_SENT };
}

export async function resetPasswordAction(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const ip = clientKeyFromHeaders(await headers());
  const limit = checkRateLimit({ key: `admin-password-reset-confirm:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    await logAdminAction("password.reset_confirm_rate_limited", "reset confirmation rate limited", ip);
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  if (!token) return { error: "The reset link is missing its token. Request a new link." };
  if (password !== confirm) return { error: "The passwords do not match." };
  const policyError = validateResetPassword(password);
  if (policyError) return { error: policyError };

  let result: { ok: boolean; error?: string };
  try {
    result = await resetAdminPassword(token, password);
  } catch (error) {
    console.error("[password-reset] confirmation failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    return { error: "The password could not be reset right now. Request a new link and try again." };
  }
  if (!result.ok) {
    await logAdminAction("password.reset_failed", "invalid or expired reset link", ip);
    return { error: result.error ?? "The password could not be reset." };
  }
  await logAdminAction("password.reset_success", "admin password changed via email reset", ip);
  redirect("/admin/login?reset=success");
}
