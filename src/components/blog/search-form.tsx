import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Plain GET search form: works without JavaScript and produces a shareable
 * /blog?q=... URL. The server component reads the same query parameter.
 */
export function BlogSearchForm({
  defaultValue = "",
  action = "/blog",
  placeholder = "Search articles, e.g. denial management",
  className,
}: {
  defaultValue?: string;
  action?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <form action={action} method="get" role="search" className={cn("w-full", className)}>
      <label htmlFor="blog-search" className="sr-only">
        Search blog articles
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/45" />
        <input
          id="blog-search"
          name="q"
          type="search"
          maxLength={120}
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete="off"
          className="h-12 w-full rounded-full border border-mist-200 bg-surface pl-11 pr-28 text-[0.85rem] font-semibold text-ink-800 outline-none transition-colors placeholder:font-normal placeholder:text-ink-600/45 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
        <button type="submit" className="btn btn-primary absolute right-1.5 top-1.5 px-4 py-2.5 text-[0.76rem]">
          Search
        </button>
      </div>
    </form>
  );
}
