import test from 'node:test'
import assert from 'node:assert/strict'
import { resumeQuality, requiredEvidenceTerms } from '../../src/lib/resume-quality.ts'

test('a 41 percent draft cannot qualify even when all listed skills appear somewhere', () => {
  const report = resumeQuality({ matched: 41, total: 100, missing: ['risk treatment'] })
  assert.equal(report.status, 'needs_review')
  assert.equal(report.minimum, 98)
  assert.deepEqual(report.missing, ['risk treatment'])
})
test('rounding up the displayed percentage never admits a below-baseline draft', () => {
  assert.equal(resumeQuality({ matched: 979, total: 1000, missing: [] }).status, 'needs_review')
  assert.equal(resumeQuality({ matched: 980, total: 1000, missing: [] }).status, 'coverage_met')
})
test('partial, unchanged and unscorable documents remain drafts despite high overlap', () => {
  for (const options of [{ partial: true }, { unchanged: true }]) {
    assert.equal(resumeQuality({ matched: 100, total: 100, missing: [], ...options }).status, 'needs_review')
  }
  assert.equal(resumeQuality({ matched: 0, total: 0, missing: [] }).status, 'needs_review')
})

test('invalid or inflated counters cannot manufacture a passing coverage score', () => {
  for (const [matched, total] of [[101,100], [Infinity,100], [98.5,100], [-1,100], [98,NaN]]) {
    assert.equal(resumeQuality({ matched, total, missing: [] }).status, 'needs_review')
  }
})

for (const [matched, total] of [[17,40], [14,22], [63,260], [51,81], [38,81]]) {
  test(`reported regression ${matched}/${total} cannot be labeled complete`, () => {
    assert.equal(resumeQuality({ matched, total, missing: [] }).status, 'needs_review')
  })
}


test('optional enrichment cannot lower experience completeness for satisfied original requirements', () => {
  const original = ['apex', 'lwc', 'salesforce cpq']
  const listed = [...original, 'mulesoft', 'guided selling', 'apex']
  const evidenceTargets = requiredEvidenceTerms(original, listed)
  assert.deepEqual(evidenceTargets, original)
  const demonstrated = new Set(['apex', 'lwc', 'salesforce cpq'])
  assert.equal(evidenceTargets.filter(t => demonstrated.has(t)).length / evidenceTargets.length, 1)
  assert.equal(resumeQuality({ matched: 3, total: 3, missing: [] }).status, 'coverage_met')
})
test('a missing original requirement remains a gap despite many enrichment suggestions', () => {
  const original = ['apex', 'lwc', 'salesforce cpq']
  assert.deepEqual(requiredEvidenceTerms(original, ['apex', 'mulesoft', 'sap']), ['apex'])
  assert.equal(resumeQuality({ matched: 1, total: original.length, missing: ['lwc', 'salesforce cpq'] }).status, 'needs_review')
})
