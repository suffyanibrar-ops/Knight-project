/**
 * Client-side conversion hook. Kept framework-free so any form can call it and
 * the analytics layer (or a future tag manager) can listen without coupling.
 */
export type ConversionName =
  | "generate_lead"
  | "consultation_request"
  | "newsletter_signup"
  | "roi_estimate"
  | "phone_click"
  | "email_click"
  | "revenue_diagnostic_started"
  | "revenue_diagnostic_completed"
  | "fit_assessment_started"
  | "fit_assessment_completed"
  | "ai_lead"
  | "ai_handoff"
  | "ai_appointment_started"
  | "ai_appointment_confirmed"
  | "ai_appointment_cancelled"
  | "ai_appointment_rescheduled"
  | "service_cta"
  | "switching_page_cta"
  | "calculator_started"
  | "calculator_completed";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"] as const;
let firstTouch: Record<string, string> | null = null;

/** Store first-touch UTM parameters for the session; never include form/PHI data. */
function readUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  if (firstTouch) return firstTouch;
  const params = new URLSearchParams(window.location.search);
  const fromUrl: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) fromUrl[key] = value.slice(0, 120);
  }
  if (Object.keys(fromUrl).length) {
    firstTouch = fromUrl;
    try { sessionStorage.setItem("kmb-utm", JSON.stringify(fromUrl)); } catch { /* storage blocked */ }
    return firstTouch;
  }
  try {
    const stored = sessionStorage.getItem("kmb-utm");
    if (stored) firstTouch = JSON.parse(stored) as Record<string, string>;
  } catch { /* storage blocked */ }
  return firstTouch ?? {};
}

export function trackConversion(event: ConversionName, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kmb:conversion", { detail: { event, ...readUtm(), ...params } }));
}
