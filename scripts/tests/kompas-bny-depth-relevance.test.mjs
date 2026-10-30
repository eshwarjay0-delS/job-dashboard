// The Security Analyst III session, as general rules. The private transcript stays out of the repo.
// Technical depth stays when the question asks how or why. Relevance means sentence one is that ask,
// not a decision-maker, a metric, or the sentence that came before "next question".
import test from 'node:test'
import assert from 'node:assert/strict'
import { cutQuestion, questionForAnswer } from '../../src/lib/kompasAnswer.ts'
import { interviewIntent, focusPlan, focusPrompt } from '../../src/lib/kompasRelevance.ts'

const folds = [
  ['What is NLA and why do we disable it?', 'definition', 'deep'],
  ['What makes you a good fit for a cyber risk analyst role?', 'value', 'surface'],
  ['How do you assess business impact, root cause, compensating controls, residual risk, and whether the issue is valid?', 'technical-process', 'deep'],
  ['Are you familiar with policy deviations and policy exceptions?', 'comparison', 'surface'],
  ['What have you used, and what are you more proficient at, NIST CSF or the CRI Profile?', 'comparison', 'surface'],
  ['Tell me about a time you challenged a weak remediation plan. What did you do and how did you fix it?', 'experience-story', 'asked-only'],
  ['Highlight the experience you would bring to this role.', 'value', 'surface'],
  ['How would you explain residual risk to a business owner?', 'definition', 'deep'],
  ['How is a policy deviation different from a policy exception?', 'comparison', 'deep'],
  ['Any questions?', 'closing-question', 'surface'],
  ['The team runs several control areas. Any questions?', 'closing-question', 'surface'],
  ['Have you worked with a GRC workflow tool?', 'direct', 'asked-only'],
  ['Where are you based?', 'logistics', 'surface'],
  ['We have twenty seven control leads and you will work across their teams.', 'acknowledgement', 'surface'],
  ['How does certificate validation work before a remote session starts?', 'technical-process', 'deep'],
  ['Which of those would you start with?', 'comparison', 'surface'],
  ['What is least privilege?', 'definition', 'surface'],
  ['Tell me about yourself.', 'introduction', 'surface'],
  ['Why should we hire you for this control-oversight role?', 'value', 'surface'],
  ['Go deeper on that exception.', 'follow-up', 'deep'],
]

for (let n = 1; n <= folds.length; n++) {
  test('BNY depth-and-relevance fold ' + String(n).padStart(2, '0') + ' rechecks every earlier ask', () => {
    for (const [question, intent, depth] of folds.slice(0, n)) {
      assert.equal(interviewIntent(question), intent, question)
      const plan = focusPlan(question, 2, 'director')
      assert.equal(plan.intent, intent)
      assert.equal(plan.technicalDepth, depth, question)
      const prompt = focusPrompt(question, 2, 'director')
      assert.match(prompt, /Sentence one answers this question/)
      assert.match(prompt, /Do not invent a decision owner/)
      if (intent === 'definition' && depth === 'deep') assert.match(prompt, /Open with what it is/)
      if (intent === 'technical-process') assert.match(prompt, /Cover each named part in order/)
      if (intent === 'value') assert.match(prompt, /Open with the relevant experience/)
      if (intent === 'experience-story') assert.match(prompt, /One supported story/)
      if (intent === 'follow-up' && depth === 'deep') assert.match(prompt, /asked to go deeper on the same subject/)
    }
  })
}

test('a bare why stays a follow-up of the question it was glued to', () => {
  const previous = [{ q: 'What is NLA and why do we disable it?' }]
  for (const heard of ['Why?', 'And why?', 'How come?']) {
    const q = questionForAnswer(heard, '', false, false, previous)
    assert.match(q, /following up on/i, heard)
    assert.equal(interviewIntent(q), 'follow-up', heard)
    assert.equal(focusPlan(q, 2, 'director').technicalDepth, 'asked-only', heard)
    assert.doesNotMatch(focusPrompt(q, 2, 'director'), /asked to go deeper/)
  }
})

