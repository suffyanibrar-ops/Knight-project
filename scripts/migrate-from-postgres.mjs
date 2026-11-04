/**
 * One-time import of existing PostgreSQL data into the embedded SQLite file.
 *
 * Dependency-free by design (no `pg`, no `psql` from Node): export each
 * PostgreSQL table to CSV first, then run this script. It is idempotent —
 * rows are inserted with INSERT OR IGNORE / upsert semantics, so running it
 * twice does not duplicate data.
 *
 * 1) Export from Postgres (psql is on your PATH; DATABASE_URL is your old URL):
 *
 *    mkdir -p pg-dump
 *    for t in leads contact_messages subscribers roi_estimates email_outbox \
 *             admin_audit testimonials specialties case_studies articles faqs; do
 *      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
 *        -c "\copy $t TO 'pg-dump/$t.csv' CSV HEADER"
 *    done
 *
 * 2) Make sure the SQLite file exists (start the app once, or run `npm run seed`),
 *    then import:
 *
 *    node --experimental-strip-types scripts/migrate-from-postgres.mjs pg-dump
 *
 * Existing SQLite rows are preserved: conflicts on unique keys are ignored and
 * the import never deletes anything.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { SCHEMA } from "../src/lib/sqlite-schema.ts";

const dumpDir = process.argv[2] ?? "pg-dump";
const configured = process.env.SQLITE_PATH?.trim() || "data/app.db";
const file = isAbsolute(configured) ? configured : `${process.cwd()}/${configured}`;

// The schema is applied below, so the target file (and its directory) may not
// exist yet: this script can initialise a brand-new SQLite database itself.
mkdirSync(dirname(file), { recursive: true });

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows.shift().map((name) => name.trim());
  return rows
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

const toMs = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Postgres text timestamp -> SQLite "YYYY-MM-DD HH:MM:SS" (UTC). */
const toSqliteText = (value) => {
  if (!value) return null;
  const ms = toMs(value);
  if (ms === null) return value;
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
};

const json = (value, fallback) => {
  if (!value) return JSON.stringify(fallback);
  try {
    JSON.parse(value);
    return value;
  } catch {
    return JSON.stringify(fallback);
  }
};

