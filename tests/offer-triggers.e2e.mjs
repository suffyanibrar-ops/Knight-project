/** Real-browser checks for the contextual offer system and its consent boundary. */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const BANNER = '[role="dialog"][aria-labelledby="consent-title"]';
const OFFER = '[role="dialog"][aria-labelledby="conversion-offer-title"]';

let pass = 0;
let fail = 0;
const ok = (name, condition, detail = "") => {
  if (condition) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const browser = await chromium.launch();

async function newPage(contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 140)));
  return { context, page, errors };
}

async function firstVisit(page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector(BANNER, { state: "visible", timeout: 10_000 });
  return page.locator(BANNER);
}

async function choose(page, label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function scrollTo(page, fraction = 0.6) {
  await page.evaluate((f) => {
    window.scrollTo(0, Math.round(document.documentElement.scrollHeight * f));
  }, fraction);
  await page.waitForTimeout(500);
}

async function exitIntent(page) {
  await page.evaluate(() => {
    document.documentElement.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, clientY: 2, relatedTarget: null }));
  });
}

// ---------- A. fresh visitor gets the three-choice banner ----------
{
  const { context, page, errors } = await newPage();
  const banner = await firstVisit(page);
  const labels = await banner.getByRole("button").allInnerTexts();
  ok("fresh visitor sees the banner after the intro", await banner.isVisible());
  ok("all three choices are available", ["Accept all", "Reject all", "Essential only"].every((label) => labels.includes(label)), labels.join(" | "));
  ok("first-visit consent has no close icon", (await page.getByRole("button", { name: "Close cookie settings" }).count()) === 0);

  await choose(page, "Reject all");
  ok("banner closes immediately on choice", !(await banner.isVisible().catch(() => false)));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kmb-consent") || "null"));
  ok("reject-all is stored without optional consent", stored?.decision === "rejected" && stored?.categories?.analytics === false && stored?.categories?.functional === false);
  ok("reject-all writes no analytics", (await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("kmb-analytics")))) === false);

  await page.goto(BASE + "/services/denial-management", { waitUntil: "networkidle" });
  ok("returning visitor is not asked again", (await page.locator(BANNER).count()) === 0);
  await scrollTo(page, 0.6);
  await page.waitForTimeout(13_000);
  await exitIntent(page);
  const offer = page.locator(OFFER);
  let shown = false;
  try {
    await offer.waitFor({ state: "visible", timeout: 4_000 });
    shown = true;
  } catch {
    shown = false;
  }
  ok("engaged exit intent shows the contextual denial offer without optional consent", shown);
  ok("the offer copy is page-specific", shown && /recurring denials/i.test(await offer.innerText()));
  ok("no offer state is written without functional consent", (await page.evaluate(() => !localStorage.getItem("kmb-offer-state") && !sessionStorage.getItem("kmb-offer-session"))) === true);

  if (shown) {
    const dialog = page.locator(OFFER);
    ok("dialog exposes an accessible name and description", Boolean(await dialog.getAttribute("aria-labelledby")) && (await dialog.getAttribute("aria-modal")) === "true");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    ok("Escape closes the offer", (await page.locator(OFFER).count()) === 0);
    ok("focus leaves the dialog after closing", (await page.evaluate(() => !document.activeElement?.closest('[aria-labelledby="conversion-offer-title"]'))) === true);

    // A second attempt in the same page session must stay quiet.
    await page.waitForTimeout(3_200);
    await exitIntent(page);
    await page.waitForTimeout(1_200);
    ok("the same session never interrupts twice", (await page.locator(OFFER).count()) === 0);
  }

  await page.goto(BASE + "/schedule-form", { waitUntil: "networkidle" });
  await scrollTo(page, 0.5);
  await page.waitForTimeout(13_000);
  await exitIntent(page);
  await page.waitForTimeout(1_500);
  ok("schedule page never shows a promotional offer", (await page.locator(OFFER).count()) === 0);
  ok("no browser errors during consent/offer flows", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---------- B. accept-all persists state, conversion suppresses ----------
{
  const { context, page } = await newPage();
  await firstVisit(page);
  await choose(page, "Accept all");
  await page.goto(BASE + "/services/accounts-receivable-management", { waitUntil: "networkidle" });
  await scrollTo(page, 0.6);
  await page.waitForTimeout(13_000);
  await exitIntent(page);
  const offer = page.locator(OFFER);
  let shown = false;
  try {
    await offer.waitFor({ state: "visible", timeout: 4_000 });
    shown = true;
  } catch {
    shown = false;
  }
  ok("service page offers the A/R review after engagement", shown && /A\/R aging tells a story/i.test(await offer.innerText()));
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("kmb-offer-state") || "null"));
  ok("functional consent allows offer state to persist", state?.shown === 1);
  if (shown) {
    await page.getByRole("button", { name: "Close this offer" }).click();
    await page.waitForTimeout(300);
    const dismissed = await page.evaluate(() => JSON.parse(localStorage.getItem("kmb-offer-state") || "null"));
    ok("dismissal is remembered", Boolean(dismissed?.dismissedOffers?.["service-accounts-receivable"]));
  }

  // Cooldown survives a full reload once remembered.
  await page.reload({ waitUntil: "networkidle" });
  await scrollTo(page, 0.6);
  await page.waitForTimeout(13_000);
  await exitIntent(page);
  await page.waitForTimeout(1_500);
  ok("same-offer cooldown survives reload", (await page.locator(OFFER).count()) === 0);

  // A submitted lead suppresses future promotional offers.
  await page.goto(BASE + "/why-knight", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("kmb:conversion", { detail: { event: "lead_form_submit" } }));
  });
  await page.waitForTimeout(300);
  const converted = await page.evaluate(() => JSON.parse(localStorage.getItem("kmb-offer-state") || "null"));
  ok("lead submission records conversion", Boolean(converted?.convertedAt));
  await scrollTo(page, 0.5);
  await page.waitForTimeout(13_000);
  await exitIntent(page);
  await page.waitForTimeout(1_500);
  ok("converted visitors are not interrupted", (await page.locator(OFFER).count()) === 0);
  await context.close();
}

