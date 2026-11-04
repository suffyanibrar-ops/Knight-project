"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { DURATION, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Copy-to-clipboard with real feedback. Falls back to a hidden textarea +
 * execCommand on browsers without the async clipboard API (older Safari,
 * non-HTTPS origins).
 */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        // Never let the click bubble to a surrounding link or form.
        event.preventDefault();
        event.stopPropagation();
        void copy();
      }}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={cn(
        "inline-grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-mist-200 bg-surface text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700",
        copied && "border-mint-300 text-mint-700",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "done" : "copy"}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.fast, ease: EASE }}
          className="grid place-items-center"
        >
          {copied ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
