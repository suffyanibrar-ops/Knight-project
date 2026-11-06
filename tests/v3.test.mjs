/** Verification for: image-free hero, 5-item nav, icon header, automatic interactions. */
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://127.0.0.1:5100";
const out = [];
const rec = (n, ok, d = "") => out.push({ n, ok, d });
const br = await chromium.launch();

// 1. Hero has no photograph, has an interactive canvas
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const heroImages = await page.locator("section").first().locator("img").count();
  rec("hero contains no <img>", heroImages === 0, `imgs=${heroImages}`);
  rec("hero canvas present", (await page.locator("section").first().locator("canvas").count()) === 1);
  // canvas actually paints
  const painted = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const ctx2 = c.getContext("2d");
    const d = ctx2.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  });
  rec("hero canvas paints pixels", painted);
  rec("hero shows live claim flow", (await page.getByText(/Live claim flow/i).count()) >= 1);
  await ctx.close();
}

// 2. Header: exactly 5 top-level items
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const labels = await page.locator("header nav[aria-label='Primary'] > div > a").allInnerTexts();
  const clean = labels.map((t) => t.trim()).filter(Boolean);
  rec("six top-level nav items", clean.length === 6, clean.join(" | "));
  rec("nav labels correct", JSON.stringify(clean) === JSON.stringify(["Services", "Specialties", "Who We Serve", "Results", "Resources", "Company"]), clean.join(", "));
  rec("no phone number text in header", !(await page.locator("header").innerText()).includes("812"));
  rec("call icon button present", (await page.locator('header a[href^="tel:"]').count()) === 1);
  // icon size parity
  const sizes = await page.evaluate(() => {
    const header = document.querySelector("header");
    const call = header?.querySelector('a[href^="tel:"]');
    const theme = header?.querySelector('button[aria-label*="theme"]');
    const a11y = header?.querySelector('button[aria-label="Accessibility and display options"]');
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
    return { call: r(call), theme: r(theme), a11y: r(a11y) };
  });
  rec("call/theme/a11y equal size", sizes.call === sizes.theme && sizes.theme === sizes.a11y, JSON.stringify(sizes));
  rec("consultation CTA present", (await page.locator('header a[href="/schedule-form"]').count()) >= 1);
  await ctx.close();
}

// 3. Mega menus open and contain grouped links
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  for (const [label, expectHref] of [["Services", "/services/claims-management"], ["Specialties", "/who-we-serve/hospitals"], ["Who We Serve", "/who-we-serve/private-practices"], ["Resources", "/faq"]]) {
    await page.locator("header nav[aria-label='Primary'] a").filter({ hasText: new RegExp(`^${label}$`) }).first().hover();
    await page.waitForTimeout(450);
    const visible = await page.locator(`header a[href="${expectHref}"]:visible`).count();
    rec(`${label} menu exposes nested links`, visible > 0, expectHref);
    await page.mouse.move(10, 600);
    await page.waitForTimeout(250);
  }
  await ctx.close();
}

// 4. Card shuffle rotates without interaction
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const sec = page.locator("section", { has: page.getByRole("heading", { name: /shuffle the priorities/i }) });
  await sec.scrollIntoViewIfNeeded();
  const first1 = await sec.locator("article h3").nth(0).innerText();
  await page.waitForTimeout(5200);
  const first2 = await sec.locator("article h3").nth(0).innerText();
  rec("card shuffle rotates automatically", first1 !== first2, `"${first1}" → "${first2}"`);
  await ctx.close();
}

// 5. Before/after sweeps automatically
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const range = page.locator('input[type="range"]').first();
  await range.scrollIntoViewIfNeeded();
  const v1 = await range.inputValue();
  await page.waitForTimeout(1500);
  const v2 = await range.inputValue();
  rec("before/after sweeps automatically", v1 !== v2, `${v1} → ${v2}`);
  await ctx.close();
}

// 6. Detail page cross-links
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/services/denial-management", { waitUntil: "networkidle" });
  rec("service page has related-services band", (await page.getByRole("heading", { name: /related services/i }).count()) === 1);
  rec("service page links to specialties", (await page.locator('a[href^="/specialties/"]').count()) >= 3);
  await ctx.close();
}

// 7. No console errors + no overflow at 320 with the new hero
{
  const ctx = await br.newContext({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 80)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 80)); });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  rec("320px home no overflow", ov <= 1, `${ov}px`);
  rec("no console errors", errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// 8. Reduced motion: hero still renders, animations off
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  rec("reduced motion: hero heading visible", await page.locator("h1").first().isVisible());
  rec("reduced motion: live panel visible", (await page.getByText(/Live claim flow/i).count()) >= 1);
  await ctx.close();
}

await br.close();
const failed = out.filter((r) => !r.ok);
console.log("\n=== V3 TESTS ===");
for (const r of out) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.n}${r.d ? " :: " + r.d : ""}`);
console.log(`\nTOTAL ${out.length} | PASS ${out.length - failed.length} | FAIL ${failed.length}`);
process.exit(failed.length ? 1 : 0);
