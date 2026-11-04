"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Article } from "@/lib/site";
import { cn, Reveal } from "./ui";

export function InsightsExplorer({ articles }: { articles: Article[] }) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const categories = ["All", ...Array.from(new Set(articles.map((article) => article.category)))];

  const filtered = useMemo(
    () =>
      articles.filter((article) => {
        const matchesCategory = category === "All" || article.category === category;
        const matchesQuery =
          !query.trim() || `${article.title} ${article.excerpt} ${article.category}`.toLowerCase().includes(query.toLowerCase());
        return matchesCategory && matchesQuery;
      }),
    [articles, category, query],
  );

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-[0.8rem] font-bold transition-all",
                category === item ? "border-ink-900 bg-night-soft text-white" : "border-mist-200 bg-surface text-ink-700 hover:border-brand-300 hover:text-brand-700",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/70" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources"
            aria-label="Search insights"
            className="w-full rounded-full border border-mist-200 bg-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-400"
          />
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((article, index) => (
            <motion.article
              layout
              key={article.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
            >
              <Link href={`/insights/${article.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image src={article.image} alt="" fill className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/35 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-brand-700 backdrop-blur">{article.category}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-[1rem] font-extrabold leading-snug tracking-tight text-ink-950 group-hover:text-brand-700">{article.title}</h2>
                  <p className="mt-2 flex-1 text-[0.81rem] leading-relaxed text-ink-600/75">{article.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-mist-100 pt-3 text-[0.66rem] font-semibold text-ink-600/80">
                    <span>{new Date(article.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span className="flex items-center gap-1 font-bold text-brand-700">{article.readTime} <ArrowUpRight className="h-3 w-3" /></span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <Reveal className="mt-8 rounded-3xl border border-dashed border-mist-300 bg-mist-50 p-10 text-center">
          <p className="text-sm font-bold text-ink-800">No articles matched.</p>
          <button
            type="button"
            onClick={() => {
              setCategory("All");
              setQuery("");
            }}
            className="mt-3 text-sm font-bold text-brand-700 underline underline-offset-2"
          >
            Clear filters
          </button>
        </Reveal>
      )}
    </div>
  );
}
