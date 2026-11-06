/**
 * Conversion / trust upgrade regression.
 * Verifies the broadened positioning, navigation, consultation-request wording,
 * honest results framing, switching page and diagnostic analytics.
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));
const waitForIntro = async () => {
  await page.waitForFunction(() => {
    const intro = document.querySelector("[data-site-intro]");
    return !intro || getComputedStyle(intro).display === "none" || getComputedStyle(intro).visibility === "hidden";
  }, undefined, { timeout: 5000 }).catch(() => {});
};

// ---- home: broad positioning, new nav, no stale performance claims ----
await page.goto(`${BASE}/?utm_source=regression&utm_medium=e2e`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro();
const homeText = await page.locator("main, body").first().innerText();
ok("hero names independent practices", /independent practices/i.test(homeText), homeText.slice(0, 350));
ok("hero names hospitals and health systems", /hospitals/i.test(homeText) && /health systems/i.test(homeText));
ok("homepage includes why organizations consider a change", /Why organizations consider a change/i.test(homeText));
ok("homepage no longer repeats 99.9% acceptance", !/99\.9%/.test(homeText));
ok("homepage no longer promises 24-hour filing", !/24 hours|24 hrs|24-hour/i.test(homeText));
ok("homepage no longer promises 24/5 support", !/24\/5/.test(homeText));
ok("homepage no longer promises a five-day start", !/5-day|five days|five-day/i.test(homeText));

const navLabels = (await page.locator("header nav[aria-label='Primary'] > div > a").allInnerTexts()).map((label) => label.trim()).filter(Boolean);
ok("navigation exposes Who We Serve and Results", JSON.stringify(navLabels) === JSON.stringify(["Services", "Specialties", "Who We Serve", "Results", "Resources", "Company"]), navLabels.join(" | "));
ok("navigation has the Talk With Knight CTA", (await page.locator('header a[href="/schedule-form"]').innerText()).includes("Talk With Knight"));

// ---- diagnostic: stage guidance + analytics event with UTM ----
await page.evaluate(() => {
  window.__conversions = [];
  window.addEventListener("kmb:conversion", (event) => window.__conversions.push(event.detail));
});
const leak = page.locator("#revenue-leak");
await leak.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await leak.getByRole("tab", { name: /Coding/i }).click();
await page.waitForTimeout(400);
const diagnosticText = await leak.innerText();
ok("diagnostic explains what to monitor", /What to monitor/i.test(diagnosticText));
ok("diagnostic has an exploration CTA", /Explore my revenue bottleneck/i.test(diagnosticText));
await page.waitForTimeout(200);
const conversions = await page.evaluate(() => window.__conversions);
const started = conversions.find((item) => item.event === "revenue_diagnostic_started");
ok("diagnostic fires a started event", Boolean(started), JSON.stringify(conversions));
ok("diagnostic event carries first-touch UTM", started?.utm_source === "regression", JSON.stringify(started));

// ---- switching page ----
await page.goto(BASE + "/switching-medical-billing", { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro();
const switchingText = await page.locator("body").innerText();
ok("switching page exists with a clear heading", /Change the partner/i.test(switchingText));
ok("switching page explains existing A/R", /existing A\/R/i.test(switchingText));
ok("switching page explains pricing factors", /Why medical billing pricing varies/i.test(switchingText));
ok("switching page avoids a fixed transition timeline", !/within five days|5-day/i.test(switchingText));

// ---- consultation request wording ----
await page.goto(BASE + "/schedule-form", { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro();
const scheduleText = await page.locator("body").innerText();
ok("consultation page is framed as a request", /Request a consultation/i.test(scheduleText));
ok("consultation page says it is not an instant booking", /does not instantly book|does not immediately book/i.test(scheduleText));
ok("consultation page explains what happens next", /What happens next/i.test(scheduleText) && /We review your needs/i.test(scheduleText));
ok("consultation page has three next steps", /Tell us about your organization/i.test(scheduleText) && /We follow up/i.test(scheduleText));

// ---- results honesty ----
await page.goto(BASE + "/results", { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro();
const resultsText = await page.locator("body").innerText();
ok("results frame the calculator as illustrative", /illustrative|modelled|model/i.test(resultsText));
ok("results include an outcome disclaimer", /Actual outcomes depend/i.test(resultsText));
ok("results no longer publish 99.9% or 24-hour claims", !/99\.9%|24 hours|24 hrs|24\/5|5-day/i.test(resultsText));

// ---- AI opening entry points ----
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro();
await page.getByRole("button", { name: /open knight ai assistant/i }).click();
await page.waitForTimeout(1200);
const widgetText = await page.locator('[role="dialog"]').innerText();
ok("AI offers concern-led quick starts", /Improve A\/R/i.test(widgetText) && /Reduce denials/i.test(widgetText) && /Not sure where to start/i.test(widgetText));
ok("AI still offers a booking action", /Book a 15-min call/i.test(widgetText));
ok("AI still offers a human handoff", /Talk to a person/i.test(widgetText));

ok("no browser errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
