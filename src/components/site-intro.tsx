"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { site } from "@/lib/site";

/**
 * Branded first-visit intro: navy field, calm wordmark reveal, a single hairline
 * "revenue flow" with four quiet nodes, then a morph into the homepage flow rail.
 *
 * Design constraints:
 *  - only transform/opacity are animated (compositor-friendly, no layout shift)
 *  - the overlay is server-rendered so there is no flash, but CSS auto-dismisses
 *    it if JavaScript never runs
 *  - sessionStorage makes return visits a brief fade; reduced motion skips it
 *  - a visible Skip control and hard safety timeout mean the site can never be
 *    held hostage by the intro
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
    const later = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      timers.push(id);
      return id;
    };

    const finalize = () => {
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

    const beginExit = (skipped = false) => {
      if (exitStarted) return;
      exitStarted = true;
      revealHero();
      overlay.classList.add("is-leaving");
      const logo = brandRef.current;
      const flow = flowRef.current;

      if (full && !skipped) {
        // The flow rail only exists in the homepage hero; if it is off-screen
        // (mobile / short viewport) the line simply fades with the overlay.
        const target = document.querySelector<HTMLElement>("[data-hero-flow-line]");
        const canMorph = typeof window !== "undefined" && window.innerWidth >= 768;
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
              { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
            );
          }
        }
        // Move the wordmark toward the header lockup, then dissolve.
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
                { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
                { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, opacity: 0.2 },
              ],
              { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
            );
          }
        }
      }

      later(finalize, skipped ? 280 : full ? 600 : 320);
    };

    skipRef.current = () => beginExit(true);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") beginExit(true);
    };
    const onVisibility = () => {
      // Background tabs throttle timers; don't make a returning visitor wait.
      if (document.visibilityState === "hidden") beginExit(true);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);

    // Stage 1: calm logo reveal.
    window.requestAnimationFrame(() => overlay.classList.add("is-entered"));
    // Stage 2: flow line + nodes. Brief visits skip the theatre.
    if (full) later(() => overlay.classList.add("is-flow"), 220);
    else overlay.classList.add("is-flow");

    // Stage 3: wait for the page to be ready, but never loop or hold for long.
    const startedAt = performance.now();
    const tick = () => {
      if (exitStarted) return;
      const elapsed = performance.now() - startedAt;
      if (!full) {
        if (elapsed >= 220) beginExit();
        else later(tick, 40);
        return;
      }
      const ready = document.readyState === "complete";
      if ((ready && elapsed >= 960) || elapsed >= 1900) beginExit();
      else later(tick, 60);
    };
    later(tick, 60);

    // Hard safety: even if something throws above, the overlay releases.
    later(() => beginExit(true), full ? 2800 : 1200);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
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
            <Image src={site.logoWhite} alt="" width={46} height={46} priority style={{ width: 46, height: 46 }} />
          </span>
          <span className="site-intro__wordmark">
            <span className="site-intro__name">Knight</span>
            <span className="site-intro__descriptor">Medical Billing</span>
          </span>
        </div>

        <div ref={flowRef} className="site-intro__flow" aria-hidden="true">
          <span className="site-intro__line" />
          {FLOW_NODES.map((node, index) => (
            <span
              key={node.label}
              className={`site-intro__node site-intro__node--${node.tone}`}
              style={{ left: `${(index / (FLOW_NODES.length - 1)) * 100}%`, animationDelay: `${320 + index * 60}ms` }}
            />
          ))}
        </div>

        <p className="site-intro__tagline">Revenue cycle, precisely managed.</p>
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
