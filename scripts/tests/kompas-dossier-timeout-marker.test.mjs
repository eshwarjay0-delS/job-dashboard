import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// Audit partial (31 Oct 2026): dossier grounding timed out silently — the
// 300ms general race and the two 110ms bible/prepared races all resolved to
// "", exactly like a genuinely empty dossier. A timeout must now be marked
// in the prompt and flagged in the response, never silently swallowed.
const route = readFileSync('src/lib/kompasAnswerService.ts', 'utf8')

test('general dossier race reports a timeout instead of a bare empty string', () => {
  assert.ok(route.includes('dossierContext(hashUserId(user.id), "general").then((v) => ({ v, timedOut: false }))'))
  assert.ok(route.includes('resolve({ v: "", timedOut: true }), 300'))
  assert.ok(!route.includes('resolve(""), 300'))
})

test('bible and prepared races report a timeout instead of a bare empty string', () => {
  assert.ok(route.includes('resolve({ v: "", timedOut: true }), 110'))
  assert.ok(!route.includes('resolve(""), 110'))
  assert.ok(route.includes('bibleTimedOut = masterRaced.timedOut || preparedRaced.timedOut'))
})

test('a timed-out lane is named in the prompt, not dropped', () => {
  assert.ok(route.includes('DOSSIER NOTE: the general dossier read timed out (300ms)'))
  assert.ok(route.includes('the earlier-session mini-dossier read timed out (110ms)'))
  assert.ok(route.includes('the prepared dossier read timed out (110ms)'))
  assert.ok(route.includes('bibleTimeoutNote ? bibleTimeoutNote : ""'))
})

test('the job and both response shapes carry the timeout flag', () => {
  assert.ok(route.includes('groundingTimedOut: boolean'))
  assert.ok(route.includes('groundingTimedOut: generalDossierTimedOut || bibleTimedOut'))
  assert.ok(route.includes('type: "done", degraded, guarded: g.guarded, verified, repaired, repair, groundingTimedOut: job.groundingTimedOut'))
  assert.ok(route.includes('groundingTimedOut: job.groundingTimedOut'))
})
