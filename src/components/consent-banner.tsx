"use client";

import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CONSENT_STORAGE_KEY,
  acceptAll,
  buildConsent,
  consentSummary,
  essentialOnly,
  parseConsent,
  rejectAll,
  type ConsentRecord,
} from "@/lib/consent";
import { trackConversion } from "@/lib/tracking";
import { cn } from "./ui";

/** One shared treatment: no choice is visually pushed ahead of another. */
const CHOICE = "min-h-11 justify-center rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.76rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

export const OPEN_CONSENT_EVENT = "kmb:open-consent";

/**
 * Three-choice consent banner.
 *
 * First visit: Accept all / Reject all / Essential only, with no preselected
 * optional category. The banner closes on choice and is reopened only from the
 * footer's discreet "Cookie settings" control (or the cookie-policy page).
 * There is no floating cookie button in the page viewport.
 */
export function ConsentBanner() {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState({ analytics: false, functional: false });
  const [waitingForIntro, setWaitingForIntro] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let stored: ConsentRecord | null = null;
      try {
        stored = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
      } catch {
        stored = null;
      }
      setRecord(stored);
      setCustom({
        analytics: Boolean(stored?.categories.analytics),
        functional: Boolean(stored?.categories.functional),
      });
      if (!stored) {
        // The branded intro is a full-screen layer, so a banner opened behind it
        // would be invisible. Wait for the intro to hand the page over.
        const intro = document.documentElement.dataset.intro;
        if (intro === "done" || intro === "off") setOpen(true);
        else setWaitingForIntro(true);
      }
      setReady(true);
    });

    const onOpenRequest = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, onOpenRequest);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(OPEN_CONSENT_EVENT, onOpenRequest);
    };
  }, []);

  // Reveal the first-visit banner the moment the intro finishes, with a bounded
  // fallback in case that hand-off never arrives.
  useEffect(() => {
    if (!waitingForIntro) return;
    const reveal = () => {
      setWaitingForIntro(false);
      setOpen(true);
    };
    const timer = window.setTimeout(reveal, 5000);
    window.addEventListener("kmb:intro-done", reveal, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("kmb:intro-done", reveal);
    };
  }, [waitingForIntro]);

  useEffect(() => {
    if (!ready) return;
    const state = open ? "open" : "closed";
    document.documentElement.dataset.consentBanner = state;
    window.dispatchEvent(new CustomEvent("kmb:consent-state", { detail: { open } }));
    if (open) panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, ready]);

  function persist(next: ConsentRecord, choice: "accept_all" | "reject_all" | "essential_only" | "custom"): void {
    setRecord(next);
    setOpen(false);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: the choice applies to this page view only */
    }
    trackConversion("cookie_consent_choice", {
      choice,
      analytics: next.categories.analytics ? "granted" : "denied",
      functional: next.categories.functional ? "granted" : "denied",
    });
  }

  if (!ready || !open) return null;

  const current = consentSummary(record);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[75] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="consent-title"
        aria-describedby="consent-description"
        className="pointer-events-auto mx-auto max-h-[74dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-mist-200 bg-surface p-4 shadow-[0_30px_70px_-40px_rgba(4,20,31,0.6)] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Cookie className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 id="consent-title" className="text-[0.95rem] font-extrabold tracking-tight text-ink-950">Your privacy matters</h2>
              <p id="consent-description" className="mt-1 text-[0.76rem] leading-relaxed text-ink-600">
                We use essential cookies to keep the site working. With your permission, we may also use analytics cookies to understand how visitors use Knight Medical Billing.{" "}
                <Link href="/cookie-policy" className="font-bold text-brand-700 underline">Cookie policy</Link>.
              </p>
            </div>
          </div>
          {record ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close cookie settings"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-600 hover:bg-mist-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {record ? <p className="mt-2 text-[0.66rem] font-semibold text-ink-600/70">Current choice: {current}. You can change it at any time.</p> : null}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => persist(acceptAll(), "accept_all")} className={CHOICE}>
            Accept all
          </button>
          <button type="button" onClick={() => persist(rejectAll(), "reject_all")} className={CHOICE}>
            Reject all
          </button>
          <button
            type="button"
            onClick={() => persist(essentialOnly(), "essential_only")}
            className={cn(CHOICE, "col-span-2 sm:col-span-1")}
          >
            Essential only
          </button>
        </div>

        {record ? (
          <details className="group mt-3 rounded-xl border border-mist-200 bg-mist-50/50 px-3 py-2">
            <summary className="cursor-pointer text-[0.7rem] font-bold text-ink-700">Manage individual preferences</summary>
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 text-[0.72rem] text-ink-800">
                <input type="checkbox" checked={custom.analytics} onChange={(event) => setCustom({ ...custom, analytics: event.target.checked })} className="mt-0.5 h-4 w-4" />
                <span><strong>Analytics.</strong> Anonymous page views and referrers, stored on our own server.</span>
              </label>
              <label className="flex items-start gap-2 text-[0.72rem] text-ink-800">
                <input type="checkbox" checked={custom.functional} onChange={(event) => setCustom({ ...custom, functional: event.target.checked })} className="mt-0.5 h-4 w-4" />
                <span><strong>Functional.</strong> Remembers choices such as a dismissed offer so it does not repeat.</span>
              </label>
              <p className="text-[0.66rem] text-ink-600/70">Marketing cookies are not used on this site.</p>
              <button
                type="button"
                onClick={() => persist(buildConsent({ decision: "custom", analytics: custom.analytics, functional: custom.functional }), "custom")}
                className="min-h-9 rounded-full border border-brand-200 bg-surface px-3 py-1.5 text-[0.7rem] font-bold text-brand-700 hover:border-brand-400"
              >
                Save preferences
              </button>
            </div>
          </details>
        ) : (
          <p className="mt-2 text-[0.62rem] text-ink-600/60">Essential storage is always on. Optional categories stay off until you choose.</p>
        )}
      </div>
    </div>
  );
}
