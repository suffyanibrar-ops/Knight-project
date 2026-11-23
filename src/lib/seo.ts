import type { Metadata } from "next";
import { site } from "./site";

export const SITE_URL = site.url;

/**
 * The root layout appends "| Knight Medical Billing" via the title template.
 * Many pages already include the brand in their title, which produced doubled
 * suffixes ("... | Knight Medical Billing | Knight Medical Billing"). Strip a
 * trailing brand mention here so every rendered <title> has exactly one.
 */
export function stripBrandSuffix(title: string): string {
  const brand = site.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleaned = title
    .replace(new RegExp(`\\s*[|\u2013\u2014-]\\s*${brand}\\s*$`, "i"), "")
    .replace(new RegExp(`^\\s*${brand}\\s*[|\u2013\u2014-]\\s*`, "i"), "")
    .trim();
  return cleaned || site.name;
}

const BRAND_SUFFIX = " | Knight Medical Billing";
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

/**
 * Shared title budget: keep the primary topic, prefer the lead clause before a
 * separator, and only then use a word-boundary fit. Brand is appended once.
 */
export function fitSeoTitle(title: string): string {
  const base = stripBrandSuffix(title).replace(/\s+/g, " ").trim();
  const withBrand = `${base}${BRAND_SUFFIX}`;
  if (withBrand.length <= TITLE_LIMIT) return withBrand;
  for (const separator of [" | ", " — ", " – ", ": "]) {
    const lead = base.split(separator)[0].trim();
    if (lead && `${lead}${BRAND_SUFFIX}`.length <= TITLE_LIMIT) return `${lead}${BRAND_SUFFIX}`;
  }
  // The brand suffix is optional. Prefer the complete primary phrase without it
  // over an awkward fragment followed by the brand.
  if (base.length <= TITLE_LIMIT) return base;
  for (const separator of [" | ", " — ", " – ", ": "]) {
    const lead = base.split(separator)[0].trim();
    if (lead && lead.length <= TITLE_LIMIT) return lead;
  }
  const words = base.split(" ");
  const stopWords = new Set(["a", "an", "and", "for", "in", "of", "on", "or", "the", "to", "with"]);
  let short = "";
  for (const word of words) {
    const next = short ? `${short} ${word}` : word;
    if (next.length > TITLE_LIMIT) break;
    short = next;
  }
  while (short && stopWords.has(short.split(" ").at(-1)!.toLowerCase())) short = short.split(" ").slice(0, -1).join(" ");
  return short || base.slice(0, TITLE_LIMIT).trim();
}

/**
 * Dangling connectors left behind by a clause cut ("…reporting and") read as a
 * broken sentence in a search result, so they are trimmed before the period is added.
 */
const DANGLING_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on",
  "or", "our", "so", "that", "the", "their", "then", "these", "this", "to", "was", "were",
  "which", "while", "with", "without", "your",
]);

