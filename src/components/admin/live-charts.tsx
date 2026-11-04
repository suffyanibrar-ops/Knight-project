"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, animate, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Clock,
  Inbox,
  Mail,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type {
  AnalyticsDelivery,
  AnalyticsPayload,
  AnalyticsRankedItem,
  AnalyticsRecentEnquiry,
  AnalyticsSeriesPoint,
  AnalyticsTotals,
} from "@/app/api/admin/analytics/route";
import { StatusPill } from "@/components/admin/ui";
import { EASE, transition, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Live owner dashboard.
 *
 * The dashboard is entirely client-driven: the server page renders this
 * component, which fetches /api/admin/analytics immediately and then every 15
 * seconds. All charts are hand-built SVG (no chart library) and use the admin
 * console's existing colour tokens. Animation is skipped for visitors who ask
 * for reduced motion (MotionConfig + usePrefersReducedMotion).
 */

const POLL_MS = 15_000;

type Tone = "default" | "good" | "warn" | "brand";

const TONES: Record<Tone, string> = {
  default: "border-mist-200 bg-surface text-ink-950",
  good: "border-mint-200 bg-mint-50/60 text-mint-700",
  warn: "border-amber-200 bg-amber-50/70 text-amber-700",
  brand: "border-brand-100 bg-brand-50/60 text-brand-800",
};

/* ------------------------------------------------------------------ */
/* Dashboard shell + polling                                           */
/* ------------------------------------------------------------------ */

export function LiveDashboard() {
  const reduced = usePrefersReducedMotion();
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/analytics", { cache: "no-store", signal });
      if (!response.ok) {
        throw new Error(response.status === 401 ? "Your admin session expired — sign in again." : `Analytics request failed (${response.status}).`);
      }
      const next = (await response.json()) as AnalyticsPayload;
      if (signal?.aborted) return;
      setPayload(next);
      setUpdatedAt(new Date());
      setError(null);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not reach the analytics endpoint.");
    }
  }, []);

  const refreshNow = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    // Kick the first request off after paint (an effect must not set state
    // synchronously); the interval and visibility listener then keep it live.
    const kickoff = window.setTimeout(() => void load(controller.signal), 0);

    // Poll every 15s, but never while the tab is hidden — refresh on return.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(controller.signal);
    }, POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load(controller.signal);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(kickoff);
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-4">
        <LiveBar reduced={reduced} error={error} updatedAt={updatedAt} refreshing={refreshing} onRefresh={refreshNow} />

        {!payload ? (
          <DashboardSkeleton />
        ) : (
          <>
            {!payload.available && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[0.74rem] leading-relaxed text-amber-800">
                <strong>The local database is unavailable.</strong> Live charts show an empty snapshot until SQLite can be opened — check the storage
                notice on the admin pages.
              </div>
            )}

            <KpiGrid totals={payload.totals} reduced={reduced} />

            <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
              <Panel title="14-day activity" icon={Activity} aside={<span className="text-[0.62rem] font-bold text-ink-600/60">Form submissions vs new enquiries</span>}>
                <TrendChart series={payload.series} reduced={reduced} />
              </Panel>

              <Panel
                title="Email delivery"
                icon={Mail}
                aside={
                  <Link href="/admin/outbox" className="text-[0.68rem] font-bold text-brand-700 hover:text-brand-500">
                    Open
                  </Link>
                }
              >
                <DeliveryRing delivery={payload.delivery} reduced={reduced} />
              </Panel>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Top specialties" icon={Sparkles}>
                <RankedBars items={payload.topSpecialties} tone="brand" reduced={reduced} empty="Specialties appear here after the first consultation request." />
              </Panel>
              <Panel title="Top sources" icon={TrendingUp}>
                <RankedBars items={payload.topSources} tone="mint" reduced={reduced} empty="Traffic sources appear here after the first form submission." />
              </Panel>
            </div>

            <Panel
              title="Recent enquiries"
              icon={Inbox}
              bodyClassName="p-0"
              aside={
                <Link href="/admin/inbox" className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-brand-700 hover:text-brand-500">
                  Open inbox <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            >
              <RecentEnquiries items={payload.recent} />
            </Panel>
          </>
        )}
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */
/* Live status bar                                                     */
/* ------------------------------------------------------------------ */

