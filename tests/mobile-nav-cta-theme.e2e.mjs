/**
 * Mobile navigation, sticky CTA, light-default theme and CEO-copy regression.
 * Requires a production build at BASE_URL.
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

const skipIntro = async (context) => {
  await context.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ } });
};
const waitForIntro = async (page) => {
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-site-intro]");
    return !el || getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).opacity === "0";
  }, undefined, { timeout: 5000 }).catch(() => {});
};

// ---------- mobile drawer ----------
for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }]) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  await skipIntro(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 160)));
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await waitForIntro(page);
  await page.getByRole("button", { name: /open menu/i }).click();
  const drawer = page.locator("#mobile-navigation");
  await drawer.waitFor({ state: "visible" });
  const servicesToggle = drawer.getByRole("button", { name: /toggle services/i });
  ok(`${viewport.width}: Services is collapsed by default`, (await servicesToggle.getAttribute("aria-expanded")) === "false");
  ok(`${viewport.width}: other primary items are visible`, await drawer.getByRole("link", { name: "Results", exact: true }).isVisible() && await drawer.getByRole("link", { name: "Company", exact: true }).isVisible());
  ok(`${viewport.width}: body scroll is locked while open`, await page.evaluate(() => getComputedStyle(document.body).overflow === "hidden"));
  await servicesToggle.click();
  ok(`${viewport.width}: Services expands only after explicit tap`, (await servicesToggle.getAttribute("aria-expanded")) === "true");
  await drawer.getByRole("link", { name: "Medical Billing", exact: true }).click();
  await page.waitForURL("**/services/medical-billing-and-coding", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(350);
  ok(`${viewport.width}: drawer closes immediately on submenu navigation`, !(await page.locator("#mobile-navigation").isVisible().catch(() => false)));
  ok(`${viewport.width}: body scroll is restored after navigation`, await page.evaluate(() => getComputedStyle(document.body).overflow !== "hidden"));
  await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  await waitForIntro(page);
  await page.waitForTimeout(300);
  ok(`${viewport.width}: back navigation leaves no stale drawer`, !(await page.locator("#mobile-navigation").isVisible().catch(() => false)));

  // Primary link closes too.
  await page.getByRole("button", { name: /open menu/i }).click();
  await page.locator("#mobile-navigation").getByRole("link", { name: "Results", exact: true }).click();
  await page.waitForURL("**/results", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  ok(`${viewport.width}: primary navigation closes drawer`, !(await page.locator("#mobile-navigation").isVisible().catch(() => false)));
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok(`${viewport.width}: no horizontal overflow`, overflow <= 1, String(overflow));
  ok(`${viewport.width}: no browser errors`, errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---------- sticky CTA ----------
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await skipIntro(context);
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await waitForIntro(page);
  const cta = page.getByRole("navigation", { name: "Quick contact actions" });
  ok("mobile CTA is visible", await cta.isVisible());
  ok("mobile CTA has three actions", await cta.getByRole("link").count() === 3);
  ok("Talk action points to contact", await cta.getByRole("link", { name: "Talk to Knight Medical Billing" }).getAttribute("href") === "/contact");
  ok("Call action uses telephone link", (await cta.getByRole("link", { name: /call knight medical billing/i }).getAttribute("href"))?.startsWith("tel:"));
  ok("Book action points to consultation form", await cta.getByRole("link", { name: /book a consultation/i }).getAttribute("href") === "/schedule-form");
  const barBox = await cta.boundingBox();
  const mainPadding = await page.locator("#main").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  ok("CTA does not cover main content", Boolean(barBox && mainPadding >= barBox.height - 2), `${mainPadding} vs ${barBox?.height}`);
  const chat = page.getByRole("button", { name: /open knight ai assistant/i });
  const chatBox = await chat.boundingBox();
  ok("AI launcher sits above the CTA bar", Boolean(barBox && chatBox && chatBox.y + chatBox.height <= barBox.y + 2), JSON.stringify({ chatBox, barBox }));
  await page.goto(BASE + "/contact", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  ok("CTA is hidden on the contact form", !(await page.getByRole("navigation", { name: "Quick contact actions" }).isVisible().catch(() => false)));
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await skipIntro(context);
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await waitForIntro(page);
  ok("CTA is hidden on desktop", !(await page.getByRole("navigation", { name: "Quick contact actions" }).isVisible().catch(() => false)));
  await context.close();
}

// ---------- theme default / persistence ----------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  await skipIntro(context);
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await waitForIntro(page);
  await page.waitForTimeout(500);
  ok("new visitor defaults to light even with dark OS", await page.evaluate(() => !document.documentElement.classList.contains("dark") && document.documentElement.style.colorScheme === "light"));
  await page.evaluate(() => localStorage.setItem("kmb-prefs", JSON.stringify({ theme: "dark" })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForIntro(page);
  await page.waitForTimeout(500);
  ok("explicit persisted dark preference is preserved", await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await page.evaluate(() => localStorage.setItem("kmb-prefs", JSON.stringify({ theme: "light" })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForIntro(page);
  await page.waitForTimeout(500);
  ok("explicit persisted light preference is preserved", await page.evaluate(() => !document.documentElement.classList.contains("dark")));
  await context.close();
}

// ---------- CEO copy ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await skipIntro(context);
  const page = await context.newPage();
  for (const path of ["/", "/about", "/who-we-serve"]) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await waitForIntro(page);
    await page.waitForTimeout(300);
    const body = await page.locator("body").innerText();
    ok(`${path}: old CEO name is absent`, !/Lawrence\s+Fianko/i.test(body));
    ok(`${path}: Dr. Fianko is present`, /Dr\.\s*Fianko/i.test(body));
  }
  await context.close();
}

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
