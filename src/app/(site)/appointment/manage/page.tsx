import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentManager } from "@/components/ai/appointment-manager";
import { getAppointmentByToken, appointmentDisplay } from "@/lib/ai-appointments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage your appointment", robots: { index: false, follow: false } };

export default async function ManageAppointmentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const appointment = getAppointmentByToken(token);
  if (!appointment) {
    return (
      <section className="bg-surface py-20"><div className="shell max-w-xl text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-950">This link is not valid</h1>
        <p className="mt-3 text-[0.9rem] text-ink-600/80">The appointment link may have expired or already been used. Call <a className="font-bold text-brand-700" href="tel:+18129940046">(812) 994-0046</a> and we&apos;ll help.</p>
        <Link href="/schedule-form" className="btn btn-primary mt-6">Book a new call</Link>
      </div></section>
    );
  }
  const display = appointmentDisplay(appointment);
  const labels = display.formatted;
  const timezone = labels.timezone;
  const duration = display.durationMinutes;
  const cancelled = String(appointment.status) === "cancelled";
  return (
    <section className="bg-surface py-14 sm:py-20"><div className="shell max-w-xl">
      <p className="eyebrow text-brand-700">Appointment</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-950">Manage your intro call</h1>
      <p className="mt-3 text-[0.92rem] text-ink-600/80">{String(appointment.name)} · {String(appointment.email)}</p>
      <div className="mt-5 rounded-2xl border border-mist-200 bg-mist-50 p-4">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/60">Current time</p>
        <p className="mt-1 text-lg font-extrabold text-ink-950">{cancelled ? "Cancelled" : `${labels.dateLabel} at ${labels.timeLabel}`}</p>
        <p className="text-[0.74rem] text-ink-600/70">{duration}-minute introductory call · {labels.timezoneLabel}</p>
        {cancelled && <p className="mt-2 text-[0.78rem] text-rose-700">This appointment has been cancelled.</p>}
      </div>
      {!cancelled && <AppointmentManager token={token} timezone={timezone} />}
      <p className="mt-6 text-[0.72rem] text-ink-600/70">Need help? Call <a className="font-bold text-brand-700" href="tel:+18129940046">(812) 994-0046</a>.</p>
    </div></section>
  );
}
