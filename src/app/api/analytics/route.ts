import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedAnalyticsEvent,
  pruneAnalyticsIfDue,
  recordAnalyticsEvent,
  recordEngagement,
  recordPageview,
} from "@/lib/analytics";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { forbiddenResponse, isSameOrigin } from "@/lib/request-security";
import { sqliteHandle } from "@/lib/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "kmb_analytics_visitor";
const SESSION_COOKIE = "kmb_analytics_session";
const SESSION_MAX_AGE = 30 * 60;
const VISITOR_MAX_AGE = 365 * 24 * 60 * 60;
const BOT_RE = /bot|crawler|spider|crawl|headless|lighthouse|pagespeed|pingdom|uptime|monitor|preview|facebookexternalhit|slurp|bingpreview|google-inspectiontool|SEMrushBot|AhrefsBot/i;

function secret(): string {
  return process.env.ANALYTICS_HASH_SALT?.trim() || process.env.ADMIN_SESSION_SECRET?.trim() || "kmb-first-party-analytics";
}
function hash(value: string): string {
  return createHash("sha256").update(`${secret()}:${value}`).digest("hex").slice(0, 32);
}
function validRaw(value: string | undefined): value is string {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}
function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}
function path(value: unknown): string | undefined {
  const raw = str(value, 300);
  if (!raw || !raw.startsWith("/") || raw.startsWith("/admin") || raw.startsWith("/api")) return undefined;
  return raw.split("?")[0].slice(0, 200) || "/";
}
function utm(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"];
  const result: Record<string, string> = {};
  for (const key of keys) {
    const item = str(source[key], 120);
    if (item) result[key] = item;
  }
  return result;
}
function deviceFromUserAgent(userAgent: string): { device: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase();
  const device = /ipad|tablet|kindle|playbook/.test(ua) ? "tablet" : /mobile|iphone|ipod|android.*mobile|windows phone/.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//.test(ua) ? "Edge" : /opr\//.test(ua) ? "Opera" : /firefox\//.test(ua) ? "Firefox" : /chrome\//.test(ua) ? "Chrome" : /safari\//.test(ua) ? "Safari" : "Other";
  const os = /windows/.test(ua) ? "Windows" : /iphone|ipad|ipod/.test(ua) ? "iOS" : /android/.test(ua) ? "Android" : /mac os x/.test(ua) ? "macOS" : /linux/.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}
function country(request: NextRequest): { country?: string; region?: string } {
  return {
    country: request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country") ?? request.headers.get("x-country-code") ?? request.headers.get("x-geo-country") ?? undefined,
    region: request.headers.get("cf-region") ?? request.headers.get("x-vercel-ip-country-region") ?? request.headers.get("x-geo-region") ?? undefined,
  };
}
function referrerHost(referrer: string | undefined): string | undefined {
  if (!referrer) return undefined;
  try { return new URL(referrer).hostname.replace(/^www\./, "") || undefined; } catch { return undefined; }
}

function sourceFrom(referrer: string | undefined, utms: Record<string, string>): { source: string; medium?: string; campaign?: string; referrer?: string } {
  if (utms.utm_source) return { source: utms.utm_source, medium: utms.utm_medium, campaign: utms.utm_campaign };
  if (!referrer) return { source: "direct" };
  try {
    const url = new URL(referrer);
    return { source: url.hostname.replace(/^www\./, ""), medium: "referral", referrer: url.hostname };
  } catch {
    return { source: "direct" };
  }
}
function isBot(request: NextRequest, body: Record<string, unknown>): boolean {
  const testWebDriver = process.env.ANALYTICS_ALLOW_TEST === "1" && body.webdriver === true;
  if (testWebDriver) return false;
  if (body.webdriver === true) return true;
  return BOT_RE.test(request.headers.get("user-agent") ?? "");
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbiddenResponse();

  const limit = checkRateLimit({ key: `analytics:${clientKey(request)}`, limit: 120, windowMs: 60_000 });
  if (!limit.allowed) return new NextResponse(null, { status: 429 });

  pruneAnalyticsIfDue();

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return new NextResponse(null, { status: 400 }); }
  if (!body || typeof body !== "object" || isBot(request, body)) return new NextResponse(null, { status: 204 });

  const event = str(body.event, 20);
  if (event !== "pageview" && event !== "engagement" && event !== "event" && event !== "exit") return new NextResponse(null, { status: 400 });
  const routePath = path(body.path);
  if (!routePath) return new NextResponse(null, { status: 400 });

  const visitorRaw = validRaw(request.cookies.get(VISITOR_COOKIE)?.value) ? request.cookies.get(VISITOR_COOKIE)!.value : randomUUID();
  let sessionRaw = validRaw(request.cookies.get(SESSION_COOKIE)?.value) ? request.cookies.get(SESSION_COOKIE)!.value : randomUUID();
  const visitorId = hash(visitorRaw);
  let sessionId = hash(sessionRaw);

  // Expire idle sessions server-side rather than conflating a returning visitor
  // with an old session.
  const db = sqliteHandle();
  if (db && request.cookies.get(SESSION_COOKIE)?.value) {
    try {
      const existing = db.prepare("SELECT last_seen_at FROM analytics_sessions WHERE session_id = ?").get(sessionId) as { last_seen_at?: number } | undefined;
      if (!existing || Date.now() - Number(existing.last_seen_at ?? 0) > SESSION_MAX_AGE * 1000) {
        sessionRaw = randomUUID();
        sessionId = hash(sessionRaw);
      }
    } catch { /* schema not migrated yet; keep the new session */ }
  }

  const utms = utm(body.utm);
  const referrer = str(body.referrer, 500);
  const source = sourceFrom(referrer, utms);
  const geo = country(request);
  const ua = deviceFromUserAgent(request.headers.get("user-agent") ?? "");
  const common = {
    sessionId,
    visitorId,
    path: routePath,
    title: str(body.title, 300),
    referrer: source.referrer ?? referrerHost(referrer),
    source: source.source,
    medium: source.medium,
    campaign: source.campaign,
    country: geo.country,
    region: geo.region,
    timezone: str(body.timezone, 80),
    language: str(body.language, 40),
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    viewport: str(body.viewport, 40),
  };

  let accepted = true;
  if (event === "pageview") accepted = recordPageview(common);
  else if (event === "engagement" || event === "exit") accepted = recordEngagement({ ...common, seconds: Number(body.seconds ?? 0), scrollDepth: Number(body.scrollDepth ?? 0), exit: event === "exit" });
  else {
    const name = str(body.name, 80);
    if (!name || !isAllowedAnalyticsEvent(name)) return new NextResponse(null, { status: 400 });
    accepted = recordAnalyticsEvent({ sessionId, visitorId, name, path: routePath });
    // Conversion events also keep the session fresh for the realtime view.
    recordEngagement({ ...common, seconds: 0, scrollDepth: 0 });
  }

  const response = new NextResponse(null, { status: accepted ? 204 : 503 });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(VISITOR_COOKIE, visitorRaw, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: VISITOR_MAX_AGE });
  response.cookies.set(SESSION_COOKIE, sessionRaw, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  return response;
}
