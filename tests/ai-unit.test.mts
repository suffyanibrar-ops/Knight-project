/**
 * Pure unit tests for timezone math, ambiguity handling, interval overlap and
 * the browser-voice text engine. Run with: npx tsx tests/ai-unit.test.mts
 */
import { DateTime } from "luxon";
import {
  chooseBestVoice,
  normalizeForSpeech,
  splitForSpeech,
} from "../src/components/ai/voice-text";
import {
  TimezoneInputError,
  inferTimezoneFromText,
  formatAppointment,
  intervalsOverlap,
  localToUtcInstant,
  parseTimeInput,
  resolveTimezone,
  timezoneLabel,
} from "../src/lib/timezone";

let pass = 0;
let fail = 0;
function ok(name: string, condition: boolean, extra = "") {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
}
function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, actual === expected, `actual=${String(actual)} expected=${String(expected)}`);
}
function throwsCode(name: string, fn: () => unknown, code: string) {
  try { fn(); ok(name, false, "did not throw"); }
  catch (error) {
    ok(name, error instanceof TimezoneInputError && error.code === code, error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
  }
}

// ---------- timezone aliases ----------
for (const [input, expected] of [
  ["Eastern", "America/New_York"], ["ET", "America/New_York"], ["central", "America/Chicago"],
  ["Central time", "America/Chicago"], ["Mountain", "America/Denver"], ["Pacific", "America/Los_Angeles"],
  ["Dallas", "America/Chicago"], ["Denver", "America/Denver"], ["Seattle", "America/Los_Angeles"],
  ["America/Chicago", "America/Chicago"],
] as const) {
  eq(`timezone alias ${input}`, resolveTimezone(input), expected);
}
eq("unknown timezone is rejected", resolveTimezone("Mars/Olympus"), null);
eq("city inference: Dallas is Central", inferTimezoneFromText("We are a practice in Dallas."), "America/Chicago");
eq("city inference: Seattle is Pacific", inferTimezoneFromText("Our clinic is in Seattle, Washington."), "America/Los_Angeles");
eq("timezone phrase inference: Central", inferTimezoneFromText("I'm in Central."), "America/Chicago");
eq("conflicting zones are not guessed", inferTimezoneFromText("Our offices are in New York and Los Angeles."), null);
eq("timezone label", timezoneLabel("America/Chicago"), "Central Time");

// ---------- four US zones (standard time, Nov 10 2026) ----------
const zones = [
  ["America/New_York", 16], ["America/Chicago", 17], ["America/Denver", 18], ["America/Los_Angeles", 19],
] as const;
for (const [zone, expectedHour] of zones) {
  const result = localToUtcInstant({ date: "2026-11-10", time: "11:00 AM", timezone: zone });
  eq(`${zone} 11 AM -> ${expectedHour}:00Z`, DateTime.fromMillis(result.utcMs).toUTC().hour, expectedHour);
  eq(`${zone} displayed in its own zone`, formatAppointment(result.utcMs, zone).timeISO, "11:00");
}

// ---------- daylight saving transitions ----------
const january = localToUtcInstant({ date: "2027-01-15", time: "2:00 PM", timezone: "America/Chicago" });
const july = localToUtcInstant({ date: "2027-07-15", time: "2:00 PM", timezone: "America/Chicago" });
eq("Chicago winter is CST (UTC-6)", DateTime.fromMillis(january.utcMs).toUTC().toFormat("HH:mm"), "20:00");
eq("Chicago summer is CDT (UTC-5)", DateTime.fromMillis(july.utcMs).toUTC().toFormat("HH:mm"), "19:00");

// ---------- ambiguous and invalid times ----------
throwsCode("bare hour is ambiguous", () => parseTimeInput("2"), "ambiguous_time");
throwsCode("time without meridiem is ambiguous", () => parseTimeInput("2:30"), "ambiguous_time");
throwsCode("invalid meridiem hour", () => parseTimeInput("13 PM"), "invalid_time");
eq("2 PM parses", parseTimeInput("2:00 PM").hour, 14);
eq("14:00 parses as 24h", parseTimeInput("14:00").hour, 14);
eq("12 AM is midnight", parseTimeInput("12:00 AM").hour, 0);
eq("12 PM is noon", parseTimeInput("12:00 PM").hour, 12);
throwsCode("missing date", () => localToUtcInstant({ date: "", time: "2:00 PM", timezone: "America/Chicago" }), "needs_date");
throwsCode("missing time", () => localToUtcInstant({ date: "2026-11-10", time: "", timezone: "America/Chicago" }), "needs_time");
throwsCode("unknown zone", () => localToUtcInstant({ date: "2026-11-10", time: "2:00 PM", timezone: "Nowhere" }), "unknown_timezone");

// ---------- interval overlap ----------
ok("partial overlap conflicts", intervalsOverlap(14 * 60, 14 * 60 + 30, 14 * 60 + 15, 14 * 60 + 45));
ok("contained overlap conflicts", intervalsOverlap(14 * 60, 15 * 60, 14 * 60 + 15, 14 * 60 + 30));
ok("back-to-back is free", !intervalsOverlap(14 * 60, 14 * 60 + 30, 14 * 60 + 30, 15 * 60));
ok("before is free", !intervalsOverlap(13 * 60, 13 * 60 + 30, 14 * 60, 14 * 60 + 30));

// ---------- voice text engine ----------
const normalized = normalizeForSpeech("**A/R** is up — see [our guide](https://example.com/x) at 2:00 PM.");
ok("markdown and links removed", !normalized.includes("**") && !normalized.includes("http") && !normalized.includes("]("), normalized);
ok("A/R expanded for speech", normalized.includes("A R"), normalized);
ok("dash becomes a pause", normalized.includes(","), normalized);
const chunks = splitForSpeech("That can happen even when claims go out on time. Are you seeing denials, underpayments, or older A/R?");
eq("sentence chunk count", chunks.length, 2);
ok("question gets slightly higher pitch", (chunks[1]?.pitch ?? 0) > (chunks[0]?.pitch ?? 0), JSON.stringify(chunks));
ok("chunks stay short", chunks.every((chunk) => chunk.text.length <= 190), JSON.stringify(chunks.map((c) => c.text.length)));

const voices = [
  { name: "Albert", lang: "en-US", localService: true },
  { name: "Samantha", lang: "en-US", localService: true },
  { name: "Samantha (Enhanced)", lang: "en-US", localService: true },
  { name: "Google US English", lang: "en-US", localService: false },
  { name: "Thomas", lang: "en-GB", localService: true },
];
const best = chooseBestVoice(voices, "en-US");
ok("best natural voice chosen", best?.name === "Samantha (Enhanced)" || best?.name === "Google US English", String(best?.name));
eq("preferred voice wins", chooseBestVoice(voices, "en-US", "google")?.name, "Google US English");
eq("English fallback allowed when only en-GB exists", chooseBestVoice([{ name: "Thomas", lang: "en-GB" }], "en-US")?.lang, "en-GB");
eq("no English voice yields null", chooseBestVoice([{ name: "Amelie", lang: "fr-FR" }], "en-US"), null);

console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
