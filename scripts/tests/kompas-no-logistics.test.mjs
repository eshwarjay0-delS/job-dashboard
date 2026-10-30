// Owner rule, 29 Oct 2026: Kompas never answers logistics (visa, work authorization, citizenship,
// pay, relocation, address, current location, start date, notice, availability). Only resume
// content is personal. A pure logistics ask gets the quiet reply with no model call; a mixed ask
// keeps its non-logistics part; technical questions that merely contain a logistics word still answer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { withoutLogistics, isLogisticsAsk } from '../../src/lib/kompasLogistics.ts'

const quiet = [
  'U.S. citizen?', 'Salary?', 'Can you relocate?', 'Are you authorized to work in the US?', 'When can you start?',
  'Are you a U.S. citizen?', 'Do you need sponsorship?', 'Will you require visa sponsorship now or in the future?',
  'What are your salary expectations?', 'What is your notice period?', 'Where are you based?', 'Where do you live?',
  'Are you open to relocation?', 'Are you comfortable with a hybrid schedule?', 'Are you local to Dallas?',
  'Do you have an active security clearance?', 'H-1B?', 'Visa?', 'Notice?', 'Would you be willing to travel?',
  'What is your current location?', 'Are you willing to work on-site three days a week?', 'Are you on a green card?',
  'What is your expected hourly rate?', 'Is this full time or contract for you?', 'Can you start in two weeks?',
  'We hire quickly. When could you start?', 'Can you relocate if the role requires it?', 'When would you be available to start?',
]
const answered = [
  'Walk me through your hybrid cloud migration.', 'Have you worked with hybrid environments?',
  'Have you supported on-call incident response?', 'What security clearance controls did you implement?',
  'How did you handle travel booking data privacy?', 'What is a compensating control?',
  'Tell me about your full-time role at DTE.', 'Describe your experience with on-site data center audits.',
  'Tell me about yourself.', 'What is least privilege?', 'Why are you leaving your current role?',
]

test('pure logistics asks reduce to nothing, so the service returns the quiet reply', () => {
  for (const q of quiet) assert.equal(withoutLogistics(q), '', q)
})

test('technical asks that only contain a logistics word are left unchanged', () => {
  for (const q of answered) { assert.equal(isLogisticsAsk(q), false, q); assert.equal(withoutLogistics(q), q, q) }
})

test('a mixed ask keeps only the non-logistics part', () => {
  assert.equal(withoutLogistics('Tell me about IAM and are you open to relocation?'), 'Tell me about IAM')
  assert.equal(withoutLogistics('Where are you based and what SIEM tools have you used?'), 'what SIEM tools have you used?')
  assert.equal(withoutLogistics('What is your salary expectation? Also, how do you triage alerts?'), 'Also, how do you triage alerts?')
})

test('the answer service applies the guard before any model call and marks the quiet reply', () => {
  const src = readFileSync(new URL('../../src/lib/kompasAnswerService.ts', import.meta.url), 'utf8')
  const fn = src.slice(src.indexOf('export async function answerForVerifiedUser'))
  // demo-final merge: Voice's kompasRelevance helper runs first, this server helper is the backstop.
  const guard = fn.indexOf('serverWithoutLogistics(withoutLogistics(')
  const quietReply = fn.indexOf('noQuestion: true, skipped')
  const firstAnswerCall = fn.indexOf('rediscoverRelevance(')
  assert.ok(guard > 0 && quietReply > guard && firstAnswerCall > quietReply)
  assert.match(fn, /\? "logistics" : undefined/)
  assert.match(fn, /const originalTurnAsk = [^\n]*serverWithoutLogistics\(withoutLogistics\(sameTurn\)\)/)
  const page = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.match(page, /meta\.skipped === "logistics"/)
})

test('demo-final: the server backstop never silences resume history or the technical half of a compound', async () => {
  const { logisticsBackstop } = await import('../../src/lib/kompasLogistics.ts')
  assert.equal(logisticsBackstop('What was your start date at Citi?'), 'What was your start date at Citi?')
  assert.equal(logisticsBackstop('What is your experience with Okta and your notice period?'), 'What is your experience with Okta and your notice period?')
  assert.equal(logisticsBackstop('Are you open to hybrid?'), '')
  assert.equal(logisticsBackstop('What is your expected hourly rate?'), '')
  assert.equal(logisticsBackstop('Walk me through the hybrid identity integrations with Active Directory'), 'Walk me through the hybrid identity integrations with Active Directory')
})
