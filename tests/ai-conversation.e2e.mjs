/**
 * Conversation + scheduling test suite for the Knight Medical Billing agent.
 *
 *   AI_TEST_MODE=1 AI_TEST_SUPPRESS_EMAILS=1 npm run start   # on port 3000
 *   node tests/ai-conversation.e2e.mjs
 *
 * Covers: 4 US timezones, DST, timezone changes, availability, conflicts,
 * partial overlap, back-to-back, ambiguity, missing date, calendar failure,
 * confirmation gating, explicit booking, general questions, concern handling,
 * multi-message memory and timezone-aware conversation behavior.
 *
 * Test-only environment flags are ignored unless AI_TEST_MODE=1. Fixtures are
 * removed before and after the run; no emails are sent in test mode.
 */
import { chromium } from "playwright";
import { DateTime } from "luxon";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const ROOT = process.cwd();
const DB_PATH = process.env.SQLITE_PATH ?? path.join(ROOT, "data", "app.db");

let pass = 0;
let fail = 0;
const ok = (name, condition, extra = "") => {
  if (condition) { pass += 1; console.log("PASS", name); }
  else { fail += 1; console.log("FAIL", name, extra); }
};

function db() { return new Database(DB_PATH); }
function cleanAiFixtures() {
  const conn = db();
  conn.pragma("foreign_keys = ON");
  for (const table of ["ai_messages", "ai_conversation_contexts", "ai_appointments", "ai_handoffs", "ai_leads", "ai_usage_logs", "ai_blocked_times", "ai_conversations"]) {
    try { conn.prepare(`DELETE FROM ${table}`).run(); } catch { /* ignore */ }
  }
  conn.close();
}
function appointmentCount() {
  const conn = db();
  const row = conn.prepare("SELECT COUNT(*) AS n FROM ai_appointments").get();
  conn.close();
  return Number(row.n);
}
function appointmentByName(name) {
  const conn = db();
  const row = conn.prepare("SELECT * FROM ai_appointments WHERE name = ? ORDER BY id DESC LIMIT 1").get(name);
  conn.close();
  return row ?? null;
}

cleanAiFixtures();
const browser = await chromium.launch();
const api = await browser.newContext();
const request = api.request;
const headers = { Origin: BASE };

async function checkTime(date, time, timezone, durationMinutes) {
  const response = await request.post(`${BASE}/api/ai/appointments/check`, { data: { date, time, timezone, durationMinutes }, headers });
  const body = await response.json().catch(() => null);
  return { status: response.status(), body };
}
async function bookTime({ date, time, timezone, name, email = "admin@knightmedicalbilling.com", durationMinutes = 15, confirmed = true }) {
  const response = await request.post(`${BASE}/api/ai/appointments`, {
    data: { date, time, timezone, durationMinutes, name, email, confirmed }, headers,
  });
  const body = await response.json().catch(() => null);
  return { status: response.status(), body };
}
async function manageAppointment(token, action, extra = {}) {
  const response = await request.post(`${BASE}/api/ai/appointments/manage`, { data: { token, action, ...extra }, headers });
  return { status: response.status(), body: await response.json().catch(() => null) };
}
async function freshChat() {
  const ctx = await browser.newContext();
  ctx.request.headers = headers;
  async function chat(message) {
    const response = await ctx.request.post(`${BASE}/api/ai/chat`, { data: { message }, headers, timeout: 180_000 });
    const raw = await response.text();
    const tokens = [];
    let error = null;
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload);
        if (event.type === "token" && typeof event.text === "string") tokens.push(event.text);
        if (event.type === "error") error = event.message;
      } catch { /* ignore */ }
    }
    return { status: response.status(), text: tokens.join("").replace(/\s+/g, " ").trim(), error };
  }
  return { ctx, chat, close: () => ctx.close() };
}

