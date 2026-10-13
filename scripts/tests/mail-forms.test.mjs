// A recruiter's "please fill this in" table, filled from what he has sent before (13 Oct 2026). The owner, with a picture
// of a ten-row table in a mail: "They want me to fill it up ... would go absolutely crazy because mobile formats wouldn't
// agree with that ... hey, this person has requested this and here's the suggestions of filling that up ... fill in the
// whole box with ... the previous data that the candidate or user had kept on filling up ... for the same names."
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formIn, answersFrom, fillForm, formReply, formSummary, isSensitive } from '../../src/lib/mail-forms.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// The table of his picture, as a mail's words arrive: once with a row to a line, once run together on one line.
const ROWS = ['Full Name:', 'Contact No:', 'Email ID:', 'Date of Birth (DD/MM)', 'Current Location:', 'Relocation(Y/N):', 'Visa Status:', 'Educational details:', 'LinkedIn Id:', 'SSN Last 4 Digit::']
const BY_LINE = `Please fill skill Metrix-\n\n${ROWS.map(r => (r.endsWith(':') ? r : r + ':')).join('\n\n')}\n\nThanks,\nShivali`
const ONE_LINE = `Please fill skill Metrix- ${ROWS.join(' ')} Thanks, Shivali`
const ME = 'sam@inbox-one.example', OTHER = 'sam@inbox-two.example'
// Made-up mail. Nothing here is a real person or a real email.
const sent = (from, at, text) => ({ from: `Sam Carter <${from}>`, internalDate: String(at), bodyText: `Hi,\n\n${text}\n\nThanks,\nSam\n\nOn Mon, Dana wrote:\n> Full Name: Someone Else\n> Visa Status: OPT` })

test('the table is found in their mail, row by row, whichever way the words arrive', () => {
  for (const [how, text] of [['a row to a line', BY_LINE], ['run together', ONE_LINE]]) {
    const form = formIn(text)
    assert.deepEqual(form.map(f => f.key), ['name', 'phone', 'email', 'dob', 'location', 'relocation', 'visa', 'education', 'linkedin', 'ssn'], how)
    assert.deepEqual(form.filter(f => f.sensitive).map(f => f.key), ['dob', 'ssn'], how)
  }
  assert.equal(formIn(BY_LINE)[0].label, 'Full Name'); assert.equal(formIn(BY_LINE)[3].label, 'Date of Birth (DD/MM)')
  // Not a form: a mail that GIVES details, an ordinary mail that mentions a few of the words, an empty one.
  assert.deepEqual(formIn('Full Name: Dana Whitfield\nContact No: 555-0100\nEmail ID: dana@x.example\nCurrent Location: Austin, TX\nVisa Status: Citizen'), [])
  assert.deepEqual(formIn('Please send your updated resume, your visa status and your current location. What is your rate?'), [])
  assert.deepEqual(formIn(''), []); assert.deepEqual(formIn('Hi,\nThanks:\nRegards:'), [])
  // A row this file does not know is still a row when it sits among ones it does.
  assert.deepEqual(formIn('Full Name:\nContact No:\nEmail ID:\nVisa Status:\nFavourite Tool:').map(f => [f.label, f.key]).pop(), ['Favourite Tool', 'other'])
})

