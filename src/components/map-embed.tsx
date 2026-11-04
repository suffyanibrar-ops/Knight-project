"use client";

import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { site } from "@/lib/site";

/**
 * Interactive Google Map.
 * The iframe is only mounted after the visitor opts in, so no third-party
 * cookies or requests load on first paint. Their choice is remembered for the
 * session.
 */
export function MapEmbed({ height = 320 }: { height?: number }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="overflow-hidden rounded-3xl border border-mist-200 bg-mist-50">
      {loaded ? (
        <iframe
          title="Map showing Knight Medical Billing at 585 Grove St Ste 145, Herndon, VA"
          src={site.mapEmbed}
          width="100%"
          height={height}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block w-full border-0"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="group flex w-full flex-col items-center justify-center gap-2 px-6 text-center"
          style={{ height }}
          aria-label="Load the interactive Google Map"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-brand-700 shadow-sm transition-transform group-hover:scale-105">
            <MapPin className="h-5 w-5" />
          </span>
          <span className="text-[0.85rem] font-extrabold text-ink-950">Load interactive map</span>
          <span className="max-w-xs text-[0.74rem] leading-relaxed text-ink-600">
            585 Grove St Ste 145, Herndon, VA 20170-4790. Loading the map connects to Google.
          </span>
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mist-200 bg-surface px-4 py-3">
        <p className="text-[0.74rem] font-semibold text-ink-700">Mon–Fri, 8:00 AM – 5:00 PM ET</p>
        <a
          href={site.mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600"
        >
          <Navigation className="h-3 w-3" /> Open in Google Maps
        </a>
      </div>
    </div>
  );
}
