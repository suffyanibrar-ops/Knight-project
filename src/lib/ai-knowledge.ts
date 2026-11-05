import "server-only";
import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { sqliteHandle } from "./sqlite";
import { audiences, faqs, leadership, services, site, specialties } from "./site";
import { getArticles } from "./data";
import { listPublicPosts, getPublicPost } from "./blog";

/**
 * Local retrieval-augmented generation (RAG) over approved website content.
 *
 * Uses SQLite FTS5 (verified available in the bundled better-sqlite3 build), so
 * there is no vector database, no embedding API and no additional service. The
 * index is rebuilt from the canonical content sources and can be refreshed from
 * the admin console.
 */

const CHUNK_CHARS = 900;
const STALE_MS = 6 * 60 * 60 * 1000;

type Raw = NonNullable<ReturnType<typeof sqliteHandle>>;

export interface KnowledgeHit {
  chunkId: number;
  title: string;
  url: string;
  heading: string | null;
  content: string;
  score: number;
}

function db(): Raw {
  const handle = sqliteHandle();
  if (!handle) throw new Error("SQLite is unavailable.");
  return handle;
}

function checksum(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

function chunkText(text: string): { heading: string | null; content: string }[] {
  const normalised = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!normalised) return [];
  const paragraphs = normalised.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: { heading: string | null; content: string }[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if (buffer.length + paragraph.length + 2 > CHUNK_CHARS && buffer) {
      chunks.push({ heading: null, content: buffer.trim() });
      buffer = "";
    }
    buffer += `${paragraph}\n\n`;
  }
  if (buffer.trim()) chunks.push({ heading: null, content: buffer.trim() });
  return chunks;
}

interface SourceDraft {
  kind: string;
  slug: string;
  title: string;
  url: string;
  content: string;
}

function websiteSources(): SourceDraft[] {
  const drafts: SourceDraft[] = [];
  const company = [
    `${site.name} is a US medical billing and revenue cycle management company.`,
    site.description,
    `Phone: ${site.phone}. Email: ${site.email}. Address: 585 Grove St Ste 145, Herndon, VA 20170, United States.`,
    "Business hours: Monday to Friday, 8:00am to 5:00pm Eastern Time.",
    "Published service standards: 99.9% claim acceptance rate, claims filed within 24 hours, no prepayment and no hidden fees, 5-day onboarding.",
    `Leadership: ${leadership.map((person) => `${person.name} (${person.role})`).join("; ")}.`,
    "Service areas and facilities: hospitals, healthcare systems, emergency rooms, free-standing emergency rooms, urgent cares, private practices, clinics and specialty groups across the United States.",
  ].join("\n\n");
  drafts.push({ kind: "company", slug: "company-overview", title: `${site.name} overview`, url: "/about", content: company });

  for (const service of services) {
    const content = [
      `${service.name} — ${service.tagline}`,
      service.intro,
      `Included: ${service.included.join("; ")}.`,
      `Highlights: ${service.highlights.map((item) => `${item.title}: ${item.detail}`).join(" ")}`,
      `Published metrics: ${service.metrics.map((metric) => `${metric.value} ${metric.label}`).join("; ")}.`,
      `FAQs: ${service.faqs.map((faq) => `Q: ${faq.q} A: ${faq.a}`).join(" ")}`,
    ].join("\n\n");
    drafts.push({ kind: "service", slug: service.slug, title: service.name, url: `/services/${service.slug}`, content });
  }

  for (const audience of audiences) {
    const content = [
      `${audience.name} — ${audience.title}`,
      audience.intro,
      `Focus points: ${audience.points.join("; ")}.`,
      `Services used: ${audience.services.join("; ")}.`,
      `Statistic: ${audience.stat.value} ${audience.stat.label}.`,
    ].join("\n\n");
    drafts.push({ kind: "audience", slug: audience.slug, title: `${audience.name} billing support`, url: `/who-we-serve/${audience.slug}`, content });
  }

  for (const specialty of specialties) {
    const content = `${specialty.name} (${specialty.group}). ${specialty.blurb} Key focus: ${specialty.focus.join("; ")}.`;
    drafts.push({ kind: "specialty", slug: specialty.slug, title: `${specialty.name} medical billing`, url: `/specialties/${specialty.slug}`, content });
  }

  faqs.forEach((faq, index) => {
    drafts.push({ kind: "faq", slug: `faq-${index + 1}`, title: faq.q, url: "/faq", content: `Question: ${faq.q}\n\nAnswer: ${faq.a}` });
  });

  return drafts;
}

