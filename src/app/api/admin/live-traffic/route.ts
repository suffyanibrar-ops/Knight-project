import { NextResponse } from "next/server";
import { limitAdmin, requireAdmin } from "@/lib/api-admin";
import { getBusinessMetrics } from "@/lib/admin-overview";
import { ga4Status, getGa4Live, getGa4Traffic, maskIdentifier, resolveTrafficRange } from "@/lib/ga4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CacheEntry = { at: number; payload: Awaited<ReturnType<typeof buildPayload>> };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 45_000;

async function buildPayload(request: Request) {
  const url = new URL(request.url);
  const range = resolveTrafficRange(url.searchParams.get("range"), url.searchParams.get("start"), url.searchParams.get("end"));
  const business = getBusinessMetrics(range.days ?? 7, { startDay: range.startDay, endDay: range.endDay });
  const analytics = ga4Status();
  const [live, traffic] = analytics.configured
    ? await Promise.all([
        getGa4Live().catch((error: unknown) => ({
          available: false,
          error: error instanceof Error ? error.message : "Unable to load realtime analytics.",
          activeLast5: null,
          activeLast30: 0,
          activeBasis: "30_minutes" as const,
          pages: [],
          devices: [],
          sources: [],
          countries: [],
          fetchedAt: new Date().toISOString(),
          warning: null,
        })),
        getGa4Traffic(range).catch((error: unknown) => ({
          available: false,
          error: error instanceof Error ? error.message : "Unable to load analytics.",
          totals: { users: 0, newUsers: 0, sessions: 0, pageViews: 0, engagedSessions: 0, engagementRate: 0, averageSessionDuration: 0 },
          previous: { users: 0, newUsers: 0, sessions: 0, pageViews: 0, engagedSessions: 0, engagementRate: 0, averageSessionDuration: 0 },
          change: { users: null, sessions: null, pageViews: null, engagedSessions: null },
          series: [],
          pages: [],
          landingPages: [],
          sources: [],
          referrals: [],
          visitors: { newVsReturning: [], devices: [], browsers: [], countries: [], cities: [] },
          warning: null,
        })),
      ])
    : [null, null] as const;

  const visitorCount = traffic?.available ? traffic.totals.users : null;
  const engagedCount = traffic?.available ? traffic.totals.engagedSessions : null;
  const rate = (value: number, base: number | null) => (base && base > 0 ? value / base : null);

  return {
    ok: true,
    analytics: {
      connected: analytics.configured,
      available: Boolean(live?.available || traffic?.available),
      propertyIdMasked: maskIdentifier(analytics.propertyId),
      error: analytics.configured ? (analytics.error ?? traffic?.error ?? live?.error ?? null) : "Google Analytics is not connected.",
    },
    range,
    live,
    traffic,
    business,
    conversions: {
      stages: [
        { key: "visitors", label: "Website visitors", value: visitorCount, source: "GA4" },
        { key: "engaged", label: "Engaged sessions", value: engagedCount, source: "GA4" },
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
      note: visitorCount === null ? "Website traffic is unavailable, so visitor-to-business rates cannot be calculated." : "Rates compare counted business records with GA4 users for the selected range. They are indicative, not deduplicated identities.",
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("live-traffic", 90);
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
    return NextResponse.json({ ok: false, error: "Unable to load traffic analytics. Try again." }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