// ---------- 1–4: four US zones, no Eastern assumption ----------
const zoneCases = [
  ["Eastern", "America/New_York", "16:00"],
  ["Central", "America/Chicago", "17:00"],
  ["Mountain", "America/Denver", "18:00"],
  ["Pacific", "America/Los_Angeles", "19:00"],
];
for (const [label, zone, utc] of zoneCases) {
  const result = await checkTime("2026-11-12", "11:00 AM", label);
  const iso = result.body?.requested?.iso ?? "";
  ok(`${label} timezone maps to ${zone}`, result.status === 200 && result.body?.available === true && result.body?.requested?.timezone === zone, JSON.stringify(result.body).slice(0, 220));
  ok(`${label} 11 AM converts to ${utc}Z`, iso === `2026-11-12T${utc}:00.000Z`, iso);
  ok(`${label} is displayed in the visitor zone`, result.body?.requested?.timeLabel?.includes(label === "Mountain" ? "MST" : label === "Pacific" ? "PST" : label === "Central" ? "CST" : "EST") ?? false, result.body?.requested?.timeLabel);
}

// ---------- 5: daylight saving time (winter CST vs summer CDT) ----------
const winter = await checkTime("2027-01-15", "2:00 PM", "Central");
const summer = await checkTime("2027-07-15", "2:00 PM", "Central");
ok("winter 2 PM Central is UTC-6", winter.body?.requested?.iso === "2027-01-15T20:00:00.000Z", JSON.stringify(winter.body?.requested?.iso));
ok("summer 2 PM Central is UTC-5", summer.body?.requested?.iso === "2027-07-15T19:00:00.000Z", JSON.stringify(summer.body?.requested?.iso));
const winterDenver = await checkTime("2027-01-15", "2:00 PM", "Mountain");
const summerDenver = await checkTime("2027-07-15", "2:00 PM", "Mountain");
ok("Mountain DST conversion differs by one hour", winterDenver.body?.requested?.iso === "2027-01-15T21:00:00.000Z" && summerDenver.body?.requested?.iso === "2027-07-15T20:00:00.000Z", `${winterDenver.body?.requested?.iso} / ${summerDenver.body?.requested?.iso}`);

// ---------- 11/12: ambiguity & missing input ----------
const ambiguous = await checkTime("2026-11-12", "2", "Central");
ok("bare hour is rejected, not guessed", ambiguous.status === 400 && ambiguous.body?.code === "ambiguous_time", JSON.stringify(ambiguous.body));
const ambiguousColon = await checkTime("2026-11-12", "2:30", "Central");
ok("2:30 without AM/PM is rejected", ambiguousColon.status === 400 && ambiguousColon.body?.code === "ambiguous_time", JSON.stringify(ambiguousColon.body));
const missingDate = await checkTime("", "2:00 PM", "Central");
ok("missing date is requested explicitly", missingDate.status === 400 && missingDate.body?.code === "needs_date", JSON.stringify(missingDate.body));
const missingTime = await checkTime("2026-11-12", "", "Central");
ok("missing time is requested explicitly", missingTime.status === 400 && missingTime.body?.code === "needs_time", JSON.stringify(missingTime.body));

// ---------- 7/14: real availability, booking, confirmation record ----------
const available = await checkTime("2026-11-19", "10:00 AM", "Pacific");
ok("available time is confirmed from the calendar", available.status === 200 && available.body?.available === true, JSON.stringify(available.body).slice(0, 200));
const premature = await bookTime({ date: "2026-11-19", time: "10:00 AM", timezone: "Pacific", name: "Confirm Gate", confirmed: false });
ok("booking without explicit confirmation is refused", premature.status === 400, JSON.stringify(premature.body));
ok("premature attempt created no appointment", appointmentCount() === 0);
const confirmedBooking = await bookTime({ date: "2026-11-19", time: "10:00 AM", timezone: "Pacific", name: "Confirmed Visitor" });
ok("explicitly confirmed booking succeeds", confirmedBooking.status === 200 && confirmedBooking.body?.ok === true, JSON.stringify(confirmedBooking.body).slice(0, 200));
ok("booking preserves local wall time, IANA zone and duration",
  confirmedBooking.body?.appointment?.localDate === "2026-11-19" &&
  confirmedBooking.body?.appointment?.localTime === "10:00" &&
  confirmedBooking.body?.appointment?.timezone === "America/Los_Angeles" &&
  confirmedBooking.body?.appointment?.durationMinutes === 15,
  JSON.stringify(confirmedBooking.body?.appointment));
