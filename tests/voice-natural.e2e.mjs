/**
 * Voice naturalness / reliability test.
 *
 * Uses mocked browser speech APIs (headless browsers have no audio engine) to
 * verify the real widget logic: sentence batching, turn completion, repeated
 * turns and barge-in. Requires an AI_TEST_MODE server.
 */
import { chromium } from "playwright";

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
const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ["microphone"] });
await context.addInitScript(() => {
  try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ }
  window.__speech = { utterances: [], timers: [], recognition: null, cancelCount: 0 };
  class FakeRecognition {
    constructor() { this.lang = ""; this.continuous = true; this.interimResults = true; this.maxAlternatives = 1; this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null; window.__speech.recognition = this; }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() {}
  }
  try { Object.defineProperty(window, "SpeechRecognition", { value: FakeRecognition, configurable: true }); } catch { window.SpeechRecognition = FakeRecognition; }
  try { Object.defineProperty(window, "webkitSpeechRecognition", { value: FakeRecognition, configurable: true }); } catch { window.webkitSpeechRecognition = FakeRecognition; }
  const synth = window.speechSynthesis;
  synth.speak = (utterance) => {
    window.__speech.utterances.push(utterance.text);
    window.__speech.timers.push(window.setTimeout(() => utterance.onend?.(), 4500));
  };
  synth.cancel = () => {
    window.__speech.cancelCount += 1;
    window.__speech.timers.forEach((timer) => clearTimeout(timer));
    window.__speech.timers = [];
  };
  window.__emit = (text, final = true) => {
    const recognition = window.__speech.recognition;
    if (!recognition?.onresult) return false;
    recognition.onresult({ resultIndex: 0, results: Object.assign([{ 0: { transcript: text }, isFinal: final }], { length: 1 }) });
    return true;
  };
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));
const waitForIntent = async () => {
  await page.waitForFunction(() => Boolean(window.__speech.recognition?.onresult), undefined, { timeout: 10_000 }).catch(() => {});
};

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(1300);
await page.getByRole("button", { name: /open knight ai assistant/i }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /start voice conversation/i }).click();
await page.getByRole("button", { name: /enable microphone/i }).click();
await waitForIntent();

const say = async (text) => {
  await page.evaluate((value) => window.__emit(value, true), text);
};
const waitForSpeech = async (minCount) => {
  await page.waitForFunction((count) => window.__speech.utterances.length >= count, minCount, { timeout: 20_000 }).catch(() => {});
};

// A clear three-sentence prompt gives the batching logic something to combine.
await say("In three short sentences, what services do you offer?");
await waitForSpeech(1);
await page.waitForTimeout(2500);
let speech = await page.evaluate(() => ({ utterances: window.__speech.utterances.slice(), cancels: window.__speech.cancelCount }));
ok("voice produces audio for the answer", speech.utterances.length > 0, JSON.stringify(speech.utterances.slice(0, 2)));
ok("sentences are batched instead of one utterance per sentence", speech.utterances.length <= 3, `${speech.utterances.length} utterances`);
const sentenceCounts = speech.utterances.map((text) => (text.match(/[.!?]+(?=\s|$)/g) ?? []).length);
ok("the first spoken batch contains a complete phrase", Math.max(...sentenceCounts, 0) >= 1, JSON.stringify(sentenceCounts));
ok("no fragmented one-word utterances", speech.utterances.every((text) => text.trim().split(/\s+/).length >= 3), JSON.stringify(speech.utterances));

// Let the first answer finish and verify the UI returns to listening.
const waitForStatus = async (pattern, timeout = 15_000) => {
  await page.waitForFunction((source) => new RegExp(source, "i").test(document.querySelector('[role="dialog"]')?.textContent ?? ""), pattern, { timeout }).catch(() => {});
};
await waitForStatus("listening");
ok("voice returns to listening after speaking", /listening/i.test(await page.locator('[role="dialog"]').innerText()), (await page.locator('[role="dialog"]').innerText()).slice(0, 200));

// Second turn proves the engine can be reused without duplicate/stale callbacks.
await say("And how does onboarding work?");
await waitForSpeech(speech.utterances.length + 1);
await page.waitForTimeout(2500);
speech = await page.evaluate(() => ({ utterances: window.__speech.utterances.slice(), cancels: window.__speech.cancelCount }));
ok("a second voice turn speaks new audio", speech.utterances.length > 1, `${speech.utterances.length} utterances`);
ok("repeated turns do not duplicate the first answer", new Set(speech.utterances).size === speech.utterances.length);

// Barge-in must still cancel current audio. Wait until the second answer is
// actually in the speaking state before interrupting it.
await waitForStatus("speaking", 10_000);
await page.evaluate(() => window.__emit("Actually, wait a moment", false));
await page.waitForTimeout(500);
const afterBarge = await page.evaluate(() => window.__speech.cancelCount);
ok("barge-in cancels active speech", afterBarge > 0, String(afterBarge));
await page.evaluate(() => window.__emit("What about denials?", true));
await page.waitForTimeout(3000);
ok("voice remains alive after interruption", await page.evaluate(() => Boolean(window.__speech.recognition?.onresult)));

// A browser speech-engine failure must never crash or wedge the assistant.
await page.evaluate(() => {
  window.speechSynthesis.speak = () => { throw new Error("simulated speech engine failure"); };
  window.__emit("What about credentialing?", true);
});
await page.waitForTimeout(5000);
const stateAfterFailure = await page.locator('[role="dialog"]').getAttribute("data-voice-state");
ok("voice recovers from a speech-engine failure", stateAfterFailure === "listening" || stateAfterFailure === "idle", String(stateAfterFailure));
ok("failed speech does not throw page errors", errors.length === 0, errors.join(" | "));

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
