import type { Metadata } from "next";
import { site } from "./site";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? site.url);

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
export function pageMetadata({ title, description, path, image = "/images/og-knight-medical-billing.jpg", keywords = [], type = "website", publishedTime, noindex = false }: SeoInput): Metadata {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  const cleanTitle = stripBrandSuffix(title);
  return {
    title: cleanTitle.toLowerCase() === site.name.toLowerCase() ? { absolute: site.name } : cleanTitle,
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: {
      title,
      description,
      url,
      siteName: site.name,
      type,
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: `${site.name} — ${title}` }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
