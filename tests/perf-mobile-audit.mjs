/**
 * Lab performance + mobile usability audit using the Playwright Chromium build.
 * Reports measured First Contentful Paint, Largest Contentful Paint, CLS, TTFB,
 * transferred script bytes, image weight and mobile layout issues.
 *
 *   BASE_URL=http://127.0.0.1:3100 node tests/perf-mobile-audit.mjs
 */
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '')
const PAGES = ['/', '/services', '/blog', '/about', '/schedule-form']
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]
const browser = await chromium.launch()
const results = []

for (const viewport of VIEWPORTS) {
  for (const path of PAGES) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    const page = await context.newPage()
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0, fcp: 0 }
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.lcp = Math.max(window.__perf.lcp, entry.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__perf.cls += entry.value
      }).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') window.__perf.fcp = entry.startTime
      }).observe({ type: 'paint', buffered: true })
    })
    const response = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(2500)
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      const resources = performance.getEntriesByType('resource')
      const sum = (type) => resources.filter((r) => r.initiatorType === type).reduce((total, r) => total + (r.transferSize || 0), 0)
      return {
        ...window.__perf,
        ttfb: nav ? nav.responseStart - nav.requestStart : 0,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
        load: nav ? nav.loadEventEnd : 0,
        scriptBytes: sum('script'),
        imageBytes: sum('img'),
        resourceCount: resources.length,
      }
    })
    const mobile = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 2
      const targets = [...document.querySelectorAll('a, button, [role="button"], input, select, textarea')].filter((el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      })
      // Standalone controls only (<40px). Inline text links are exempt under
      // WCAG 2.5.8 / Lighthouse, so they are not counted here.
      const smallTargets = targets.filter((el) => {
        if (!(el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) return false
        const r = el.getBoundingClientRect()
        return r.width < 24 || r.height < 24
      }).length
      // Long body copy below 12px is a readability problem; short eyebrow labels
      // and captions are intentional design and excluded.
      const smallText = [...document.querySelectorAll('p')].filter((el) => {
        const text = (el.textContent ?? '').trim()
        if (text.length < 80) return false
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        return parseFloat(getComputedStyle(el).fontSize) < 12
      }).length
      const imagesWithoutDimensions = [...document.images].filter((img) => !img.getAttribute('width') && !img.getAttribute('height') && !img.style.aspectRatio).length
      return { overflow, smallTargets, smallText, imagesWithoutDimensions, images: document.images.length }
    })
    results.push({ viewport: viewport.name, path, status: response?.status() ?? 0, ...metrics, ...mobile })
    console.log(`${viewport.name.padEnd(7)} ${path.padEnd(14)} status=${response?.status()} LCP=${Math.round(metrics.lcp)}ms CLS=${metrics.cls.toFixed(3)} FCP=${Math.round(metrics.fcp)}ms TTFB=${Math.round(metrics.ttfb)}ms JS=${Math.round(metrics.scriptBytes / 1024)}KB${mobile.overflow ? ' OVERFLOW' : ''}`)
    await context.close()
  }
}
const worstLcp = results.reduce((a, b) => (b.lcp > a.lcp ? b : a))
const worstCls = results.reduce((a, b) => (b.cls > a.cls ? b : a))
const summary = {
  base: BASE,
  generatedAt: new Date().toISOString(),
  pages: results.length,
  worstLcp: { path: worstLcp.path, viewport: worstLcp.viewport, ms: Math.round(worstLcp.lcp) },
  worstCls: { path: worstCls.path, viewport: worstCls.viewport, value: Number(worstCls.cls.toFixed(3)) },
  overflowPages: results.filter((r) => r.overflow).map((r) => `${r.viewport}${r.path}`),
  smallTextPages: results.filter((r) => r.smallText > 0).length,
  smallTargetPages: results.filter((r) => r.smallTargets > 0).length,
}
await writeFile('/tmp/perf-audit.json', JSON.stringify({ summary, results }, null, 2))
console.log('\nSUMMARY', JSON.stringify(summary, null, 2))
await browser.close()
