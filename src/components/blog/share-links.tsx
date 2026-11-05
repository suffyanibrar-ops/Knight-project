"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Share targets plus a copy-link button.
 * The absolute URL is passed from the server, so the links work even before
 * hydration; only the clipboard action needs JavaScript.
 */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const linkClass =
    "inline-flex items-center justify-center rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.74rem] font-bold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/70">Share</span>
      <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
        X
      </a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
        LinkedIn
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Facebook
      </a>
      <button type="button" onClick={copy} className={linkClass} aria-live="polite">
        {copied ? <Check aria-hidden className="mr-1.5 h-3.5 w-3.5 text-mint-600" /> : <Copy aria-hidden className="mr-1.5 h-3.5 w-3.5" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