// ---------- C. essential-only stays usable and still allows in-memory offers ----------
{
  const { context, page, errors } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const banner = await firstVisit(page);
  const box = await banner.boundingBox();
  ok("mobile consent fits the viewport", Boolean(box && box.x >= 0 && box.y >= 0 && box.y + box.height <= 844), JSON.stringify(box));
  await choose(page, "Essential only");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kmb-consent") || "null"));
  ok("essential-only is stored with optional categories off", stored?.decision === "essential" && stored?.categories?.functional === false);

  await page.goto(BASE + "/services/medical-billing-and-coding", { waitUntil: "networkidle" });
  ok("mobile has no horizontal overflow", (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) === true);
  await scrollTo(page, 0.7);
  await page.waitForTimeout(46_000);
  const offer = page.locator(OFFER);
  let shown = false;
  try {
    await offer.waitFor({ state: "visible", timeout: 5_000 });
    shown = true;
  } catch {
    shown = false;
  }
  ok("mobile high-intent dwell surfaces the workflow offer", shown);
  if (shown) {
    const cta = page.getByRole("link", { name: /Review the Workflow/i });
    ok("mobile CTA is visible and reachable", await cta.isVisible());
    const close = page.getByRole("button", { name: "Close this offer" });
    ok("mobile close control is visible", await close.isVisible());
    const offerBox = await page.locator(OFFER).boundingBox();
    ok("offer fits the mobile viewport", Boolean(offerBox && offerBox.x >= 0 && offerBox.y >= 0 && offerBox.y + offerBox.height <= 860), JSON.stringify(offerBox));
    await close.click();
    await page.waitForTimeout(300);
    ok("mobile offer dismisses cleanly", (await page.locator(OFFER).count()) === 0);
  }
  ok("no mobile browser errors", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---------- E. homepage offers only after real engagement ----------
{
  const { context, page } = await newPage();
  await firstVisit(page);
  await choose(page, "Essential only");
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2_000);
  ok("homepage never offers on arrival", (await page.locator(OFFER).count()) === 0);
  await scrollTo(page, 0.7);
  await page.waitForTimeout(36_000);
  let shown = false;
  try {
    await page.locator(OFFER).waitFor({ state: "visible", timeout: 4_000 });
    shown = true;
  } catch {
    shown = false;
  }
  ok("homepage engagement reaches the revenue-cycle offer", shown && /losing momentum/i.test(await page.locator(OFFER).innerText()));
  await context.close();
}

// ---------- D. form focus suppresses the interruption ----------
{
  const { context, page } = await newPage();
  await firstVisit(page);
  await choose(page, "Accept all");
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await scrollTo(page, 0.75);
  await page.waitForTimeout(13_000);
  const email = page.locator('footer input[type="email"]').first();
  if ((await email.count()) > 0) {
    await email.click();
    await exitIntent(page);
    await page.waitForTimeout(1_200);
    ok("an active form suppresses the offer", (await page.locator(OFFER).count()) === 0);
  } else {
    ok("an active form suppresses the offer (no newsletter form found)", false);
  }
  await context.close();
}

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
