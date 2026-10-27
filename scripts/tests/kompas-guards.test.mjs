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

test('plus-qualified source figures allow the bare figure', () => {
  const allowed = allowedNumbers('8+ years of experience')
  assert.equal(guardText('I have 8 years of experience.', allowed).text, 'I have 8 years of experience.')
})

test('sentence-final source figures allow the bare figure', () => {
  const allowed = allowedNumbers('Design controls mapped to NIST 800-53.')
  assert.equal(guardText('enforces NIST 800-53 controls.', allowed).text, 'enforces NIST 800-53 controls.')
  assert.equal(guardText('enforces NIST 800\u201153 controls.', allowed).text, 'enforces NIST 800\u201153 controls.')
})

test('guarded figures do not orphan an attached unit', () => {
  const allowed = allowedNumbers('')
  assert.equal(guardText('wal_sender_timeout=30s and max_replication_lag=45s.', allowed).text, 'wal_sender_timeout=several and max_replication_lag=several.')
  assert.equal(guardText('within 30ms of the window.', allowed).text, 'within several of the window.')
  assert.equal(guardText('within 30 ms of the window.', allowed).text, 'within several ms of the window.')
})

test('guard output stays grammatical: percentages and trailing periods', () => {
  assert.equal(kept('Route 10% of traffic via a service mesh.'), 'Route a share of traffic via a service mesh.')
  assert.equal(kept('Then gradually increase to 10%.'), 'Then gradually increase to a higher share.')
  assert.equal(kept('The quarantine index must contain at least 90% of the expected event count.'), 'The quarantine index must contain at least a share of the expected event count.')
  assert.equal(kept('We did 3. Hypothesis 1: a manual change.'), 'We did several. Hypothesis 1: a manual change.')
  assert.equal(applyGuards('several Hypothesis 1: a manual change.', null, empty).text, 'Hypothesis 1: a manual change.')
  assert.equal(kept('Cut incidents by 40% in a quarter.'), 'Cut incidents by noticeably in a quarter.')
  assert.equal(kept('From that diff I generate hypotheses: 3.'), 'From that diff I generate hypotheses: 3.')
  assert.equal(kept('For 1 I check the event log for Update calls.'), 'For 1 I check the event log for Update calls.')
  assert.equal(kept('For 5 years we ran checks.'), 'For several years we ran checks.')
  assert.equal(kept('Built around NIST 800\u201353 controls.'), 'Built around NIST 800\u201353 controls.')
  assert.equal(kept('Map required AC\u20132 and SC\u20137 families.'), 'Map required AC\u20132 and SC\u20137 families.')
  assert.equal(kept('Component 1: define a trust boundary.'), 'Component 1: define a trust boundary.')
  assert.equal(kept('Indicators: (1) attempts, (2) alerts, (3) gaps.'), 'Indicators: (1) attempts, (2) alerts, (3) gaps.')
})
