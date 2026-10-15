import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guardText, needsGuard, applyGuards } from '../../src/lib/kompasGuards.ts'
import { audienceGuidance } from '../../src/lib/kompasAudience.ts'
import { cutQuestion } from '../../src/lib/kompasAnswer.ts'

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
  assert.match(audienceGuidance('engineer', 'How would you test this?'), /question's own subject/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /100% on the question they asked/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /surface or bottom/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /surface question never receives a bottom scenario/)
  assert.match(audienceGuidance('engineer', 'How would you test this?'), /100% relevant to this question/)
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

test('the question is cut out of the ramble, and a definition stays a storyteller explanation', () => {
  const ramble = 'Okay. Yes so I start by troubleshooting. Okay, so how do you configure certificate discovery in Venafi?'
  assert.match(cutQuestion(ramble), /how do you configure certificate discovery in Venafi/i)
  assert.equal(cutQuestion('Okay.'), '')
  assert.equal(cutQuestion('Intro'), 'Tell me about yourself')
  const code = 'if n <= 3:\n    return True\nif n % 2 == 0:\n    return False'
  assert.match(applyGuards(code, null, new Set()).text, /n <= 3/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /name the mechanism once/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /why it matters before any apparatus/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /question ordinary life already asks/)
  assert.match(audienceGuidance('engineer', 'Tell me about yourself'), /path you were set on/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /picture that remains once the dust has settled/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /scene the listener already recognizes/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /sees the change before they hear the name/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /replace the picture they brought/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /measure they already trust/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /cannot tell apart are one thing/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /one comparison of the same thing in two conditions/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /explained the seeing away/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /feels the idea personally/)
  assert.match(audienceGuidance('engineer', 'What is a certificate?'), /funny, charismatic, and inviting/)
  assert.match(audienceGuidance('hr', 'Tell me about a time you led'), /finish on every answer, for every audience/)
  assert.match(audienceGuidance('director', 'Should we launch?'), /interview still decides the question and the layer/)
})
