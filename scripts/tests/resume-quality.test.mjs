import test from 'node:test'
import assert from 'node:assert/strict'
import { resumeQuality } from '../../src/lib/resume-quality.ts'

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
