"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Lightweight first-party analytics.
 *
 * Sends only page path, title, coarse device/browser data (derived server-side),
 * UTM parameters and time-on-page. No form contents, form values, passwords,
 * patient information or raw IP are sent to the analytics endpoint.
 */

type Payload = {
  event: "pageview" | "engagement" | "exit" | "event";
  path: string;
  title?: string;
  name?: string;
  seconds?: number;
  scrollDepth?: number;
  referrer?: string;
  utm?: Record<string, string>;
  language?: string;
  timezone?: string;
  viewport?: string;
  webdriver?: boolean;
};

function send(payload: Payload) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics", blob)) return;
    }
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

function utmFromLocation(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"]) {
    const value = params.get(key);
    if (value) result[key] = value.slice(0, 120);
  }
  return result;
}

export function FirstPartyAnalytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const lastTick = useRef(0);
  const maxScroll = useRef(0);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (navigator.doNotTrack === "1" || window.localStorage.getItem("kmb-analytics-optout") === "1") return;
    if (window.location.pathname.startsWith("/admin")) return;

    const sendPageview = (path: string) => {
      if (lastPath.current === path) return;
      lastPath.current = path;
      lastTick.current = Date.now();
      maxScroll.current = Math.max(maxScroll.current, Math.round((window.scrollY + window.innerHeight) / Math.max(document.documentElement.scrollHeight, 1) * 100));
      send({
        event: "pageview",
        path,
        title: document.title,
        referrer: sentInitial.current ? undefined : document.referrer || undefined,
        utm: sentInitial.current ? undefined : utmFromLocation(),
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        webdriver: navigator.webdriver === true,
      });
      sentInitial.current = true;
    };

    const sendEngagement = (exit = false) => {
      const now = Date.now();
      const seconds = Math.max(0, Math.min(120, Math.round((now - lastTick.current) / 1000)));
      lastTick.current = now;
      const path = lastPath.current;
      if (!path) return;
      maxScroll.current = Math.max(maxScroll.current, Math.round((window.scrollY + window.innerHeight) / Math.max(document.documentElement.scrollHeight, 1) * 100));
      send({ event: exit ? "exit" : "engagement", path, seconds, scrollDepth: maxScroll.current, webdriver: navigator.webdriver === true });
      if (exit) lastPath.current = null;
    };

    sendPageview(pathname);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") sendEngagement();
    }, 10_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendEngagement(true);
      else if (lastPath.current === null) sendPageview(pathname);
    };
    const onPageHide = () => sendEngagement(true);
    const onConversion = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const name = typeof detail.event === "string" ? detail.event : "";
      if (!name) return;
      send({ event: "event", name, path: pathname, webdriver: navigator.webdriver === true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("kmb:conversion", onConversion as EventListener);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("kmb:conversion", onConversion as EventListener);
      sendEngagement(true);
    };
  }, [pathname]);

  return null;
}
