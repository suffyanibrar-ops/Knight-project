import { redirect } from "next/navigation";
import { BarChart3, Bot, CalendarClock, Database, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { isPasswordManagedInPanel } from "@/lib/admin-password";
import { getAiSettings } from "@/lib/ai-config";
import { emailChannelStatus, MAIL_FROM, OWNER_EMAIL } from "@/lib/email";
import { analyticsRetentionDays } from "@/lib/analytics";
import { getSetting, sqliteStatus } from "@/lib/sqlite";
import { AdminPageHeader } from "@/components/admin/ui";
import { PasswordForm } from "@/components/admin/password-form";

export const dynamic = "force-dynamic";

function StatusBadge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.06em] ${ok ? "border-mint-200 bg-mint-50 text-mint-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{children}</span>;
}

export default async function AdminSettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const managed = isPasswordManagedInPanel();
  const status = sqliteStatus();
  const envManaged = Boolean(process.env.ADMIN_PASSWORD);
  const hashManaged = Boolean(process.env.ADMIN_PASSWORD_HASH);
  const email = emailChannelStatus();
  const channels = [email.resend ? "Resend" : null, email.smtp ? "SMTP" : null, email.relay ? "FormSubmit relay" : null].filter(Boolean) as string[];
  const ai = getAiSettings();
  const analyticsRetention = analyticsRetentionDays();
  const booking = {
    enabled: ai.bookingEnabled,
    timezone: getSetting("ai.booking_timezone") ?? "America/New_York",
    duration: getSetting("ai.booking_duration_minutes") ?? "15",
    notice: getSetting("ai.booking_notice_hours") ?? "24",
    buffer: getSetting("ai.booking_buffer_minutes") ?? "15",
    horizon: getSetting("ai.booking_horizon_days") ?? "60",
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Settings"
        description="Security, storage and integration status for this console. Secrets are read from server environment variables and are never shown in the browser."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><KeyRound className="h-4 w-4" /></span>
            <div><h2 className="text-[0.95rem] font-extrabold tracking-tight text-ink-950">Security</h2><p className="text-[0.7rem] text-ink-600/80">Change the password used to sign in.</p></div>
          </div>
          <div className="mt-4"><PasswordForm /></div>
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950"><Lock className="h-4 w-4 text-brand-600" /> Session & password</h2>
          <ul className="mt-3 space-y-2 text-[0.78rem] leading-relaxed text-ink-700">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" /> Salted <strong>scrypt</strong> hash; plaintext passwords are never stored.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" /> Signed HttpOnly session cookie; expires after <strong>8 hours</strong>.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" /> Five failed attempts lock sign-in for 15 minutes; attempts are audit-logged.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-600" /> Current password source: {managed ? "set from this panel" : envManaged ? "ADMIN_PASSWORD" : hashManaged ? "ADMIN_PASSWORD_HASH" : "not configured"}.</li>
          </ul>
          <p className="mt-3 rounded-xl bg-mist-50 px-3 py-2.5 text-[0.7rem] leading-relaxed text-ink-600/70">A panel password overrides <code className="rounded bg-surface px-1 py-0.5">ADMIN_PASSWORD</code> and <code className="rounded bg-surface px-1 py-0.5">ADMIN_PASSWORD_HASH</code>. To reset, remove the <code className="rounded bg-surface px-1 py-0.5">admin_password</code> row.</p>
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950"><Database className="h-4 w-4 text-brand-600" /> Storage</h2>
          <dl className="mt-3 space-y-2 text-[0.76rem]">
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Status</dt><dd><StatusBadge ok={status.available}>{status.available ? `Ready · ${status.driver}` : "Unavailable"}</StatusBadge></dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Database</dt><dd className="break-all text-right font-semibold text-ink-900">{status.path}</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Mode</dt><dd className="font-semibold text-ink-900">SQLite · single application database</dd></div>
          </dl>
          {!status.available && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[0.72rem] leading-relaxed text-amber-800">{status.error ?? "The data directory is not writable."} Use a persistent volume or set <code className="rounded bg-surface px-1 py-0.5">SQLITE_PATH</code>.</p>}
          <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-600/70">Use a persistent filesystem. Keep the database and <code className="rounded bg-surface px-1 py-0.5">blog-media</code> in the same backup set.</p>
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950"><Mail className="h-4 w-4 text-brand-600" /> Email</h2>
          <dl className="mt-3 space-y-2 text-[0.76rem]">
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Delivery</dt><dd><StatusBadge ok={channels.length > 0}>{channels.length ? channels.join(" + ") : "Not configured"}</StatusBadge></dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Owner inbox</dt><dd className="break-all text-right font-semibold text-ink-900">{OWNER_EMAIL}</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Sender</dt><dd className="max-w-[16rem] break-all text-right font-semibold text-ink-900">{MAIL_FROM}</dd></div>
          </dl>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-600/70">Set <code className="rounded bg-surface px-1 py-0.5">RESEND_API_KEY</code> plus a verified <code className="rounded bg-surface px-1 py-0.5">MAIL_FROM</code> domain, or SMTP variables. Queued mail can be retried from <a href="/admin/outbox" className="font-bold text-brand-700 hover:text-brand-500">Email</a>.</p>
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950"><Bot className="h-4 w-4 text-brand-600" /> AI</h2>
          <dl className="mt-3 space-y-2 text-[0.76rem]">
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Provider</dt><dd><StatusBadge ok={Boolean(process.env.DEEPSEEK_API_KEY)}>{process.env.DEEPSEEK_API_KEY ? "DeepSeek configured" : "No API key"}</StatusBadge></dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Agent</dt><dd className="font-semibold text-ink-900">{ai.enabled ? "Enabled" : "Disabled"}</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Model</dt><dd className="font-semibold text-ink-900">{process.env.DEEPSEEK_MODEL ?? "deepseek-flash"}</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Voice</dt><dd className="font-semibold text-ink-900">{ai.voiceEnabled ? "Browser speech enabled" : "Disabled"}</dd></div>
          </dl>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-600/70">Edit personality, voice, notifications and booking from <a href="/admin/ai/settings" className="font-bold text-brand-700 hover:text-brand-500">AI settings</a>. Keys stay server-side.</p>
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950"><BarChart3 className="h-4 w-4 text-brand-600" /> Analytics</h2>
          <dl className="mt-3 space-y-2 text-[0.76rem]">
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">First-party tracking</dt><dd><StatusBadge ok={status.available}>Active on public pages</StatusBadge></dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Data store</dt><dd className="font-semibold text-ink-900">SQLite · same application database</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Retention</dt><dd className="font-semibold text-ink-900">{analyticsRetention} days</dd></div>
            <div className="flex items-start justify-between gap-3"><dt className="text-ink-600/80">Privacy</dt><dd className="font-semibold text-ink-900">No raw IPs · no form contents · no PHI</dd></div>
          </dl>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-600/70">
            Pageviews, sessions, sources and conversions are recorded by the first-party tracker. Set <code className="rounded bg-surface px-1 py-0.5">ANALYTICS_RETENTION_DAYS</code> to change retention. No third-party analytics account is required. <a href="/admin/traffic" className="font-bold text-brand-700 hover:text-brand-500">Open Live Traffic</a>.
          </p>
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-5 xl:col-span-2">
          <h2 className="flex items-center gap-2 text-[0.9rem] font-extrabold text-ink-950"><CalendarClock className="h-4 w-4 text-brand-600" /> Booking</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[["Status", booking.enabled ? "Enabled" : "Disabled"], ["Business timezone", booking.timezone], ["Duration", `${booking.duration} min`], ["Minimum notice", `${booking.notice} hr`], ["Buffer", `${booking.buffer} min`], ["Horizon", `${booking.horizon} days`]].map(([label, value]) => <div key={label} className="rounded-xl border border-mist-200 bg-mist-50/60 p-3"><p className="text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">{label}</p><p className="mt-1 text-[0.78rem] font-extrabold text-ink-900">{value}</p></div>)}
          </div>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-ink-600/70">Availability rules, blocked times and booking settings are managed in <a href="/admin/ai/appointments" className="font-bold text-brand-700 hover:text-brand-500">Appointments</a> and <a href="/admin/ai/settings" className="font-bold text-brand-700 hover:text-brand-500">AI settings</a>.</p>
        </section>
      </div>
    </div>
  );
}
