/**
 * Unified admin control center regression.
 * Requires ADMIN_PW and a running production build.
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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));

// Auth boundary: logged out page redirects and the traffic API refuses requests.
await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
ok("logged-out /admin redirects to login", /\/admin\/login/.test(page.url()), page.url());
const unauthApi = await context.request.get(BASE + "/api/admin/live-traffic?range=7d");
ok("logged-out traffic API is protected", unauthApi.status() === 401, String(unauthApi.status()));

await page.goto(BASE + "/admin/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="password"]', PW);
await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
await page.waitForTimeout(700);
ok("admin login succeeds", /\/admin(\/|$)/.test(page.url()) && !/login/.test(page.url()), page.url());

const cookies = await context.cookies();
const session = cookies.find((cookie) => cookie.name === "kmb_admin_session");
ok("admin session cookie is HttpOnly", Boolean(session?.httpOnly), JSON.stringify(session ?? {}));

// Overview
const overviewText = await page.locator("main").innerText();
ok("overview is the command center", /Command center/i.test(overviewText));
ok("overview includes system status", /Website/i.test(overviewText) && /Database/i.test(overviewText) && /Email/i.test(overviewText) && /AI agent/i.test(overviewText) && /Analytics/i.test(overviewText));
ok("overview reports GA4 honestly when disconnected", /Google Analytics is not connected/i.test(overviewText) && /GA4 not connected/i.test(overviewText));
ok("overview does not fabricate traffic zeros", !/Visitors today\s*0/i.test(overviewText), overviewText.slice(0, 500));
ok("overview has quick actions", /Quick actions/i.test(overviewText) && /View enquiries/i.test(overviewText));

// Grouped navigation
const navText = await page.locator("aside nav").innerText();
ok("navigation has command center group", /Command Center/i.test(navText) && /Live Traffic/i.test(navText));
ok("navigation has business, content, communication and system groups", /Business/i.test(navText) && /Content/i.test(navText) && /Communication/i.test(navText) && /System/i.test(navText));
ok("navigation includes all requested modules", ["Enquiries", "AI & Conversations", "ROI Opportunities", "SEO", "Email", "Subscribers", "Settings"].every((label) => navText.includes(label)), navText);

// Live Traffic
await page.goto(BASE + "/admin/traffic", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
const trafficText = await page.locator("main").innerText();
ok("Live Traffic is one unified module", /Live Traffic/i.test(trafficText) && /Pages/i.test(trafficText) && /Sources/i.test(trafficText) && /Visitors/i.test(trafficText) && /Conversions/i.test(trafficText));
ok("Live Traffic has six sections", (await page.getByRole("tab").count()) === 6, String(await page.getByRole("tab").count()));
ok("Live Traffic shows not-connected state", /Google Analytics is not connected/i.test(trafficText));
ok("Live Traffic does not show fake visitor counts", !/Website visitors\s*0/i.test(trafficText));
const trafficApi = await context.request.get(BASE + "/api/admin/live-traffic?range=7d");
const trafficBody = await trafficApi.json();
ok("traffic API is authenticated and honest", trafficApi.ok() && trafficBody.analytics.connected === false && trafficBody.live === null && trafficBody.traffic === null, JSON.stringify({ status: trafficApi.status(), connected: trafficBody.analytics?.connected }));
await page.getByRole("tab", { name: "Conversions" }).click();
await page.waitForTimeout(250);
ok("conversions still exposes SQLite business path", /Enquiries/i.test(await page.locator("main").innerText()) && /AI-qualified leads/i.test(await page.locator("main").innerText()));

// Content, email, inquiries, ROI, settings and AI module tabs
for (const [path, heading, expected] of [
  ["/admin/content", "Content", /Manage blog/i],
  ["/admin/outbox", "Email", /Recent delivery failures|How delivery works/i],
  ["/admin/inbox", "Enquiries", /Total submissions/i],
  ["/admin/estimates", "ROI Opportunities", /Modeled \/ illustrative opportunity/i],
  ["/admin/settings", "Settings", /GA4 reporting/i],
  ["/admin/ai", "AI & Conversations", /Conversations/i],
]) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const text = await page.locator("main").innerText();
  ok(`${heading} module loads`, text.includes(heading), text.slice(0, 160));
  ok(`${heading} module has expected content`, expected.test(text));
}
const aiText = await page.locator("main").innerText();
ok("AI module presents one tabbed area", ["Conversations", "Leads", "Appointments", "Handoffs", "Knowledge", "Settings"].every((label) => aiText.includes(label)));

// Mobile layout
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mobile.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ } });
const mobilePage = await mobile.newPage();
await mobilePage.goto(BASE + "/admin/traffic", { waitUntil: "domcontentloaded" });
await mobilePage.waitForTimeout(600);
const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("admin has no mobile horizontal overflow", overflow <= 1, `${overflow}px`);
await mobile.close();

// Logout
await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /sign out/i }).click();
await page.waitForTimeout(900);
ok("admin logout returns to login", /\/admin\/login/.test(page.url()), page.url());

ok("no admin browser errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
