/**
 * Real browser verification with Playwright (Chromium).
 * Tests: every route, console errors, responsive widths, nav, forms, a11y basics.
 * Run with the production server already listening on $BASE_URL.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

const ROUTES = [
  "/", "/services", "/services/medical-billing-and-coding", "/services/denial-management",
  "/services/claims-management", "/services/payment-posting", "/services/eft-era-edi-support",
  "/services/revenue-performance-reporting", "/services/contracting-and-enrollment",
  "/who-we-serve", "/who-we-serve/hospitals", "/who-we-serve/private-practices",
  "/specialties", "/specialties/cardiology", "/our-process", "/results", "/about",
  "/insights", "/insights/clean-claim-playbook", "/faq", "/contact", "/schedule-form",
  "/hipaa-compliance", "/privacy-policy", "/terms-of-service", "/admin/login",
];

const WIDTHS = [{ name: "320", w: 320, h: 800 }, { name: "375", w: 375, h: 812 }, { name: "430", w: 430, h: 932 }];

const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok, detail });

const browser = await chromium.launch();

// ---------- 1. every route: status, console errors, horizontal overflow ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const errors = [];
    const onConsole = (msg) => { if (msg.type() === "error") errors.push(msg.text().slice(0, 160)); };
    page.on("console", onConsole);
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 120)));
    let status = 0;
    try {
      const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      status = res?.status() ?? 0;
      await page.waitForTimeout(250);
    } catch (e) {
      record(`route ${route}`, false, "navigation failed: " + e.message.slice(0, 80));
      page.off("console", onConsole);
      continue;
    }
    const h1 = await page.locator("h1").count();
    record(`route ${route}`, status === 200, `status=${status} h1=${h1}`);
    if (errors.length) record(`console ${route}`, false, errors.slice(0, 2).join(" | "));
    page.off("console", onConsole);
  }
  await ctx.close();
}

// ---------- 2. mobile: horizontal overflow at 320 / 375 / 430 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const vp of WIDTHS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const route of ["/", "/services", "/contact", "/schedule-form", "/specialties", "/who-we-serve", "/insights", "/faq", "/about", "/our-process"]) {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      record(`${vp.name}px ${route} no-h-overflow`, overflow <= 1, `overflow=${overflow}px`);
    }
  }
  await ctx.close();
}

// ---------- 3. navigation + mobile menu ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const menuBtn = page.locator('button[aria-label="Open menu"]');
  record("mobile menu button visible", (await menuBtn.count()) === 1);
  if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(400);
    const drawer = page.locator('a[href="/services"]:visible').first();
    record("mobile drawer opens", (await drawer.count()) > 0);
    const close = page.locator('button[aria-label="Close menu"]');
    if (await close.count()) { await close.click(); await page.waitForTimeout(300); }
    await page.waitForTimeout(400);
    record("mobile drawer closes", (await page.locator('button[aria-label="Close menu"]:visible').count()) === 0);
  }
  await ctx.close();
}

// ---------- 4. desktop nav dropdown ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.locator('header nav a[href="/services"]').first().hover();
  await page.waitForTimeout(450);
  const dropdown = page.locator('a[href="/services/claims-management"]').first();
  record("desktop mega-menu shows services", await dropdown.isVisible().catch(() => false));
  await ctx.close();
}

// ---------- 5. form validation + submission ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/schedule-form", { waitUntil: "domcontentloaded" });

  // Step 1: empty submit must not advance
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(350);
  const stillStep1 = await page.getByText(/Step 1 of 3/i).count();
  record("form blocks empty submit", stillStep1 > 0);

  // Invalid email is rejected
  await page.locator('input[autocomplete="name"]').fill("Browser Tester");
  await page.locator('input[autocomplete="email"]').fill("not-an-email");
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(350);
  const stillBlocked = (await page.getByText(/Step 1 of 3/i).count()) > 0;
  const invalid = await page.locator('input[autocomplete="email"]').evaluate((el) => !el.checkValidity());
  record("form rejects invalid email", stillBlocked && invalid, `blocked=${stillBlocked} invalid=${invalid}`);

  // Valid step 1 advances
  await page.locator('input[autocomplete="email"]').fill(`browser-${Date.now()}@example.com`);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(450);
  record("form advances to step 2", (await page.getByText(/Step 2 of 3/i).count()) > 0);
  await ctx.close();
}

// ---------- 6. admin protection ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/admin/inbox", { waitUntil: "domcontentloaded" });
  record("admin inbox redirects to login", page.url().includes("/admin/login"));
  const pw = page.locator('input[type="password"]');
  record("admin login has password field", (await pw.count()) >= 1);
  await ctx.close();
}

// ---------- 7. contact form fields are labelled ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  for (const route of ["/contact", "/schedule-form"]) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const fields = await page.locator("form input:not([type=hidden]), form select, form textarea").count();
    const labelled = await page.evaluate(() => {
      let ok = 0;
      document.querySelectorAll("form input:not([type=hidden]), form select, form textarea").forEach((el) => {
        const id = el.getAttribute("id");
        const wrapped = el.closest("label");
        const hasAria = el.getAttribute("aria-label");
        const html = el.closest("label")?.textContent?.trim();
        if ((id && document.querySelector(`label[for="${id}"]`)) || (wrapped && html) || hasAria) ok++;
      });
      return ok;
    });
    record(`${route} all fields labelled`, fields > 0 && labelled === fields, `${labelled}/${fields}`);
  }
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("\n=== BROWSER TEST RESULTS ===");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? " :: " + r.detail : ""}`);
console.log(`\nTOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`);
process.exit(failed.length ? 1 : 0);
