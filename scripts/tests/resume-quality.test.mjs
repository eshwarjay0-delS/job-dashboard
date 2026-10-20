import test from 'node:test'
import assert from 'node:assert/strict'
import { resumeQuality, requiredEvidenceTerms } from '../../src/lib/resume-quality.ts'

// Since 18 Oct 2026 (8f0c9c4, owner: "we should deliver 95 to 100% match resumes") 95% is the floor and 98% the target;
// 95-97% is "delivered_with_gaps", not "coverage_met".
test('a 41 percent draft cannot qualify even when all listed skills appear somewhere', () => {
  const report = resumeQuality({ matched: 41, total: 100, missing: ['risk treatment'] })
  assert.equal(report.status, 'needs_review')
  assert.equal(report.minimum, 95)
  assert.equal(report.target, 98)
  assert.deepEqual(report.missing, ['risk treatment'])
})
test('rounding up the displayed percentage never admits a below-baseline draft', () => {
  assert.equal(resumeQuality({ matched: 949, total: 1000, missing: [] }).status, 'needs_review')
  assert.equal(resumeQuality({ matched: 950, total: 1000, missing: [] }).status, 'delivered_with_gaps')
  assert.equal(resumeQuality({ matched: 979, total: 1000, missing: [] }).status, 'delivered_with_gaps')
  assert.equal(resumeQuality({ matched: 980, total: 1000, missing: [] }).status, 'coverage_met')
})
// Preserve the delivery floor, but incomplete experience must never qualify as a completed cached result.
test('unfinished rewrites never receive completed status even at full keyword overlap', () => {
  assert.equal(resumeQuality({ matched: 100, total: 100, missing: [], unchanged: true }).status, 'needs_review')
  assert.equal(resumeQuality({ matched: 0, total: 0, missing: [] }).status, 'needs_review')
  assert.equal(resumeQuality({ matched: 94, total: 100, missing: [], partial: true }).status, 'needs_review')
  assert.equal(resumeQuality({ matched: 96, total: 100, missing: [], partial: true }).status, 'delivered_with_gaps')
  assert.equal(resumeQuality({ matched: 98, total: 100, missing: [], partial: true }).status, 'delivered_with_gaps')
  assert.equal(resumeQuality({ matched: 100, total: 100, missing: [], partial: true }).status, 'delivered_with_gaps')
  assert.equal(resumeQuality({ matched: 100, total: 100, missing: [], partial: false }).status, 'coverage_met')
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
