/**
 * First-visit intro experience verification (production build).
 *
 *   node tests/intro.e2e.mjs
 *
 * Covers: first visit timing, return visit brevity, reduced motion, JS disabled,
 * slow network, mobile, skip control, client navigation, layout shift, scroll
 * lock release and hero flow-rail integration.
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

/** Wait until the intro overlay is no longer visible; returns elapsed ms. */
async function waitForIntroEnd(page, minMs = 0) {
  const started = Date.now();
  while (Date.now() - started < 4500) {
    const visible = await page.locator("[data-site-intro]").isVisible().catch(() => false);
    if (!visible) return Date.now() - started + minMs;
    await page.waitForTimeout(70);
  }
  return -1;
}

// ---------- first visit ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 160)));
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const domReadyAt = Date.now();
  const mode = await page.evaluate(() => document.documentElement.dataset.intro);
  ok("first visit uses the full intro", mode === "full", String(mode));
  ok("intro overlay is painted immediately", await page.locator("[data-site-intro]").isVisible());
  await page.waitForTimeout(320);
  ok("logo is visible before/independent of hydration", Number(await page.locator(".site-intro__brand").evaluate((el) => getComputedStyle(el).opacity)) > 0.4);
  ok("scroll is locked only while intro is open", await page.evaluate(() => document.documentElement.classList.contains("intro-open")));

  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector(".site-intro__tagline")).opacity) > 0.5,
    undefined,
    { timeout: 3200 },
  ).catch(() => {});
  const lineScale = await page.locator(".site-intro__line").evaluate((el) => {
    const transform = getComputedStyle(el).transform;
    if (transform === "none") return 1;
    const match = /matrix\(([^,]+)/.exec(transform);
    return match ? Number(match[1]) : 1;
  });
  ok("revenue-flow line draws across", lineScale > 0.5, String(lineScale));
  ok("flow nodes are present", await page.locator(".site-intro__node").count() === 4);
  ok("tagline fades in", Number(await page.locator(".site-intro__tagline").evaluate((el) => getComputedStyle(el).opacity)) > 0.5);

  await waitForIntroEnd(page);
  const totalIntroMs = Date.now() - domReadyAt;
  ok("intro finishes in the target window (2.2–3.6s after DOM ready)", totalIntroMs >= 2200 && totalIntroMs <= 3600, `${totalIntroMs}ms`);
  ok("overlay is removed from interaction", !(await page.locator("[data-site-intro]").isVisible()));
  ok("hero becomes interactive", await page.locator("[data-hero-reveal]").isVisible());
  ok("scroll lock is released", !(await page.evaluate(() => document.documentElement.classList.contains("intro-open"))));
  ok("hero rail receives the flow line", await page.locator("[data-hero-flow-line]").evaluate((el) => el.classList.contains("is-live")));
  ok("session marks the intro as seen", await page.evaluate(() => sessionStorage.getItem("kmb-intro-seen") === "1"));
  const layoutShift = await page.evaluate(() => performance.getEntriesByType("layout-shift").reduce((total, entry) => total + (entry.hadRecentInput ? 0 : entry.value), 0));
  ok("no meaningful layout shift from the intro", layoutShift < 0.1, String(layoutShift));
  ok("no browser errors during intro", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: "/Users/nokhaizibrar/Desktop/Project Folder/preview/96-intro-hero.png" });

  // Client-side navigation must not replay the intro.
  await page.locator('a[href="/services"]').first().click();
  await page.waitForURL("**/services", { timeout: 20_000 });
  ok("client navigation does not replay the intro", !(await page.locator("[data-site-intro]").isVisible()));
  ok("client navigation reaches the site", (await page.locator("body").innerText()).length > 200);

  // Return visit in the same session: brief only.
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const returnMode = await page.evaluate(() => document.documentElement.dataset.intro);
  ok("return visit uses the brief mode", returnMode === "brief", String(returnMode));
  const returnElapsed = await waitForIntroEnd(page);
  ok("return visit is much shorter (< 900ms)", returnElapsed >= 0 && returnElapsed < 900, `${returnElapsed}ms`);
  await context.close();
}

// ---------- skip control ----------
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1450);
  const skip = page.getByRole("button", { name: /skip introduction/i });
  ok("skip control is available", await skip.count() === 1 && (await skip.isVisible()));
  await skip.click();
  const elapsed = await waitForIntroEnd(page);
  ok("skip dismisses the intro immediately", elapsed >= 0 && elapsed < 700, `${elapsed}ms`);
  ok("site is usable after skip", (await page.locator("body").innerText()).includes("Your revenue cycle"));
  await context.close();
}

