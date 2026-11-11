import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CONTEXT_WINDOW_MS,
  linesInWindow,
  mergeAdjacentAsks,
  resolveReferent,
  resolveLiveQuestion,
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
