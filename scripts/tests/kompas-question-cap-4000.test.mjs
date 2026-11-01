import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {questionToAnswer, cutQuestion} from '../../src/lib/kompasAnswer.ts'

// Audit low (31 Oct 2026): the formed question was capped at 2000 chars at
// every stage, always head-keep, so an over-long composed question lost its
// NEWEST ask — the tail. That collides with the 31 Oct re-press rule, where
// everything kept concatenates and the four-ask cap lifts: four substantial
// asks run past 2000 chars, and the cap cut the very part the re-press
// chained back in. The cap is now 4000 everywhere on the question path,
// matching the heard window (heardAll and transcript are already 4000): a
// composed question can carry everything the heard material holds, and a
// bound still exists so runaway re-press chaining cannot grow unboundedly.
// Typical questions are unchanged — the cap only bites past 4000 chars.
const appJs = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const service = readFileSync(new URL('../../src/lib/kompasAnswerService.ts', import.meta.url), 'utf8')
const answerLib = readFileSync(new URL('../../src/lib/kompasAnswer.ts', import.meta.url), 'utf8')

const ask = (n, pad) => `How do you handle part ${n} ${'detail '.repeat(pad).trim()}?`
const four = [1, 2, 3, 4].map((n) => ask(n, 110)).join(' ')

test('a four-ask pinned question over 2000 chars survives whole', () => {
  assert.ok(four.length > 2000 && four.length <= 4000, `fixture must sit between the old and new caps, got ${four.length}`)
  const out = questionToAnswer('', four, true)
  for (const n of [1, 2, 3, 4]) assert.ok(out.includes(`part ${n}`), `ask ${n} survives`)
  assert.equal(out.length, four.length)
})

test('cutQuestion keeps a four-ask window over 2000 chars', () => {
  const out = cutQuestion(four)
  assert.ok(out.length > 2000, `window output must exceed the old cap, got ${out.length}`)
  for (const n of [1, 2, 3, 4]) assert.ok(out.includes(`part ${n}`), `ask ${n} survives the window`)
})

test('every stage on the question path caps at 4000, not 2000', () => {
  assert.ok(appJs.includes('function heardAsQuestion(lines) { return lines.map(t => t.text).join(" ").replace(/\\s+/g, " ").trim().slice(0, 4000); }'))
  assert.ok(appJs.includes('.map(p => p.text).join(" ").replace(/\\s+/g, " ").trim().slice(0, 4000)'), 'client derived cap')
  assert.ok(!appJs.includes('card.question = plainHeard.replace(/\\s+/g, " ").trim().slice(0, 2000)'), 'no card cap left at 2000')
  assert.ok(service.includes('const asked = str(body.derived, 4000)'), 'server derived cap')
  const qta = answerLib.slice(answerLib.indexOf('export function questionToAnswer'))
  assert.ok(!qta.slice(0, qta.indexOf('export function topicFragment')).includes('slice(0, 2000)'), 'no questionToAnswer cap left at 2000')
  assert.ok(answerLib.includes('return (q.charAt(0).toUpperCase() + q.slice(1)).slice(0, 4000)'), 'cutQuestion window cap')
})
