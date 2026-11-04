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
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label={`${site.name} home`}>
      <Image src={variant === "light" ? site.logoWhite : site.logo} alt="" width={markSize} height={markSize} style={{ width: markSize, height: markSize }} className="shrink-0 transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" priority />
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