async function databaseSources(): Promise<SourceDraft[]> {
  const drafts: SourceDraft[] = [];
  try {
    const articles = await getArticles();
    for (const article of articles.slice(0, 60)) {
      const body = Array.isArray(article.body) ? article.body.map((section) => `${section.heading}. ${section.paragraphs.join(" ")}`).join("\n\n") : "";
      drafts.push({
        kind: "article",
        slug: `insight-${article.slug}`,
        title: `Insight: ${article.title}`,
        url: `/insights/${article.slug}`,
        content: `${article.title}\n\n${article.excerpt}\n\n${body}`,
      });
    }
  } catch { /* content fallback is fine */ }

  try {
    const page = await listPublicPosts({ page: 1, perPage: 24 });
    const posts = [...page.posts];
    for (let p = 2; p <= page.totalPages && posts.length < 60; p += 1) {
      const next = await listPublicPosts({ page: p, perPage: 24 });
      posts.push(...next.posts);
      if (!next.posts.length) break;
    }
    for (const post of posts.slice(0, 60)) {
      const full = await getPublicPost(post.slug);
      const content = full && "post" in full ? stripHtml(full.post.contentHtml).slice(0, 12000) : post.excerpt ?? "";
      drafts.push({
        kind: "blog",
        slug: `blog-${post.slug}`,
        title: `Blog: ${post.title}`,
        url: `/blog/${post.slug}`,
        content: `${post.title}\n\n${post.excerpt ?? ""}\n\n${content}`,
      });
    }
  } catch { /* blog may be empty */ }

  return drafts;
}

function manualSources(): SourceDraft[] {
  try {
    const rows = db().prepare("SELECT kind, slug, title, url, content_text FROM ai_knowledge_sources WHERE kind = 'manual' AND status = 'active'").all() as {
      kind: string; slug: string; title: string; url: string; content_text: string;
    }[];
    return rows.map((row) => ({ kind: row.kind, slug: row.slug, title: row.title, url: row.url ?? "/", content: row.content_text }));
  } catch {
    return [];
  }
}

export interface RebuildResult {
  sources: number;
  chunks: number;
  rebuiltAt: string;
}

