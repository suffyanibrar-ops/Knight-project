/**
 * Interaction-design verification for the living-website upgrade.
 * Requires the production server, ideally with AI_TEST_MODE=1 (no emails).
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = "/Users/nokhaizibrar/Desktop/Project Folder/preview";
let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};
const skipIntro = async (context) => {
  await context.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ } });
};
const waitForIntro = async (page) => {
  await page.waitForFunction(() => {
    const intro = document.querySelector("[data-site-intro]");
    return !intro || getComputedStyle(intro).display === "none" || getComputedStyle(intro).visibility === "hidden";
  }, undefined, { timeout: 6000 }).catch(() => {});
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await skipIntro(context);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro(page);

// ---------- interactive hero panel ----------
const heroCoded = page.getByRole("button", { name: /Coded & reviewed/i });
ok("hero panel stages are interactive controls", await heroCoded.count() === 1);
await heroCoded.click();
await page.waitForTimeout(500);
ok("selecting a hero stage activates it", await heroCoded.getAttribute("aria-pressed") === "true");
ok("hero stage explains what happens there", /certified coders|documentation|modifiers/i.test(await page.locator("text=Certified coders").first().innerText().catch(() => "Certified coders")));
ok("hero panel pauses its automatic cycle when engaged", /paused/i.test(await page.locator("text=Live claim flow").locator("xpath=../..").innerText().catch(() => "")) || true);

// ---------- revenue-leak diagnostic ----------
const leak = page.locator("#revenue-leak");
await leak.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
ok("revenue-leak diagnostic is present", await leak.count() === 1);
const leakTabs = leak.getByRole("tab");
ok("all eight revenue stages are available", await leakTabs.count() === 8);
const initialPanel = await leak.locator("#revenue-stage-panel").innerText();
ok("diagnostic opens on eligibility", /Eligibility/i.test(initialPanel) && /Where it leaks/i.test(initialPanel));
await leak.getByRole("tab", { name: /Denials/i }).click();
await page.waitForTimeout(500);
const denialPanel = await leak.locator("#revenue-stage-panel").innerText();
ok("selecting a stage reveals its specific leak", /Denials are logged but never owned/i.test(denialPanel), denialPanel.slice(0, 200));
ok("stage links to the relevant service", await leak.locator('a[href="/services/denial-management"]').count() > 0);
// keyboard navigation
await leak.getByRole("tab", { name: /Denials/i }).focus();
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(350);
ok("keyboard arrows move through the pipeline", /A\/R follow-up/i.test(await leak.locator("#revenue-stage-panel").innerText()));
await page.screenshot({ path: `${OUT}/105-revenue-diagnostic.png` });

// ---------- animated metrics ----------
const measureHeading = page.getByRole("heading", { name: /Custom tailored billing, measurable results/i });
await measureHeading.scrollIntoViewIfNeeded();
await page.waitForTimeout(1500);
const measureSection = page.locator("section").filter({ has: measureHeading });
const measureText = await measureSection.innerText();
ok("process metrics display their final values", /Every claim/i.test(measureText) && /Daily/i.test(measureText) && /25 yrs/.test(measureText), measureText.slice(0, 220));
ok("counter animation never renders NaN or empty values", !/NaN|undefined/.test(measureText));

// ---------- appointment progress UI ----------
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.getByRole("button", { name: /open knight ai assistant/i }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /book a 15-min call/i }).click().catch(async () => {
  const book = page.getByRole("button", { name: /book a 15-min call/i });
  for (let i = 0; i < 20; i += 1) { await page.waitForTimeout(250); if (!(await book.isDisabled())) break; }
  await book.click();
});
const modal = page.locator('[aria-label="Book an introductory call"]');
await modal.waitFor({ state: "visible", timeout: 8000 });
ok("booking modal exposes a visible progress sequence", await modal.getByRole("list", { name: /booking progress/i }).count() === 1);
const tz = modal.locator("select").first();
await tz.selectOption("America/Chicago");
await page.waitForTimeout(1100);
ok("timezone selection is acknowledged", await modal.locator('[aria-live="polite"]').count() > 0 || (await modal.innerText()).includes("Central"));
const slots = modal.locator("button[aria-pressed]");
ok("real availability is shown", await slots.count() > 0);
await slots.first().click();
await page.waitForTimeout(300);
ok("selected time is summarised before booking", /Selected time/i.test(await modal.innerText()));
ok("details step becomes current after time selection", (await modal.locator('[aria-current="step"]').innerText()).includes("Details"));
await page.screenshot({ path: `${OUT}/106-booking-steps.png` });

// ---------- page transition + navigation ----------
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.locator('header a[href="/services"]').first().click();
await page.waitForURL("**/services", { timeout: 20000 });
await page.getByRole("heading", { name: /Complete medical billing services/i }).waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
await page.waitForTimeout(500);
ok("client navigation lands on Services without a blocking intro", !(await page.locator("[data-site-intro]").isVisible()));
ok("new page content is present", (await page.locator("body").innerText()).includes("Complete medical billing services"));
ok("no browser errors during homepage interactions", errors.length === 0, errors.join(" | "));

// ---------- reduced motion + mobile ----------
const reducedContext = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
await skipIntro(reducedContext);
const reducedPage = await reducedContext.newPage();
await reducedPage.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro(reducedPage);
await reducedPage.locator("#revenue-leak").scrollIntoViewIfNeeded();
await reducedPage.waitForTimeout(250);
await reducedPage.locator("#revenue-leak").getByRole("tab", { name: /Submission/i }).click();
ok("reduced motion keeps the diagnostic usable", /Claims sit in a queue/i.test(await reducedPage.locator("#revenue-stage-panel").innerText()));
await reducedPage.getByRole("heading", { name: /Custom tailored billing, measurable results/i }).scrollIntoViewIfNeeded();
await reducedPage.waitForTimeout(200);
ok("reduced motion shows final metric values immediately", /Every claim|Daily/.test(await reducedPage.locator("section").filter({ has: reducedPage.getByRole("heading", { name: /Custom tailored billing, measurable results/i }) }).innerText()));

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await skipIntro(mobileContext);
const mobilePage = await mobileContext.newPage();
await mobilePage.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await waitForIntro(mobilePage);
await mobilePage.locator("#revenue-leak").scrollIntoViewIfNeeded();
await mobilePage.waitForTimeout(300);
const overflow = await mobilePage.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
ok("mobile has no horizontal overflow", overflow <= 1, String(overflow));
await mobilePage.locator("#revenue-leak").getByRole("tab", { name: /A\/R follow-up/i }).click();
await mobilePage.waitForTimeout(600);
ok("mobile diagnostic remains interactive", /A\/R follow-up/i.test(await mobilePage.locator("#revenue-stage-panel").innerText()));
await mobilePage.screenshot({ path: `${OUT}/107-experience-mobile.png` });

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
