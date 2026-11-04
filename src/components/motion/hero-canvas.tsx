"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * Interactive hero background.
 *
 * A lightweight canvas "claim flow": nodes drift slowly and connect to their
 * neighbours, brightening under the pointer. It reads as a connected revenue
 * cycle rather than decoration, and it never competes with the headline —
 * opacity is capped and the layer is pointer-transparent except for tracking.
 *
 * Performance guards:
 *  - devicePixelRatio capped at 2
 *  - node count scales with viewport area
 *  - animation paused when the tab is hidden or the element is off-screen
 *  - fully static single frame under prefers-reduced-motion
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    const pointer = { x: -9999, y: -9999, active: false };

    type Node = { x: number; y: number; vx: number; vy: number; r: number; hue: number };
    let nodes: Node[] = [];

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ~1 node per 26,000 px², clamped so phones stay light.
      const count = Math.max(14, Math.min(46, Math.round((width * height) / 26000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.4 + Math.random() * 1.8,
        hue: Math.random() > 0.55 ? 190 : 165,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      // Connections first, so nodes sit on top.
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 148) continue;
          const opacity = (1 - distance / 148) * 0.2;
          context.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 72%, 52%, ${opacity})`;
          context.lineWidth = 0.7;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      for (const node of nodes) {
        // Pointer proximity lifts brightness and radius slightly.
        let lift = 0;
        if (pointer.active) {
          const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
          if (distance < 170) lift = (1 - distance / 170) * 0.65;
        }
        context.beginPath();
        context.arc(node.x, node.y, node.r + lift * 1.6, 0, Math.PI * 2);
        context.fillStyle = `hsla(${node.hue}, 78%, ${52 + lift * 18}%, ${0.34 + lift * 0.5})`;
        context.fill();
      }
    };

    const step = () => {
      if (!visible) {
        frame = 0;
        return;
      }
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        // Soft wrap keeps motion continuous without bouncing artefacts.
        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;
      }
      draw();
      frame = window.requestAnimationFrame(step);
    };

    const start = () => {
      if (reduced) {
        draw();
        return;
      }
      if (!frame) frame = window.requestAnimationFrame(step);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        start();
      }
    };

    build();
    start();

    const resizeObserver = new ResizeObserver(() => {
      build();
      draw();
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      role="presentation"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
