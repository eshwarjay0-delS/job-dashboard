// Replying in his own words (13 Oct 2026). The owner: "give me an option to at least write an email to them in my own
// words. Like if I'm typing something that was already been filled out many, many times, just on the drop down ... as a
// grid UI ... Once you click on that suggestion, it would just come out to the message that you are typing, and it would
// also auto-correct as a Grammarly ... people then hit G, and that would just correct the grammar."
// What went wrong before: the box to type in appeared only after one of the suggested replies was tapped, so a reply
// could not be started from nothing; and the box asked a model for the next words and for grammar on every pause.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { phrasesOf, suggestPhrases, applyPhrase, fragmentOf, tidyWriting, keepsMeaning } from '../../src/lib/my-phrases.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ME = 'me@example.com'
let n = 0
// Made-up mail. Nothing here is a real person or a real email.
const mine = (text, at = 1) => ({ id: 'm' + (++n), from: `Sam Carter <${ME}>`, internalDate: String(at), bodyText: `Hi Dana,\n\n${text}\n\nThanks,\nSam Carter\n\nOn Mon, Dana wrote:\n> I am available Monday after 2 PM Central.` })
const theirs = (text) => ({ id: 'm' + (++n), from: 'Dana Whitfield <dana@northpier.example>', internalDate: '1', bodyText: text })
const threads = [
  { messages: [mine('I am available Monday after 2 PM Central. My rate is $70/hr on C2C.', 1), theirs('I am available Monday after 2 PM Central. I am available Monday after 2 PM Central.')] },
  { messages: [mine('I am available monday after 2 PM Central! Please share the client name and the location.', 5)] },
  { messages: [mine('Please share the client name and the location. My rate is $70/hr on C2C. You can reach me at 608-555-0142 any time today.', 9)] },
  { messages: [mine('Please share the client name and the location. You can reach me at 608-555-0142 any time today. Yes.', 12)] },
]

test('what is offered is what he has himself written in more than one message, word for word', () => {
  const phrases = phrasesOf(threads, [ME])
  assert.deepEqual(phrases.map(p => [p.text, p.count]), [
    ['Please share the client name and the location.', 3],
    ['My rate is $70/hr on C2C.', 2],
    ['I am available monday after 2 PM Central!', 2],
  ], 'the most used first; the latest wording kept; a sentence written once is not offered')
  // Never: what the other person wrote, what he only quoted, a line with a phone number in it, a one-word answer.
  assert.ok(!phrases.some(p => /608-555|^Yes/.test(p.text)))
  assert.deepEqual(phrasesOf([], [ME]), []); assert.deepEqual(phrasesOf(threads, ['someone@else.example']), [])
})

test('as he types, the sentences that begin the same way come first, and one press puts the sentence in', () => {
  const phrases = phrasesOf(threads, [ME])
  assert.deepEqual(suggestPhrases(phrases, 'Hi Tom,\n\nPlease sh').map(p => p.text), ['Please share the client name and the location.'])
  assert.deepEqual(suggestPhrases(phrases, 'Thanks for the note. my rate').map(p => p.text), ['My rate is $70/hr on C2C.'], 'only the sentence being typed is looked at')
  assert.deepEqual(suggestPhrases(phrases, 'client location').map(p => p.text), ['Please share the client name and the location.'], 'or it holds every word typed')
  // Nothing for a letter or two, for a finished sentence, or for one that is already in the message.
  for (const body of ['', 'Pl', 'Hi Tom,\n', 'Please share the client name and the location. ', 'Something he has never written before']) assert.deepEqual(suggestPhrases(phrases, body), [], JSON.stringify(body))
  assert.deepEqual(suggestPhrases(phrases, 'Please share the client name and the location.\nplease sha'), [])
  // The sentence being typed is replaced by the one chosen; everything before it stays as it is.
  assert.equal(applyPhrase('Hi Tom,\n\nPlease sh', 'Please share the client name and the location.'), 'Hi Tom,\n\nPlease share the client name and the location. ')
  assert.equal(applyPhrase('Thanks for the note. my rate', 'My rate is $70/hr on C2C.'), 'Thanks for the note. My rate is $70/hr on C2C. ')
  assert.equal(applyPhrase('', 'My rate is $70/hr on C2C.'), 'My rate is $70/hr on C2C. ')
  assert.deepEqual(fragmentOf('One. Two? thr'), { start: 10, fragment: 'thr' })
  assert.equal(suggestPhrases(Array.from({ length: 20 }, (_, i) => ({ text: `Please send item number ${i} today.`, count: 2 })), 'please send').length, 6)
})

