// The Security Analyst III session, as general rules. The private transcript stays out of the repo.
// Technical depth stays when the question asks how or why. Relevance means sentence one is that ask,
// not a decision-maker, a metric, or the sentence that came before "next question".
import test from 'node:test'
import assert from 'node:assert/strict'
import { cutQuestion } from '../../src/lib/kompasAnswer.ts'
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
    }
  })
}

test('words before "next question" are not the question', () => {
  const heard = 'Possible or anyone has to talk to why we disable it? I will explain this later. Moving to the next question, what is NLA and why do we disable it?'
  const cut = cutQuestion(heard)
  assert.match(cut, /what is NLA/i)
  assert.doesNotMatch(cut, /Possible or anyone/)
})
