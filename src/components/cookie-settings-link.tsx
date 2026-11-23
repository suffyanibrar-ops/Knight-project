"use client";

import { OPEN_CONSENT_EVENT } from "@/components/consent-banner";

/** Discreet consent-management entry point. No persistent floating control. */
export function CookieSettingsLink({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className || "text-white/65 transition-colors hover:text-white"}
    >
      Cookie settings
    </button>
  );
}
