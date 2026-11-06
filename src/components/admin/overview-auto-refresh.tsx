"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh the server-rendered command center once a minute, but only while visible. */
export function OverviewAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
