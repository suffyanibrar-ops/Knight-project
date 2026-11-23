"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONSENT_STORAGE_KEY, parseConsent, type ConsentRecord } from "@/lib/consent";
import {
  EMPTY_OFFER_STATE,
  OFFER_SESSION_KEY,
  OFFER_STORAGE_KEY,
  evaluateOffer,
  intentLevel,
  offerForPath,
  parseOfferSession,
  parseOfferState,
  recordConverted,
  recordOfferDismissed,
  offerPersistenceAllowed,
  recordOfferShown,
  type ConversionOffer,
  type OfferChannel,
  type OfferState,
} from "@/lib/conversion-offers";
import { trackConversion } from "@/lib/tracking";

/**
 * The only promotional interruption on the public site.
 *
 * It shows at most one offer per session, only after meaningful engagement, and
 * never while consent is unresolved, a form is active or another dialog is open.
 * There is no timer that fires just because a visitor loaded a page.
 */
const CONVERTED_EVENTS = new Set(["lead_form_submit", "generate_lead", "consultation_request", "ai_appointment_confirmed"]);

function readConsent(): ConsentRecord | null {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * In-memory frequency state.
 *
 * Offering needs no optional storage: when functional consent is absent the
 * same limits run against this module-level memory for the page session and
 * nothing is written to disk. The public layout keeps this component mounted
 * across client navigations, so the session rules survive route changes.
 */
const memory: { state: OfferState; session: { pagesViewed: number; shownThisSession: string[] } } = {
  state: EMPTY_OFFER_STATE,
  session: { pagesViewed: 0, shownThisSession: [] },
};

function readStoredOfferState(): OfferState {
  try {
    return parseOfferState(window.localStorage.getItem(OFFER_STORAGE_KEY)) ?? EMPTY_OFFER_STATE;
  } catch {
    return EMPTY_OFFER_STATE;
  }
}

function readStoredSession(): { pagesViewed: number; shownThisSession: string[] } {
  try {
    return parseOfferSession(window.sessionStorage.getItem(OFFER_SESSION_KEY));
  } catch {
    return { pagesViewed: 0, shownThisSession: [] };
  }
}

/** Persisted state is only read when functional consent allows remembering it. */
function readOfferState(persist: boolean): OfferState {
  return persist ? readStoredOfferState() : memory.state;
}

function saveOfferState(state: OfferState, persist: boolean): void {
  if (!persist) {
    memory.state = state;
    return;
  }
  memory.state = state;
  try {
    window.localStorage.setItem(OFFER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: the in-memory copy still prevents repeats this session */
  }
}

function readSession(persist: boolean): { pagesViewed: number; shownThisSession: string[] } {
  const stored = persist ? readStoredSession() : { pagesViewed: 0, shownThisSession: [] as string[] };
  return {
    pagesViewed: Math.max(stored.pagesViewed, memory.session.pagesViewed),
    shownThisSession: Array.from(new Set([...stored.shownThisSession, ...memory.session.shownThisSession])),
  };
}

function saveSession(session: { pagesViewed: number; shownThisSession: string[] }, persist: boolean): void {
  memory.session.pagesViewed = Math.max(memory.session.pagesViewed, session.pagesViewed);
  memory.session.shownThisSession = Array.from(new Set([...memory.session.shownThisSession, ...session.shownThisSession]));
  if (!persist) return;
  try {
    window.sessionStorage.setItem(OFFER_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function ConversionOffer() {
  const pathname = usePathname();
  const offer = useMemo(() => offerForPath(pathname), [pathname]);
  const [visibleFor, setVisibleFor] = useState<string | null>(null);
  const [channel, setChannel] = useState<OfferChannel>("exit");
  const visible = visibleFor === pathname;

  const pageStartedAt = useRef(0);
  const maxScroll = useRef(0);
  const pagesViewed = useRef(1);
  const ctaInteracted = useRef(false);
  const formActive = useRef(false);
  const dialogOpen = useRef(false);
  const shownThisSession = useRef<string[]>([]);
  const lastAttempt = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const openTracked = useRef(false);
  const countedRoute = useRef(false);
  const dismissRef = useRef<(method: string) => void>(() => undefined);

  const tryShow = useCallback((nextChannel: OfferChannel) => {
    if (!offer || dialogOpen.current) return;
    const now = Date.now();
    if (now - lastAttempt.current < 3000) return;
    lastAttempt.current = now;
    const persist = offerPersistenceAllowed(readConsent());
    const state = readOfferState(persist);
    // The branded intro owns the viewport; an offer rendered behind it would be
    // invisible yet counted, so nothing is evaluated until it hands over.
    const intro = document.documentElement.dataset.intro;
    if (intro === "full" || intro === "brief") return;
    const consentOpen = document.documentElement.dataset.consentBanner === "open";
    const modalOpen = Boolean(document.querySelector('[role="dialog"]'));
    const activeForm = formActive.current || Boolean(document.activeElement?.closest("form"));
    if (!pageStartedAt.current) pageStartedAt.current = now;
    const secondsOnPage = Math.max(0, Math.round((now - pageStartedAt.current) / 1000));
    const sessionShown = shownThisSession.current;
    const decision = evaluateOffer({
      offer,
      channel: nextChannel,
      isMobile: window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768,
      intent: intentLevel({
        pagesViewed: pagesViewed.current,
        secondsOnPage,
        maxScroll: maxScroll.current,
        highIntentPath: offer.highIntent,
        returning: Boolean(state.shown),
        ctaInteracted: ctaInteracted.current,
      }),
      secondsOnPage,
      maxScroll: maxScroll.current,
      consentOpen,
      modalOpen,
      formActive: activeForm,
      state,
      shownThisSession: sessionShown,
      now,
    });
    if (!decision.show) return;

    dialogOpen.current = true;
    setChannel(nextChannel);
    setVisibleFor(pathname);
    saveOfferState(recordOfferShown(state, now), persist);
    shownThisSession.current = [...sessionShown, offer.id];
    saveSession({ pagesViewed: pagesViewed.current, shownThisSession: shownThisSession.current }, persist);
    openTracked.current = false;
    trackConversion("offer_impression", { offer: offer.id, offerType: offer.type, channel: nextChannel });
  }, [offer, pathname]);

  // Route lifecycle: count the page, reset engagement, hide a stale offer.
  useEffect(() => {
    const persist = offerPersistenceAllowed(readConsent());
    const session = readSession(persist);
    if (countedRoute.current) {
      pagesViewed.current += 1;
    } else {
      pagesViewed.current = pathname === "/" ? Math.max(1, session.pagesViewed) : session.pagesViewed + 1;
      countedRoute.current = true;
    }
    shownThisSession.current = session.shownThisSession;
    saveSession({ pagesViewed: pagesViewed.current, shownThisSession: session.shownThisSession }, persist);
    pageStartedAt.current = Date.now();
    maxScroll.current = 0;
    lastAttempt.current = 0;
    dialogOpen.current = false;
  }, [pathname]);

  // Scroll depth and form/exit signals. All listeners are passive or cleaned up.
  useEffect(() => {
    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      const depth = Math.round(((window.scrollY + window.innerHeight) / Math.max(document.documentElement.scrollHeight, 1)) * 100);
      maxScroll.current = Math.max(maxScroll.current, Math.min(100, depth));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScroll);
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("form")) formActive.current = true;
    };
    const onSubmit = () => {
      formActive.current = true;
    };
    const onConversion = (event: Event) => {
      const name = (event as CustomEvent<{ event?: unknown }>).detail?.event;
      if (typeof name !== "string" || !CONVERTED_EVENTS.has(name)) return;
      const persist = offerPersistenceAllowed(readConsent());
      saveOfferState(recordConverted(readOfferState(persist)), persist);
      setVisibleFor(null);
      dialogOpen.current = false;
    };
    const onConsentState = (event: Event) => {
      const open = Boolean((event as CustomEvent<{ open?: unknown }>).detail?.open);
      if (open && dialogOpen.current) {
        setVisibleFor(null);
        dialogOpen.current = false;
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('a[href*="schedule-form"], a[href*="contact"], a[href*="our-process"]')) {
        ctaInteracted.current = true;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!dialogOpen.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismissRef.current("escape");
      }
      if (event.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("kmb:conversion", onConversion as EventListener);
    window.addEventListener("kmb:consent-state", onConsentState as EventListener);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("kmb:conversion", onConversion as EventListener);
      window.removeEventListener("kmb:consent-state", onConsentState as EventListener);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  // Desktop exit intent only. Mobile never fakes a mouse exit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches || window.innerWidth < 768) return;
    const onMouseOut = (event: MouseEvent) => {
      // Browsers report a null relatedTarget when the pointer leaves the
      // document; clientY near 0 means it left through the top edge.
      if (event.relatedTarget) return;
      if (event.buttons !== 0) return;
      if (document.visibilityState !== "visible") return;
      if (event.clientY > 8) return;
      tryShow("exit");
    };
    document.addEventListener("mouseout", onMouseOut, { capture: true });
    return () => document.removeEventListener("mouseout", onMouseOut, { capture: true });
  }, [tryShow]);

  // High-intent pages may surface one offer after real dwell + scroll depth.
  useEffect(() => {
    if (!offer?.channels.includes("dwell")) return;
    const timer = window.setInterval(() => tryShow("dwell"), 10_000);
    return () => window.clearInterval(timer);
  }, [offer, tryShow]);

  useEffect(() => {
    if (!visible) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      restoreFocus.current?.focus();
    };
  }, [visible]);

  useEffect(() => {
    dismissRef.current = (method: string) => {
      if (!offer) return;
      trackConversion("offer_dismiss", { offer: offer.id, offerType: offer.type, channel, method });
      const persist = offerPersistenceAllowed(readConsent());
      saveOfferState(recordOfferDismissed(readOfferState(persist), offer.id), persist);
      setVisibleFor(null);
      dialogOpen.current = false;
    };
  }, [offer, channel]);

  function markOpen(): void {
    if (openTracked.current || !offer) return;
    openTracked.current = true;
    trackConversion("offer_open", { offer: offer.id, offerType: offer.type, channel });
  }

  if (!visible || !offer) return null;

  return (
    <div className={`fixed inset-x-2 bottom-[calc(5.1rem+env(safe-area-inset-bottom))] z-[70] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[24rem] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200`}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-offer-title"
        aria-describedby="conversion-offer-body"
        onPointerDown={markOpen}
        onKeyDownCapture={markOpen}
        className="relative rounded-2xl border border-mist-200 bg-surface p-4 shadow-[0_30px_70px_-40px_rgba(4,20,31,0.65)] sm:p-5"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => dismissRef.current("close_button")}
          aria-label="Close this offer"
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-ink-600 transition-colors hover:bg-mist-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="pr-8 text-[0.58rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">{offer.label}</p>
        <h2 id="conversion-offer-title" className="mt-1.5 pr-8 text-[1.02rem] font-extrabold leading-snug tracking-tight text-ink-950">
          {offer.headline}
        </h2>
        <p id="conversion-offer-body" className="mt-2 text-[0.8rem] leading-relaxed text-ink-600/85">
          {offer.body}
        </p>
        <Link
          href={offer.ctaHref}
          onClick={() => trackConversion("offer_cta_click", { offer: offer.id, offerType: offer.type, channel })}
          className="btn btn-primary mt-4 min-h-11 w-full justify-center gap-2 text-[0.8rem]"
        >
          {offer.ctaLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <p className="mt-2 text-center text-[0.6rem] text-ink-600/55">No prepayment · No obligation</p>
      </div>
    </div>
  );
}
