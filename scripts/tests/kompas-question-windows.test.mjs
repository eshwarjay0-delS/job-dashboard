// Deterministic question windows (owner, 31 Oct 2026): the engine always puzzles "was this everything they were
// expecting?" before it answers. It keeps the widest window of the last asks — Last 1 2 3 4, then 1 2 3, then 1 2,
// then 1 — and only shrinks on proof something was settled. A short acknowledgement or setup sentences between asks
// never shrink it: shrinking there left the card answering only the last question, as if the rest was never heard.
import test from 'node:test'
import assert from 'node:assert/strict'

const { cutQuestion, questionToAnswer } = await import('../../src/lib/kompasAnswer.ts')

const inOrder = (out, parts) => {
  let at = -1
  for (const part of parts) {
    const i = out.toLowerCase().indexOf(part.toLowerCase())
    assert.ok(i > at, `"${part}" is kept after the part before it, got: ${out}`)
    at = i
  }
}

test('acknowledgements between asks never shrink the window (Last 1 2 3)', () => {
  const out = cutQuestion('Tell me about your SOC experience. Yeah. How do you handle false positives? Right. And how do you tune detection rules?')
  inOrder(out, ['Tell me about your SOC experience', 'How do you handle false positives', 'how do you tune detection rules'])
  assert.doesNotMatch(out, /Yeah|Right/, 'the acknowledgements themselves are not question text')
})

test('setup sentences between asks never shrink the window', () => {
  const out = cutQuestion('Tell me about your SOC experience. The SOC runs three tiers with a small team. Alerts come from three tools. The night shift is thin. How do you handle false positives?')
  inOrder(out, ['Tell me about your SOC experience', 'How do you handle false positives'])
})

test('four asks stay together (Last 1 2 3 4)', () => {
  const out = cutQuestion('How do you detect intrusions? How do you triage alerts? How do you contain a host? How do you write the report?')
  inOrder(out, ['How do you detect intrusions', 'How do you triage alerts', 'How do you contain a host', 'How do you write the report'])
})

test('a fifth earlier ask is cut by the four-ask cap, not by settledness', () => {
  const out = cutQuestion('How do you detect intrusions? How do you triage alerts? How do you contain a host? How do you write the report? How do you brief leadership?')
  assert.doesNotMatch(out, /How do you detect intrusions/, 'the earliest ask is beyond the window')
  inOrder(out, ['How do you triage alerts', 'How do you contain a host', 'How do you write the report', 'How do you brief leadership'])
})

test('the candidate taking the floor still cuts the earlier ask', () => {
  assert.equal(
    cutQuestion('Tell me about your SOC experience. I built the SIEM pipeline for the state. How do you handle false positives?'),
    'How do you handle false positives?',
  )
})

test('a long fragment between asks still cuts the earlier ask (Gemalto shape)', () => {
  const out = cutQuestion('Explain the concept of session recording in CyberArk and its importance in cybersecurity. Session recording in CyberArk captured... how to use the Gemalto app. How does CyberArk contribute to the management and protection of SSH keys?')
  assert.match(out, /How does CyberArk contribute to the management and protection of SSH keys\?$/)
  assert.doesNotMatch(out, /Gemalto|session recording in CyberArk and its importance/, 'the cut-off fragment and the earlier ask do not ride along')
})

test('a marked next question still starts a fresh window', () => {
  assert.equal(
    cutQuestion('Tell me about your SOC experience. Moving on to the next question: how do you handle false positives?'),
    'How do you handle false positives?',
  )
})

test('a single ask is still the whole window (Last 1)', () => {
  assert.equal(cutQuestion('How do you handle false positives?'), 'How do you handle false positives?')
})

test('the live unpinned path keeps every part too', () => {
  const out = questionToAnswer('Tell me about your SOC experience. Yeah. How do you handle false positives?', '', false)
  inOrder(out, ['Tell me about your SOC experience', 'How do you handle false positives'])
})

test('concatenation across sources stays one question: heard plus typed', () => {
  const out = questionToAnswer('Tell me about your SOC experience. Yeah.', 'How do you handle false positives?', false)
  inOrder(out, ['Tell me about your SOC experience', 'How do you handle false positives'])
})
