"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, X } from "lucide-react";

interface Slot { startsAtUtc: number; iso: string; dateLabel: string; timeLabel: string }

export function AppointmentManager({ token }: { token: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/slots", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Could not load times."))))
      .then((data: { slots?: Slot[] }) => { if (!cancelled) setSlots(data.slots ?? []); })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function act(action: "cancel" | "reschedule", startsAtUtc?: number) {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/ai/appointments/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, startsAtUtc }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; dateLabel?: string; timeLabel?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not update the appointment.");
      setMessage(action === "cancel" ? "Your appointment has been cancelled." : `Moved to ${data.dateLabel} at ${data.timeLabel}. A confirmation email is on its way.`);
      setShowSlots(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update the appointment.");
    } finally {
      setBusy(null);
    }
  }

  if (message) {
    return (
      <div className="mt-5 rounded-2xl border border-mint-200 bg-mint-50 p-4">
        <p className="flex items-center gap-2 text-[0.86rem] font-extrabold text-mint-800"><Check className="h-4 w-4" /> {message}</p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.76rem] font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowSlots((value) => !value)} className="btn btn-primary">
          <CalendarClock className="h-4 w-4" /> {showSlots ? "Hide times" : "Reschedule"}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => { if (window.confirm("Cancel this appointment?")) void act("cancel"); }} className="btn btn-light border-rose-200 text-rose-700">
          {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Cancel appointment
        </button>
      </div>
      {showSlots && (
        <div className="rounded-2xl border border-mist-200 p-3">
          {loading ? <p className="flex items-center gap-2 text-[0.78rem] text-ink-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading real availability…</p> : slots.length === 0 ? <p className="text-[0.78rem] text-ink-600">No online times are open. Please call us.</p> : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {slots.slice(0, 24).map((slot) => (
                <button key={slot.iso} type="button" disabled={busy !== null} onClick={() => void act("reschedule", slot.startsAtUtc)} className="flex w-full items-center justify-between rounded-xl border border-mist-200 px-3 py-2 text-left text-[0.78rem] font-semibold text-ink-800 hover:border-brand-400">
                  <span>{slot.dateLabel} · {slot.timeLabel}</span>
                  {busy === "reschedule" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-[0.68rem] font-bold text-brand-700">Choose</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
