/**
 * Mobile voice lifecycle regression.
 *
 *   npm run test:voice:mobile
 *
 * Uses Chromium with an iPhone-style mobile context and mocked SpeechRecognition
 * + speechSynthesis (headless browsers have no real audio engine). It verifies
 * the production hook's mobile decisions:
 *   - no second getUserMedia capture beside SpeechRecognition
 *   - half-duplex mode
 *   - recognition closes while Riley speaks and reopens afterwards
 *   - a second voice turn works without reloading
 *   - audio-capture errors are reported as device problems, not permission denial
 *   - text input remains available
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
const context = await browser.newContext({
  ...devices["iPhone 13"],
  permissions: ["microphone"],
});

await context.addInitScript(() => {
  try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ }
  window.__speech = {
    utterances: [],
    timers: [],
    recognition: null,
    recognitionStarts: 0,
    recognitionAborts: 0,
    getUserMediaCalls: 0,
    cancelCount: 0,
    active: false,
  };

  class FakeRecognition {
    constructor() {
      this.lang = "";
      this.continuous = true;
      this.interimResults = true;
      this.maxAlternatives = 1;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.onstart = null;
      window.__speech.recognition = this;
    }
    start() {
      window.__speech.recognitionStarts += 1;
      this.onstart?.();
    }
    stop() { this.onend?.(); }
    abort() { window.__speech.recognitionAborts += 1; }
  }

  for (const key of ["SpeechRecognition", "webkitSpeechRecognition"]) {
    try { Object.defineProperty(window, key, { value: FakeRecognition, configurable: true }); }
    catch { window[key] = FakeRecognition; }
  }

  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", { value: {}, configurable: true });
  }
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__speech.getUserMediaCalls += 1;
    return originalGetUserMedia(constraints);
  };

  const synth = window.speechSynthesis;
  synth.speak = (utterance) => {
    // The hook deliberately primes synthesis with a silent utterance on mobile.
    if (!utterance.text.trim()) return;
    window.__speech.utterances.push(utterance.text);
    window.__speech.active = true;
    window.__speech.timers.push(window.setTimeout(() => {
      window.__speech.active = false;
      utterance.onend?.();
    }, 1600));
  };
  synth.cancel = () => {
    window.__speech.cancelCount += 1;
    window.__speech.active = false;
    window.__speech.timers.forEach((timer) => clearTimeout(timer));
    window.__speech.timers = [];
  };
  try {
    Object.defineProperty(synth, "speaking", { configurable: true, get: () => window.__speech.active });
  } catch { /* native getter remains */ }

  window.__emit = (text, final = true) => {
    const recognition = window.__speech.recognition;
    if (!recognition?.onresult) return false;
    recognition.onresult({
      resultIndex: 0,
      results: Object.assign([{ 0: { transcript: text }, isFinal: final }], { length: 1 }),
    });
    return true;
  };
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));

const waitState = async (state, timeout = 20_000) => {
  await page.waitForFunction((s) => document.querySelector('[role="dialog"]')?.getAttribute("data-voice-state") === s, state, { timeout }).catch(() => {});
};
const waitMode = async (mode, timeout = 10_000) => {
  await page.waitForFunction((m) => document.querySelector('[role="dialog"]')?.getAttribute("data-voice-mode") === m, mode, { timeout }).catch(() => {});
};
const waitRecognition = async () => {
  await page.waitForFunction(() => Boolean(window.__speech.recognition?.onresult), undefined, { timeout: 10_000 }).catch(() => {});
};

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /talk to riley voice assistant/i }).click();
await page.waitForTimeout(900);
await waitRecognition();
await page.waitForTimeout(5000);
await waitState("listening", 10_000);
await page.evaluate(() => { window.__speech.utterances = []; });

let state = await page.evaluate(() => ({
  mode: document.querySelector('[role="dialog"]')?.getAttribute("data-voice-mode"),
  state: document.querySelector('[role="dialog"]')?.getAttribute("data-voice-state"),
  getUserMediaCalls: window.__speech.getUserMediaCalls,
  starts: window.__speech.recognitionStarts,
  aborts: window.__speech.recognitionAborts,
}));
ok("mobile selects half-duplex mode", state.mode === "half-duplex", JSON.stringify(state));
ok("mobile requests the native microphone permission once", state.getUserMediaCalls === 1, String(state.getUserMediaCalls));
ok("mobile starts recognition after the explicit tap", state.starts >= 1, String(state.starts));

await page.evaluate(() => window.__emit("In three short sentences, what services do you offer?", true));
await page.waitForFunction(() => window.__speech.utterances.length >= 1, undefined, { timeout: 20_000 }).catch(() => {});
await waitState("speaking", 15_000).catch(() => undefined);
const whileSpeaking = await page.evaluate(() => ({
  state: document.querySelector('[role="dialog"]')?.getAttribute("data-voice-state"),
  aborts: window.__speech.recognitionAborts,
  starts: window.__speech.recognitionStarts,
}));
ok("mobile speaking state is visible", whileSpeaking.state === "speaking", JSON.stringify(whileSpeaking));
ok("half-duplex closes recognition while Riley speaks", whileSpeaking.aborts > state.aborts, JSON.stringify(whileSpeaking));

await page.waitForFunction((count) => window.__speech.recognitionStarts > count, state.starts, { timeout: 10_000 }).catch(() => {});
const afterSpeech = await page.evaluate(() => ({
  state: document.querySelector('[role="dialog"]')?.getAttribute("data-voice-state"),
  starts: window.__speech.recognitionStarts,
  active: window.__speech.active,
}));
ok("half-duplex reopens recognition after TTS", afterSpeech.starts > state.starts, JSON.stringify(afterSpeech));
ok("voice returns to listening after TTS", ["listening", "idle"].includes(afterSpeech.state ?? ""), JSON.stringify(afterSpeech));

await page.evaluate(() => window.__emit("And how does onboarding work?", true));
await page.waitForFunction(() => window.__speech.utterances.length >= 2, undefined, { timeout: 20_000 }).catch(() => {});
const repeated = await page.evaluate(() => ({
  utterances: window.__speech.utterances.length,
  starts: window.__speech.recognitionStarts,
}));
ok("mobile supports a second voice turn without reload", repeated.utterances >= 2, JSON.stringify(repeated));
await page.waitForFunction((count) => window.__speech.recognitionStarts > count, afterSpeech.starts, { timeout: 10_000 }).catch(() => {});
const resumedAfterSecond = await page.evaluate(() => window.__speech.recognitionStarts);
ok("recognition is restarted after the second turn", resumedAfterSecond > afterSpeech.starts, `${afterSpeech.starts} -> ${resumedAfterSecond}`);

// A missing/in-use microphone must not be reported as a permission denial.
await page.evaluate(() => {
  const recognition = window.__speech.recognition;
  recognition?.onerror?.({ error: "audio-capture" });
});
await waitState("error", 10_000);
const errorText = await page.locator('[role="dialog"]').innerText();
ok("audio-capture is reported as a device problem", /No usable microphone/i.test(errorText), errorText.slice(0, 400));
ok("audio-capture is not misreported as permission denial", !/permission was denied/i.test(errorText), errorText.slice(0, 400));
await page.getByRole("button", { name: /open text chat/i }).first().click();
await page.waitForTimeout(500);
ok("text chat remains available after audio failure", await page.getByRole("textbox", { name: /chat message/i }).count() === 1);
ok("mobile voice test has no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
