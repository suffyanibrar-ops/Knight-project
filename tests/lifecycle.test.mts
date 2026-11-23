import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-lifecycle-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "lifecycle-test-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const HOUR = 60 * 60 * 1000;

try {
  const store = await import("../src/lib/sqlite");
  const appointments = await import("../src/lib/ai-appointments");

  // ---------- enquiries ----------
  const inserted = store.insertSubmission({
    name: "Lifecycle Tester",
    email: "lifecycle@example.com",
    phone: null,
    practice: "Test Practice",
    specialty: "Cardiology",
    practiceSize: null,
    providers: null,
    interests: null,
    message: "Enquiry lifecycle fixture",
    source: "website",
  } as never);
  ok("enquiry created", inserted.ok && typeof inserted.id === "number");

  const id = inserted.id as number;
  ok("new enquiry defaults to pending", store.normaliseEnquiryStatus(store.listSubmissions({}).find((r) => r.id === id)?.status) === "pending");

  ok("status change persists", store.updateSubmissionStatus(id, "contacted", "admin", "Called back"));
  const contacted = store.listSubmissions({}).find((r) => r.id === id);
  ok("status survives reload", store.normaliseEnquiryStatus(contacted?.status) === "contacted");

  ok("resolved transition persists", store.updateSubmissionStatus(id, "resolved", "admin"));
  ok("cancelled transition persists", store.updateSubmissionStatus(id, "cancelled", "admin"));
  ok("invalid status rejected", store.updateSubmissionStatus(id, "nonsense" as never, "admin") === false);

  const history = store.listEnquiryStatusEvents(id);
  ok("history recorded in order", history.length === 3 && history[0].toStatus === "cancelled" && history[2].toStatus === "contacted", JSON.stringify(history.map((h) => h.toStatus)));
  ok("history keeps the origin", history[2].fromStatus === "pending");

  ok("filter by resolved is empty after cancel", store.listSubmissions({ status: "resolved" }).every((r) => r.id !== id));
  ok("filter by cancelled returns it", store.listSubmissions({ status: "cancelled" }).some((r) => r.id === id));
  const counts = store.submissionStatusCounts();
  ok("status counts include the record", counts.cancelled >= 1, JSON.stringify(counts));

  // ---------- appointments ----------
  const start = Date.now() + 48 * HOUR;
  const created = await appointments.bookAppointment({
    conversationId: null,
    leadId: null,
    name: "Appointment Tester",
    email: "appointment@example.com",
    phone: null,
    organization: "Test Clinic",
    specialty: "Family Practice",
    startsAtUtc: start,
    endsAtUtc: start + 15 * 60 * 1000,
    timezone: "America/New_York",
    notes: "lifecycle fixture",
  } as never);
  const appointmentId = Number((created as { id: number }).id);
  ok("appointment created as confirmed", appointments.listAppointments(50, "active").some((a) => a.id === appointmentId));
  ok("dashboard count includes it", appointments.countUpcomingAppointments() >= 1);

  appointments.setAppointmentStatus(appointmentId, "pending", "admin");
  ok("confirmed -> pending persists", appointments.listAppointments(50, "active").find((a) => a.id === appointmentId)?.status === "pending");

  appointments.setAppointmentStatus(appointmentId, "cancelled", "admin");
  ok("cancel removes it from the active list", appointments.listAppointments(50, "active").every((a) => a.id !== appointmentId));
  ok("cancel keeps it in cancelled scope", appointments.listAppointments(50, "cancelled").some((a) => a.id === appointmentId));
  ok("cancel keeps it in history", appointments.listAppointments(50, "history").some((a) => a.id === appointmentId));
  ok("dashboard count excludes cancelled", appointments.countUpcomingAppointments() === 0);

  appointments.setAppointmentStatus(appointmentId, "confirmed", "admin");
  ok("re-confirm frees the cancelled row", appointments.listAppointments(50, "active").some((a) => a.id === appointmentId));

  ok("soft delete succeeds", appointments.deleteAppointment(appointmentId));
  ok("deleted row leaves every scope",
    appointments.listAppointments(50, "all").every((a) => a.id !== appointmentId) &&
    appointments.listAppointments(50, "active").every((a) => a.id !== appointmentId) &&
    appointments.listAppointments(50, "cancelled").every((a) => a.id !== appointmentId) &&
    appointments.listAppointments(50, "history").every((a) => a.id !== appointmentId));
  ok("deleted appointment is not counted", appointments.countUpcomingAppointments() === 0);
  ok("second delete is a no-op", appointments.deleteAppointment(appointmentId) === false);

  assert.ok(passed > 0);
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
