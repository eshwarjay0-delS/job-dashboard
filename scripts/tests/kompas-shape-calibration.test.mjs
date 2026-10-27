// Live-answer calibration (26 Oct 2026): the 19:25 CDT live round showed two
// structural misses the prose guidance did not prevent — a design answer with
// no rejected alternative, and a director answer that opened with definitions
// instead of the decision — plus a Q3 answer whose hypotheses were never
// numbered ("hypothesis several" three times over). These tests pin the
// structural fixes: a required sentence-two alternative, a director opening
// override, and a numbered-hypotheses shape.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickShape, levelGuidance , missingStructure } from '../../src/lib/kompasAnswer.ts'

test('design shape requires the rejected alternative as sentence two', () => {
  const shape = pickShape('Design multi-cloud controls mapped to NIST 800-53. Explain trust boundaries, data flow, failure isolation, rollout and validation.', 2)
  assert.ok(shape, 'design question should match a shape')
  assert.match(shape, /Sentence two names the one alternative you rejected/)
  assert.match(shape, /this sentence is required, never skipped/)
})

test('competing-hypotheses question gets a numbered-hypotheses shape', () => {
  const shape = pickShape('In that design, audit evidence disagrees with live configuration. Walk through diagnosis, competing hypotheses, safe containment and rollback.', 2)
  assert.ok(shape, 'hypotheses question should match a shape')
  assert.match(shape, /Number each hypothesis in order: 1, 2, 3/)
  assert.match(shape, /never refer to a hypothesis without its number/)
  assert.match(shape, /never write 'several' in place of a number/)
})

test('director practice guidance still leads with the decision', () => {
  assert.match(levelGuidance('director', 'practice'), /Lead with the decision/)
})

test('failure isolation is a technical term, not a personal miss', () => {
  const shape = pickShape('Design multi-cloud controls mapped to NIST 800-53. Explain trust boundaries, data flow, failure isolation, rollout and validation.', 2)
  assert.ok(shape, 'design question should match a shape')
  assert.doesNotMatch(shape, /Sentence one owns it/)
  const personal = pickShape('Tell me about a time you failed to meet a deadline.', 2)
  assert.ok(personal, 'personal failure question should still match a shape')
  assert.match(personal, /Sentence one owns it/)
})

const DESIGN_SHAPE = "Sentence two names the one alternative you rejected and what it cost."

test('missingStructure flags a design answer with no alternative, passes one with it', () => {
  const opts = { level: "architect", register: "practice", shape: DESIGN_SHAPE, tier: 1 }
  const without = "Trust boundaries are the explicit zones where we decide which component may read or write a given data object. Data flow follows the allowed paths through a queue. Rollout uses a staged blue-green deployment."
  assert.deepEqual(missingStructure(without, opts), ["a sentence naming the one alternative you rejected and what it cost"])
  const withAlt = without + " We rejected a single shared database user because it would have erased the boundary between services, at the cost of one extra credential rotation."
  assert.deepEqual(missingStructure(withAlt, opts), [])
})

test('missingStructure flags a director practice opening with no owner, passes a named one', () => {
  const opts = { level: "director", register: "practice", shape: "", tier: 1 }
  const without = "Risk acceptance means we acknowledge the vulnerability, document its business impact, and decide not to fix it. The owner signed off later."
  assert.deepEqual(missingStructure(without, opts), ["the decision owner named in sentence one"])
  const withOwner = "The product manager decided to accept the risk and own the exception. Remediation was required elsewhere."
  assert.deepEqual(missingStructure(withOwner, opts), [])
  // Intro answers and concept-register directors are out of scope.
  assert.deepEqual(missingStructure(without, { ...opts, tier: 0 }), [])
  assert.deepEqual(missingStructure(without, { ...opts, register: "concept" }), [])
})
