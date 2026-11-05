/**
 * Article typography for blog HTML rendered with dangerouslySetInnerHTML.
 *
 * The blog body is sanitized HTML, so Tailwind utility classes cannot be
 * applied to its children; a scoped style block is the reliable way to style
 * headings, lists, tables, figures, code and embeds while keeping the same
 * brand language as `.prose-knight`.
 */
const BLOG_PROSE_CSS = `
.blog-prose {
  color: #33505f;
  font-size: 1.0625rem;
  line-height: 1.85;
  overflow-wrap: break-word;
}

.blog-prose > :first-child { margin-top: 0; }
.blog-prose > :last-child { margin-bottom: 0; }

.blog-prose h2,
.blog-prose h3,
.blog-prose h4 {
  color: var(--color-ink-900);
  font-weight: 800;
  letter-spacing: -0.02em;
  scroll-margin-top: 6.5rem;
}

.blog-prose h2 {
  font-size: 1.65rem;
  line-height: 1.22;
  margin-top: 2.6rem;
  margin-bottom: 0.85rem;
}

.blog-prose h3 {
  font-size: 1.22rem;
  line-height: 1.3;
  margin-top: 2rem;
  margin-bottom: 0.6rem;
}

.blog-prose h4 {
  font-size: 1.05rem;
  line-height: 1.35;
  margin-top: 1.6rem;
  margin-bottom: 0.5rem;
}

.blog-prose p { margin-bottom: 1.15rem; }

.blog-prose strong, .blog-prose b { color: var(--color-ink-900); font-weight: 800; }

.blog-prose a {
  color: var(--color-brand-700);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: color 0.2s ease;
}
.blog-prose a:hover { color: var(--color-brand-500); }

.blog-prose ul,
.blog-prose ol {
  margin: 0 0 1.35rem;
  padding-left: 1.4rem;
  display: grid;
  gap: 0.55rem;
}

.blog-prose ul { list-style: none; padding-left: 0; }

.blog-prose ul > li { position: relative; padding-left: 1.55rem; }

.blog-prose ul > li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.66em;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--color-brand-400);
}

.blog-prose ol > li::marker { color: var(--color-brand-600); font-weight: 700; }

.blog-prose blockquote {
  margin: 1.75rem 0;
  padding: 1rem 1.25rem;
  border-left: 3px solid var(--color-brand-400);
  border-radius: 0 1rem 1rem 0;
  background: var(--color-mist-50);
  color: var(--color-ink-800);
  font-style: italic;
}
.blog-prose blockquote p:last-child { margin-bottom: 0; }

.blog-prose hr {
  margin: 2.25rem 0;
  border: 0;
  border-top: 1px solid var(--color-mist-200);
}

.blog-prose code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: var(--color-mist-100);
  border: 1px solid var(--color-mist-200);
  border-radius: 0.4rem;
  padding: 0.15em 0.4em;
}

.blog-prose pre {
  margin: 1.5rem 0;
  padding: 1rem 1.15rem;
  border-radius: 1rem;
  background: var(--color-ink-950);
  color: #e8f4fa;
  overflow-x: auto;
  font-size: 0.86rem;
  line-height: 1.7;
}
.blog-prose pre code { background: transparent; border: 0; padding: 0; color: inherit; font-size: inherit; }

.blog-prose img {
  max-width: 100%;
  height: auto;
  border-radius: 1rem;
}

.blog-prose figure { margin: 1.85rem 0; }
.blog-prose figcaption {
  margin-top: 0.65rem;
  text-align: center;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #5c7482;
}

.blog-prose table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  margin: 1.6rem 0;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.blog-prose th,
.blog-prose td {
  border: 1px solid var(--color-mist-200);
  padding: 0.55rem 0.75rem;
  text-align: left;
  vertical-align: top;
}
.blog-prose th { background: var(--color-mist-50); color: var(--color-ink-900); font-weight: 800; }
.blog-prose tbody tr:nth-child(even) td { background: var(--color-mist-50); }

.blog-prose iframe {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  margin: 1.75rem 0;
  border: 0;
  border-radius: 1rem;
  background: var(--color-ink-950);
}

@media print {
  .blog-prose { color: #000; font-size: 11.5pt; line-height: 1.6; }
  .blog-prose h2, .blog-prose h3, .blog-prose h4, .blog-prose strong, .blog-prose b { color: #000; }
  .blog-prose a { color: #000; text-decoration: underline; }
  .blog-prose blockquote, .blog-prose tbody tr:nth-child(even) td { background: transparent; }
  .blog-prose pre { background: #f2f2f2; color: #000; }
  .blog-prose a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; word-break: break-all; }
  .blog-prose a[href^="#"]::after, .blog-prose a[href^="/"]::after { content: ""; }
  .blog-prose iframe { display: none; }
}
`;

export function BlogProseStyles() {
  return <style dangerouslySetInnerHTML={{ __html: BLOG_PROSE_CSS }} />;
}