test('dig deeper on a named subject stays that subject and asks for the mechanism', () => {
  const q = 'dig deeper on session recording'
  assert.equal(interviewIntent(q), 'follow-up')
  assert.equal(focusPlan(q, 2, 'director').technicalDepth, 'deep')
  assert.match(focusPrompt(q, 2, 'director'), /asked to go deeper on the same subject/)
  const cut = questionForAnswer(q, '', false, false, [{ q: 'What is NLA and why do we disable it?' }])
  assert.match(cut, /session recording/i)
  assert.doesNotMatch(cut, /NLA/)
})

test('what exactly is a term is a definition', () => {
  const q = 'What exactly is least privilege?'
  assert.equal(interviewIntent(q), 'definition')
  assert.equal(focusPlan(q, 2, 'director').technicalDepth, 'surface')
  assert.match(focusPrompt(q, 2, 'director'), /Open with what it is/)
})

test('an introduction and a request for questions are both kept', () => {
  const heard = 'Tell me about yourself. What questions do you have?'
  assert.equal(interviewIntent(heard), 'introduction')
  assert.match(focusPrompt(heard, 2, 'director'), /also asked what questions you have/)
  assert.equal(interviewIntent('Any questions?'), 'closing-question')
  assert.equal(interviewIntent('The team runs several control areas. Any questions?'), 'closing-question')
  assert.equal(interviewIntent('Tell me about yourself.'), 'introduction')
})

test('a short citizenship question is kept and answered as logistics', () => {
  const q = questionForAnswer('U.S. citizen?', '', false, false, [{ q: 'What is NLA and why do we disable it?' }])
  assert.match(q, /U\.S\. citizen/i)
  assert.doesNotMatch(q, /NLA/)
  assert.equal(interviewIntent(q), 'logistics')
  assert.equal(interviewIntent('Are you a U.S. citizen?'), 'logistics')
  assert.match(questionForAnswer('Are you a U.S. citizen?', '', false, false, []), /Are you a U\.S\. citizen\?/)
  assert.equal(interviewIntent('Are you a u s citizen'), 'logistics')
  assert.equal(focusPlan('Are you a u s citizen', 2, 'director').technicalDepth, 'surface')
  assert.equal(interviewIntent('Are you authorized to work in the U.S.?'), 'logistics')
  assert.equal(interviewIntent('How does work authorization work?'), 'technical-process')
  assert.equal(questionForAnswer('H-1B?', '', false, false, [{ q: 'What is NLA and why do we disable it?' }]), 'H-1B?')
  assert.equal(interviewIntent('H-1B?'), 'logistics')
  assert.equal(interviewIntent('Do you need an H-1B?'), 'logistics')
  assert.equal(interviewIntent('Are you a green card holder?'), 'logistics')
  assert.equal(interviewIntent('Are you on a visa?'), 'logistics')
  assert.equal(interviewIntent('Can you commute to the office?'), 'logistics')
  assert.equal(interviewIntent('How would you opt for least privilege?'), 'scenario')
})

test('a short follow-up is not told to open a new mechanism', () => {
  const prompt = focusPrompt('Why is that dangerous?', 2, 'director')
  assert.equal(interviewIntent('Why is that dangerous?'), 'follow-up')
  assert.equal(focusPlan('Why is that dangerous?', 2, 'director').technicalDepth, 'asked-only')
  assert.doesNotMatch(prompt, /asked to go deeper/)
})

test('words before "next question" are not the question', () => {
  const heard = 'Possible or anyone has to talk to why we disable it? I will explain this later. Moving to the next question, what is NLA and why do we disable it?'
  const cut = cutQuestion(heard)
  assert.match(cut, /what is NLA/i)
  assert.doesNotMatch(cut, /Possible or anyone/)
})
