import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  practice: varchar("practice", { length: 200 }),
  specialty: varchar("specialty", { length: 120 }),
  practiceSize: varchar("practice_size", { length: 80 }),
  monthlyCollections: varchar("monthly_collections", { length: 80 }),
  interests: jsonb("interests").$type<string[]>().default([]).notNull(),
  message: text("message"),
  source: varchar("source", { length: 120 }).default("website").notNull(),
  status: varchar("status", { length: 40 }).default("new").notNull(),
  emailStatus: varchar("email_status", { length: 30 }).default("pending").notNull(),
  emailError: text("email_error"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  topic: varchar("topic", { length: 120 }),
  message: text("message").notNull(),
  status: varchar("status", { length: 40 }).default("new").notNull(),
  emailStatus: varchar("email_status", { length: 30 }).default("pending").notNull(),
  emailError: text("email_error"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 200 }).notNull(),
    emailStatus: varchar("email_status", { length: 30 }).default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("subscribers_email_unique").on(table.email)],
);

export const roiEstimates = pgTable("roi_estimates", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 200 }),
  monthlyCollections: integer("monthly_collections").notNull(),
  denialRate: integer("denial_rate").notNull(),
  daysInAr: integer("days_in_ar").notNull(),
  estimatedAnnualUplift: integer("estimated_annual_uplift").notNull(),
  emailStatus: varchar("email_status", { length: 30 }).default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const testimonials = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  quote: text("quote").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  role: varchar("role", { length: 160 }),
  org: varchar("org", { length: 200 }),
  specialty: varchar("specialty", { length: 120 }),
  image: varchar("image", { length: 300 }),
  rating: integer("rating").default(5).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  published: boolean("published").default(true).notNull(),
});

export const specialtiesTable = pgTable("specialties", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  groupName: varchar("group_name", { length: 80 }).notNull(),
  icon: varchar("icon", { length: 60 }).notNull().default("Stethoscope"),
  blurb: text("blurb").notNull(),
  focus: jsonb("focus").$type<string[]>().default([]).notNull(),
  metricValue: varchar("metric_value", { length: 40 }).notNull().default("25%"),
  metricLabel: varchar("metric_label", { length: 80 }).notNull().default("A/R reduction"),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const caseStudiesTable = pgTable("case_studies", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  title: varchar("title", { length: 240 }).notNull(),
  client: varchar("client", { length: 200 }).notNull(),
  specialty: varchar("specialty", { length: 120 }).notNull(),
  image: varchar("image", { length: 300 }).notNull(),
  summary: text("summary").notNull(),
  metrics: jsonb("metrics").$type<{ value: string; label: string }[]>().default([]).notNull(),
  challenge: text("challenge").notNull(),
  approach: jsonb("approach").$type<string[]>().default([]).notNull(),
  result: text("result").notNull(),
  quoteText: text("quote_text").notNull(),
  quoteAuthor: varchar("quote_author", { length: 200 }).notNull(),
  duration: varchar("duration", { length: 120 }).notNull(),
  published: boolean("published").default(true).notNull(),
});

export const articlesTable = pgTable("articles", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  title: varchar("title", { length: 240 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  excerpt: text("excerpt").notNull(),
  image: varchar("image", { length: 300 }).notNull(),
  readTime: varchar("read_time", { length: 40 }).notNull(),
  publishedAt: varchar("published_at", { length: 40 }).notNull(),
  author: varchar("author", { length: 160 }).notNull(),
  body: jsonb("body").$type<{ heading?: string; paragraphs: string[]; list?: string[] }[]>().default([]).notNull(),
  published: boolean("published").default(true).notNull(),
});

export const faqsTable = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 80 }).default("general").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type SpecialtyRow = typeof specialtiesTable.$inferSelect;
export type CaseStudyRow = typeof caseStudiesTable.$inferSelect;
export type ArticleRow = typeof articlesTable.$inferSelect;
export type FaqRow = typeof faqsTable.$inferSelect;

export const emailOutbox = pgTable("email_outbox", {
  id: serial("id").primaryKey(),
  kind: varchar("kind", { length: 60 }).notNull(),
  toEmail: varchar("to_email", { length: 200 }).notNull(),
  replyTo: varchar("reply_to", { length: 200 }),
  subject: varchar("subject", { length: 300 }).notNull(),
  textBody: text("text_body").notNull(),
  htmlBody: text("html_body"),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  provider: varchar("provider", { length: 40 }),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  relatedType: varchar("related_type", { length: 40 }),
  relatedId: integer("related_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const adminAudit = pgTable("admin_audit", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 80 }).notNull(),
  detail: text("detail"),
  ip: varchar("ip", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type ContactMessageRow = typeof contactMessages.$inferSelect;
export type RoiEstimateRow = typeof roiEstimates.$inferSelect;
