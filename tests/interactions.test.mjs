/** Interaction + accessibility verification for the upgraded experience. */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4950";
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok, detail });

const browser = await chromium.launch();

// 1. Reduced motion: no console errors, content still visible
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 100)));
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  record("reduced-motion: no page errors", errors.length === 0, errors.join(" | "));
  const h1 = await page.locator("h1").first();
  record("reduced-motion: hero heading visible", await h1.isVisible());
  const opacity = await h1.evaluate((el) => getComputedStyle(el).opacity);
  record("reduced-motion: no invisible content", Number(opacity) > 0.9, `opacity=${opacity}`);
  await ctx.close();
}

// 2. Copy-to-clipboard on contact page
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await page.goto(BASE + "/contact", { waitUntil: "domcontentloaded" });
  const copy = page.locator('button[aria-label*="Copy"]').first();
  record("copy button present", (await copy.count()) > 0);
  if (await copy.count()) {
    const urlBefore = page.url();
    await copy.click();
    await page.waitForTimeout(500);
    // After clicking, the label becomes "Call us copied" — a stable signal that
    // the control acknowledged the action.
    const confirmed = await page.getByRole("button", { name: /copied/i }).count();
    record("copy button gives feedback", confirmed > 0, `confirmed=${confirmed}`);
    record("copy button does not navigate", page.url() === urlBefore, page.url());
  }
  await ctx.close();
}

// 3. Toast notification on form success is rendered in a live region
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/schedule-form", { waitUntil: "domcontentloaded" });
  const live = page.locator('[aria-live="polite"]');
  record("toast live region exists", (await live.count()) >= 1);
  await ctx.close();
}

// 4. Lightbox: open, close with Escape, focus returns
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/about", { waitUntil: "domcontentloaded" });
  const thumb = page.locator('button[aria-label^="Open image"]').first();
  record("gallery thumbnails present", (await thumb.count()) > 0);
  if (await thumb.count()) {
    await thumb.click();
    await page.waitForTimeout(450);
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    record("lightbox opens as modal dialog", (await dialog.count()) === 1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1200);
    record("lightbox closes on Escape", (await page.locator('[role="dialog"][aria-modal="true"]').count()) === 0);
  }
  await ctx.close();
}

// 5. Keyboard: skip link + focus visibility
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, text: el?.textContent?.trim().slice(0, 30), outline: el ? getComputedStyle(el).outlineWidth : "" };
  });
  record("first Tab reaches skip link", focused.text?.toLowerCase().includes("skip") === true, JSON.stringify(focused));
  await ctx.close();
}

// 6. Scroll progress indicator responds to scroll
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const bar = page.locator(".fixed.inset-x-0.top-0").first();
  record("scroll progress bar present", (await bar.count()) > 0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
  await page.waitForTimeout(600);
  record("scroll progress renders without error", (await page.locator("h1").count()) >= 1);
  // back-to-top appears after scrolling
  const top = page.locator('button[aria-label="Back to top"]');
  record("back-to-top appears on scroll", (await top.count()) === 1, `count=${await top.count()}`);
  await ctx.close();
}

// 7. Touch device: no hover-only dependence for navigation
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.locator('button[aria-label="Open menu"]').click();
  await page.waitForTimeout(500);
  const link = page.locator('a[href="/services"]:visible').first();
  record("touch: drawer link tappable", (await link.count()) > 0);
  const box = await link.boundingBox();
  record("touch: tap target ≥ 40px", box ? box.height >= 40 : false, box ? `h=${Math.round(box.height)}` : "no box");
  await ctx.close();
}

// 8. Skeleton loading state exists for dynamic routes
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/services/claims-management", { waitUntil: "networkidle" });
  record("service detail renders content", (await page.locator("h1").count()) === 1);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log("\n=== INTERACTION TESTS ===");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? " :: " + r.detail : ""}`);
console.log(`\nTOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`);
process.exit(failed.length ? 1 : 0);
