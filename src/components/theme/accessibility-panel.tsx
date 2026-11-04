"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Accessibility, Check, Contrast, RotateCcw, Type, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/portal";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

const textSizes = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Larger" },
] as const;

/**
 * Accessibility controls: text size, high contrast, reduced motion, theme.
 * Preferences persist in localStorage and apply to <html> attributes.
 * Panel is a labelled dialog, closes on Escape, and traps nothing it does not own.
 */
export function AccessibilityPanel() {
  const { textSize, setTextSize, contrast, setContrast, motion: motionPref, setMotion, theme, setTheme, reset, mounted } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Accessibility and display options"
        aria-expanded={open}
        title="Accessibility options"
        className="grid h-10 w-10 place-items-center rounded-full border border-mist-200 bg-surface text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        <Accessibility className="h-5 w-5" />
      </button>

      <Portal>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[85] bg-night/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="a11y-title"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-3 bottom-3 z-[86] max-h-[85vh] overflow-y-auto rounded-3xl border border-mist-200 bg-surface p-5 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[22rem]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="a11y-title" className="text-[1rem] font-extrabold tracking-tight text-ink-950">
                    Accessibility &amp; display
                  </h2>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-ink-600">
                    Adjust how the site looks and moves. Saved on this device.
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close accessibility options" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-mist-200 text-ink-700 hover:border-brand-300">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <fieldset>
                  <legend className="flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600">
                    <Type className="h-3.5 w-3.5" /> Text size
                  </legend>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {textSizes.map((size) => (
                      <button
                        key={size.value}
                        type="button"
                        onClick={() => setTextSize(size.value)}
                        aria-pressed={mounted && textSize === size.value}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-[0.74rem] font-bold transition-colors",
                          mounted && textSize === size.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-mist-200 text-ink-800 hover:border-brand-300",
                        )}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600">
                    <Contrast className="h-3.5 w-3.5" /> Contrast
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(["normal", "high"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setContrast(value)}
                        aria-pressed={mounted && contrast === value}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-[0.74rem] font-bold capitalize transition-colors",
                          mounted && contrast === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-mist-200 text-ink-800 hover:border-brand-300",
                        )}
                      >
                        {value === "normal" ? "Normal" : "High contrast"}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600">
                    <Zap className="h-3.5 w-3.5" /> Motion
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(["system", "reduced"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMotion(value)}
                        aria-pressed={mounted && motionPref === value}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-[0.74rem] font-bold capitalize transition-colors",
                          mounted && motionPref === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-mist-200 text-ink-800 hover:border-brand-300",
                        )}
                      >
                        {value === "system" ? "Follow system" : "Reduce motion"}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-ink-600">Theme</legend>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(["light", "dark"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        aria-pressed={mounted && theme === value}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[0.74rem] font-bold capitalize transition-colors",
                          mounted && theme === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-mist-200 text-ink-800 hover:border-brand-300",
                        )}
                      >
                        {mounted && theme === value && <Check className="h-3 w-3" strokeWidth={3} />}
                        {value === "light" ? "Light" : "Dark"}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  onClick={reset}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-mist-200 px-3 py-2 text-[0.74rem] font-bold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
                </button>
              </div>

              <p className="mt-4 rounded-xl bg-mist-50 px-3 py-2 text-[0.66rem] leading-relaxed text-ink-600">
                Need something else? Call (812) 994-0046 and we will help directly. Keyboard users: Tab moves through controls, Escape closes this panel.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </Portal>
    </>
  );
}
