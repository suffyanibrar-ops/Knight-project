import type { MetadataRoute } from "next";
import { audiences, services, site, specialties } from "@/lib/site";

import { getArticles } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const priorities: Record<string, number> = {
    "": 1,
    "/services": 0.95,
    "/schedule-form": 0.9,
    "/who-we-serve": 0.9,
    "/specialties": 0.85,
    "/our-process": 0.8,
    "/results": 0.8,
    "/about": 0.8,
    "/insights": 0.7,
    "/faq": 0.7,
    "/contact": 0.7,
  };

  const staticRoutes = [
    "",
    "/services",
    "/who-we-serve",
    "/specialties",
    "/our-process",
    "/results",
    "/about",
    "/insights",
    "/faq",
    "/contact",
    "/schedule-form",
    "/hipaa-compliance",
    "/privacy-policy",
    "/terms-of-service",
  ].map((route) => ({
    url: `${site.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: priorities[route] ?? 0.6,
  }));

  const articles = await getArticles();

  return [
    ...staticRoutes,
    ...services.map((service) => ({ url: `${site.url}/services/${service.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...audiences.map((audience) => ({ url: `${site.url}/who-we-serve/${audience.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...specialties.map((specialty) => ({ url: `${site.url}/specialties/${specialty.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...articles.map((article) => ({ url: `${site.url}/insights/${article.slug}`, lastModified: new Date(article.date), changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
