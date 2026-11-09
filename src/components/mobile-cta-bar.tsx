"use client";

import { CalendarCheck, MessageSquare, Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import { cn } from "./ui";

/** Pages where a conversion bar would compete with the page's own form. */
const SUPPRESSED_PREFIXES = ["/contact", "/schedule-form", "/appointment"];

/**
 * A quiet, mobile-only conversion rail. It deliberately mirrors the site's
 * existing primary actions and sits above the safe-area inset. It never covers
 * form pages; elsewhere the public main and footer reserve space for it.
 */
export function MobileCtaBar() {
  const pathname = usePathname();
  if (SUPPRESSED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  const actions = [
    { label: "Talk to Knight", href: "/contact", icon: MessageSquare },
    { label: "Call", href: site.phoneHref, icon: Phone },
    { label: "Book", href: "/schedule-form", icon: CalendarCheck },
  ];

  return (
    <nav
      aria-label="Quick contact actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-mist-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-24px_rgba(4,20,31,0.35)] backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-3">
        {actions.map(({ label, href, icon: Icon }, index) => {
          const external = href.startsWith("tel:");
          const className = cn(
            "group flex min-h-[3.9rem] items-center justify-center gap-1.5 px-2 text-[0.64rem] font-extrabold tracking-[0.01em] text-ink-700 transition-colors",
            index > 0 && "border-l border-mist-100",
            "hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
            index === 2 && "text-brand-700",
          );
          const content = (
            <>
              <Icon className="h-4 w-4 shrink-0 text-brand-600 transition-transform group-hover:-translate-y-0.5" strokeWidth={2.1} aria-hidden />
              <span>{label}</span>
            </>
          );
          return external ? (
            <a key={label} href={href} className={className} aria-label={`Call Knight Medical Billing at ${site.phone}`}>
              {content}
            </a>
          ) : (
            <Link key={label} href={href} className={className} aria-label={label === "Book" ? "Book a consultation with Knight Medical Billing" : "Talk to Knight Medical Billing"}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
