import { NextResponse } from "next/server";
import { limitAdmin, requireAdmin } from "@/lib/api-admin";
import { getBusinessMetrics } from "@/lib/admin-overview";
import { getAnalyticsLive, getAnalyticsSnapshot, resolveAnalyticsRange } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CacheEntry = { at: number; payload: Awaited<ReturnType<typeof buildPayload>> };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 5_000;

async function buildPayload(request: Request) {
  const url = new URL(request.url);
  const range = resolveAnalyticsRange(url.searchParams.get("range"), url.searchParams.get("start"), url.searchParams.get("end"));
  const business = getBusinessMetrics(range.days, {
    startDay: new Date(range.startMs).toISOString().slice(0, 10),
    endDay: new Date(range.endMs - 1).toISOString().slice(0, 10),
  });
  const snapshot = getAnalyticsSnapshot(range);
  const live = getAnalyticsLive();

  const visitorCount = snapshot.available ? snapshot.totals.users : null;
  const rate = (value: number, base: number | null) => (base && base > 0 ? value / base : null);
  const eventCount = (name: string) => snapshot.events.find((event) => event.name === name)?.count ?? 0;

  return {
    ok: true,
    analytics: {
      connected: snapshot.available,
      available: snapshot.available,
      propertyIdMasked: "",
      error: snapshot.error ?? live.error,
    },
    range: {
      key: range.key,
      label: range.label,
      startDay: new Date(range.startMs).toISOString().slice(0, 10),
      endDay: new Date(range.endMs - 1).toISOString().slice(0, 10),
      compareLabel: `previous ${range.days} day${range.days === 1 ? "" : "s"}`,
    },
    live,
    traffic: {
      ...snapshot,
      available: snapshot.available,
    },
    business,
    conversions: {
      stages: [
        { key: "visitors", label: "Unique visitors", value: visitorCount, source: "First-party" },
        { key: "sessions", label: "Sessions", value: snapshot.available ? snapshot.totals.sessions : null, source: "First-party" },
        { key: "pageviews", label: "Page views", value: snapshot.available ? snapshot.totals.pageViews : null, source: "First-party" },
        { key: "enquiries", label: "Enquiries", value: business.enquiries, source: "SQLite" },
        { key: "consultations", label: "Consultation requests", value: business.consultationRequests, source: "SQLite" },
        { key: "ai_leads", label: "AI-qualified leads", value: business.aiLeads, source: "SQLite" },
        { key: "appointments", label: "Appointments", value: business.appointmentsInRange, source: "SQLite" },
      ],
      rates: [
        { key: "visitor_enquiry", label: "Visitor → enquiry", value: rate(business.enquiries, visitorCount) },
        { key: "visitor_ai_lead", label: "Visitor → AI lead", value: rate(business.aiLeads, visitorCount) },
        { key: "visitor_appointment", label: "Visitor → appointment", value: rate(business.appointmentsInRange, visitorCount) },
      ],
      events: snapshot.events,
      note: visitorCount === null ? "Traffic is unavailable, so visitor-to-business rates cannot be calculated." : "Rates compare counted business records with unique first-party visitors for the selected range. They are indicative, not deduplicated identities.",
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("live-traffic", 180);
  if (limited) return limited;

  const url = new URL(request.url);
  const key = `${url.searchParams.get("range") ?? "7d"}|${url.searchParams.get("start") ?? ""}|${url.searchParams.get("end") ?? ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ ...cached.payload, cached: true }, { headers: { "cache-control": "no-store" } });
  }

  try {
    const payload = await buildPayload(request);
    cache.set(key, { at: Date.now(), payload });
    return NextResponse.json({ ...payload, cached: false }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[admin/live-traffic] report failed", error);
    return NextResponse.json({ ok: false, error: "Unable to load first-party analytics. Try again." }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
