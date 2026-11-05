import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArchiveView } from "@/components/blog/archive-view";
import { getTagBySlug, listCategoriesWithCounts, listPublicPosts, listTags } from "@/lib/blog";
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
  const base = `/blog/tag/${slug}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { slug } = await params;
  const page = pageFrom((await searchParams).page);
  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "Tag not found", robots: { index: false, follow: false } };

  return pageMetadata({
    title: page > 1 ? `Articles tagged ${tag.name} — page ${page}` : `Articles tagged ${tag.name}`,
    description: `Medical billing articles tagged ${tag.name} from the Knight Medical Billing team.`,
    path: canonicalPath(tag.slug, page),
  });
}

export default async function BlogTagPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const page = pageFrom((await searchParams).page);
  const [result, categories, tags] = await Promise.all([
    listPublicPosts({ page, perPage: PER_PAGE, tagSlug: tag.slug }),
    listCategoriesWithCounts(),
    listTags(),
  ]);

  if (result.totalPages > 0 && page > result.totalPages) notFound();

  return (
    <BlogArchiveView
      eyebrow="Tag"
      title={tag.name}
      description={`Articles tagged “${tag.name}” from the Knight Medical Billing blog.`}
      countLabel={`${result.total} article${result.total === 1 ? "" : "s"} with this tag`}
      result={result}
      categories={categories}
      tags={tags}
      activeTag={tag.slug}
      basePath={`/blog/tag/${tag.slug}`}
      emptyTitle="No published articles with this tag yet"
      emptyDescription="This tag has no published articles right now. Browse the full blog or another category."
    />
  );
}
