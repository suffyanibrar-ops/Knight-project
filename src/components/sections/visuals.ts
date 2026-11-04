/**
 * Central map of the generated SVG illustration library.
 *
 * These unique visuals replace the repeated stock section-*.jpg photography on
 * the marketing pages. Every file is listed once here so pages can share a
 * single, typo-safe source of truth and avoid showing the same image twice
 * within one page (the repetition the owner complained about).
 */

export type VisualName =
  | "hero-home"
  | "hero-services"
  | "hero-specialties"
  | "hero-results"
  | "hero-about"
  | "hero-contact"
  | "hero-consultation"
  | "hero-who-we-serve"
  | "hero-process"
  | "hero-insights"
  | "hero-faq"
  | "hero-compliances"
  | "service-billing"
  | "service-coding"
  | "service-ar"
  | "service-eligibility"
  | "service-credentialing"
  | "service-oon"
  | "service-rcm"
  | "results-dashboard"
  | "intake-form"
  | "team-abstract"
  | "facility-hospital"
  | "facility-private-practice"
  | "facility-healthcare-system";

/** Resolves a visual name to its public URL. */
export function visual(name: VisualName): string {
  return `/images/visuals/${name}.svg`;
}

/** Hero illustration per marketing page (one per page, never repeated on it). */
export const pageHeroVisuals = {
  services: visual("hero-services"),
  specialties: visual("hero-specialties"),
  whoWeServe: visual("hero-who-we-serve"),
  results: visual("hero-results"),
  about: visual("hero-about"),
  contact: visual("hero-contact"),
  schedule: visual("hero-consultation"),
  process: visual("hero-process"),
  insights: visual("hero-insights"),
  faq: visual("hero-faq"),
  compliance: visual("hero-compliances"),
} as const;

/**
 * Hero visual for each service detail page. The first seven use the dedicated
 * service illustrations; the rest draw on the remaining library so no two
 * service pages open with the same artwork.
 */
export const serviceVisuals: Record<string, string> = {
  "medical-billing-and-coding": visual("service-billing"),
  "accounts-receivable-management": visual("service-ar"),
  "complete-rcm-services": visual("service-rcm"),
  "credentialing-and-contracting": visual("service-credentialing"),
  "out-of-network-negotiation": visual("service-oon"),
  "eligibility-and-benefits-verification": visual("service-eligibility"),
  "prior-and-retro-authorization": visual("intake-form"),
  "complete-patient-billing": visual("service-coding"),
  "clean-up-billing": visual("results-dashboard"),
  "chart-auditing-and-drg-review": visual("team-abstract"),
  "denial-management": visual("facility-healthcare-system"),
  "claims-management": visual("facility-hospital"),
  "payment-posting": visual("facility-private-practice"),
  "contracting-and-enrollment": visual("hero-process"),
  "eft-era-edi-support": visual("hero-consultation"),
  "revenue-performance-reporting": visual("hero-faq"),
};

/**
 * Inline visual for service detail pages whose data image is one of the retired
 * section-*.jpg stock photos. Already-unique per-service photos are kept as-is.
 */
export const serviceInlineVisuals: Record<string, string> = {
  "medical-billing-and-coding": visual("service-coding"),
  "complete-rcm-services": visual("results-dashboard"),
  "prior-and-retro-authorization": visual("service-eligibility"),
  "payment-posting": visual("results-dashboard"),
  "revenue-performance-reporting": visual("team-abstract"),
};

/** The audience cards on /who-we-serve each get their own facility visual. */
export const audienceVisuals: Record<string, string> = {
  "healthcare-systems": visual("facility-healthcare-system"),
  hospitals: visual("facility-hospital"),
  "emergency-rooms": visual("hero-consultation"),
  "urgent-cares": visual("intake-form"),
  "private-practices": visual("facility-private-practice"),
};

/** Article thumbnails on /insights. */
export const articleVisuals: Record<string, string> = {
  "clean-claim-playbook": visual("service-coding"),
  "eligibility-verification-first-step": visual("service-eligibility"),
  "ar-follow-up-that-recovers-cash": visual("service-ar"),
  "out-of-network-negotiation-explained": visual("service-oon"),
  "credentialing-contracts-and-rates": visual("service-credentialing"),
  "revenue-cycle-clean-up-audit": visual("results-dashboard"),
};

/**
 * Rotating set for /specialties/[slug]. There are more specialties than visuals,
 * so assignment is by index — neighbouring specialties still show different art.
 */
export const specialtyVisuals: string[] = [
  visual("service-coding"),
  visual("service-credentialing"),
  visual("service-ar"),
  visual("service-eligibility"),
  visual("service-oon"),
  visual("team-abstract"),
  visual("intake-form"),
  visual("results-dashboard"),
];