/** Rebuild the FTS index from approved site content + manual sources. */
export async function rebuildKnowledge(): Promise<RebuildResult> {
  const drafts = [...websiteSources(), ...(await databaseSources()), ...manualSources()];
  const sql = db();
  sql.exec("BEGIN IMMEDIATE");
  try {
    sql.prepare("DELETE FROM ai_knowledge_fts").run();
    sql.prepare("DELETE FROM ai_knowledge_sources WHERE kind <> 'manual'").run();
    const now = Date.now();
    const insertSource = sql.prepare(
      `INSERT INTO ai_knowledge_sources (kind, slug, title, url, content_text, status, checksum, created_at, updated_at, last_indexed_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
       ON CONFLICT(kind, slug) DO UPDATE SET title=excluded.title, url=excluded.url, content_text=excluded.content_text,
         status='active', checksum=excluded.checksum, updated_at=excluded.updated_at, last_indexed_at=excluded.last_indexed_at`,
    );
    const insertChunk = sql.prepare("INSERT INTO ai_knowledge_chunks (source_id, heading, content, ord, created_at) VALUES (?, ?, ?, ?, ?)");
    const insertFts = sql.prepare("INSERT INTO ai_knowledge_fts (rowid, content, heading, source_title, source_url, chunk_id) VALUES (?, ?, ?, ?, ?, ?)");
    const selectSource = sql.prepare("SELECT id FROM ai_knowledge_sources WHERE kind = ? AND slug = ?");
    let chunkCount = 0;
    for (const draft of drafts) {
      insertSource.run(draft.kind, draft.slug, draft.title, draft.url, draft.content, checksum(draft.content), now, now, now);
      const row = selectSource.get(draft.kind, draft.slug) as { id: number } | undefined;
      if (!row) continue;
      sql.prepare("DELETE FROM ai_knowledge_chunks WHERE source_id = ?").run(row.id);
      const chunks = chunkText(draft.content);
      chunks.forEach((chunk, index) => {
        const info = insertChunk.run(row.id, chunk.heading, chunk.content, index, now);
        insertFts.run(info.lastInsertRowid, chunk.content, chunk.heading ?? "", draft.title, draft.url, info.lastInsertRowid);
        chunkCount += 1;
      });
    }
    sql.exec("COMMIT");
    return { sources: drafts.length, chunks: chunkCount, rebuiltAt: new Date(now).toISOString() };
  } catch (error) {
    try { sql.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

export async function ensureKnowledgeIndexed(): Promise<void> {
  const sql = db();
  const count = (sql.prepare("SELECT COUNT(*) AS n FROM ai_knowledge_sources WHERE status='active'").get() as { n: number }).n;
  if (count === 0) {
    await rebuildKnowledge();
    return;
  }
  const last = (sql.prepare("SELECT MAX(last_indexed_at) AS t FROM ai_knowledge_sources").get() as { t: number | null }).t ?? 0;
  if (Date.now() - last > STALE_MS) {
    rebuildKnowledge().catch(() => undefined);
  }
}

function ftsQuery(input: string): string | null {
  const tokens = input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3).slice(0, 8);
  if (!tokens.length) return null;
  return tokens.map((token) => `"${token}"`).join(" OR ");
}

/** Retrieve the most relevant knowledge chunks for a visitor question. */
export function searchKnowledge(input: string, limit = 5): KnowledgeHit[] {
  const query = ftsQuery(input);
  if (!query) return [];
  try {
    const rows = db()
      .prepare(
        `SELECT f.chunk_id AS chunkId, f.source_title AS title, f.source_url AS url, f.heading AS heading,
                c.content AS content, bm25(ai_knowledge_fts) AS score
         FROM ai_knowledge_fts f
         JOIN ai_knowledge_chunks c ON c.id = f.chunk_id
         WHERE ai_knowledge_fts MATCH ?
         ORDER BY bm25(ai_knowledge_fts) ASC
         LIMIT ?`,
      )
      .all(query, Math.max(1, Math.min(8, limit))) as { chunkId: number; title: string; url: string; heading: string | null; content: string; score: number }[];
    return rows;
  } catch {
    return [];
  }
}

export function knowledgeStatus(): { sources: number; chunks: number; lastIndexedAt: string | null; manualSources: number } {
  try {
    const sources = (db().prepare("SELECT COUNT(*) AS n FROM ai_knowledge_sources WHERE status='active'").get() as { n: number }).n;
    const chunks = (db().prepare("SELECT COUNT(*) AS n FROM ai_knowledge_chunks").get() as { n: number }).n;
    const manual = (db().prepare("SELECT COUNT(*) AS n FROM ai_knowledge_sources WHERE kind='manual'").get() as { n: number }).n;
    const last = (db().prepare("SELECT MAX(last_indexed_at) AS t FROM ai_knowledge_sources").get() as { t: number | null }).t;
    return { sources, chunks, lastIndexedAt: last ? new Date(last).toISOString() : null, manualSources: manual };
  } catch {
    return { sources: 0, chunks: 0, lastIndexedAt: null, manualSources: 0 };
  }
}

/** Render retrieval context for the system prompt, with source attribution. */
export function renderKnowledgeContext(hits: KnowledgeHit[]): string {
  if (!hits.length) return "";
  return hits
    .map((hit, index) => `[${index + 1}] ${hit.title} (${site.url}${hit.url})\n${hit.content.slice(0, 1200)}`)
    .join("\n\n---\n\n");
}


export interface KnowledgeSourceRow {
  id: number; kind: string; slug: string; title: string; url: string | null; status: string;
  updatedAt: number; lastIndexedAt: number | null; chunkCount: number;
}

export function listKnowledgeSources(limit = 200): KnowledgeSourceRow[] {
  try {
    const rows = db()
      .prepare(`SELECT s.id, s.kind, s.slug, s.title, s.url, s.status, s.updated_at, s.last_indexed_at,
                       (SELECT COUNT(*) FROM ai_knowledge_chunks c WHERE c.source_id = s.id) AS chunk_count
                FROM ai_knowledge_sources s ORDER BY s.kind, s.title LIMIT ?`)
      .all(limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id), kind: String(row.kind), slug: String(row.slug), title: String(row.title),
      url: row.url ? String(row.url) : null, status: String(row.status), updatedAt: Number(row.updated_at),
      lastIndexedAt: row.last_indexed_at ? Number(row.last_indexed_at) : null, chunkCount: Number(row.chunk_count),
    }));
  } catch { return []; }
}
