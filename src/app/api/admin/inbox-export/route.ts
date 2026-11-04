import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listSubmissions } from "@/lib/sqlite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Neutralises CSV formula injection from user-supplied values. */
function cell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rows = listSubmissions({ limit: 500 });
  const headers = ["ID", "Received", "Name", "Email", "Phone", "Facility", "Facility type", "Specialty", "Providers", "Interests", "Message", "Source", "Owner email"];
  const csv = [
    headers.map(cell).join(","),
    ...rows.map((row) =>
      [row.id, row.created_at, row.name, row.email, row.phone, row.practice, row.practice_size, row.specialty, row.providers, row.interests, row.message, row.source, row.email_status]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="knight-inbox-submissions.csv"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
