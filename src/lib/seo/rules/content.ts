import { canonicaliseUrl, type Observation } from "../observations";

/**
 * Editorial content metrics (Phase 6, P6.0).
 *
 * Rubric adapted from the vetted `MADEVAL/RankWise` skill (MIT): we take the
 * measurable part only and reimplement it in TypeScript. No prompt text, no
 * Python validator and no third-party code runs here.
 *
 * IMPORTANT: the numbers below are an editorial rubric, not Google's algorithm
 * and not a ranking score. A low score means "a human should look at this",
 * never "this page ranks badly".
 */

export interface ContentSignals {
  words: number;
  sentences: number;
  syllables: number;
  paragraphs: number;
  headings: { h1: number; h2: number; h3: number };
  fleschReadingEase: number;
  passiveRatio: number;
  keywordDensity: number | null;
  keywordInFirst100Words: boolean | null;
}

const WORD_RE = /[\p{L}\p{N}'’-]+/gu;
const SENTENCE_RE = /[^.!?]+[.!?]+/g;

/**
 * Next.js streams dynamic pages: the first paint is a Suspense fallback inside
 * `<main>`, and the real markup arrives later in `<div hidden id="S:N">`
 * segments that the browser moves into place after hydration. A raw-HTML reader
 * must join those segments, otherwise a fully written page measures as a loading
 * skeleton (a false "thin content" and a meaningless readability score).
 */
export function streamedSegments(html: string): string {
  const segments: string[] = [];
  const marker = /<div hidden id="S:\d+">/g;
  for (let match = marker.exec(html); match; match = marker.exec(html)) {
    let cursor = match.index + match[0].length;
    let depth = 1;
    while (cursor < html.length && depth > 0) {
      const nextOpen = html.indexOf("<div", cursor);
      const nextClose = html.indexOf("</div>", cursor);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        cursor = nextOpen + 4;
      } else {
        depth -= 1;
        cursor = nextClose + 6;
      }
    }
    segments.push(html.slice(match.index + match[0].length, Math.max(match.index + match[0].length, cursor - 6)));
    marker.lastIndex = cursor;
  }
  return segments.join("\n");
}

/**
 * The readable document, not the whole chrome.
 *
 * Measuring the entire response made every page inherit the navigation, footer,
 * cookie banner and CTA labels. Those strings have almost no sentence-ending
 * punctuation, so the sentence count collapsed and Flesch Reading Ease fell
 * below the threshold on pages whose article copy was perfectly readable. The
 * rubric is about the page's content, so it operates on `<main>` when the
 * document has one and falls back to the body without header/footer/nav/aside.
 *
 * When `<main>` still holds the streaming fallback, the streamed segments are
 * substituted so a paused or non-JS stream is measured as the page it will become.
 */
export function mainContent(html: string): string {
  const start = html.search(/<main\b/i);
  if (start !== -1) {
    const end = html.toLowerCase().lastIndexOf("</main>");
    if (end > start) {
      const main = html.slice(start, end + "</main>".length);
      if (!isStreamingFallback(main)) return main;
      const streamed = streamedSegments(html);
      if (streamed.trim()) return streamed;
      return main;
    }
  }
  return html
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
}

/** A Suspense shell carries either the pending marker or the loading skeleton. */
export function isStreamingFallback(html: string): boolean {
  return html.includes("<!--$?-->") || html.includes("Loading page content");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Text with block boundaries preserved as sentence boundaries.
 *
 * Paragraphs, headings and list items are separate reading units. Stripping all
 * tags merged a bulleted list into the previous sentence, which inflated the
 * average sentence length and pushed perfectly normal professional copy below a
 * "difficult" Flesch score. A full stop after each block is the standard way to
 * stop that merge from distorting the metric.
 */
export function readableText(html: string): string {
  return htmlToText(
    html
      .replace(/<\/(p|li|h[1-6]|blockquote|figcaption|td|th)>/gi, ". ")
      .replace(/<br\s*\/?>/gi, ". "),
  );
}

/** Heading levels in document order, used for hierarchy checks. */
export function headingLevels(html: string): number[] {
  return [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
}

/** Transitions that jump a level, e.g. H2 → H4 or H1 → H3. */
export function skippedHeadingLevels(html: string): { from: number; to: number }[] {
  const levels = headingLevels(html);
  const skips: { from: number; to: number }[] = [];
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) skips.push({ from: levels[index - 1], to: levels[index] });
  }
  return skips;
}

