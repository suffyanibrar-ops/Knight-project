"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

/**
 * Light/dark switch with a sliding sun→moon morph.
 * Renders a stable placeholder until mounted so SSR and client markup match.
 */
export function ThemeToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      title={isDark ? "Light theme" : "Dark theme"}
      className={`relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border transition-colors ${
        variant === "light"
          ? "border-mist-200 bg-surface text-ink-800 hover:border-brand-300 hover:text-brand-700"
          : "border-white/20 bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      <motion.span
        key={mounted ? (isDark ? "moon" : "sun") : "placeholder"}
        initial={{ y: 10, opacity: 0, rotate: -25 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="grid place-items-center"
        aria-hidden
      >
        {mounted && isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </motion.span>
    </button>
  );
}
