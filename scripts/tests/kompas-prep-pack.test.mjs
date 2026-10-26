// A Kompas session's prep pack (identity, projects, core Q&A) is read out of the model's reply. It failed 170 of 257
// calls in October: the replies were cut at the token ceiling, and a bare JSON.parse also refused a pack in fences.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { parsePrepPack } = await import('../../src/lib/kompasPrepPack.ts')
const pack = { identity: 'I build security programs.', persona: { role: 'Security Engineer' }, projects: [{ id: 'p1', name: 'SIEM' }], questions: [{ q: 'Tell me about yourself', answer: ['a'], tier: 0 }] }

test('a pack is read whether it comes bare, in fences, or after a line of prose', () => {
  for (const text of [JSON.stringify(pack), '```json\n' + JSON.stringify(pack, null, 2) + '\n```', 'Here is the pack:\n' + JSON.stringify(pack)]) {
    const r = parsePrepPack(text)
    assert.equal(r.ok, true, text.slice(0, 30))
    assert.deepEqual(r.ok && r.pack.projects, pack.projects)
  }
})

test('a cut-off or empty reply says why instead of a bare failure', () => {
  const whole = JSON.stringify(pack)
  assert.match(parsePrepPack(whole.slice(0, 120)).reason, /cut off/)
  assert.match(parsePrepPack('').reason, /empty/)
  assert.match(parsePrepPack('I cannot help with that.').reason, /no JSON/)
  assert.match(parsePrepPack('{"identity":"x"}').reason, /no questions/)
  assert.match(parsePrepPack('[1,2]').reason, /no JSON object|not an object/)
})

test('the prep route reads the pack through parsePrepPack and logs the reason it failed', () => {
  const route = readFileSync(new URL('../../src/app/api/kompas/prep/route.ts', import.meta.url), 'utf8')
  assert.match(route, /parsePrepPack\(text\)/)
  assert.doesNotMatch(route, /JSON\.parse\(text\)/)
  assert.match(route, /console\.warn\("\[kompas:prep\] failed:"/)
})
