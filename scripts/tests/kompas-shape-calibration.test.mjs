// Live-answer calibration (26 Oct 2026): the 19:25 CDT live round showed two
// structural misses the prose guidance did not prevent — a design answer with
// no rejected alternative, and a director answer that opened with definitions
// instead of the decision — plus a Q3 answer whose hypotheses were never
// numbered ("hypothesis several" three times over). These tests pin the
// structural fixes: a required sentence-two alternative, a director opening
// override, and a numbered-hypotheses shape.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickShape, levelGuidance , missingStructure, STRUCTURE_REPAIR_SYSTEM } from '../../src/lib/kompasAnswer.ts'

test('repair system lets the missing element be written, literally where it names a form (round 13)', () => {
  assert.match(STRUCTURE_REPAIR_SYSTEM, /part of what the interviewer asked for/)
  assert.match(STRUCTURE_REPAIR_SYSTEM, /Hypothesis 1:/)
  assert.match(STRUCTURE_REPAIR_SYSTEM, /do not invent achieved numbers/)
  assert.doesNotMatch(STRUCTURE_REPAIR_SYSTEM, /do not add new claims/)
})

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
  const withAltPhrased = without + " We went with per-service credentials over a single shared database user, accepting one extra credential rotation."
  assert.deepEqual(missingStructure(withAltPhrased, opts), [])
})

test('Director speech does not force an unasked decision owner', () => {
  const opts = { level: 'director', register: 'practice', shape: '', tier: 1 }
  const without = 'Risk acceptance means we acknowledge the vulnerability, document its business impact, and decide not to fix it.'
  const withOwner = 'The product manager decided to accept the risk and own the exception.'
  assert.deepEqual(missingStructure(without, opts), [])
  assert.deepEqual(missingStructure(withOwner, opts), [])
  assert.deepEqual(missingStructure(without, { ...opts, tier: 0 }), [])
  assert.deepEqual(missingStructure(without, { ...opts, register: 'concept' }), [])
})

test('missingStructure flags unnumbered hypotheses, passes numbered ones (rounds 11-12)', () => {
  const q = 'In that design, audit evidence disagrees with live configuration. Walk through diagnosis, competing hypotheses, safe containment and rollback.'
  const shape = pickShape(q, 2)
  assert.match(shape, /Number each hypothesis in order/)
  const opts = { level: 'architect', register: 'practice', shape, tier: 2 }
  const unnumbered = 'Competing hypotheses are then enumerated: a recent code change introduced a regression, a downstream dependency is returning unexpected responses, a resource limit was hit, or a configuration drift altered a feature flag.'
  assert.deepEqual(missingStructure(unnumbered, opts), ['each competing hypothesis numbered in order (Hypothesis 1, Hypothesis 2, ...), with a test attached to each and back-references by number'])
  const numbered = 'Hypothesis 1: a recent code change introduced a regression. For Hypothesis 1 I check the deployment diff. Hypothesis 2: a downstream dependency is returning unexpected responses. For Hypothesis 2 I check the dependency health endpoint.'
  assert.deepEqual(missingStructure(numbered, opts), [])
})

test('explicitly asked decision owner and measures are precision parts (Q5, rounds 11-12)', async () => {
  const { missingQuestionParts, questionParts } = await import('../../src/lib/kompasInterviewPrecision.ts')
  const q = 'Now explain the same incident to a director: risk acceptance versus remediation. State decision owner, business exposure and measures you would track, without inventing achieved numbers.'
  const labels = questionParts(q).map((p) => p.label)
  assert.ok(labels.includes('decision owner'), 'owner part present when explicitly asked')
  assert.ok(labels.includes('measures you would track'), 'measures part present when explicitly asked')
  const round12 = 'Risk acceptance means we acknowledge the vulnerability and consciously decide to live with the potential impact, whereas remediation means we take concrete steps to eliminate or mitigate that vulnerability. Accepting leaves the exposure on the risk register and requires ongoing monitoring.'
  assert.deepEqual(missingQuestionParts(q, round12), ['decision owner', 'measures you would track'])
  const round11 = 'The decision owner is the risk manager or CRO, the business exposure is the potential loss from the accepted risk. We would track the open exception count and any related audit findings to ensure the acceptance remains justified.'
  assert.deepEqual(missingQuestionParts(q, round11), [])
})
