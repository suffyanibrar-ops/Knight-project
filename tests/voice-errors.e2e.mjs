/**
 * Voice capability and permission-change regression.
 *
 *   npm run test:voice:errors
 *
 * Verifies unsupported-browser guidance and permission revocation handling.
 * Real browser permission prompts and device audio routes still require
 * physical-device testing; these tests exercise the production widget logic.
 */
import { chromium, devices } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};

const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

const installSpeech = async (context, { permissions = true } = {}) => {
  await context.addInitScript(({ permissions }) => {
    try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ }
    window.__speech = { utterances: [], cancelCount: 0, recognition: null, permission: { state: "granted", onchange: null } };
    class FakeRecognition {
      constructor() {
        this.lang = ""; this.continuous = true; this.interimResults = true; this.maxAlternatives = 1;
        this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null;
        window.__speech.recognition = this;
      }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() {}
    }
    for (const key of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      try { Object.defineProperty(window, key, { value: FakeRecognition, configurable: true }); }
      catch { window[key] = FakeRecognition; }
    }
    if (permissions) {
      try {
        Object.defineProperty(navigator, "permissions", {
          configurable: true,
          value: {
            query: async () => window.__speech.permission,
          },
        });
      } catch { /* permissions unavailable */ }
    }
    const synth = window.speechSynthesis;
    synth.speak = (utterance) => { window.__speech.utterances.push(utterance); utterance.onend?.(); };
    synth.cancel = () => { window.__speech.cancelCount += 1; };
    try { Object.defineProperty(synth, "speaking", { configurable: true, get: () => false }); } catch { /* native */ }
    window.__revokeMicrophone = () => {
      window.__speech.permission.state = "denied";
      window.__speech.permission.onchange?.();
    };
  }, { permissions });
};

const openWidget = async (page) => {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /open knight ai assistant/i }).click();
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: /start voice conversation/i }).click();
};

// ---------- permission revoked after grant ----------
{
  const context = await browser.newContext({ ...devices["iPhone 13"], permissions: ["microphone"] });
  await installSpeech(context);
  const page = await context.newPage();
  await openWidget(page);
  await page.getByRole("button", { name: /enable microphone/i }).click();
  await page.waitForFunction(() => Boolean(window.__speech.recognition?.onresult), undefined, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => window.__revokeMicrophone());
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.getAttribute("data-voice-state") === "error", undefined, { timeout: 10_000 }).catch(() => {});
  const text = await page.locator('[role="dialog"]').innerText();
  ok("permission revocation is surfaced", /revoked or blocked/i.test(text), text.slice(0, 400));
  ok("permission revocation remains recoverable by text", /Microphone permission/i.test(text) && await page.getByRole("textbox", { name: /chat message/i }).count() === 1);
  await context.close();
}

// ---------- unsupported browser ----------
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => {
    try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ }
    for (const key of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      try { Object.defineProperty(window, key, { value: undefined, configurable: true }); } catch { /* ignore */ }
    }
  });
  const page = await context.newPage();
  await openWidget(page);
  const text = await page.locator('[role="dialog"]').innerText();
  ok("unsupported browser gets a clear text fallback", /Voice isn't supported/i.test(text) && await page.getByRole("textbox", { name: /chat message/i }).count() === 1, text.slice(0, 400));
  await context.close();
}

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
