import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const webhook = readFileSync(new URL('../../src/app/api/whatsapp/webhook/route.ts', import.meta.url), 'utf8')
const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
const queue = readFileSync(new URL('../../src/lib/whatsapp-resume-recovery.ts', import.meta.url), 'utf8')
const made = readFileSync(new URL('../../src/lib/made-floor.ts', import.meta.url), 'utf8')
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))

test('job input is durably enqueued before interactive session consumption', () => {
  assert.ok(webhook.indexOf('await enqueueResumeRecovery({') < webhook.indexOf('const cur = await loadSession(from)', webhook.indexOf('async function generate(')))
})
test('failed quality is retained for automatic recovery', () => {
  assert.match(webhook, /failureCode = "quality_rejected"/)
  assert.match(webhook, /deferResumeRecovery\(job, failureCode, failedCandidate\)/)
})
test('a chosen-resume failsafe is labelled and is not presented as a tailored rewrite', () => {
  assert.doesNotMatch(webhook, /sendLibraryFallback\(/)
  assert.match(webhook, /if \(!whatsappRewriteUsable\(result\)\)/)
  assert.match(webhook, /This file was not rewritten/)
  assert.match(webhook, /closest matching resume/)
  assert.match(webhook, /acceptableWhatsAppResume\(result\)/)
})
test('skills recovery only restores candidate-supported job terms', () => {
  assert.match(tailor, /const left = scoreKws\.filter\(k => floorKws\.has\(k\) && forcedJdKws\.includes\(k\) && !cur\.afterKw\.has\(k\) && !isCertification\(k\)\)/)
  const clear = tailor.indexOf('await stripUnsupportedSkills(best, banned)')
  const floor = tailor.indexOf('await placeEverything(best)')
  assert.ok(clear > 0 && floor > clear, 'model-written tools are cleared before the labelled job-post pass writes them back')
  const finalReview = tailor.indexOf('...[truncated]