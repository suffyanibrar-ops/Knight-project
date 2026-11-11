"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePointerFine, usePrefersReducedMotion } from "@/lib/motion";

/**
 * Section-level ambient motion.
 *
 * This is a single, reusable visual system. It uses CSS gradients, transforms
 * and lightweight SVG paths only — no canvas, no WebGL and no particle count
 * per section. The pointer light is desktop-only, caps at one rAF per frame,
 * and stops entirely when the section is off-screen or reduced motion is on.
 */
export type AmbientVariant = "hero" | "services" | "tension" | "results" | "cta" | "quiet";

export function AmbientField({
  variant = "quiet",
  intensity = 0.7,
  className,
}: {
  variant?: AmbientVariant;
  intensity?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const reduced = usePrefersReducedMotion();
  const finePointer = usePointerFine(1024);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !finePointer || reduced) return;
    let frame = 0;
    let clientX = 0;
    let clientY = 0;

    // Read layout once per animation frame, never inside the pointer event.
    // The previous version called getBoundingClientRect() for every move and
    // forced synchronous layout before the visual update.
    const apply = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
      node.style.setProperty("--ambient-x", `${((clientX - rect.left) / rect.width) * 100}%`);
      node.style.setProperty("--ambient-y", `${((clientY - rect.top) / rect.height) * 100}%`);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (node.dataset.ambientVisible !== "true") return;
      clientX = event.clientX;
      clientY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [finePointer, reduced]);

  return (
    <div
      ref={ref}
      aria-hidden
      data-ambient={variant}
      data-ambient-visible={visible ? "true" : "false"}
      data-reduced={reduced ? "true" : "false"}
      className={cn("ambient-field", className)}
      style={{ opacity: intensity }}
    >
      <div className="ambient-field__wash" />
      {variant === "hero" && (
        <>
          <div className="ambient-field__aurora ambient-field__aurora--a ambient-animated" />
          <div className="ambient-field__aurora ambient-field__aurora--b ambient-animated" />
          <div className="ambient-field__hero-sweep ambient-animated" />
        </>
      )}
      {variant === "services" && (
        <>
          <div className="ambient-field__direction" />
          <svg className="ambient-field__lines" viewBox="0 0 1200 700" preserveAspectRatio="none" focusable="false">
            <defs>
              <linearGradient id="ambient-service-line" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0e83ab" stopOpacity="0" />
                <stop offset="0.5" stopColor="#0e83ab" stopOpacity="0.34" />
                <stop offset="1" stopColor="#5ec27a" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[92, 242, 392, 542].map((y, index) => (
              <path key={y} className="ambient-flow-line ambient-animated" style={{ animationDelay: `${index * -4}s` }} d={`M-80 ${y} C 220 ${y - 55}, 470 ${y + 42}, 720 ${y - 8} S 1040 ${y + 55}, 1280 ${y - 20}`} fill="none" stroke="url(#ambient-service-line)" strokeWidth="1" />
            ))}
          </svg>
        </>
      )}
      {variant === "tension" && (
        <svg className="ambient-field__lines" viewBox="0 0 1200 600" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id="ambient-tension-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0e83ab" stopOpacity="0" />
              <stop offset="0.45" stopColor="#0e83ab" stopOpacity="0.4" />
              <stop offset="0.72" stopColor="#5ec27a" stopOpacity="0.35" />
              <stop offset="1" stopColor="#5ec27a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="ambient-dash-line ambient-animated" d="M-40 155 C 180 120, 250 220, 430 165 S 570 130, 660 190" fill="none" stroke="url(#ambient-tension-line)" strokeWidth="1.2" strokeDasharray="16 22" />
          <path className="ambient-dash-line ambient-animated" style={{ animationDelay: "-5s" }} d="M1260 405 C 1020 360, 890 470, 720 410 S 560 350, 390 430" fill="none" stroke="url(#ambient-tension-line)" strokeWidth="1.2" strokeDasharray="7 18" />
          <path className="ambient-dash-line ambient-animated" style={{ animationDelay: "-2s" }} d="M605 95 C 640 160, 585 235, 632 305 S 590 410, 630 500" fill="none" stroke="url(#ambient-tension-line)" strokeWidth="0.8" strokeDasharray="3 16" />
          <circle className="ambient-node ambient-animated" cx="660" cy="190" r="2.5" fill="#0e83ab" fillOpacity="0.55" />
          <circle className="ambient-node ambient-animated" style={{ animationDelay: "-3s" }} cx="390" cy="430" r="2" fill="#5ec27a" fillOpacity="0.45" />
        </svg>
      )}
      {variant === "results" && (
        <>
          <div className="ambient-field__result-glow ambient-animated" />
          <div className="ambient-field__rings">
            <span className="ambient-ring ambient-animated" />
            <span className="ambient-ring ambient-field__ring--second ambient-animated" />
            <span className="ambient-ring ambient-field__ring--third ambient-animated" />
          </div>
          <div className="ambient-field__rise ambient-animated" />
        </>
      )}
      {variant === "cta" && (
        <>
          <div className="ambient-field__cta-glow" />
          <div className="ambient-field__cta-arc ambient-animated" />
          <div className="ambient-field__cta-arc ambient-field__cta-arc--two ambient-animated" />
        </>
      )}
      {variant === "quiet" && <div className="ambient-field__quiet-light" />}
    </div>
  );
}
