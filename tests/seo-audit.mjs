/**
 * Technical SEO crawler for the Knight Medical Billing site.
 *
 * Crawls the sitemap plus internal links, then reports real problems only:
 * status codes, redirect chains, missing/duplicate titles and descriptions,
 * canonical issues, noindex leaks, missing alt text, broken images and
 * internal links, invalid JSON-LD, and basic headings/lang/viewport checks.
 *
 *   BASE_URL=http://127.0.0.1:3000 node tests/seo-audit.mjs
 * Writes a JSON report to /tmp/seo-audit.json and prints a summary.
 */
import { writeFile } from 'node:fs/promises'

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 90)
const origin = new URL(BASE).origin
const seen = new Set()
const queue = []
const pages = new Map()
const linkTargets = new Map() // url -> Set(referrers)
const imageTargets = new Map()

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const strip = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')); return m ? decode(m[2] ?? m[3] ?? '') : null }

function parsePage(url, html) {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleTag ? strip(titleTag[1]) : null
  const descTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)
  const description = descTag ? attr(descTag[0], 'content') : null
  const canonicalTag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)
  const canonical = canonicalTag ? attr(canonicalTag[0], 'href') : null
  const robotsTag = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i)
  const robots = robotsTag ? (attr(robotsTag[0], 'content') ?? '') : ''
  const lang = (html.match(/<html[^>]*lang=["']([^"']+)["']/i) ?? [])[1] ?? null
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html)
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1]))
  const jsonLd = []
  const jsonLdErrors = []
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { jsonLd.push(JSON.parse(m[1])) } catch { jsonLdErrors.push(m[1].slice(0, 120)) }
  }
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({ alt: attr(m[0], 'alt'), src: attr(m[0], 'src'), tag: m[0] }))
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: decode(m[1]), text: strip(m[2]) }))
    .filter((l) => !/^(mailto:|tel:|#|javascript:)/i.test(l.href))
  return { url, title, description, canonical, robots, lang, viewport, h1s, jsonLd, jsonLdErrors, images, links }
}

async function fetchPage(url) {
  let current = url
  const chain = []
  for (let hop = 0; hop < 6; hop += 1) {
    const res = await fetch(current, { redirect: 'manual', headers: { 'user-agent': 'KMB-SEO-Audit/1.0' } })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      chain.push({ from: current, status: res.status, to: location })
      current = new URL(location, current).toString()
      continue
    }
    const html = (res.headers.get('content-type') ?? '').includes('text/html') ? await res.text() : ''
    return { status: res.status, chain, finalUrl: current, html, contentType: res.headers.get('content-type') ?? '' }
  }
  return { status: 599, chain, finalUrl: current, html: '', contentType: '' }
}

// Seed from the sitemap.
const sitemapRes = await fetch(`${BASE}/sitemap.xml`)
const sitemapXml = sitemapRes.ok ? await sitemapRes.text() : ''
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
for (const url of sitemapUrls) {
  const path = new URL(url).pathname
  if (!seen.has(path)) { seen.add(path); queue.push(path) }
}
for (const extra of ['/', '/blog?q=medical', '/nonexistent-page', '/admin/login', '/admin/blog']) {
  const path = new URL(extra, BASE).pathname + (extra.includes('?') ? '?' + extra.split('?')[1] : '')
  if (!seen.has(path)) { seen.add(path); queue.push(path) }
}

while (queue.length && pages.size < MAX_PAGES) {
  const path = queue.shift()
  const url = path.startsWith('http') ? path : `${origin}${path}`
  const result = await fetchPage(url)
  const record = { path, status: result.status, chain: result.chain, finalUrl: new URL(result.finalUrl).pathname + new URL(result.finalUrl).search, contentType: result.contentType }
  if (result.html) {
    Object.assign(record, parsePage(url, result.html))
    for (const link of record.links) {
      try {
        const resolved = new URL(link.href, url)
        if (resolved.origin !== origin) continue
        const target = resolved.pathname + resolved.search
        if (!linkTargets.has(target)) linkTargets.set(target, new Set())
        linkTargets.get(target).add(path)
        if (!seen.has(target) && !/^\/(admin|api)(\/|$)/.test(target)) { seen.add(target); queue.push(target) }
      } catch {}
    }
    for (const img of record.images) {
      if (!img.src || img.src.startsWith('data:')) continue
      try {
        const resolved = new URL(img.src, url)
        if (resolved.origin !== origin) continue
        imageTargets.set(resolved.pathname, { src: img.src, alt: img.alt, page: path })
      } catch {}
    }
  }
  pages.set(path, record)
}

const brokenLinks = []
for (const [target, referrers] of linkTargets) {
  if (target.startsWith('/_next/')) continue
  const res = await fetch(origin + target, { redirect: 'manual' }).catch(() => null)
  const status = res ? res.status : 599
  if (status >= 400) brokenLinks.push({ target, status, referrers: [...referrers].slice(0, 4) })
}
const brokenImages = []
for (const [path, meta] of imageTargets) {
  const res = await fetch(origin + meta.src, { redirect: 'manual' }).catch(() => null)
  const status = res ? res.status : 599
  if (!res || status >= 400) brokenImages.push({ ...meta, status })
}

