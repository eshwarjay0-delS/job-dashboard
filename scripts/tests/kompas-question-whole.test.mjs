// The question Kompas answers is the whole of what was asked. Measured on 26 Oct 2026 against production (evaluation
// round 1): "Design Splunk and Sentinel ingestion with identity correlation. Explain trust boundaries, ..." was answered
// as "Explain trust boundaries, ...", the design subject gone, and "Give a falsifiable test and an exit criterion" and
// "State decision owner, business exposure and measures" were dropped, because only seven openers counted as an ask.
import test from 'node:test'
import assert from 'node:assert/strict'

const { questionToAnswer, cutQuestion } = await import('../../src/lib/kompasAnswer.ts')

const ASKED = {
  design: 'Design Splunk and Sentinel ingestion with identity correlation. Explain trust boundaries, data flow, failure isolation, rollout and validation.',
  followup: 'In that design, audit evidence disagrees with live configuration. Walk through diagnosis, competing hypotheses, safe containment and rollback.',
  recursive: 'Go deeper on that failure. What if the first mitigation fails and telemetry is incomplete? Give a falsifiable test and an exit criterion.',
  director: 'Now explain the same incident to a director: risk acceptance versus remediation. State decision owner, business exposure and measures you would track, without inventing achieved numbers.',
  definition: 'Define NIST CSF risk assessments. Keep it suitable for technical HR.',
  compound: 'Define IDOR, explain why it matters, and give one mitigation.',
  diagnosis: 'A permission fix passes unit tests but fails for one tenant. How would you diagnose it?',
}
const MUST = {
  design: ['Design Splunk and Sentinel ingestion', 'trust boundaries', 'rollout and validation'],
  followup: ['audit evidence disagrees with live configuration', 'Walk through diagnosis', 'rollback'],
  recursive: ['Go deeper on that failure', 'telemetry is incomplete', 'falsifiable test and an exit criterion'],
  director: ['explain the same incident to a director', 'State decision owner', 'without inventing achieved numbers'],
  definition: ['Define NIST CSF risk assessments', 'Keep it suitable for technical HR'],
  compound: ['Define IDOR', 'why it matters', 'one mitigation'],
  diagnosis: ['fails for one tenant', 'How would you diagnose it'],
}

test('every part of a typed or pinned question survives, in order', () => {
  for (const [name, q] of Object.entries(ASKED)) {
    const out = questionToAnswer('', q, true)
    let at = -1
    for (const part of MUST[name]) {
      const i = out.toLowerCase().indexOf(part.toLowerCase())
      assert.ok(i > at, `${name}: "${part}" is kept after the part before it, got: ${out}`)
      at = i
    }
  }
})

test('the same questions heard with no formed question also keep every part', () => {
  for (const [name, q] of Object.entries(ASKED)) {
    const out = questionToAnswer(q, '', true)
    for (const part of MUST[name]) assert.ok(out.toLowerCase().includes(part.toLowerCase()), `${name}: "${part}" kept, got: ${out}`)
  }
})

test('a ramble still yields to the ask, and the candidate\'s own words are not part of it', () => {
  const unpunctuated = 'okay yes so I start by troubleshooting okay so how do you configure certificate discovery in Venafi'
  const out = cutQuestion(unpunctuated)
  assert.match(out, /^How do you configure certificate discovery in Venafi/)
  const ownFirst = cutQuestion('I built the SIEM pipeline for the state. We onboarded forty sources. How did you handle clock drift?')
  assert.equal(ownFirst, 'How did you handle clock drift?')
  const polite = cutQuestion("That's great, thanks. Now, how would you design certificate rotation for a hundred services?")
  assert.equal(polite, 'How would you design certificate rotation for a hundred services?')
  const pinnedRamble = questionToAnswer('', 'Okay. Yes so I start by troubleshooting. Okay, so how do you configure certificate discovery in Venafi?', true)
  assert.equal(pinnedRamble, 'how do you configure certificate discovery in Venafi?')
})

test('a bare term or abbreviation that was typed stays the question', () => {
  assert.equal(questionToAnswer('', 'IDOR', true), 'IDOR')
  assert.equal(questionToAnswer('', 'Venafi certificate discovery', true), 'Venafi certificate discovery')
  assert.equal(questionToAnswer('Hello.', 'Hello.', true), '')
})