test('each row is filled from what he typed before in the same inbox; identity numbers and dates of birth never are', () => {
  const threads = [
    { messages: [sent(ME, 10, 'Full Name: Sam Carter\nContact No: 608-555-0142\nEmail ID: sam@inbox-one.example\nDate of Birth (DD/MM): 04/07\nCurrent Location: Houston, TX\nRelocation(Y/N): Y\nVisa Status: H1B\nEducational details: MS Computer Science, 2019\nLinkedIn Id: linkedin.com/in/samcarter\nSSN Last 4 Digit: 1234')] },
    { messages: [sent(ME, 20, 'Full Name: Sam Carter Current Location: Dallas, TX Visa Status: H1B Passport number: X1234567')] },
    // His other inbox is his other profile: never mixed in.
    { messages: [sent(OTHER, 30, 'Full Name: Samuel Carter\nCurrent Location: Saint Louis, MO\nVisa Status: GC')] },
  ]
  const answers = answersFrom(threads, ME)
  assert.deepEqual(Object.keys(answers).sort(), ['education', 'email', 'linkedin', 'location', 'name', 'phone', 'relocation', 'visa'])
  assert.deepEqual(answers.location, { value: 'Dallas, TX', at: 20, times: 2 }, 'the latest answer, and how often it was given')
  assert.deepEqual(answers.visa, { value: 'H1B', at: 20, times: 2 })
  for (const never of ['dob', 'ssn', 'passport', 'id_number']) { assert.equal(answers[never], undefined, never); assert.ok(isSensitive(never)) }
  assert.ok(!JSON.stringify(answers).includes('1234') && !JSON.stringify(answers).includes('04/07') && !JSON.stringify(answers).includes('X1234567'))
  assert.ok(!JSON.stringify(answers).includes('Someone Else') && !JSON.stringify(answers).includes('OPT'), 'mail he only quoted is not his answer')
  assert.equal(answersFrom(threads, OTHER).location.value, 'Saint Louis, MO'); assert.deepEqual(answersFrom(threads, ''), {})

  const filled = fillForm(formIn(BY_LINE), ME, answers, { name: 'Profile Name', phone: '000', location: 'Elsewhere' })
  assert.deepEqual(filled.map(f => [f.label, f.value, f.from]), [
    ['Full Name', 'Sam Carter', 'your earlier replies'], ['Contact No', '608-555-0142', 'your earlier replies'], ['Email ID', 'sam@inbox-one.example', 'your earlier replies'],
    ['Date of Birth (DD/MM)', '', ''], ['Current Location', 'Dallas, TX', 'your earlier replies'], ['Relocation(Y/N)', 'Y', 'your earlier replies'], ['Visa Status', 'H1B', 'your earlier replies'],
    ['Educational details', 'MS Computer Science, 2019', 'your earlier replies'], ['LinkedIn Id', 'linkedin.com/in/samcarter', 'your earlier replies'], ['SSN Last 4 Digit', '', ''],
  ])
  // Nothing typed before: the profile and the inbox itself fill what they can; the rest stays empty, never guessed.
  const fresh = fillForm(formIn(BY_LINE), ME, {}, { name: 'Sam Carter', location: 'Houston, TX', relocation: true })
  assert.deepEqual(fresh.filter(f => f.value).map(f => [f.key, f.value, f.from]), [['name', 'Sam Carter', 'your profile'], ['email', ME, 'this inbox'], ['location', 'Houston, TX', 'your profile'], ['relocation', 'Yes', 'your profile']])
  assert.deepEqual(fillForm(formIn(BY_LINE), ME, { dob: { value: '04/07', at: 1, times: 1 }, ssn: { value: '1234', at: 1, times: 1 } }).filter(f => f.sensitive).map(f => f.value), ['', ''], 'even handed an answer, those rows stay empty')

  assert.equal(formReply(filled, 'Shivali Rao', 'Sam'), 'Hi Shivali,\n\nHere are my details:\n\nFull Name: Sam Carter\nContact No: 608-555-0142\nEmail ID: sam@inbox-one.example\nDate of Birth (DD/MM):\nCurrent Location: Dallas, TX\nRelocation(Y/N): Y\nVisa Status: H1B\nEducational details: MS Computer Science, 2019\nLinkedIn Id: linkedin.com/in/samcarter\nSSN Last 4 Digit:\n\nThank you,\nSam')
  assert.equal(formSummary(filled, 'Shivali Rao'), 'Shivali sent a form with 10 details to fill in. I filled 8 from what you have sent before. 2 are yours to type each time (Date of Birth (DD/MM), SSN Last 4 Digit): I never keep or fill those.')
})

test('the reply offers the filled form first, Overview says it was asked for, and nothing sensitive is ever stored', () => {
  const api = read('src/app/api/gmail/form-fill/route.ts'), reply = read('src/app/dashboard/mail/_components/smart-reply.tsx'), overview = read('src/lib/mail-overview.ts'), lib = read('src/lib/mail-forms.ts')
  assert.ok(api.includes('formIn(') && api.includes('answersFrom(') && api.includes('fillForm(') && !api.includes('callLLM') && !api.includes('blob.put') && !api.includes('updateUser'))
  assert.ok(reply.includes('fetch("/api/gmail/form-fill"') && reply.includes('Fill in their form'))
  assert.ok(reply.includes('yours to type'), 'the rows he must type himself are said')
  assert.ok(overview.includes('formIn(') && overview.includes('details in their form'))
  assert.ok(lib.includes('const SENSITIVE = new Set<FieldKey>(["ssn", "dob", "passport", "id_number"])'))
})
