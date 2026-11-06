"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", href: "/admin/ai", exact: true },
  { label: "Conversations", href: "/admin/ai/conversations" },
  { label: "Leads", href: "/admin/ai/leads" },
  { label: "Appointments", href: "/admin/ai/appointments" },
  { label: "Handoffs", href: "/admin/ai/handoffs" },
  { label: "Knowledge", href: "/admin/ai/knowledge" },
  { label: "Settings", href: "/admin/ai/settings" },
];

export function AiTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="AI and conversations sections" className="flex flex-wrap gap-1 rounded-2xl border border-mist-200 bg-surface p-1.5">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={cn("rounded-xl px-3.5 py-2 text-[0.74rem] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400", active ? "bg-night-soft text-white" : "text-ink-600/70 hover:bg-mist-50 hover:text-ink-900")}>{tab.label}</Link>;
      })}
    </nav>
  );
}
