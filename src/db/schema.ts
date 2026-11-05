import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema for the embedded SQLite database.
 *
 * The physical tables are created and migrated by `src/lib/sqlite.ts`
 * (parameterized DDL + `PRAGMA user_version` migrations), and everything runs
 * on one better-sqlite3 file. This file only gives those tables types for
 * query building; it is not a second source of truth for the DDL.
 *
 * Conventions:
 * - timestamps are integer epoch milliseconds (`timestamp_ms` → Date objects)
 * - booleans are integers (0/1) exposed as boolean
 * - arrays/objects are JSON text
 * - tables also maintained by plain SQL helpers (submissions, settings,
 *   subscribers, roi_estimates) are intentionally NOT declared here
 */

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  practice: text("practice"),
  specialty: text("specialty"),
  practiceSize: text("practice_size"),
  monthlyCollections: text("monthly_collections"),
  interests: text("interests", { mode: "json" }).$type<string[]>().notNull().default([]),
  message: text("message"),
  source: text("source").notNull().default("website"),
  status: text("status").notNull().default("new"),
  emailStatus: text("email_status").notNull().default("pending"),
  emailError: text("email_error"),
  emailSentAt: integer("email_sent_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const contactMessages = sqliteTable("contact_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  topic: text("topic"),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  emailStatus: text("email_status").notNull().default("pending"),
  emailError: text("email_error"),
  emailSentAt: integer("email_sent_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const emailOutbox = sqliteTable("email_outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  toEmail: text("to_email").notNull(),
  replyTo: text("reply_to"),
  subject: text("subject").notNull(),
  textBody: text("text_body").notNull(),
  htmlBody: text("html_body"),
  status: text("status").notNull().default("pending"),
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
});

export const adminAudit = sqliteTable("admin_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  detail: text("detail"),
  ip: text("ip"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const testimonials = sqliteTable("testimonials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quote: text("quote").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  org: text("org"),
  specialty: text("specialty"),
  image: text("image"),
  rating: integer("rating").notNull().default(5),
  sortOrder: integer("sort_order").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
});

export const specialtiesTable = sqliteTable("specialties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  groupName: text("group_name").notNull(),
  icon: text("icon").notNull().default("Stethoscope"),
  blurb: text("blurb").notNull(),
  focus: text("focus", { mode: "json" }).$type<string[]>().notNull().default([]),
  metricValue: text("metric_value").notNull().default("25%"),
  metricLabel: text("metric_label").notNull().default("A/R reduction"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const caseStudiesTable = sqliteTable("case_studies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  client: text("client").notNull(),
  specialty: text("specialty").notNull(),
  image: text("image").notNull(),
  summary: text("summary").notNull(),
  metrics: text("metrics", { mode: "json" }).$type<{ value: string; label: string }[]>().notNull().default([]),
  challenge: text("challenge").notNull(),
  approach: text("approach", { mode: "json" }).$type<string[]>().notNull().default([]),
  result: text("result").notNull(),
  quoteText: text("quote_text").notNull(),
  quoteAuthor: text("quote_author").notNull(),
  duration: text("duration").notNull(),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
});

export const articlesTable = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  excerpt: text("excerpt").notNull(),
  image: text("image").notNull(),
  readTime: text("read_time").notNull(),
  publishedAt: text("published_at").notNull(),
  author: text("author").notNull(),
  body: text("body", { mode: "json" }).$type<{ heading?: string; paragraphs: string[]; list?: string[] }[]>().notNull().default([]),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
});

