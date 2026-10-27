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

test('his live cards strip to the actual ask (27 Oct 2026 screenshots)', () => {
  const junkLead = 'Why I have it. ...requirements. 11. Explain the concept of session recording in CyberArk and its importance in cybersecurity.'
  for (const out of [questionToAnswer('', junkLead, true), questionToAnswer(junkLead, '', false)])
    assert.equal(out.replace(/^./, (c) => c.toUpperCase()), 'Explain the concept of session recording in CyberArk and its importance in cybersecurity.')
  const garbled = 'Explain the concept of session recording in CyberArk and its importance in cybersecurity. Session recording in CyberArk captured... how to use the Gemalto app. How does CyberArk contribute to the management and protection of SSH keys?'
  const out = questionToAnswer(garbled, '', false)
  assert.match(out, /How does CyberArk contribute to the management and protection of SSH keys\?$/)
  assert.doesNotMatch(out, /Gemalto|captured\.\.\./, 'the transcriber\'s cut-off fragment is not part of the question')
  assert.equal(cutQuestion('11. Design a SIEM pipeline for identity correlation.'), 'Design a SIEM pipeline for identity correlation.')
  assert.equal(cutQuestion('How I handled it was through the vault. What does PSM record?'), 'What does PSM record?')
})

test('a bare term or abbreviation that was typed stays the question', () => {
  assert.equal(questionToAnswer('', 'IDOR', true), 'IDOR')
  assert.equal(questionToAnswer('', 'Venafi certificate discovery', true), 'Venafi certificate discovery')
  assert.equal(questionToAnswer('Hello.', 'Hello.', true), '')
})

test('a dictated story plus the real question cuts to the question only (owner, 26 Oct screenshot)', () => {
  const heard = [
    'I lost my job when I was a kid.',
    'I got nosebleeds when I was a kid.',
    'I was like, oh, I am going to die.',
    'My mom came and told me what I was crying about.',
    'Did you go to the hospital?',
    'I went to the hospital after my dad died.',
    'I was in the hospital.',
    'I am going to start with a quick question.',
    'At Citi, you list Zscaler troubleshooting experience.',
    'If a desktop application fails under TLS inspection while browser access works, how would you distinguish certificate pinning, mutual TLS, trust store differences, and protocol incompatibility without broadly bypassing inspection?',
    'A server certificate has the correct hostname and valid dates, but only some Windows endpoints reject it.',
    'How would you investigate that?',
  ].join(' ')
  const out = questionToAnswer(heard, '', false)
  assert.ok(out.toLowerCase().includes('distinguish certificate pinning'), `keeps the ask, got: ${out}`)
  assert.ok(out.toLowerCase().includes('mutual tls'), `keeps the question keywords, got: ${out}`)
  assert.ok(out.toLowerCase().includes('how would you investigate that'), `keeps the last ask, got: ${out}`)
  assert.ok(!/nosebleed|dad died|lost my job/i.test(out), `drops the story, got: ${out}`)
})