/** Vowel-group syllable heuristic. Deterministic and language-agnostic-ish for EN. */
export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function analyseContent(html: string, keyword?: string | null): ContentSignals {
  const text = readableText(html);
  const words = text.match(WORD_RE) ?? [];
  const sentences = Math.max(1, (text.match(SENTENCE_RE) ?? []).length || 1);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const paragraphs = (html.match(/<p\b/gi) ?? []).length;
  const headings = {
    h1: (html.match(/<h1\b/gi) ?? []).length,
    h2: (html.match(/<h2\b/gi) ?? []).length,
    h3: (html.match(/<h3\b/gi) ?? []).length,
  };

  const wordCount = Math.max(1, words.length);
  const flesch = 206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount);

  // Deliberately crude passive detection: only "to be" + past participle patterns.
  const passiveMatches = text.match(/\b(?:is|are|was|were|be|been|being)\s+\w+(?:ed|en)\b/gi) ?? [];
  const passiveRatio = Math.min(1, passiveMatches.length / sentences);

  const cleanKeyword = (keyword ?? "").trim().toLowerCase();
  let keywordDensity: number | null = null;
  let keywordInFirst100Words: boolean | null = null;
  if (cleanKeyword) {
    const lowerText = text.toLowerCase();
    const keywordWords = cleanKeyword.split(/\s+/).filter(Boolean);
    const occurrences = lowerText.split(cleanKeyword).length - 1;
    keywordDensity = keywordWords.length ? (occurrences * keywordWords.length * 100) / wordCount : null;
    const first100 = words.slice(0, 100).join(" ").toLowerCase();
    keywordInFirst100Words = first100.includes(cleanKeyword);
  }

  return {
    words: words.length,
    sentences,
    syllables,
    paragraphs,
    headings,
    fleschReadingEase: Math.round(flesch * 10) / 10,
    passiveRatio: Math.round(passiveRatio * 1000) / 1000,
    keywordDensity: keywordDensity === null ? null : Math.round(keywordDensity * 100) / 100,
    keywordInFirst100Words,
  };
}

export interface ContentRuleContext {
  canonicalOrigin: string;
  keyword?: string | null;
  observedAt?: string;
  provenance?: string;
  /** Minimum words for the page type; articles use 600, landing pages 300. */
  minWords?: number;
}

/** Routes whose job is navigation or a short transactional task, not prose. */
const UTILITY_ROUTES = new Set([
  "/about",
  "/blog",
  "/contact",
  "/cookie-policy",
  "/faq",
  "/hipaa-compliance",
  "/insights",
  "/our-process",
  "/privacy-policy",
  "/results",
  "/results/case-studies",
  "/schedule-form",
  "/services",
  "/software",
  "/specialties",
  "/switching-medical-billing",
  "/terms-of-service",
  "/who-we-serve",
  "/why-knight",
]);

/**
 * The thin-content floor depends on what the page is for. A contact page or a
 * listing page is intentionally shorter than a service page; applying the
 * landing-page floor to every route produced thin-content findings on pages
 * that were complete for their purpose.
 */
export function minimumWordsForPage(url: string): number {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (UTILITY_ROUTES.has(path)) return 150;
    if (path.startsWith("/tools/") || path.startsWith("/appointment/")) return 150;
    if (path.startsWith("/blog/category/") || path.startsWith("/blog/tag/")) return 150;
    return 300;
  } catch {
    return 300;
  }
}

const LISTING_ROUTES = new Set([
  "/blog",
  "/insights",
  "/results",
  "/results/case-studies",
  "/services",
  "/software",
  "/specialties",
  "/who-we-serve",
]);