// ---------- reduced motion ----------
{
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  ok("reduced motion skips the overlay", !(await page.locator("[data-site-intro]").isVisible()));
  ok("reduced motion keeps the page immediately usable", await page.locator("[data-hero-reveal]").isVisible());
  ok("reduced motion does not lock scrolling", !(await page.evaluate(() => document.documentElement.classList.contains("intro-open"))));
  ok("reduced motion keeps the hero flow rail visible", await page.locator("[data-hero-flow-line]").isVisible());
  await context.close();
}

// ---------- JS disabled fallback ----------
{
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(500);
  ok("no-JS: branded overlay still renders", Number(await page.locator(".site-intro__brand").evaluate((el) => getComputedStyle(el).opacity)) > 0.4);
  await page.waitForTimeout(3000);
  ok("no-JS: overlay auto-dismisses", !(await page.locator("[data-site-intro]").isVisible()));
  ok("no-JS: homepage content is visible", (await page.locator("body").innerText()).includes("Your revenue cycle"));
  await context.close();
}

// ---------- direct entry on a non-home page ----------
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE + "/services", { waitUntil: "domcontentloaded", timeout: 60_000 });
  ok("non-home direct entry skips the intro", !(await page.locator("[data-site-intro]").isVisible()));
  ok("non-home page is immediately usable", (await page.locator("body").innerText()).length > 200);
  await context.close();
}

// ---------- mobile ----------
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const domReadyAt = Date.now();
  ok("mobile: intro visible", await page.locator("[data-site-intro]").isVisible());
  await page.waitForTimeout(1450);
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok("mobile: no horizontal overflow during intro", overflow <= 1, String(overflow));
  await waitForIntroEnd(page);
  const mobileTotalMs = Date.now() - domReadyAt;
  ok("mobile: intro completes in the target window", mobileTotalMs >= 2000 && mobileTotalMs <= 3800, `${mobileTotalMs}ms`);
  ok("mobile: rail labels simplify away", await page.locator(".hero-flow__label").first().evaluate((el) => getComputedStyle(el).display === "none"));
  await page.screenshot({ path: "/Users/nokhaizibrar/Desktop/Project Folder/preview/99-hero-mobile.png" });
  await context.close();
}

// ---------- slow network ----------
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(BASE + "/", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  const started = Date.now();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const elapsed = await waitForIntroEnd(page);
  ok("slow HTML does not leave a stuck overlay", elapsed >= 0 && elapsed < 4200, `${elapsed}ms`);
  ok("slow load remains usable after intro", (await page.locator("body").innerText()).includes("Your revenue cycle"));
  ok("slow load still dismisses within a bounded total", Date.now() - started < 9000, `${Date.now() - started}ms`);
  await context.close();
}

// ---------- final screenshots ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1450);
  await page.screenshot({ path: "/Users/nokhaizibrar/Desktop/Project Folder/preview/95-intro-stage.png" });
  await context.close();
}


// ---------- dark mode + keyboard escape ----------
{
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 980 } });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  ok("dark mode: intro still renders cleanly", await page.locator("[data-site-intro]").isVisible());
  await waitForIntroEnd(page);
  ok("dark mode: hero remains usable", await page.locator("[data-hero-reveal]").isVisible());
  await context.close();
}
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  const elapsed = await waitForIntroEnd(page);
  ok("Escape key skips the intro", elapsed >= 0 && elapsed < 800, `${elapsed}ms`);
  await context.close();
}
// ---------- very small viewport ----------
{
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok("320px: no horizontal overflow during intro", overflow <= 1, String(overflow));
  await waitForIntroEnd(page, 700);
  const heroOverflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok("320px: no horizontal overflow after intro", heroOverflow <= 1, String(heroOverflow));
  await context.close();
}


// ---------- tablet ----------
{
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const domReadyAt = Date.now();
  ok("tablet: intro visible", await page.locator("[data-site-intro]").isVisible());
  await page.waitForTimeout(780);
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok("tablet: no horizontal overflow", overflow <= 1, String(overflow));
  await waitForIntroEnd(page);
  const total = Date.now() - domReadyAt;
  ok("tablet: intro completes cleanly", total <= 3800, `${total}ms`);
  ok("tablet: hero rail visible", await page.locator("[data-hero-flow-line]").isVisible());
  await context.close();
}

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