function LiveBar({
  reduced,
  error,
  updatedAt,
  refreshing,
  onRefresh,
}: {
  reduced: boolean;
  error: string | null;
  updatedAt: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          {!reduced && !error && (
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-mint-400"
              animate={{ scale: [1, 2.2], opacity: [0.65, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", error ? "bg-amber-400" : "bg-mint-500")} />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-[0.76rem] font-extrabold text-ink-950">
            {error ? "Reconnecting to analytics" : "Live analytics"}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[0.54rem] font-extrabold uppercase tracking-[0.12em]",
                error ? "bg-amber-100 text-amber-700" : "bg-mint-50 text-mint-700",
              )}
            >
              {error ? "Offline" : "Live"}
            </span>
          </p>
          <p className="mt-0.5 text-[0.64rem] text-ink-600/70">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Waiting for the first sync"}
            {" · "}
            polls every 15 seconds
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {error && <span className="max-w-[16rem] truncate text-[0.62rem] font-semibold text-amber-700">{error}</span>}
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh analytics now"
          className="grid h-8 w-8 place-items-center rounded-full border border-mist-200 text-ink-600/70 transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI cards with count-up                                             */
/* ------------------------------------------------------------------ */

function KpiGrid({ totals, reduced }: { totals: AnalyticsTotals; reduced: boolean }) {
  const cards: { label: string; value: number; hint: string; tone: Tone }[] = [
    { label: "Website submissions", value: totals.submissions, hint: `${totals.submissions7d} last 7 days · ${totals.submissions30d} last 30 days`, tone: "brand" },
    { label: "Newsletter subscribers", value: totals.subscribers, hint: "Opt-in email list", tone: "good" },
    { label: "ROI estimates", value: totals.roiEstimates, hint: "Calculator completions", tone: "default" },
    { label: "Emails sent", value: totals.emailsSent, hint: "Delivered to the recipient inbox", tone: "good" },
    { label: "Emails queued", value: totals.emailsQueued, hint: totals.emailsQueued > 0 ? "Waiting for a delivery channel" : "Nothing waiting", tone: totals.emailsQueued > 0 ? "warn" : "default" },
    {
      label: "Delivery issues",
      value: totals.emailsBounced + totals.emailsComplained,
      hint: `${totals.emailsBounced} bounced · ${totals.emailsComplained} complained`,
      tone: totals.emailsBounced + totals.emailsComplained > 0 ? "warn" : "default",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, index) => (
        <KpiCard key={card.label} {...card} reduced={reduced} delay={index * 0.05} />
      ))}
    </div>
  );
}

function KpiCard({ label, value, hint, tone, reduced, delay }: { label: string; value: number; hint: string; tone: Tone; reduced: boolean; delay: number }) {
  const display = useCountUp(value, !reduced);
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : transition(0.45, delay)}
      className={cn("rounded-2xl border p-4", TONES[tone])}
    >
      <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.14em] opacity-60">{label}</p>
      <p className="mt-1.5 text-[1.9rem] font-extrabold leading-none tracking-tight tabular-nums">{display.toLocaleString("en-US")}</p>
      <p className="mt-1.5 text-[0.68rem] opacity-60">{hint}</p>
    </motion.div>
  );
}