const bool = (value) => (value === "t" || value === "true" || value === "1" ? 1 : 0);
const int = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const IMPORTS = [
  {
    table: "leads",
    json: ["interests"],
    columns: (r) => ({
      name: r.name, email: r.email, phone: r.phone || null, practice: r.practice || null,
      specialty: r.specialty || null, practice_size: r.practice_size || null,
      monthly_collections: r.monthly_collections || null,
      interests: json(r.interests, []), message: r.message || null,
      source: r.source || "website", status: r.status || "new",
      email_status: r.email_status || "pending", email_error: r.email_error || null,
      email_sent_at: toMs(r.email_sent_at), created_at: toMs(r.created_at),
    }),
  },
  {
    table: "contact_messages",
    columns: (r) => ({
      name: r.name, email: r.email, phone: r.phone || null, topic: r.topic || null,
      message: r.message, status: r.status || "new", email_status: r.email_status || "pending",
      email_error: r.email_error || null, email_sent_at: toMs(r.email_sent_at), created_at: toMs(r.created_at),
    }),
  },
  {
    table: "subscribers",
    columns: (r) => ({
      email: String(r.email || "").toLowerCase(), email_status: r.email_status || "pending",
      created_at: toSqliteText(r.created_at) || new Date().toISOString().slice(0, 19).replace("T", " "),
    }),
    conflict: "OR IGNORE",
  },
  {
    table: "roi_estimates",
    columns: (r) => ({
      email: r.email ? String(r.email).toLowerCase() : null,
      monthly_collections: int(r.monthly_collections, 0), denial_rate: int(r.denial_rate, 0),
      days_in_ar: int(r.days_in_ar, 0), estimated_annual_uplift: int(r.estimated_annual_uplift, 0),
      email_status: r.email_status || "pending",
      created_at: toSqliteText(r.created_at) || new Date().toISOString().slice(0, 19).replace("T", " "),
    }),
  },
  {
    table: "email_outbox",
    columns: (r) => ({
      kind: r.kind, to_email: r.to_email, reply_to: r.reply_to || null, subject: r.subject,
      text_body: r.text_body, html_body: r.html_body || null, status: r.status || "pending",
      provider: r.provider || null, attempts: int(r.attempts, 0), last_error: r.last_error || null,
      related_type: r.related_type || null, related_id: int(r.related_id, null),
      created_at: toMs(r.created_at), sent_at: toMs(r.sent_at),
    }),
  },
  {
    table: "admin_audit",
    columns: (r) => ({ action: r.action, detail: r.detail || null, ip: r.ip || null, created_at: toMs(r.created_at) }),
  },
  {
    table: "testimonials",
    columns: (r) => ({
      quote: r.quote, name: r.name, role: r.role || null, org: r.org || null,
      specialty: r.specialty || null, image: r.image || null, rating: int(r.rating, 5),
      sort_order: int(r.sort_order, 0), published: bool(r.published),
    }),
    conflict: "OR IGNORE",
  },
  {
    table: "specialties",
    columns: (r) => ({
      slug: r.slug, name: r.name, group_name: r.group_name, icon: r.icon || "Stethoscope",
      blurb: r.blurb, focus: json(r.focus, []), metric_value: r.metric_value || "25%",
      metric_label: r.metric_label || "A/R reduction", sort_order: int(r.sort_order, 0),
    }),
    conflict: "OR IGNORE",
  },
  {
    table: "case_studies",
    columns: (r) => ({
      slug: r.slug, title: r.title, client: r.client, specialty: r.specialty, image: r.image,
      summary: r.summary, metrics: json(r.metrics, []), challenge: r.challenge,
      approach: json(r.approach, []), result: r.result, quote_text: r.quote_text,
      quote_author: r.quote_author, duration: r.duration, published: bool(r.published),
    }),
    conflict: "OR IGNORE",
  },
  {
    table: "articles",
    columns: (r) => ({
      slug: r.slug, title: r.title, category: r.category, excerpt: r.excerpt, image: r.image,
      read_time: r.read_time, published_at: r.published_at, author: r.author,
      body: json(r.body, []), published: bool(r.published),
    }),
    conflict: "OR IGNORE",
  },
  {
    table: "faqs",
    columns: (r) => ({
      question: r.question, answer: r.answer, category: r.category || "general", sort_order: int(r.sort_order, 0),
    }),
    conflict: "OR IGNORE",
  },
];

const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");
// Idempotent CREATE TABLE IF NOT EXISTS for every table, shared with the app.
db.exec(SCHEMA);

let total = 0;
db.transaction(() => {
  for (const spec of IMPORTS) {
    const csvPath = join(dumpDir, `${spec.table}.csv`);
    if (!existsSync(csvPath)) {
      console.log(`[import] skip ${spec.table} (no ${csvPath})`);
      continue;
    }
    const rows = parseCsv(readFileSync(csvPath, "utf8"));
    if (rows.length === 0) {
      console.log(`[import] ${spec.table}: 0 rows`);
      continue;
    }
    let inserted = 0;
    for (const row of rows) {
      const values = spec.columns(row);
      const columns = Object.keys(values);
      const statement = `INSERT ${spec.conflict ?? ""} INTO ${spec.table} (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`;
      try {
        inserted += db.prepare(statement).run(values).changes;
      } catch (error) {
        console.warn(`[import] ${spec.table}: skipped a row (${error.message})`);
      }
    }
    total += inserted;
    console.log(`[import] ${spec.table}: ${inserted}/${rows.length} rows imported`);
  }
})();

console.log(`[import] done — ${total} rows into ${file}`);
db.close();
