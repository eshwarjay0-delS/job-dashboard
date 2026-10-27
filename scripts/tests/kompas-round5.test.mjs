// Evaluation round 3 (26 Oct 2026): what the judges and the ChatGPT reference showed Kompas getting wrong, held still.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const G = await import('../../src/lib/kompasGuards.ts')
const R = await import('../../src/lib/kompasDesktopResponse.ts')
const none = new Set()

test('numbers in a plan, a test or a design stay exactly as written', () => {
  for (const text of [
    'I would alert when there are 5 failed logins in 10 minutes.',
    'Route 10% of traffic to the new region first, then 50%.',
    'The quarantine index must contain at least 90% of the expected event count.',
    'Set wal_sender_timeout=30s and max_replication_lag=45s.',
    'Send 20 requests as tenant A and expect 20 denials.',
  ]) assert.equal(G.applyGuards(text, null, none).text, text, text)
})

test('an unsupported result claim is still guarded, and a supported one is not', () => {
  const claim = 'I managed 300 endpoints and reduced incidents by 40%.'
  const out = G.applyGuards(claim, null, none).text
  assert.doesNotMatch(out, /300|40%/)
  assert.equal(G.applyGuards(claim, null, new Set(['300', '40%'])).text, claim)
  assert.doesNotMatch(G.applyGuards('That change cut false positives by 60%.', null, none).text, /60%/, 'an invented effect, even without "I"')
  assert.doesNotMatch(G.applyGuards('It saved $2 million a year.', null, none).text, /\$2/)
  const mixed = G.applyGuards('I reduced alert volume by 35%. I would page when 3 hosts fail.', null, none).text
  assert.doesNotMatch(mixed, /35%/)
  assert.match(mixed, /when 3 hosts fail/, 'one sentence guarded, the plan beside it untouched')
})

test('containment never weakens a control, missing telemetry is never a pass, and logic holds', () => {
  const g = R.desktopResponsePolicy('architect', 'Go deeper on that failure. What if the first mitigation fails and telemetry is incomplete? Give a falsifiable test and an exit criterion.').guidance
  assert.match(g, /Containment never weakens a security control/)
  assert.match(g, /Missing telemetry is never a pass/)
  assert.match(g, /never both/)
  assert.doesNotMatch(R.desktopResponsePolicy('engineer', 'Define IDOR versus CSRF.').guidance, /Containment never weakens/, 'a definition is not given an incident contract')
})
