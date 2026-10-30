// An answer cut off at the token ceiling a few words in is asked again, never served. Measured 26 Oct 2026
// (evaluation round 3, iam-4): "I added a real‑time rev" was the whole answer to a recursive follow-up.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { cutShort } = await import('../../src/lib/kompasAnswer.ts')

test('a reply stopped by the ceiling far short of its target is cut; a finished or full reply is not', () => {
  assert.equal(cutShort('length', 'I added a real‑time rev', 420), true)
  assert.equal(cutShort('length', 'word '.repeat(100), 420), true, 'under a third of the target')
  assert.equal(cutShort('length', 'word '.repeat(200).trim() + '.', 420), false, 'long enough and ends a sentence')
  assert.equal(cutShort('length', 'IDOR is an access-control flaw. CSRF abuses the browser. The fix is a token or same', 120), true, 'stopped mid-sentence')
  assert.equal(cutShort('stop', 'Short and complete.', 420), false, 'the model chose to stop')
  assert.equal(cutShort('length', 'word '.repeat(30).trim() + '.', 80), false, 'a short target is met by a short answer')
})

test('the streaming lane clears the card and asks once more when the reply was cut short', () => {
  const route = readFileSync(new URL('../../src/lib/kompasAnswerService.ts', import.meta.url), 'utf8')
  assert.match(route, /if \(cutShort\(usage\.finish, raw, job\.plan\.words\)\)/)
  assert.ok(/emit\(\{ type: "replace", text: "" \}\)\r?\n(?:\s+gate = newGate\(false\)\r?\n)?\s+return "cut"/.test(route), 'the cut fragment is cleared from the card')   // demo-final: AQ resets the stream gate before the retry
  assert.match(route, /=== "cut" && !askedAgain/)
})
