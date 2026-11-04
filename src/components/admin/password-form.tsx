"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { changeAdminPasswordAction, type PasswordState } from "@/app/admin/inbox/actions";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function PasswordField({ name, label, placeholder, autoComplete }: { name: string; label: string; placeholder: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="text-[0.78rem] font-bold text-ink-800">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`${fieldClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-600/40 transition-colors hover:text-ink-900"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(changeAdminPasswordAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <PasswordField name="currentPassword" label="Current password" placeholder="Enter your current password" autoComplete="current-password" />
      <PasswordField name="newPassword" label="New password" placeholder="At least 8 characters" autoComplete="new-password" />
      <PasswordField name="confirmPassword" label="Confirm new password" placeholder="Repeat the new password" autoComplete="new-password" />

      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[0.76rem] font-semibold text-rose-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-mint-200 bg-mint-50 px-3 py-2.5 text-[0.76rem] font-semibold text-mint-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full py-3 disabled:opacity-70">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {pending ? "Updating…" : "Update password"}
      </button>
      <p className="text-[0.68rem] leading-relaxed text-ink-600/80">
        Stored as a salted scrypt hash in the local database. Never written to logs or the browser.
      </p>
    </form>
  );
}
