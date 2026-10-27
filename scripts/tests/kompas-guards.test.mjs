// Number guard (26 Oct 2026): plainFor rewrote every non-allowlisted number
// to "several" / "noticeably" — including numbers that are structure, not
// result claims. Structural numbers pass through; invented result figures
// are still rewritten.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardText, needsGuard, allowedNumbers, applyGuards } from '../../src/lib/kompasGuards.ts'

const empty = new Set()
const kept = (line) => guardText(line, empty).text

test('hypothesis ordinals, tiers, times, ids and thresholds survive', () => {
  assert.equal(kept('Hypothesis 1: the pipeline applied a newer version.'), 'Hypothesis 1: the pipeline applied a newer version.')
  assert.equal(kept('I verify hypothesis 2 by checking the audit logs.'), 'I verify hypothesis 2 by checking the audit logs.')
  assert.equal(kept('Score Identify at Tier 3 and Protect at Tier 2.'), 'Score Identify at Tier 3 and Protect at Tier 2.')
  assert.equal(kept('Modified at 14:32 UTC, last push at 09:15 UTC.'), 'Modified at 14:32 UTC, last push at 09:15 UTC.')
  assert.equal(kept('Delete id=1234 via the API.'), 'Delete id=1234 via the API.')
  assert.equal(kept('The metric crossing \u2265 0.95 within five minutes.'), 'The metric crossing \u2265 0.95 within five minutes.')
  assert.equal(needsGuard('Hypothesis 1: the pipeline applied a newer version.', empty), false)
})

test('invented result figures are still rewritten, allowlisted figures kept', () => {
  const cut = kept('Cut incidents by 40% in a quarter.')
  assert.doesNotMatch(cut, /40/)
  assert.match(cut, /noticeably/)
  const created = kept('We created 5 rules last month.')
  assert.doesNotMatch(created, / 5 rules/)
  assert.match(created, /several rules/)
  const allowed = allowedNumbers('11+ years in IT, 8+ years in InfoSec')
  assert.equal(guardText('I have 11+ years in IT.', allowed).text, 'I have 11+ years in IT.')
})

test('guard output stays grammatical: percentages and trailing periods', () => {
  assert.equal(kept('Route 10% of traffic via a service mesh.'), 'Route a share of traffic via a service mesh.')
  assert.equal(kept('Then gradually increase to 10%.'), 'Then gradually increase to a higher share.')
  assert.equal(kept('The quarantine index must contain at least 90% of the expected event count.'), 'The quarantine index must contain at least a share of the expected event count.')
  assert.equal(kept('We did 3. Hypothesis 1: a manual change.'), 'We did several. Hypothesis 1: a manual change.')
  assert.equal(applyGuards('several Hypothesis 1: a manual change.', null, empty).text, 'Hypothesis 1: a manual change.')
  assert.equal(kept('Cut incidents by 40% in a quarter.'), 'Cut incidents by noticeably in a quarter.')
})
