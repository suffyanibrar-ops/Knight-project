"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { site } from "@/lib/site";

/**
 * Branded first-visit intro: five deliberate stages — brand emergence, logo
 * assembly, abstract revenue-flow activity, a quiet readiness line, then a
 * clip-path hand-off into the homepage hero.
 *
 * The sequence runs around 3.4s on a first visit and around 1.3s when returning.
 * It is tied to the actual document load state rather than an arbitrary blank
 * delay: if the page is still loading the intro remains useful, and if the page
 * is ready the remaining visual stages complete gracefully. A hard safety exit,
 * free-skip control and CSS-only no-JS fallback guarantee the site is usable.
 */
const FLOW_NODES = [
  { label: "Claims", tone: "brand" },
  { label: "Processing", tone: "brand" },
  { label: "A/R", tone: "mint" },
  { label: "Payments", tone: "mint" },
];

export function SiteIntro() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const skipRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const root = document.documentElement;
    const mode = root.dataset.intro;
    if (mode !== "full" && mode !== "brief") return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const full = mode === "full";
    overlay.dataset.mode = mode;
    overlay.classList.add("is-ready");
    root.classList.add("intro-open");

    const timers: number[] = [];
    let exitStarted = false;
    let finalized = false;
    let pageReady = document.readyState === "complete";

    const later = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      timers.push(id);
      return id;
    };

    const finalize = () => {
      if (finalized) return;
      finalized = true;
      try { window.sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* storage blocked */ }
      root.classList.remove("intro-open");
      root.dataset.intro = "done";
      overlay.classList.add("is-done");
    };

    const revealHero = () => {
      const hero = document.querySelector<HTMLElement>("[data-hero-reveal]");
      hero?.classList.add("is-intro-revealing");
      const rail = document.querySelector<HTMLElement>("[data-hero-flow-line]");
      rail?.classList.add("is-live");
    };

    const markReady = () => {
      pageReady = true;
      if (exitStarted) return;
      overlay.classList.add("is-ready");
      overlay.classList.remove("is-waiting");
      if (statusRef.current) statusRef.current.textContent = "Ready";
    };

    const beginExit = (skipped = false) => {
      if (exitStarted) return;
      exitStarted = true;
      try { revealHero(); } catch { /* hero reveal is optional */ }
      overlay.classList.add("is-leaving");
      // Schedule the release before any optional Web Animation work, so a morph
      // failure can never trap the visitor on the overlay.
      later(finalize, skipped ? 300 : full ? 760 : 340);

      try {
        const logo = brandRef.current;
        const flow = flowRef.current;

        if (full && !skipped) {
          // The intro flow line lands on the homepage rail where possible.
          const target = document.querySelector<HTMLElement>("[data-hero-flow-line]");
          const canMorph = window.innerWidth >= 768;
          if (flow && target && canMorph) {
            const from = flow.getBoundingClientRect();
            const to = target.getBoundingClientRect();
            const offscreen = to.top < 0 || to.bottom > window.innerHeight + 1;
            if (!offscreen && from.width > 0) {
              const dx = to.left - from.left;
              const dy = to.top - from.top;
              const scale = Math.max(0.2, to.width / from.width);
              flow.animate(
                [
                  { transform: "translate3d(0, 0, 0) scaleX(1)", opacity: 1 },
                  { transform: `translate3d(${dx}px, ${dy}px, 0) scaleX(${scale})`, opacity: 0 },
                ],
                { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
              );
            }
          }

          // The wordmark moves toward the header lockup and dissolves.
          const headerLogo = document.querySelector<HTMLElement>('header a[aria-label*="home"]');
          if (logo && headerLogo && window.innerWidth >= 768) {
            const from = logo.getBoundingClientRect();
            const to = headerLogo.getBoundingClientRect();
            if (from.width > 0) {
              const scale = Math.max(0.4, Math.min(1, to.width / from.width));
              const dx = to.left - from.left;
              const dy = to.top - from.top;
              logo.animate(
                [
                  { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1, filter: "blur(0px)" },
                  { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, opacity: 0.2, filter: "blur(1.5px)" },
                ],
                { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
              );
            }
          }
        }
      } catch {
        // Optional visual morph failed; the scheduled finalize still releases.
      }
    };

    skipRef.current = () => beginExit(true);

    // Schedule the global safety release before any animation or event setup.
    // If something below throws, this timer still releases the website.
    later(() => beginExit(true), full ? 4200 : 1600);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") beginExit(true);
    };
    const onVisibility = () => {
      // Background tabs throttle timers; don't make a returning visitor wait.
      if (document.visibilityState === "hidden") beginExit(true);
    };
    const onLoad = () => {
      pageReady = true;
      if (overlay.classList.contains("is-progress")) markReady();
    };
    const onError = () => beginExit(true);

    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("load", onLoad, { once: true });
    window.addEventListener("error", onError, { once: true });

    try {
      // Stage 1: precise brand emergence with a blur-to-sharp reveal.
      window.requestAnimationFrame(() => overlay.classList.add("is-entered"));

      if (full) {
        // Stage 2: mark assembly, then Stage 3: abstract data flow.
        later(() => overlay.classList.add("is-marking"), 560);
        later(() => overlay.classList.add("is-flow"), 1250);
        // Stage 4: readiness line. It completes when the real document is ready;
        // until then it uses a calm indeterminate state — never a fake percent.
        later(() => {
          overlay.classList.add("is-progress");
          if (pageReady) markReady();
          else later(() => overlay.classList.add("is-waiting"), 620);
        }, 1950);
      } else {
        // Returning visitors get a compact 1.3s version of the same identity.
        overlay.classList.add("is-flow", "is-progress", "is-ready");
        if (statusRef.current) statusRef.current.textContent = "Ready";
      }

      const startedAt = performance.now();
      const tick = () => {
        if (exitStarted) return;
        const elapsed = performance.now() - startedAt;
        if (!full) {
          // Keep return visits brief, but allow the compact reveal to play.
          if (elapsed >= 1020 || performance.now() >= 1400) beginExit();
          else later(tick, 40);
          return;
        }
        const ready = document.readyState === "complete";
        // Normal first visit: 2700ms of visible sequence + 760ms hand-off.
        // If content is slower, wait naturally up to the bounded safety point.
        if ((ready && elapsed >= 2700) || elapsed >= 3300 || performance.now() >= 3500) beginExit();
        else later(tick, 60);
      };
      later(tick, 60);
    } catch {
      beginExit(true);
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("error", onError);
      root.classList.remove("intro-open");
      if (!exitStarted) root.dataset.intro = "done";
    };
    // This renders once per full page load; the intro never replays on client navigation.
  }, []);

  return (
    <div
      ref={overlayRef}
      className="site-intro"
      data-site-intro
      role="presentation"
      aria-label="Knight Medical Billing introduction"
    >
      <div aria-hidden="true" className="site-intro__atmosphere" />
      <div className="site-intro__content">
        <div ref={brandRef} className="site-intro__brand">
          <span className="site-intro__mark">
            <Image src={site.logoWhite} alt="" width={64} height={64} priority style={{ width: 64, height: 64 }} />
          </span>
          <span className="site-intro__wordmark">
            <span className="site-intro__name">Knight</span>
            <span className="site-intro__descriptor">Medical Billing</span>
          </span>
        </div>

        <div ref={flowRef} className="site-intro__flow" aria-hidden="true">
          <span className="site-intro__line" />
          <span className="site-intro__flow-scan" />
          {FLOW_NODES.map((node, index) => (
            <span
              key={node.label}
              className={`site-intro__node site-intro__node--${node.tone}`}
              style={{ left: `${(index / (FLOW_NODES.length - 1)) * 100}%`, animationDelay: `${1500 + index * 70}ms` }}
            />
          ))}
        </div>

        <p className="site-intro__tagline">Revenue cycle, precisely managed.</p>

        <div className="site-intro__progress" aria-hidden="true">
          <span className="site-intro__progress-track">
            <span className="site-intro__progress-fill" />
          </span>
          <span ref={statusRef} className="site-intro__status">Preparing your experience</span>
        </div>
      </div>

      <button
        type="button"
        className="site-intro__skip"
        onClick={() => skipRef.current()}
        aria-label="Skip introduction and view the website"
      >
        Skip intro
      </button>
    </div>
  );
}
