/**
 * Android Chrome voice lifecycle regression.
 *
 * This is an emulated Chromium mobile context, not a real Android device. It
 * verifies the Android-specific code path (no second getUserMedia capture, no
 * silent-TTS priming before recognition, half-duplex pause/resume).
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};

const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  permissions: ["microphone"],
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
});

await context.addInitScript(() => {
  try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ }
  window.__speech = { recognition: null, starts: 0, aborts: 0, getUserMediaCalls: 0, utterances: [], timers: [], active: false, cancelCount: 0 };
  class FakeRecognition {
    constructor() {
      this.lang = ""; this.continuous = true; this.interimResults = true; this.maxAlternatives = 1;
      this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null;
      window.__speech.recognition = this;
    }
    start() { window.__speech.starts += 1; this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { window.__speech.aborts += 1; }
  }
  for (const key of ["SpeechRecognition", "webkitSpeechRecognition"]) {
    try { Object.defineProperty(window, key, { value: FakeRecognition, configurable: true }); } catch { window[key] = FakeRecognition; }
  }
  if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: {}, configurable: true });
  navigator.mediaDevices.getUserMedia = async () => {
    window.__speech.getUserMediaCalls += 1;
    throw new Error("Android path should not open a second microphone stream");
  };
  const synth = window.speechSynthesis;
  synth.speak = (utterance) => {
    if (!utterance.text.trim()) return;
    window.__speech.utterances.push(utterance.text);
    window.__speech.active = true;
    window.__speech.timers.push(window.setTimeout(() => { window.__speech.active = false; utterance.onend?.(); }, 1200));
  };
  synth.cancel = () => {
    window.__speech.cancelCount += 1;
    window.__speech.active = false;
    window.__speech.timers.forEach((timer) => clearTimeout(timer));
    window.__speech.timers = [];
  };
  try { Object.defineProperty(synth, "speaking", { configurable: true, get: () => window.__speech.active }); } catch { /* native */ }
  window.__emit = (text, final = true) => {
    const recognition = window.__speech.recognition;
    if (!recognition?.onresult) return false;
    recognition.onresult({ resultIndex: 0, results: Object.assign([{ 0: { transcript: text }, isFinal: final }], { length: 1 }) });
    return true;
  };
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 160)));
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /open knight ai assistant/i }).click();
await page.waitForTimeout(650);
await page.getByRole("button", { name: /start voice conversation/i }).click();
await page.getByRole("button", { name: /enable microphone/i }).click();
await page.waitForFunction(() => Boolean(window.__speech.recognition?.onresult), undefined, { timeout: 10_000 }).catch(() => {});

const initial = await page.evaluate(() => ({
  mode: document.querySelector('[role="dialog"]')?.getAttribute("data-voice-mode"),
  state: document.querySelector('[role="dialog"]')?.getAttribute("data-voice-state"),
  getUserMediaCalls: window.__speech.getUserMediaCalls,
  starts: window.__speech.starts,
  utterancesBeforeResponse: window.__speech.utterances.length,
}));
ok("Android path selects half-duplex", initial.mode === "half-duplex", JSON.stringify(initial));
ok("Android path avoids a second microphone stream", initial.getUserMediaCalls === 0, String(initial.getUserMediaCalls));
ok("Android path starts recognition from the tap", initial.starts >= 1, String(initial.starts));
ok("Android path does not prime TTS before recognition", initial.utterancesBeforeResponse === 0, String(initial.utterancesBeforeResponse));

await page.evaluate(() => window.__emit("In three short sentences, what services do you offer?", true));
await page.waitForFunction(() => window.__speech.utterances.length >= 1, undefined, { timeout: 20_000 }).catch(() => {});
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({ utterances: window.__speech.utterances.slice(), aborts: window.__speech.aborts }));
ok("Android path speaks Riley's response", after.utterances.length >= 1, JSON.stringify(after.utterances));
ok("Android path does not send a silent TTS unlock", after.utterances.every((text) => text.trim().length > 0), JSON.stringify(after.utterances));
ok("Android path closes recognition while speaking", after.aborts > 0, String(after.aborts));
ok("Android voice path has no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
