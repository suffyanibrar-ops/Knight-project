/** Verification for the premium redesign: header, theme, a11y, new interactions. */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5000";
const results = [];
const record = (n, ok, d = "") => results.push({ n, ok, d });
const br = await chromium.launch();

// 1. Sticky header stays visible after scrolling (desktop + mobile)
for (const vp of [{ name: "desktop", w: 1440, h: 900 }, { name: "mobile", w: 390, h: 844 }]) {
  const ctx = await br.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.name === "mobile", hasTouch: vp.name === "mobile" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo({ top: 2200, behavior: "instant" }));
  await page.waitForTimeout(500);
  const header = page.locator("header").first();
  const box = await header.boundingBox();
  const visible = box !== null && box.y >= -2 && box.y < 90;
  record(`${vp.name}: header sticky after scroll`, visible, box ? `y=${Math.round(box.y)}` : "no box");
  // logo still visible within the sticky header
  record(`${vp.name}: logo visible in sticky header`, await page.locator('header a[aria-label*="home"]').first().isVisible().catch(() => false));
  await ctx.close();
}

// 2. Top banner removed
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const banner = await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return "no header";
    const first = header.firstElementChild;
    return first ? Math.round(first.getBoundingClientRect().height) : 0;
  });
  record("no utility banner above nav", Number(banner) < 90, `header top block=${banner}px`);
  await ctx.close();
}

// 3. Theme toggle persists across reload
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const toggle = page.locator('button[aria-label*="dark theme"]').first();
  record("theme toggle present", (await toggle.count()) > 0);
  await toggle.click();
  await page.waitForTimeout(600);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  record("dark mode applies", isDark);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  record("dark surface colour applied", bg !== "rgb(255, 255, 255)", bg);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  record("theme persists after reload", await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await ctx.close();
}

// 4. Accessibility panel
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator('button[aria-label="Accessibility and display options"]').first().click();
  await page.waitForTimeout(500);
  record("a11y panel opens", (await page.locator('[role="dialog"][aria-labelledby="a11y-title"]').count()) === 1);
  await page.getByRole("button", { name: "Larger", exact: true }).click();
  await page.waitForTimeout(300);
  record("text size control works", await page.evaluate(() => document.documentElement.dataset.textsize === "xlarge"));
  await page.getByRole("button", { name: /high contrast/i }).click();
  await page.waitForTimeout(200);
  record("contrast control works", await page.evaluate(() => document.documentElement.dataset.contrast === "high"));
  await page.getByRole("button", { name: "Reduce motion", exact: true }).click();
  await page.waitForTimeout(200);
  record("motion control works", await page.evaluate(() => document.documentElement.dataset.motion === "reduced"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  record("a11y panel closes on Escape", (await page.locator('[role="dialog"][aria-labelledby="a11y-title"]').count()) === 0);
  await ctx.close();
}

// 5. Typewriter present and animating
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const h1 = page.locator("h1").first();
  const text1 = await h1.innerText();
  await page.waitForTimeout(2600);
  const text2 = await h1.innerText();
  record("typewriter headline changes", text1 !== text2, `"${text1.slice(-24)}" → "${text2.slice(-24)}"`);
  await ctx.close();
}

// 6. Before/after slider
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const range = page.locator('input[type="range"]').first();
  record("before/after slider present", (await range.count()) > 0);
  if (await range.count()) {
    await range.fill("20");
    await page.waitForTimeout(300);
    record("before/after slider operable", (await range.inputValue()) === "20");
  }
  await ctx.close();
}

// 7. Card shuffle: auto-rotates, and manual control still works
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const section = page.locator("section", { has: page.getByRole("heading", { name: /shuffle the priorities/i }) });
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // auto-rotation, no interaction
  const auto1 = await section.locator("article h3").nth(0).innerText();
  await page.waitForTimeout(5200);
  const auto2 = await section.locator("article h3").nth(0).innerText();
  record("card shuffle auto-rotates", auto1 !== auto2, `"${auto1}" -> "${auto2}"`);

  // manual control (hover pauses auto-rotation first)
  const next = page.getByRole("button", { name: /show another set of priorities/i }).first();
  record("next-set button present", (await next.count()) > 0);
  await section.hover();
  await page.waitForTimeout(200);
  const before = await section.locator("article h3").nth(0).innerText();
  await next.click();
  await page.waitForTimeout(900);
  const after = await section.locator("article h3").nth(0).innerText();
  record("manual next-set changes cards", before !== after, `"${before}" -> "${after}"`);
  await ctx.close();
}

// 8. Testimonials carousel navigation
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const carousel = page.locator('[aria-roledescription="carousel"]');
  record("testimonials carousel present", (await carousel.count()) === 1);
  const tab = page.getByRole("tab").nth(2);
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await page.waitForTimeout(500);
  record("carousel tab switches", (await tab.getAttribute("aria-selected")) === "true");
  await ctx.close();
}

// 9. Footer: simplified + official socials + address
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const ig = page.locator('a[href="https://www.instagram.com/knight_medical_billing/"]');
  const fb = page.locator('a[href="https://www.facebook.com/profile.php?id=61582608834344"]');
  const li = page.locator('a[href="https://www.linkedin.com/company/knight-medical-billing"]');
  record("Instagram link", (await ig.count()) >= 1);
  record("Facebook link", (await fb.count()) >= 1);
  record("LinkedIn link", (await li.count()) >= 1);
  const address = await page.getByRole("contentinfo").innerText();
  record("new Herndon address in footer", address.includes("585 Grove St") && address.includes("Herndon"), "");
  await ctx.close();
}

// 10. Map on contact page
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/contact", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  record("map iframe loads automatically", (await page.locator('iframe[title*="Map showing Knight Medical Billing"]').count()) === 1);
  await ctx.close();
}

// 11. Mobile: no horizontal overflow with new sections
for (const width of [320, 375, 430]) {
  const ctx = await br.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const route of ["/", "/contact", "/about", "/services"]) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    record(`${width}px ${route} no overflow`, overflow <= 1, `${overflow}px`);
  }
  await ctx.close();
}

// 12. Reduced motion + console errors on homepage
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 90)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 90)); });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  record("reduced motion: no errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await br.close();
const failed = results.filter((r) => !r.ok);
console.log("\n=== REDESIGN TESTS ===");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.n}${r.d ? " :: " + r.d : ""}`);
console.log(`\nTOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`);
process.exit(failed.length ? 1 : 0);
