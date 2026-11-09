"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { requestPasswordResetAction, resetPasswordAction, type ResetPasswordState, type ResetRequestState } from "@/app/admin/password-actions";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30";

function PasswordField({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/50">{label}</span>
      <div className="relative mt-1.5">
        <input
          type={visible ? "text" : "password"}
          name={name}
          required
          autoComplete={autoComplete}
          minLength={12}
          maxLength={128}
          className={`${fieldClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/40 transition-colors hover:text-white"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetRequestState, FormData>(requestPasswordResetAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/50">Owner / admin email</span>
        <div className="relative mt-1.5">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="owner@your-domain.com"
            className={`${fieldClass} pl-10`}
          />
        </div>
      </label>
      {state.success && (
        <p role="status" className="rounded-xl border border-mint-400/25 bg-mint-500/10 px-3 py-2.5 text-[0.72rem] font-semibold leading-relaxed text-mint-100">
          {state.success}
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2.5 text-[0.72rem] font-semibold leading-relaxed text-rose-200">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-accent w-full py-3.5 disabled:opacity-70">
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><ShieldCheck className="h-4 w-4" /> Send reset link</>}
      </button>
      <Link href="/admin/login" className="flex items-center justify-center gap-1.5 pt-1 text-[0.7rem] font-semibold text-white/45 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(resetPasswordAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <PasswordField name="password" label="New password" autoComplete="new-password" />
      <PasswordField name="confirmPassword" label="Confirm new password" autoComplete="new-password" />
      <p className="text-[0.66rem] leading-relaxed text-white/40">Use at least 12 characters. This link is single-use and expires 30 minutes after it was sent.</p>
      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2.5 text-[0.72rem] font-semibold leading-relaxed text-rose-200">
          {state.error}{" "}
          <Link href="/admin/forgot-password" className="underline">Request a new link</Link>
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-accent w-full py-3.5 disabled:opacity-70">
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : <><ArrowRight className="h-4 w-4" /> Set new password</>}
      </button>
      <Link href="/admin/login" className="flex items-center justify-center gap-1.5 pt-1 text-[0.7rem] font-semibold text-white/45 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </Link>
    </form>
  );
}
