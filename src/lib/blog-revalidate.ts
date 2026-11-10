import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Invalidate every public surface that can expose blog content.
 *
 * Public blog pages are dynamic today, but explicit invalidation keeps the
 * visibility contract safe if a route is later statically rendered or cached.
 */
export function revalidateBlogPaths(slug?: string | null): void {
  revalidatePath("/blog");
  revalidatePath("/insights");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
}
