"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { primaryNav, site } from "@/lib/site";
import { Icon } from "./icon";
import { Portal } from "./portal";
import { ThemeToggle } from "./theme/theme-toggle";
import { AccessibilityPanel } from "./theme/accessibility-panel";
import { Logo } from "./logo";
import { cn } from "./ui";

export function SiteHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>("Services");

  // Menus close on navigation via the link handlers below; this effect keeps
  // them closed if the route changes from anywhere else (e.g. browser back).
  useEffect(() => {
    const close = () => {
      setOpenMenu(null);
      setMobileOpen(false);
    };
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className={cn(
          "border-b transition-all duration-300 supports-[backdrop-filter]:bg-surface/75 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150",
          scrolled ? "border-mist-200 bg-surface/95 shadow-[0_18px_40px_-30px_rgba(4,20,31,0.55)]" : "border-transparent bg-surface",
        )}
      >
        <div className="shell flex h-[74px] items-center justify-between gap-4">
          <Logo markSize={42} />

          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
            {primaryNav.map((item) => {
              const hasMenu = Boolean(item.columns || item.children);
              const childLinks = [...(item.children ?? []), ...(item.columns?.flatMap((column) => column.items) ?? [])];
              const active = pathname === item.href
                || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                || childLinks.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));
              return (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => hasMenu && setOpenMenu(item.label)}
                  onMouseLeave={() => hasMenu && setOpenMenu(null)}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpenMenu(null)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-2 text-[0.845rem] font-bold transition-colors",
                      active ? "text-brand-700" : "text-ink-800 hover:text-brand-700",
                    )}
                    aria-expanded={hasMenu ? openMenu === item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    onFocus={() => hasMenu && setOpenMenu(item.label)}
                  >
                    {item.label}
                    {hasMenu && (
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", openMenu === item.label && "rotate-180")} strokeWidth={2.4} />
                    )}
                  </Link>
                  {active && (
                    <motion.span
                      layoutId="nav-active-underline"
                      className="pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-500"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <a
                href={site.phoneHref}
                aria-label={`Call Knight Medical Billing on ${site.phone}`}
                title={site.phone}
                className="grid h-10 w-10 place-items-center rounded-full border border-mist-200 bg-surface text-ink-800 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                <Phone className="h-4 w-4" aria-hidden />
              </a>
              <ThemeToggle />
              <div className="hidden sm:block">
                <AccessibilityPanel />
              </div>
            </div>
            <Link href="/schedule-form" className="btn btn-primary hidden lg:inline-flex whitespace-nowrap px-4 py-2.5 text-[0.84rem]">
              Talk With Knight
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full border border-mist-200 text-ink-900 lg:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {openMenu && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setOpenMenu(openMenu)}
              onMouseLeave={() => setOpenMenu(null)}
              className="absolute inset-x-0 top-full hidden border-t border-mist-200 bg-surface shadow-[0_40px_70px_-45px_rgba(4,20,31,0.5)] xl:block"
            >
              <div className="shell py-7">
                {primaryNav
                  .filter((item) => item.label === openMenu)
                  .map((item) => (
                    <div key={item.label} className={cn("grid gap-8", (item.columns?.length ?? 0) >= 3 ? "grid-cols-[1fr_1fr_1fr_0.85fr]" : (item.columns?.length ?? 0) === 2 ? "grid-cols-[1fr_1fr_0.9fr]" : "grid-cols-[1fr_1fr]")}>
                      {item.columns?.map((column) => (
                        <div key={column.title}>
                          <p className="mb-3 text-[0.68rem] font-extrabold uppercase tracking-[0.2em] text-ink-600/75">{column.title}</p>
                          <ul className="space-y-1">
                            {column.items.map((child) => (
                              <li key={child.href}>
                                <Link href={child.href} onClick={() => setOpenMenu(null)} className="group flex items-start gap-3 rounded-2xl p-2.5 transition-colors hover:bg-brand-50/70">
                                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                                    <Icon name={child.icon} className="h-4 w-4" />
                                  </span>
                                  <span>
                                    <span className="block text-sm font-bold text-ink-900 group-hover:text-brand-700">{child.label}</span>
                                    {child.description && <span className="mt-0.5 block text-xs text-ink-600/70">{child.description}</span>}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      {item.children && (
                        <div className="grid grid-cols-2 gap-1">
                          {item.children.map((child) => (
                            <Link key={child.href} href={child.href} onClick={() => setOpenMenu(null)} className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-brand-50/70">
                              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-500 group-hover:text-white">
                                <Icon name={child.icon} className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block text-sm font-bold text-ink-900 group-hover:text-brand-700">{child.label}</span>
                                {child.description && <span className="mt-0.5 block text-xs text-ink-600/70">{child.description}</span>}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {item.columns && (
                        <Link href="/schedule-form" className="group relative overflow-hidden rounded-3xl bg-night-soft p-6 text-white">
                          <div className="dot-grid absolute inset-0 opacity-30" />
                          <div className="relative">
                            <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-brand-300">No risk, no prepayment</span>
                            <p className="mt-3 text-lg font-extrabold leading-tight tracking-tight">Talk with a billing partner who will own the detail.</p>
                            <p className="mt-2 text-xs leading-relaxed text-white/65">No prepayment, no hidden fees, and a dedicated team from day one.</p>
                            <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-brand-200">
                              Talk With Knight <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </span>
                          </div>
                        </Link>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Portal>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-night/50 backdrop-blur-sm xl:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-50 flex w-[min(92vw,26rem)] flex-col bg-surface xl:hidden"
            >
              <div className="flex items-center justify-between border-b border-mist-200 px-5 py-4">
                <Logo markSize={36} />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-mist-200 text-ink-900"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <motion.div
                className="flex-1 overflow-y-auto px-5 py-4"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
              >
                {primaryNav.map((item) => {
                  const hasChildren = Boolean(item.columns || item.children);
                  const expanded = mobileSection === item.label;
                  const children = item.columns ? item.columns.flatMap((column) => column.items) : item.children ?? [];
                  return (
                    <motion.div
                      key={item.label}
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}
                      className="border-b border-mist-100 py-1"
                    >
                      <div className="flex items-center justify-between">
                        <Link href={item.href} className="py-3 text-base font-extrabold text-ink-900">
                          {item.label}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setMobileSection(expanded ? null : item.label)}
                            aria-label={`Toggle ${item.label}`}
                            aria-expanded={expanded}
                            className="grid h-8 w-8 place-items-center rounded-full bg-mist-100 text-ink-800"
                          >
                            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {hasChildren && expanded && (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden pb-2"
                          >
                            {children.map((child) => (
                              <li key={child.href}>
                                <Link href={child.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700">
                                  <Icon name={child.icon} className="h-4 w-4 text-brand-600" />
                                  {child.label}
                                </Link>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
              <div className="space-y-3 border-t border-mist-200 px-5 py-5">
                <Link href="/schedule-form" className="btn btn-primary w-full">
                  Talk With Knight <ArrowRight className="h-4 w-4" />
                </Link>
                <a href={site.phoneHref} className="btn btn-light w-full">
                  <Phone className="h-4 w-4" /> {site.phone}
                </a>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[0.72rem] font-bold text-ink-700">Theme &amp; accessibility</span>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <AccessibilityPanel />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </Portal>
    </header>
  );
}
