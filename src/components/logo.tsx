import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

export function Logo({
  variant = "dark",
  className,
  markSize = 44,
  href = "/",
  showWordmark = true,
}: {
  variant?: "dark" | "light";
  className?: string;
  markSize?: number;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
      // With the wordmark visible the link already has a text name; an aria-label
      // would override it and break "label in name" (WCAG 2.5.3).
      aria-label={showWordmark ? undefined : `${site.name} home`}
    >
      {/* Non-empty alt keeps crawler audits (Bing) happy; when the wordmark is
          visible it repeats the same accessible name, so mark the mark itself
          presentational for assistive technology. */}
      <Image
        src={variant === "light" ? site.logoWhite : site.logo}
        alt={site.name}
        aria-hidden={showWordmark ? true : undefined}
        width={markSize}
        height={markSize}
        style={{ width: markSize, height: markSize }}
        className="shrink-0 transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105"
        priority
      />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[1.2rem] font-extrabold tracking-[-0.035em]",
              variant === "light" ? "text-white" : "text-ink-900",
            )}
          >
            Knight
          </span>
          <span
            className={cn(
              "mt-1 text-[0.56rem] font-bold uppercase tracking-[0.28em]",
              variant === "light" ? "text-brand-200" : "text-ink-600/70",
            )}
          >
            Medical Billing
          </span>
        </span>
      )}
    </Link>
  );
}
