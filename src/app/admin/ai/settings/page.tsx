import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAiSettings } from "@/lib/ai-config";
import { getSetting } from "@/lib/sqlite";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiPanel, adminButton, adminInput, adminLabel } from "@/components/admin/ai/ui";
import { saveAgentSettingsAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI agent settings · Admin", robots: { index: false, follow: false } };

export default async function AdminAiSettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const settings = getAiSettings();
  const deepseekConfigured = Boolean(process.env.DEEPSEEK_API_KEY);
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
  return (
    <div className="space-y-5">
      <AdminPageHeader title="AI agent settings" description="Instructions, voice, notifications and booking configuration. Safety rules and the API key are fixed in server code/environment and cannot be edited here." />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.58rem] font-extrabold uppercase tracking-wide text-ink-600/60">DeepSeek</p><p className="mt-1"><AiBadge tone={deepseekConfigured ? "good" : "bad"}>{deepseekConfigured ? "configured" : "missing key"}</AiBadge></p><p className="mt-1 text-[0.66rem] text-ink-600/70">Model: {model} · thinking disabled</p></div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.58rem] font-extrabold uppercase tracking-wide text-ink-600/60">Voice engine</p><p className="mt-1"><AiBadge tone={settings.voiceEnabled ? "good" : "warn"}>{settings.voiceEnabled ? "enabled" : "disabled"}</AiBadge></p><p className="mt-1 text-[0.66rem] text-ink-600/70">Browser speech recognition + synthesis (no paid voice API)</p></div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.58rem] font-extrabold uppercase tracking-wide text-ink-600/60">Visitor agent</p><p className="mt-1"><AiBadge tone={settings.enabled ? "good" : "bad"}>{settings.enabled ? "live" : "disabled"}</AiBadge></p><p className="mt-1 text-[0.66rem] text-ink-600/70">Toggle from the overview page</p></div>
      </div>

      <form action={saveAgentSettingsAction} className="space-y-4">
        <AiPanel title="Personality & instructions" description="Editable guidance. It cannot override the fixed accuracy, PHI and booking rules.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminLabel}>Agent name<input name="agentName" defaultValue={settings.agentName} maxLength={40} className={adminInput} /></label>
            <label className={adminLabel}>Voice name hint (optional)<input name="voiceName" defaultValue={settings.voiceName} maxLength={120} placeholder="Auto-select by browser" className={adminInput} /></label>
            <label className={`${adminLabel} sm:col-span-2`}>Welcome message<textarea name="welcome" defaultValue={settings.welcome} rows={3} maxLength={600} className={adminInput} /></label>
            <label className={`${adminLabel} sm:col-span-2`}>Tone & style<textarea name="tone" defaultValue={settings.tone} rows={2} maxLength={600} className={adminInput} /></label>
            <label className={`${adminLabel} sm:col-span-2`}>Extra instructions<textarea name="instructions" defaultValue={settings.instructions} rows={5} maxLength={4000} className={adminInput} /></label>
          </div>
        </AiPanel>

        <AiPanel title="Voice" description="Uses the browser's built-in speech recognition and speech synthesis. Microphone permission is requested only after a visitor clicks voice.">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-[0.74rem] font-semibold text-ink-800"><input type="checkbox" name="voiceEnabled" defaultChecked={settings.voiceEnabled} /> Enable voice mode</label>
            <label className={adminLabel}>Speech rate<input type="number" name="voiceRate" step={0.05} min={0.6} max={1.4} defaultValue={settings.voiceRate} className={adminInput} /></label>
            <p className="self-end text-[0.66rem] text-ink-600/70">No audio is recorded or sent to a third party.</p>
          </div>
        </AiPanel>

        <AiPanel title="Notifications" description="Where handoffs, new leads and bookings are emailed. Uses your existing Resend configuration.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminLabel}>Handoff notification email<input type="email" name="handoffEmail" defaultValue={settings.handoffEmail} className={adminInput} /></label>
            <label className={adminLabel}>Lead & appointment notification email<input type="email" name="notificationEmail" defaultValue={settings.notificationEmail} className={adminInput} /></label>
            <label className={adminLabel}>Transcript retention (days)<input type="number" name="retentionDays" min={1} max={365} defaultValue={settings.retentionDays} className={adminInput} /></label>
          </div>
        </AiPanel>

        <AiPanel title="Booking windows" description="Availability rules and blocked times live under Appointments. These values control the booking horizon and buffers.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex items-center gap-2 self-end text-[0.74rem] font-semibold text-ink-800"><input type="checkbox" name="bookingEnabled" defaultChecked={settings.bookingEnabled} /> Enable online booking</label>
            <label className={adminLabel}>Horizon (days)<input type="number" name="bookingHorizonDays" min={1} max={180} defaultValue={Number(getSetting("ai.booking_horizon_days") ?? 60)} className={adminInput} /></label>
            <label className={adminLabel}>Minimum notice (hours)<input type="number" name="bookingNoticeHours" min={0} max={168} defaultValue={Number(getSetting("ai.booking_notice_hours") ?? 24)} className={adminInput} /></label>
            <label className={adminLabel}>Slot duration (minutes)<input type="number" name="bookingDurationMinutes" min={10} max={60} defaultValue={Number(getSetting("ai.booking_duration_minutes") ?? 15)} className={adminInput} /></label>
            <label className={adminLabel}>Buffer between calls (minutes)<input type="number" name="bookingBufferMinutes" min={0} max={60} defaultValue={Number(getSetting("ai.booking_buffer_minutes") ?? 15)} className={adminInput} /></label>
            <label className={adminLabel}>Business timezone<input name="bookingTimezone" defaultValue={getSetting("ai.booking_timezone") ?? "America/New_York"} className={adminInput} /></label>
          </div>
        </AiPanel>

        <button type="submit" className={adminButton}>Save settings</button>
      </form>

      <p className="rounded-xl border border-mist-200 bg-mist-50 px-3.5 py-2.5 text-[0.68rem] leading-relaxed text-ink-600/70">
        Security: the DeepSeek API key is stored only in server environment variables. It is never shown here, never sent to the browser, and cannot be edited through the admin console.
      </p>
    </div>
  );
}
