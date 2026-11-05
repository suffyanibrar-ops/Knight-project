import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Accessible pagination with real anchors (crawlable) and rel="prev"/"next"
 * hints. Extra query parameters such as a search term are preserved.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  query = {},
  className,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const buildHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const pages: (number | "gap")[] = [];
  for (let index = 1; index <= totalPages; index += 1) {
    const nearCurrent = Math.abs(index - page) <= 1;
    if (index === 1 || index === totalPages || nearCurrent) pages.push(index);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  const linkClass =
    "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border border-mist-200 px-3 text-[0.78rem] font-bold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700";

  return (
    <nav aria-label="Pagination" className={cn("mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-mist-200 pt-6", className)}>
      {page > 1 ? (
        <Link href={buildHref(page - 1)} rel="prev" className={linkClass}>
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Newer
        </Link>
      ) : (
        <span aria-hidden className="inline-flex h-9 items-center px-3 text-[0.78rem] font-bold text-ink-600/30">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Newer
        </span>
      )}

      <ol className="flex flex-wrap items-center gap-1.5">
        {pages.map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-[0.78rem] font-bold text-ink-600/40">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={buildHref(entry)}
                aria-current={entry === page ? "page" : undefined}
                aria-label={`Page ${entry}`}
                className={cn(
                  linkClass,
                  entry === page && "border-brand-500 bg-brand-500 text-white hover:border-brand-600 hover:text-white",
                )}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
      </ol>

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} rel="next" className={linkClass}>
          Older <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span aria-hidden className="inline-flex h-9 items-center px-3 text-[0.78rem] font-bold text-ink-600/30">
          Older <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </span>
      )}
    </nav>
  );
}
