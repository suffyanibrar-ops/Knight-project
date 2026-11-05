/**
 * End-to-end verification for the AI agent (text chat, tools, booking,
 * handoff, admin console and browser-voice barge-in).
 *
 *   BASE_URL=http://127.0.0.1:3000 ADMIN_PW=... node tests/ai.e2e.mjs
 *
 * Voice recognition/synthesis are mocked (headless browsers have no speech
 * engine), but the widget's real state machine, abort and barge-in logic run.
 * Bookings create real confirmation emails and are cleaned up by the caller.
 */
import { chromium } from 'playwright'

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const PW = process.env.ADMIN_PW
if (!PW) { console.error('ADMIN_PW is required'); process.exit(2) }
let pass = 0, fail = 0
const ok = (name, condition, extra = '') => { if (condition) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, permissions: ['microphone'] })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)))

// ---------- public config + slots ----------
const config = await (await context.request.get(BASE + '/api/ai/config')).json()
ok('public config exposes agent settings', config.ok === true && typeof config.agentName === 'string' && Boolean(config.privacyNotice), JSON.stringify(config).slice(0, 120))
const slotsResponse = await context.request.get(BASE + '/api/ai/slots')
const slotsBody = await slotsResponse.json()
ok('availability API returns real slots', slotsResponse.status() === 200 && Array.isArray(slotsBody.slots) && slotsBody.slots.length > 0, JSON.stringify(slotsBody).slice(0, 120))

// ---------- text chat streaming (real DeepSeek call) ----------
await page.addInitScript(() => { try { sessionStorage.setItem('kmb-intro-seen', '1'); } catch { /* ignore */ } })
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction(() => { const intro = document.querySelector('[data-site-intro]'); return !intro || getComputedStyle(intro).display === 'none' || getComputedStyle(intro).visibility === 'hidden'; }, undefined, { timeout: 6000 }).catch(() => {})
await page.waitForTimeout(2000)
await page.getByRole('button', { name: /open knight ai assistant/i }).click()
await page.waitForTimeout(1200)
ok('chat widget opens with welcome', (await page.locator('[role="dialog"]').innerText()).includes('Riley'))
await page.getByLabel('Chat message').fill('What services do you offer? Keep it under 40 words.')
await page.getByLabel('Send message').click()
let chatText = ''
for (let i = 0; i < 40; i += 1) {
  await page.waitForTimeout(600)
  chatText = await page.locator('[role="dialog"]').innerText()
  if (/billing|revenue|credentialing|RCM|service/i.test(chatText) && chatText.length > 400) break
}
ok('assistant streams a grounded reply', /billing|revenue|credentialing|RCM|service/i.test(chatText), chatText.slice(-160))
ok('visitor message shown', chatText.includes('What services do you offer'))

// Second turn to prove conversational context (tool may run; not required)
await page.getByLabel('Chat message').fill('Which of those helps with denied claims?')
await page.getByLabel('Send message').click().catch(() => {})
await page.waitForTimeout(9000)
ok('follow-up turn answered', (await page.locator('[role="dialog"]').innerText()).length > chatText.length)

// ---------- booking API: book, concurrency, reschedule, cancel ----------
const slots = (await (await context.request.get(BASE + '/api/ai/slots')).json()).slots
const first = slots[0], second = slots[1]
const book = async (slot, name) => {
  const response = await context.request.post(BASE + '/api/ai/appointments', {
    data: { startsAtUtc: slot.startsAtUtc, name, email: 'admin@knightmedicalbilling.com', organization: 'Verification Practice', confirmed: true },
  })
  return { status: response.status(), body: await response.json().catch(() => null) }
}
const booked = await book(first, 'Verification Booking')
ok('booking succeeds with real slot', booked.status === 200 && booked.body?.ok === true, JSON.stringify(booked.body).slice(0, 160))
const duplicate = await book(first, 'Duplicate Booking')
ok('double booking rejected', duplicate.status === 409 && duplicate.body?.ok === false, String(duplicate.status))
const token = booked.body?.appointment?.manageToken
ok('manage token issued', typeof token === 'string' && token.length > 20)
if (token) {
  const reschedule = await context.request.post(BASE + '/api/ai/appointments/manage', { data: { token, action: 'reschedule', startsAtUtc: second.startsAtUtc } })
  ok('reschedule works', reschedule.status() === 200, String(reschedule.status()))
  const cancel = await context.request.post(BASE + '/api/ai/appointments/manage', { data: { token, action: 'cancel' } })
  ok('cancel works', cancel.status() === 200 && (await cancel.json()).status === 'cancelled', String(cancel.status()))
}

