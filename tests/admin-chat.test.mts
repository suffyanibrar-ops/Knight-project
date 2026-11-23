import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-chat-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "chat-password";
process.env.ADMIN_SESSION_SECRET = "c".repeat(64);

let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };
const auth = async () => ({ ok: true as const, actor: "admin" });

try {
  const chat = await import("../src/lib/admin-chat");
  const assistant = await import("../src/lib/admin-assistant");
  const appts = await import("../src/lib/ai-appointments");
  const store = await import("../src/lib/sqlite");
  assert.ok(store.sqliteHandle());

  ok("empty conversation starts empty", chat.loadChat("admin").length === 0);
  chat.appendTurns("admin", { role: "admin", text: "help" }, { role: "assistant", text: "Here is what I can do." });
  ok("turns append in order", chat.loadChat("admin").map((t) => t.role).join(",") === "admin,assistant");
  ok("turns carry ids and timestamps", chat.loadChat("admin").every((t) => t.id.length > 10 && t.at.includes("T")));

  ok("conversations are per administrator", chat.loadChat("someone-else").length === 0);
  chat.appendTurns("someone-else", { role: "admin", text: "private" });
  ok("other administrator cannot read this one", chat.loadChat("admin").every((t) => t.text !== "private"));

  for (let i = 0; i < 60; i += 1) chat.appendTurns("admin", { role: "admin", text: `m${i}` });
  ok("conversation is capped", chat.loadChat("admin").length === chat.MAX_TURNS, String(chat.loadChat("admin").length));
  ok("cap keeps the newest turns", chat.loadChat("admin").at(-1)?.text === "m59");

  chat.clearChat("admin");
  ok("clear removes only this conversation", chat.loadChat("admin").length === 0 && chat.loadChat("someone-else").length === 1);

  // ---- full workflow through the real modules ----
  const start = Date.now() + 48 * 3600_000;
  const booked = await appts.bookAppointment({ name: "Chat Flow", email: "cf@example.com", startsAtUtc: start, endsAtUtc: start + 900_000, timezone: "America/New_York" } as never);
  const id = Number(booked.id);
  const turn = await assistant.propose(`cancel appointment ${id}`, { resolver: auth });
  ok("workflow produces a proposal", Boolean(turn.proposal) && turn.proposal!.status === undefined);
  chat.appendTurns("admin", { role: "assistant", text: turn.reply, proposal: { ...turn.proposal!, status: "pending" } });
  ok("pending proposal is discoverable", chat.pendingProposal(chat.loadChat("admin"))?.nonce === turn.proposal!.nonce);
  ok("preview left the record untouched", appts.listAppointments(50, "active").some((a) => a.id === id));

  const confirmed = await assistant.confirm({ nonce: turn.proposal!.nonce, token: turn.proposal!.token }, { resolver: auth });
  ok("confirmation completes", confirmed.ok === true && confirmed.status === "completed");
  chat.settleProposal("admin", turn.proposal!.nonce, confirmed.status);
  chat.appendTurns("admin", { role: "assistant", text: confirmed.message });
  ok("outcome recorded in history", chat.loadChat("admin").some((t) => t.proposal?.status === "completed"));
  ok("record actually changed", appts.listAppointments(50, "cancelled").some((a) => a.id === id));
  ok("no pending proposal left", chat.pendingProposal(chat.loadChat("admin")) === null);

  const again = await assistant.confirm({ nonce: turn.proposal!.nonce, token: turn.proposal!.token }, { resolver: auth });
  ok("replay of a stored proposal is refused", again.status === "already_used");

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-wal", "-shm"]) { try { rmSync(db + suffix, { force: true }); } catch {} }
}
