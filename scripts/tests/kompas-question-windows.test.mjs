// Deterministic question windows (owner, 31 Oct 2026, count corrected 1 Nov 2026): the engine always puzzles "was
// this everything they were expecting?" before it answers. It keeps every piece that belongs to the question — the
// brain chooses the last 2 things, the last 3 things, or many more sentences, however many the question spans — and
// only shrinks on proof something was settled. A short acknowledgement or setup sentences between asks never shrink
// it: shrinking there left the card answering only the last question, as if the rest was never heard.
import test from 'node:test'
import assert from 'node:assert/strict'

const { cutQuestion, questionToAnswer, deriveByCode, questionForAnswer } = await import('../../src/lib/kompasAnswer.ts')

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

test('a fifth earlier ask stays in on a fresh press: there is no count cap', () => {
  const out = cutQuestion('How do you detect intrusions? How do you triage alerts? How do you contain a host? How do you write the report? How do you brief leadership?')
  inOrder(out, ['How do you detect intrusions', 'How do you triage alerts', 'How do you contain a host', 'How do you write the report', 'How do you brief leadership'])
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

// Re-press (owner, 31 Oct 2026): tapping AI Answer again is itself the signal more concatenation is needed — with
// previous things, whatever was heard — so a part missed at one instance comes back on the next tap. Since 1 Nov 2026
// no mode is count-capped, so a re-press keeps whatever was heard exactly as a fresh press does; the material stays
// bounded client-side to the page chain.
const FIVE = 'How do you detect intrusions? How do you triage alerts? How do you contain a host? How do you write the report? How do you brief leadership?'

test('a re-press keeps whatever was heard: no count cap in either mode', () => {
  const out = cutQuestion(FIVE, undefined, true)
  inOrder(out, ['How do you detect intrusions', 'How do you triage alerts', 'How do you contain a host', 'How do you write the report', 'How do you brief leadership'])
})

test('a re-press still breaks on the candidate taking the floor', () => {
  assert.equal(
    cutQuestion('Tell me about your SOC experience. I built the SIEM pipeline for the state. How do you handle false positives?', undefined, true),
    'How do you handle false positives?',
  )
})

test('the re-press server path keeps every part end to end', () => {
  const out = questionForAnswer(FIVE, '', false, true, [])
  inOrder(out, ['How do you detect intrusions', 'How do you triage alerts', 'How do you contain a host', 'How do you write the report', 'How do you brief leadership'])
})

test('the code derive on a re-press keeps every part', () => {
  const out = deriveByCode(FIVE, [], true)
  inOrder(out, ['How do you detect intrusions', 'How do you triage alerts', 'How do you contain a host', 'How do you write the report', 'How do you brief leadership'])
})

// Flexible count (owner, 1 Nov 2026): the brain chooses the last 2 things, the last 3 things, or many more
// sentences. The 1 Nov 2026 SIEM card showed only "what are the core components?" with a generic answer, because a
// fresh press cut everything past four asks. These cases pin the whole question surviving on a fresh press.

test('the SIEM card case stays whole as one sentence: head plus tail', () => {
  assert.equal(
    cutQuestion('Describe the high-level architecture of a SIEM — what are the core components?'),
    'Describe the high-level architecture of a SIEM — what are the core components?',
  )
})

test('the SIEM card case stays whole as two sentences', () => {
  const out = cutQuestion('Describe the high-level architecture of a SIEM. What are the core components?')
  inOrder(out, ['Describe the high-level architecture of a SIEM', 'What are the core components'])
})

test('the SIEM card case stays whole with a previous SIEM turn', () => {
  const out = cutQuestion('Describe the high-level architecture of a SIEM. What are the core components?', {
    question: 'Describe the high-level architecture of a SIEM.',
    answers: 'A SIEM collects logs with Splunk forwarders, stores them hot and warm, correlates with a rules engine and UEBA analytics, and routes alerts to case management with threat intel enrichment.',
  })
  inOrder(out, ['Describe the high-level architecture of a SIEM', 'What are the core components'])
})

test('six asks stay whole on a fresh press: the two the old cap dropped are back', () => {
  const out = cutQuestion('What is a SIEM? How does log collection work? What is the difference between agent based and agentless collection? Describe the high-level architecture of a SIEM. What are the core components? How do you tune detection rules?')
  inOrder(out, ['What is a SIEM', 'How does log collection work', 'What is the difference between agent based and agentless collection', 'Describe the high-level architecture of a SIEM', 'What are the core components', 'How do you tune detection rules'])
})

test('ten asks stay whole on a fresh press: many more sentences, no count cut', () => {
  const out = cutQuestion('How do you detect intrusions? How do you triage alerts? How do you contain a host? How do you write the report? How do you brief leadership? How do you tune detection rules? How do you handle false positives? How do you scope an access review? How do you prove a control works? How do you close a vulnerability ticket?')
  inOrder(out, ['How do you detect intrusions', 'How do you triage alerts', 'How do you contain a host', 'How do you write the report', 'How do you brief leadership', 'How do you tune detection rules', 'How do you handle false positives', 'How do you scope an access review', 'How do you prove a control works', 'How do you close a vulnerability ticket'])
})

test('a previous-turn context sentence still breaks the window, even with no count cap', () => {
  assert.equal(
    cutQuestion('The team runs three tiers with a small headcount. How do you handle false positives?', {
      question: 'Tell me about your SOC experience.',
      answers: 'Our team runs three tiers with a small headcount in the SOC.',
    }),
    'How do you handle false positives?',
  )
})
