// The product is an authentic human way of speaking (owner, 26 Oct 2026: "Dont change any realistic presentations
// things or depth of speaking like a authentic human. Our product purpose alone is that."). A correctness fix may
// add a technical constraint, never a register change: the 26 Oct round-4 rule that forced "would / if-then" wording
// and banned concrete outcomes was taken back out, and this test holds the original voice in place.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const R = await import('../../src/lib/kompasDesktopResponse.ts')

test('the realistic voice stays: built, set up and integrated, and the operation\'s result', () => {
  const architect = R.desktopResponsePolicy('architect', 'Design tenant isolation across API, cache and asynchronous workers.').guidance
  assert.match(architect, /Explain how it was built, configured, and integrated, bit by bit/)
  assert.match(R.desktopResponsePolicy('director', 'Design tenant isolation across API, cache and asynchronous workers.').guidance, /the result the operation can use/)
  for (const level of ['engineer', 'architect', 'director']) {
    const g = R.desktopResponsePolicy(level, 'In that design, rotating a signing key breaks one region. Walk through diagnosis, competing hypotheses, safe containment and rollback.').guidance
    assert.doesNotMatch(g, /would and if-then|Never state an outcome as having happened|never a named person/)
  }
})

test('the candidate\'s own experience keeps its real-example contract', () => {
  const g = R.desktopResponsePolicy('architect', 'Describe a vulnerability you personally discovered and the impact.').guidance
  assert.match(g, /Use one supported real example/)
})

test('the director opening is the owner\'s own wording', () => {
  const route = readFileSync(new URL('../../src/lib/kompasAnswerService.ts', import.meta.url), 'utf8')
  const answer = readFileSync(new URL('../../src/lib/kompasAnswer.ts', import.meta.url), 'utf8')   // DIRECTOR_OPENING lives here
  assert.match(answer, /Name the decision owner in that sentence\. Before closing/)
  assert.match(route, /cover every one inside your natural spoken answer, the same voice and depth as always/)
})
