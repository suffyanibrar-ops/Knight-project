/**
 * Voice echo / turn-boundary regression.
 *
 *   npm run test:voice:echo
 *
 * The headless browser has no speaker/microphone acoustics, so browser speech
 * synthesis and recognition are mocked. This exercises the production widget
 * and hook with realistic event ordering:
 *   - Riley's own TTS text emitted as a "final" STT result while speaking
 *   - 30 seconds of no visitor speech
 *   - a genuine transcript barge-in
 *   - a short legitimate answer ("yes")
 *   - limited echo cancellation reported by the audio track
 *
 * Requires the AI_TEST_MODE server.
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

const installSpeechMock = async (context) => {
  await context.addInitScript(() => {
    try { sessionStorage.setItem("kmb-intro-seen", "1"); } catch { /* ignore */ }
    window.__speech = { utterances: [], timers: [], recognition: null, cancelCount: 0, active: false, duration: 4500 };
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
      try { Object.defineProperty(window, key, { value: FakeRecognition, configurable: true }); } catch { window[key] = FakeRecognition; }
    }
    window.__mediaTracks = [];
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await originalGetUserMedia(constraints);
      window.__mediaTracks.push(...stream.getAudioTracks());
      return stream;
    };
    const synth = window.speechSynthesis;
    synth.speak = (utterance) => {
      window.__speech.utterances.push(utterance.text);
      window.__speech.active = true;
      window.__speech.timers.push(window.setTimeout(() => {
        window.__speech.active = false;
        utterance.onend?.();
      }, window.__speech.duration));
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
};

const openVoice = async (page) => {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /open knight ai assistant/i }).click();
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: /start voice conversation/i }).click();
  await page.getByRole("button", { name: /enable microphone/i }).click();
  await page.waitForFunction(() => Boolean(window.__speech.recognition?.onresult), undefined, { timeout: 10_000 }).catch(() => {});
};

const waitState = async (page, state, timeout = 20_000) => {
  await page.waitForFunction((s) => document.querySelector('[role="dialog"]')?.getAttribute("data-voice-state") === s, state, { timeout }).catch(() => {});
};

const countChatRequests = (page) => {
  const count = { value: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/ai\/chat$/.test(new URL(request.url()).pathname)) count.value += 1;
  });
  return count;
};

// ---------- normal AEC path: self-echo must not create a turn ----------
{
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ["microphone"] });
  await installSpeechMock(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));
  const requests = countChatRequests(page);
  await openVoice(page);

  // Capture the current recognizer generation before the final that closes it.
  await page.evaluate(() => { window.__speech.oldRecognition = window.__speech.recognition; });
  await page.evaluate(() => window.__emit("In one sentence, what services do you offer?", true));
  await page.waitForFunction(() => window.__speech.utterances.length >= 1, undefined, { timeout: 20_000 }).catch(() => {});
  await waitState(page, "speaking", 15_000);
  const spoken = await page.evaluate(() => window.__speech.utterances[0] ?? "");
  ok("Riley produced spoken output", spoken.length > 0, spoken.slice(0, 100));
  const requestsBeforeEcho = requests.value;
  const cancelsBeforeEcho = await page.evaluate(() => window.__speech.cancelCount);

  // Simulate both interim and final STT results created by Riley's exact
  // output while it is speaking. Neither may authorize barge-in or a turn.
  await page.evaluate((text) => window.__emit(text, false), spoken);
  await page.evaluate((text) => window.__emit(text, true), spoken);
  await page.waitForTimeout(1400);
  ok("self-echo interim does not trigger barge-in", await page.evaluate((count) => window.__speech.cancelCount === count, cancelsBeforeEcho));
  ok("self-echo final does not create a chat request", requests.value === requestsBeforeEcho, `${requestsBeforeEcho} -> ${requests.value}`);
  const userTurnsAfterEcho = await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] .bg-brand-500')).map((element) => element.textContent ?? ""));
  ok("self-echo final does not create a duplicate user turn", userTurnsAfterEcho.length <= 1, JSON.stringify(userTurnsAfterEcho));

  // Let the answer finish and wait through the echo-tail guard.
  await page.waitForTimeout(4800);
  await page.waitForTimeout(1200);

  // 30 seconds without any visitor utterance. No request may appear.
  const requestsBeforeSilence = requests.value;
  await page.waitForTimeout(30_000);
  ok("30s of Riley-only audio creates no new turn", requests.value === requestsBeforeSilence, `${requestsBeforeSilence} -> ${requests.value}`);
  ok("Riley returns to listening after silence test", ["listening", "idle"].includes(await page.locator('[role="dialog"]').getAttribute("data-voice-state")));

  // A delayed result from the recognizer generation that produced the prior
  // turn must be ignored even after the next answer is idle.
  const requestsBeforeStale = requests.value;
  await page.evaluate(() => {
    window.__speech.oldRecognition?.onresult?.({
      resultIndex: 0,
      results: Object.assign([{ 0: { transcript: "This is a delayed old transcript." }, isFinal: true }], { length: 1 }),
    });
  });
  await page.waitForTimeout(1200);
  ok("delayed STT from a completed turn is ignored", requests.value === requestsBeforeStale, `${requestsBeforeStale} -> ${requests.value}`);

  // Start another answer, then interrupt it mid-speech.
  const utterancesBeforeBarge = await page.evaluate(() => window.__speech.utterances.length);
  await page.evaluate(() => window.__emit("Give me one sentence about denials.", true));
  await page.waitForFunction((count) => window.__speech.utterances.length > count, utterancesBeforeBarge, { timeout: 20_000 }).catch(() => {});
  await waitState(page, "speaking", 15_000);
  const requestsBeforeBarge = requests.value;
  const cancelsBefore = await page.evaluate(() => window.__speech.cancelCount);
  await page.evaluate(() => window.__emit("Actually, I want to discuss denials.", false));
  await page.waitForTimeout(450);
  const cancelsAfter = await page.evaluate(() => window.__speech.cancelCount);
  ok("genuine interim barge-in cancels TTS", cancelsAfter > cancelsBefore, `${cancelsBefore} -> ${cancelsAfter}`);
  await page.evaluate(() => window.__emit("What about denials?", true));
  await page.waitForTimeout(1800);
  ok("genuine interruption starts a new request", requests.value > requestsBeforeBarge, `${requestsBeforeBarge} -> ${requests.value}`);

  // Short answer must not be filtered as echo.
  await waitState(page, "listening", 15_000);
  const requestsBeforeYes = requests.value;
  await page.evaluate(() => window.__emit("yes", true));
  await page.waitForTimeout(1500);
  ok("short legitimate answer 'yes' is accepted", requests.value > requestsBeforeYes, `${requestsBeforeYes} -> ${requests.value}`);

  await page.getByRole("button", { name: /end voice/i }).click();
  await page.waitForTimeout(350);
  const tracksEnded = await page.evaluate(() => window.__mediaTracks.length > 0 && window.__mediaTracks.every((track) => track.readyState === "ended"));
  ok("ending voice stops the microphone tracks", tracksEnded, String(await page.evaluate(() => window.__mediaTracks.map((track) => track.readyState))));
  ok("no browser errors during echo-turn tests", errors.length === 0, errors.join(" | "));
  await context.close();
}

