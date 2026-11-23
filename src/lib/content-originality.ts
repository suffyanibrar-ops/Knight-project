import { createHash } from "node:crypto";

/**
 * Content originality & quality analysis (Phase 5).
 *
 * Deterministic and local only: no AI provider, no network, nothing about a
 * draft leaves the server. Findings explain what, where, why, severity and what
 * to do — never "this article is original" or "this will rank".
 *
 * Limitations: shingle overlap detects textual reuse, not plagiarism of ideas;
 * it cannot verify facts, medical accuracy or authorship. A high similarity
 * score is a prompt for human review, not proof of duplication.
 */

export type Severity = "critical" | "warning" | "suggestion" | "passed";

export interface Finding {
  id: string;
  category: "duplicate" | "repetition" | "thin" | "keywords" | "structure" | "links" | "claims";
  severity: Severity;
  title: string;
  detail: string;
  where?: string;
  fix: string;
}

export interface CorpusItem { id: number; title: string; contentHtml: string }

export interface AnalysisInput {
  title: string;
  contentHtml: string;
  slug?: string;
  /** Other articles to compare against (never the article itself). */
  corpus?: CorpusItem[];
}

export interface AnalysisResult {
  findings: Finding[];
  counts: Record<Severity, number>;
  metrics: { words: number; paragraphs: number; headings: number; internalLinks: number; similarityMax: number };
  limitations: string;
}

const STOP = new Set("a an and are as at be by for from has have how in into is it its of on or that the their this to was were what when where which who why will with you your".split(" "));

export function normaliseText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[“”„«»"]/g, '"')
    .replace(/[‘’‚']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  return normaliseText(text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
}

export function contentTokens(html: string): string[] {
  return tokens(normaliseText(html).normalize("NFKC"));
}

export function paragraphs(html: string): string[] {
  const blocks = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  return blocks.map((block) => normaliseText(block)).filter((text) => text.length > 0);
}

export function headings(html: string): string[] {
  const found = html.match(/<h[2-3]\b[^>]*>([\s\S]*?)<\/h[2-3]>/gi) ?? [];
  return found.map((heading) => normaliseText(heading)).filter(Boolean);
}

export function internalLinks(html: string): string[] {
  const hrefs = [...html.matchAll(/<a\b[^>]*href\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);
  return hrefs.filter((href) => href.startsWith("/") || href.includes("knightmedicalbilling.com"));
}

/** Word-shingle Jaccard similarity on normalised tokens (0–1). */
export function similarity(a: string, b: string, size = 5): number {
  const sa = shingles(contentTokens(a), size);
  const sb = shingles(contentTokens(b), size);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const shingle of sa) if (sb.has(shingle)) shared += 1;
  return shared / (sa.size + sb.size - shared);
}

function shingles(list: string[], size: number): Set<string> {
  const set = new Set<string>();
  if (list.length < size) { if (list.length) set.add(list.join(" ")); return set; }
  for (let index = 0; index + size <= list.length; index += 1) set.add(list.slice(index, index + size).join(" "));
  return set;
}

export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a).filter((token) => !STOP.has(token)));
  const tb = new Set(tokens(b).filter((token) => !STOP.has(token)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

const CLAIM_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(guarantee[sd]?|guaranteed)\b/i, label: "absolute guarantee" },
  { re: /\b(100\s?%|always|never fails?|risk[- ]free)\b/i, label: "absolute outcome claim" },
  { re: /\b(cure[sd]?|heals?|reverse[sd]?)\b/i, label: "clinical outcome claim" },
  { re: /\b(fda[- ]approved|hipaa[- ]certified|iso[- ]certified)\b/i, label: "certification claim" },
  { re: /\b(proven to|clinically proven|scientifically proven)\b/i, label: "evidence claim" },
  { re: /\b(no denials|zero denials|never denied)\b/i, label: "performance guarantee" },
];

/**
 * Fingerprint of exactly the content that was analysed. The editor compares the
 * live fingerprint against this to mark a result stale after further edits.
 */
