import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Server-side rich-text policy for blog content.
 *
 * The editor is client-side and therefore untrusted: every write path runs the
 * submitted HTML through this module before it is stored, and the public render
 * path runs it again before output. The allow-list is deliberately narrow —
 * structural text elements, tables, figures, safe links and a small set of
 * privacy-respecting embed hosts. Scripts, styles, event handlers, data: URLs and
 * arbitrary iframes can never survive it.
 */

const EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
];

function headingId(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "section";
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function textOf(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

/** Give every H2–H4 a stable, unique id so the article can build a table of contents. */
function ensureHeadingIds(html: string): string {
  const used = new Set<string>();
  return html.replace(/<h([234])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level: string, attrs: string, inner: string) => {
    const text = textOf(inner);
    if (!text) return full;
    const id = headingId(text, used);
    const cleaned = attrs.replace(/\s*id="[^"]*"/i, "");
    return `<h${level}${cleaned} id="${id}">${inner}</h${level}>`;
  });
}

/** Sanitize stored/rendered article HTML. Safe to call more than once. */
export function sanitizeBlogHtml(dirty: string): string {
  const clean = sanitizeHtml(dirty ?? "", {
    allowedTags: [
      "h2", "h3", "h4",
      "p", "br", "hr",
      "strong", "b", "em", "i", "u", "s", "strike", "del", "span", "sub", "sup",
      "ul", "ol", "li",
      "blockquote",
      "a",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
      "img", "figure", "figcaption",
      "code", "pre",
      "iframe",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      "*": ["id"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame) => {
      if (frame.tag !== "iframe") return false;
      const src = String(frame.attribs?.src ?? "");
      try {
        const url = new URL(src);
        return !(EMBED_HOSTS.includes(url.hostname) && url.protocol === "https:");
      } catch {
        return true;
      }
    },
    transformTags: {
      // The page template renders the post title as the document H1, so body H1s
      // are demoted rather than leaving two competing top-level headings.
      h1: (tagName, attribs) => ({ tagName: "h2", attribs }),
      a: (tagName, attribs) => {
        const href = String(attribs.href ?? "");
        const external = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}),
          },
        };
      },
    },
  }).trim();
  return ensureHeadingIds(clean);
}

export interface BlogHeading {
  id: string;
  text: string;
  level: 2 | 3 | 4;
}

/** Extract a table of contents from sanitized article HTML. */
export function extractHeadings(html: string): BlogHeading[] {
  const headings: BlogHeading[] = [];
  const pattern = /<h([234])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const level = Number(match[1]) as 2 | 3 | 4;
    const text = textOf(match[3]);
    if (text) headings.push({ id: match[2], text, level });
  }
  return headings;
}

/** Plain text of the article, used for search snippets and word counts. */
export function articlePlainText(html: string): string {
  return textOf(html);
}

/** Reading time with a 200 words/minute reading speed (minimum one minute). */
export function estimateReadingTime(html: string): number {
  const words = articlePlainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
