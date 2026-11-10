/**
 * GSC OAuth route-boundary regression.
 *
 * Requires a running production build and ADMIN_PW (or ADMIN_PASSWORD).
 * Google is never called: this validates auth, config failure, denial and
 * invalid-state handling before any token exchange can occur.
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PW = process.env.ADMIN_PW ?? process.env.ADMIN_PASSWORD;
let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const request = context.request;

  const statusUnauth = await request.get(`${BASE}/api/admin/seo/google/status`, { maxRedirects: 0 });
  ok("logged-out status is 401", statusUnauth.status() === 401, String(statusUnauth.status()));
  const connectUnauth = await request.get(`${BASE}/api/admin/seo/google/connect`, { maxRedirects: 0 });
  ok("logged-out connect redirects to admin login", connectUnauth.status() >= 300 && connectUnauth.status() < 400 && /\/admin\/login/.test(connectUnauth.headers().location ?? ""), `${connectUnauth.status()} ${connectUnauth.headers().location ?? ""}`);
  const disconnectUnauth = await request.post(`${BASE}/api/admin/seo/google/disconnect`, { maxRedirects: 0 });
  ok("logged-out disconnect is 401", disconnectUnauth.status() === 401, String(disconnectUnauth.status()));

  ok("ADMIN_PW is available for authenticated checks", Boolean(PW));
  if (!PW) throw new Error("Set ADMIN_PW or ADMIN_PASSWORD to run authenticated OAuth route checks.");

  const page = await context.newPage();
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.fill('input[name="password"]', PW);
  await Promise.all([page.waitForNavigation({ timeout: 30_000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await page.waitForTimeout(500);
  ok("admin login succeeds", /\/admin(\/|$)/.test(page.url()) && !/login/.test(page.url()), page.url());

  const status = await request.get(`${BASE}/api/admin/seo/google/status`, { maxRedirects: 0 });
  const statusBody = await status.json().catch(() => null);
  ok("authenticated status is JSON with a status object", status.ok() && statusBody?.ok === true && typeof statusBody?.status?.status === "string");
  ok("status never exposes a token field", statusBody && !/access_token|refresh_token|client_secret/i.test(JSON.stringify(statusBody)));

  const configured = statusBody?.status?.configured === true;
  const connect = await request.get(`${BASE}/api/admin/seo/google/connect`, { maxRedirects: 0 });
  const location = connect.headers().location ?? "";
  if (configured) {
    ok("configured OAuth starts the Google authorization redirect", connect.status() >= 300 && connect.status() < 400 && /accounts\.google\.com/.test(location), `${connect.status()} ${location}`);
  } else {
    ok("unconfigured OAuth returns a safe admin redirect", connect.status() >= 300 && connect.status() < 400 && /\/admin\/seo\?google=config_required/.test(location), `${connect.status()} ${location}`);
  }

  const denied = await request.get(`${BASE}/api/admin/seo/google/callback?error=access_denied&state=test`, { maxRedirects: 0 });
  ok("Google denial is handled without token exchange", denied.status() >= 300 && denied.status() < 400 && /google=denied/.test(denied.headers().location ?? ""), `${denied.status()} ${denied.headers().location ?? ""}`);
  const invalid = await request.get(`${BASE}/api/admin/seo/google/callback?code=fake&state=wrong`, { maxRedirects: 0 });
  ok("invalid state is rejected without token exchange", invalid.status() >= 300 && invalid.status() < 400 && /google=(invalid_state|config_required)/.test(invalid.headers().location ?? ""), `${invalid.status()} ${invalid.headers().location ?? ""}`);

  const property = await request.post(`${BASE}/api/admin/seo/google/property`, { data: { siteUrl: "sc-domain:none.example" }, maxRedirects: 0 });
  ok("property selection requires a connection", property.status() === 400, String(property.status()));
  const disconnect = await request.post(`${BASE}/api/admin/seo/google/disconnect`, { data: {}, maxRedirects: 0 });
  ok("authenticated disconnect is safe when no token exists", disconnect.ok(), String(disconnect.status()));

  console.log(`RESULT pass=${pass} fail=${fail}`);
  process.exitCode = fail ? 1 : 0;
} finally {
  await browser.close();
}
