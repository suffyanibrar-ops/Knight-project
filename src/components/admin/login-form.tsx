"use client";

import { useActionState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

export function AdminLoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next ?? "/admin"} />
      <label className="block">
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/50">Password</span>
        <div className="relative mt-1.5">
          <input
            type={visible ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            autoFocus
            placeholder="Enter admin password"
            aria-label="Admin password"
            className="w-full rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-3 pr-11 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30"
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

      {state.error && (
        <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-[0.72rem] font-semibold text-rose-200">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-accent w-full py-3.5 disabled:opacity-70">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
          </>
        ) : (
          <>
            Sign in <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
