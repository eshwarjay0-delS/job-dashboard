import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { coveragePercent, resumeQuality } from '../../src/lib/resume-quality.ts'

test('displayed coverage never rounds across delivery, target or complete boundaries', () => {
  for (const [ratio, expected] of [[.949,94.9], [.94999,94.9], [.95,95], [.979,97.9], [.97999,97.9], [.98,98], [.99999,99.9], [1,100], [0,0]]) {
    assert.equal(coveragePercent(ratio), expected)
  }
  assert.equal(resumeQuality({matched:949,total:1000,missing:[]}).status, 'needs_review')
  assert.equal(resumeQuality({matched:979,total:1000,missing:[]}).status, 'delivered_with_gaps')
  for (const invalid of [NaN, Infinity, -1, 1.1]) assert.equal(coveragePercent(invalid), 0)
})

test('shared result fields and web ring retain fractional precision', () => {
  const tailor = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../../src/app/dashboard/resume/result/page.tsx', import.meta.url), 'utf8')
  assert.match(tailor, /coverage: coveragePercent\(best\.cov\)/)
  assert.match(tailor, /coveragePercent\(afterKw\.size \/ jdKws\.length\)/)
  assert.doesNotMatch(page, /Math\.round\(coverage\)/)
  assert.match(page, /aria-label=\{`JD match \$\{coverage\} percent`\}/)
})
