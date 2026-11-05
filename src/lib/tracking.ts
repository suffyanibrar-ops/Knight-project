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
  | "email_click";

export function trackConversion(event: ConversionName, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kmb:conversion", { detail: { event, ...params } }));
}