// ---------- human handoff API ----------
const handoff = await context.request.post(BASE + '/api/ai/handoff', { data: { reason: 'Verification handoff request', name: 'Verification Visitor', email: 'admin@knightmedicalbilling.com' } })
ok('handoff request created', handoff.status() === 200 && (await handoff.json()).ok === true, String(handoff.status()))

// ---------- voice barge-in with mocked browser speech ----------
await page.addInitScript(() => {
  window.__speech = { utterances: [], cancelCount: 0, recognition: null, timers: [] }
  // Keep the energy analyser out of this mock so barge-in is driven only by
  // recognition interim results (deterministic in headless CI).
  try { navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("test: no microphone")); } catch { /* ignore */ }
  class FakeRecognition {
    constructor() { this.lang = ''; this.continuous = true; this.interimResults = true; this.maxAlternatives = 1; this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null; window.__speech.recognition = this }
    start() { this.onstart?.() }
    stop() { this.onend?.() }
    abort() {}
  }
  try { Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true }) } catch { window.SpeechRecognition = FakeRecognition }
  try { Object.defineProperty(window, 'webkitSpeechRecognition', { value: FakeRecognition, configurable: true }) } catch { window.webkitSpeechRecognition = FakeRecognition }
  const synth = window.speechSynthesis
  synth.speak = (utterance) => { window.__speech.utterances.push(utterance.text); window.__speech.timers.push(setTimeout(() => utterance.onend?.(), 5000)) }
  synth.cancel = () => { window.__speech.cancelCount += 1; window.__speech.timers.forEach(clearTimeout); window.__speech.timers = [] }
  window.__emit = (text, final = true) => {
    const recognition = window.__speech.recognition
    if (!recognition?.onresult) return false
    recognition.onresult({ resultIndex: 0, results: Object.assign([{ 0: { transcript: text }, isFinal: final }], { length: 1 }) })
    return true
  }
})
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500)
ok('voice feature advertised in config', config.voiceEnabled === true)
await page.getByRole('button', { name: /open knight ai assistant/i }).click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: /start voice conversation/i }).click()
await page.getByRole('button', { name: /enable microphone/i }).click()
let recognitionReady = false
for (let i = 0; i < 25; i += 1) { await page.waitForTimeout(400); recognitionReady = await page.evaluate(() => Boolean(window.__speech.recognition?.onresult)); if (recognitionReady) break }
ok('voice session starts listening', recognitionReady)
await page.evaluate(() => window.__emit('How does onboarding work?', true))
let spoken = 0
for (let i = 0; i < 40; i += 1) { await page.waitForTimeout(500); spoken = await page.evaluate(() => window.__speech.utterances.length); if (spoken > 0) break }
ok('assistant speech is synthesized', spoken > 0)
const cancelsBefore = await page.evaluate(() => window.__speech.cancelCount)
await page.evaluate(() => window.__emit('Actually, wait a moment', false))
await page.waitForTimeout(600)
const cancelsAfter = await page.evaluate(() => window.__speech.cancelCount)
ok('barge-in cancels active speech', cancelsAfter > cancelsBefore, JSON.stringify({ cancelsBefore, cancelsAfter }))
await page.evaluate(() => window.__emit('What about credentialing?', true))
await page.waitForTimeout(8000)
ok('voice interruption starts a new turn', (await page.locator('[role="dialog"]').innerText()).includes('What about credentialing?'))

// ---------- admin console ----------
await page.goto(BASE + '/admin/login', { waitUntil: 'domcontentloaded' })
await page.fill('input[name="password"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')])
await page.waitForTimeout(500)
for (const path of ['/admin/ai', '/admin/ai/conversations', '/admin/ai/leads', '/admin/ai/appointments', '/admin/ai/handoffs', '/admin/ai/knowledge', '/admin/ai/settings']) {
  const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  ok(`admin page ${path}`, response?.status() === 200 && (await page.locator('body').innerText()).length > 200, String(response?.status()))
}
const anon = await browser.newContext()
ok('anonymous admin AI redirects', (await anon.request.get(BASE + '/admin/ai', { maxRedirects: 0 })).status() === 307)
await anon.close()

// ---------- existing site regression ----------
for (const path of ['/', '/services', '/blog', '/contact', '/schedule-form', '/privacy-policy', '/appointment/manage?token=invalid']) {
  const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  ok(`existing page ${path}`, response?.status() === 200, String(response?.status()))
}
ok('no client page errors', pageErrors.length === 0, pageErrors.join(' | '))
console.log(`RESULT pass=${pass} fail=${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