const token = confirmedBooking.body?.appointment?.manageToken;

// ---------- 6: visitor changes timezone; appointment follows it ----------
if (token) {
  const moved = await manageAppointment(token, "reschedule", { date: "2026-11-20", time: "11:00 AM", timezone: "Central" });
  ok("reschedule into a different timezone works", moved.status === 200 && moved.body?.timezone === "America/Chicago", JSON.stringify(moved.body));
  const cancelled = await manageAppointment(token, "cancel", {});
  ok("reschedule/cancel token remains secure and works", cancelled.status === 200 && cancelled.body?.status === "cancelled", JSON.stringify(cancelled.body));
}

// ---------- 8: conflict only for the requested time ----------
const conflictBooking = await bookTime({ date: "2026-11-10", time: "2:00 PM", timezone: "Central", name: "Conflict Anchor" });
ok("anchor appointment booked", conflictBooking.status === 200, JSON.stringify(conflictBooking.body).slice(0, 160));
const conflict = await checkTime("2026-11-10", "2:00 PM", "Central");
ok("requested conflicting time is unavailable", conflict.status === 200 && conflict.body?.available === false && conflict.body?.reason === "conflict", JSON.stringify(conflict.body).slice(0, 200));
ok("conflict wording mentions only the requested time", /already booked/i.test(conflict.body?.message ?? "") && !/another appointment|other appointment|calendar contains/i.test(conflict.body?.message ?? ""), conflict.body?.message);
const nearbyFree = await checkTime("2026-11-10", "2:30 PM", "Central");
ok("a later non-overlapping time is still available", nearbyFree.status === 200 && nearbyFree.body?.available === true, JSON.stringify(nearbyFree.body).slice(0, 180));

// ---------- 9: partial overlap uses full interval ----------
const overlapBooking = await bookTime({ date: "2026-11-17", time: "3:00 PM", timezone: "Central", name: "Overlap Anchor", durationMinutes: 30 });
ok("30-minute anchor booked", overlapBooking.status === 200, JSON.stringify(overlapBooking.body).slice(0, 160));
const partial = await checkTime("2026-11-17", "3:15 PM", "Central", 30);
ok("partially overlapping request is rejected", partial.status === 200 && partial.body?.available === false && partial.body?.reason === "conflict", JSON.stringify(partial.body).slice(0, 200));
const beforeOverlap = await checkTime("2026-11-17", "2:45 PM", "Central", 15);
ok("time ending exactly at the anchor start is available", beforeOverlap.status === 200 && beforeOverlap.body?.available === true, JSON.stringify(beforeOverlap.body).slice(0, 180));

// ---------- 10: back-to-back is allowed ----------
const backToBackAnchor = await bookTime({ date: "2026-11-18", time: "2:00 PM", timezone: "Central", name: "Back Anchor", durationMinutes: 30 });
ok("back-to-back anchor booked", backToBackAnchor.status === 200, JSON.stringify(backToBackAnchor.body).slice(0, 160));
const backToBack = await checkTime("2026-11-18", "2:30 PM", "Central", 15);
ok("back-to-back start is available (not a conflict)", backToBack.status === 200 && backToBack.body?.available === true, JSON.stringify(backToBack.body).slice(0, 200));

