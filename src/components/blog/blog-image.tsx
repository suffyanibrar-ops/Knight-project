import Image from "next/image";
import type { BlogMediaRef, BlogPostSummary } from "@/lib/blog";
import { cn } from "@/lib/utils";

/**
 * Server-side image resolver for blog posts.
 *
 * Featured images come from two places:
 *  - an imported media record, served by the immutable /media/blog route, and
 *  - a plain URL string (a site asset or a hotlinked provider URL).
 * The media route only publishes specific widths, so we always request a width
 * that actually exists instead of guessing.
 */
export type BlogImagePost = Pick<
  BlogPostSummary,
  "title" | "slug" | "featuredImage" | "featuredImageAlt" | "featuredImageWidth" | "featuredImageHeight" | "media"
>;

const MEDIA_VARIANT_WIDTHS = [1600, 960, 480] as const;

function mediaAlt(media: BlogMediaRef | null | undefined): string | null {
  return media?.alt?.trim() || null;
}

export function resolveBlogImage(post: BlogImagePost): { src: string; alt: string; external: boolean } | null {
  const alt = post.featuredImageAlt?.trim() || mediaAlt(post.media) || post.title;

  if (post.media) {
    const width = MEDIA_VARIANT_WIDTHS.find((candidate) => candidate <= post.media!.width) ?? post.media.width;
    return { src: `/media/blog/${post.media.id}/${width}.webp`, alt, external: false };
  }

  const featured = post.featuredImage?.trim();
  if (!featured) return null;
  return { src: featured, alt, external: /^https?:\/\//i.test(featured) };
}

/** Absolute-or-relative image URL for Open Graph / JSON-LD, or null. */
export function blogImageUrl(post: BlogImagePost): string | null {
  return resolveBlogImage(post)?.src ?? null;
}

/**
 * Cover image that always fills its (relatively positioned) parent.
 *
 * Imported media is same-origin and goes through the optimizer. A hotlinked
 * external URL is rendered unoptimized so it can never break the page just
 * because a provider host is not in next.config's remote allow-list.
 */
export function BlogImage({
  post,
  sizes = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px",
  priority = false,
  className,
  imageClassName,
}: {
  post: BlogImagePost;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const image = resolveBlogImage(post);

  if (!image) {
    return (
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-night bg-[radial-gradient(120%_120%_at_20%_0%,rgba(124,215,242,0.3),transparent_55%),radial-gradient(100%_100%_at_90%_100%,rgba(94,194,122,0.22),transparent_60%)]",
          className,
        )}
      >
        <span className="grid-lines absolute inset-0 opacity-20" />
      </div>
    );
  }

  return (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      priority={priority}
      sizes={sizes}
      unoptimized={image.external}
      className={cn("object-cover", className, imageClassName)}
    />
  );
}
