/**
 * Shared skeleton blocks used by route-level loading states.
 * Static markup only — no client JavaScript, no animation library, so the
 * skeleton paints immediately while the server component streams in.
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-mist-200/70 ${className}`} aria-hidden />;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="shell py-16" role="status" aria-label="Loading page content">
      <span className="sr-only">Loading…</span>
      <SkeletonBlock className="h-3 w-28" />
      <SkeletonBlock className="mt-4 h-9 w-full max-w-xl" />
      <SkeletonBlock className="mt-3 h-9 w-3/4 max-w-lg" />
      <SkeletonBlock className="mt-5 h-4 w-full max-w-2xl" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-mist-200 bg-surface p-5">
            <SkeletonBlock className="h-9 w-9 rounded-xl" />
            <SkeletonBlock className="mt-4 h-4 w-2/3" />
            <SkeletonBlock className="mt-2.5 h-3 w-full" />
            <SkeletonBlock className="mt-2 h-3 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
