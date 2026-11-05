import { Navigation } from "lucide-react";
import { site } from "@/lib/site";

/**
 * Interactive Google Map.
 *
 * Loaded directly (lazy) so visitors see the real office location without an
 * extra opt-in step. The site CSP explicitly allows the Google Maps frame.
 */
export function MapEmbed({ height = 320 }: { height?: number }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-mist-200 bg-mist-50">
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
