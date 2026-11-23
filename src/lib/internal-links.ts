import { services, type Service } from "./site";

/**
 * Topic → service mapping for contextual internal links.
 *
 * Articles are written by different people over time; without a shared rule the
 * only link between an article and the service it supports is the navigation.
 * The map is deliberately small and literal: it only matches a topic that the
 * article is actually about, and it never invents a relationship.
 */
const TOPIC_SERVICE_MAP: { match: RegExp; slugs: string[] }[] = [
  { match: /\bdenial|denials|appeals?\b/i, slugs: ["denial-management", "accounts-receivable-management"] },
  { match: /\bcredential|credentialing|enrollment|contracting\b/i, slugs: ["credentialing-and-contracting", "contracting-and-enrollment"] },
  { match: /\beligibility|benefits|authorization|prior auth\b/i, slugs: ["eligibility-and-benefits-verification", "prior-and-retro-authorization"] },
  { match: /\ba\/r\b|accounts receivable|collections?|aged|aging/i, slugs: ["accounts-receivable-management", "denial-management"] },
  { match: /\bcod(?:e|er|ing)\b|clean claim|claim submission|claims? management\b/i, slugs: ["medical-billing-and-coding", "claims-management"] },
  { match: /\bpayment posting|\bera\b|\beft\b|\bedi\b|remittance/i, slugs: ["payment-posting", "eft-era-edi-support"] },
  { match: /\brevenue cycle|\brcm\b|billing process/i, slugs: ["complete-rcm-services", "revenue-performance-reporting"] },
  { match: /out-of-network|\boon\b/i, slugs: ["out-of-network-negotiation"] },
];

/**
 * Select at most `limit` services that match the supplied topic text.
 * Order follows the map, so the most specific rule wins and output is stable.
 */
export function serviceLinksFor(text: string, limit = 2): Service[] {
  const haystack = text.toLowerCase();
  const chosen: Service[] = [];
  for (const entry of TOPIC_SERVICE_MAP) {
    if (!entry.match.test(haystack)) continue;
    for (const slug of entry.slugs) {
      const service = services.find((item) => item.slug === slug);
      if (service && !chosen.some((item) => item.slug === service.slug)) chosen.push(service);
      if (chosen.length >= limit) return chosen;
    }
  }
  return chosen;
}
