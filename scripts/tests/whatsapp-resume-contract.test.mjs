import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const webhook = readFileSync(new URL('../../src/app/api/whatsapp/webhook/route.ts', import.meta.url), 'utf8')
const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../../src/lib/whatsapp-resume-recovery.ts', import.meta.url), 'utf8')
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))

test('job input is durably enqueued before interactive session consumption', () => {
  assert.ok(webhook.indexOf('await enqueueResumeRecovery({') < webhook.indexOf('const cur = await loadSession(from)', webhook.indexOf('async function generate(')))
})
test('failed quality is retained for automatic recovery', () => {
  assert.match(webhook, /failureCode = "quality_rejected"/)
  assert.match(webhook, /deferResumeRecovery\(job, failureCode, failedCandidate\)/)
})
test('never silently deliver the original resume as a tailored fallback', () => {
  assert.doesNotMatch(webhook, /sendLibraryFallback\(/)
  assert.match(webhook, /if \(!acceptableWhatsAppResume\(result\)\)/)
})
test('skill floor only inserts candidate-supported JD terms', () => {
  assert.match(tailor, /const left = scoreKws\.filter\(k => floorKws\.has\(k\) && forcedJdKws\.includes\(k\)/)
})
test('repair prompts chase evidenced skills, not impossible JD-only gaps', () => {
  assert.match(tailor, /const missing = forcedJdKws\.filter\(k => !current\.afterKw\.has\(k\)\)/)
})
test('new unverified JD claims force review', () => {
  assert.match(tailor, /unverifiedAdded\.length > 0/)
  assert.match(tailor, /unverified_added_keywords: unverifiedAdded/)
})
test('legacy cache must carry the evidence-aware scoring contract', () => {
  assert.match(tailor, /Number\.isFinite\(cached\.supported_coverage\)/)
})
test('recovery endpoint requires the configured cron bearer token', () => {
  assert.match(webhook, /secret\.length < 16/)
  assert.match(webhook, /request\.headers\.get\("authorization"\)/)
})
test('failed pre-queue JD can be bootstrapped from retained session data', () => {
  assert.match(webhook, /bootstrapLegacyResumeFailures/)
  assert.match(webhook, /last\.used/)
  assert.match(webhook, /legacy-resume-recovery/)
})
test('document delivery uses a durable sending lease before Meta call', () => {
  assert.ok(webhook.indexOf('status: "sending"') < webhook.indexOf('sentId = await deliver('))
  assert.match(webhook, /markResumeDocumentAccepted\(job, sentId\)/)
})
test('identity is verified before WhatsApp document delivery', () => {
  assert.ok(webhook.indexOf('sameResumeIdentity(await extractText(source), await extractText(file))') < webhook.indexOf('sentId = await deliver('))
})
test('scheduled recovery has a five-minute execution budget and a daily cron', () => {
  assert.equal(config.functions['src/app/api/whatsapp/recover/route.ts'].maxDuration, 300)
  assert.ok(config.crons.some(c => c.path === '/api/whatsapp/recover'))
})

test('Meta delivery callbacks update the durable resume job record', () => {
  assert.match(webhook, /recordResumeDeliveryStatus\(id, state\)/)
  assert.match(queue, /meta_delivery_failed/)
  assert.match(queue, /resume handset delivery confirmed/)
})
