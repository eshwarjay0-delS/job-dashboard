import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import {
  INTENT_COMPLETE_SILENCE_MS,
  MAX_AUTO_DELAY_MS,
  hasQuestionCue,
  replayAutoAnswer,
  scoreAutoReplay,
} from '../../src/lib/kompasAutoAnswer.ts'

function parseYT(raw) {
  const lines = String(raw).split(/\n/)
  const segs = []
  let i = 0
  const isTime = (s) => /^(?:\d+:)?\d+:\d{2}$/.test(s.trim())
  const toSec = (s) => {
    const p = s.trim().split(':').map(Number)
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
  }
  while (i < lines.length) {
    if (!isTime(lines[i])) { i++; continue }
    const t = toSec(lines[i++])
    const buf = []
    while (i < lines.length && !isTime(lines[i])) {
      if (lines[i].trim()) buf.push(lines[i].trim())
      i++
    }
    segs.push({ start: t, text: buf.join(' ') })
  }
  for (let k = 0; k < segs.length; k++) {
    const words = Math.max(1, segs[k].text.split(/\s+/).filter(Boolean).length)
    const spokenEnd = segs[k].start + Math.min(12, 0.35 * words + 0.4)
    const next = k + 1 < segs.length ? segs[k + 1].start : segs[k].start + 3
    segs[k].end = Math.min(next, spokenEnd)
  }
  return segs
}

function inPlayedWindow(s) {
  // Session 6 played 2:18–~6:56, then seeked to 31:42 and played to ~36:52.
  return (s.start < 416 && s.end > 138) || (s.start < 2212 && s.end > 1902)
}

const QUESTIONS = [
  {
    id: 'Q2',
    start: 2 * 60 + 46,
    end: 6 * 60 + 39,
    text: 'imagine you are moving and you want to find an apartment on a single street of blocks that minimizes the farthest distance you would have to walk to reach all required buildings gym school store sample input the answer would be index three',
  },
  {
    id: 'Q6',
    start: 34 * 60 + 6,
    end: 34 * 60 + 20,
    text: 'can you remind me the reason that when you go from right to left you skip the final index what is the logic behind that',
  },
  {
    id: 'Q7',
    start: 34 * 60 + 48,
    end: 35 * 60 + 3,
    text: 'for the finding the minimum index just walk me through out loud what you would do',
  },
  {
    id: 'Q8',
    start: 36 * 60 + 32,
    end: 36 * 60 + 40,
    text: 'could you walk me through the time and space complexity of this algorithm',
  },
]

const YOU_FORCE = [
  { start: 6 * 60 + 48, end: 6 * 60 + 56, text: 'can they be only three things that is gym school and store or they can be more number of things' },
]

const YOU_TAKES = ['yeah so you just', 'yes so uh', 'yeah so uh', 'yeah okay so can they']