/**
 * Directory/index pages are lists of links, not prose. Their "sentences" are
 * card labels and specialty names, so a prose readability score is meaningless
 * there and must not be reported as a page defect.
 */
export function isListingPage(url: string): boolean {
  try {
    return LISTING_ROUTES.has(new URL(url).pathname.replace(/\/+$/, "") || "/");
  } catch {
    return false;
  }
}

export function contentObservations(
  page: { url: string; html: string },
  context: ContentRuleContext,
): Observation[] {
  const content = mainContent(page.html);
  const signals = analyseContent(content, context.keyword);
  const subjectKey = canonicaliseUrl(page.url, context.canonicalOrigin);
  const observedAt = context.observedAt ?? new Date().toISOString();
  const provenance = context.provenance ?? "crawl";
  const out: Observation[] = [];
  const base = { source: "rules" as const, subjectType: "url" as const, subjectKey, observedAt, provenance };

  const minWords = context.minWords ?? minimumWordsForPage(page.url);
  if (signals.words < minWords) {
    out.push({
      ...base,
      checkId: "content_thin",
      severity: signals.words < minWords / 2 ? "high" : "medium",
      metrics: { words: signals.words, minWords },
      evidence: { rubric: "editorial" },
    });
  }

  const skips = skippedHeadingLevels(content);
  const sectionCount = signals.headings.h2 + signals.headings.h3;
  if (signals.words > 300 && (sectionCount < 2 || skips.length > 0)) {
    out.push({
      ...base,
      checkId: "content_heading_structure",
      severity: "low",
      metrics: { ...artifacts(signals), skips: skips.length },
      evidence: {
        rubric: "editorial",
        note: sectionCount < 2
          ? "A long page with fewer than two sub-sections (H2/H3)."
          : "Heading levels skip a level, which makes the outline harder to follow.",
        skipped: skips.slice(0, 5).map((skip) => `H${skip.from}→H${skip.to}`),
      },
    });
  }

  if (signals.keywordDensity !== null && (signals.keywordDensity > 3.5 || signals.keywordDensity < 0.3)) {
    out.push({
      ...base,
      checkId: "content_keyword_density",
      severity: "medium",
      metrics: { density: signals.keywordDensity, words: signals.words },
      evidence: { rubric: "editorial", keyword: context.keyword ?? null },
    });
  }

  if (signals.keywordInFirst100Words === false) {
    out.push({
      ...base,
      checkId: "content_keyword_not_early",
      severity: "low",
      metrics: { words: signals.words },
      evidence: { rubric: "editorial" },
    });
  }

  // Flesch Reading Ease counts syllables, so specialist vocabulary (eligibility,
  // authorization, coinsurance, reimbursement) lowers the score even when the
  // sentences are short. A hard 30-point floor therefore flagged accurate
  // medical-billing copy that the brief explicitly says not to oversimplify.
  // The rubric keeps a very low floor for genuinely dense prose and adds an
  // independent long-sentence signal, which is the actionable part of "hard to
  // read". Listing pages are excluded because their text is labels, not prose.
  const averageSentenceWords = signals.words / Math.max(1, signals.sentences);
  if (!isListingPage(page.url) && signals.words > 200 && (signals.fleschReadingEase < 25 || averageSentenceWords > 28)) {
    out.push({
      ...base,
      checkId: "content_readability_hard",
      severity: "low",
      metrics: {
        flesch: signals.fleschReadingEase,
        sentences: signals.sentences,
        averageSentenceWords: Math.round(averageSentenceWords * 10) / 10,
      },
      evidence: {
        rubric: "editorial",
        method: "Flesch Reading Ease (EN) < 25, or average sentence length > 28 words",
      },
    });
  }

  if (signals.passiveRatio > 0.35) {
    out.push({
      ...base,
      checkId: "content_passive_voice",
      severity: "info",
      metrics: { passiveRatio: signals.passiveRatio },
      evidence: { rubric: "editorial" },
    });
  }

  return out;
}

function artifacts(signals: ContentSignals): Record<string, number> {
  return { words: signals.words, h2: signals.headings.h2, h3: signals.headings.h3, paragraphs: signals.paragraphs };
}
