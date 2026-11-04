import { redirect } from "next/navigation";
import { Database, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { isPasswordManagedInPanel } from "@/lib/admin-password";
import { sqliteStatus } from "@/lib/sqlite";
import { AdminPageHeader } from "@/components/admin/ui";
import { PasswordForm } from "@/components/admin/password-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const managed = isPasswordManagedInPanel();
  const status = sqliteStatus();
  const envManaged = Boolean(process.env.ADMIN_PASSWORD);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Settings"
        description="Change the password used to sign in to this admin console, and review where your data is stored."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[0.95rem] font-extrabold tracking-tight text-ink-950">Change password</h2>
              <p className="text-[0.7rem] text-ink-600/80">You will need your current password.</p>
            </div>
          </div>
          <div className="mt-4">
            <PasswordForm />
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-mist-200 bg-surface p-5">
            <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950">
              <Lock className="h-4 w-4 text-brand-600" /> How your password is stored
            </h2>
            <ul className="mt-3 space-y-2 text-[0.78rem] leading-relaxed text-ink-700">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" />
                Salted <strong>scrypt</strong> hash — the plaintext is never saved.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" />
                Current source: {managed ? "set from this panel" : envManaged ? "ADMIN_PASSWORD environment variable" : "built-in default digest"}.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" />
                Sessions expire after 8 hours and use a signed HttpOnly cookie.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" />
                Five failed attempts lock sign-in for 15 minutes; attempts are audit-logged.
              </li>
            </ul>
            <p className="mt-3 rounded-xl bg-mist-50 px-3 py-2.5 text-[0.72rem] leading-relaxed text-ink-600/70">
              A password changed here overrides <code className="rounded bg-surface px-1 py-0.5">ADMIN_PASSWORD</code> and the built-in default.
              To reset everything, delete the <code className="rounded bg-surface px-1 py-0.5">admin_password</code> row in the local database.
            </p>
          </section>

          <section className="rounded-2xl border border-mist-200 bg-surface p-5">
            <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950">
              <Database className="h-4 w-4 text-brand-600" /> Local storage
            </h2>
            <dl className="mt-3 space-y-2 text-[0.76rem]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-600/80">Status</dt>
                <dd className="font-bold text-ink-900">{status.available ? `Ready (${status.driver})` : "Unavailable"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-600/80">File</dt>
                <dd className="break-all text-right font-semibold text-ink-900">{status.path}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-600/80">Tables</dt>
                <dd className="font-semibold text-ink-900">submissions, settings</dd>
              </div>
            </dl>
            {!status.available && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[0.72rem] leading-relaxed text-amber-800">
                {status.error ?? "The data directory is not writable."} Use a persistent volume, or set{" "}
                <code className="rounded bg-surface px-1 py-0.5">SQLITE_PATH</code> to a writable location.
              </p>
            )}
            <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-600/80">
              The inbox database needs a persistent filesystem. Serverless platforms with ephemeral disks should use a mounted volume.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
