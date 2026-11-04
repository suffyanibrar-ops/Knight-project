import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages, emailOutbox, leads } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { listRoiEstimates, listSubscribers } from "@/lib/sqlite";

export const dynamic = "force-dynamic";

/** Neutralises CSV formula injection from user-supplied values. */
function cell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

/**
 * SQLite stores datetimes as UTC text ("YYYY-MM-DD HH:MM:SS"). Normalise to an
 * ISO-8601 string for the CSV, treating a bare value as UTC. An unparsable
 * value is exported verbatim rather than crashing the whole export.
 */
function sqliteTimestamp(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const isoish = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text) ? `${text.replace(" ", "T")}Z` : text;
  const parsed = new Date(isoish);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.map(cell).join(","), ...rows.map((row) => row.map(cell).join(","))].join("\r\n");
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "leads";
  let csv = "";
  let filename = "submissions.csv";

  if (type === "leads") {
    const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));
    csv = toCsv(
      ["Received", "Name", "Email", "Phone", "Facility", "Facility type", "Specialty", "Providers", "Interests", "Message", "Status", "Owner email"],
      rows.map((row) => [row.createdAt.toISOString(), row.name, row.email, row.phone, row.practice, row.practiceSize, row.specialty, row.monthlyCollections, (row.interests ?? []).join("; "), row.message, row.status, row.emailStatus]),
    );
    filename = "knight-consultation-requests.csv";
  } else if (type === "contacts") {
    const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
    csv = toCsv(["Received", "Name", "Email", "Phone", "Topic", "Message", "Status", "Owner email"], rows.map((row) => [row.createdAt.toISOString(), row.name, row.email, row.phone, row.topic, row.message, row.status, row.emailStatus]));
    filename = "knight-contact-messages.csv";
  } else if (type === "subscribers") {
    // SQLite is the single store for newsletter opt-ins.
    const rows = listSubscribers();
    csv = toCsv(["Joined", "Email"], rows.map((row) => [sqliteTimestamp(row.created_at), row.email]));
    filename = "knight-subscribers.csv";
  } else if (type === "estimates") {
    // SQLite is the single store for ROI estimates.
    const rows = listRoiEstimates();
    csv = toCsv(
      ["Created", "Email", "Monthly collections", "Denial rate", "Days in A/R", "Annual opportunity"],
      rows.map((row) => [sqliteTimestamp(row.created_at), row.email, row.monthly_collections, row.denial_rate, row.days_in_ar, row.estimated_annual_uplift]),
    );
    filename = "knight-roi-estimates.csv";
  } else if (type === "outbox") {
    const rows = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt));
    csv = toCsv(["Created", "Type", "Recipient", "Subject", "Status", "Provider", "Sent"], rows.map((row) => [row.createdAt.toISOString(), row.kind, row.toEmail, row.subject, row.status, row.provider, row.sentAt?.toISOString()]));
    filename = "knight-email-outbox.csv";
  } else {
    return NextResponse.json({ ok: false, error: "Unknown export type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
