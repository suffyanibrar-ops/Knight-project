/**
 * Seeds the embedded SQLite database with the built-in content from
 * src/lib/site.ts (specialties, articles, FAQs).
 *
 * Safe to run repeatedly: rows are upserted by slug, nothing is duplicated and
 * website form data is never touched. The app also creates every table at
 * startup, so this script can run before or after the first boot.
 *
 *   npm run seed
 *   SQLITE_PATH=/var/data/app.db npm run seed
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { SCHEMA } from "../src/lib/sqlite-schema.ts";

const { specialties, articles, faqs } = await import("../src/lib/site.ts");

const configured = process.env.SQLITE_PATH?.trim() || "data/app.db";
const file = isAbsolute(configured) ? configured : `${process.cwd()}/${configured}`;
mkdirSync(dirname(file), { recursive: true });

const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");

// Shared, idempotent DDL — identical to what the app applies at startup.
db.exec(SCHEMA);

const upsertSpecialty = db.prepare(`
  INSERT INTO specialties (slug, name, group_name, icon, blurb, focus, sort_order)
  VALUES (@slug, @name, @groupName, @icon, @blurb, @focus, @sortOrder)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    group_name = excluded.group_name,
    icon = excluded.icon,
    blurb = excluded.blurb,
    focus = excluded.focus,
    sort_order = excluded.sort_order
`);

const upsertArticle = db.prepare(`
  INSERT INTO articles (slug, title, category, excerpt, image, read_time, published_at, author, body, published)
  VALUES (@slug, @title, @category, @excerpt, @image, @readTime, @publishedAt, @author, @body, 1)
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    category = excluded.category,
    excerpt = excluded.excerpt,
    image = excluded.image,
    read_time = excluded.read_time,
    published_at = excluded.published_at,
    author = excluded.author,
    body = excluded.body,
    published = 1
`);

const insertFaq = db.prepare(`
  INSERT INTO faqs (question, answer, category, sort_order)
  VALUES (@question, @answer, 'general', @sortOrder)
`);

const run = db.transaction(() => {
  specialties.forEach((item, index) => {
    upsertSpecialty.run({
      slug: item.slug,
      name: item.name,
      groupName: item.group,
      icon: item.icon,
      blurb: item.blurb,
      focus: JSON.stringify(item.focus ?? []),
      sortOrder: index,
    });
  });

  articles.forEach((item) => {
    upsertArticle.run({
      slug: item.slug,
      title: item.title,
      category: item.category,
      excerpt: item.excerpt,
      image: item.image,
      readTime: item.readTime,
      publishedAt: item.date,
      author: item.author,
      body: JSON.stringify(item.body ?? []),
    });
  });

  db.prepare("DELETE FROM faqs").run();
  faqs.forEach((item, index) => {
    insertFaq.run({ question: item.q, answer: item.a, sortOrder: index });
  });
});

run();

const counts = {
  specialties: db.prepare("SELECT COUNT(*) AS n FROM specialties").get().n,
  articles: db.prepare("SELECT COUNT(*) AS n FROM articles").get().n,
  faqs: db.prepare("SELECT COUNT(*) AS n FROM faqs").get().n,
};

console.log(`[seed] ${file}`);
console.log(`[seed] specialties=${counts.specialties} articles=${counts.articles} faqs=${counts.faqs}`);
db.close();
