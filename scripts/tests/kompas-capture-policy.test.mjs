import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dictateStep } from './_dictate-step.mjs'
import {
  SYS_AUDIO_CONSTRAINTS,
  THEM_SILENCE_MS,
  MIC_SILENCE_MS,
  sysShareConstraints,
  silenceMsFor,
  themPauseEndsSegment,
} from '../../src/lib/kompasCapturePolicy.ts'
import { intakeQuestions, questionGroups } from '../../src/lib/kompasQuestionIntake.ts'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8')

test('browser share asks for a tab and raw (unprocessed) audio', () => {
  const c = sysShareConstraints(false)
  assert.equal(c.video.displaySurface, 'browser')
  assert.equal(c.audio.echoCancellation, false)
  assert.equal(c.audio.noiseSuppression, false)
  assert.equal(c.audio.autoGainControl, false)
  assert.equal(c.systemAudio, 'include')
  assert.equal(c.selfBrowserSurface, 'exclude')
  assert.equal(c.preferCurrentTab, false)
  assert.equal(SYS_AUDIO_CONSTRAINTS.echoCancellation, false)
})

test('desktop share still requests audio: true so the native loopback handler stays wired', () => {
  const c = sysShareConstraints(true)
  assert.equal(c.video, true)
  assert.equal(c.audio, true)
})

test('app.js ships the same raw-audio and tab-preference policy', () => {
  assert.match(app, /echoCancellation:\s*false,\s*noiseSuppression:\s*false,\s*autoGainControl:\s*false/)
  assert.match(app, /displaySurface:\s*"browser"/)
  assert.match(app, /preferCurrentTab:\s*false/)
  assert.match(app, /async function requestSysShare\(/)
  assert.match(app, /async function applyRawAudioConstraints\(/)
  assert.match(app, /const THEM_SILENCE_MS = 1400/)
  assert.match(app, /function showTabPreview\(/)
  assert.match(app, /tabPreviewVideo/)
  assert.match(html, /id="tabPreview"/)
  assert.match(html, /id="tabPreviewVideo"/)
})

test('a 700 ms mid-question breath on computer audio does not end the segment; 1500 ms does', () => {
  assert.equal(silenceMsFor('Them'), 1400)
  assert.equal(silenceMsFor('You'), MIC_SILENCE_MS)
  assert.equal(themPauseEndsSegment(700), false)
  assert.equal(themPauseEndsSegment(1399), false)
  assert.equal(themPauseEndsSegment(1401), true)
  assert.equal(THEM_SILENCE_MS, 1400)

  // dictation path: 800 ms of speech, then a 700 ms dip, still listening
  let now = 100
  const cap = { who: 'Them', noise: 0.001, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 0, segStart: now, peak: 0 }
  const vad = { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 }
  for (let i = 0; i < 8; i++) {
    const step = dictateStep(cap, 0.04, now, vad)
    Object.assign(cap, step)
    now += 100
  }
  assert.ok(cap.voiced && cap.speechMs >= 120, 'speech counted')
  let lastAction = 'listen'
  for (let i = 0; i < 7; i++) {
    const step = dictateStep(cap, 0.0004, now, vad)
    Object.assign(cap, step)
    lastAction = step.action
    now += 100
  }
  assert.equal(lastAction, 'listen', '700 ms pause must not end a Them question')
  for (let i = 0; i < 9; i++) {
    const step = dictateStep(cap, 0.0004, now, vad)
    Object.assign(cap, step)
    lastAction = step.action
    now += 100
  }
  assert.equal(lastAction, 'end', 'a 1.4 s+ pause ends the Them segment for transcription')
})

test('mic silence wait is unchanged at 1100 ms', () => {
  let now = 100
  const cap = { who: 'You', noise: 0.001, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 0, segStart: now }
  const vad = { SILENCE_MS: 1100, MAX_SEG_MS: 28000, IDLE_RECYCLE_MS: 6000 }
  for (let i = 0; i < 8; i++) {
    Object.assign(cap, dictateStep(cap, 0.04, now, vad))
    now += 100
  }
  let action = 'listen'
  for (let i = 0; i < 10; i++) {
    const step = dictateStep(cap, 0.0004, now, vad)
    Object.assign(cap, step)
    action = step.action
    now += 100
  }
  assert.equal(action, 'listen', 'mic still waits the full 1100 ms')
  for (let i = 0; i < 3; i++) {
    const step = dictateStep(cap, 0.0004, now, vad)
    Object.assign(cap, step)
    action = step.action
    now += 100
  }
  assert.equal(action, 'end')
})

function captionQuestions(raw) {
  const body = String(raw || '').split('\n').slice(2).join(' ')
  const text = body.replace(/\s+/g, ' ').trim()
  const parts = text.split(/(?<=[.?！？])\s+/).map((s) => s.trim()).filter(Boolean)
  return parts.filter((s) => /\?/.test(s) || /^(?:what|why|how|when|where|which|who|tell me|walk me|describe|explain)\b/i.test(s))
}

test('intake concatenates a split interviewer question from caption-derived fragments', () => {
  const fragments = [
    'Can you walk me through how you would design',
    'a rate limiter for a public API under heavy load?',
  ]
  const joined = questionGroups(fragments)
  assert.equal(joined.length, 1, 'two fragments stay one question')
  const formed = intakeQuestions(fragments)
  assert.equal(formed.length, 1)
  assert.match(formed[0], /rate limiter/i)
  assert.match(formed[0], /public API/i)
})

test('caption replay: question-mark lines from the densest interview videos form joined asks', () => {
  const dir = '/workspace/kompas/yt-captions'
  const ids = ['CAda15Tawlg', 'L_XlcyOfJbU', 't8MsUp6pfsI']
  const available = new Set(readdirSync(dir))
  let total = 0
  let formed = 0
  for (const id of ids) {
    const name = id + '.txt'
    if (!available.has(name)) continue
    const asks = captionQuestions(readFileSync(dir + '/' + name, 'utf8'))
    for (const ask of asks.slice(0, 40)) {
      total += 1
      const words = ask.split(' ')
      if (words.length < 6) {
        formed += intakeQuestions([ask]).length
        continue
      }
      const a = words.slice(0, Math.ceil(words.length / 2)).join(' ')
      const b = words.slice(Math.ceil(words.length / 2)).join(' ')
      formed += intakeQuestions([a, b]).length
    }
  }
  assert.ok(total >= 20, `expected caption questions, got ${total}`)
  assert.ok(formed >= Math.floor(total * 0.5), `intake formed ${formed} of ${total} replayed asks`)
})
