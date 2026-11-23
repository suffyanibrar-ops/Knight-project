import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { SeoAudit } from "@/components/admin/seo/seo-audit";
import { SeoControlCenter } from "@/components/admin/seo/seo-control-center";
import { SearchConsoleConnection } from "@/components/admin/seo/search-console-connection";
import { sqliteHandle } from "@/lib/sqlite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SEO health · Admin Console",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function searchVisibility() {
  const db = sqliteHandle();
  if (!db) return null;
  try {
    const rows = db.prepare(
      "SELECT date, clicks, impressions, position FROM seo_metrics_daily WHERE source = 'gsc' AND dimension = 'date' AND date >= date('now', '-28 day') ORDER BY date ASC",
    ).all() as { date: string; clicks: number | null; impressions: number | null; position: number | null }[];
    if (!rows.length) return null;
    const clicks = rows.reduce((sum, row) => sum + (row.clicks ?? 0), 0);
    const impressions = rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
    const weighted = rows.reduce((sum, row) => sum + (row.position ?? 0) * (row.impressions ?? 0), 0);
    return {
      days: rows.length,
      clicks,
      impressions,
      ctr: impressions ? (clicks / impressions) * 100 : 0,
      position: impressions ? weighted / impressions : null,
      latest: rows[rows.length - 1]?.date ?? null,
    };
  } catch {
    return null;
  }
}

export default async function SeoHealthPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const visibility = searchVisibility();

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="SEO"
        description="Search performance, content ideas, audits and technical findings. Nothing is auto-published; you approve every article."
        actions={
          <Link href="/admin/seo/findings" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-3.5 py-2 text-[0.7rem] font-bold text-ink-700 hover:border-brand-300">
            Open findings
          </Link>
        }
      />

      <section className="rounded-2xl border border-mist-200 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Search visibility</p>
            <h2 className="mt-0.5 text-[0.95rem] font-extrabold tracking-tight text-ink-950">Google Search Console · last 28 days</h2>
          </div>
          <span className="text-[0.64rem] font-semibold text-ink-600/55">{visibility ? `${visibility.days} day${visibility.days === 1 ? "" : "s"} with data · latest ${visibility.latest}` : "Waiting for a sync"}</span>
        </div>
        {visibility ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Clicks", visibility.clicks.toLocaleString("en-US")],
                ["Impressions", visibility.impressions.toLocaleString("en-US")],
                ["CTR", `${visibility.ctr.toFixed(1)}%`],
                ["Avg. position", visibility.position === null ? "—" : visibility.position.toFixed(1)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-mist-200 bg-mist-50/60 p-3">
                  <p className="text-[0.56rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60">{label}</p>
                  <p className="mt-1 text-[1.15rem] font-extrabold text-ink-950">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.72rem] leading-relaxed text-ink-600/75">
              {visibility.position === null
                ? "Search Console is returning impressions without position data yet."
                : visibility.position > 20
                  ? "Most impressions are landing on pages 3–5. The technical site is healthy; the next gain comes from stronger page depth, more specific query targeting, internal links and earned authority. Use the ideas below to publish content that matches those queries."
                  : "Pages are close to the first page. Improve titles and meta descriptions for the queries you already rank for, then add depth to the pages with the most impressions."}
            </p>
          </>
        ) : (
          <p className="mt-3 text-[0.72rem] leading-relaxed text-ink-600/70">No stored Search Console rows yet. Connect Search Console below or wait for the next scheduled sync. Nothing is estimated.</p>
        )}
      </section>

      <SeoControlCenter />
      <SearchConsoleConnection />
      <details className="group rounded-2xl border border-mist-200 bg-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3.5 text-[0.76rem] font-extrabold text-ink-800">
          Advanced: full technical crawl
          <span className="text-[0.64rem] font-semibold text-ink-600/55">Run a deeper manual audit</span>
        </summary>
        <div className="border-t border-mist-100 p-4">
          <SeoAudit />
        </div>
      </details>
    </div>
  );
}
