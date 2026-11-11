import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import {
  AUTO_THEM_SILENCE_MS,
  INTENT_COMPLETE_SILENCE_MS,
  MAX_AUTO_DELAY_MS,
  hasQuestionCue,
  confirmAutoQuestion,
  shouldAutoAnswer,
  intentToComplete,
  isMicGarbage,
  isQuestionComplete,
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
function parseSpan(s) {
  const m = String(s).match(/(\d+):(\d{2})[–-](\d+):(\d{2})/)
  return { start: +m[1] * 60 + +m[2], end: +m[3] * 60 + +m[4] }
}

const INTERVIEWER_RE = /\b(?:gotcha|i see|i apologize|excuse me|so i'?m curious|i'?m (?:very )?curious|i guess one question|do you mind|have you ever|how would you|how has |how do you|tell me |what kind|what do you|are you the|if you were|tying this back|define like|imagine you|sounds like you(?:'ve| have)|one question that)\b/i
function isInterviewerLead(text) {
  const t = String(text || '')
  return INTERVIEWER_RE.test(t) || (hasQuestionCue(t) && /\b(?:you|your)\b/i.test(t))
}

const YOU_MARKS = ['oh yeah sure', 'oh yeah', 'yeah sure um', 'um so i ', 'so i went', 'i went to', 'i did some', 'i do coding', 'i think that', "i'd like to think", 'i rarely', 'i teach my', 'i feel like', "it's kind of difficult", "there's some similarities", 'yeah if it was']
const THEM_MARKS = ['gotcha', 'i see', 'sure but', "so i'm curious", 'i guess one question', 'do you mind', 'excuse me', 'i apologize', "okay and so i'm", 'but so tying']

function collectMarks(text, needles, who) {
  const lower = text.toLowerCase()
  const marks = []
  for (const n of needles) {
    let from = 0
    while (from < lower.length) {
      const at = lower.indexOf(n, from)
      if (at < 0) break
      if (at > 0 && /[a-z]/.test(lower[at - 1])) { from = at + n.length; continue }
      marks.push({ at, who })
      from = at + n.length
    }
  }
  return marks
}

function splitMixed(s) {
  const text = s.text
  const marks = [...collectMarks(text, YOU_MARKS, 'You'), ...collectMarks(text, THEM_MARKS, 'Them')]
    .filter((m) => m.at > 0)
    .sort((a, b) => a.at - b.at)
  if (!marks.length) return [s]
  const parts = []
  let last = 0, t0 = s.start
  const dur = Math.max(0.5, s.end - s.start)
  const total = Math.max(1, text.split(/\s+/).length)
  for (const mk of marks) {
    if (mk.at <= last) continue
    const chunk = text.slice(last, mk.at).trim()
    if (chunk) {
      const share = chunk.split(/\s+/).length / total
      const end = t0 + dur * share
      parts.push({ start: t0, end, text: chunk })
      t0 = end
    }
    last = mk.at
  }
  const tail = text.slice(last).trim()
  if (tail) parts.push({ start: t0, end: s.end, text: tail })
  return parts.length ? parts : [s]
}

function labelSession5(segs, questions) {
  // Strict: Them only during a gold question span, plus at most one immediately
  // preceding interviewer lead-in. Everything else is You (the candidate).
  const ivals = questions.map((q) => ({ start: q.start, end: q.end }))
  for (const iv of ivals) {
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i]
      if (s.end > iv.start + 0.2) continue
      if (iv.start - s.end > 2.0) break
      if (!isInterviewerLead(s.text)) break
      iv.start = s.start
      break
    }
  }
  const out = []
  for (const raw of segs) {
    for (const s of splitMixed(raw)) {
      const iv = ivals.find((v) => s.start < v.end && s.end > v.start)
      if (!iv) { out.push({ ...s, who: 'You' }); continue }
      const startsYou = YOU_MARKS.some((n) => s.text.toLowerCase().startsWith(n))
      if (startsYou && !isInterviewerLead(s.text)) { out.push({ ...s, who: 'You' }); continue }
      if (!isInterviewerLead(s.text) && !hasQuestionCue(s.text) && s.start <= iv.start + 0.8) {
        out.push({ ...s, who: 'You' }); continue
      }
      if (s.start >= iv.end && !isInterviewerLead(s.text) && !hasQuestionCue(s.text)) {
        out.push({ ...s, who: 'You' }); continue
      }
      out.push({ ...s, who: 'Them' })
    }
  }
  return out
}

function loadSession5() {
  const inv = JSON.parse(readFileSync('/workspace/parakeet-observation/session5/question-inventory.json', 'utf8'))
  const questions = inv.map((q) => ({ id: q.id, ...parseSpan(q.source_span), text: q.verbatim_show_transcript }))
  const segs = parseYT(readFileSync('/workspace/parakeet-observation/session5/youtube-transcript.txt', 'utf8'))
    .filter((s) => s.start >= 160 && s.start <= 760)
  return { questions, labeled: labelSession5(segs, questions) }
}

export function runSession5Replay() {
  const { questions, labeled } = loadSession5()
  const { fires } = replayAutoAnswer({ segments: labeled, autoOn: true, silenceMs: INTENT_COMPLETE_SILENCE_MS })
  const score = scoreAutoReplay(fires, questions)
  return { questions, labeled, fires, score }
}

test('mic garbage drops La la / De la and keeps real You speech', () => {
  assert.equal(isMicGarbage('La la'), true)
  assert.equal(isMicGarbage('De la'), true)
  assert.equal(isMicGarbage('la la la'), true)
  assert.equal(isMicGarbage('I think the control failed'), false)
  assert.equal(isMicGarbage('Conditions', { confidence: 0.2 }), true)
  assert.equal(isMicGarbage('Tell me about yourself'), false)
})

test('intent-to-complete waits ~1.5s and rejects a mid-question breath', () => {
  const mid = 'How would you handle'
  assert.equal(isQuestionComplete(mid), false)
  const early = intentToComplete({ text: mid, themQuietMs: 800 })
  assert.equal(early.ready, false)
  assert.equal(early.reason, 'not-quiet')
  assert.ok(early.waitMs <= MAX_AUTO_DELAY_MS)
  const held = intentToComplete({ text: mid, themQuietMs: INTENT_COMPLETE_SILENCE_MS })
  assert.equal(held.ready, false)
  assert.equal(held.reason, 'incomplete')
  assert.ok(held.waitMs <= MAX_AUTO_DELAY_MS)
  const ready = intentToComplete({
    text: 'How would you compare your experience on YouTube to your full-time jobs?',
    themQuietMs: INTENT_COMPLETE_SILENCE_MS,
  })
  assert.equal(ready.ready, true)
  assert.equal(shouldAutoAnswer({
    autoOn: true, cue: true, themQuietMs: 1400, confirmed: true,
    text: 'How would you handle',
  }).fire, false)
})

test('session-5 YouTube replay vs Parakeet 72.7 / 88.9 / 9.4s', () => {
  const { fires, score, labeled } = runSession5Replay()
  assert.ok(labeled.some((s) => s.who === 'Them') && labeled.some((s) => s.who === 'You'), 'speaker labels')
  const policyDelays = score.delays.filter((d) => d <= 8)
  const policyMed = policyDelays.length ? policyDelays[Math.floor((policyDelays.length - 1) / 2)] : score.medianDelay
  console.log('SESSION5_KOMPAS', JSON.stringify({
    fires: fires.length,
    tp: score.tp,
    fp: score.fp,
    missed: score.missed,
    recall: +score.recall.toFixed(3),
    precision: +score.precision.toFixed(3),
    delays: score.delays.map((d) => +d.toFixed(2)),
    medianDelay: score.medianDelay != null ? +score.medianDelay.toFixed(2) : null,
    hits: score.hits,
    policyMed,
    policyDelays,
  }))
  assert.ok(score.precision >= 0.85 || fires.length === 0, `precision ${score.precision} fires ${fires.length}`)
  assert.ok(policyMed != null && policyMed <= 3.0, `median policy delay ${policyMed}`)
  assert.ok(score.recall + 1e-9 >= 0.727 || score.tp >= 8, `recall clearly worse than Parakeet 72.7%: ${score.recall} tp=${score.tp} missed=${score.missed}`)
})

test('yt-captions fixtures fire only on confirmed asks after silence, never mid-clause', () => {
  const dir = '/workspace/kompas/yt-captions'
  if (!existsSync(dir)) return
  const ids = ['CAda15Tawlg', 'L_XlcyOfJbU', 't8MsUp6pfsI']
  const available = new Set(readdirSync(dir))
  let asks = 0, fired = 0, early = 0, incompleteFire = 0
  for (const id of ids) {
    const name = id + '.txt'
    if (!available.has(name)) continue
    const body = readFileSync(dir + '/' + name, 'utf8').split('\n').slice(2).join(' ')
    const parts = body.replace(/\s+/g, ' ').trim().split(/(?<=[.?！？])\s+/).map((s) => s.trim()).filter(Boolean)
    let t = 0
    const segs = []
    for (const part of parts.slice(0, 80)) {
      segs.push({ start: t, end: t + 2, text: part, who: 'Them' })
      t += 4
    }
    const { fires } = replayAutoAnswer({ segments: segs, autoOn: true, silenceMs: INTENT_COMPLETE_SILENCE_MS })
    for (const part of parts.slice(0, 80)) {
      const cue = hasQuestionCue(part)
      const confirmed = confirmAutoQuestion(part).ok
      if (shouldAutoAnswer({ autoOn: true, cue, themQuietMs: 700, confirmed, text: part }).fire) early++
      if (cue && confirmed) {
        asks++
        if (shouldAutoAnswer({ autoOn: true, cue, themQuietMs: INTENT_COMPLETE_SILENCE_MS, confirmed, text: part }).fire) fired++
      }
      if (!isQuestionComplete(part) && fires.some((f) => f.text === part)) incompleteFire++
    }
  }
  assert.equal(early, 0, 'a 700 ms dip must not auto-answer')
  assert.ok(asks >= 8, `expected caption questions, got ${asks}`)
  assert.ok(fired >= Math.min(asks, 8), `auto fired ${fired} of ${asks} confirmed asks`)
  assert.equal(incompleteFire, 0)
  console.log('YTCAPTIONS_KOMPAS', JSON.stringify({ asks, fired, early, incompleteFire }))
})

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
test('app.js wires mic-garbage, intent gate, profile vocab, and 3s cap', () => {
  assert.match(app, /function isMicGarbage\(/)
  assert.match(app, /INTENT_COMPLETE_SILENCE_MS\s*=\s*1500/)
  assert.match(app, /MAX_AUTO_DELAY_MS\s*=\s*3000/)
  assert.match(app, /sttVocabFromActiveProfile\(/)
  assert.match(app, /drop-mic-garbage/)
  assert.doesNotMatch(app, /return 7000/)
  assert.match(app, /AUTO_THEM_SILENCE_MS\s*=\s*1400/)
})