export const faqsTable = sqliteTable("faqs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").notNull().default("general"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Lead = typeof leads.$inferSelect;
export type ContactMessageRow = typeof contactMessages.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type SpecialtyRow = typeof specialtiesTable.$inferSelect;
export type CaseStudyRow = typeof caseStudiesTable.$inferSelect;
export type ArticleRow = typeof articlesTable.$inferSelect;
export type FaqRow = typeof faqsTable.$inferSelect;
export type EmailOutboxRow = typeof emailOutbox.$inferSelect;


/* -------------------------------------------------------------------------
 * Blog CMS (schema migration v4). Created by `src/lib/sqlite.ts`; these
 * declarations only provide typed query building.
 * ---------------------------------------------------------------------- */

export const blogCategories = sqliteTable("blog_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const blogTags = sqliteTable("blog_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const blogMedia = sqliteTable("blog_media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceUrl: text("source_url"),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull().default("image/webp"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256").notNull().unique(),
  alt: text("alt"),
  caption: text("caption"),
  license: text("license"),
  attribution: text("attribution"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const blogPosts = sqliteTable("blog_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  contentHtml: text("content_html").notNull().default(""),
  featuredMediaId: integer("featured_media_id").references(() => blogMedia.id, { onDelete: "set null" }),
  featuredImage: text("featured_image"),
  featuredImageAlt: text("featured_image_alt"),
  featuredImageWidth: integer("featured_image_width"),
  featuredImageHeight: integer("featured_image_height"),
  author: text("author").notNull().default("Knight Medical Billing"),
  categoryId: integer("category_id").references(() => blogCategories.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  canonicalUrl: text("canonical_url"),
  socialImage: text("social_image"),
  readingTime: integer("reading_time").notNull().default(0),
  sourceNotes: text("source_notes"),
  viewCount: integer("view_count").notNull().default(0),
});

export const blogPostTags = sqliteTable(
  "blog_post_tags",
  {
    postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id").notNull().references(() => blogTags.id, { onDelete: "cascade" }),
  },
  (table) => ({ pk: primaryKey({ columns: [table.postId, table.tagId] }) }),
);

export const blogRevisions = sqliteTable("blog_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  contentHtml: text("content_html").notNull().default(""),
  status: text("status"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const blogRedirects = sqliteTable("blog_redirects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  postId: integer("post_id").references(() => blogPosts.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});


/* -------------------------------------------------------------------------
 * AI agent (schema migration v5). DDL lives in src/lib/sqlite-schema.ts.
 * ---------------------------------------------------------------------- */

export const aiConversations = sqliteTable("ai_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionHash: text("session_hash").notNull().unique(),
  channel: text("channel").notNull().default("text"),
  status: text("status").notNull().default("active"),
  visitorName: text("visitor_name"),
  visitorEmail: text("visitor_email"),
  messageCount: integer("message_count").notNull().default(0),
  leadId: integer("lead_id"),
  appointmentId: integer("appointment_id"),
  handoffId: integer("handoff_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
});

export const aiMessages = sqliteTable("ai_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull().default(""),
  toolName: text("tool_name"),
  toolArgs: text("tool_args"),
  toolResult: text("tool_result"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  latencyMs: integer("latency_ms"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiLeads = sqliteTable("ai_leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id"),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  organization: text("organization"),
  specialty: text("specialty"),
  providers: text("providers"),
  currentSetup: text("current_setup"),
  challenge: text("challenge"),
  servicesInterest: text("services_interest"),
  preferredContact: text("preferred_contact"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiAppointments = sqliteTable("ai_appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id"),
  leadId: integer("lead_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  organization: text("organization"),
  specialty: text("specialty"),
  startsAtUtc: integer("starts_at_utc", { mode: "timestamp_ms" }).notNull(),
  endsAtUtc: integer("ends_at_utc", { mode: "timestamp_ms" }).notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  status: text("status").notNull().default("confirmed"),
  tokenHash: text("token_hash").unique(),
  emailStatus: text("email_status").notNull().default("pending"),
  notes: text("notes"),
  externalEventId: text("external_event_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiAvailabilityRules = sqliteTable("ai_availability_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekday: integer("weekday").notNull(),
  startMinute: integer("start_minute").notNull().default(540),
  endMinute: integer("end_minute").notNull().default(1020),
  slotMinutes: integer("slot_minutes").notNull().default(15),
  bufferMinutes: integer("buffer_minutes").notNull().default(15),
  timezone: text("timezone").notNull().default("America/New_York"),
  active: integer("active").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiBlockedTimes = sqliteTable("ai_blocked_times", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startsAtUtc: integer("starts_at_utc", { mode: "timestamp_ms" }).notNull(),
  endsAtUtc: integer("ends_at_utc", { mode: "timestamp_ms" }).notNull(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiHandoffs = sqliteTable("ai_handoffs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id"),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  notifiedAt: integer("notified_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiKnowledgeSources = sqliteTable("ai_knowledge_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  contentText: text("content_text").notNull(),
  status: text("status").notNull().default("active"),
  checksum: text("checksum"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastIndexedAt: integer("last_indexed_at", { mode: "timestamp_ms" }),
});

export const aiKnowledgeChunks = sqliteTable("ai_knowledge_chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").notNull().references(() => aiKnowledgeSources.id, { onDelete: "cascade" }),
  heading: text("heading"),
  content: text("content").notNull(),
  ord: integer("ord").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const aiUsageLogs = sqliteTable("ai_usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id"),
  model: text("model"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costMicros: integer("cost_micros").notNull().default(0),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
