/**
 * End-to-end verification for the blog CMS.
 *
 * Requires a running server and the admin password in the environment:
 *   BASE_URL=http://127.0.0.1:3000 ADMIN_PW=... node tests/blog.e2e.mjs
 * Creates temporary fixtures (post, category, tag, imported image) and removes
 * the posts/taxonomy at the end so no sample content is left behind.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const PW = process.env.ADMIN_PW
const OUT = process.env.SHOT_DIR ?? '/tmp/blog-e2e'
if (!PW) { console.error('ADMIN_PW is required'); process.exit(2) }

const log = (...a) => console.log(...a)
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const page = await ctx.newPage()
let pass = 0, fail = 0
const ok = (name, condition, extra = '') => { if (condition) { pass++; log('PASS', name) } else { fail++; log('FAIL', name, extra) } }
const waitForText = async (needle, timeoutMs = 12000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const text = await page.locator('body').innerText().catch(() => '')
    if (text.includes(needle)) return true
    await page.waitForTimeout(400)
  }
  return false
}
const api = async (method, path, data) => {
  const res = await ctx.request.fetch(BASE + path, { method, data })
  let body = null
  try { body = await res.json() } catch {}
  return { status: res.status(), body }
}

await page.goto(BASE + '/admin/login', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="password"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')])
await page.waitForTimeout(600)

let res = await api('POST', '/api/admin/blog/categories', { name: 'Billing Operations', description: 'Claims and revenue operations.' })
const catId = res.body.id
res = await api('POST', '/api/admin/blog/tags', { name: 'Clean Claims' })
const tagId = res.body.id
res = await api('POST', '/api/admin/blog/media', { url: 'https://images.pexels.com/photos/11288653/pexels-photo-11288653.jpeg?auto=compress&cs=tinysrgb&w=1600', alt: 'Modern hospital corridor', license: 'Pexels License', attribution: 'Jo McNamara' })
const media = res.body.media
const content = '<h2>Why clean claims matter</h2><p>Accuracy before submission protects revenue.</p><h3>Eligibility first</h3><ul><li>Verify coverage</li></ul><blockquote>Front-end accuracy beats back-end rework.</blockquote><table><tbody><tr><td>Acceptance</td><td>99.9%</td></tr></tbody></table>'
res = await api('POST', '/api/admin/blog/posts', { title: 'A Practical Guide to Clean Claims', slug: 'clean-claims-test-guide', excerpt: 'How clean claim construction protects revenue.', contentHtml: content, featuredImage: media.src, featuredImageAlt: 'Modern hospital corridor', featuredImageWidth: media.width, featuredImageHeight: media.height, featuredMediaId: media.id, status: 'published', categoryId: catId, tagIds: [tagId], seoTitle: 'Clean Claims Guide', seoDescription: 'A practical guide to clean claims.' })
const id = res.body.id

// UI create through the editor
await page.goto(BASE + '/admin/blog/new', { waitUntil: 'domcontentloaded' })
ok('new editor hydrated', await waitForText('Save draft'))
await page.locator('input:not([type="hidden"])').first().fill('UI Created Draft')
await page.locator('[contenteditable="true"]').first().click()
await page.keyboard.type('Draft body text for the UI test.')
await page.getByRole('button', { name: /^save draft/i }).click().catch(async () => { await page.getByRole('button', { name: /^save/i }).first().click() })
await page.waitForTimeout(2500)
const createdInUi = /\/admin\/blog\/\d+/.test(page.url())
ok('UI save creates post and opens editor', createdInUi, page.url())
let uiId = null
if (createdInUi) {
  uiId = Number(page.url().split('/').pop())
  const fetched = await api('GET', `/api/admin/blog/posts/${uiId}`)
  ok('UI draft persisted', fetched.body?.post?.title === 'UI Created Draft')
}

await page.goto(BASE + `/admin/blog/${id}`, { waitUntil: 'domcontentloaded' })
await waitForText('A Practical Guide to Clean Claims')
const editorText = await page.locator('body').innerText()
const titleValue = await page.locator('input:not([type="hidden"])').first().inputValue().catch(() => '')
ok('editor loads existing post', titleValue.includes('A Practical Guide to Clean Claims') && /Publish/i.test(editorText), JSON.stringify({ titleValue, hasPublish: /Publish/i.test(editorText) }))
ok('autosave status visible', /Saved|Unsaved|Saving/.test(editorText))
await page.screenshot({ path: `${OUT}/admin-editor.png` }).catch(() => {})
await page.goto(BASE + '/admin/blog', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
ok('dashboard lists posts', (await page.locator('body').innerText()).includes('A Practical Guide to Clean Claims'))
await page.screenshot({ path: `${OUT}/admin-dashboard.png` }).catch(() => {})

res = await page.goto(BASE + `/admin/blog/preview/${id}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
ok('admin preview renders', res.status() === 200 && (await page.locator('body').innerText()).includes('Eligibility first'))

res = await page.goto(BASE + '/blog', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
ok('blog listing shows post', res.status() === 200 && (await page.locator('body').innerText()).includes('A Practical Guide to Clean Claims'))
await page.screenshot({ path: `${OUT}/blog-listing.png` }).catch(() => {})

res = await page.goto(BASE + '/blog/clean-claims-test-guide', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
ok('article 200', res.status() === 200)
ok('article body and table', (await page.locator('.blog-prose').innerText()).includes('Eligibility first') && (await page.locator('.blog-prose table').count()) > 0)
const meta = await page.evaluate(() => ({
  c: document.querySelector('link[rel=canonical]')?.getAttribute('href'),
  og: document.querySelector('meta[property="og:type"]')?.getAttribute('content'),
  ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join(' '),
}))
ok('canonical and og:type article', String(meta.c).endsWith('/blog/clean-claims-test-guide') && meta.og === 'article', JSON.stringify({ c: meta.c, og: meta.og }))
ok('Article + Breadcrumb JSON-LD', /"@type":\s*"Article"/.test(meta.ld) && meta.ld.includes('BreadcrumbList'))
await page.screenshot({ path: `${OUT}/blog-article.png` }).catch(() => {})

res = await page.goto(BASE + '/blog/category/billing-operations', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
ok('category archive', res.status() === 200 && (await page.locator('body').innerText()).includes('A Practical Guide'))
res = await page.goto(BASE + '/blog/tag/clean-claims', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
ok('tag archive', res.status() === 200)
res = await page.goto(BASE + '/blog?q=eligibility', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
ok('search results', res.status() === 200 && (await page.locator('body').innerText()).includes('A Practical Guide'))
ok('search noindex', /noindex/i.test(await page.evaluate(() => document.querySelector('meta[name=robots]')?.getAttribute('content') || '')))
const sitemap = await (await ctx.request.get(BASE + '/sitemap.xml')).text()
ok('sitemap includes blog and post', sitemap.includes('/blog</loc>') && sitemap.includes('/blog/clean-claims-test-guide'))
ok('unknown article 404', (await ctx.request.get(BASE + '/blog/nope')).status() === 404)
const anon = await browser.newContext()
ok('anonymous admin access redirects', (await anon.request.get(BASE + '/admin/blog', { maxRedirects: 0 })).status() === 307)
await anon.close()

await api('PATCH', `/api/admin/blog/posts/${id}`, { slug: 'clean-claims-test-guide-renamed' })
await page.goto(BASE + '/blog/clean-claims-test-guide', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
ok('old slug redirects', page.url().endsWith('clean-claims-test-guide-renamed'), page.url())
await api('POST', `/api/admin/blog/posts/${id}/actions`, { action: 'unpublish' })
ok('unpublished article 404', (await ctx.request.get(BASE + '/blog/clean-claims-test-guide-renamed')).status() === 404)
await page.goto(BASE + '/blog', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
ok('unpublished hidden from listing', !(await page.locator('body').innerText()).includes('A Practical Guide'))

res = await api('POST', '/api/admin/blog/posts', { title: 'Scheduled Test Article', contentHtml: '<p>scheduled</p>', status: 'scheduled', scheduledFor: new Date(Date.now() + 3600000).toISOString() })
const sid = res.body.id
await page.goto(BASE + '/blog', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
ok('future scheduled hidden', !(await page.locator('body').innerText()).includes('Scheduled Test Article'))
await api('POST', `/api/admin/blog/posts/${sid}/actions`, { action: 'schedule', scheduledFor: new Date(Date.now() - 60000).toISOString() })
await page.goto(BASE + '/blog', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
ok('past schedule publishes immediately', (await page.locator('body').innerText()).includes('Scheduled Test Article'))

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mp = await mobile.newPage()
res = await mp.goto(BASE + '/blog', { waitUntil: 'domcontentloaded' })
await mp.waitForTimeout(700)
await mp.screenshot({ path: `${OUT}/blog-mobile.png` }).catch(() => {})
ok('mobile blog renders without overflow', res.status() === 200 && !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)))
await mobile.close()

if (uiId) await api('DELETE', `/api/admin/blog/posts/${uiId}?permanent=1`)
await api('DELETE', `/api/admin/blog/posts/${id}?permanent=1`)
await api('DELETE', `/api/admin/blog/posts/${sid}?permanent=1`)
await api('DELETE', `/api/admin/blog/categories/${catId}`)
await api('DELETE', `/api/admin/blog/tags/${tagId}`)

log(`RESULT pass=${pass} fail=${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
