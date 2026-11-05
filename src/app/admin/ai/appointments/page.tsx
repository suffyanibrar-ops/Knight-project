import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { listAppointments, listAvailabilityRules, listBlockedTimes, formatSlot } from "@/lib/ai-appointments";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiDate, AiPanel, adminButton, adminButtonLight, adminInput, adminLabel } from "@/components/admin/ai/ui";
import { appointmentStatusAction, saveAvailabilityAction, addBlockedTimeAction, deleteBlockedTimeAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI appointments · Admin", robots: { index: false, follow: false } };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Split appointments into upcoming/recent vs older records at request time. */
function splitAppointments<T extends { startsAtUtc: number }>(appointments: T[]) {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  return {
    upcoming: appointments.filter((appointment) => appointment.startsAtUtc >= cutoff).sort((a, b) => a.startsAtUtc - b.startsAtUtc),
    past: appointments.filter((appointment) => appointment.startsAtUtc < cutoff),
  };
}
const pad = (value: number) => String(value).padStart(2, "0");
const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export default async function AdminAiAppointmentsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const appointments = listAppointments(200);
  const rules = listAvailabilityRules();
  const blocked = listBlockedTimes();
  const { upcoming, past } = splitAppointments(appointments);

  return (
    <div className="space-y-5">
      <AdminPageHeader title="AI appointments" description="Real 15-minute intro calls booked by the agent or the website calendar. All times are stored in UTC and shown in Eastern Time." />

      <AiPanel title="Upcoming & recent appointments" description="Confirm or cancel bookings. Slot times remain protected against double-booking unless cancelled.">
        {upcoming.length === 0 ? <p className="rounded-xl border border-dashed border-mist-200 bg-mist-50 px-4 py-6 text-center text-[0.78rem] text-ink-600/70">No appointments booked yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-[0.74rem]">
            <thead><tr className="border-b border-mist-200 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">
              <th className="pb-2 pr-3">When</th><th className="pb-2 pr-3">Visitor</th><th className="pb-2 pr-3">Contact</th><th className="pb-2 pr-3">Organization</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Email</th><th className="pb-2">Actions</th>
            </tr></thead>
            <tbody>{upcoming.map((appointment) => (
              <tr key={appointment.id} className="border-b border-mist-100 align-top last:border-0">
                <td className="py-2 pr-3 whitespace-nowrap font-bold text-ink-900">{appointment.dateLabel} · {appointment.timeLabel}</td>
                <td className="py-2 pr-3">{appointment.name}</td>
                <td className="py-2 pr-3">{appointment.email}{appointment.phone ? <><br />{appointment.phone}</> : null}</td>
                <td className="py-2 pr-3">{appointment.organization ?? "—"}</td>
                <td className="py-2 pr-3"><AiBadge tone={appointment.status === "confirmed" ? "good" : appointment.status === "cancelled" ? "bad" : "warn"}>{appointment.status}</AiBadge></td>
                <td className="py-2 pr-3"><AiBadge tone={appointment.emailStatus === "sent" ? "good" : appointment.emailStatus === "failed" ? "bad" : "warn"}>{appointment.emailStatus}</AiBadge></td>
                <td className="py-2"><div className="flex gap-1.5">
                  {appointment.status !== "confirmed" && <form action={appointmentStatusAction}><input type="hidden" name="id" value={appointment.id} /><input type="hidden" name="status" value="confirmed" /><button className={adminButtonLight} type="submit">Confirm</button></form>}
                  {appointment.status !== "cancelled" && <form action={appointmentStatusAction}><input type="hidden" name="id" value={appointment.id} /><input type="hidden" name="status" value="cancelled" /><button className="inline-flex rounded-xl border border-rose-200 px-3 py-2 text-[0.72rem] font-bold text-rose-700 hover:bg-rose-50" type="submit">Cancel</button></form>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {past.length > 0 && <p className="mt-3 text-[0.68rem] text-ink-600/60">{past.length} past appointment{past.length === 1 ? "" : "s"} retained for records.</p>}
      </AiPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <AiPanel title="Weekly availability" description="Local business hours in America/New_York. Slot length is 15 minutes; buffer keeps the next slot open.">
          <form action={saveAvailabilityAction} className="space-y-2.5">
            {rules.map((rule) => (
              <div key={rule.id} className="grid items-end gap-2 rounded-xl border border-mist-200 p-3 sm:grid-cols-[1.1fr_1fr_1fr_0.8fr_0.7fr]">
                <input type="hidden" name="ruleId" value={rule.id} />
                <div><p className="text-[0.72rem] font-extrabold text-ink-900">{WEEKDAYS[rule.weekday]}</p><label className="mt-1 flex items-center gap-1.5 text-[0.66rem] font-semibold text-ink-600"><input type="checkbox" name={`active_${rule.id}`} defaultChecked={rule.active} /> Open</label></div>
                <label className={adminLabel}>Start<input type="time" name={`start_${rule.id}`} defaultValue={toTime(rule.startMinute)} className={adminInput} /></label>
                <label className={adminLabel}>End<input type="time" name={`end_${rule.id}`} defaultValue={toTime(rule.endMinute)} className={adminInput} /></label>
                <label className={adminLabel}>Buffer (min)<input type="number" min={0} max={60} name={`buffer_${rule.id}`} defaultValue={rule.bufferMinutes} className={adminInput} /></label>
                <span className="text-[0.62rem] text-ink-600/60">{rule.slotMinutes} min slots</span>
              </div>
            ))}
            <button type="submit" className={adminButton}>Save availability</button>
          </form>
        </AiPanel>

        <AiPanel title="Blocked dates & times" description="Holidays, breaks or one-off blocks. Blocked windows never offer slots.">
          <form action={addBlockedTimeAction} className="grid gap-2 sm:grid-cols-2">
            <label className={adminLabel}>Date<input type="date" name="date" required className={adminInput} /></label>
            <label className={adminLabel}>Reason<input type="text" name="reason" maxLength={200} placeholder="Holiday, lunch…" className={adminInput} /></label>
            <label className={adminLabel}>From<input type="time" name="startTime" defaultValue="09:00" className={adminInput} /></label>
            <label className={adminLabel}>To<input type="time" name="endTime" defaultValue="17:00" className={adminInput} /></label>
            <button type="submit" className={`${adminButton} sm:col-span-2`}>Add blocked time</button>
          </form>
          <ul className="mt-3 space-y-1.5">
            {blocked.length === 0 ? <li className="text-[0.72rem] text-ink-600/60">No blocked times.</li> : blocked.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-mist-200 px-3 py-2 text-[0.72rem]">
                <span className="font-semibold text-ink-800">{formatSlot(item.startsAtUtc).dateLabel} · {formatSlot(item.startsAtUtc).timeLabel} – {formatSlot(item.endsAtUtc).timeLabel}{item.reason ? ` · ${item.reason}` : ""}</span>
                <form action={deleteBlockedTimeAction}><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-[0.66rem] font-bold text-rose-700 hover:underline">Remove</button></form>
              </li>
            ))}
          </ul>
        </AiPanel>
      </div>
    </div>
  );
}
