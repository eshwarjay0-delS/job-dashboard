// A design or failure scenario is hypothetical: Kompas says what it would do and expect, never invented results.
// Measured 26 Oct 2026 (evaluation round 2, grounding 2.78/4): scenarios were told as finished events with
// achieved numbers, sign-offs and named owners, and the architect guidance itself said "how it was built".
import test from 'node:test'
import assert from 'node:assert/strict'

const R = await import('../../src/lib/kompasDesktopResponse.ts')

test('a design or failure scenario is spoken as would-do, with no achieved outcome and no named person', () => {
  for (const level of ['engineer', 'architect', 'director']) {
    const g = R.desktopResponsePolicy(level, 'In that design, rotating a signing key breaks one region. Walk through diagnosis, competing hypotheses, safe containment and rollback.').guidance
    assert.match(g, /hypothetical unless the candidate's own sources document it/)
    assert.match(g, /Never state an outcome as having happened/)
    assert.match(g, /never a named person/)
  }
  const architect = R.desktopResponsePolicy('architect', 'Design tenant isolation across API, cache and asynchronous workers.').guidance
  assert.match(architect, /how you would build, configure, and integrate it/)
  assert.doesNotMatch(architect, /how it was built/)
  assert.match(R.desktopResponsePolicy('director', 'Design tenant isolation across API, cache and asynchronous workers.').guidance, /the result you would expect and how you would measure it/)
})

test('the candidate\'s own experience keeps its real-example contract', () => {
  const g = R.desktopResponsePolicy('architect', 'Describe a vulnerability you personally discovered and the impact.').guidance
  assert.match(g, /Use one supported real example/)
  assert.doesNotMatch(g, /hypothetical unless/)
})
