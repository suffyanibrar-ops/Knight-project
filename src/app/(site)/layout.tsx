import type { ReactNode } from "react";
import { BackToTop, ScrollProgress } from "@/components/site-chrome";
import { SiteIntro } from "@/components/site-intro";
import { AiChatWidget } from "@/components/ai/chat-widget";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FirstPartyAnalytics } from "@/components/analytics/first-party-analytics";

/**
 * Public website shell.
 *
 * Marketing pages live in the `(site)` route group so the site header, footer,
 * chat widget and scroll progress render only for the public site. The admin
 * console is outside this group and therefore renders with its own shell, with
 * no site chrome above or below it.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-night-soft focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <SiteIntro />
      <ScrollProgress />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <BackToTop />
      <AiChatWidget />
      <FirstPartyAnalytics />
    </>
  );
}
