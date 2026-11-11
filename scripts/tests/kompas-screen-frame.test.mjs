import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NO_QUESTION_ON_SCREEN,
  classifyScreenFrame,
  routeScreenFrame,
} from '../../src/lib/kompasScreenFrame.ts'

const PROBLEM = `Given a list of blocks on a single street, each block is an apartment
with booleans for nearby buildings. Sample input:

blocks = [
  { "gym": false, "school": true, "store": false },
  { "gym": true, "school": false, "store": false },
  { "gym": true, "school": true, "store": false },
  { "gym": false, "school": true, "store": false },
  { "gym": false, "school": true, "store": true }
]
reqs = ["gym", "school", "store"]

Write a function that returns the block index that minimizes the farthest
distance you would have to walk to reach every required building.`

const CODE = `def apartmentHunting(blocks, reqs):
    n, m = len(blocks), len(reqs)
    dist = [[float("inf")] * m for _ in range(n)]
    for j, req in enumerate(reqs):
        closest = float("inf")
        for i in range(n):
            if blocks[i].get(req):
                closest = i
            dist[i][j] = min(dist[i][j], abs(i - closest) if closest != float("inf") else float("inf"))
        closest = float("inf")
        for i in range(n - 1, -1, -1):
            if blocks[i].get(req):
                closest = i
            dist[i][j] = min(dist[i][j], abs(i - closest) if closest != float("inf") else float("inf"))
    return min(range(n), key=lambda i: max(dist[i]))`

const DIAGRAM = `Street (one line of blocks):
1 1 1 1 1 1 1
+---+---+---+---+---+
| 0 | 1 | 2 | 3 | 4 |
+---+---+---+---+---+
blocks: [{gym: F, school: T, store: F}, ...]`

test('classifies problem, code, diagram, and no-content frames', () => {
  assert.equal(classifyScreenFrame({ text: PROBLEM }), 'problem')
  assert.equal(classifyScreenFrame({ text: CODE }), 'code')
  assert.equal(classifyScreenFrame({ text: DIAGRAM, kind: 'diagram' }), 'diagram')
  assert.equal(classifyScreenFrame({ text: '' }), 'no-content')
  assert.equal(classifyScreenFrame({ text: 'hello' }), 'no-content')
  assert.equal(classifyScreenFrame({ text: 'Two faces beside a blank document' }), 'no-content')
  assert.equal(classifyScreenFrame({ text: 'Explain this code' }), 'problem')
  assert.equal(classifyScreenFrame({ text: 'Which option?' }), 'problem')
})

test('problem route asks for approach, code, and complexity', () => {
  const r = routeScreenFrame({ text: PROBLEM })
  assert.equal(r.kind, 'problem')
  assert.equal(r.generate, true)
  assert.match(r.answerQuestion, /approach/i)
  assert.match(r.answerQuestion, /code/i)
  assert.match(r.answerQuestion, /complexity/i)
  assert.match(r.answerQuestion, /reqs = \["gym", "school", "store"\]/)
  assert.equal(r.combinedAudio, false)
})

test('code route transcribes then reviews, fixes, or continues the visible code', () => {
  const r = routeScreenFrame({
    text: CODE,
    audioQuestion: 'can you walk me through the time and space complexity of this algorithm',
  })
  assert.equal(r.kind, 'code')
  assert.equal(r.generate, true)
  assert.equal(r.combinedAudio, true)
  assert.match(r.answerQuestion, /Transcribe the key visible lines/)
  assert.match(r.answerQuestion, /review, fix, or continue/)
  assert.match(r.answerQuestion, /def apartmentHunting/)
  assert.match(r.answerQuestion, /time and space complexity/)
  assert.doesNotMatch(r.answerQuestion, /generic explanation only/)
})

test('diagram route explains the figure and answers the ask', () => {
  const r = routeScreenFrame({ text: DIAGRAM, kind: 'diagram', audioQuestion: 'find the best apartment block' })
  assert.equal(r.kind, 'diagram')
  assert.match(r.answerQuestion, /Explain the diagram/)
  assert.match(r.answerQuestion, /1 1 1 1/)
  assert.match(r.answerQuestion, /find the best apartment block/)
})

