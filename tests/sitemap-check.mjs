/**
 * Validates sitemap.xml and robots.txt against the live site: every URL must
 * return 200, be indexable and canonical to itself, and must not be an admin,
 * API, query-param or redirect URL. Also checks that robots.txt advertises the
 * sitemap and blocks admin/API paths.
 *
 *   BASE_URL=http://127.0.0.1:3100 node tests/sitemap-check.mjs
 */
const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '')
const origin = new URL(BASE).origin
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text()
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const problems = []
const seen = new Set()
for (const url of urls) {
  const path = new URL(url).pathname + new URL(url).search
  if (seen.has(path)) problems.push({ url, issue: 'duplicate sitemap entry' })
  seen.add(path)
  if (/^\/(admin|api)(\/|$)/.test(path)) problems.push({ url, issue: 'admin/api URL in sitemap' })
  if (path.includes('?')) problems.push({ url, issue: 'query-param URL in sitemap' })
  const res = await fetch(origin + path, { redirect: 'manual' })
  if (res.status !== 200) { problems.push({ url, issue: `status ${res.status}` }); continue }
  const html = await res.text()
  if (/<meta[^>]+name="robots"[^>]*content="[^"]*noindex/i.test(html)) problems.push({ url, issue: 'noindex page in sitemap' })
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]+)"/) ?? [])[1]
  if (canonical && new URL(canonical).pathname !== new URL(url).pathname) problems.push({ url, issue: `canonical mismatch: ${canonical}` })
  if (!canonical) problems.push({ url, issue: 'missing canonical' })
}
const robots = await (await fetch(`${BASE}/robots.txt`)).text()
if (!/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/i.test(robots)) problems.push({ url: '/robots.txt', issue: 'missing Sitemap directive' })
if (!/Disallow:\s*\/admin/i.test(robots)) problems.push({ url: '/robots.txt', issue: 'admin not disallowed' })
if (!/Disallow:\s*\/api/i.test(robots)) problems.push({ url: '/robots.txt', issue: 'api not disallowed' })
console.log(JSON.stringify({ base: BASE, sitemapUrls: urls.length, robotsOk: !problems.some((p) => p.url === '/robots.txt'), problems }, null, 2))
process.exit(problems.length ? 1 : 0)
