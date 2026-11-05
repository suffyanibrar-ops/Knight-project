/**
 * Browser UI verification for the timezone-aware booking calendar.
 * Requires the test-mode server (AI_TEST_MODE=1) and a production build.
 */
import { chromium } from "playwright";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "app.db");

let pass = 0, fail = 0;
const ok = (name, condition, extra = "") => { if (condition) { pass += 1; console.log("PASS", name); } else { fail += 1; console.log("FAIL", name, extra); } };

const conn = new Database(DB_PATH);
conn.prepare("DELETE FROM ai_appointments").run();
conn.close();

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 200)));

await page.addInitScript(() => { try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ } });
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForFunction(() => { const intro = document.querySelector("[data-site-intro]"); return !intro || getComputedStyle(intro).display === "none" || getComputedStyle(intro).visibility === "hidden"; }, undefined, { timeout: 6000 }).catch(() => {});
await page.getByRole("button", { name: /open knight ai assistant/i }).click();
const bookButton = page.getByRole("button", { name: /book a 15-min call/i });
for (let i = 0; i < 30; i += 1) {
  await page.waitForTimeout(300);
  if (await bookButton.count() && !(await bookButton.isDisabled())) break;
}
ok("booking button is enabled from live config", await bookButton.count() === 1 && !(await bookButton.isDisabled()));
await bookButton.click();
const dialog = page.locator('[aria-label="Book an introductory call"]');
await dialog.waitFor({ state: "visible", timeout: 10_000 });
ok("booking modal opens", await dialog.count() === 1);
const select = dialog.locator("select").first();
ok("timezone is not assumed for an unknown browser zone", await select.inputValue() === "", await select.inputValue());
ok("visitor is asked to choose a timezone", /select your time zone/i.test(await dialog.innerText()));
ok("no availability is shown before choosing a zone", await dialog.locator("button[aria-pressed]").count() === 0);

await select.selectOption("America/Chicago");
await page.waitForTimeout(500);
for (let i = 0; i < 30; i += 1) {
  await page.waitForTimeout(300);
  if (await dialog.locator("button[aria-pressed]").count() > 0) break;
}
const text = await dialog.innerText();
ok("times are labelled Central after selection", /Central/i.test(text), text.slice(0, 180));
const slots = dialog.locator("button[aria-pressed]");
ok("real slots load for the chosen zone", await slots.count() > 0, String(await slots.count()));
await slots.first().click();
await dialog.locator('input[autocomplete="name"]').fill("UI Timezone Test");
await dialog.locator('input[autocomplete="email"]').fill("admin@knightmedicalbilling.com");
await dialog.locator('input[autocomplete="organization"]').fill("UI Practice");
await dialog.locator('input[type="checkbox"]').check();
await page.getByRole("button", { name: /confirm booking/i }).click();
await page.waitForTimeout(2500);
const bodyAfterBooking = await page.locator("body").innerText();
ok("booking confirms in the UI", /you'?re booked|booked for/i.test(bodyAfterBooking), bodyAfterBooking.slice(0, 260));

const check = new Database(DB_PATH);
const row = check.prepare("SELECT * FROM ai_appointments ORDER BY id DESC LIMIT 1").get();
check.close();
ok("stored timezone matches the visitor selection", row?.timezone === "America/Chicago", JSON.stringify(row && { timezone: row.timezone, local_date: row.local_date, local_time: row.local_time }));
ok("stored local time and UTC are both preserved", Boolean(row?.local_date) && Boolean(row?.local_time) && Number(row?.starts_at_utc) > 0, JSON.stringify(row && { local_date: row.local_date, local_time: row.local_time, starts_at_utc: row.starts_at_utc }));
ok("no browser errors", errors.length === 0, errors.join(" | "));

const cleanup = new Database(DB_PATH);
cleanup.prepare("DELETE FROM ai_appointments").run();
cleanup.close();
await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
