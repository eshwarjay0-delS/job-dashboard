import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync} from 'node:fs'

// Audit low (31 Oct 2026): code-detector divergence unconfirmed. There are
// three detectors, and the live answer request runs two of them on the same
// question:
//   A: service CODE_ASK_Q (kompasAnswerService) — the prompt gate. A match
//      selects the CODING mode block, suppresses level compression, and
//      closes with CODING_CLOSER (code first, Oct 29 owner directive).
//   B: kompasAnswer CODE_REQUEST — the plan gate. The service imports
//      lengthPlan from kompasAnswer, and a match sets plan.kind = "code".
//   C: dissection CODE_REQUEST_Q, via asksForCode — the surface gate. Its
//      own comment says it is deliberately narrowed to an actual request
//      for code, so a passing mention of "function" is not forced into a
//      code block. It currently has no live caller (see below), so the
//      narrowing it promises is not enforced anywhere in the live path.
// The regexes are extracted from source at test time, never copied here,
// so a drifted copy cannot pass while the shipped patterns disagree.
// For single standalone questions, asksForCode(q) === CODE_REQUEST_Q.test(q)
// (splitFollowUp returns no previous part without a follow-up tag).
function extractRegex(src, name) {
  const m = src.match(new RegExp('const ' + name + '[^=]*=\\s*(\\/[^\\n]*\\/i)'))
  assert.ok(m, name + ' literal found in source')
  const lit = m[1]
  const flags = lit.slice(lit.lastIndexOf('/') + 1)
  assert.ok(!flags.includes('g'), name + ' must not be global (stateful .test)')
  return eval(lit)
}

const serviceSrc = readFileSync('src/lib/kompasAnswerService.ts', 'utf8')
const answerSrc = readFileSync('src/lib/kompasAnswer.ts', 'utf8')
const dissectionSrc = readFileSync('src/lib/kompasDissection.ts', 'utf8')
const A = extractRegex(serviceSrc, 'CODE_ASK_Q')
const B = extractRegex(answerSrc, 'CODE_REQUEST')
const C = extractRegex(dissectionSrc, 'CODE_REQUEST_Q')

// [question, service CODE_ASK_Q, plan CODE_REQUEST, surface CODE_REQUEST_Q]
const probes = [
  // A-only: bare topic keywords the service treats as code asks, though
  // nothing requests code. "what is an array" is also a concept question,
  // which the Oct 22 rule says stays abstract at every level.
  ['reverse a string', true, false, false],
  ['two sum', true, false, false],
  ['what is a palindrome', true, false, false],
  ['what is an array', true, false, false],
  ['time complexity of quicksort', true, false, false],
  ['debug this', true, false, false],
  ['the function handles auth', true, false, false],
  // B-only: verb + bare object the plan calls code, but the service does not.
  ['give me the query', false, true, false],
  ['show me the script', false, true, false],
  // A+B, C no: bare "the code" satisfies the plan but not the narrowed
  // surface detector, which needs a second object word after the code.
  ['show me the code', true, true, false],
  ['give me the code', true, true, false],
  // A+C, B no: narrowed phrases with no plan verb.
  ['unit test for login', true, false, true],
  ['sql query for top customers', true, false, true],
  // All three agree: a real request for code.
  ['write a function to sort a list', true, true, true],
  ['implement a function', true, true, true],
  ['write code to parse JSON', true, true, true],
  // None: ordinary non-code asks.
  ['what is an API', false, false, false],
  ['explain recursion', false, false, false],
]

test('the three code detectors disagree on the same questions', () => {
  for (const [q, a, b, c] of probes) {
    assert.equal(A.test(q), a, `service CODE_ASK_Q on ${JSON.stringify(q)}`)
    assert.equal(B.test(q), b, `plan CODE_REQUEST on ${JSON.stringify(q)}`)
    assert.equal(C.test(q), c, `surface CODE_REQUEST_Q on ${JSON.stringify(q)}`)
  }
})

test('the narrowed surface detector never fires where the service does not', () => {
  for (const [q, a, , c] of probes) {
    assert.ok(!(c && !a), `surface-only case: ${JSON.stringify(q)}`)
  }
})

test('both live gates run in the same answer request', () => {
  assert.ok(serviceSrc.includes('lengthPlan(tier, question'), 'service calls lengthPlan')
  assert.ok(serviceSrc.includes('from "@/lib/kompasAnswer"'), 'lengthPlan comes from kompasAnswer')
  assert.ok(answerSrc.includes('(CODE_REQUEST.test(q) ? "code" : "")'), 'plan kind comes from CODE_REQUEST')
  assert.ok(serviceSrc.includes('if (CODE_ASK_Q.test(question)) return MODE_BLOCKS.coding'), 'prompt coding block comes from CODE_ASK_Q')
  assert.ok(serviceSrc.includes('CODE_ASK_Q.test(question) ? CODING_CLOSER'), 'code closer comes from CODE_ASK_Q')
})

test('the surface gate currently has no live caller', () => {
  const libFiles = readdirSync('src/lib').filter((f) => f.endsWith('.ts'))
  const callers = libFiles.filter((f) => f !== 'kompasSurfaceRule.ts' && readFileSync('src/lib/' + f, 'utf8').includes('codeFirstExpected'))
  assert.deepEqual(callers, [], 'codeFirstExpected must stay uncalled, or this divergence reaches the surface too')
  const importers = libFiles.filter((f) => f !== 'kompasSurfaceRule.ts' && readFileSync('src/lib/' + f, 'utf8').includes('kompasSurfaceRule'))
  assert.deepEqual(importers, [], 'kompasSurfaceRule must stay unimported, or re-check the divergence impact')
})