function endSentence(fragment: string): string {
  let text = fragment.trim().replace(/[,;:–—-]+$/, "").trim();
  while (text) {
    const last = text.split(" ").at(-1)!.toLowerCase().replace(/[^a-z']/g, "");
    if (!DANGLING_WORDS.has(last)) break;
    text = text.split(" ").slice(0, -1).join(" ").trim();
  }
  return text ? `${text}.` : "";
}

/**
 * Keep a useful, unique description at the meta-description budget.
 *
 * Priority: keep whole sentences that fit, then close on a clause boundary,
 * then finally on a whole word. A description is never cut mid-word and never
 * left hanging on a connector such as "and" or "for".
 */
export function fitSeoDescription(description: string): string {
  const clean = description.replace(/\s+/g, " ").trim();
  if (clean.length <= DESCRIPTION_LIMIT) return clean;

  // 1. Build the description from whole sentences while they fit together.
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((s) => s.trim()) ?? [];
  let built = "";
  for (const sentence of sentences) {
    const next = built ? `${built} ${sentence}` : sentence;
    if (next.length > DESCRIPTION_LIMIT) break;
    built = next;
  }
  if (built.length >= 90) return built;

  // 2. One very long sentence: close on the last clause boundary that still fits.
  const window = clean.slice(0, DESCRIPTION_LIMIT + 1);
  const boundaries = [". ", "! ", "? ", "; ", " — ", ", "]
    .map((mark) => window.lastIndexOf(mark))
    .filter((index) => index >= 60 && index < DESCRIPTION_LIMIT);
  for (const index of boundaries.sort((a, b) => b - a)) {
    const candidate = endSentence(window.slice(0, index));
    if (candidate.length >= 100 && candidate.length <= DESCRIPTION_LIMIT) return candidate;
  }

  // 3. Last resort: end on a whole word and drop trailing connectors.
  const cut = window.slice(0, DESCRIPTION_LIMIT - 1).replace(/\s+\S*$/, "").trim();
  return endSentence(cut) || `${cut}.`;
}

const DEFAULT_OG_IMAGE = "/images/og-knight-medical-billing.jpg";

type SeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
  type?: "website" | "article";
  publishedTime?: string;
  noindex?: boolean;
};

/**
 * Central metadata builder so every route ships a canonical URL, Open Graph
 * card, Twitter card and robots directive that agree with the sitemap.
 */
export function pageMetadata({ title, description, path, image = DEFAULT_OG_IMAGE, keywords = [], type = "website", publishedTime, noindex = false }: SeoInput): Metadata {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  const cleanTitle = stripBrandSuffix(title);
  const fittedTitle = cleanTitle.toLowerCase() === site.name.toLowerCase() ? site.name : fitSeoTitle(cleanTitle);
  const fittedDescription = fitSeoDescription(description);
  // The 1200×630 dimensions describe the shared social card only. Article and
  // guide images have different proportions, so declaring those dimensions for
  // every image would publish metadata that does not match the asset.
  const isSocialCard = image === DEFAULT_OG_IMAGE;
  return {
    title: { absolute: fittedTitle },
    description: fittedDescription,
    keywords: keywords.length ? keywords : undefined,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: {
      title: fittedTitle,
      description: fittedDescription,
      url,
      siteName: site.name,
      type,
      locale: "en_US",
      images: [{ url: image, alt: `${site.name} — ${cleanTitle}`, ...(isSocialCard ? { width: 1200, height: 630 } : {}) }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fittedTitle,
      description: fittedDescription,
      images: [image],
    },
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${SITE_URL}/#organization`,
    name: site.name,
    alternateName: "Knight Medical Billing (KMB)",
    description: site.description,
    url: SITE_URL,
    sameAs: Object.values(site.socials),
    logo: `${SITE_URL}${site.logo}`,
    image: `${SITE_URL}/images/og-knight-medical-billing.jpg`,
    telephone: "+1-812-994-0046",
    email: site.email,
    slogan: "You heal. Leave the revenue management to us.",
    foundingDate: "2023",
    founder: { "@type": "Person", name: "Dr. Fianko", jobTitle: "CEO & Founder" },
    address: {
      "@type": "PostalAddress",
      streetAddress: "585 Grove St Ste 145",
      addressLocality: "Herndon",
      addressRegion: "VA",
      postalCode: "20170",
      addressCountry: "US",
    },
    areaServed: { "@type": "Country", name: "United States" },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:00" },
    ],
    knowsAbout: [
      "Medical billing",
      "Revenue cycle management",
      "Provider credentialing",
      "Accounts receivable management",
      "Denial management",
      "Claims management",
      "Payment posting",
      "Insurance eligibility and benefits verification",
      "Prior authorization",
      "Contracting and enrollment",
      "EDI, ERA and EFT support",
      "Revenue performance reporting",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Medical billing services",
      itemListElement: [
        "Medical Billing",
        "Revenue Cycle Management",
        "Provider Credentialing",
        "Accounts Receivable Management",
        "Denial Management",
        "Claims Management",
        "Payment Posting",
        "Insurance Eligibility and Benefits Verification",
        "Prior Authorization",
        "Contracting and Enrollment",
        "EFT, ERA and EDI Support",
        "Revenue Performance and Reporting",
      ].map((name) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name, provider: { "@id": `${SITE_URL}/#organization` } } })),
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: site.name,
    description: site.description,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/blog?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function serviceSchema(input: { name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    serviceType: input.name,
    url: `${SITE_URL}${input.path}`,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: { "@type": "Country", name: "United States" },
    audience: { "@type": "BusinessAudience", name: "Hospitals, healthcare systems, emergency rooms, urgent cares and private practices" },
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

export function articleSchema(input: { title: string; description: string; path: string; image: string; date: string; author: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    image: [`${SITE_URL}${input.image}`],
    datePublished: input.date,
    dateModified: input.date,
    author: { "@type": "Organization", name: input.author, url: SITE_URL },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${input.path}` },
  };
}
