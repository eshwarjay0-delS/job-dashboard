// Owner, 29 Oct 2026: "Get rid of walkthroughs. If there was a follow up then explain
// walkthroughs and it should generate code everywhere live non live doesn't matter."
// That supersedes the 23 Oct 2026 no-code rule in full. The coding path is one pipeline
// for live AI Answer and for Screen Answer (the screen route extracts the question only;
// the client then uses the existing grounded answer pipeline), so one rule covers both.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const service = read('src/lib/kompasAnswerService.ts')

// The detector is a regex literal in the service source; evaluate that literal alone,
// so the test exercises the real pattern rather than a copy of it.
const match = service.match(/const CODE_ASK_Q =\n\s*(\/.*\/i)/)
assert.ok(match, 'CODE_ASK_Q literal found in the service')
// eslint-disable-next-line no-eval
const CODE_ASK_Q = eval(match[1])

test('a bare code ask is detected as coding, not as prose', () => {
  for (const q of ['Give me python code', 'write a python code', 'Give me a Python program for prime numbers.', 'write a python code for this problem']) {
    assert.ok(CODE_ASK_Q.test(q), q)
  }
  for (const q of ['What is a certificate?', 'Print 108 using 9 and 12', 'Define NIST CSF risk assessments.']) {
    assert.ok(!CODE_ASK_Q.test(q), q)
  }
})

test('the coding block gives code first and reserves walkthroughs for follow-up explanations', () => {
  assert.ok(service.includes('Give the code FIRST as one fenced, runnable block'), 'code first, fenced, runnable')
  assert.ok(service.includes('No walkthrough before it'), 'no walkthrough before the code')
  assert.ok(service.includes('If the question asks to explain, walk through, or understand code already given'), 'follow-up explanations')
  assert.ok(service.includes('If a follow-up asks to change the code, give the updated fenced block'), 'follow-up changes give code')
  assert.ok(!service.includes('show no code'), 'the no-code rule is gone')
  assert.ok(!service.includes('No code blocks, no inline code'), 'the no-code ban is gone')
  assert.ok(service.includes('29 Oct 2026'), 'the override is dated in the code')
})

test('the coding closer rides in the answer request itself, overriding the spoken closer', () => {
  assert.ok(service.includes('CODING OVERRIDE'), 'closer names itself an override')
  assert.ok(service.includes('No walkthrough before the code'), 'closer repeats the no-walkthrough rule')
  assert.ok(service.includes('CODE_ASK_Q.test(question) ? CODING_CLOSER'), 'for a code ask only the coding closer rides, no spoken closer to override')
})

test('the card renders fenced blocks as code, so the block is displayable', () => {
  const app = read('public/kompas/app.js')
  assert.ok(app.includes('kind: "code"'), 'fenced sections become code parts')
  assert.ok(app.includes('className = "codeblock"'), 'code parts render as code blocks')
})

test('a Director code ask carries no one-line mechanism compression', () => {
  assert.ok(service.includes('For this code question, the CODING block below is the controlling spec'), 'coding block controls a code ask')
  assert.ok(service.includes('CODE_ASK_Q.test(question) ? "" : tier === 0'), 'level guidance is suppressed for a code ask')
  assert.ok(service.includes('shape && !CODE_ASK_Q.test(question)'), 'prose shape is suppressed for a code ask')
  assert.ok(service.includes('level === "director" && !CODE_ASK_Q.test(question) ? DIRECTOR_OPENING'), 'Director opening is suppressed for a code ask')
  assert.ok(service.includes('the fenced code block sits outside the spoken-word budget'), 'fenced block sits outside the spoken ceiling')
  assert.ok(service.includes('never collapsed to a single line and never written inline'), 'block is never collapsed to one line or written inline')
  assert.ok(service.includes('the Director opening, the audience delivery, and the spoken-word ceiling'), 'closer names every block it overrides')
})
