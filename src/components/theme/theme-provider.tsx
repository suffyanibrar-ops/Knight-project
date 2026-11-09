"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";
type TextSize = "default" | "large" | "xlarge";
type Contrast = "normal" | "high";
type MotionPref = "system" | "reduced";

type Prefs = {
  theme: ThemeMode;
  textSize: TextSize;
  contrast: Contrast;
  motion: MotionPref;
};

const DEFAULTS: Prefs = { theme: "light", textSize: "default", contrast: "normal", motion: "system" };
const STORAGE_KEY = "kmb-prefs";

type ThemeApi = Prefs & {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setTextSize: (size: TextSize) => void;
  setContrast: (contrast: Contrast) => void;
  setMotion: (motion: MotionPref) => void;
  reset: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeApi | null>(null);

/** Applies preferences to <html> so CSS can respond without layout shift. */
function apply(prefs: Prefs) {
  const root = document.documentElement;
  root.classList.toggle("dark", prefs.theme === "dark");
  root.style.colorScheme = prefs.theme;
  root.dataset.contrast = prefs.contrast;
  root.dataset.textsize = prefs.textSize;
  root.dataset.motion = prefs.motion;
}

/** Reads persisted preferences. Returns defaults during SSR. */
function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULTS, ...(JSON.parse(stored) as Partial<Prefs>) };
  } catch {
    /* malformed storage — fall back to defaults */
  }
  return DEFAULTS;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  // Reconcile with storage after hydration, then keep <html> in sync.
  useEffect(() => {
    const stored = readPrefs();
    apply(stored);
    // One reconciliation after hydration is intentional; guard avoids loops.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(stored);
    setMounted(true);
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      apply(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be blocked */
      }
      return next;
    });
  }, []);

  const api = useMemo<ThemeApi>(
    () => ({
      ...prefs,
      mounted,
      setTheme: (theme) => update({ theme }),
      toggleTheme: () => update({ theme: prefs.theme === "dark" ? "light" : "dark" }),
      setTextSize: (textSize) => update({ textSize }),
      setContrast: (contrast) => update({ contrast }),
      setMotion: (motion) => update({ motion }),
      reset: () => update(DEFAULTS),
    }),
    [prefs, mounted, update],
  );

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

/** Safe fallback so a component used outside the provider never throws. */
export function useTheme(): ThemeApi {
  const context = useContext(ThemeContext);
  if (context) return context;
  return {
    ...DEFAULTS,
    mounted: false,
    setTheme: () => undefined,
    toggleTheme: () => undefined,
    setTextSize: () => undefined,
    setContrast: () => undefined,
    setMotion: () => undefined,
    reset: () => undefined,
  };
}
