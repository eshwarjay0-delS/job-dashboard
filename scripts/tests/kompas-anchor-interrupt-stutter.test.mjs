import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveStutterRephrase, isIncompleteAsk } from '../../src/lib/kompasStutterRephrase.ts'
import { formatAnchorCard, hasAnchorFields, clampAnchorFields } from '../../src/lib/kompasAnchorCard.ts'
import { interruptionFlush, pivotConstraint, PIVOT_MAX_WORDS } from '../../src/lib/kompasInterruption.ts'
import { confirmAutoQuestion, shouldAutoAnswer, INTENT_COMPLETE_SILENCE_MS } from '../../src/lib/kompasAutoAnswer.ts'
import { resolveLiveQuestion } from '../../src/lib/kompasQuestionResolve.ts'

test('stutter/rephrase keeps the final constraint and will not fire on the partial', () => {
  const raw = 'how would you handle... well actually, what if the user is a VP and refuses MFA?'
  const r = resolveStutterRephrase(raw)
  assert.equal(r.rephrased, true)
  assert.equal(r.incomplete, false)
  assert.match(r.text, /VP/i)
  assert.match(r.text, /MFA/i)
  assert.doesNotMatch(r.text, /how would you handle\.\.\./i)
  assert.equal(isIncompleteAsk('how would you handle'), true)
  assert.equal(confirmAutoQuestion('how would you handle').ok, false)
  assert.equal(shouldAutoAnswer({
    autoOn: true, cue: true, themQuietMs: INTENT_COMPLETE_SILENCE_MS, confirmed: true, text: 'how would you handle',
  }).fire, false)
  const live = resolveLiveQuestion({ formed: raw, pending: [raw], context: [raw] })
  assert.match(live, /VP/)
  assert.match(live, /MFA/)
})

test('short topical asks are complete; dangling openers are not', () => {
  assert.equal(isIncompleteAsk('Explain OAuth'), false)
  assert.equal(isIncompleteAsk('What is SAML'), false)
  assert.equal(isIncompleteAsk('Tell me about yourself'), false)
  assert.equal(isIncompleteAsk('how would you handle'), true)
  assert.equal(isIncompleteAsk('what is'), true)
  assert.equal(isIncompleteAsk('explain how'), true)
  assert.equal(isIncompleteAsk('how would you'), true)
})

test('anchor card is a readability layout: question, elapsed, stance/friction/fix/hook, prose toggled; bullets if fields missing', () => {
  const withFields = formatAnchorCard({
    question: 'What if a VP refuses MFA?',
    elapsedMs: 4200,
    fields: { stance: 'Hold the line', friction: 'VP refuses MFA now', fix: 'Offer phish-resistant passkey', hook: 'passkey', prose: 'I would not disable MFA. I would offer a phish-resistant passkey and a time-boxed exception.' },
    showProse: false,
  })
  assert.equal(withFields.mode, 'anchor')
  assert.equal(withFields.elapsedLabel, '4s')
  assert.ok(withFields.stance.split(/\s+/).length <= 3)
  assert.ok(withFields.friction.split(/\s+/).length <= 5)
  assert.ok(withFields.fix.split(/\s+/).length <= 5)
  assert.equal(withFields.showProse, false)
  assert.ok(withFields.prose.length > 20)
  const clipped = clampAnchorFields({ stance: 'one two three four', friction: 'a b c d e f', fix: 'x y z' })
  assert.equal(clipped.stance, 'one two three')
  assert.equal(clipped.friction, 'a b c d e')
  const fallback = formatAnchorCard({ question: 'Tell me about yourself', bullets: ['I led GRC at Citi.', 'Then I moved to CVS.'] })
  assert.equal(fallback.mode, 'bullets')
  assert.equal(hasAnchorFields({ stance: 'Hold' }), false)
  const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.match(app, /hasAnchorFields\(/)
  assert.match(app, /Show full answer/)
  assert.doesNotMatch(app, /function\s+(eyeTrack|trackGaze|gazeScore)|eyeTracking\s*=|gazeManagement\s*=/i)
})

test('interruption flush clears the card, pivots in <=5 words, and resolves a complete new ask', () => {
  const ev = interruptionFlush({
    interviewerSpeaking: true,
    cardShowing: true,
    candidateTalking: true,
    newAsk: 'what if the user is a VP and refuses MFA?',
  })
  assert.equal(ev.flush, true)
  assert.equal(ev.resolve, true)
  assert.ok(ev.pivot.split(/\s+/).filter(Boolean).length <= PIVOT_MAX_WORDS)
  assert.match(ev.pivot, /VP|MFA/i)
  const quiet = interruptionFlush({ interviewerSpeaking: false, cardShowing: true, candidateTalking: false, newAsk: 'hello?' })
  assert.equal(quiet.flush, false)
  const mid = interruptionFlush({
    interviewerSpeaking: true, cardShowing: true, candidateTalking: false, newAsk: 'how would you handle',
  })
  assert.equal(mid.flush, true)
  assert.equal(mid.resolve, false)
  assert.ok(pivotConstraint('well actually, what if the user is a VP and refuses MFA?').split(/\s+/).length <= 5)
  const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.match(app, /applyInterruptionFlush\(/)
  assert.match(app, /New constraint:/)
})
