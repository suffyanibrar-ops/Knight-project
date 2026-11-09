import "server-only";
import { streamCompletion, type ChatMessage } from "./ai-deepseek";
import { knownInternalPaths, sanitizeDraft, sanitizePlan, sanitizeResearch, type WorkflowDraft, type WorkflowPlan, type WorkflowResearch } from "./content-workflow";
import type { LiveSearch, SearchConsoleData } from "./search-research";

/**
 * Editorial AI calls. These are server-only and deliberately return structured
 * plans rather than auto-publishing prose. The model is not given a browsing
 * tool, so it must not claim live SERP or competitor research; editor-supplied
 * notes are the only external research input in this implementation.
 */

function parseJsonObject<T>(raw: string): T {
  const withoutFence = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI returned no structured content.");
  const parsed = JSON.parse(withoutFence.slice(start, end + 1)) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("The AI returned an invalid content plan.");
  return parsed as T;
}

async function complete(system: string, user: string, maxTokens = 2000, jsonMode = false): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const result = await streamCompletion({ messages, temperature: 0.2, maxTokens, jsonMode });
  if (!result.content.trim()) throw new Error("The AI returned an empty response.");
  return result.content;
}

/** Structured stages get one compact retry if a provider still returns malformed JSON. */
async function completeJson<T>(system: string, user: string, maxTokens = 2000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await complete(system, user, maxTokens, true);
    try {
      return parseJsonObject<T>(raw);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The AI returned malformed structured content.");
}

const EDITORIAL_RULES = `
You are an editorial planning assistant for Knight Medical Billing, a US medical billing and revenue cycle management company serving independent practices, clinics, specialty groups, hospitals and urgent cares.

NON-NEGOTIABLE ACCURACY RULES:
- Never invent statistics, search volume, keyword difficulty, rankings, payer policies, CPT/ICD rules, filing deadlines, legal requirements, survey results, clients, awards or citations.
- Do not claim to have searched the web. You have no live SERP data. If no competitor data is supplied, say so plainly and plan from the supplied site context.
- Only use sources explicitly supplied by the editor. Do not manufacture URLs or source titles.
- Prefer evergreen, practical explanations over hype. Distinguish process commitments from guaranteed outcomes.
- Do not give legal, coding or clinical advice. Encourage verification against official payer/regulatory guidance where relevant.
- The article will be reviewed by a human before publishing. Mark uncertainty instead of filling gaps with invented facts.
- Write for independent medical practices and the people responsible for revenue cycle operations.

The output must be valid JSON only. Do not wrap it in commentary.`.trim();

export async function generateContentResearch(input: {
  topic: string;
  audience?: string;
  editorNotes?: string;
  existingPosts: { title: string; slug: string; excerpt?: string | null }[];
  existingTitles: string[];
  providedSources: { title: string; url: string; note?: string }[];
  liveSearch?: LiveSearch;
  searchConsole?: SearchConsoleData;
}): Promise<{ research: WorkflowResearch; plan: WorkflowPlan }> {
  const user = `Develop the research brief and article plan for this topic.

TOPIC:
${input.topic}

AUDIENCE:
${input.audience || "Independent medical practices and practice managers in the United States"}

EDITOR-SUPPLIED RESEARCH / COMPETITOR NOTES (may be empty):
${input.editorNotes || "(none supplied — explicitly set competitorNotes to a sentence saying no live SERP/competitor dataset was connected and this plan is based on site coverage plus the topic.)"}

PROVIDED SOURCES (the ONLY sources you may cite):
${input.providedSources.length ? input.providedSources.map((source) => `- ${source.title}: ${source.url}${source.note ? ` (${source.note})` : ""}`).join("\n") : "(none — return an empty sources array)"}

LIVE SEARCH-RESULT DATA (real provider output, not invented; use only for competitor/intent analysis):
${input.liveSearch?.available
    ? input.liveSearch.results.map((result) => `- #${result.position} ${result.title} — ${result.url}\n  ${result.snippet}`).join("\n") || "(provider returned no results)"
    : `UNAVAILABLE: ${input.liveSearch?.note ?? "No live search provider configured."}`}

VERIFIED GOOGLE SEARCH CONSOLE METRICS (only if available; these are clicks/impressions/CTR/position, NOT volume/difficulty):
${input.searchConsole?.available
    ? input.searchConsole.metrics.map((metric) => `- "${metric.query}": clicks=${metric.clicks}, impressions=${metric.impressions}, ctr=${(metric.ctr * 100).toFixed(1)}%, avgPosition=${metric.position.toFixed(1)}`).join("\n") || "(property has no matching query rows)"
    : `UNAVAILABLE: ${input.searchConsole?.note ?? "Google Search Console not configured."}`}

Do not invent search volume, keyword difficulty, rankings or competitor facts. If a provider is unavailable, state that plainly in research.competitorNotes and plan.notes.

EXISTING KNIGHT ARTICLE TITLES / SLUGS (avoid duplicate topics and keyword cannibalization):
${input.existingPosts.length ? input.existingPosts.map((post) => `- ${post.title} (/blog/${post.slug})`).join("\n") : "(no published or draft blog posts yet)"}

AVAILABLE INTERNAL DESTINATIONS (only use these hrefs):
${knownInternalPaths().join(", ")}

Return JSON with exactly this shape:
{
  "research": {
    "summary": "2-4 sentence topic brief",
    "searchIntent": "what the searcher wants and the job-to-be-done",
    "audience": "specific reader",
    "existingCoverage": "how existing Knight content overlaps or differs",
    "contentGaps": ["gap 1", "gap 2"],
    "competitorNotes": "honest statement about available research; no invented SERP facts",
    "sources": [{"title":"only supplied source","url":"https://..."}],
    "primaryKeyword": "one focused phrase",
    "secondaryKeywords": ["..."],
    "longTailKeywords": ["..."]
  },
  "plan": {
    "title": "specific working title",
    "slug": "lowercase-hyphen-slug",
    "primaryKeyword": "same primary phrase",
    "secondaryKeywords": ["..."],
    "longTailKeywords": ["..."],
    "outline": [{"heading":"H2 heading","purpose":"what this section answers"}],
    "internalLinks": [{"label":"anchor","href":"/allowed-path","reason":"why relevant"}],
    "schemaType": "Article or FAQPage",
    "notes": "human-review notes and any uncertainty"
  }
}

Use 5-9 outline sections. The plan must be genuinely useful, not a generic list. Never invent a statistic or citation.`;
  const parsed = await completeJson<{ research?: unknown; plan?: unknown }>(EDITORIAL_RULES, user, 2000);
  const research = sanitizeResearch(parsed.research);
  const plan = sanitizePlan(parsed.plan);
  // Enforce the source allow-list rather than trusting generated citations.
  const allowed = new Set(input.providedSources.map((source) => source.url));
  research.sources = (research.sources ?? []).filter((source) => allowed.has(source.url));
  if (!input.providedSources.length) research.sources = [];
  if (!research.competitorNotes) research.competitorNotes = "No live SERP or competitor dataset was connected. This plan is based on site coverage and the editor's topic.";
  if (!plan.title) throw new Error("The AI did not return a usable article plan.");
  if (!plan.outline?.length) throw new Error("The AI returned no outline.");
  return { research, plan };
}

export async function generateContentDraft(input: {
  topic: string;
  research: WorkflowResearch;
  plan: WorkflowPlan;
  sources: { title: string; url: string; note?: string }[];
  existingTitles: string[];
}): Promise<WorkflowDraft> {
  const outline = (input.plan.outline ?? []).map((item, index) => `${index + 1}. ${item.heading}${item.purpose ? ` — ${item.purpose}` : ""}`).join("\n");
  const bodyPrompt = `Write the complete article body as raw HTML for Knight Medical Billing.

TOPIC: ${input.topic}
PRIMARY KEYWORD: ${input.plan.primaryKeyword ?? ""}
AUDIENCE: ${input.research.audience ?? "independent medical practices"}
SEARCH INTENT: ${input.research.searchIntent ?? ""}
EXISTING CONTENT TO DIFFERENTIATE FROM: ${input.existingTitles.join(" | ") || "(none)"}

RESEARCH SUMMARY:
${input.research.summary ?? ""}

OUTLINE:
${outline}

ALLOWED INTERNAL LINKS (use only these hrefs; 2-4 natural links max):
${knownInternalPaths().join(", ")}

SUPPLIED SOURCES (only cite these; do not invent sources; if none, keep factual claims general):
${input.sources.length ? input.sources.map((source) => `- ${source.title}: ${source.url}`).join("\n") : "(none)"}

REQUIREMENTS:
- 700-950 words of genuinely useful prose aimed at an independent practice operator.
- Start with a direct, specific introduction. Avoid generic "in today's fast-paced healthcare landscape" language.
- Use <h2> and <h3> sections; NEVER include an <h1>. Do not include <html>, <head>, scripts, styles or inline event handlers.
- Use 2-4 natural internal links to Knight service/consultation pages from the allowed list.
- Add a short "What to do next" section offering a consultation without pressure.
- Include a "Sources and verification" section only when supplied sources exist. Never fabricate a citation or statistic.
- If you mention a payer/coding/regulatory rule, say it must be verified against current official guidance; do not state an invented rule.
- Return only the HTML fragment, no JSON, no markdown fences, no commentary.`;
  const body = await complete(EDITORIAL_RULES, bodyPrompt, 2000);
  const contentHtml = body
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  if (!contentHtml || !/<(p|h2|h3)\b/i.test(contentHtml)) throw new Error("The AI did not return an article body.");

  const plain = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 5500);
  const metadataPrompt = `Create the SEO metadata for this finished article. Return JSON only. Do not rewrite the article.

TOPIC: ${input.topic}
PRIMARY KEYWORD: ${input.plan.primaryKeyword ?? ""}
OUTLINE: ${(input.plan.outline ?? []).map((item) => item.heading).join(" | ")}
ARTICLE TEXT:
${plain}

Return exactly:
{
  "title": "article title, 30-65 chars where practical",
  "slug": "lowercase-hyphen-slug",
  "excerpt": "1-2 sentence plain-text summary",
  "seoTitle": "30-65 chars, no clickbait",
  "seoDescription": "110-175 chars, specific and honest",
  "sourceNotes": "verification notes for the human editor; no invented claims",
  "sources": [{"title":"only supplied source","url":"https://..."}],
  "internalLinks": [{"label":"anchor","href":"/allowed-path","reason":"why relevant"}],
  "schemaType": "Article"
}

Do not invent statistics, citations or source URLs. If no source was supplied, sources must be [].`;
  const parsed = await completeJson<unknown>(EDITORIAL_RULES, metadataPrompt, 900);
  const draft = sanitizeDraft(parsed);
  draft.contentHtml = contentHtml;
  if (!draft.title) draft.title = input.plan.title;
  if (!draft.slug) draft.slug = input.plan.slug;
  if (!draft.excerpt) draft.excerpt = input.research.summary?.slice(0, 300);
  if (!draft.seoTitle) draft.seoTitle = draft.title;
  if (!draft.seoDescription) draft.seoDescription = draft.excerpt;
  if (!draft.title || !draft.contentHtml) throw new Error("The AI did not return a complete article draft.");
  const allowed = new Set(input.sources.map((source) => source.url));
  draft.sources = (draft.sources ?? []).filter((source) => allowed.has(source.url));
  if (!input.sources.length) draft.sources = [];
  if (!draft.sourceNotes) draft.sourceNotes = input.research.competitorNotes ?? "";
  return draft;
}


export async function generateEditorialReview(input: {
  research: WorkflowResearch;
  plan: WorkflowPlan;
  draft: WorkflowDraft;
  localIssues: { severity: "critical" | "warning" | "info"; message: string; area?: string }[];
}): Promise<{ summary: string; issues: { severity: "critical" | "warning" | "info"; message: string; area?: string }[]; score: number }> {
  const user = `Review this draft as a careful SEO editor and factual-risk reviewer. Do not rewrite it.

TOPIC: ${input.plan.primaryKeyword ?? ""}
TITLE: ${input.draft.title ?? ""}
META: ${input.draft.seoDescription ?? ""}
OUTLINE: ${(input.plan.outline ?? []).map((item) => item.heading).join(" | ")}
DRAFT:
${(input.draft.contentHtml ?? "").replace(/<[^>]+>/g, " ").slice(0, 12_000)}

DETERMINISTIC CHECKS ALREADY FOUND:
${input.localIssues.map((issue) => `- [${issue.severity}] ${issue.message}`).join("\n") || "(none)"}

Return JSON:
{
  "summary": "2-3 sentence editorial assessment",
  "score": 0-100,
  "issues": [{"severity":"critical|warning|info","area":"seo|accuracy|structure|links|sources|tone","message":"specific actionable issue"}]
}

Be critical but practical. Never invent a fact to resolve uncertainty. Flag unsupported statistics, citations, payer rules, guarantees, duplicate intent against the supplied title, missing sources and weak internal linking.`;
  const parsed = await completeJson<{ summary?: unknown; score?: unknown; issues?: unknown }>(EDITORIAL_RULES, user, 1200);
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const message = typeof row.message === "string" ? row.message.trim().slice(0, 500) : "";
      if (!message) return [];
      const severity = row.severity === "critical" || row.severity === "warning" ? row.severity : "info";
      return [{ severity: severity as "critical" | "warning" | "info", area: typeof row.area === "string" ? row.area.slice(0, 40) : undefined, message }];
    }).slice(0, 20)
    : [];
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 1000) : "AI-assisted review completed.",
    score,
    issues,
  };
}
