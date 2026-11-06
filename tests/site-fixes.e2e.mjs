/**
 * Verification for the requested site fixes: AI launcher, hero cleanup,
 * practice-perspectives section, map, back-to-top and tab title.
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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
// Skip the long intro for navigation-focused checks.
await context.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));

// ---------- tab title / brand first ----------
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
const title = await page.title();
ok("homepage tab title starts with the brand", title.startsWith("Knight Medical Billing"), title);
ok("homepage tab title keeps the service descriptor", /Custom Tailored Medical Billing/i.test(title), title);
ok("site name is present in the title exactly once", (title.match(/Knight Medical Billing/g) ?? []).length === 1, title);

// ---------- hero claims removed ----------
const heroText = await page.locator("[data-hero-reveal]").innerText();
ok("hero avoids the old broad check-mark claims", !/no long-term lock-in/i.test(heroText) && !/dedicated billing team/i.test(heroText), heroText.slice(0, 300));
ok("hero shows specific differentiators", /No prepayment/i.test(heroText) && /Your software|No rip-and-replace/i.test(heroText));
ok("hero shows the new primary actions", /Talk With Knight/i.test(heroText) && /See how it works/i.test(heroText));

// ---------- AI assistant launcher icon ----------
const launcher = page.getByRole("button", { name: /open knight ai assistant/i });
ok("AI launcher has an explicit assistant label", await launcher.count() === 1);
const iconShape = await launcher.locator("svg").first().evaluate((svg) => ({ rects: svg.querySelectorAll("rect").length, circles: svg.querySelectorAll("circle").length }));
ok("AI launcher uses the custom voice-agent waveform (not a chat bubble)", iconShape.rects >= 4 && iconShape.circles >= 1, JSON.stringify(iconShape));
ok("AI badge is rendered on the closed launcher", (await launcher.innerText()).includes("AI"));
await page.waitForFunction(() => {
  const intro = document.querySelector("[data-site-intro]");
  return !intro || getComputedStyle(intro).display === "none" || getComputedStyle(intro).visibility === "hidden";
}, undefined, { timeout: 5000 });
await page.screenshot({ path: `${OUT}/101-ai-launcher.png` });

// ---------- practice perspectives ----------
await page.evaluate(() => {
  const heading = Array.from(document.querySelectorAll("h2")).find((el) => /the themes we hear from practice leaders/i.test(el.textContent ?? ""));
  if (heading) window.scrollTo({ top: Math.max(0, heading.getBoundingClientRect().top + window.scrollY - 110), behavior: "instant" });
});
await page.waitForTimeout(600);
const section = page.locator("section").filter({ has: page.getByRole("heading", { name: /the themes we hear from practice leaders/i }) });
const sectionText = await section.innerText();
ok("practice-leaders section has the new context chips", /Four recurring themes/i.test(sectionText) && /Administrator & clinician conversations/i.test(sectionText));
const perspectiveImages = await section.locator("img").evaluateAll((images) => images.map((image) => image.getAttribute("src") ?? ""));
ok("practice-leaders images are photography, not SVG placeholders", perspectiveImages.length > 0 && perspectiveImages.every((src) => src.includes(".jpg") && !src.includes("testimonial-")), perspectiveImages.join(" | "));
await section.getByRole("button", { name: /Show Aged A\/R/i }).click();
await page.waitForTimeout(700);
const activeImage = await section.locator("img").first().getAttribute("src");
ok("carousel switches to the aged A/R photograph", activeImage?.includes("documents-team.jpg") ?? false, String(activeImage));
await page.screenshot({ path: `${OUT}/102-practice-perspectives.png` });

// ---------- back to top ----------
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
await page.waitForTimeout(700);
const backToTop = page.getByRole("button", { name: /back to top/i });
ok("back-to-top appears after scrolling", await backToTop.isVisible());
await backToTop.click();
await page.waitForTimeout(2600);
ok("back-to-top scrolls to the top", await page.evaluate(() => window.scrollY < 80), String(await page.evaluate(() => window.scrollY)));

// ---------- interactive map ----------
await page.goto(BASE + "/contact", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3200);
const mapFrame = page.locator('iframe[title*="Map showing Knight Medical Billing"]');
ok("interactive map iframe is rendered automatically", await mapFrame.count() === 1);
const frameSources = page.frames().map((frame) => frame.url());
ok("Google Maps frame is present (not blocked by CSP)", frameSources.some((url) => /google\.[^/]+\/maps|maps\.google/i.test(url)), frameSources.filter((url) => url.includes("google")).join(" | ").slice(0, 240));
const mapBox = await mapFrame.boundingBox();
ok("map has a visible size", Boolean(mapBox && mapBox.width > 200 && mapBox.height > 150), JSON.stringify(mapBox));
await mapFrame.scrollIntoViewIfNeeded();
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/103-contact-map.png` });

ok("no browser errors on the checked pages", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
