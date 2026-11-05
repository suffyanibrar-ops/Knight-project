/**
 * Loading skeleton for the blog index. Matches the hero + featured card + grid
 * layout so the page does not jump when data arrives.
 */
export default function BlogLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <section className="relative overflow-hidden border-b border-mist-200 bg-night py-12 sm:py-16">
        <div className="shell">
          <div className="h-3 w-28 rounded-full bg-white/10" />
          <div className="mt-6 h-3 w-24 rounded-full bg-white/10" />
          <div className="mt-4 h-10 w-full max-w-2xl rounded-xl bg-white/10" />
          <div className="mt-3 h-10 w-2/3 max-w-md rounded-xl bg-white/10" />
          <div className="mt-5 h-4 w-full max-w-xl rounded-full bg-white/[0.07]" />
          <div className="mt-7 flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-8 w-28 rounded-full bg-white/10" />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-12 sm:py-16">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
          <div className="min-w-0">
            <div className="h-64 animate-pulse rounded-3xl border border-mist-200 bg-mist-100 sm:h-80" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-3xl border border-mist-200 bg-surface">
                  <div className="aspect-[16/10] animate-pulse bg-mist-100" />
                  <div className="space-y-2.5 p-5">
                    <div className="h-3 w-24 rounded-full bg-mist-100" />
                    <div className="h-4 w-full rounded-full bg-mist-100" />
                    <div className="h-4 w-4/5 rounded-full bg-mist-100" />
                    <div className="h-3 w-full rounded-full bg-mist-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-3xl border border-mist-200 bg-mist-100" />
            ))}
          </div>
        </div>
      </section>
      <span className="sr-only">Loading articles…</span>
    </div>
  );
}
