"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return (
    <section className="grid min-h-[70vh] place-items-center bg-mist-50 px-4 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-mist-200 bg-surface p-7 text-center shadow-soft">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-950">This section could not load</h1>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-600/80">
          The rest of the site is still available. Try again, or contact us at{" "}
          <a href="tel:+18129940046" className="font-bold text-brand-700">(812) 994-0046</a> if it keeps happening.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="btn btn-primary">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <Link href="/" className="btn btn-light">
            <Home className="h-4 w-4" /> Back home
          </Link>
        </div>
        {error.digest && <p className="mt-4 text-[0.66rem] font-semibold text-ink-600/40">Reference: {error.digest}</p>}
      </div>
    </section>
  );
}
