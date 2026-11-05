/**
 * Placement map for the site's licensed photography.
 *
 * The previous abstract SVG illustrations were replaced with Pexels photography
 * (see `src/lib/photos.ts` for provenance and licensing). Each page/section maps
 * to a specific photograph, and no photograph is used twice within one page.
 */

import { photo } from "@/lib/photos";

/** Hero photograph per marketing page. */
export const pageHeroVisuals = {
  services: photo.teamTablet,
  specialties: photo.doctorFemale,
  whoWeServe: photo.corridorBright,
  results: photo.analyticsLaptop,
  about: photo.teamLounge,
  contact: photo.reception,
  schedule: photo.videoConsult,
  process: photo.presentation,
  insights: photo.laptopNotes,
  faq: photo.supportHeadset,
  compliance: photo.stethoscopeNotes,
} as const;

/** Hero photograph for each service detail page (one per service). */
export const serviceVisuals: Record<string, string> = {
  "medical-billing-and-coding": photo.documentsTeam,
  "accounts-receivable-management": photo.documentsReview,
  "complete-rcm-services": photo.analyticsLaptop,
  "credentialing-and-contracting": photo.stethoscopeNotes,
  "out-of-network-negotiation": photo.documentsDesk,
  "eligibility-and-benefits-verification": photo.reception,
  "prior-and-retro-authorization": photo.doctorsDiscussing,
  "complete-patient-billing": photo.keyboard,
  "clean-up-billing": photo.deskCharts,
  "chart-auditing-and-drg-review": photo.laptopNotes,
  "denial-management": photo.supportDesk,
  "claims-management": photo.teamTablet,
  "payment-posting": photo.teamOffice,
  "contracting-and-enrollment": photo.presentation,
  "eft-era-edi-support": photo.videoConsult,
  "revenue-performance-reporting": photo.teamLounge,
};

/** A second, different photograph for the in-body frame on service detail pages. */
export const serviceInlineVisuals: Record<string, string> = {
  "medical-billing-and-coding": photo.keyboard,
  "accounts-receivable-management": photo.deskCharts,
  "complete-rcm-services": photo.documentsReview,
  "credentialing-and-contracting": photo.documentsDesk,
  "out-of-network-negotiation": photo.documentsTeam,
  "eligibility-and-benefits-verification": photo.doctorsDiscussing,
  "prior-and-retro-authorization": photo.reception,
  "complete-patient-billing": photo.laptopNotes,
  "clean-up-billing": photo.supportDesk,
  "chart-auditing-and-drg-review": photo.documentsReview,
  "denial-management": photo.supportHeadset,
  "claims-management": photo.documentsDesk,
  "payment-posting": photo.analyticsLaptop,
  "contracting-and-enrollment": photo.teamTablet,
  "eft-era-edi-support": photo.teamOffice,
  "revenue-performance-reporting": photo.deskCharts,
};

/** Audience photographs used by the who-we-serve strip and cards. */
export const audienceVisuals: Record<string, string> = {
  "healthcare-systems": photo.teamOffice,
  hospitals: photo.corridorHospital,
  "emergency-rooms": photo.corridorBright,
  "urgent-cares": photo.doctorsDiscussing,
  "private-practices": photo.doctorDoorway,
};

/** Article thumbnails for the insights index and article pages. */
export const articleVisuals: Record<string, string> = {
  "clean-claim-playbook": photo.documentsTeam,
  "eligibility-verification-first-step": photo.reception,
  "ar-follow-up-that-recovers-cash": photo.supportDesk,
  "out-of-network-negotiation-explained": photo.documentsDesk,
  "credentialing-contracts-and-rates": photo.stethoscopeNotes,
  "revenue-cycle-clean-up-audit": photo.deskCharts,
};

/**
 * Rotation for /specialties/[slug]. There are more specialties than distinct
 * photographs, so the artwork is assigned by index.
 */
export const specialtyVisuals: string[] = [
  photo.doctorFemale,
  photo.doctorsDiscussing,
  photo.doctorDoorway,
  photo.teamTablet,
  photo.reception,
  photo.doctorPortrait,
  photo.teamLounge,
  photo.corridorHospital,
];