/** Smoothly counts a number up (or down) when live data changes. */
function useCountUp(target: number, enabled: boolean): number {
  const [display, setDisplay] = useState(0);
  // Last integer handed to the DOM, so an interrupted tween resumes from the
  // number the visitor can actually see instead of the previous target.
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled || latest.current === target) return;
    const controls = animate(latest.current, target, {
      duration: 0.65,
      ease: EASE,
      onUpdate: (value) => {
        const rounded = Math.round(value);
        latest.current = rounded;
        setDisplay(rounded);
      },
      onComplete: () => {
        latest.current = target;
      },
    });
    return () => controls.stop();
  }, [target, enabled]);

  // With reduced motion the final value is rendered immediately — no animation.
  return enabled ? display : target;
}

/* ------------------------------------------------------------------ */
/* 14-day area + line chart                                            */
/* ------------------------------------------------------------------ */

const CHART_WIDTH = 760;
const CHART_HEIGHT = 250;
const PAD = { top: 18, right: 16, bottom: 30, left: 38 };

type Point = { x: number; y: number };

function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let path = `M ${first.x} ${first.y}`;
  let previous = first;
  for (const point of rest) {
    const midX = (previous.x + point.x) / 2;
    path += ` C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
    previous = point;
  }
  return path;
}

function areaPath(points: Point[]): string {
  if (points.length === 0) return "";
  const bottom = PAD.top + (CHART_HEIGHT - PAD.top - PAD.bottom);
  const first = points[0];
  const last = points[points.length - 1];
  return `${smoothPath(points)} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
}

