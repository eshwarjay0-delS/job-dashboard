import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  AUTO_THEM_SILENCE_MS,
  AUTO_DEFAULT_ON,
  hasQuestionCue,
  themQuietLongEnough,
  confirmAutoQuestion,
  shouldAutoAnswer,
} from '../../src/lib/kompasAutoAnswer.ts'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')

test('Auto Answer is off by default and needs cue + 1.4s Them silence + confirm', () => {
  assert.equal(AUTO_DEFAULT_ON, false)
  assert.equal(AUTO_THEM_SILENCE_MS, 1400)
  assert.equal(shouldAutoAnswer({ autoOn: false, cue: true, themQuietMs: 2000, confirmed: true }).fire, false)
  assert.equal(shouldAutoAnswer({ autoOn: true, cue: false, themQuietMs: 2000, confirmed: true }).fire, false)
  assert.equal(shouldAutoAnswer({ autoOn: true, cue: true, themQuietMs: 1300, confirmed: true }).fire, false)
  assert.equal(shouldAutoAnswer({ autoOn: true, cue: true, themQuietMs: 1400, confirmed: false }).fire, false)
  assert.equal(shouldAutoAnswer({ autoOn: true, cue: true, themQuietMs: 1400, confirmed: true }).fire, true)
  assert.equal(themQuietLongEnough(1000, 2399), false)
  assert.equal(themQuietLongEnough(1000, 2400), true)
})

test('confirm keeps real asks and drops greetings, unfinished clauses, and video commentary', () => {
  assert.equal(confirmAutoQuestion('Tell me about a conflict you had with a coworker. How did you resolve it?').ok, true)
  assert.equal(confirmAutoQuestion('Hello there.').ok, false)
  assert.equal(confirmAutoQuestion('How would you').ok, false)
  assert.equal(confirmAutoQuestion('In this video we are going to peel back behavioral interviews').ok, false)
  assert.equal(hasQuestionCue('Tell me about a conflict you had with a coworker?'), true)
})

function captionQuestions(raw) {
  const body = String(raw || '').split('\n').slice(2).join(' ')
  const text = body.replace(/\s+/g, ' ').trim()
  return text.split(/(?<=[.?！？])\s+/).map((s) => s.trim()).filter(Boolean)
}

test('caption replay: Auto would fire on cued questions after 1.4s silence, not on non-asks', () => {
  const dir = '/workspace/kompas/yt-captions'
  const ids = ['CAda15Tawlg', 'L_XlcyOfJbU', 't8MsUp6pfsI']
  const available = new Set(readdirSync(dir))
  let asks = 0, fired = 0, skipped = 0, held = 0
  for (const id of ids) {
    const name = id + '.txt'
    if (!available.has(name)) continue
    const parts = captionQuestions(readFileSync(dir + '/' + name, 'utf8'))
    for (const part of parts.slice(0, 80)) {
      const cue = hasQuestionCue(part)
      const confirmed = confirmAutoQuestion(part).ok
      const early = shouldAutoAnswer({ autoOn: true, cue, themQuietMs: 700, confirmed }).fire
      const ready = shouldAutoAnswer({ autoOn: true, cue, themQuietMs: 1400, confirmed }).fire
      if (early) held += 1
      if (cue && confirmed) {
        asks += 1
        if (ready) fired += 1
      } else if (ready) {
        skipped += 1
      } else {
        skipped += 1
      }
    }
  }
  assert.equal(held, 0, 'a 700 ms dip must not auto-answer')
  assert.ok(asks >= 8, `expected caption questions, got ${asks}`)
  assert.ok(fired >= Math.min(asks, 8), `auto fired ${fired} of ${asks} confirmed asks`)
  assert.equal(skipped >= 1, true)
})

test('app.js keeps Auto off by default and gates fire with Them silence plus confirm', () => {
  assert.match(app, /setAuto\(s\.autoMode === true\)/)
  assert.match(app, /AUTO_THEM_SILENCE_MS\s*=\s*1400/)
  assert.match(app, /confirmAutoQuestion\(/)
  assert.match(app, /shouldAutoAnswer\(|themQuiet/)
})
