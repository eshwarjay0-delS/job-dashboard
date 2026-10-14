import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guardText, needsGuard } from '../../src/lib/kompasGuards.ts'
import { audienceGuidance } from '../../src/lib/kompasAudience.ts'

test('HTTP responses, versions and example invoice identifiers survive the figures guard', () => {
  for (const text of [
    'The service returns 403 if the owner differs.',
    'The suite expects a 403.',
    'Every unauthorized API call receives a 403.',
    'For example, use Kubernetes 1.27 and Istio 1.18 with NGINX 1.25.',
    'Request /invoices/123 with invoice_id=456.',
  ]) {
    assert.equal(needsGuard(text, new Set()), false, text)
    assert.equal(guardText(text, new Set()).text, text)
  }
})

test('unsupported career metrics remain guarded', () => {
  const text = 'I managed 300 endpoints and reduced incidents by 40%.'
  assert.equal(needsGuard(text, new Set()), true)
  const result = guardText(text, new Set())
  assert.ok(result.removed >= 2)
  assert.doesNotMatch(result.text, /300|40%/)
  assert.equal(guardText(text, new Set(['300', '40%'])).text, text)
})

test('explicit mixed audience overrides architect detail, and directors receive decision criteria', () => {
  assert.match(audienceGuidance('architect', 'The audience includes an engineer and an operations manager.'), /honor that over the selected role/)
  assert.match(audienceGuidance('director', 'Would you delay launch?'), /evidence would change the decision/)
  assert.match(audienceGuidance('technical_hr', 'What is authorization?'), /everyday language/)
  assert.match(audienceGuidance('engineer', 'How would you test this?'), /trust boundary/)
  assert.match(audienceGuidance('engineer', 'How would you test this?'), /first sentence answers the question/)
  assert.match(audienceGuidance('engineer', 'How would you test this?'), /one thread/)
  assert.match(audienceGuidance('technical_hr', 'What is authorization?'), /listener who blinked can rejoin/)
  assert.match(audienceGuidance('director', 'Would you delay launch?'), /tradeoff, or how the result is checked/)
})

test('the live page says a problem before the session and does not leave a failure on the card', () => {
  const page = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.match(page, /function beforeSessionNotice/)
  assert.match(page, /Session has not started\. The answer service is not ready/)
  assert.match(page, /isUnavailableAnswer\(\{ degraded: true \}, t\)/)
  assert.doesNotMatch(page, /Answer service needs attention/)
  assert.doesNotMatch(page, /Answer engine unavailable\. Showing a prepared answer/)
  assert.match(page, /function heardAsQuestion/)
  assert.doesNotMatch(page, /transcript\.length > 500/)
  assert.match(page, /flushHeard\(1500\)/)
  assert.match(page, /derived: said/)
})
