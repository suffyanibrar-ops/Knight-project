import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-assistant-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "assistant-password";
delete process.env.DEEPSEEK_API_KEY;
process.env.ADMIN_SESSION_SECRET = "a".repeat(64);
const auth = async () => ({ ok: true as const, actor: "admin" });
const other = async () => ({ ok: true as const, actor: "intruder" });
const anon = async () => ({ ok: false as const, reason: "unauthenticated" });

let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };
const HOUR = 3600_000;

try {
  const a = await import("../src/lib/admin-assistant");
  const appts = await import("../src/lib/ai-appointments");
  const store = await import("../src/lib/sqlite");
  const handle = store.sqliteHandle();
  assert.ok(handle);

  // ---- intent mapping ----
  ok("cancel intent parsed", JSON.stringify(a.parseIntent("cancel appointment 12")) === JSON.stringify({ kind: "cancel_appointment", id: 12 }));
  ok("cancel intent tolerant of wording", a.parseIntent("please cancel the appointment #7").kind === "cancel_appointment");
  ok("enquiry status intent parsed", (() => { const i = a.parseIntent("set enquiry 5 to contacted"); return i.kind === "set_enquiry_status" && i.id === 5 && i.status === "contacted"; })());
  ok("invalid status is rejected as unknown", (() => { const i = a.parseIntent("set enquiry 5 to banana"); return i.kind === "unknown"; })());
  ok("list intent parsed", a.parseIntent("show me pending appointments").kind === "list_pending_appointments");
  ok("help intent parsed", a.parseIntent("help").kind === "help");
  ok("ambiguous request is unknown", a.parseIntent("do something useful").kind === "unknown");
  ok("empty message is unknown", a.parseIntent("   ").kind === "unknown");

  // ---- fixtures ----
  const start = Date.now() + 48 * HOUR;
  const booked = await appts.bookAppointment({ name: "Chat Tester", email: "c@example.com", startsAtUtc: start, endsAtUtc: start + 900_000, timezone: "America/New_York" } as never);
  const appointmentId = Number(booked.id);
  const submission = store.insertSubmission({ name: "Chat Enquiry", email: "ce@example.com", message: "hi", source: "website" } as never);
  const enquiryId = Number(submission.id);

  // ---- help + list (no mutation) ----
  const help = await a.propose("help", { resolver: auth });
  ok("help returns guidance", help.reply.length > 20 && !help.proposal);
  const list = await a.propose("show pending appointments", { resolver: auth });
  ok("list returns appointments", /active appointment/.test(list.reply) && !list.proposal);
  ok("list did not mutate anything", appts.listAppointments(50, "active").some((x) => x.id === appointmentId));

  // ---- proposal (preview, no mutation) ----
  const turn = await a.propose(`cancel appointment ${appointmentId}`, { resolver: auth });
  ok("proposal created", Boolean(turn.proposal) && turn.proposal!.type === "appointment.cancel");
  ok("proposal shows before-state", (turn.proposal!.before as { status: string }).status === "confirmed");
  ok("proposal has an expiry", turn.proposal!.expiresAt > Date.now());
  ok("proposal did not change the record", appts.listAppointments(50, "active").some((x) => x.id === appointmentId));

  // ---- wrong actor / token ----
  ok("wrong actor refused", (await a.confirm({ nonce: turn.proposal!.nonce, token: turn.proposal!.token }, { resolver: other })).status === "forbidden");
  ok("wrong token refused", (await a.confirm({ nonce: turn.proposal!.nonce, token: "0".repeat(64) }, { resolver: auth })).status === "forbidden");
  ok("still not mutated after refusals", appts.listAppointments(50, "active").some((x) => x.id === appointmentId));

  const cancelledProposal = await a.propose(`cancel appointment ${appointmentId}`, { resolver: auth });
  ok("cancel of a proposal discards it", (await a.cancel(cancelledProposal.proposal!.nonce, { resolver: auth })).ok === true);
  ok("discarded proposal cannot execute", (await a.confirm({ nonce: cancelledProposal.proposal!.nonce, token: cancelledProposal.proposal!.token }, { resolver: auth })).status === "already_used");
  ok("discard changed nothing", appts.listAppointments(50, "active").some((x) => x.id === appointmentId));

  // ---- expiry ----
  const expiring = await a.propose(`cancel appointment ${appointmentId}`, { resolver: auth });
  const expired = await a.confirm({ nonce: expiring.proposal!.nonce, token: expiring.proposal!.token }, { resolver: auth, now: expiring.proposal!.expiresAt + 1 });
  ok("expired proposal refused", expired.status === "expired");
  ok("expired proposal left no record", (await a.confirm({ nonce: expiring.proposal!.nonce, token: expiring.proposal!.token }, { resolver: auth })).status === "already_used");

  // ---- happy path + replay ----
  const good = await a.propose(`cancel appointment ${appointmentId}`, { resolver: auth });
  const done = await a.confirm({ nonce: good.proposal!.nonce, token: good.proposal!.token }, { resolver: auth });
  ok("confirmation executes", done.ok === true && done.status === "completed", JSON.stringify(done));
  ok("execution verified from database", (done.verified as { status: string }).status === "cancelled");
  ok("cancelled appointment left the active list", !appts.listAppointments(50, "active").some((x) => x.id === appointmentId));
  const replay = await a.confirm({ nonce: good.proposal!.nonce, token: good.proposal!.token }, { resolver: auth });
  ok("replay refused one-time token", replay.status === "already_used");

  // ---- concurrent confirmation (double click) ----
  const race = await a.propose(`set enquiry ${enquiryId} to contacted`, { resolver: auth });
  const [r1, r2] = await Promise.all([
    a.confirm({ nonce: race.proposal!.nonce, token: race.proposal!.token }, { resolver: auth }),
    a.confirm({ nonce: race.proposal!.nonce, token: race.proposal!.token }, { resolver: auth }),
  ]);
  ok("exactly one concurrent confirmation wins", [r1.status, r2.status].filter((s) => s === "completed").length === 1, `${r1.status}/${r2.status}`);
  ok("enquiry status persisted", store.listSubmissions({}).find((r) => r.id === enquiryId)?.status === "contacted");
  ok("status history has one entry", store.listEnquiryStatusEvents(enquiryId).length === 1);

  // ---- verification failure path ----
  ok("missing record gives a clear error", (await a.propose("cancel appointment 999999", "admin")).error !== undefined);

  // ---- audit ----
  const audit = handle.prepare("SELECT action FROM admin_audit").all() as { action: string }[];
  ok("both executions audited", audit.filter((r) => r.action.startsWith("ai.action.")).length === 2, String(audit.length));

  // ---- provider-down mode ----
  ok("deterministic mode without a provider", a.assistantMode() === "deterministic");
  ok("deterministic mode still proposes actions", (await a.propose("help", { resolver: auth })).reply.length > 0);
  process.env.DEEPSEEK_API_KEY = "test-key";
  ok("ai mode detected when configured", a.assistantMode() === "ai");
  delete process.env.DEEPSEEK_API_KEY;

  // ---- expired proposal purge ----
  ok("purge removes nothing live", (await import("../src/lib/admin-grants")).purgeExpiredGrants() === 0);

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { rmSync(db + suffix, { force: true }); } catch {}
  }
}
