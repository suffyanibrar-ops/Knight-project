"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Specialty } from "@/lib/site";
import { specialtyGroups } from "@/lib/site";
import { Icon } from "./icon";
import { cn } from "./ui";

export function SpecialtyExplorer({
  specialties,
  showSearch = false,
  limit,
}: {
  specialties: Specialty[];
  showSearch?: boolean;
  limit?: number;
}) {
  const [group, setGroup] = useState("All");
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const result = specialties.filter((specialty) => {
      const matchesGroup = group === "All" || specialty.group === group;
      const matchesQuery =
        !query.trim() || `${specialty.name} ${specialty.group} ${specialty.blurb} ${specialty.focus.join(" ")}`.toLowerCase().includes(query.toLowerCase());
      return matchesGroup && matchesQuery;
    });
    return limit ? result.slice(0, limit) : result;
  }, [specialties, group, query, limit]);

  function scrollBy(direction: number) {
    scroller.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {specialtyGroups.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setGroup(item);
                scroller.current?.scrollTo({ left: 0, behavior: "smooth" });
              }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-[0.8rem] font-bold transition-all",
                group === item ? "border-ink-900 bg-night-soft text-white shadow-md" : "border-mist-200 bg-surface text-ink-700 hover:border-brand-300 hover:text-brand-700",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {showSearch ? (
            <div className="relative flex-1 lg:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/70" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search specialties"
                aria-label="Search specialties"
                className="w-full rounded-full border border-mist-200 bg-surface py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-ink-600/70 focus:border-brand-400"
              />
            </div>
          ) : (
            <span className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-600/75 sm:flex">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filter by group
            </span>
          )}
          <div className="hidden gap-1.5 sm:flex">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll specialties left" className="grid h-9 w-9 place-items-center rounded-full border border-mist-200 text-ink-700 transition-colors hover:border-brand-400 hover:text-brand-700">
              <ArrowRight className="h-4 w-4 rotate-180" />
            </button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll specialties right" className="grid h-9 w-9 place-items-center rounded-full border border-mist-200 text-ink-700 transition-colors hover:border-brand-400 hover:text-brand-700">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        className={cn(
          "no-scrollbar mt-6 grid snap-x snap-mandatory auto-cols-[minmax(17rem,85vw)] grid-flow-col gap-4 overflow-x-auto pb-3",
          limit ? "sm:auto-cols-[minmax(18rem,1fr)] sm:grid-flow-row sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:auto-cols-[minmax(18rem,1fr)] sm:grid-flow-row sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        <AnimatePresence mode="popLayout">
          {filtered.map((specialty, index) => (
            <motion.article
              layout
              key={specialty.slug}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3) }}
              className="group relative flex snap-start flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_26px_50px_-30px_rgba(4,20,31,0.45)]"
            >
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <Icon name={specialty.icon} className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-mint-50 px-2.5 py-1 text-[0.65rem] font-extrabold text-mint-700">{specialty.group}</span>
              </div>
              <h3 className="mt-4 text-[1.05rem] font-extrabold tracking-tight text-ink-950">{specialty.name}</h3>
              <p className="mt-2 flex-1 text-[0.82rem] leading-relaxed text-ink-600/80">{specialty.blurb}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {specialty.focus.slice(0, 2).map((item) => (
                  <span key={item} className="rounded-md bg-mist-100 px-2 py-1 text-[0.62rem] font-semibold text-ink-700/80">
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-mist-100 pt-3">
                <span className="text-[0.68rem] font-bold text-ink-600/80">Certified coders · 24h filing</span>
                <Link href={`/specialties/${specialty.slug}`} aria-label={`${specialty.name} billing`} className="grid h-7 w-7 place-items-center rounded-full border border-mist-200 text-ink-700 transition-colors group-hover:border-brand-500 group-hover:bg-brand-500 group-hover:text-white">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-mist-300 bg-mist-50 p-10 text-center">
          <p className="text-sm font-bold text-ink-800">No specialty matched “{query}”.</p>
          <p className="mt-1 text-sm text-ink-600/70">
            We bill for {specialties.length}+ specialties.{" "}
            <Link href="/contact" className="font-bold text-brand-700 underline underline-offset-2">
              Ask us about yours
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