function splitYouTakeover(s) {
  const lower = s.text.toLowerCase()
  let at = -1
  for (const n of YOU_TAKES) {
    const i = lower.indexOf(n)
    if (i > 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return [s]
  const dur = Math.max(0.4, s.end - s.start)
  const total = Math.max(1, s.text.split(/\s+/).length)
  const head = s.text.slice(0, at).trim()
  const tail = s.text.slice(at).trim()
  const mid = s.start + dur * (head.split(/\s+/).filter(Boolean).length / total)
  const out = []
  if (head) out.push({ start: s.start, end: mid, text: head })
  if (tail) out.push({ start: mid, end: s.end, text: tail, forceYou: true })
  return out.length ? out : [s]
}

function labelSession6(segs, questions) {
  const ivals = questions.map((q) => ({ start: q.start, end: q.end }))
  const out = []
  for (const raw of segs.filter(inPlayedWindow)) {
    for (const s of splitYouTakeover(raw)) {
      const forced = s.forceYou || YOU_FORCE.find((y) => s.start < y.end && s.end > y.start)
      if (forced) { out.push({ ...s, who: 'You' }); continue }
      const iv = ivals.find((v) => s.start < v.end && s.end > v.start)
      out.push({ ...s, who: iv ? 'Them' : 'You' })
    }
  }
  return out
}

const ytPath = [
  '/workspace/parakeet-observation/session6/youtube-transcript.txt',
  new URL('../../../parakeet-observation/session6/youtube-transcript.txt', import.meta.url).pathname,
].find((p) => existsSync(p))

test('session-6 YouTube transcript is available for the Auto replay', () => {
  assert.ok(ytPath, 'session6 youtube-transcript.txt should exist')
})

const raw = ytPath ? readFileSync(ytPath, 'utf8') : ''
const segs = raw ? parseYT(raw) : []
function windowOf(labeled, a, b) {
  return labeled.filter((s) => s.start < b && s.end > a)
}
const labeled = segs.length ? labelSession6(segs, QUESTIONS) : []
// Replay the two played windows separately so a seek does not carry a stale pending ask.
const fires = labeled.length
  ? [
      ...replayAutoAnswer({ segments: windowOf(labeled, 138, 416), autoOn: true, silenceMs: INTENT_COMPLETE_SILENCE_MS }).fires,
      ...replayAutoAnswer({ segments: windowOf(labeled, 1902, 2212), autoOn: true, silenceMs: INTENT_COMPLETE_SILENCE_MS }).fires,
    ]
  : []
const score = scoreAutoReplay(fires, QUESTIONS)

test('session-6 Auto replay beats Parakeet on substantive recall, precision, and delay', () => {
  assert.ok(labeled.length > 10, 'expected played-window captions')
  // Parakeet: 1/4 recall (25%), 1/2 precision, median ~56 s. Q8 was right-censored for Parakeet.
  assert.ok(score.recall >= 0.5, `recall ${score.tp}/${QUESTIONS.length} = ${score.recall}`)
  assert.ok(score.precision >= 0.85 || (score.fp === 0 && score.tp >= 2), `precision ${score.tp}/${fires.length} = ${score.precision}; hits=${JSON.stringify(score.hits)} fires=${JSON.stringify(fires.map((f) => ({ at: f.at, text: f.text.slice(0, 80) })))}`)
  if (score.medianDelay != null) {
    assert.ok(score.medianDelay <= MAX_AUTO_DELAY_MS / 1000 + 2, `median delay ${score.medianDelay}s`)
  }
  // Candidate clarification 6:48–6:56 must not become a card (Parakeet FP).
  for (const f of fires) {
    assert.doesNotMatch(f.text, /can they be only three things/i)
    assert.ok(f.at < 6 * 60 + 48 || f.at > 7 * 60, `fire at ${f.at} overlaps the candidate clarification`)
  }
})

test('session-6 Auto replay reports numbers for the Chief brief', () => {
  const q8 = score.hits.find((h) => 'id' in h && h.id === 'Q8')
  const withoutQ8 = scoreAutoReplay(fires.filter((f) => !(q8 && Math.abs(f.at - (QUESTIONS[3].end + INTENT_COMPLETE_SILENCE_MS / 1000)) < 5) || true), QUESTIONS.slice(0, 3))
  // Always print the score so the fold-in docs can quote it.
  console.log(JSON.stringify({
    fires: fires.map((f) => ({ at: Number(f.at.toFixed(2)), mmss: `${Math.floor(f.at / 60)}:${String(Math.floor(f.at % 60)).padStart(2, '0')}`, text: f.text.slice(0, 140) })),
    score: {
      tp: score.tp,
      fp: score.fp,
      missed: score.missed,
      recall: score.recall,
      precision: score.precision,
      delays: score.delays,
      medianDelay: score.medianDelay,
      hits: score.hits,
    },
    policySilenceMs: INTENT_COMPLETE_SILENCE_MS,
    parakeet: { recall: '1/4', precision: '1/2', medianDelay: 56 },
  }, null, 2))
  assert.ok(score.tp + score.fp === fires.length)
  void withoutQ8
  void hasQuestionCue
})
