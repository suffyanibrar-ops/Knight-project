import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-actions-sec-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "sec-password";
process.env.ADMIN_SESSION_SECRET = "a".repeat(64);

let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };
const HOUR = 3600_000;
const auth = async () => ({ ok: true as const, actor: "admin" });
const other = async () => ({ ok: true as const, actor: "intruder" });
const anon = async () => ({ ok: false as const, reason: "unauthenticated" });

try {
  const a = await import("../src/lib/admin-actions");
  const appts = await import("../src/lib/ai-appointments");
  const store = await import("../src/lib/sqlite");
  const dbh = store.sqliteHandle();
  assert.ok(dbh);

  const start = Date.now() + 48 * HOUR;
  const booked = await appts.bookAppointment({ name: "Sec Tester", email: "s@example.com", startsAtUtc: start, endsAtUtc: start + 900_000, timezone: "America/New_York" } as never);
  const id = Number(booked.id);
  const enquiryId = Number(store.insertSubmission({ name: "Sec Enq", email: "se@example.com", message: "x", source: "website" } as never).id);

  // ---- V1: authentication inside the boundary ----
  ok("preview requires a session", (await a.previewAction("appointment.cancel", { id }, { resolver: anon })).reason === "unauthorized");
  ok("grant issue requires a session", (await a.issueActionGrant({ type: "appointment.cancel", params: { id } }, { resolver: anon })).status === "unauthorized");
  const anonExec = await a.executeAction({ nonce: "z".repeat(32), token: "t" }, { resolver: anon });
  ok("execute requires a session", anonExec.status === "unauthorized");
  ok("anonymous attempts changed nothing", appts.listAppointments(50, "active").some((x) => x.id === id));

  // ---- preview accuracy ----
  const preview = await a.previewAction("appointment.cancel", { id }, { resolver: auth });
  ok("preview succeeds with a session", preview.ok === true && preview.level === "C");
  ok("preview exposes before-state and reversibility", (preview.before as { status: string }).status === "confirmed" && preview.reversible === false);
  ok("preview does not mutate", appts.listAppointments(50, "active").some((x) => x.id === id));

  // ---- V3: HMAC + nonce ----
  const grant = await a.issueActionGrant({ type: "appointment.cancel", params: { id } }, { resolver: auth });
  ok("grant issued", grant.ok === true && "nonce" in grant);
  if (!grant.ok) throw new Error("grant failed");
  ok("token is a full HMAC digest", grant.token.length === 64);
  ok("nonce is random and long", grant.nonce.length === 32);

  ok("unknown nonce rejected", (await a.executeAction({ nonce: "f".repeat(32), token: grant.token }, { resolver: auth })).status === "already_used");
  ok("forged token rejected", (await a.executeAction({ nonce: grant.nonce, token: "f".repeat(64) }, { resolver: auth })).status === "forbidden");
  ok("type mismatch rejected", (await a.executeAction({ nonce: grant.nonce, token: grant.token, type: "enquiry.set_status" }, { resolver: auth })).status === "forbidden");
  ok("transferred grant rejected", (await a.executeAction({ nonce: grant.nonce, token: grant.token }, { resolver: other })).status === "forbidden");
  ok("still not executed after rejections", appts.listAppointments(50, "active").some((x) => x.id === id));

  // ---- expiry ----
  const exp = await a.issueActionGrant({ type: "appointment.cancel", params: { id } }, { resolver: auth });
  if (!exp.ok) throw new Error("grant failed");
  ok("expired grant rejected", (await a.executeAction({ nonce: exp.nonce, token: exp.token }, { resolver: auth, now: exp.expiresAt + 1 })).status === "expired");
  ok("expired grant cannot be replayed", (await a.executeAction({ nonce: exp.nonce, token: exp.token }, { resolver: auth })).status === "already_used");

  // ---- happy path, verification, replay, concurrency ----
  const good = await a.issueActionGrant({ type: "appointment.cancel", params: { id } }, { resolver: auth });
  if (!good.ok) throw new Error("grant failed");
  const done = await a.executeAction({ nonce: good.nonce, token: good.token }, { resolver: auth });
  ok("confirmed execution completes", done.ok === true && done.status === "completed", JSON.stringify(done));
  ok("result verified from database", (done.verified as { status: string }).status === "cancelled");
  ok("record left the active list", !appts.listAppointments(50, "active").some((x) => x.id === id));
  ok("replay rejected", (await a.executeAction({ nonce: good.nonce, token: good.token }, { resolver: auth })).status === "already_used");

  const race = await a.issueActionGrant({ type: "enquiry.set_status", params: { id: enquiryId, status: "contacted" } }, { resolver: auth });
  if (!race.ok) throw new Error("grant failed");
  const [r1, r2] = await Promise.all([
    a.executeAction({ nonce: race.nonce, token: race.token }, { resolver: auth }),
    a.executeAction({ nonce: race.nonce, token: race.token }, { resolver: auth }),
  ]);
  ok("concurrent execution runs once", [r1.status, r2.status].filter((s) => s === "completed").length === 1, `${r1.status}/${r2.status}`);
  ok("audit recorded once for it", (dbh.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action = 'ai.action.enquiry.set_status'").get() as { n: number }).n === 1);

  // ---- interrupted execution: record vanished after grant issue ----
  const doomed = Number(store.insertSubmission({ name: "Doomed", email: "d@example.com", message: "x", source: "website" } as never).id);
  const gh = await a.issueActionGrant({ type: "enquiry.set_status", params: { id: doomed, status: "resolved" } }, { resolver: auth });
  if (!gh.ok) throw new Error("grant failed");
  dbh.prepare("DELETE FROM submissions WHERE id = ?").run(doomed);
  const interrupted = await a.executeAction({ nonce: gh.nonce, token: gh.token }, { resolver: auth });
  ok("missing record reported as interrupted", interrupted.status === "interrupted", JSON.stringify(interrupted));
  ok("interrupted run wrote no audit", (dbh.prepare("SELECT COUNT(*) n FROM admin_audit WHERE detail LIKE ?").get(`%#${doomed}%`) as { n: number }).n === 0);
  ok("interrupted grant cannot be retried", (await a.executeAction({ nonce: gh.nonce, token: gh.token }, { resolver: auth })).status === "already_used");

  // ---- atomicity: audit insert failure rolls the mutation back ----
  const victim = Number(store.insertSubmission({ name: "Atomic", email: "at@example.com", message: "x", source: "website" } as never).id);
  const ag = await a.issueActionGrant({ type: "enquiry.set_status", params: { id: victim, status: "resolved" } }, { resolver: auth });
  if (!ag.ok) throw new Error("grant failed");
  dbh.exec("ALTER TABLE admin_audit RENAME TO admin_audit_offline");
  const rolled = await a.executeAction({ nonce: ag.nonce, token: ag.token }, { resolver: auth });
  dbh.exec("ALTER TABLE admin_audit_offline RENAME TO admin_audit");
  ok("audit failure aborts the action", rolled.status === "interrupted", rolled.status);
  ok("mutation was rolled back with it", (dbh.prepare("SELECT status FROM submissions WHERE id = ?").get(victim) as { status: string }).status !== "resolved");

  // ---- missing secret fails closed ----
  const secret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  ok("missing HMAC secret fails closed", (await a.issueActionGrant({ type: "appointment.cancel", params: { id } }, { resolver: auth })).status === "config_unavailable");
  process.env.ADMIN_SESSION_SECRET = secret;

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-wal", "-shm"]) { try { rmSync(db + suffix, { force: true }); } catch {} }
}
