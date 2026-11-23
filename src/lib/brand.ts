import { services, site, specialties } from "@/lib/site";

/**
 * Single authoritative brand configuration.
 *
 * Website copy generators, AI prompts and admin content tools must read from
 * here instead of restating positioning. Nothing in this file may contain
 * invented clients, statistics, certifications or guarantees.
 */
export const brand = {
  identity: {
    name: site.name,
    shortName: site.shortName,
    abbreviation: site.abbreviation,
    tagline: site.tagline,
    url: site.url,
    email: site.email,
    phone: site.phone,
    address: site.address,
    hours: site.hours,
    founded: site.founded,
  },

  positioning: {
    /** Canonical homepage headline. Do not paraphrase in generated copy. */
    headline: "Medical billing and revenue cycle management for healthcare providers and organizations.",
    summary:
      "Knight Medical Billing runs the revenue cycle inside the systems a provider already uses — claims, denials, A/R, payment posting and reporting — for practices and facilities of different sizes.",
    shortPositioning: "Medical billing and revenue cycle management for healthcare providers and organizations.",
    differentiators: [
      "Works inside the software the organization already uses",
      "No prepayment and no hidden fees",
      "Dedicated team with a named account owner",
      "Claims reviewed before submission",
      "Monthly performance reporting with a follow-up plan",
      "HIPAA-conscious handling of patient information",
    ],
  },

  /** Every audience the site may speak to. Order is editorial preference only. */
  audiences: [
    "Private and independent practices",
    "Growing practices",
    "Multi-provider practices and specialty groups",
    "Clinics",
    "Hospitals and health systems",
    "Free-standing emergency rooms and emergency departments",
    "Urgent care organizations",
    "Billing companies and third-party billing entities",
  ],

  services: services.map((s) => ({ slug: s.slug, name: s.name, short: s.short })),

  specialtyCount: specialties.length,
  specialties: specialties.map((s) => ({ slug: s.slug, name: s.name, group: s.group })),

  voice: {
    tone: "Plain, specific and calm. Operations-first, never salesy.",
    person: "Write about the work, not about the company's feelings.",
    readingLevel: "Professional business reader; short sentences, concrete nouns.",
    preferred: [
      "Explain the process, the owner and the next step",
      "Use second person for the reader's organization",
      "Name the metric or workflow being discussed",
    ],
    avoid: [
      "Superlatives (best, leading, #1, world-class)",
      "Unverified outcome claims or invented statistics",
      "Urgency or scarcity pressure",
      "Em dashes used as filler",
      "Describing the business as only serving independent practices",
    ],
  },

  /** Statements the business stands behind and can repeat anywhere. */
  approvedClaims: [
    "Medical billing and revenue cycle management for healthcare providers and organizations.",
    "The team works inside the billing, EHR or practice-management system the organization already uses.",
    "No prepayment and no hidden fees.",
    "Claims are reviewed before submission.",
    "Monthly reporting covers collections, denials, days in A/R and charge lag.",
  ],

  /** Never generate or publish content that asserts these. */
  prohibitedClaims: [
    "Specific revenue or percentage gains without a client-verified case study on file",
    "Named client relationships that are not approved in writing",
    "Certifications, accreditations or partnerships that are not documented",
    "Rankings, awards or comparisons that cannot be evidenced",
    "Search volume, ranking or traffic figures that were not retrieved from a real API",
    "Guarantees of payment, reimbursement or audit outcomes",
    "Statements that the business serves only independent practices",
  ],
} as const;

export type Brand = typeof brand;
