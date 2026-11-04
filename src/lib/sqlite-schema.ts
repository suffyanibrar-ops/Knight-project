/**
 * Physical SQLite schema (DDL) for the Knight Medical Billing database.
 *
 * Kept in its own module so the runtime connection, the seed script and the
 * Postgres import script all apply exactly the same definition — no drift
 * between a running app and a script that prepares a database.
 *
 * Every statement is idempotent. `src/lib/sqlite.ts` records the applied
 * version in `PRAGMA user_version` and runs new migrations in order.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  practice TEXT,
  specialty TEXT,
  practice_size TEXT,
  providers TEXT,
  interests TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  email_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  email_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers (created_at DESC);

CREATE TABLE IF NOT EXISTS roi_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  monthly_collections INTEGER NOT NULL,
  denial_rate INTEGER NOT NULL,
  days_in_ar INTEGER NOT NULL,
  estimated_annual_uplift INTEGER NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_roi_estimates_created_at ON roi_estimates (created_at DESC);

/* -------------------------------------------------------------------------
 * Relational tables migrated from PostgreSQL.
 * Integer timestamps are epoch milliseconds; arrays/objects are JSON text.
 * ---------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  practice TEXT,
  specialty TEXT,
  practice_size TEXT,
  monthly_collections TEXT,
  interests TEXT NOT NULL DEFAULT '[]',
  message TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'new',
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_error TEXT,
  email_sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  topic TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_error TEXT,
  email_sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  to_email TEXT NOT NULL,
  reply_to TEXT,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  related_type TEXT,
  related_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at ON email_outbox (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox (status);

CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  org TEXT,
  specialty TEXT,
  image TEXT,
  rating INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_testimonials_sort ON testimonials (published, sort_order);

CREATE TABLE IF NOT EXISTS specialties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Stethoscope',
  blurb TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '[]',
  metric_value TEXT NOT NULL DEFAULT '25%',
  metric_label TEXT NOT NULL DEFAULT 'A/R reduction',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_specialties_sort ON specialties (sort_order);

CREATE TABLE IF NOT EXISTS case_studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  specialty TEXT NOT NULL,
  image TEXT NOT NULL,
  summary TEXT NOT NULL,
  metrics TEXT NOT NULL DEFAULT '[]',
  challenge TEXT NOT NULL,
  approach TEXT NOT NULL DEFAULT '[]',
  result TEXT NOT NULL,
  quote_text TEXT NOT NULL,
  quote_author TEXT NOT NULL,
  duration TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  image TEXT NOT NULL,
  read_time TEXT NOT NULL,
  published_at TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_faqs_sort ON faqs (sort_order);
`;
