/**
 * End-to-end first-party Live Traffic test:
 * collect real pageviews through the public API, render them in the admin
 * module, verify the conversion/export path and bot rejection, then clean up.
 */
import { chromium } from "playwright";
import Database from "better-sqlite3";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PW = process.env.ADMIN_PW;
const UNIQUE_PATH = `/traffic-test-${Date.now()}`;
let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));

const normalHeaders = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" };
const post = (data, headers = normalHeaders) => context.request.post(`${BASE}/api/analytics`, { headers, data });

// Real first-party collection — no synthetic analytics payload.
const first = await post({ event: "pageview", path: UNIQUE_PATH, title: "Traffic fixture", language: "en-US", timezone: "Asia/Karachi", viewport: "1440x900", webdriver: false, utm: { utm_source: "regression", utm_medium: "test" } });
await context.request.post(`${BASE}/api/analytics`, { headers: normalHeaders, data: { event: "engagement", path: UNIQUE_PATH, seconds: 12, scrollDepth: 64, webdriver: false } });
await context.request.post(`${BASE}/api/analytics`, { headers: normalHeaders, data: { event: "event", name: "consultation_request", path: UNIQUE_PATH, webdriver: false } });
ok("public analytics collection accepts a valid pageview", first.status() === 204, String(first.status()));

const botPath = `${UNIQUE_PATH}-bot`;
const bot = await post({ event: "pageview", path: botPath, webdriver: false }, { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" });
ok("bot traffic is discarded", bot.status() === 204, String(bot.status()));
const invalid = await post({ event: "pageview", path: "/admin/secret" });
ok("invalid analytics path is rejected", invalid.status() === 400, String(invalid.status()));

await page.goto(BASE + "/admin/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="password"]', PW);
await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
await page.waitForTimeout(600);
await page.goto(BASE + "/admin/traffic", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

const trafficText = await page.locator("main").innerText();
ok("Live Traffic renders first-party data", trafficText.includes(UNIQUE_PATH));
ok("Live Traffic does not identify individual visitors", !trafficText.includes("visitor_") && !trafficText.includes("session_"));
const api = await context.request.get(`${BASE}/api/admin/live-traffic?range=7d`);
const body = await api.json();
ok("first-party traffic API is authenticated", api.ok() && body.analytics?.connected === true && body.traffic?.available === true, JSON.stringify({ status: api.status(), connected: body.analytics?.connected }));
ok("live view reports recent activity", body.live?.activeLast5 >= 1, JSON.stringify(body.live));
ok("page report includes the tracked path", body.traffic?.pages?.some((item) => item.path === UNIQUE_PATH), JSON.stringify(body.traffic?.pages?.slice(0, 3)));
ok("conversion event is captured", body.conversions?.events?.some((item) => item.name === "consultation_request"), JSON.stringify(body.conversions?.events));

await page.getByRole("tab", { name: "Pages" }).click();
await page.waitForTimeout(250);
ok("Pages tab renders tracked pages", (await page.locator("main").innerText()).includes(UNIQUE_PATH));
await page.getByRole("tab", { name: "Conversions" }).click();
await page.waitForTimeout(250);
ok("Conversions tab shows the funnel and event list", /Conversion path/i.test(await page.locator("main").innerText()) && /consultation request/i.test(await page.locator("main").innerText()));
await page.getByRole("tab", { name: "Visitors" }).click();
await page.waitForTimeout(250);
ok("Visitors tab renders device/browser/OS aggregates", /Device/i.test(await page.locator("main").innerText()) && /Browser/i.test(await page.locator("main").innerText()) && /Operating system/i.test(await page.locator("main").innerText()));

const exported = await context.request.get(`${BASE}/api/admin/live-traffic/export?range=7d`);
const exportedText = await exported.text();
ok("traffic CSV export is authenticated", exported.ok() && /text\/csv/.test(exported.headers()["content-type"] ?? "") && exportedText.includes(UNIQUE_PATH), String(exported.status()));
ok("no browser errors in Live Traffic", errors.length === 0, errors.join(" | "));

// Clean up only the fixture rows and sessions created by this test.
const db = new Database("data/app.db");
db.prepare("DELETE FROM analytics_events WHERE path LIKE ? OR path LIKE ?").run(`%${UNIQUE_PATH}%`, `%${UNIQUE_PATH}-bot%`);
db.prepare("DELETE FROM analytics_pageviews WHERE path LIKE ? OR path LIKE ?").run(`%${UNIQUE_PATH}%`, `%${UNIQUE_PATH}-bot%`);
db.prepare("DELETE FROM analytics_sessions WHERE landing_path LIKE ? OR exit_path LIKE ?").run(`%${UNIQUE_PATH}%`, `%${UNIQUE_PATH}%`);
db.close();

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