export function analysisFingerprint(title: string, contentHtml: string): string {
  return createHash("sha256").update(`${title.trim()}\u0000${contentHtml}`).digest("hex").slice(0, 16);
}

export function analyseContent(input: AnalysisInput): AnalysisResult {
  const findings: Finding[] = [];
  const clean = normaliseText(input.contentHtml);
  const words = contentTokens(input.contentHtml);
  const paras = paragraphs(input.contentHtml);
  const heads = headings(input.contentHtml);
  const links = internalLinks(input.contentHtml);
  const corpus = (input.corpus ?? []).filter(Boolean);

  // ---- duplicates & near-duplicates ----
  const fingerprint = createHash("sha256").update(words.join(" ")).digest("hex");
  let bestSimilarity = 0;
  let bestMatch: CorpusItem | null = null;
  for (const item of corpus) {
    const otherPrint = createHash("sha256").update(contentTokens(item.contentHtml).join(" ")).digest("hex");
    if (words.length > 60 && otherPrint === fingerprint) {
      findings.push({
        id: "duplicate-exact", category: "duplicate", severity: "critical",
        title: "Identical article already exists",
        detail: `This article matches “${item.title}” word for word.`,
        where: `Existing article #${item.id}`,
        fix: "Merge into the existing article or rewrite this draft around a different reader problem.",
      });
    }
    const score = similarity(input.contentHtml, item.contentHtml);
    if (score > bestSimilarity) { bestSimilarity = score; bestMatch = item; }
  }
  if (bestMatch && bestSimilarity >= 0.45 && bestSimilarity < 0.98) {
    findings.push({
      id: "duplicate-near", category: "duplicate", severity: bestSimilarity >= 0.7 ? "critical" : "warning",
      title: `Strong overlap with “${bestMatch.title}”`,
      detail: `${Math.round(bestSimilarity * 100)}% of five-word sequences also appear in that article.`,
      where: `Existing article #${bestMatch.id}`,
      fix: "Add a distinct angle, audience or evidence, or consolidate into the existing page and redirect.",
    });
  }
  const titleHits = corpus
    .map((item) => ({ item, score: titleSimilarity(input.title, item.title) }))
    .filter((row) => row.score >= 0.7)
    .sort((a, b) => b.score - a.score);
  if (titleHits[0]) {
    findings.push({
      id: "duplicate-title", category: "duplicate", severity: "warning",
      title: "Title is very close to an existing article",
      detail: `“${titleHits[0].item.title}” shares most of its significant words with this title.`,
      where: `Existing article #${titleHits[0].item.id}`,
      fix: "Name the specific reader problem in the title so the two pages do not compete for the same query.",
    });
  }

  // ---- repeated paragraphs (within the article) ----
  const seen = new Map<string, number>();
  for (const para of paras) {
    if (para.length < 60) continue;
    const key = createHash("sha1").update(para.toLowerCase()).digest("hex");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repeated = [...seen.values()].filter((count) => count > 1).length;
  if (repeated > 0) {
    findings.push({
      id: "repetition-paragraphs", category: "repetition", severity: "warning",
      title: "The same paragraph appears more than once",
      detail: `${repeated} paragraph${repeated === 1 ? "" : "s"} repeat inside this article.`,
      where: "Body copy",
      fix: "Keep one instance and use the space for a concrete example or next step.",
    });
  }

  // ---- repeated / duplicated headings ----
  const duplicateHeads = heads.filter((heading, index) => heads.findIndex((other) => other.toLowerCase() === heading.toLowerCase()) !== index);
  if (duplicateHeads.length) {
    findings.push({
      id: "repetition-headings", category: "structure", severity: "suggestion",
      title: "Duplicate section headings",
      detail: `Repeated: ${[...new Set(duplicateHeads)].slice(0, 3).join("; ")}.`,
      where: "Headings",
      fix: "Give each section a distinct purpose so readers can scan the structure.",
    });
  }

  // ---- keyword stuffing ----
  const counts = new Map<string, number>();
  for (const token of words) if (token.length > 3 && !STOP.has(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
  const [topTerm, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const density = words.length ? topCount / words.length : 0;
  if (words.length >= 120 && density >= 0.04) {
    findings.push({
      id: "keywords-stuffing", category: "keywords", severity: density >= 0.06 ? "critical" : "warning",
      title: "One phrase dominates the copy",
      detail: `“${topTerm}” appears ${topCount} times (${Math.round(density * 100)}% of words).`,
      where: "Body copy",
      fix: "Replace repeats with specific scenarios, payer examples or measurable process detail.",
    });
  }

  // ---- thin content ----
  if (words.length < 300) {
    findings.push({
      id: "thin-content", category: "thin", severity: words.length < 150 ? "critical" : "warning",
      title: "Article is likely too thin to be useful",
      detail: `${words.length} words across ${paras.length} paragraph${paras.length === 1 ? "" : "s"}.`,
      where: "Whole article",
      fix: "Add the workflow behind the claim: who does what, in which system, with what check.",
    });
  }
  if (paras.length < 4 && words.length >= 300) {
    findings.push({
      id: "structure-paragraphs", category: "structure", severity: "suggestion",
      title: "Very few paragraphs for the length",
      detail: `${paras.length} paragraphs — dense blocks are hard to scan.`,
      where: "Body copy",
      fix: "Break the copy into sections with H2 headings.",
    });
  }

  // ---- practical value ----
  const hasList = /<ul\b|<ol\b|<table\b/i.test(input.contentHtml);
  const hasSteps = /\b(step\s?\d|first,|then,|finally,|checklist|template|example)\b/i.test(clean);
  if (!hasList && !hasSteps) {
    findings.push({
      id: "value-actionable", category: "structure", severity: "suggestion",
      title: "No actionable detail detected",
      detail: "No list, table, example or step sequence was found.",
      where: "Whole article",
      fix: "Add a checklist, a worked example or the exact fields your team reviews.",
    });
  }

  // ---- internal links ----
  if (links.length === 0) {
    findings.push({
      id: "links-missing", category: "links", severity: "suggestion",
      title: "No internal links",
      detail: "The article does not link to a service, specialty or related guide.",
      where: "Body copy",
      fix: "Link the reader to the service page or guide that continues their next step.",
    });
  }

  // ---- claims needing editorial review ----
  for (const { re, label } of CLAIM_PATTERNS) {
    const match = clean.match(re);
    if (match) {
      findings.push({
        id: `claims-${label.replace(/\s+/g, "-")}`, category: "claims", severity: "warning",
        title: `Review the ${label}`,
        detail: `“${match[0]}” appears in the copy and needs a source or a qualifier.`,
        where: `“${match[0]}”`,
        fix: "Cite the source, or rephrase as the process you follow rather than an outcome you promise.",
      });
    }
  }

  const countsBySeverity: Record<Severity, number> = { critical: 0, warning: 0, suggestion: 0, passed: 0 };
  for (const finding of findings) countsBySeverity[finding.severity] += 1;
  if (findings.length === 0) {
    findings.push({
      id: "passed", category: "structure", severity: "passed",
      title: "No deterministic issues detected",
      detail: "Duplicate text, repetition, thin content, keyword density, links and claim patterns all passed.",
      fix: "A human editor should still review accuracy and usefulness — automated checks cannot verify facts.",
    });
    countsBySeverity.passed = 1;
  }

  return {
    findings,
    counts: countsBySeverity,
    metrics: { words: words.length, paragraphs: paras.length, headings: heads.length, internalLinks: links.length, similarityMax: Math.round(bestSimilarity * 100) / 100 },
    limitations: "Automated checks detect textual reuse and measurable quality signals only. They cannot verify facts, medical accuracy or authorship, and they do not predict search performance.",
  };
}
