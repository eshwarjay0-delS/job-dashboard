// Risk factor score (Nov 4): built from the run's own blockers, never a model
// verdict. 0 = clean, 100 = do not send; <25 low, <50 medium, <75 high, else
// critical. Every weight is pinned here so a reported number can be re-derived
// from the run record by hand.
import test from 'node:test'
import assert from 'node:assert/strict'
import { riskScore } from '../../src/lib/resume-risk.ts'

test('a clean run scores zero and low', () => {
  const r = riskScore({ coverage: 98, atsPassed: true, atsIssues: [], unverifiedAdded: [], missing: [], qualityBlockers: [], droppedCount: 0 })
  assert.equal(r.score, 0)
  assert.equal(r.level, 'low')
  assert.deepEqual(r.factors, [])
})

test('unverified claims are the heaviest single factor', () => {
  const r = riskScore({ coverage: 98, atsPassed: true, unverifiedAdded: ['kubernetes', 'terraform'] })
  assert.equal(r.score, 30)
  assert.equal(r.level, 'medium')
  assert.ok(r.factors.some(f => f.includes('unverified')))
})

test('ATS issues and a failed parse check stack', () => {
  const r = riskScore({ coverage: 98, atsPassed: false, atsIssues: ['unparsable table', 'missing section'] })
  assert.equal(r.score, 31)
  assert.equal(r.level, 'medium')
})

test('missing terms and dropped paragraphs are capped, not unbounded', () => {
  const r = riskScore({ coverage: 98, atsPassed: true, missing: Array.from({ length: 12 }, (_, i) => `term${i}`), droppedCount: 5 })
  assert.equal(r.score, 35)
})

test('level boundaries are exact', () => {
  assert.equal(riskScore({ coverage: 47 }).level, 'low')
  assert.equal(riskScore({ coverage: 47 }).score, 24)
  assert.equal(riskScore({ coverage: 45 }).level, 'medium')
  assert.equal(riskScore({ coverage: 45 }).score, 25)
  assert.equal(riskScore({ skillsOnly: true, unverifiedAdded: ['a', 'b', 'c', 'd'] }).level, 'critical')
  assert.equal(riskScore({ skillsOnly: true, unverifiedAdded: ['a', 'b', 'c', 'd'] }).score, 85)
})

test('the score never exceeds 100', () => {
  const r = riskScore({ coverage: 0, atsPassed: false, atsIssues: ['x', 'y', 'z'], unverifiedAdded: ['a', 'b', 'c', 'd', 'e'], missing: Array.from({ length: 20 }, (_, i) => `t${i}`), qualityBlockers: ['q1', 'q2', 'q3', 'q4', 'q5'], droppedCount: 9, skillsOnly: true })
  assert.equal(r.score, 100)
  assert.equal(r.level, 'critical')
})
