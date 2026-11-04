import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articlesTable, faqsTable, specialtiesTable } from "@/db/schema";
import { articles as fallbackArticles, faqs as fallbackFaqs, specialties as fallbackSpecialties, type Article, type Specialty } from "./site";

/**
 * Content access layer (specialties, articles, FAQs).
 *
 * The editable copy lives in the embedded SQLite database. The built-in content
 * in `src/lib/site.ts` remains the seed source and the safety net: if SQLite is
 * unavailable or a table has not been seeded yet, the site still renders the
 * same built-in content instead of showing an empty page.
 */

export async function getSpecialties(): Promise<Specialty[]> {
  try {
    const rows = await db.select().from(specialtiesTable).orderBy(asc(specialtiesTable.sortOrder));
    if (!rows.length) return fallbackSpecialties;
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      group: row.groupName,
      icon: row.icon,
      blurb: row.blurb,
      focus: row.focus ?? [],
    }));
  } catch {
    return fallbackSpecialties;
  }
}

export async function getSpecialty(slug: string): Promise<Specialty | undefined> {
  const all = await getSpecialties();
  return all.find((item) => item.slug === slug);
}

export async function getArticles(): Promise<Article[]> {
  try {
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.published, true)).orderBy(desc(articlesTable.publishedAt));
    if (!rows.length) return fallbackArticles;
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      category: row.category,
      excerpt: row.excerpt,
      image: row.image,
      readTime: row.readTime,
      date: row.publishedAt,
      author: row.author,
      body: row.body ?? [],
    }));
  } catch {
    return fallbackArticles;
  }
}

export async function getArticle(slug: string): Promise<Article | undefined> {
  const all = await getArticles();
  return all.find((item) => item.slug === slug);
}

export async function getFaqs(): Promise<{ q: string; a: string }[]> {
  try {
    const rows = await db.select().from(faqsTable).orderBy(asc(faqsTable.sortOrder));
    if (!rows.length) return fallbackFaqs;
    return rows.map((row) => ({ q: row.question, a: row.answer }));
  } catch {
    return fallbackFaqs;
  }
}
