import "server-only";
import { emailChannelStatus } from "./email";
import { getAiSettings } from "./ai-config";
import { ga4Status, getGa4Live, getGa4Traffic, resolveTrafficRange } from "./ga4";
import { sqliteHandle, sqliteStatus } from "./sqlite";

type Row = Record<string, unknown>;

function queryAll(sql: string, params: unknown[] = []): Row[] {
  const raw = sqliteHandle();
  if (!raw) return [];
  try {
    return raw.prepare(sql).all(...params) as Row[];
  } catch {
    return [];
  }
}

function count(sql: string, params: unknown[] = []): number {
  const row = queryAll(sql, params)[0];
  return Number(row?.n ?? 0);
}

function number(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function string(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function sqliteDate(value: unknown): Date | null {
  if (typeof value === "number") return new Date(value);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text) ? `${text.replace(" ", "T")}Z` : text;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatWhen(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export type BusinessMetrics = {
  enquiries: number;
  enquiriesToday: number;
  consultationRequests: number;
  aiLeads: number;
  appointmentsUpcoming: number;
  appointmentsInRange: number;
  pendingHandoffs: number;
  emailSent: number;
  emailQueued: number;
  emailIssues: number;
  subscribers: number;
  roiEstimates: number;
  roiAverage: number;
};

export function getBusinessMetrics(days = 7, bounds?: { startDay: string; endDay: string }): BusinessMetrics {
  const now = Date.now();
  const startMs = bounds ? Date.parse(`${bounds.startDay}T00:00:00Z`) : now - Math.max(1, days) * 86_400_000;
  const endMs = bounds ? Date.parse(`${bounds.endDay}T23:59:59.999Z`) : now;
  const startDay = bounds?.startDay ?? isoDay(startMs);
  const hasEnd = Boolean(bounds);
  const textInRange = hasEnd
    ? "date(created_at) >= date(?) AND date(created_at) <= date(?)"
    : "date(created_at) >= date(?)";
  const textParams = hasEnd ? [startDay, bounds?.endDay] : [startDay];
  const epochRange = hasEnd
    ? "created_at >= ? AND created_at <= ?"
    : "created_at >= ?";
  const epochParams = hasEnd ? [startMs, endMs] : [startMs];
  return {
    enquiries: count(`SELECT COUNT(*) AS n FROM submissions WHERE ${textInRange}`, textParams),
    enquiriesToday: count("SELECT COUNT(*) AS n FROM submissions WHERE date(created_at) = date('now')"),
    consultationRequests: count(`SELECT COUNT(*) AS n FROM submissions WHERE ${textInRange} AND source <> 'contact-form'`, textParams),
    aiLeads: count(`SELECT COUNT(*) AS n FROM ai_leads WHERE ${epochRange}`, epochParams),
    appointmentsUpcoming: count("SELECT COUNT(*) AS n FROM ai_appointments WHERE starts_at_utc >= ? AND status = 'confirmed'", [now]),
    appointmentsInRange: count(`SELECT COUNT(*) AS n FROM ai_appointments WHERE ${epochRange}`, epochParams),
    pendingHandoffs: count("SELECT COUNT(*) AS n FROM ai_handoffs WHERE status <> 'resolved'"),
    emailSent: count(`SELECT COUNT(*) AS n FROM email_outbox WHERE status IN ('sent','delivered') AND ${epochRange}`, epochParams),
    emailQueued: count("SELECT COUNT(*) AS n FROM email_outbox WHERE status IN ('pending','queued')"),
    emailIssues: count("SELECT COUNT(*) AS n FROM email_outbox WHERE status IN ('failed','bounced','complained')"),
    subscribers: count("SELECT COUNT(*) AS n FROM subscribers"),
    roiEstimates: count(`SELECT COUNT(*) AS n FROM roi_estimates WHERE ${textInRange}`, textParams),
    roiAverage: Number(queryAll(`SELECT ROUND(AVG(estimated_annual_uplift), 0) AS n FROM roi_estimates WHERE ${textInRange}`, textParams)[0]?.n ?? 0),
  };
}

export type OverviewAlert = {
  key: string;
  tone: "warn" | "brand" | "bad";
  title: string;
  detail: string;
  href: string;
  action: string;
};

export type ActivityItem = {
  id: string;
  kind: "enquiry" | "ai_lead" | "appointment" | "handoff" | "subscriber" | "email" | "roi";
  title: string;
  detail: string;
  href: string;
  at: number;
};

export type OverviewData = {
  checkedAt: string;
  status: {
    website: boolean;
    database: { available: boolean; driver: string | null; path: string | null };
    email: { configured: boolean; channels: string[] };
    ai: { configured: boolean; enabled: boolean };
    analytics: { configured: boolean; propertyId: string | null; error: string | null };
  };
  traffic: {
    available: boolean;
    visitorsToday: number | null;
    activeNow: number | null;
    activeBasis: "5_minutes" | "30_minutes" | null;
    error: string | null;
  };
  business: BusinessMetrics;
  alerts: OverviewAlert[];
  activity: ActivityItem[];
};

function recentActivity(): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const row of queryAll("SELECT id, name, email, source, specialty, created_at FROM submissions ORDER BY created_at DESC, id DESC LIMIT 6")) {
    const at = sqliteDate(row.created_at)?.getTime() ?? 0;
    items.push({
      id: `enquiry-${row.id}`,
      kind: "enquiry",
      title: `New enquiry — ${string(row.name) || "Visitor"}`,
      detail: [string(row.source), string(row.specialty)].filter(Boolean).join(" · ") || "Website enquiry",
      href: `/admin/inbox?id=${row.id}`,
      at,
    });
  }
  for (const row of queryAll("SELECT id, name, email, organization, challenge, created_at FROM ai_leads ORDER BY created_at DESC LIMIT 5")) {
    items.push({
      id: `ai-lead-${row.id}`,
      kind: "ai_lead",
      title: `AI-qualified lead — ${string(row.name) || "Visitor"}`,
      detail: [string(row.organization), string(row.challenge)].filter(Boolean).join(" · ") || "Captured by the AI assistant",
      href: "/admin/ai/leads",
      at: number(row.created_at),
    });
  }
  for (const row of queryAll("SELECT id, name, starts_at_utc, status, timezone FROM ai_appointments ORDER BY created_at DESC LIMIT 5")) {
    items.push({
      id: `appointment-${row.id}`,
      kind: "appointment",
      title: `Appointment ${string(row.status)} — ${string(row.name) || "Visitor"}`,
      detail: `${formatWhen(new Date(number(row.starts_at_utc)))} · ${string(row.timezone)}`,
      href: "/admin/ai/appointments",
      at: number(row.starts_at_utc),
    });
  }
  for (const row of queryAll("SELECT id, name, email, reason, status, created_at FROM ai_handoffs ORDER BY created_at DESC LIMIT 5")) {
    items.push({
      id: `handoff-${row.id}`,
      kind: "handoff",
      title: `Human handoff — ${string(row.name) || "Visitor"}`,
      detail: string(row.reason).slice(0, 120),
      href: "/admin/ai/handoffs",
      at: number(row.created_at),
    });
  }
  for (const row of queryAll("SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC LIMIT 4")) {
    items.push({
      id: `subscriber-${row.id}`,
      kind: "subscriber",
      title: `New subscriber — ${string(row.email)}`,
      detail: "Newsletter opt-in",
      href: "/admin/subscribers",
      at: sqliteDate(row.created_at)?.getTime() ?? 0,
    });
  }
  for (const row of queryAll("SELECT id, to_email, subject, status, last_error, created_at FROM email_outbox WHERE status IN ('failed','bounced','complained') ORDER BY created_at DESC LIMIT 4")) {
    items.push({
      id: `email-${row.id}`,
      kind: "email",
      title: `Email ${string(row.status)} — ${string(row.subject).slice(0, 62)}`,
      detail: `${string(row.to_email)}${row.last_error ? ` · ${string(row.last_error).slice(0, 90)}` : ""}`,
      href: "/admin/outbox",
      at: number(row.created_at),
    });
  }
  for (const row of queryAll("SELECT id, email, estimated_annual_uplift, created_at FROM roi_estimates ORDER BY created_at DESC LIMIT 4")) {
    items.push({
      id: `roi-${row.id}`,
      kind: "roi",
      title: `ROI estimate — ${string(row.email) || "Anonymous"}`,
      detail: `$${number(row.estimated_annual_uplift).toLocaleString("en-US")} illustrative opportunity`,
      href: "/admin/estimates",
      at: sqliteDate(row.created_at)?.getTime() ?? 0,
    });
  }

  return items.filter((item) => item.at > 0).sort((a, b) => b.at - a.at).slice(0, 10);
}

export async function getAdminOverview(): Promise<OverviewData> {
  const business = getBusinessMetrics(7);
  const db = sqliteStatus();
  const email = emailChannelStatus();
  const aiSettings = getAiSettings();
  const analytics = ga4Status();
  const channels = [
    email.resend ? "Resend" : null,
    email.smtp ? "SMTP" : null,
    email.relay ? "FormSubmit relay" : null,
  ].filter(Boolean) as string[];

  let traffic: OverviewData["traffic"] = {
    available: false,
    visitorsToday: null,
    activeNow: null,
    activeBasis: null,
    error: analytics.configured ? null : "Google Analytics is not connected.",
  };

  if (analytics.configured) {
    const range = resolveTrafficRange("today", null, null);
    const [live, today] = await Promise.all([
      getGa4Live().catch(() => ({ available: false, activeLast5: null, activeLast30: 0, activeBasis: "30_minutes" as const, error: "Realtime analytics unavailable." })),
      getGa4Traffic(range).catch(() => ({ available: false, totals: { users: 0 }, error: "Analytics unavailable." })),
    ]);
    const liveAvailable = "available" in live ? live.available : false;
    const trafficAvailable = "available" in today ? today.available : false;
    traffic = {
      available: liveAvailable || trafficAvailable,
      visitorsToday: trafficAvailable ? today.totals.users : null,
      activeNow: liveAvailable ? (live.activeLast5 ?? live.activeLast30) : null,
      activeBasis: liveAvailable ? live.activeBasis : null,
      error: trafficAvailable || liveAvailable ? null : (today.error ?? live.error ?? "Analytics unavailable."),
    };
  }

  const alerts: OverviewAlert[] = [];
  if (!db.available) {
    alerts.push({ key: "database", tone: "bad", title: "Database unavailable", detail: db.error ?? "The application database could not be opened.", href: "/admin/settings", action: "Review storage" });
  }
  if (business.emailIssues > 0) {
    alerts.push({ key: "email-issues", tone: "warn", title: `${business.emailIssues} email${business.emailIssues === 1 ? "" : "s"} need attention`, detail: "Failed, bounced or complained deliveries are recorded in the email outbox.", href: "/admin/outbox", action: "Open email" });
  } else if (business.emailQueued > 0) {
    alerts.push({ key: "email-queued", tone: "brand", title: `${business.emailQueued} email${business.emailQueued === 1 ? "" : "s"} queued`, detail: "No delivery channel or provider retry is pending.", href: "/admin/outbox", action: "Review queue" });
  }
  if (business.pendingHandoffs > 0) {
    alerts.push({ key: "handoffs", tone: "warn", title: `${business.pendingHandoffs} human handoff${business.pendingHandoffs === 1 ? "" : "s"} pending`, detail: "Visitors are waiting for a human follow-up.", href: "/admin/ai/handoffs", action: "Open handoffs" });
  }
  if (business.appointmentsUpcoming > 0) {
    alerts.push({ key: "appointments", tone: "brand", title: `${business.appointmentsUpcoming} upcoming appointment${business.appointmentsUpcoming === 1 ? "" : "s"}`, detail: "Confirmed AI-booked calls are ahead on the calendar.", href: "/admin/ai/appointments", action: "View calendar" });
  }
  if (!analytics.configured) {
    alerts.push({ key: "analytics", tone: "brand", title: "Google Analytics is not connected", detail: "Traffic and visitor intelligence will remain unavailable until the GA4 property and service account are configured.", href: "/admin/settings", action: "Configure analytics" });
  } else if (!traffic.available) {
    alerts.push({ key: "analytics-error", tone: "warn", title: "Analytics is configured but reporting is unavailable", detail: traffic.error ?? "The GA4 Data API did not return a report. Check property access and service-account permissions.", href: "/admin/settings", action: "Review analytics" });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    alerts.push({ key: "ai-key", tone: "warn", title: "AI key is not configured", detail: "The public AI assistant is offline until a DeepSeek key is present.", href: "/admin/ai/settings", action: "Review AI" });
  }
  if (channels.length === 0) {
    alerts.push({ key: "email-channel", tone: "warn", title: "No email channel configured", detail: "Submissions are still saved, but owner notifications and visitor confirmations cannot deliver.", href: "/admin/settings", action: "Review email configuration" });
  }

  return {
    checkedAt: new Date().toISOString(),
    status: {
      website: true,
      database: { available: db.available, driver: db.driver, path: db.path },
      email: { configured: channels.length > 0, channels },
      ai: { configured: Boolean(process.env.DEEPSEEK_API_KEY), enabled: aiSettings.enabled },
      analytics: { configured: analytics.configured, propertyId: analytics.propertyId, error: analytics.error },
    },
    traffic,
    business,
    alerts,
    activity: recentActivity(),
  };
}

export { formatWhen };
