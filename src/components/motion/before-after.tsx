"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { MoveHorizontal } from "lucide-react";

/**
 * Before/after comparison slider.
 * Pointer and keyboard operable (arrow keys move the divider), with a real
 * range input underneath so assistive tech can change the value.
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  beforeAlt,
  afterAlt,
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeAlt: string;
  afterAlt: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [position, setPosition] = useState(52);
  const [touched, setTouched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Sweep automatically until the visitor takes control.
  useEffect(() => {
    if (reduced || touched) return;
    let direction = 1;
    const timer = window.setInterval(() => {
      setPosition((value) => {
        const next = value + direction * 0.8;
        if (next >= 78) direction = -1;
        if (next <= 24) direction = 1;
        return Math.min(80, Math.max(22, next));
      });
    }, 40);
    return () => window.clearInterval(timer);
  }, [reduced, touched]);

  const setFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative aspect-[16/10] w-full select-none overflow-hidden rounded-3xl border border-mist-200 bg-mist-100"
      onPointerDown={(event) => {
        dragging.current = true;
        setTouched(true);
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        setFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        setFromClientX(event.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      {/* After (base layer) */}
      <Image src={after} alt={afterAlt} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" />

      {/* Before (clipped) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <Image src={before} alt={beforeAlt} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" />
      </div>

      {/* Labels */}
      <span className="absolute left-3 top-3 rounded-full bg-night/70 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur">
        {beforeLabel}
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-brand-600/90 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur">
        {afterLabel}
      </span>

      {/* Divider */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${position}%` }} aria-hidden>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.35)]" />
        <div className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-surface text-ink-900 shadow-lg">
          <MoveHorizontal className="h-4 w-4" />
        </div>
      </div>

      {/* Accessible control */}
      <label className="absolute inset-x-0 bottom-0 p-3">
        <span className="sr-only">Reveal the before or after image</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(position)}
          onChange={(event) => {
            setTouched(true);
            setPosition(Number(event.target.value));
          }}
          className="w-full cursor-ew-resize accent-brand-500"
        />
      </label>
    </div>
  );
}
