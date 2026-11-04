/** Verifies no horizontal overflow at every required breakpoint. */
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://127.0.0.1:5000";
const WIDTHS = [320, 375, 430, 768, 1024, 1440, 1920];
const ROUTES = ["/", "/services", "/who-we-serve", "/specialties", "/about", "/contact", "/schedule-form", "/insights", "/faq", "/results", "/our-process"];
const results = [];
const br = await chromium.launch();
for (const w of WIDTHS) {
  const ctx = await br.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(160);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    results.push({ w, r, ok: overflow <= 1, overflow });
  }
  await ctx.close();
}
await br.close();
const failed = results.filter((r) => !r.ok);
for (const f of failed) console.log(`FAIL  ${f.w}px ${f.r} :: ${f.overflow}px`);
console.log(`\nbreakpoints: ${WIDTHS.length} × routes: ${ROUTES.length} = ${results.length} checks | PASS ${results.length - failed.length} | FAIL ${failed.length}`);
process.exit(failed.length ? 1 : 0);