test('G puts right what needs no model, and touches nothing else', () => {
  const fixed = tidyWriting('hi tom ,i am intrested in teh role.i dont have a visa issue  and im availible monday .\nmy email is sam.i@example.com and the link is https://example.com/i/dont\n> i dont quote')
  assert.equal(fixed.text, 'Hi tom, I am interested in the role. I don\'t have a visa issue and I\'m available monday.\nMy email is sam.i@example.com and the link is https://example.com/i/dont\n> i dont quote')
  assert.ok(fixed.changes >= 6)
  // Already fine: nothing changes, and it says so.
  assert.deepEqual(tidyWriting('I am available Monday after 2 PM. My rate is $70/hr on C2C.'), { text: 'I am available Monday after 2 PM. My rate is $70/hr on C2C.', changes: 0 })
  assert.equal(tidyWriting('The rate is 70.5 and the version is v2.1, e.g. this one.').changes, 0, 'a number, a version and "e.g." are not sentences ending')
  assert.deepEqual(tidyWriting(''), { text: '', changes: 0 })
  // A model's correction is used only when it is still his message: same numbers, same lines, about the same length.
  const said = 'I am available Monday after 2 PM.\nMy rate is $70/hr on C2C.'
  assert.ok(keepsMeaning(said, 'I am available on Monday after 2 PM.\nMy rate is $70/hr on C2C.'))
  assert.ok(!keepsMeaning(said, 'I am available Monday after 3 PM.\nMy rate is $70/hr on C2C.'), 'a number changed')
  assert.ok(!keepsMeaning(said, 'I am available Monday after 2 PM. My rate is $70/hr on C2C.'), 'the lines changed')
  assert.ok(!keepsMeaning(said, 'I am available Monday after 2 PM.\nMy rate is $70/hr on C2C. I am also very excited about this wonderful opportunity and look forward to it.'), 'something was added')
  assert.ok(!keepsMeaning(said, ''))
})

test('the reply box can be started from nothing, offers his own sentences in a floating grid, and asks a model only when G is pressed', () => {
  const reply = read('src/app/dashboard/mail/_components/smart-reply.tsx'), box = read('src/app/dashboard/mail/_components/smart-compose.tsx'), polish = read('src/app/api/gmail/polish/route.ts'), phrases = read('src/app/api/gmail/phrases/route.ts')
  assert.ok(reply.includes('Write my own') && reply.includes('fetch("/api/gmail/phrases")') && reply.includes('phrases={phrases}'))
  // The box asks nothing of a model while he types: no call on a pause, for the next words or for grammar.
  assert.ok(!box.includes('/api/gmail/writing-assist') && !box.includes('setTimeout'))
  assert.ok(box.includes('suggestPhrases(phrases, value)') && box.includes('role="listbox"') && box.includes('applyPhrase(value, p.text)'))
  // G: a button, and Alt+G on the keyboard (a plain G is a letter of the message).
  assert.ok(box.includes('fetch("/api/gmail/polish"') && box.includes('e.altKey && e.key.toLowerCase() === "g"') && box.includes('Undo'))
  // The correction: the fixes that need no model first; a model's text is used only if it is still his message.
  assert.ok(polish.includes('tidyWriting(') && polish.includes('keepsMeaning(') && polish.includes('by: "rules"'))
  assert.ok(phrases.includes('phrasesOf(') && !phrases.includes('callLLM'))
})
