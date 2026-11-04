import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
