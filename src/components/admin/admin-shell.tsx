"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Inbox, LayoutDashboard, Menu, Newspaper, PieChart, Settings, ShieldCheck, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Owner-facing modules only. The raw form inbox IS the complete enquiry record,
 * so the duplicate "Submissions" CRM view was removed. Email delivery stays as
 * a deep-linked diagnostics page (dashboard surfaces failures) rather than a
 * primary module, because the owner does not manage it day to day.
 */
const links = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Blog", href: "/admin/blog", icon: Newspaper },
  { label: "Enquiries", href: "/admin/inbox", icon: Inbox },
  { label: "Subscribers", href: "/admin/subscribers", icon: Users },
  { label: "ROI estimates", href: "/admin/estimates", icon: PieChart },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminShell({ children, email, logout }: { children: ReactNode; email: string; logout: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="space-y-1">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-bold transition-colors",
              active ? "bg-brand-500 text-white shadow-sm" : "text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            <link.icon className="h-4 w-4" strokeWidth={2} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-mist-50">
      <div className="mx-auto flex max-w-[100rem]">
        <aside className="sticky top-0 hidden h-screen w-[15.5rem] shrink-0 flex-col justify-between bg-night p-4 lg:flex">
          <div>
            <Link href="/admin" className="flex items-center gap-2.5 rounded-xl p-1">
              <Image src="/images/knight-mark-white.png" alt="" width={36} height={36} className="h-9 w-9" />
              <span>
                <span className="block text-[0.95rem] font-extrabold leading-none text-white">Knight</span>
                <span className="mt-1 block text-[0.52rem] font-bold uppercase tracking-[0.22em] text-brand-300">Admin console</span>
              </span>
            </Link>
            <div className="mt-6">{nav}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="flex items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-mint-300">
              <ShieldCheck className="h-3 w-3" /> Secure session
            </p>
            <p className="mt-1.5 truncate text-[0.68rem] text-white/50">{email}</p>
            <div className="mt-2.5">{logout}</div>
            <Link href="/" className="mt-2 block text-center text-[0.65rem] font-semibold text-white/40 hover:text-white">
              ← Back to website
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-mist-200 bg-white/95 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/admin" className="flex items-center gap-2">
                <Image src="/images/knight-mark.png" alt="" width={30} height={30} className="h-8 w-8" />
                <span className="text-[0.85rem] font-extrabold text-ink-950">Knight Admin</span>
              </Link>
              <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" className="grid h-10 w-10 place-items-center rounded-full border border-mist-200 text-ink-800">
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>

          <AnimatePresence>
            {open && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-night/50 backdrop-blur-sm lg:hidden" />
                <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }} className="fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col justify-between bg-night p-4 lg:hidden">
                  <div>
                    <div className="flex items-center justify-between pb-4">
                      <Image src="/images/knight-mark-white.png" alt="" width={32} height={32} className="h-8 w-8" />
                      <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {nav}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="truncate text-[0.68rem] text-white/50">{email}</p>
                    <div className="mt-2">{logout}</div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function AdminCollapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-mist-200 bg-surface">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[0.82rem] font-extrabold text-ink-900">
        {title}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-mist-100 px-4 py-3">{children}</div>}
    </div>
  );
}
