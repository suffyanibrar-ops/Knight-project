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


/* -------------------------------------------------------------------------
 * v4 — Blog CMS.
 * Media rows are created before posts so posts can reference a media record.
 * Binary image files never live in SQLite: blog_media holds only metadata and a
 * storage key, while optimized variants are written to the data directory.
 * ---------------------------------------------------------------------- */

export const BLOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS blog_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT,
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/webp',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  size_bytes INTEGER,
  sha256 TEXT NOT NULL UNIQUE,
  alt TEXT,
  caption TEXT,
  license TEXT,
  attribution TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS blog_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_blog_categories_name ON blog_categories (name);

CREATE TABLE IF NOT EXISTS blog_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_blog_tags_name ON blog_tags (name);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  featured_media_id INTEGER REFERENCES blog_media(id) ON DELETE SET NULL,
  featured_image TEXT,
  featured_image_alt TEXT,
  featured_image_width INTEGER,
  featured_image_height INTEGER,
  author TEXT NOT NULL DEFAULT 'Knight Medical Billing',
  category_id INTEGER REFERENCES blog_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  scheduled_for INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  deleted_at INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  social_image TEXT,
  reading_time INTEGER NOT NULL DEFAULT 0,
  source_notes TEXT,
  view_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_updated ON blog_posts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts (category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_deleted ON blog_posts (deleted_at);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag ON blog_post_tags (tag_id);

CREATE TABLE IF NOT EXISTS blog_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  status TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_blog_revisions_post ON blog_revisions (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS blog_redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  post_id INTEGER REFERENCES blog_posts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
`;


/* -------------------------------------------------------------------------
 * v5 — AI voice/chat agent.
 * Conversations/transcripts, leads, appointments (UTC + unique active slot),
 * availability rules, blocked times, human handoffs, knowledge base + FTS5,
 * usage logs. No audio is stored anywhere; no PHI columns by design.
 * ---------------------------------------------------------------------- */

export const AI_SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_hash TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'active',
  visitor_name TEXT,
  visitor_email TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  lead_id INTEGER,
  appointment_id INTEGER,
  handoff_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_activity_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_activity ON ai_conversations (last_activity_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_name TEXT,
  tool_args TEXT,
  tool_result TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  organization TEXT,
  specialty TEXT,
  providers TEXT,
  current_setup TEXT,
  challenge TEXT,
  services_interest TEXT,
  preferred_contact TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ai_leads_created ON ai_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_leads_status ON ai_leads (status);

CREATE TABLE IF NOT EXISTS ai_appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE SET NULL,
  lead_id INTEGER REFERENCES ai_leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  organization TEXT,
  specialty TEXT,
  starts_at_utc INTEGER NOT NULL,
  ends_at_utc INTEGER NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'confirmed',
  token_hash TEXT UNIQUE,
  email_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  external_event_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ai_appointments_start ON ai_appointments (starts_at_utc);
CREATE INDEX IF NOT EXISTS idx_ai_appointments_status ON ai_appointments (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_appointments_active_slot
  ON ai_appointments (starts_at_utc) WHERE status IN ('pending', 'confirmed');

CREATE TABLE IF NOT EXISTS ai_availability_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL,
  start_minute INTEGER NOT NULL DEFAULT 540,
  end_minute INTEGER NOT NULL DEFAULT 1020,
  slot_minutes INTEGER NOT NULL DEFAULT 15,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS ai_blocked_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  starts_at_utc INTEGER NOT NULL,
  ends_at_utc INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ai_blocked_times_start ON ai_blocked_times (starts_at_utc);

CREATE TABLE IF NOT EXISTS ai_handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  notified_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ai_handoffs_status ON ai_handoffs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  content_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  checksum TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_indexed_at INTEGER,
  UNIQUE (kind, slug)
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_kind ON ai_knowledge_sources (kind, status);

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES ai_knowledge_sources(id) ON DELETE CASCADE,
  heading TEXT,
  content TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_source ON ai_knowledge_chunks (source_id);

CREATE VIRTUAL TABLE IF NOT EXISTS ai_knowledge_fts USING fts5(
  content, heading, source_title, source_url, chunk_id UNINDEXED, tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_logs (created_at DESC);

INSERT OR IGNORE INTO ai_availability_rules (id, weekday, start_minute, end_minute, slot_minutes, buffer_minutes, active)
SELECT 1, 1, 540, 1020, 15, 15, 1 WHERE NOT EXISTS (SELECT 1 FROM ai_availability_rules);
INSERT OR IGNORE INTO ai_availability_rules (id, weekday, start_minute, end_minute, slot_minutes, buffer_minutes, active)
SELECT 2, 2, 540, 1020, 15, 15, 1 WHERE NOT EXISTS (SELECT 1 FROM ai_availability_rules WHERE id = 2);
INSERT OR IGNORE INTO ai_availability_rules (id, weekday, start_minute, end_minute, slot_minutes, buffer_minutes, active)
SELECT 3, 3, 540, 1020, 15, 15, 1 WHERE NOT EXISTS (SELECT 1 FROM ai_availability_rules WHERE id = 3);
INSERT OR IGNORE INTO ai_availability_rules (id, weekday, start_minute, end_minute, slot_minutes, buffer_minutes, active)
SELECT 4, 4, 540, 1020, 15, 15, 1 WHERE NOT EXISTS (SELECT 1 FROM ai_availability_rules WHERE id = 4);
INSERT OR IGNORE INTO ai_availability_rules (id, weekday, start_minute, end_minute, slot_minutes, buffer_minutes, active)
SELECT 5, 5, 540, 1020, 15, 15, 1 WHERE NOT EXISTS (SELECT 1 FROM ai_availability_rules WHERE id = 5);
`;


/* -------------------------------------------------------------------------
 * v6 — scheduling intelligence.
 * Structured per-conversation scheduling state (stage machine + remembered
 * visitor details) and local-time columns so appointments always preserve the
 * visitor's requested date, time and IANA timezone alongside UTC instants.
 * ---------------------------------------------------------------------- */

export const AI_V6_SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_conversation_contexts (
  conversation_id INTEGER PRIMARY KEY REFERENCES ai_conversations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'DISCOVERY',
  user_name TEXT,
  practice TEXT,
  specialty TEXT,
  concern TEXT,
  concern_detail TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  timezone TEXT,
  appointment_type TEXT,
  duration_minutes INTEGER,
  booking_confirmed INTEGER NOT NULL DEFAULT 0,
  last_checked_utc INTEGER,
  last_checked_date TEXT,
  last_checked_time TEXT,
  last_checked_timezone TEXT,
  last_check_available INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

ALTER TABLE ai_appointments ADD COLUMN local_date TEXT;
ALTER TABLE ai_appointments ADD COLUMN local_time TEXT;
ALTER TABLE ai_appointments ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 15;
CREATE INDEX IF NOT EXISTS idx_ai_appointments_local ON ai_appointments (local_date, local_time);
`.replace(/;\s*$/, ';');


/* -------------------------------------------------------------------------
 * v7 — conversation-quality defaults.
 * Only removes stored copies of the old pushy default welcome/instructions so
 * the new advisor-first defaults apply. Admin-customised values are preserved.
 * ---------------------------------------------------------------------- */
export const AI_V7_SCHEMA = `
DELETE FROM settings
WHERE key = 'ai.welcome'
  AND value LIKE 'Hi, I''m Riley from Knight Medical Billing. I can answer questions about our medical billing and revenue cycle services,%';
DELETE FROM settings
WHERE key = 'ai.instructions'
  AND value LIKE 'Prioritise understanding the visitor''s practice, specialty and billing challenge.%';
`;

/**
 * First-party analytics (v8).
 *
 * Website analytics live in the same SQLite application database. No raw IP is
 * stored and no form/PHI content is collected. Visitor/session identifiers are
 * random client-side values that the server hashes with a server-side salt
 * before persistence.
 */
export const ANALYTICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  landing_path TEXT NOT NULL,
  exit_path TEXT,
  referrer TEXT,
  source TEXT NOT NULL DEFAULT 'direct',
  medium TEXT,
  campaign TEXT,
  country TEXT,
  region TEXT,
  timezone TEXT,
  language TEXT,
  device TEXT NOT NULL DEFAULT 'unknown',
  browser TEXT NOT NULL DEFAULT 'unknown',
  os TEXT NOT NULL DEFAULT 'unknown',
  viewport TEXT,
  pageview_count INTEGER NOT NULL DEFAULT 0,
  engagement_seconds INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_seen ON analytics_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor ON analytics_sessions (visitor_id);

CREATE TABLE IF NOT EXISTS analytics_pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  referrer TEXT,
  entered_at INTEGER NOT NULL,
  left_at INTEGER,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  scroll_depth INTEGER NOT NULL DEFAULT 0,
  is_landing INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_entered ON analytics_pageviews (entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_path ON analytics_pageviews (path);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_session ON analytics_pageviews (session_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  visitor_id TEXT,
  name TEXT NOT NULL,
  path TEXT,
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred ON analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events (name);
`;

/* -------------------------------------------------------------------------
 * v9 — AI content workflow + admin password-reset tokens.
 * These are additive tables: no existing content or auth rows are rewritten.
 * ---------------------------------------------------------------------- */

export const CONTENT_AND_SECURITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS content_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  audience TEXT,
  stage TEXT NOT NULL DEFAULT 'research',
  data_json TEXT NOT NULL DEFAULT '{}',
  blog_post_id INTEGER REFERENCES blog_posts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_content_workflows_updated ON content_workflows (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_workflows_stage ON content_workflows (stage);
CREATE INDEX IF NOT EXISTS idx_content_workflows_post ON content_workflows (blog_post_id);

CREATE TABLE IF NOT EXISTS admin_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_admin_password_resets_expiry ON admin_password_resets (expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_password_resets_email ON admin_password_resets (email);
`;

/* -------------------------------------------------------------------------
 * v10 — persistent rate-limit buckets for auth/reset/admin write protection.
 * Public high-volume endpoints keep the in-process limiter; these low-volume
 * security paths survive restarts and are shared by all requests to this node.
 * ---------------------------------------------------------------------- */

export const RATE_LIMIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits (reset_at);
`;
