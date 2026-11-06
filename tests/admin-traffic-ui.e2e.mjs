/**
 * Live Traffic rendering with a synthetic GA4 payload.
 * This validates the connected UI contract without requiring real analytics
 * credentials; the separate admin regression validates the honest
 * not-connected state.
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PW = process.env.ADMIN_PW;
let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};

const now = new Date().toISOString();
const payload = {
  ok: true,
  analytics: { connected: true, available: true, propertyIdMasked: "••••1234", error: null },
  range: { key: "7d", label: "Last 7 days", startDay: "2026-10-31", endDay: "2026-11-06", compareLabel: "previous 7 days" },
  live: {
    available: true, error: null, activeLast5: 7, activeLast30: 18, activeBasis: "5_minutes",
    pages: [{ label: "/", activeUsers: 4 }, { label: "/services", activeUsers: 2 }],
    devices: [{ label: "desktop", activeUsers: 5 }, { label: "mobile", activeUsers: 2 }],
    sources: [{ label: "google / organic", activeUsers: 4 }],
    countries: [{ label: "United States", activeUsers: 6 }],
    fetchedAt: now, warning: null,
  },
  traffic: {
    available: true, error: null,
    totals: { users: 2430, newUsers: 1900, sessions: 3100, pageViews: 7800, engagedSessions: 2100, engagementRate: 0.677, averageSessionDuration: 84 },
    previous: { users: 2050, newUsers: 1500, sessions: 2600, pageViews: 6400, engagedSessions: 1700, engagementRate: 0.65, averageSessionDuration: 78 },
    change: { users: 18.5, sessions: 19.2, pageViews: 21.9, engagedSessions: 23.5 },
    series: [{ date: "20261031", users: 110, sessions: 140, pageViews: 300 }, { date: "20261101", users: 160, sessions: 200, pageViews: 420 }, { date: "20261102", users: 250, sessions: 310, pageViews: 700 }],
    pages: [{ path: "/", views: 2200, users: 900, averageTime: 90, engagementRate: 0.7 }, { path: "/services", views: 1200, users: 500, averageTime: 75, engagementRate: 0.65 }],
    landingPages: [{ path: "/", users: 900, sessions: 1000 }],
    sources: [{ source: "Organic Search", users: 1400, sessions: 1700, engagedSessions: 1200, engagementRate: 0.7 }, { source: "Direct", users: 600, sessions: 800, engagedSessions: 500, engagementRate: 0.62 }],
    referrals: [{ source: "linkedin.com", medium: "referral", users: 40 }],
    visitors: { newVsReturning: [{ label: "new", users: 1900 }, { label: "returning", users: 530 }], devices: [{ label: "desktop", users: 1400 }], browsers: [{ label: "Chrome", users: 1500 }], countries: [{ label: "United States", users: 2100 }], cities: [{ label: "New York", users: 300 }] },
    warning: null,
  },
  business: { enquiries: 14, consultationRequests: 11, aiLeads: 8, appointmentsInRange: 5, pendingHandoffs: 1, emailIssues: 0, emailQueued: 0 },
  conversions: { stages: [{ key: "visitors", label: "Website visitors", value: 2430, source: "GA4" }, { key: "engaged", label: "Engaged sessions", value: 2100, source: "GA4" }, { key: "enquiries", label: "Enquiries", value: 14, source: "SQLite" }, { key: "ai_leads", label: "AI-qualified leads", value: 8, source: "SQLite" }, { key: "appointments", label: "Appointments", value: 5, source: "SQLite" }], rates: [{ key: "visitor_enquiry", label: "Visitor → enquiry", value: 0.0058 }], note: "Test data." },
  generatedAt: now,
  cached: false,
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));
await page.goto(BASE + "/admin/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="password"]', PW);
await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
await page.waitForTimeout(500);
await page.route("**/api/admin/live-traffic*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }));
await page.goto(BASE + "/admin/traffic", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.getByRole("tab", { name: "Traffic" }).click();
await page.waitForTimeout(250);
let text = await page.locator("main").innerText();
ok("connected traffic summary renders", /2,430/.test(text) && /Daily trend/i.test(text));
ok("comparison is rendered", /\+18\.5%/.test(text));
await page.getByRole("tab", { name: "Pages" }).click();
await page.waitForTimeout(200);
text = await page.locator("main").innerText();
ok("pages section renders page paths", /\/services/.test(text) && /Landing pages/i.test(text));
await page.getByRole("tab", { name: "Sources" }).click();
await page.waitForTimeout(200);
text = await page.locator("main").innerText();
ok("sources section renders acquisition channels", /Organic Search/.test(text) && /Referral sources/i.test(text));
await page.getByRole("tab", { name: "Visitors" }).click();
await page.waitForTimeout(200);
text = await page.locator("main").innerText();
ok("visitors section renders aggregates", /new vs returning|New vs returning/i.test(text) && /United States/.test(text));
await page.getByRole("tab", { name: "Conversions" }).click();
await page.waitForTimeout(200);
text = await page.locator("main").innerText();
ok("conversion funnel renders and is labelled", /Conversion path/i.test(text) && /Visitor → enquiry/i.test(text) && /GA4 \+ SQLite/i.test(text));
await page.getByRole("tab", { name: "Live" }).click();
await page.waitForTimeout(200);
text = await page.locator("main").innerText();
ok("live section renders active users honestly", /Active last 5 min/i.test(text) && /7/.test(text));
ok("no browser errors in connected traffic UI", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
