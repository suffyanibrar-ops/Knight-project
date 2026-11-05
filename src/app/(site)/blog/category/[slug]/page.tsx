import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArchiveView } from "@/components/blog/archive-view";
import { getCategoryBySlug, listCategoriesWithCounts, listPublicPosts, listTags } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PER_PAGE = 9;

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function pageFrom(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? "");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function canonicalPath(slug: string, page: number): string {
  const base = `/blog/category/${slug}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { slug } = await params;
  const page = pageFrom((await searchParams).page);
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found", robots: { index: false, follow: false } };

  return pageMetadata({
    title: page > 1 ? `${category.name} articles — page ${page}` : `${category.name} articles`,
    description:
      category.description?.slice(0, 158) ||
      `Medical billing and revenue cycle articles filed under ${category.name} on the Knight Medical Billing blog.`,
    path: canonicalPath(category.slug, page),
  });
}

export default async function BlogCategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const page = pageFrom((await searchParams).page);
  const [result, categories, tags] = await Promise.all([
    listPublicPosts({ page, perPage: PER_PAGE, categorySlug: category.slug }),
    listCategoriesWithCounts(),
    listTags(),
  ]);

  if (result.totalPages > 0 && page > result.totalPages) notFound();

  return (
    <BlogArchiveView
      eyebrow={category.name}
      title={category.name}
      description={category.description}
      countLabel={`${result.total} article${result.total === 1 ? "" : "s"} in this category`}
      result={result}
      categories={categories}
      tags={tags}
      activeCategory={category.slug}
      basePath={`/blog/category/${category.slug}`}
      emptyTitle="No published articles in this category yet"
      emptyDescription="New guides are published regularly. In the meantime, browse the full blog or another category."
    />
  );
}
