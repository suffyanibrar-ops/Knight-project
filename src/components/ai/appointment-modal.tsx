"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Check, Loader2, X } from "lucide-react";

interface Slot { startsAtUtc: number; iso: string; dateLabel: string; timeLabel: string; timezone: string; timezoneLabel: string; dateISO: string; timeISO: string }

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
];

function detectedZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_OPTIONS.some((option) => option.value === zone) ? zone : "";
  } catch { return ""; }
}
export interface BookedAppointment { id: number; startsAtUtc: number; dateLabel: string; timeLabel: string; timezone: string }

export function AppointmentModal({ onClose, onBooked }: { onClose: () => void; onBooked: (appointment: BookedAppointment) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [timezone, setTimezone] = useState(detectedZone());
  const [loading, setLoading] = useState(Boolean(detectedZone()));
  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedAppointment | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!timezone) return;
    let cancelled = false;
    fetch(`/api/ai/slots?timezone=${encodeURIComponent(timezone)}`, { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : Promise.reject(new Error("Could not load available times."))))
      .then((data: { slots?: Slot[] }) => { if (!cancelled) { setSlots(data.slots ?? []); setError(null); } })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [timezone]);

  const grouped = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    (acc[slot.dateLabel] ??= []).push(slot);
    return acc;
  }, {});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) { setError("Choose a time first."); return; }
    if (!confirmed) { setError("Please confirm the appointment details."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selected.dateISO, time: selected.timeISO, timezone, name, email, phone, organization, confirmed: true }),
      });
      const data = (await response.json()) as { ok?: boolean; appointment?: BookedAppointment; error?: string };
      if (!response.ok || !data.ok || !data.appointment) throw new Error(data.error ?? "Booking failed. Please try another time.");
      setBooked(data.appointment);
      onBooked(data.appointment);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Booking failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-night/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Book an introductory call">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-mist-200 bg-surface p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">15-minute introduction</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-ink-950">Book a call with our team</h2>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-ink-600/80">Times shown are real availability in the time zone you choose. A confirmation email is sent after booking.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close booking" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-mist-200 text-ink-600 hover:bg-mist-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {booked ? (
          <div className="mt-5 rounded-2xl border border-mint-200 bg-mint-50 p-4 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-mint-500 text-white"><Check className="h-5 w-5" /></span>
            <p className="mt-3 text-[0.9rem] font-extrabold text-ink-950">You&apos;re booked</p>
            <p className="mt-1 text-[0.8rem] text-ink-700">{booked.dateLabel} at {booked.timeLabel} ({booked.timezone})</p>
            <p className="mt-2 text-[0.74rem] text-ink-600/80">A confirmation email with reschedule and cancel options is on its way.</p>
            <button type="button" onClick={onClose} className="btn btn-primary mt-4 px-5">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70">Your time zone
                <select value={timezone} onChange={(event) => { const value = event.target.value; setTimezone(value); setSelected(null); setSlots([]); setLoading(Boolean(value)); }} className="mt-1 w-full rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-[0.8rem] font-semibold text-ink-900 outline-none focus:border-brand-400">
                  <option value="">Select your time zone…</option>
                  {TIMEZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <p className="mt-3 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70">Available times{timezone ? ` · ${slots[0]?.timezoneLabel ?? TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? ""}` : ""}</p>
              {!timezone && <p className="mt-3 rounded-xl border border-mist-200 bg-mist-50 p-3 text-[0.78rem] text-ink-600">Choose your time zone to see real availability. We won&apos;t assume one.</p>}
              {loading && timezone ? (
                <p className="mt-3 flex items-center gap-2 text-[0.78rem] text-ink-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading real availability…</p>
              ) : slots.length === 0 ? (
                <p className="mt-3 rounded-xl border border-mist-200 bg-mist-50 p-3 text-[0.78rem] text-ink-600">No online times are open right now. Call <a href="tel:+18129940046" className="font-bold text-brand-700">(812) 994-0046</a> or email us.</p>
              ) : (
                <div className="mt-2 max-h-52 space-y-3 overflow-y-auto pr-1">
                  {Object.entries(grouped).map(([date, dateSlots]) => (
                    <div key={date}>
                      <p className="text-[0.7rem] font-bold text-ink-800">{date}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {dateSlots.map((slot) => (
                          <button
                            key={slot.iso}
                            type="button"
                            onClick={() => { setSelected(slot); setError(null); }}
                            aria-pressed={selected?.iso === slot.iso}
                            className={`rounded-full border px-3 py-1.5 text-[0.72rem] font-bold transition-colors ${selected?.iso === slot.iso ? "border-brand-500 bg-brand-500 text-white" : "border-mist-200 bg-surface text-ink-700 hover:border-brand-300"}`}
                          >
                            {slot.timeLabel.replace(/\s[A-Z]{2,4}$/, "")}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="text-[0.7rem] font-bold text-ink-700 sm:col-span-2">Full name
                <input required value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" className="mt-1 w-full rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-[0.8rem] outline-none focus:border-brand-400" />
              </label>
              <label className="text-[0.7rem] font-bold text-ink-700">Business email
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} autoComplete="email" className="mt-1 w-full rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-[0.8rem] outline-none focus:border-brand-400" />
              </label>
              <label className="text-[0.7rem] font-bold text-ink-700">Phone (optional)
                <input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} autoComplete="tel" className="mt-1 w-full rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-[0.8rem] outline-none focus:border-brand-400" />
              </label>
              <label className="text-[0.7rem] font-bold text-ink-700 sm:col-span-2">Practice / organization (optional)
                <input value={organization} onChange={(event) => setOrganization(event.target.value)} maxLength={160} autoComplete="organization" className="mt-1 w-full rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-[0.8rem] outline-none focus:border-brand-400" />
              </label>
            </div>

            <label className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-ink-700">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" />
              <span>I confirm these details and understand this is a 15-minute introductory call.{selected ? ` Selected: ${selected.dateLabel} at ${selected.timeLabel}.` : ""}</span>
            </label>

            <p className="rounded-xl bg-brand-50 px-3 py-2 text-[0.66rem] leading-relaxed text-brand-900/80">
              Please don&apos;t include patient information. This booking is for business inquiries only.
            </p>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.74rem] font-semibold text-rose-700">{error}</p>}

            <button type="submit" disabled={submitting || !selected || slots.length === 0} className="btn btn-primary w-full justify-center">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              {submitting ? "Booking…" : "Confirm booking"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
