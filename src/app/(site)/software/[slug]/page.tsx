import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SoftwarePlatformPage } from "@/components/seo/software-platform-page";
import { pageMetadata } from "@/lib/seo";
import { softwarePlatforms } from "@/lib/seo-content";

export function generateStaticParams() {
  return softwarePlatforms.map((platform) => ({ slug: platform.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const platform = softwarePlatforms.find((item) => item.slug === slug);
  if (!platform) return { title: "Software page not found" };
  return pageMetadata({
    title: platform.title,
    description: platform.description,
    path: `/software/${platform.slug}`,
    keywords: [`${platform.name} medical billing`, "medical billing software", "EHR billing"],
  });
}

export default async function SoftwarePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const platform = softwarePlatforms.find((item) => item.slug === slug);
  if (!platform) notFound();
  return <SoftwarePlatformPage platform={platform} />;
}
