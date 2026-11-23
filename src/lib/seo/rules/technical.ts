import { canonicaliseUrl, type Observation, type Severity } from "../observations";

/**
 * Deterministic technical checks (Phase 6, P6.0).
 *
 * Definitions adapted from the vetted `JeffLi1993/seo-audit-skill` check list
 * (MIT) and reimplemented in TypeScript. No Python runtime is used and no
 * third-party code executes here.
 *
 * Every rule is mechanical: given the same HTML it must produce the same
 * observation. Nothing in this module scores, guesses, or calls an AI provider.
 */

export interface PageSnapshot {
  url: string;
  /** Final HTTP status after redirects. */
  status: number;
  finalUrl: string;
  /** Full chain, starting with the requested URL; length 1 = no redirect. */
  redirectChain: string[];
  html: string;
  /** Optional: value of the x-robots-tag header, when present and captured. */
  xRobotsTag?: string | null;
}

export interface RuleContext {
  canonicalOrigin: string;
  observedAt?: string;
  provenance?: string;
}

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META_RE = /<meta\b[^>]*>/gi;
const ATTR_RE = (name: string, tag: string): string | null => {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  return match ? (match[2] ?? match[3] ?? match[4] ?? "").trim() : null;
};
const LINK_RE = /<link\b[^>]*>/gi;
const IMG_RE = /<img\b[^>]*>/gi;
const H1_RE = /<h1\b[^>]*>/gi;
const JSONLD_RE = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const stripTags = (value: string): string => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function readTitle(html: string): string | null {
  const match = html.match(TITLE_RE);
  return match ? decodeEntities(stripTags(match[1])) : null;
}

export function readMetaDescription(html: string): string | null {
  const tags = html.match(META_RE) ?? [];
  for (const tag of tags) {
    const name = (ATTR_RE("name", tag) ?? "").toLowerCase();
    if (name === "description") {
      const content = ATTR_RE("content", tag);
      return content === null ? null : decodeEntities(content);
    }
  }
  return null;
}

export function readCanonical(html: string): string | null {
  const tags = html.match(LINK_RE) ?? [];
  for (const tag of tags) {
    const rel = (ATTR_RE("rel", tag) ?? "").toLowerCase();
    if (rel.split(/\s+/).includes("canonical")) {
      const href = ATTR_RE("href", tag);
      if (href) return href;
    }
  }
  return null;
}

export function readRobotsDirective(html: string): string {
  const tags = html.match(META_RE) ?? [];
  for (const tag of tags) {
    const name = (ATTR_RE("name", tag) ?? "").toLowerCase();
    if (name === "robots") return (ATTR_RE("content", tag) ?? "").toLowerCase();
  }
  return "";
}

export function countH1(html: string): number {
  return (html.match(H1_RE) ?? []).length;
}

/**
 * Images with no `alt` attribute at all.
 *
 * `alt=""` is the correct, WCAG-conformant marker for a decorative image: the
 * attribute is present, so assistive technology skips the image. Treating an
 * empty `alt` as "missing" flagged every shared logo, background photograph and
 * card thumbnail on every page, which produced a false positive on the whole
 * public site. Only a genuinely absent attribute is a defect.
 */
export function imagesMissingAlt(html: string): number {
  const images = html.match(IMG_RE) ?? [];
  return images.filter((tag) => ATTR_RE("alt", tag) === null).length;
}

/** Decorative images declared correctly (`alt=""`). Reported as evidence only. */
export function decorativeImageCount(html: string): number {
  const images = html.match(IMG_RE) ?? [];
  return images.filter((tag) => ATTR_RE("alt", tag) === "").length;
}

export interface SchemaSummary {
  blocks: number;
  invalid: number;
  types: string[];
}

export function inspectJsonLd(html: string): SchemaSummary {
  const summary: SchemaSummary = { blocks: 0, invalid: 0, types: [] };
  for (const match of html.matchAll(JSONLD_RE)) {
    summary.blocks += 1;
    try {
      const parsed = JSON.parse(match[1].trim());
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        const graph = (node as { "@graph"?: unknown })?.["@graph"];
        const candidates = Array.isArray(graph) ? graph : [node];
        for (const item of candidates) {
          const type = (item as { "@type"?: unknown })?.["@type"];
          for (const value of Array.isArray(type) ? type : [type]) {
            if (typeof value === "string" && !summary.types.includes(value)) summary.types.push(value);
          }
        }
      }
    } catch {
      summary.invalid += 1;
    }
  }
  return summary;
}

