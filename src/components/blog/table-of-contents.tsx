import type { BlogHeading } from "@/lib/blog-sanitize";
import { cn } from "@/lib/utils";

/**
 * Table of contents built from the sanitized article headings.
 * Headings always carry stable ids from the sanitizer, so plain anchors work
 * without client-side scroll tracking.
 */
export function TableOfContents({ headings, className }: { headings: BlogHeading[]; className?: string }) {
  if (headings.length < 2) return null;

  return (
    <nav aria-label="Table of contents" className={cn("rounded-2xl border border-mist-200 bg-mist-50 p-5", className)}>
      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-600/75">On this page</p>
      <ol className="mt-3 space-y-1.5">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? "pl-3" : heading.level === 4 ? "pl-6" : undefined}>
            <a href={`#${heading.id}`} className="block text-[0.78rem] font-semibold leading-snug text-ink-700 transition-colors hover:text-brand-700">
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