test('no-content says no question on screen and does not invent a greeting', () => {
  const empty = routeScreenFrame({ text: '' })
  assert.equal(empty.kind, 'no-content')
  assert.equal(empty.generate, false)
  assert.equal(empty.display, NO_QUESTION_ON_SCREEN)
  assert.equal(empty.answerQuestion, NO_QUESTION_ON_SCREEN)
  assert.doesNotMatch(empty.answerQuestion, /hi|hello|hey|welcome/i)

  const faces = routeScreenFrame({ text: 'hello' })
  assert.equal(faces.kind, 'no-content')
  assert.equal(faces.generate, false)
  assert.doesNotMatch(faces.answerQuestion, /nice to meet|good luck|welcome/i)
})

test('no-content falls back to the current audio question', () => {
  const r = routeScreenFrame({
    text: '',
    audioQuestion: 'are you excited for this interview',
  })
  assert.equal(r.kind, 'no-content')
  assert.equal(r.generate, true)
  assert.equal(r.combinedAudio, true)
  assert.equal(r.display, 'are you excited for this interview')
  assert.match(r.answerQuestion, /No question on screen/)
  assert.match(r.answerQuestion, /are you excited for this interview/)
})

// Client path: empty extraction must not greet, and must pass the routed brief as derived.
const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const start = app.indexOf('function stripScreenChrome(')
const end = app.indexOf('/* ---- Follow along:')
assert.ok(start >= 0 && end > start)
const screenCode = app.slice(start, end)

function runAnalyse(fetchPayload, extras = {}) {
  const answers = []
  const card = { question: 'Reading the screen…', answer: '…', streaming: true }
  const ctx = {
    current: { id: 'session-a' },
    aiBusy: false,
    aiBusySince: 0,
    AbortSignal,
    addCard: () => card,
    renderCard: () => {},
    performance: { now: () => 0 },
    grabFrame: async () => 'frame',
    fetch: async () => ({ ok: true, json: async () => fetchPayload }),
    slimPrep: () => ({}),
    liveConfig: () => ({}),
    cards: [card],
    idx: 0,
    generateAnswer: async (q, c, opts) => {
      answers.push({ q, opts })
      c.answer = 'Grounded answer'
      c.streaming = false
    },
    status: () => {},
    ...extras,
  }
  vm.createContext(ctx)
  vm.runInContext(screenCode, ctx)
  return ctx.analyseScreen().then(() => ({ card, answers, ctx }))
}

test('analyseScreen keeps a short extracted question as the card title and routes via derived', async () => {
  const { card, answers } = await runAnalyse({ question: 'Explain this code', needsAnswer: true })
  assert.equal(answers.length, 1)
  assert.equal(answers[0].q, 'Explain this code')
  assert.equal(answers[0].opts.pinned, true)
  assert.equal(answers[0].opts.source, 'screen')
  assert.match(String(answers[0].opts.derived), /approach|Transcribe|Explain this code/i)
  assert.equal(card.question, 'Explain this code')
})

test('analyseScreen on a no-content frame says no question on screen and does not greet', async () => {
  const { card, answers } = await runAnalyse({ question: '', needsAnswer: true, frameKind: 'no-content' })
  assert.equal(answers.length, 0)
  assert.equal(card.question, NO_QUESTION_ON_SCREEN)
  assert.equal(card.answer[0], NO_QUESTION_ON_SCREEN)
  assert.equal(card.frameKind, 'no-content')
  assert.doesNotMatch(String(card.answer), /hello|hi there|welcome/i)
})

test('analyseScreen combines a code frame with the current audio question', async () => {
  const { card, answers } = await runAnalyse(
    { question: CODE, needsAnswer: true },
    { pendingHeard: () => [{ who: 'Them', text: 'walk me through the time and space complexity of this algorithm' }], questionSource: () => 'Them' },
  )
  assert.equal(answers.length, 1)
  assert.equal(card.frameKind, 'code')
  assert.match(String(answers[0].opts.derived), /Transcribe the key visible lines/)
  assert.match(String(answers[0].opts.derived), /time and space complexity/)
  assert.match(String(answers[0].opts.derived), /def apartmentHunting/)
})