const records = [...pages.values()]
const dup = (key) => {
  const map = new Map()
  for (const r of records) {
    const value = r[key]
    if (!value) continue
    const list = map.get(value) ?? []
    list.push(r.path)
    map.set(value, list)
  }
  return [...map.entries()].filter(([, list]) => list.length > 1)
}

const publicPages = records.filter((r) => r.status === 200 && Array.isArray(r.images) && r.chain.length === 0 && (r.contentType ?? '').includes('text/html') && !/^\/(admin|api)(\/|$)/.test(r.path) && !r.path.includes('?'))
const report = {
  base: BASE,
  crawledAt: new Date().toISOString(),
  sitemap: { status: sitemapRes.status, urlCount: sitemapUrls.length, urls: sitemapUrls },
  summary: {
    crawled: records.length,
    ok: records.filter((r) => r.status === 200).length,
    redirects: records.filter((r) => r.chain.length > 0).length,
    errors: records.filter((r) => r.status >= 400).length,
    brokenLinks: brokenLinks.length,
    brokenImages: brokenImages.length,
  },
  duplicateTitles: dup('title'),
  duplicateDescriptions: dup('description'),
  duplicateCanonicals: dup('canonical'),
  problems: {
    missingTitle: publicPages.filter((r) => !r.title).map((r) => r.path),
    missingDescription: publicPages.filter((r) => !r.description).map((r) => r.path),
    missingCanonical: publicPages.filter((r) => !r.canonical).map((r) => r.path),
    canonicalMismatch: publicPages.filter((r) => r.canonical && new URL(r.canonical).pathname !== r.path.split('?')[0]).map((r) => ({ path: r.path, canonical: r.canonical })),
    noindexPublic: publicPages.filter((r) => /noindex/i.test(r.robots)).map((r) => ({ path: r.path, robots: r.robots })),
    missingAlt: publicPages.flatMap((r) => r.images.filter((i) => i.alt === null).map((i) => ({ path: r.path, src: i.src }))),
    emptyAltCount: publicPages.flatMap((r) => r.images.filter((i) => i.alt === '').map((i) => ({ path: r.path, src: i.src }))),
    duplicateAltText: (() => {
      const issues = []
      for (const r of publicPages) {
        const counts = new Map()
        for (const i of r.images) {
          if (!i.alt) continue
          counts.set(i.alt, (counts.get(i.alt) ?? 0) + 1)
        }
        for (const [alt, count] of counts) if (count > 1) issues.push({ path: r.path, alt, count })
      }
      return issues.slice(0, 12)
    })(),
    schemaIssues: (() => {
      const issues = []
      const need = {
        ProfessionalService: ["name", "url"],
        Organization: ["name", "url"],
        WebSite: ["name", "url"],
        Service: ["name", "provider"],
        BreadcrumbList: ["itemListElement"],
        FAQPage: ["mainEntity"],
        Article: ["headline", "datePublished", "author"],
      }
      for (const r of publicPages) {
        const walk = (node) => {
          if (!node || typeof node !== "object") return
          if (Array.isArray(node)) { node.forEach(walk); return }
          const type = node["@type"]
          const fields = typeof type === "string" ? need[type] : undefined
          if (fields) {
            for (const field of fields) if (node[field] === undefined || node[field] === null) issues.push({ path: r.path, type, missing: field })
          }
          for (const value of Object.values(node)) walk(value)
        }
        r.jsonLd.forEach(walk)
      }
      return issues.slice(0, 30)
    })(),
    linksToRedirects: (() => {
      const redirects = []
      for (const rec of records) if (rec.chain.length) redirects.push({ path: rec.path, status: rec.chain[0].status, to: rec.chain[0].to })
      return redirects
    })(),
    invalidJsonLd: publicPages.flatMap((r) => r.jsonLdErrors.map((e) => ({ path: r.path, error: e }))),
    missingJsonLd: publicPages.filter((r) => r.jsonLd.length === 0).map((r) => r.path),
    h1Problems: publicPages.filter((r) => r.h1s.length !== 1).map((r) => ({ path: r.path, h1Count: r.h1s.length, h1s: r.h1s.slice(0, 2) })),
    missingLang: publicPages.filter((r) => !r.lang).map((r) => r.path),
    missingViewport: publicPages.filter((r) => !r.viewport).map((r) => r.path),
    noindexPages: records.filter((r) => /noindex/i.test(r.robots)).map((r) => ({ path: r.path, robots: r.robots })),
    redirectChains: records.filter((r) => r.chain.length > 1).map((r) => ({ path: r.path, chain: r.chain })),
  },
  brokenLinks,
  brokenImages,
}
await writeFile('/tmp/seo-audit.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.summary, null, 2))
for (const [key, value] of Object.entries(report.problems)) {
  if (Array.isArray(value) && value.length) console.log(`${key}: ${value.length}`, JSON.stringify(value.slice(0, 5)))
}
for (const [key, value] of Object.entries({ duplicateTitles: report.duplicateTitles, duplicateDescriptions: report.duplicateDescriptions, duplicateCanonicals: report.duplicateCanonicals, brokenLinks: report.brokenLinks, brokenImages: report.brokenImages })) {
  if (value.length) console.log(`${key}: ${value.length}`, JSON.stringify(value.slice(0, 4)))
}
