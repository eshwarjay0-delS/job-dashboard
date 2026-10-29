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
test('never silently deliver the original resume as a tailored fallback', () => {
  assert.doesNotMatch(webhook, /sendLibraryFallback\(/)
  assert.match(webhook, /if \(!acceptableWhatsAppResume\(result\)\)/)
})
test('skills floor adds missing job-post terms on the skills line and does not call that confirmed experience', () => {
  assert.match(tailor, /const left = scoreKws\.filter\(k => floorKws\.has\(k\) && !cur\.afterKw\.has\(k\) && !isCertification\(k\)\)/)
  const clear = tailor.indexOf('await stripUnsupportedSkills(')
  const floor = tailor.indexOf('await placeEverything(best)')
  assert.ok(clear > 0 && floor > clear, 'model-written tools are cleared before the labelled job-post pass writes them back')
  assert.equal(tailor.indexOf('await stripUnsupportedSkills(', floor), -1)
  assert.match(tailor, /!floorOnSkills\.has\(k\.toLowerCase\(\)\)/)
  assert.match(tailor, /coveredJdKeywords\(bulletText, \[k\]\)/)
  assert.match(tailor, /for \(let floorRound = 0; floorRound < 4; floorRound\+\+\)/)
})
test('ten varied job-post skill-floor cases', () => {
  const expression = tailor.match(/const left = (scoreKws\.filter\([^\n]+\))/)?.[1]
  assert.ok(expression, 'use the real production placement expression')
  const place = new Function('scoreKws', 'floorKws', 'forcedJdKws', 'cur', 'isCertification', 'return ' + expression)
  const cases = [
    { score: ['aws'], evidence: ['aws'], present: [], certs: [], expected: ['aws'] },
    { score: ['illumio'], evidence: [], present: [], certs: [], expected: ['illumio'] },
    { score: ['azure'], evidence: ['azure'], present: ['azure'], certs: [], expected: [] },
    { score: ['cissp'], evidence: ['cissp'], present: [], certs: ['cissp'], expected: [] },
    { score: ['splunk','unknown tool'], evidence: ['splunk'], present: [], certs: [], expected: ['splunk', 'unknown tool'] },
    { score: ['unknown a','unknown b'], evidence: [], present: [], certs: [], expected: ['unknown a', 'unknown b'] },
    { score: ['python','terraform','aws'], evidence: ['python','terraform','aws'], present: [], certs: [], expected: ['python','terraform','aws'] },
    { score: ['dns','dhcp'], evidence: ['dns','dhcp'], present: ['dns'], certs: [], expected: ['dhcp'] },
    { score: ['zero trust'], evidence: ['soc'], present: [], certs: [], expected: ['zero trust'] },
    { score: ['okta','azure'], evidence: ['okta','azure'], floor: ['azure'], present: [], certs: [], expected: ['azure'] },
  ]
  for (const [i, c] of cases.entries()) {
    const actual = place(c.score, new Set(c.floor || c.score), c.evidence, { afterKw: new Set(c.present) }, k => c.certs.includes(k))
    assert.deepEqual(actual, c.expected, 'evidence case ' + (i + 1))
  }
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
  assert.match(webhook, /recordResumeDeliveryStatus\(id, state, String\(status\.biz_opaque_callback_data/)
  assert.match(queue, /meta_delivery_failed/)
  assert.match(queue, /resume handset delivery confirmed/)
})

test('cross-provider best draft is selected by evidence and role quality, not raw JD overlap', () => {
  assert.match(tailor, /if \(!best \|\| quality\(first\) > quality\(best\)\)/)
  assert.match(tailor, /unsupportedPenalty\(p\)/)
})

test('saved resumes are remeasured instead of trusted by date alone', () => {
  assert.match(made, /export const MADE_FLOOR = 0\.95/)
  assert.doesNotMatch(made, /if \(at >= FLOOR_SINCE\) return true/)
})

test('ambiguous Meta timeouts can be reconciled by opaque callback job id', () => {
  const sender = readFileSync(new URL('../../src/lib/whatsapp.ts', import.meta.url), 'utf8')
  assert.match(sender, /biz_opaque_callback_data: opaqueJobId/)
  assert.match(queue, /timed-out document reconciled as delivered/)
})

test('WhatsApp never mistakes Meta API acceptance for handset delivery', () => {
  assert.match(webhook, /queued\.deliveryState === "delivered" \|\| queued\.deliveryState === "read"/)
  assert.match(webhook, /WhatsApp accepted the document, but handset delivery has not been confirmed/)
  assert.match(webhook, /I will not send a duplicate while its status is unknown/)
})
test('a failed JD stays saved without asking for manual resubmission', () => {
  assert.match(webhook, /The rewrite produced no changes, so I did not send a file\. Your request is saved and will be retried automatically/)
  assert.match(webhook, /The document upload is unconfirmed\. Your request is saved/)
  assert.doesNotMatch(webhook, /If nothing arrives, send \*redo\*/)
})


test('Meta acceptance preserves a recoverable original instead of deleting the only source', () => {
  assert.match(webhook, /session\.resumeFiled && await existsPath\(session\.resumeFiled\)/)
  assert.match(webhook, /patchResumeRecovery\(job, \{ resumePath: session\.resumeFiled \}\)/)
  assert.match(webhook, /if \(durable\?\.resumePath === session\.resumeFiled\)/)
  assert.match(webhook, /const fallback = job\.resumeFiled \|\| ""/)
  assert.match(webhook, /path\.resolve\(fallback\)\.startsWith\(path\.resolve\(root\) \+ path\.sep\)/)
  assert.match(webhook, /await deferResumeRecovery\(job\.id, "source_missing"\)/)
})

test('recovery distinguishes Meta acceptance and signed handset confirmation', () => {
  assert.match(webhook, /let handsetConfirmed = 0/)
  assert.match(webhook, /state\?\.deliveryState === "delivered" \|\| state\?\.deliveryState === "read"/)
  assert.match(webhook, /handsetConfirmed, stillPending/)
})
