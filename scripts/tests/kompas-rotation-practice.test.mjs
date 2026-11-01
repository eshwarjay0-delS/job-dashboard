import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {ANGLES, normLedger, pickAngle, recordAngle, commit} from '../../src/lib/kompasAnswer.ts'

// Audit partial (31 Oct 2026): new-angle rotation was story-only — non-story
// turns never advanced the angles ledger, so a technical re-ask re-served
// the same telling while story re-asks rotated. The service now advances
// the angle for every practice turn (register === "practice"), not just
// story turns. Project and story accounting stay with story turns; only
// the angle moves for practice turns, and a practice turn needs no prep
// projects to rotate. Concept turns stay out: register === "concept"
// answers stay abstract per the Oct 22 rule, and no angle is picked for them.
const service = readFileSync('src/lib/kompasAnswerService.ts', 'utf8')

test('practice turns advance the same angle ledger story turns use', () => {
  const ledger = normLedger(null)
  const picks = []
  // Interleave story-style turns (commit) and practice-style turns
  // (pickAngle + recordAngle, the new branch) on one ledger.
  for (let i = 0; i < 24; i++) {
    if (i % 2 === 0) {
      const a = pickAngle(ledger)
      picks.push(a)
      commit(ledger, 'p', a, '', 2)
    } else {
      const a = pickAngle(ledger)
      picks.push(a)
      recordAngle(ledger, a)
    }
  }
  for (let i = 0; i < 24; i++) assert.equal(picks[i], ANGLES[i % ANGLES.length])
  for (let i = 1; i < 24; i++) assert.notEqual(picks[i], picks[i - 1])
})

test('the service advances the angle for practice turns, story branch intact', () => {
  assert.ok(service.includes('if (personalEvidence && storyMode && tier !== 0 && ledgerProjects.length) {'), 'story branch unchanged')
  const branchAt = service.indexOf('} else if (register === "practice" && tier !== 0) {')
  assert.ok(branchAt > 0, 'practice branch exists')
  const recordAt = service.indexOf('recordAngle(ledger, angle)', branchAt)
  assert.ok(recordAt > branchAt, 'practice branch records the picked angle')
  assert.ok(service.includes('(storyMode || register === "practice") && angle && tier !== 0 && plan.kind !== "code"'), 'fresh-angle line covers practice turns')
  assert.ok(!service.includes('register === "concept" && angle'), 'no angle is picked for concept turns')
})