// ---------- 13: calendar failure is reported honestly ----------
async function startFailingCalendarServer() {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3101"], {
    cwd: ROOT,
    env: { ...process.env, PORT: "3101", AI_TEST_MODE: "1", AI_TEST_FAIL_CALENDAR: "1", AI_TEST_SUPPRESS_EMAILS: "1" },
    stdio: "ignore",
    detached: false,
  });
  for (let i = 0; i < 60; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const ping = await fetch("http://127.0.0.1:3101/api/ai/config");
      if (ping.ok) return child;
    } catch { /* starting */ }
  }
  child.kill("SIGTERM");
  return null;
}
if (fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
  const failing = await startFailingCalendarServer();
  ok("failure-mode server starts", failing !== null);
  if (failing) {
    try {
      const check = await fetch("http://127.0.0.1:3101/api/ai/appointments/check", {
        method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3101" },
        body: JSON.stringify({ date: "2026-11-12", time: "11:00 AM", timezone: "Central" }),
      });
      const checkBody = await check.json();
      ok("calendar failure is reported, not fabricated", check.status === 503 && checkBody?.code === "calendar_unavailable", JSON.stringify(checkBody));
      const booking = await fetch("http://127.0.0.1:3101/api/ai/appointments", {
        method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3101" },
        body: JSON.stringify({ date: "2026-11-12", time: "11:00 AM", timezone: "Central", name: "Failure Test", email: "admin@knightmedicalbilling.com", confirmed: true }),
      });
      const bookingBody = await booking.json();
      ok("booking during calendar failure is refused", booking.status === 503 && bookingBody?.ok === false, JSON.stringify(bookingBody));
      // Assistant should also avoid inventing availability when its calendar tool fails.
      const failureContext = await browser.newContext();
      const failureChat = await failureContext.request.post("http://127.0.0.1:3101/api/ai/chat", {
        data: { message: "Can you check whether November 12 at 11 AM Central is available?" },
        headers: { Origin: "http://127.0.0.1:3101" }, timeout: 180_000,
      });
      const raw = await failureChat.text();
      let answer = "";
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try { const event = JSON.parse(line.slice(5).trim()); if (event.type === "token") answer += event.text; } catch { /* ignore */ }
      }
      ok("assistant admits calendar trouble", /(trouble|cannot|can't|unable|right now|try again|not able)/i.test(answer) && !/(you'?re booked|has been booked|confirmed for)/i.test(answer), answer.slice(0, 220));
      await failureContext.close();
    } finally {
      failing.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
} else {
  ok("production build exists for failure-mode test", false, "run npm run build first");
}

// ---------- 16: general billing question: concise, helpful, not a pitch ----------
const general = await freshChat();
const generalAnswer = await general.chat("What does accounts receivable management actually involve?");
ok("general question is answered concisely", generalAnswer.status === 200 && generalAnswer.text.length > 60 && generalAnswer.text.length < 900, `${generalAnswer.text.length} chars`);
ok("general answer gives real value", /(receivable|A\/R|claims|denials|follow-up|collections)/i.test(generalAnswer.text), generalAnswer.text.slice(0, 200));
ok("general answer does not push a meeting", !/\b(book|schedule)\b/i.test(generalAnswer.text), generalAnswer.text.slice(0, 200));
ok("general answer asks at most one question", (generalAnswer.text.match(/\?/g) ?? []).length <= 1, generalAnswer.text);
await general.close();

// ---------- 17: billing concern is understood before selling ----------
const concern = await freshChat();
const concernAnswer = await concern.chat("Our billing is okay, but our A/R is getting older.");
ok("A/R concern is acknowledged specifically", /(A\/R|receivable|older|aging)/i.test(concernAnswer.text), concernAnswer.text.slice(0, 220));
ok("concern response asks one useful follow-up", (concernAnswer.text.match(/\?/g) ?? []).length === 1, concernAnswer.text);
ok("concern response does not jump to booking", !/\b(book|schedule a|consultation)\b/i.test(concernAnswer.text), concernAnswer.text.slice(0, 220));
ok("concern response avoids generic filler", !/great question|completely understand|happy to assist/i.test(concernAnswer.text), concernAnswer.text.slice(0, 220));
await concern.close();

// ---------- 18: information across multiple messages is remembered ----------
const memory = await freshChat();
await memory.chat("We're a four-provider cardiology practice in Dallas.");
const remembered = await memory.chat("Given all that, what should we focus on first?");
ok("later answer uses earlier practice details", /(cardiology|Dallas|four providers|4 providers|practice)/i.test(remembered.text), remembered.text.slice(0, 240));
ok("agent does not re-ask already provided details", !/(what is your specialty|which specialty|what kind of practice|how many providers)/i.test(remembered.text), remembered.text.slice(0, 240));
await memory.close();

// ---------- 19: scheduling asks timezone, handles ambiguity and changes ----------
const scheduling = await freshChat();
const intro = await scheduling.chat("I'd like to talk to someone next Tuesday.");
ok("scheduling asks for the visitor timezone", /(time zone|timezone|Central|Eastern|Mountain|Pacific)/i.test(intro.text), intro.text.slice(0, 240));
ok("scheduling does not assume Eastern", !/we use Eastern|Eastern Time|America\/New_York/i.test(intro.text) || /(what time zone)/i.test(intro.text), intro.text.slice(0, 240));
const central = await scheduling.chat("Central.");
ok("Central is understood, not Eastern", /Central/i.test(central.text), central.text.slice(0, 240));
const ambiguousTurn = await scheduling.chat("How about 2?");
ok("bare time triggers AM/PM clarification", /(AM|PM|a\.m\.|p\.m\.)/i.test(ambiguousTurn.text), ambiguousTurn.text.slice(0, 240));
const timezoneChange = await scheduling.chat("Actually, I'm in Pacific now. What time zone are you using for me?");
ok("timezone change is respected", /Pacific/i.test(timezoneChange.text) && !/Eastern/i.test(timezoneChange.text), timezoneChange.text.slice(0, 240));
await scheduling.close();

// ---------- 20: conflict is described only for the requested time ----------
const conflictChat = await freshChat();
const conflictAsk = await conflictChat.chat("I'm in Central. Can I do November 10 at 2 PM for a call?");
ok("conflicting conversation checks the real calendar", /(already booked|taken|not available|unavailable)/i.test(conflictAsk.text), conflictAsk.text.slice(0, 260));
ok("conflicting conversation does not mention unrelated appointments", !/other appointment|another appointment|calendar contains/i.test(conflictAsk.text), conflictAsk.text.slice(0, 260));
const alternativeAsk = await conflictChat.chat("What about 2:30 PM Central?");
ok("agent offers a real alternative after a conflict", /(available|open|book|check)/i.test(alternativeAsk.text), alternativeAsk.text.slice(0, 260));
await conflictChat.close();

// ---------- 15: mentioning a time is not explicit booking ----------
const mention = await freshChat();
const beforeMention = appointmentCount();
const mentionAnswer = await mention.chat("I'm in Central. I'd like November 11 at 2 PM. My name is Mention Test and my email is admin@knightmedicalbilling.com.");
const afterMention = appointmentCount();
ok("a time preference alone does not create a booking", afterMention === beforeMention, `before=${beforeMention} after=${afterMention}`);
ok("agent asks for explicit confirmation instead", /(confirm|shall I|would you like me to book|does that work)/i.test(mentionAnswer.text), mentionAnswer.text.slice(0, 260));
await mention.close();

// ---------- 21: explicit confirmation books the exact checked time ----------
const bookingChat = await freshChat();
const firstTurn = await bookingChat.chat("I'm in Central. My name is Booking Bot and my email is admin@knightmedicalbilling.com. I'd like November 11 at 10 AM for a call.");
const afterFirst = appointmentCount();
ok("booking flow checks availability before confirmation", /(available|open|check)/i.test(firstTurn.text), firstTurn.text.slice(0, 260));
ok("booking flow does not book on the first mention", afterFirst === beforeMention, `count=${afterFirst}`);
const secondTurn = await bookingChat.chat("Yes, please book that exact time.");
const bookedRow = appointmentByName("Booking Bot");
ok("explicit confirmation books the appointment", bookedRow !== null && /(booked|confirmed)/i.test(secondTurn.text), secondTurn.text.slice(0, 260));
if (bookedRow) {
  ok("agent booking stores 10 AM local Central on the right UTC instant", bookedRow.local_date === "2026-11-11" && bookedRow.local_time === "10:00" && bookedRow.timezone === "America/Chicago" && Number(bookedRow.starts_at_utc) === 1794412800000, JSON.stringify({ local_date: bookedRow.local_date, local_time: bookedRow.local_time, timezone: bookedRow.timezone, starts_at_utc: bookedRow.starts_at_utc }));
  const stateConn = db();
  const bookingContext = stateConn.prepare("SELECT stage FROM ai_conversation_contexts ORDER BY updated_at DESC LIMIT 1").get();
  stateConn.close();
  ok("booking advances the conversation state machine to BOOKED", bookingContext?.stage === "BOOKED", String(bookingContext?.stage));
}
await bookingChat.close();

// ---------- cleanup ----------
cleanAiFixtures();
await api.close();
await browser.close();
console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
