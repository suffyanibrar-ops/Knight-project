/**
 * Conversion UX regression: three-choice consent, no floating cookie button,
 * clean first viewport and the footer re-open path.
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
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await context.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch {} });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(4200);

const banner = page.locator('[role="dialog"][aria-labelledby="consent-title"]');
ok("first visit shows compact consent dialog", await banner.isVisible());
const labels = await banner.locator("button").allTextContents();
ok("consent offers exactly the three primary choices", ["Accept all", "Reject all", "Essential only"].every((label) => labels.includes(label)), labels.join(" | "));
ok("no persistent floating cookie control", (await page.locator('button[aria-label^="Cookie settings"]').count()) === 0);
ok("no offer is shown immediately on the homepage", (await page.locator('[role="dialog"][aria-labelledby="conversion-offer-title"]').count()) === 0);
ok("hero shows one primary decision and one secondary", (await page.getByRole("link", { name: /Review Your Revenue Cycle/ }).count()) === 1 && (await page.getByRole("link", { name: /See How Knight Works/ }).count()) === 1);
ok("legacy long hero paragraph is absent", !(await page.locator("[data-hero-reveal]").innerText()).includes("From eligibility checks to final payment posting"));

await page.getByRole("button", { name: "Accept all" }).click();
await page.waitForTimeout(300);
ok("banner closes after a choice", !(await banner.isVisible().catch(() => false)));
const accepted = await page.evaluate(() => JSON.parse(localStorage.getItem("kmb-consent") || "null"));
ok("accept-all consent is stored", accepted?.decision === "accepted" && accepted?.categories?.analytics === true);

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Cookie settings" }).click();
await page.waitForTimeout(300);
ok("footer link reopens cookie settings", await banner.isVisible());
await page.getByRole("button", { name: "Close cookie settings" }).click();

// ---------- the low-friction path from an offer CTA ----------
await page.goto(BASE + "/schedule-form?concern=denials", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
ok("the concern carried by an offer CTA is named on the form", /Starting from your concern:\s*Denials/i.test(await page.locator("body").innerText()));
ok("the matching concern chip is preselected", (await page.getByRole("button", { name: "Denials", exact: true }).getAttribute("aria-pressed")) === "true");
ok("the form still starts with the normal first step", await page.getByRole("textbox", { name: /Full name/ }).isVisible());

await page.goto(BASE + "/schedule-form", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
ok("no concern is preselected without a parameter", (await page.locator('button[aria-pressed="true"][type="button"]').filter({ hasText: /Denials|Billing & claims|Credentialing/ }).count()) === 0);

const essentialContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await essentialContext.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch {} });
const mobile = await essentialContext.newPage();
await mobile.goto(BASE + "/", { waitUntil: "networkidle" });
await mobile.waitForTimeout(4200);
const mobileBanner = mobile.locator('[role="dialog"][aria-labelledby="consent-title"]');
const box = await mobileBanner.boundingBox();
ok("mobile consent fits the viewport", Boolean(box && box.width <= 390 && box.y >= 0 && box.y + box.height <= 844), JSON.stringify(box));
await mobile.getByRole("button", { name: "Essential only" }).click();
await mobile.waitForTimeout(300);
const essential = await mobile.evaluate(() => JSON.parse(localStorage.getItem("kmb-consent") || "null"));
ok("essential-only keeps optional storage off", essential?.decision === "essential" && essential?.categories?.analytics === false);
ok("no horizontal overflow after consent", (await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) === true);
ok("essential-only does not write offer storage", (await mobile.evaluate(() => !localStorage.getItem("kmb-offer-state") && !sessionStorage.getItem("kmb-offer-session"))) === true);

ok("no browser errors", errors.length === 0, errors.join(" | "));
await essentialContext.close();
await context.close();
await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
