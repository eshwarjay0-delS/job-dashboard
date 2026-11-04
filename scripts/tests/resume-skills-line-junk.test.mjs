import test from 'node:test'
import assert from 'node:assert/strict'
import { isJunkTerm } from '../../src/lib/resume-skills-line.ts'

test('Nov4 junk filter: adverbs and modifier compounds are junk terms', () => {
  for (const term of ['closely', 'effectively', 'cloud-based', 'government-issued', 'opportunity-please']) assert.equal(isJunkTerm(term), true, term)
  for (const term of ['siem', 'open-source', 'machine-learning', 'palo alto']) assert.equal(isJunkTerm(term), false, term)
})