function TrendChart({ series, reduced }: { series: AnalyticsSeriesPoint[]; reduced: boolean }) {
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const innerWidth = CHART_WIDTH - PAD.left - PAD.right;
  const innerHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  const stepX = series.length > 1 ? innerWidth / (series.length - 1) : innerWidth;
  const max = Math.max(1, ...series.map((point) => Math.max(point.submissions, point.newEnquiries)));

  const xFor = (index: number) => PAD.left + index * stepX;
  const yFor = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight;

  const submissionPoints: Point[] = series.map((point, index) => ({ x: xFor(index), y: yFor(point.submissions) }));
  const enquiryPoints: Point[] = series.map((point, index) => ({ x: xFor(index), y: yFor(point.newEnquiries) }));

  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = (max / 4) * index;
    return { value, y: yFor(value) };
  });

  const visible = series.some((point) => point.submissions > 0 || point.newEnquiries > 0);
  const active = hover !== null ? series[hover] : null;

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const chartX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
    const index = series.length <= 1 ? 0 : Math.round((chartX - PAD.left) / stepX);
    setHover(Math.min(series.length - 1, Math.max(0, index)));
  };

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label="Area chart of form submissions and new enquiries over the last 14 days"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.26} />
              <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={`tick-${tick.value}`}>
              <line x1={PAD.left} x2={CHART_WIDTH - PAD.right} y1={tick.y} y2={tick.y} strokeDasharray="3 5" className="stroke-mist-200" />
              <text x={PAD.left - 8} y={tick.y + 3} textAnchor="end" fontSize={10} fill="var(--color-ink-600)" opacity={0.55}>
                {Math.round(tick.value)}
              </text>
            </g>
          ))}

          {series.map((point, index) =>
            index % 2 === 0 || index === series.length - 1 ? (
              <text key={`label-${point.date}-${index}`} x={xFor(index)} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--color-ink-600)" opacity={0.55}>
                {point.date}
              </text>
            ) : null,
          )}

          <motion.path
            d={areaPath(submissionPoints)}
            fill={`url(#${gradientId}-area)`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          />
          <motion.path
            d={smoothPath(submissionPoints)}
            fill="none"
            strokeWidth={2.6}
            strokeLinecap="round"
            className="stroke-brand-500"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <motion.path
            d={smoothPath(enquiryPoints)}
            fill="none"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray="6 5"
            className="stroke-mint-500"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
          />

          {active && hover !== null && (
            <g aria-hidden="true">
              <line x1={xFor(hover)} x2={xFor(hover)} y1={PAD.top} y2={PAD.top + innerHeight} strokeDasharray="4 4" className="stroke-mist-300" />
              <circle cx={xFor(hover)} cy={yFor(active.submissions)} r={4.5} strokeWidth={2} className="fill-brand-500 stroke-surface" />
              <circle cx={xFor(hover)} cy={yFor(active.newEnquiries)} r={4.5} strokeWidth={2} className="fill-mint-500 stroke-surface" />
            </g>
          )}
        </svg>

        {!visible && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className="rounded-full border border-mist-200 bg-surface/90 px-3 py-1.5 text-[0.7rem] font-semibold text-ink-600/70">No activity in the last 14 days</p>
          </div>
        )}

        <AnimatePresence>
          {active && hover !== null && (
            <motion.div
              key="chart-tooltip"
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none absolute top-2 z-10 min-w-[9rem] rounded-xl border border-mist-200 bg-surface px-3 py-2 shadow-lg"
              style={{ left: `${Math.min(86, Math.max(14, (xFor(hover) / CHART_WIDTH) * 100))}%`, transform: "translateX(-50%)" }}
            >
              <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.14em] text-ink-600/70">{active.date}</p>
              <p className="mt-1 flex items-center justify-between gap-3 text-[0.7rem] font-bold text-ink-900">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Submissions
                </span>
                <span className="tabular-nums">{active.submissions}</span>
              </p>
              <p className="mt-1 flex items-center justify-between gap-3 text-[0.7rem] font-bold text-ink-900">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> New enquiries
                </span>
                <span className="tabular-nums">{active.newEnquiries}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 px-1 text-[0.66rem] font-semibold text-ink-600/80">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> Form submissions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-mint-500" /> New enquiries
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-ink-600/60">
          <Clock className="h-3 w-3" /> Hover for a day
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Email delivery ring                                                 */
/* ------------------------------------------------------------------ */

type DeliveryKey = "sent" | "queued" | "failed" | "bounced" | "complained";

const DELIVERY_SEGMENTS: { key: DeliveryKey; label: string; dot: string; stroke: string }[] = [
  { key: "sent", label: "Sent", dot: "bg-mint-500", stroke: "stroke-mint-500" },
  { key: "queued", label: "Queued", dot: "bg-brand-400", stroke: "stroke-brand-400" },
  { key: "failed", label: "Failed", dot: "bg-amber-400", stroke: "stroke-amber-400" },
  { key: "bounced", label: "Bounced", dot: "bg-rose-400", stroke: "stroke-rose-400" },
  { key: "complained", label: "Complained", dot: "bg-ink-600", stroke: "stroke-ink-600" },
];

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function DeliveryRing({ delivery, reduced }: { delivery: AnalyticsDelivery; reduced: boolean }) {
  const total = DELIVERY_SEGMENTS.reduce((sum, segment) => sum + delivery[segment.key], 0);
  const displayTotal = useCountUp(total, !reduced);

  const values = DELIVERY_SEGMENTS.map((segment) => delivery[segment.key]);
  const lengths = values.map((value) => (total > 0 ? (value / total) * RING_CIRCUMFERENCE : 0));
  const segments = DELIVERY_SEGMENTS.map((segment, index) => ({
    ...segment,
    value: values[index],
    length: lengths[index],
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label={`Email delivery: ${total} messages`}>
        <circle cx="80" cy="80" r={RING_RADIUS} fill="none" strokeWidth={16} className="stroke-mist-100" />
        <g transform="rotate(-90 80 80)">
          {segments.map((segment) =>
            segment.length > 0 ? (
              <motion.circle
                key={segment.key}
                cx="80"
                cy="80"
                r={RING_RADIUS}
                fill="none"
                strokeWidth={16}
                className={segment.stroke}
                initial={reduced ? false : { strokeDasharray: `0 ${RING_CIRCUMFERENCE}` }}
                animate={{ strokeDasharray: `${Math.max(segment.length - 2, 0.5)} ${RING_CIRCUMFERENCE - Math.max(segment.length - 2, 0.5)}` }}
                strokeDashoffset={-segment.offset}
                transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              />
            ) : null,
          )}
        </g>
        <text x="80" y="78" textAnchor="middle" fontSize={26} fontWeight={800} fill="var(--color-ink-950)">
          {displayTotal}
        </text>
        <text x="80" y="95" textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--color-ink-600)" opacity={0.6}>
          EMAILS
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {DELIVERY_SEGMENTS.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-2 text-[0.72rem]">
            <span className="flex items-center gap-2 text-ink-700">
              <span className={cn("h-2 w-2 rounded-full", segment.dot)} />
              {segment.label}
            </span>
            <span className="font-extrabold tabular-nums text-ink-900">{delivery[segment.key]}</span>
          </li>
        ))}
        <li className="border-t border-mist-100 pt-1.5 text-[0.64rem] text-ink-600/70">
          {delivery.suppressed} suppressed address{delivery.suppressed === 1 ? "" : "es"}
        </li>
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked horizontal bars                                              */
/* ------------------------------------------------------------------ */

function RankedBars({
  items,
  tone,
  reduced,
  empty,
}: {
  items: AnalyticsRankedItem[];
  tone: "brand" | "mint";
  reduced: boolean;
  empty: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  if (items.length === 0) {
    return <p className="py-6 text-center text-[0.74rem] leading-relaxed text-ink-600/70">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[0.74rem] font-bold text-ink-900">{item.label}</span>
            <span className="text-[0.7rem] font-extrabold tabular-nums text-ink-600/80">{item.count}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist-100">
            <motion.div
              className={cn(
                "h-full rounded-full",
                tone === "brand" ? "bg-gradient-to-r from-brand-300 to-brand-500" : "bg-gradient-to-r from-mint-300 to-mint-500",
              )}
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${Math.max(4, Math.round((item.count / max) * 100))}%` }}
              transition={reduced ? { duration: 0 } : transition(0.7, 0.05 + index * 0.06)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Recent enquiries                                                    */
/* ------------------------------------------------------------------ */

function RecentEnquiries({ items }: { items: AnalyticsRecentEnquiry[] }) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[0.74rem] leading-relaxed text-ink-600/70">
        No enquiries yet. New website submissions appear here within 15 seconds.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-mist-100">
      {items.map((row) => (
        <li key={row.id}>
          <Link href="/admin/inbox" className="group flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-mist-50">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[0.8rem] font-extrabold text-ink-950">
                {row.name}
                <ArrowUpRight className="h-3 w-3 shrink-0 text-ink-600/30 transition-colors group-hover:text-brand-600" />
              </p>
              <p className="truncate text-[0.7rem] text-ink-600/75">
                {row.email}
                {row.specialty ? ` · ${row.specialty}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[0.62rem] tabular-nums text-ink-600/60">{formatTimestamp(row.createdAt)}</span>
              <StatusPill status={row.emailStatus} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* ------------------------------------------------------------------ */
/* Shared panel + loading skeleton                                     */
/* ------------------------------------------------------------------ */

function Panel({
  title,
  icon: Icon,
  aside,
  children,
  bodyClassName,
}: {
  title: string;
  icon: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-mist-200 bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-mist-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-[0.82rem] font-extrabold text-ink-950">
          <Icon className="h-4 w-4 text-brand-600" />
          {title}
        </h2>
        {aside}
      </div>
      <div className={cn("flex-1", bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-[6.6rem] animate-pulse rounded-2xl border border-mist-200 bg-mist-100/70" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="h-72 animate-pulse rounded-2xl border border-mist-200 bg-mist-100/70" />
        <div className="h-72 animate-pulse rounded-2xl border border-mist-200 bg-mist-100/70" />
      </div>
    </div>
  );
}

