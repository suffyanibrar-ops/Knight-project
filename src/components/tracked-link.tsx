"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackConversion, type ConversionName } from "@/lib/tracking";

type Props = ComponentProps<typeof Link> & {
  conversion: ConversionName;
  conversionParams?: Record<string, string | number | boolean>;
};

/** A normal Next.js link that records a lightweight, non-PHI conversion event. */
export function TrackedLink({ conversion, conversionParams, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackConversion(conversion, conversionParams);
        onClick?.(event);
      }}
    />
  );
}
