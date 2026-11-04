"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DURATION, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; title: string; description?: string; tone: ToastTone };

type ToastApi = {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback(({ title, description, tone = "info" }: { title: string; description?: string; tone?: ToastTone }) => {
    counter += 1;
    const id = counter;
    setItems((current) => [...current.slice(-2), { id, title, description, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: DURATION.fast, ease: EASE }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface p-3.5 shadow-[0_18px_40px_-18px_rgba(4,20,31,0.45)]",
                item.tone === "success" && "border-mint-200",
                item.tone === "error" && "border-rose-200",
                item.tone === "info" && "border-mist-200",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                  item.tone === "success" && "bg-mint-50 text-mint-700",
                  item.tone === "error" && "bg-rose-50 text-rose-600",
                  item.tone === "info" && "bg-brand-50 text-brand-700",
                )}
                aria-hidden
              >
                {item.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : item.tone === "error" ? <TriangleAlert className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.82rem] font-extrabold leading-snug text-ink-950">{item.title}</p>
                {item.description && <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-600">{item.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-600/60 transition-colors hover:bg-mist-100 hover:text-ink-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Safe outside the provider (returns a no-op) so components never crash. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (context) return context;
  return { toast: () => undefined };
}

/** Auto-dismiss helper for transient success states. */
export function useAutoDismiss(active: boolean, onDone: () => void, delay = 3200) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(onDone, delay);
    return () => window.clearTimeout(timer);
  }, [active, delay, onDone]);
}
