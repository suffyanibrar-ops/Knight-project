/**
 * The single low-friction review path.
 *
 * The visitor names one primary concern, and the existing consultation form
 * stores it as an interest alongside the normal fields. No second form, table
 * or lead pipeline is introduced.
 */
export const REVIEW_CONCERNS = [
  { id: "billing-claims", label: "Billing & claims", interest: "Primary concern: billing and claims" },
  { id: "denials", label: "Denials", interest: "Primary concern: denials" },
  { id: "ar", label: "A/R", interest: "Primary concern: accounts receivable" },
  { id: "credentialing", label: "Credentialing", interest: "Primary concern: credentialing" },
  { id: "eligibility", label: "Eligibility", interest: "Primary concern: eligibility" },
  { id: "other", label: "Other", interest: "Primary concern: other" },
] as const;

export type ReviewConcern = (typeof REVIEW_CONCERNS)[number];
export type ReviewConcernId = ReviewConcern["id"];

const squeeze = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function reviewConcern(value: string | null | undefined): ReviewConcern | null {
  const clean = (value ?? "").trim().toLowerCase();
  if (!clean) return null;
  return (
    REVIEW_CONCERNS.find((concern) => concern.id === clean) ??
    REVIEW_CONCERNS.find((concern) => squeeze(concern.id) === squeeze(clean)) ??
    null
  );
}

export function isPrimaryConcernInterest(value: string): boolean {
  return value.startsWith("Primary concern:");
}