type RuleObservation = Omit<Observation, "observedAt" | "source" | "subjectType"> & {
  severity: Severity;
  subjectType?: Observation["subjectType"];
};

function observation(partial: RuleObservation, context: RuleContext): Observation {
  const subjectKey = canonicaliseUrl(partial.subjectKey, context.canonicalOrigin);
  return {
    source: "rules",
    observedAt: context.observedAt ?? new Date().toISOString(),
    provenance: context.provenance ?? "crawl",
    ...partial,
    subjectType: partial.subjectType ?? "url",
    subjectKey,
  };
}

/**
 * Run every technical rule against one page snapshot.
 * Findings are *observations* here; consolidation into findings happens later.
 */
export function technicalObservations(page: PageSnapshot, context: RuleContext): Observation[] {
  const out: Observation[] = [];
  const url = canonicaliseUrl(page.url, context.canonicalOrigin);
  const push = (obs: Parameters<typeof observation>[0]) => out.push(observation(obs, context));

  if (page.status >= 400) {
    push({
      checkId: "http_error_status",
      subjectKey: url,
      severity: page.status >= 500 ? "critical" : "high",
      metrics: { status: page.status },
      evidence: { finalUrl: page.finalUrl },
    });
  }

  const chain = page.redirectChain.filter(Boolean);
  if (chain.length > 1) {
    push({
      checkId: "http_redirect_chain",
      subjectKey: url,
      severity: chain.length >= 3 ? "medium" : "low",
      metrics: { hops: chain.length },
      evidence: { chain: chain.slice(0, 6) },
    });
  }

  const canonical = readCanonical(page.html);
  const finalUrl = canonicaliseUrl(page.finalUrl || page.url, context.canonicalOrigin);
  if (!canonical) {
    push({ checkId: "canonical_missing", subjectKey: url, severity: "medium", evidence: { finalUrl } });
  } else {
    const resolved = canonicaliseUrl(canonical, context.canonicalOrigin);
    if (resolved !== finalUrl) {
      push({
        checkId: "canonical_mismatch",
        subjectKey: url,
        severity: "high",
        metrics: { canonical: resolved, finalUrl },
      });
    }
  }

  const robots = `${readRobotsDirective(page.html)} ${(page.xRobotsTag ?? "").toLowerCase()}`.trim();
  if (/\bnoindex\b/.test(robots)) {
    push({ checkId: "robots_noindex", subjectKey: url, severity: "critical", evidence: { directive: robots } });
  }

  const title = readTitle(page.html);
  if (!title) {
    push({ checkId: "title_missing", subjectKey: url, severity: "critical" });
  } else if (title.length > 60 || title.length < 25) {
    push({
      checkId: "title_length_out_of_range",
      subjectKey: url,
      severity: title.length > 70 || title.length < 15 ? "high" : "medium",
      metrics: { length: title.length },
      evidence: { title },
    });
  }

  const description = readMetaDescription(page.html);
  if (!description) {
    push({ checkId: "meta_description_missing", subjectKey: url, severity: "medium" });
  } else if (description.length > 160 || description.length < 70) {
    push({
      checkId: "meta_description_length_out_of_range",
      subjectKey: url,
      severity: "low",
      metrics: { length: description.length },
    });
  }

  const h1Count = countH1(page.html);
  if (h1Count === 0) push({ checkId: "h1_missing", subjectKey: url, severity: "high" });
  if (h1Count > 1) push({ checkId: "h1_multiple", subjectKey: url, severity: "medium", metrics: { h1Count } });

  const altless = imagesMissingAlt(page.html);
  if (altless > 0) {
    push({
      checkId: "image_alt_missing",
      subjectKey: url,
      severity: "medium",
      metrics: { images: altless, decorativeWithEmptyAlt: decorativeImageCount(page.html) },
    });
  }

  const schema = inspectJsonLd(page.html);
  if (schema.invalid > 0) {
    push({ checkId: "schema_invalid_json", subjectKey: url, severity: "high", metrics: { blocks: schema.blocks, invalid: schema.invalid } });
  }
  if (schema.blocks > 0 && schema.types.length === 0) {
    push({ checkId: "schema_missing_type", subjectKey: url, severity: "medium", metrics: { blocks: schema.blocks } });
  }

  return out;
}
