import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CONTEXT_WINDOW_MS,
  linesInWindow,
  mergeAdjacentAsks,
  resolveReferent,
  resolveLiveQuestion,
  outstandingInterviewerAsk,
  silencePressResult,
  LISTENING_STATUS,
  SILENCE_LISTEN_MS,
} from '../../src/lib/kompasQuestionResolve.ts'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8')

test('the context window is 90 seconds', () => {
  assert.equal(CONTEXT_WINDOW_MS, 90_000)
  const now = 1_000_000
  const lines = [
    { who: 'Them', text: 'old ask?', at: now - 120_000, seq: 1 },
    { who: 'Them', text: 'Tell me about a conflict you had with a coworker.', at: now - 80_000, seq: 2 },
    { who: 'Them', text: 'How did you resolve it?', at: now - 5_000, seq: 3 },
  ]
  const recent = linesInWindow(lines, now, CONTEXT_WINDOW_MS)
  assert.equal(recent.length, 2)
  assert.doesNotMatch(recent.map((l) => l.text).join(' '), /old ask/)
})

test('adjacent conflict sentences merge into one question', () => {
  const merged = mergeAdjacentAsks([
    'Tell me about a conflict you had with a coworker.',
    'How did you resolve it?',
  ])
  assert.match(merged, /conflict you had with a coworker/i)
  assert.match(merged, /How did you resolve it/i)
})

test('this question resolves to the prior conflict ask', () => {
  const out = resolveReferent(
    'What are interviewers trying to learn from this question?',
    [
      'Tell me about a conflict you had with a coworker. How did you resolve it?',
      'Austin. What are interviewers trying to learn from this question?',
    ],
  )
  assert.match(out, /conflict question/i)
  assert.doesNotMatch(out, /this question/i)
})

test('resolveLiveQuestion matches the observed Parakeet rewrite cases', () => {
  const conflict = resolveLiveQuestion({
    pending: [
      'I want to start with a celebrity question that I see asked in almost every interview.',
      'Tell me about a conflict you had with a coworker.',
      'How did you resolve it?',
    ],
  })
  assert.match(conflict, /conflict/i)
  assert.match(conflict, /resolve it/i)

  const anaphora = resolveLiveQuestion({
    formed: 'What are interviewers trying to learn from this question?',
    context: [
      'Tell me about a conflict you had with a coworker. How did you resolve it?',
      'Datadog. Austin. What are interviewers trying to learn from this question?',
    ],
  })
  assert.match(anaphora, /conflict question/i)
})

test('app.js ships a 90s context window and leaves heard-only formal lines unpinned for derive', () => {
  assert.match(app, /CONTEXT_WINDOW_MS\s*=\s*90_000|CONTEXT_WINDOW_MS\s*=\s*90000/)
  assert.match(app, /function recentContext\(/)
  assert.match(app, /function resolveLiveQuestion\(/)
  // Heard-only formal path still lets the server derive (pinned: !heardOnly).
  assert.match(app, /derived: heardOnly \? undefined : shownSaid, pinned: !heardOnly/)
})

test('the shared-tab preview has Change tab and Stop tab audio', () => {
  assert.match(html, /id="tabPreviewChange"/)
  assert.match(html, /id="tabPreviewStop"/)
  assert.match(app, /function changeSharedTab\(/)
  assert.match(app, /tabPreviewChange/)
  assert.match(app, /tabPreviewStop/)
})


// Session 4 fixtures (rate-limiter mock, 10 Nov 2026). Parakeet failed the
// first three product rules; these tests lock the Kompas desired behavior.

test('session 4: back-to-back interviewer asks merge into one composite question', () => {
  const merged = mergeAdjacentAsks([
    'Will API rate limiter implementations read from the same cache?',
    'Is there a situation to have different rate limiters for different geographies?',
  ])
  assert.match(merged, /same cache/i)
  assert.match(merged, /geograph/i)
  // Not first-only or last-only — the observed Parakeet failures on presses 7 and 10.
  assert.notEqual(merged, 'Will API rate limiter implementations read from the same cache?')
  assert.notEqual(merged, 'Is there a situation to have different rate limiters for different geographies?')

  const live = resolveLiveQuestion({
    pending: [
      'Will API rate limiter implementations read from the same cache?',
      'Is there a situation to have different rate limiters for different geographies?',
    ],
  })
  assert.match(live, /same cache/i)
  assert.match(live, /geograph/i)
})

test('session 4: a silence press with no new interviewer ask returns Listening', () => {
  const quiet = silencePressResult({
    quietMs: 32_000,
    lastQuestion: 'Scenarios for region-specific rate limit rules',
    newInterviewerAsks: [],
  })
  assert.equal(quiet.listening, true)
  assert.equal(quiet.question, LISTENING_STATUS)
  assert.equal(quiet.question, 'Listening')
  assert.ok(32_000 >= SILENCE_LISTEN_MS)

  const also = silencePressResult({
    quietMs: 20_000,
    lastQuestion: 'Strategies to handle rate limiting as a user',
    newInterviewerAsks: ['Strategies to handle rate limiting as a user'],
  })
  assert.equal(also.listening, true)
  assert.equal(also.question, 'Listening')

  const fresh = silencePressResult({
    quietMs: 25_000,
    lastQuestion: 'Strategies to handle rate limiting as a user',
    newInterviewerAsks: ['Why would you use that over anything else?'],
  })
  assert.equal(fresh.listening, false)
  assert.match(fresh.question, /why would you use that/i)

  const tooShort = silencePressResult({
    quietMs: 14_000,
    lastQuestion: 'Strategies to handle rate limiting as a user',
    newInterviewerAsks: [],
  })
  assert.equal(tooShort.listening, false)
})

test('session 4: a candidate turn keeps the outstanding interviewer ask, not the candidate topic', () => {
  const q = outstandingInterviewerAsk([
    { who: 'Them', text: 'Put yourself in the shoes of a user who has been rate limited without malicious intent. What strategies would you use to circumvent that?' },
    { who: 'You', text: 'When integrating with payment API clients like Stripe I would cache requests and batch them.' },
  ])
  assert.match(q, /rate limited without malicious intent|strategies would you use to circumvent/i)
  assert.doesNotMatch(q, /Stripe/i)

  const afterAnswered = outstandingInterviewerAsk(
    [
      { who: 'Them', text: 'What strategies would you use to circumvent that?' },
      { who: 'You', text: 'I would look at the response headers from Stripe.' },
    ],
    { lastAnswered: 'What strategies would you use to circumvent that?' },
  )
  assert.equal(afterAnswered, '')
})