// ---------- 30 seconds of continuous Riley speech, no visitor ----------
{
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ["microphone"] });
  await installSpeechMock(context);
  const page = await context.newPage();
  const requests = countChatRequests(page);
  await openVoice(page);
  await page.evaluate(() => { window.__speech.duration = 30_000; });
  await page.evaluate(() => window.__emit("Give me a detailed overview of your services.", true));
  await page.waitForFunction(() => window.__speech.utterances.length >= 1, undefined, { timeout: 20_000 }).catch(() => {});
  await waitState(page, "speaking", 15_000);
  const spoken = await page.evaluate(() => window.__speech.utterances[0] ?? "");
  const before = requests.value;
  const cancelsBefore = await page.evaluate(() => window.__speech.cancelCount);
  // Emit the agent's own text as interim and final results repeatedly while it
  // is still speaking. If any one authorizes barge-in or a turn, it will show up.
  for (let i = 0; i < 15; i += 1) {
    await page.waitForTimeout(2000);
    await page.evaluate((text) => window.__emit(text, false), spoken);
    await page.evaluate((text) => window.__emit(text, true), spoken);
  }
  ok("30s continuous TTS never creates a self-turn", requests.value === before, `${before} -> ${requests.value}`);
  ok("30s continuous TTS never triggers self-barge", await page.evaluate((count) => window.__speech.cancelCount === count, cancelsBefore));
  ok("Riley is still in the speaking state after the 30s self-echo run", (await page.locator('[role="dialog"]').getAttribute("data-voice-state")) === "speaking");
  await page.evaluate(() => window.speechSynthesis.cancel());
  await context.close();
}

// ---------- no AEC: half-duplex fallback must still be safe ----------
{
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ["microphone"] });
  await installSpeechMock(context);
  const page = await context.newPage();
  await context.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      for (const track of stream.getAudioTracks()) {
        const realSettings = track.getSettings.bind(track);
        Object.defineProperty(track, "getSettings", {
          configurable: true,
          value: () => ({ ...realSettings(), echoCancellation: false }),
        });
      }
      return stream;
    };
  });
  const requests = countChatRequests(page);
  await openVoice(page);
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.getAttribute("data-voice-mode") === "half-duplex", undefined, { timeout: 10_000 }).catch(() => {});
  ok("limited AEC switches to half-duplex", (await page.locator('[role="dialog"]').getAttribute("data-voice-mode")) === "half-duplex");
  await page.evaluate(() => window.__emit("How can you help with denials?", true));
  await page.waitForFunction(() => window.__speech.utterances.length >= 1, undefined, { timeout: 20_000 }).catch(() => {});
  await waitState(page, "speaking", 15_000);
  const before = requests.value;
  const spoken = await page.evaluate(() => window.__speech.utterances[0] ?? "");
  await page.evaluate((text) => window.__emit(text, true), spoken);
  await page.waitForTimeout(1400);
  ok("half-duplex ignores self-echo", requests.value === before, `${before} -> ${requests.value}`);
  ok("half-duplex limitation is explained", /limited echo cancellation/i.test(await page.locator('[role="dialog"]').innerText()));
  await context.close();
}

// ---------- microphone denial / recognizer error stays recoverable ----------
{
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await installSpeechMock(context);
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /open knight ai assistant/i }).click();
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: /start voice conversation/i }).click();
  await page.getByRole("button", { name: /enable microphone/i }).click();
  await page.waitForFunction(() => Boolean(window.__speech.recognition?.onerror), undefined, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => window.__speech.recognition.onerror?.({ error: "not-allowed" }));
  await page.waitForTimeout(400);
  const denialText = await page.locator('[role="dialog"]').innerText();
  ok("microphone denial is surfaced", /permission was denied/i.test(denialText), denialText.slice(0, 300));
  ok("microphone denial remains recoverable by text", /permission was denied/i.test(denialText) && (await page.locator('[role="dialog"]').getAttribute("data-voice-state")) === "error");
  await context.close();
}

await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
