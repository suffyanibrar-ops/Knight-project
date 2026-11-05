"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * GA4 loader with conversion tracking.
 *
 * Rendered only when NEXT_PUBLIC_GA_ID is configured, so no analytics script is
 * shipped or executed on deployments that have not opted in. It tracks outbound
 * phone/email clicks and the custom `kmb:conversion` events emitted by the lead
 * forms, without duplicating the initial page_view (gtag config sends that).
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function SiteAnalytics({ gaId }: { gaId?: string }) {
  if (!gaId) return null;
  return <AnalyticsRuntime gaId={gaId} />;
}

function AnalyticsRuntime({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bootstrapped = useRef(false);
  const query = searchParams?.toString() ?? "";

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) {
        window.gtag?.("event", "phone_click", { link_url: href, page_location: window.location.href });
      } else if (href.startsWith("mailto:")) {
        window.gtag?.("event", "email_click", { link_url: href, page_location: window.location.href });
      }
    };
    const onConversion = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      window.gtag?.("event", String(detail.event ?? "generate_lead"), { ...detail, page_location: window.location.href });
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("kmb:conversion", onConversion as EventListener);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("kmb:conversion", onConversion as EventListener);
    };
  }, []);

  // The first config() call already sends the initial page_view; send explicit
  // page_view events only for client-side route changes after that.
  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      return;
    }
    window.gtag?.("event", "page_view", {
      page_path: query ? `${pathname}?${query}` : pathname,
      page_location: window.location.href,
    });
  }, [pathname, query]);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}window.gtag = gtag;gtag('js', new Date());gtag('config','${gaId}',{send_page_view:true});`}
      </Script>
    </>
  );
}
