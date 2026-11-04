import type { Perspective } from "@/components/testimonials";

/**
 * Anonymised practice feedback themes shared with our billing team.
 *
 * IMPORTANT: these are deliberately not attributed to named individuals or
 * companies. No client has provided written permission for a public quotation,
 * so the site does not present one. Replace this array with real, attributed
 * testimonials once you have documented consent — the carousel renders whatever
 * is here.
 */
export const perspectives: Perspective[] = [
  {
    id: "denials",
    theme: "Denials",
    quote:
      "The pattern we hear most often is that denials get logged but never worked. Once someone owns each denial and the upstream cause is fixed, the backlog stops rebuilding itself every quarter.",
    role: "Billing operations theme",
    context: "Recurring across multi-provider specialty groups",
    image: "/images/visuals/testimonial-1.svg",
  },
  {
    id: "ar",
    theme: "Aged A/R",
    quote:
      "Practices frequently cannot say how much of their receivables is still collectible. Segmenting by payer and timely-filing window turns an unmanageable total into a workable list.",
    role: "Accounts receivable theme",
    context: "Common in practices billing multiple commercial payers",
    image: "/images/visuals/testimonial-2.svg",
  },
  {
    id: "front-desk",
    theme: "Front desk load",
    quote:
      "Eligibility calls, authorisations and patient statements usually land on clinical staff. Moving those tasks to a billing team gives the front office its day back.",
    role: "Administrative workflow theme",
    context: "Typical for independent practices under 10 providers",
    image: "/images/visuals/testimonial-3.svg",
  },
  {
    id: "visibility",
    theme: "Visibility",
    quote:
      "Most administrators we speak with want the same five numbers each month: collections, clean-claim acceptance, denials, days in A/R and charge lag. Everything else is supporting detail.",
    role: "Reporting theme",
    context: "Requested by both single-site and multi-site practices",
    image: "/images/visuals/testimonial-4.svg",
  },
];
