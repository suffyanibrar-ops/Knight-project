import type { MetadataRoute } from "next";
import { audiences, services, site, specialties, specialtyCanonicalSlugs } from "@/lib/site";
import { softwarePlatforms, specialtyBillingGuides } from "@/lib/seo-content";

import { getArticles } from "@/lib/data";
import { listCategoriesWithCounts, listPublicPosts, listTags, type BlogPostSummary } from "@/lib/blog";

export const dynamic = "force-dynamic";

/** Every published post, fetched page by page (the data layer caps perPage). */
async function loadPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  const posts: BlogPostSummary[] = [];
  const firstPage = await listPublicPosts({ page: 1, perPage: 24 });
  posts.push(...firstPage.posts);
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const nextPage = await listPublicPosts({ page, perPage: 24 });
    if (!nextPage.posts.length) break;
    posts.push(...nextPage.posts);
  }
  return posts;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const priorities: Record<string, number> = {
    "": 1,
    "/services": 0.95,
    "/schedule-form": 0.9,
    "/software": 0.9,
    "/results/case-studies": 0.75,
    "/why-knight": 0.75,
    "/tools/revenue-leak-calculator": 0.7,
    "/who-we-serve": 0.9,
    "/specialties": 0.85,
    "/our-process": 0.8,
    "/switching-medical-billing": 0.8,
    "/results": 0.8,
    "/about": 0.8,
    "/blog": 0.7,
    "/insights": 0.7,
    "/faq": 0.7,
    "/contact": 0.7,
    "/cookie-policy": 0.3,
  };

  const staticRoutes = [
    "",
    "/services",
    "/who-we-serve",
    "/specialties",
    "/our-process",
    "/switching-medical-billing",
    "/results",
    "/results/case-studies",
    "/software",
    "/why-knight",
    "/tools/revenue-leak-calculator",
    "/about",
    "/blog",
    "/insights",
    "/faq",
    "/contact",
    "/schedule-form",
    "/hipaa-compliance",
    "/privacy-policy",
    "/terms-of-service",
    "/cookie-policy",
  ].map((route) => ({
    url: `${site.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: priorities[route] ?? 0.6,
  }));

  const articles = await getArticles();

  // Blog entries come from the same public read layer as the pages, so drafts,
  // scheduled posts and trashed posts can never enter the sitemap.
  const [blogPosts, blogCategories, blogTags] = await Promise.all([loadPublishedBlogPosts(), listCategoriesWithCounts(), listTags({ publicOnly: true })]);

  return [
    ...staticRoutes,
    ...services.map((service) => ({ url: `${site.url}/services/${service.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...audiences.map((audience) => ({ url: `${site.url}/who-we-serve/${audience.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...specialties
      .filter((specialty) => !specialtyCanonicalSlugs[specialty.slug] && !specialtyBillingGuides.some((guide) => guide.slug === specialty.slug))
      .map((specialty) => ({ url: `${site.url}/specialties/${specialty.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...specialtyBillingGuides.map((guide) => ({ url: `${site.url}/specialties/${guide.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.85 })),
    ...softwarePlatforms.map((platform) => ({ url: `${site.url}/software/${platform.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.85 })),
    ...articles.map((article) => ({ url: `${site.url}/insights/${article.slug}`, lastModified: new Date(article.date), changeFrequency: "yearly" as const, priority: 0.6 })),
    ...blogPosts.map((post) => ({ url: `${site.url}/blog/${post.slug}`, lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.65 })),
    ...blogCategories
      .filter((category) => category.count > 0)
      .map((category) => ({ url: `${site.url}/blog/category/${category.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...blogTags
      .filter((tag) => tag.postCount > 0)
      .map((tag) => ({ url: `${site.url}/blog/tag/${tag.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
