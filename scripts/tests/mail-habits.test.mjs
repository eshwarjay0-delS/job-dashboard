// What a person keeps doing by hand (12 Oct 2026). The owner: "show suggestions on what are the things that you are
// basically repeating yourself over and over again, and how we can help you with automating it, without you even defining
// what you might be needed to automate ... taking that task off the user's hand and taking it as an agent's job."
// These hold that a suggestion is only ever a count of what happened, in the person's own words, and that keeping one
// changes nothing by itself: a prepared message still waits for the person.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { findHabits, ownWords, shapeOf, alike, inYourWords, readyFor, validDecision, wordsOfMessage, neverId, TIMES } from '../../src/lib/mail-habits.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ME = 'me@example.com'
const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 12, 18, 0, 0)
const SIGN = '\n\nThanks & Regards,\nSam Carter\n+1 555-010-7788\nhttps://www.linkedin.example/in/sam-carter'
let n = 0
// Made-up mail. Nothing here is a real person or a real email.
const theirs = (who, email, daysAgo, category, text, subject = 'Security Analyst || Remote') => ({ id: 'm' + (++n), from: `${who} <${email}>`, to: ME, subject, snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text, category })
const mine = (to, daysAgo, text, subject = 'Re: Security Analyst || Remote') => ({ id: 'm' + (++n), from: `Sam Carter <${ME}>`, to, subject, snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text + SIGN + '\n\nOn Mon, Oct 5, 2026 at 9:14 AM Someone <x@y.example> wrote:\n> the earlier message\n> quoted here', category: 'General Correspondence' })
const thread = (id, ...messages) => ({ threadId: id, accountEmail: ME, messages })

const RATE = (name, rate) => `Hi ${name},\n\nMy rate is $${rate}/hr on C2C, all inclusive. I am available to start in two weeks and can interview any day this week.`
const NUDGE = (name) => `Hi ${name},\n\nJust checking in on this one. Is there any update from the client? I am still very interested.`
const people = [['Dana Whitfield', 'dana@northpier.example'], ['Omar Haddad', 'omar@brightline.example'], ['Priya Menon', 'priya@harborview.example'], ['Daniel Okoro', 'daniel@quayside.example']]

const THREADS = [
  // Four people ask for a rate; the answer is the same each time but for the figure and the name.
  ...people.map(([who, email], i) => thread('rate' + i,
    theirs(who, email, 20 - i, 'Rate Confirmation', 'Please confirm your hourly rate for this role.'),
    mine(email, 19.8 - i, RATE(who.split(' ')[0], 60 + i * 5)))),
  // Three go quiet and are written to a second time, four days later. Two answer.
  ...people.slice(0, 3).map(([who, email], i) => thread('chase' + i,
    theirs(who, email, 30 - i, 'Job Description', 'Sharing a requirement, please send your resume.', 'IAM Engineer || Hybrid'),
    mine(email, 29.9 - i, `Hi ${who.split(' ')[0]},\n\nPlease find my resume attached for the IAM Engineer role. Looking forward to the next steps.`, 'Re: IAM Engineer || Hybrid'),
    mine(email, 25.9 - i, NUDGE(who.split(' ')[0]), 'Re: IAM Engineer || Hybrid'),
    ...(i < 2 ? [theirs(who, email, 25 - i, 'Follow-up', 'Thanks, the client is reviewing.', 'RE: IAM Engineer || Hybrid')] : []))),
  // One is quiet right now for six days and has not been written to again.
  thread('quietnow', theirs('Lena Fischer', 'lena@oldcastle.example', 7, 'Job Description', 'Sharing a Splunk role.', 'Splunk Engineer (contract)'), mine('lena@oldcastle.example', 6, 'Hi Lena,\n\nYes, I am interested. My resume is attached.', 'Re: Splunk Engineer (contract)')),
  // Someone writes five times and is never answered; an application system does the same and is not a person.
  ...[1, 2, 3, 4, 5].map(i => thread('never' + i, theirs('Vik Rao', 'vik@blastmail.example', i * 3, 'Job Description', 'Hot requirement!!! Java developer, onsite.', 'Java Developer ' + i))),
  ...[1, 2, 3, 4, 5].map(i => thread('ats' + i, theirs('Careers', 'no-reply@lakeshore.example', i * 2, 'Submission Confirmation', 'Your application was received.', 'Application received'))),
  // Someone who was answered once is not "never answered".
  ...[1, 2, 3, 4].map(i => thread('known' + i, theirs('Tomas Reyes', 'tomas@ridgeway.example', 40 + i, 'Job Description', 'A PAM role for you.', 'PAM Consultant ' + i), ...(i === 1 ? [mine('tomas@ridgeway.example', 40.5, 'Hi Tomas,\n\nNot the right fit for me, but thank you for thinking of me.', 'Re: PAM Consultant 1')] : []))),
]
const found = findHabits(THREADS, [ME], NOW)
const by = (kind) => found.habits.filter(h => h.kind === kind)

test('a message of your own is parted into how it opens, what it says and how it is signed, with nothing reworded', () => {
  const p = ownWords(RATE('Dana', 60) + SIGN, 'Sam Carter')
  assert.equal(p.greeting, 'Hi Dana,')
  assert.equal(p.core, 'My rate is $60/hr on C2C, all inclusive. I am available to start in two weeks and can interview any day this week.')
  assert.equal(p.closing, 'Thanks & Regards,\nSam Carter\n+1 555-010-7788\nhttps://www.linkedin.example/in/sam-carter')
  assert.equal(ownWords('Thanks,\nSam', 'Sam Carter').core, '')                       // only a thank-you: nothing to repeat
  assert.equal(ownWords('I will call Sam tomorrow.', 'Sam Carter').core, 'I will call Sam tomorrow.')   // a sentence with the name in it is not a signature
  assert.equal(ownWords('', '').core, '')
  // A greeting with the answer on the same line: the name of the person it once went to is parted off, the answer stays.
  assert.deepEqual(ownWords('Hi Dana, my rate is $60/hr on C2C.\n\nThanks,\nSam', 'Sam Carter'), { greeting: 'Hi Dana,', core: 'my rate is $60/hr on C2C.', closing: 'Thanks,\nSam' })
  assert.equal(ownWords('Hey, quick question about the start date.', '').core, 'quick question about the start date.')
  // A first line that only begins like a greeting is an answer, and is kept whole.
  assert.equal(ownWords('Hello from the airport: I can talk after 4pm today.', '').core, 'Hello from the airport: I can talk after 4pm today.')
  assert.equal(ownWords('Good morning Dana,\n\nYes, tomorrow works.', '').greeting, 'Good morning Dana,')
  assert.equal(inYourWords({ text: ownWords('Hi Dana, my rate is $60/hr on C2C.').core, greeting: 'Hi' }, 'Lena Fischer'), 'Hi Lena,\n\nmy rate is $60/hr on C2C.')
})

test('nearly the same words means the figure and the name may differ, and a different message is different', () => {
  const a = shapeOf(ownWords(RATE('Dana', 60)).core), b = shapeOf(ownWords(RATE('Omar', 75)).core)
  assert.ok(alike(a, b) >= 1)
  assert.ok(alike(a, shapeOf(ownWords(NUDGE('Dana')).core)) < 1)
  assert.ok(alike(shapeOf('Yes, please go ahead.'), shapeOf('Yes please go ahead')) >= 1)
  assert.ok(alike(shapeOf('Yes, please go ahead.'), shapeOf('No, please do not go ahead with that submission.')) < 1)
  assert.equal(alike(shapeOf(''), shapeOf('')), 0)
})

test('the same reply written again and again is found, counted, and shown in your own words', () => {
  const [h, resume] = by('same_reply')
  assert.equal(by('same_reply').length, 2)
  assert.equal(resume.count, 3)                    // "Please find my resume attached" went to three requirements as well
  assert.equal(resume.when, 'requirement')
  assert.match(resume.title, /^You answered a new job requirement 3 times/)
  assert.equal(h.count, 4)
  assert.equal(h.people, 4)
  assert.equal(h.when, 'rate')
  assert.match(h.title, /^You answered a question about your rate 4 times, in nearly the same words\.$/)
  assert.match(h.typical, /^My rate is \$\d+\/hr on C2C, all inclusive\./)     // one of the four, word for word
  assert.ok(THREADS.some(t => t.messages.some(m => m.bodyText && m.bodyText.includes(h.typical))))
  assert.equal(h.greeting, 'Hi')
  assert.match(h.closing, /^Thanks & Regards,\nSam Carter/)
  assert.equal(h.examples.length, 4)
  assert.deepEqual(h.examples.map(e => e.threadId).sort(), ['rate0', 'rate1', 'rate2', 'rate3'])
  assert.ok(h.examples[0].at >= h.examples[1].at)                                // newest first
})

test('writing a second time to someone quiet is found, with how long you wait and how often it worked', () => {
  const [h] = by('chase')
  assert.equal(h.count, 3)
  assert.equal(h.days, 4)
  assert.equal(h.worked, 2)
  assert.match(h.title, /^You wrote a second time to 3 people who had gone quiet, usually after 4 days\. 2 of them answered\.$/)
  assert.match(h.typical, /^Just checking in on this one\./)
  // Quiet for four days or more right now, newest first: the Splunk role, the four rate answers nobody came back on, and
  // the nudge nobody answered. The role that was turned down ("not the right fit") is not one of them.
  assert.deepEqual(h.quiet.map(q => q.threadId), ['quietnow', 'rate3', 'rate2', 'rate1', 'rate0', 'chase2'])
  assert.equal(h.quiet[0].who, 'Lena Fischer')
  assert.equal(h.quiet[0].text, 'Splunk Engineer')
  assert.match(h.offer, /6 conversations are quiet that long right now\./)
  const declined = thread('declined', theirs('Noor Aziz', 'noor@kestrel.example', 9, 'Job Description', 'A role for you.'), mine('noor@kestrel.example', 8, 'Hi Noor,\n\nThank you, but this is not the right fit for me.'))
  assert.equal(findHabits([...THREADS, declined], [ME], NOW).habits.find(x => x.kind === 'chase').quiet.some(q => q.threadId === 'declined'), false)
})

test('someone who keeps writing and was never answered is found; a receipt machine and someone you did answer are not', () => {
  const never = by('never_answered')
  assert.equal(never.length, 1)
  assert.equal(never[0].sender.email, 'vik@blastmail.example')
  assert.equal(never[0].count, 5)
  assert.match(never[0].title, /^Vik Rao wrote to you 5 times and you never answered\.$/)
  assert.match(never[0].offer, /Nothing is deleted/)
  assert.equal(found.habits.some(h => /lakeshore|ridgeway/.test(JSON.stringify(h.sender || {}))), false)
})

test('twice is not a habit, and mail with an interview or an offer in it is never offered for hiding', () => {
  assert.equal(TIMES, 3)
  const twice = findHabits(THREADS.filter(t => ['rate0', 'rate1'].includes(t.threadId)), [ME], NOW)
  assert.deepEqual(twice.habits, [])
  const invited = [1, 2, 3, 4, 5].map(i => thread('inv' + i, theirs('Mara Lind', 'mara@steadfast.example', i, i === 3 ? 'Interview Request' : 'Job Description', 'A role.', 'Role ' + i)))
  assert.deepEqual(findHabits(invited, [ME], NOW).habits, [])
  assert.deepEqual(findHabits([], [ME], NOW).habits, [])
  assert.deepEqual(findHabits(THREADS, [], NOW).habits.filter(h => h.kind !== 'never_answered'), [])   // with no inbox of your own named, nothing is "yours"
})

test('what takes writing off your hands is listed first; people to stop showing come after, however often they wrote', () => {
  // Seen on the owner's own mail the evening it shipped: two senders nobody answered (45 and 17 mails) stood above the
  // reply he had written eleven times, which was behind "Show more".
  assert.deepEqual(found.habits.map(h => h.count), [4, 3, 3, 5])            // the sender who wrote five times is last all the same
  assert.equal(found.habits[0].kind, 'same_reply')
  assert.equal(found.habits[3].kind, 'never_answered')
  const kinds = found.habits.map(h => h.kind)
  assert.ok(kinds.lastIndexOf('same_reply') < kinds.indexOf('never_answered') && kinds.lastIndexOf('chase') < kinds.indexOf('never_answered'))
})

test('what was looked at is said: how many conversations and how many messages of your own', () => {
  assert.equal(found.looked.conversations, THREADS.length)
  assert.equal(found.looked.written, 4 + 6 + 1 + 1)
  assert.equal(found.looked.days, 90)
})

test('a decision is remembered: the habit comes back with the same id and its state, not as a new suggestion', () => {
  const [h] = by('same_reply')
  // What is kept is a pointer to one message of yours, not its words.
  const kept = { id: 'reply:kept-1', kind: 'same_reply', state: 'on', at: '2026-10-12', when: 'rate', ...h.anchor }
  assert.equal(validDecision(kept), true)
  assert.deepEqual(Object.keys(h.anchor).sort(), ['account', 'message', 'thread'])
  const again = findHabits(THREADS, [ME], NOW, [kept, { id: 'chase', kind: 'chase', state: 'off' }])
  assert.equal(again.habits.find(x => x.kind === 'same_reply').id, 'reply:kept-1')
  assert.equal(again.habits.find(x => x.kind === 'same_reply').state, 'on')
  assert.equal(again.habits.filter(x => x.kind === 'same_reply')[1].state, undefined)     // the other repeated reply is still only a suggestion
  assert.equal(again.habits.find(x => x.kind === 'chase').state, 'off')
  // The words come back from the mail, by the pointer: the same words the suggestion showed.
  const thread = THREADS.find(t => t.threadId === h.anchor.thread)
  assert.deepEqual(wordsOfMessage(thread, h.anchor.message), { text: h.typical, greeting: 'Hi', closing: h.closing })
  assert.equal(wordsOfMessage(thread, 'not-there'), null)
  assert.equal(wordsOfMessage(thread, thread.messages[0].id).text, 'Please confirm your hourly rate for this role.')
  assert.equal(found.habits.every(x => x.state === undefined), true)
  assert.equal(by('same_reply')[0].id, findHabits(THREADS, [ME], NOW + DAY).habits.find(x => x.kind === 'same_reply').id)   // the id does not move from day to day
})

test('a kept habit gets a message ready in your words, opened for the next person, and only when it fits', () => {
  const [reply] = by('same_reply'), [chase] = by('chase')
  const kept = [
    { id: reply.id, kind: 'same_reply', state: 'on', at: 'x', when: 'rate', text: reply.typical, greeting: reply.greeting, closing: reply.closing },
    { id: 'chase', kind: 'chase', state: 'on', at: 'x', text: chase.typical, greeting: chase.greeting, closing: chase.closing, days: chase.days },
  ]
  const body = inYourWords(kept[0], 'Lena Fischer')
  assert.ok(body.startsWith('Hi Lena,\n\nMy rate is $'))
  assert.ok(body.endsWith('https://www.linkedin.example/in/sam-carter'))
  assert.equal(body.includes('Dana') || body.includes('Omar') || body.includes('Priya') || body.includes('Daniel'), false)   // never the last person's name
  assert.deepEqual(readyFor(kept, { ask: 'rate', yourTurn: true, toName: 'Lena' }).map(r => r.label), ['Your usual reply'])
  assert.deepEqual(readyFor(kept, { ask: 'availability', yourTurn: true, toName: 'Lena' }), [])       // a rate answer is not offered to a question about times
  assert.deepEqual(readyFor(kept, { ask: 'rate', yourTurn: false, toName: 'Lena' }), [])              // nobody is asking
  assert.deepEqual(readyFor(kept, { lastMine: true, quietDays: 6, toName: 'Lena' }).map(r => r.label), ['Your usual nudge'])
  assert.deepEqual(readyFor(kept, { lastMine: true, quietDays: 2, toName: 'Lena' }), [])              // too soon
  assert.deepEqual(readyFor(kept.map(k => ({ ...k, state: 'off' })), { ask: 'rate', yourTurn: true, lastMine: true, quietDays: 9, toName: 'Lena' }), [])
  assert.deepEqual(readyFor([], { ask: 'rate', yourTurn: true, toName: 'Lena' }), [])
  // The usual answer to a requirement is offered when they wrote last and asked nothing the inbox has a name for.
  const resume = by('same_reply')[1]
  const both = [...kept, { id: resume.id, kind: 'same_reply', state: 'on', at: 'x', when: 'requirement', text: resume.typical, greeting: resume.greeting, closing: resume.closing }]
  assert.match(readyFor(both, { lastMine: false, toName: 'Noor Aziz' })[0].body, /^Hi Noor,\n\nPlease find my resume attached/)
  assert.match(readyFor(both, { ask: 'rate', yourTurn: true, toName: 'Noor' })[0].body, /My rate is/)          // a named ask gets its own answer
  assert.deepEqual(readyFor(both, { lastMine: true, quietDays: 1, toName: 'Noor' }), [])                     // you wrote last: nothing to answer
})

test('only a well-formed decision is ever stored, and it is small: it rides in the sign-in cookie', () => {
  const chase = { id: 'chase', kind: 'chase', state: 'on', at: '2026-10-12', days: 4, account: ME, thread: 'chase1', message: 'm12' }
  assert.equal(validDecision(chase), true)
  assert.equal(validDecision({ id: 'never:1x9k2', kind: 'never_answered', state: 'off' }), true)
  // The largest a decision can be: every field at its longest that a real one reaches.
  const big = { id: 'reply:' + 'z'.repeat(8), kind: 'same_reply', state: 'on', at: '2026-10-12', when: 'availability', account: 'a-rather-long-address-of-mine@example-mail.com', thread: '19a1b2c3d4e5f6a7', message: '19a1b2c3d4e5f6a7' }
  assert.equal(validDecision(big), true)
  assert.ok(JSON.stringify(big).length < 220, 'a decision is a pointer, a few dozen bytes')
  for (const bad of [null, [], {}, 'chase',
    { ...chase, id: '' }, { ...chase, id: 'a'.repeat(41) }, { ...chase, id: 'Chase Me!' },
    { ...chase, kind: 'send_everything' }, { ...chase, state: 'maybe' }, { ...chase, days: 0 }, { ...chase, days: 2.5 }, { ...chase, at: '2026-10-12T00:00:00.000Z' },
    { ...chase, thread: 'x'.repeat(101) }, { ...chase, message: 'has spaces' }, { ...chase, account: 'not an address' },
    // Words, of any length, are never part of a decision: they would be carried on every request.
    { ...chase, text: 'Just checking in.' }, { ...chase, closing: 'Thanks' }, { ...chase, anything: 1 }]) assert.equal(validDecision(bad), false, JSON.stringify(bad))
  const route = read('src/app/api/gmail/habits/route.ts')
  assert.match(route, /if \(!validDecision\(decision\)\) return/)             // checked before it is saved
  assert.match(route, /MOST_ON = \d\b/)
  assert.match(route, /MOST_OFF = \d{1,2}\b/)
})

test('keeping a habit sends nothing: the endpoint only stores the decision, and the page says a prepared message waits for you', () => {
  const route = read('src/app/api/gmail/habits/route.ts')
  assert.match(route, /requireAuth\(\)/)
  assert.match(route, /keptThreads\(/)
  assert.doesNotMatch(route, /gmail-send|gmailSend|sendGmailMessage|messages\/send|drafts\/send/)
  assert.match(route, /validDecision\(/)
  const page = read('src/app/dashboard/workflows/page.tsx')
  assert.match(page, /<Habits\b/)
  const section = read('src/app/dashboard/workflows/_components/habits.tsx')
  assert.match(section, /Nothing is sent without your OK/)
  assert.doesNotMatch(section, /gmail-send/)
  const reply = read('src/app/dashboard/mail/_components/smart-reply.tsx')
  assert.match(reply, /readyFor\(/)                       // the kept words are offered where a reply is written
  assert.match(reply, /Approve & Send/)                   // and still go out only on that button
})

// ── Found by the review of 12 Oct 2026, each with the case that failed ───────────────────────────────────────────────
// A message exactly as given: no signature or quoted mail added by the helper above.
const own = (to, daysAgo, body, extra = {}) => ({ id: 'm' + (++n), from: `Sam Carter <${ME}>`, to, subject: 'Re: A role', snippet: String(body).slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: body, category: 'General Correspondence', ...extra })
const asked = (i, who = people[i % 4]) => theirs(who[0], who[1], 20 - i, 'Job Description', 'Sharing a requirement, are you interested?')

test('different short answers that end in the same signature are not one repeated reply', () => {
  const answers = ['Yes, please go ahead with it today.', 'Sounds good to me, thank you kindly.', 'I am not interested in this one.']
  for (const sign of [
    '\n\nThanks & Regards,\nSam Carter\n(555) 010-7788\nhttps://www.linkedin.example/in/sam-carter',     // a phone in brackets
    '\n\nThanks & Regards,\nSam J. Carter\nSenior Security Analyst | CISSP\nAcme Consulting LLC',       // a title and a company under the name
    '\n\nSenior Security Analyst | CISSP\nAcme Consulting LLC\nDallas, TX 75001 | Open to remote',      // no sign-off and no name at all
  ]) {
    const threads = answers.map((a, i) => thread('sig' + i, asked(i), own(people[i][1], 19 - i, a + sign, { from: `Sam J. Carter <${ME}>` })))
    assert.deepEqual(findHabits(threads, [ME], NOW).habits.filter(h => h.kind === 'same_reply'), [], sign.slice(0, 40))
  }
  assert.equal(ownWords('Yes, go ahead.\n\nThanks & Regards,\nSam J. Carter\n+1 555-010-7788', 'Sam J. Carter').core, 'Yes, go ahead.')
  assert.equal(ownWords('Yes, go ahead.\n\nRegards,\nSam Carter\nSenior Security Analyst | CISSP\nAcme Consulting LLC', 'Sam Carter').core, 'Yes, go ahead.')
  assert.equal(ownWords('Yes, go ahead.\n\nSam Carter\n(555) 010-7788', 'Sam Carter').core, 'Yes, go ahead.')
  // What is under a thank-you is only a signature when it looks like one: a sentence is still the message.
  assert.equal(ownWords('Thanks\nPlease call me at five, I will be free then.', 'Sam Carter').core, 'Thanks\nPlease call me at five, I will be free then.')
  assert.equal(ownWords('I can start Monday.\nThanks,\nAlso, could you send the client name?', 'Sam Carter').core, 'I can start Monday.\nThanks,\nAlso, could you send the client name?')
})

test('a reply with nothing typed in it has no words of yours: the mail quoted under it is never shown as yours', () => {
  const quoted = (who) => `On Mon, Oct 5, 2026 at 9:12 AM ${who[0]} <${who[1]}> wrote:\n> Sharing a requirement, are you interested?\n> Please send your updated resume.`
  const empty = [0, 1, 2].map(i => thread('empty' + i, asked(i), own(people[i][1], 19 - i, quoted(people[i]))))
  assert.deepEqual(findHabits(empty, [ME], NOW).habits, [])
  const forwards = [0, 1, 2].map(i => thread('fwd' + i, own(people[i][1], 19 - i, '---------- Forwarded message ---------\nFrom: Vik Rao <vik@blastmail.example>\nSubject: Java Developer\n\nHot requirement, onsite, 12 months.')))
  assert.deepEqual(findHabits(forwards, [ME], NOW).habits, [])
  // Only Gmail's first line was kept: it cannot be told where your words end, so none are taken.
  const snippetOnly = [0, 1, 2, 3].map(i => thread('snip' + i, asked(i), { ...own(people[i][1], 19 - i, ''), bodyText: undefined, snippet: `My rate is $6${i}/hr on C2C. Thanks, Sam Carter On Mon, Oct 5, 2026 ${people[i][0]} wrote: Please confirm your hourly rate` }))
  assert.deepEqual(findHabits(snippetOnly, [ME], NOW).habits, [])
  assert.equal(findHabits(snippetOnly, [ME], NOW).looked.written, 4)      // they are still counted as written
  assert.equal(wordsOfMessage(empty[0], empty[0].messages[1].id), null)
  assert.equal(wordsOfMessage(snippetOnly[0], snippetOnly[0].messages[1].id), null)
})

test('"your usual nudge" exists only when the second messages are themselves alike; the sentence counts people as people', () => {
  // Three second messages that have nothing to do with each other.
  const seconds = ['Sorry, I attached the wrong file earlier. The right resume is attached now.', 'One more note: my visa is valid through 2029 and needs no sponsorship.', 'My reference at Harborview is Raj Patel, 555-010-2211. Please call him after 5 pm.']
  const unlike = seconds.map((s, i) => thread('unlike' + i, asked(i), own(people[i][1], 15 - i, 'Yes, I am interested in this role. My resume is attached.'), own(people[i][1], 11 - i, s)))
  const c = findHabits(unlike, [ME], NOW).habits.find(h => h.kind === 'chase')
  assert.equal(c.count, 3)
  assert.equal(c.typical, undefined)                     // was: the newest second message, the Raj Patel one
  assert.equal(c.anchor, undefined)
  assert.match(c.action, /^Show me who is quiet after \d+ days?$/)
  assert.match(c.offer, /the words stay yours to write/)
  assert.deepEqual(readyFor([{ id: 'chase', kind: 'chase', state: 'on', days: c.days }], { lastMine: true, quietDays: 9, toName: 'Lena' }), [])
  // Three people, two of them written to twice more: five times, three people.
  const again = [0, 1, 2].map(i => thread('again' + i, theirs(people[i][0], people[i][1], 31, 'Job Description', 'Sharing a requirement, are you interested?'),
    own(people[i][1], 30, 'Yes, I am interested in this role. My resume is attached.'),
    own(people[i][1], 26, NUDGE(people[i][0].split(' ')[0])),
    ...(i < 2 ? [own(people[i][1], 22, NUDGE(people[i][0].split(' ')[0]))] : [])))
  const five = findHabits(again, [ME], NOW).habits.find(h => h.kind === 'chase')
  assert.equal(five.count, 5)
  assert.equal(five.people, 3)
  assert.match(five.title, /^You wrote again 5 times to 3 people who had gone quiet, usually after 4 days\. 0 of those 5 got an answer\.$/)
  assert.match(five.typical, /^Just checking in on this one\./)             // five alike: these are a nudge
  // Written to three times running with no answer is not asked a fourth time; twice running still is.
  assert.deepEqual(five.quiet.map(q => q.threadId), ['again2'])
})

test('a greeting is parted however the name was typed, and the last person\'s name never goes out to the next', () => {
  for (const [line, greeting, core] of [
    ['Hi priya,\n\nYes.', 'Hi priya,', 'Yes.'], ['hi dana,\n\nYes.', 'hi dana,', 'Yes.'], ['Hi Dana and Omar,\n\nYes.', 'Hi Dana and Omar,', 'Yes.'],
    ['Hi Dana -\n\nYes.', 'Hi Dana -', 'Yes.'], ['Hi guys,\n\nYes.', 'Hi guys,', 'Yes.'], ['Dear Dr. Lind:\n\nYes.', 'Dear Dr. Lind:', 'Yes.'],
    ['Hi Dana: my rate is $60/hr.', 'Hi Dana:', 'my rate is $60/hr.'], ['Hi Dana. My rate is $60/hr.', 'Hi Dana.', 'My rate is $60/hr.'],
    ['Hi, I am interested in this role.', 'Hi,', 'I am interested in this role.'], ['Hello!\nYes.', 'Hello!', 'Yes.'],
  ]) assert.deepEqual([ownWords(line, 'Sam Carter').greeting, ownWords(line, 'Sam Carter').core], [greeting, core], line)
  // Lines that only begin like a greeting are answers, kept whole.
  for (const line of ['Hello from the airport: I can talk after 4pm today.', 'Hi I am interested in this role', 'Hi I am interested,', 'Highly interested in this one.', 'Hey there is one thing I forgot to mention about my visa']) assert.equal(ownWords(line, '').core, line, line)
  const lower = people.map(([who, email], i) => thread('low' + i, theirs(who, email, 20 - i, 'Rate Confirmation', 'Please confirm your hourly rate.'), own(email, 19 - i, `Hi ${who.split(' ')[0].toLowerCase()},\n\nMy rate is $6${i}/hr on C2C, all inclusive. I can start in two weeks.\n\nThanks,\nSam Carter`)))
  const h = findHabits(lower, [ME], NOW).habits.find(x => x.kind === 'same_reply')
  assert.match(h.typical, /^My rate is \$6\d\/hr on C2C, all inclusive\. I can start in two weeks\.$/)   // was: "Hi daniel,\n\nMy rate ..."
  const out = inYourWords({ text: h.typical, greeting: h.greeting, closing: h.closing }, 'Lena Fischer')
  assert.ok(out.startsWith('Hi Lena,\n\nMy rate is') && !/dana|omar|priya|daniel/i.test(out))
})

test('"never answered" is not said of someone you did write to, from any inbox or in any conversation', () => {
  const OTHER = 'me.too@example.com'
  const four = [1, 2, 3, 4].map(i => thread('na' + i, theirs('Vik Rao', 'vik@blastmail.example', i * 3, 'Job Description', 'Hot requirement.', 'Java ' + i)))
  assert.equal(findHabits(four, [ME, OTHER], NOW).habits.length, 1)
  // Answered once from the other inbox.
  const elsewhere = { threadId: 'nb', accountEmail: OTHER, messages: [{ ...theirs('Vik Rao', 'vik@blastmail.example', 50, 'Job Description', 'A role.'), to: OTHER }, { ...own('vik@blastmail.example', 49, 'Not for me, thank you for asking.'), from: `Sam Carter <${OTHER}>` }] }
  assert.deepEqual(findHabits([...four, elsewhere], [ME, OTHER], NOW).habits.filter(h => h.kind === 'never_answered'), [])   // was: "wrote to you 4 times and you never answered"
  // Written to in a conversation of your own.
  const myOwn = thread('nc', own('Vik Rao <vik@blastmail.example>', 60, 'Hello Vik, are there any SOC roles open at the moment?'))
  assert.deepEqual(findHabits([...four, myOwn], [ME, OTHER], NOW).habits.filter(h => h.kind === 'never_answered'), [])
  const ccd = thread('nd', theirs('Omar Haddad', 'omar@brightline.example', 61, 'Job Description', 'A role.'), own('omar@brightline.example', 60, 'Adding Vik, who asked about this one too.', { cc: 'Vik Rao <vik@blastmail.example>' }))
  assert.deepEqual(findHabits([...four, ccd], [ME, OTHER], NOW).habits.filter(h => h.kind === 'never_answered'), [])
})

test('no two people and no two inboxes share the name a habit goes by', () => {
  assert.notEqual(neverId('samcarter24@example.com', 'vik@blastmail.example'), neverId('samcarter44@example.com', 'vik@blastmail.example'))   // was: the same
  assert.notEqual(neverId(ME, 'recruiter1@blastmail.example'), neverId(ME, 'recruiter2@blastmail.example'))
  assert.equal(neverId('ME@Example.com', 'Vik@Blastmail.example'), neverId('me@example.com', 'vik@blastmail.example'))
  assert.match(neverId(ME, 'vik@blastmail.example'), /^never:[a-z0-9]+$/)
  assert.equal(validDecision({ id: neverId(ME, 'vik@blastmail.example'), kind: 'never_answered', state: 'on' }), true)
  const two = ['recruiter1', 'recruiter2'].flatMap(r => [1, 2, 3, 4].map(i => thread(r + i, theirs('Blast ' + r, r + '@blastmail.example', i * 2, 'Job Description', 'Hot requirement.', 'Role ' + i))))
  const habits = findHabits(two, [ME], NOW, [{ id: neverId(ME, 'recruiter1@blastmail.example'), kind: 'never_answered', state: 'on' }]).habits
  assert.deepEqual(habits.map(h => String(h.state)).sort(), ['on', 'undefined'])           // one is decided, the other is not
})

test('a kept reply is still known when the message it points at has grown too old to be read', () => {
  const [h] = by('same_reply')
  const gone = { id: h.id, kind: 'same_reply', state: 'on', at: '2026-07-01', when: 'rate', account: ME, thread: 'long-gone', message: 'old1' }
  const again = findHabits(THREADS, [ME], NOW, [gone]).habits.find(x => x.id === h.id)
  assert.equal(again.state, 'on')                         // was: offered again as new, and listed as handed over too
  assert.equal(again.moved, true)                         // and the pointer is to be moved to a message that is still there
  assert.deepEqual(again.anchor, h.anchor)
  assert.equal(findHabits(THREADS, [ME], NOW, [{ ...gone, ...h.anchor }]).habits.find(x => x.id === h.id).moved, undefined)
  const route = read('src/app/api/gmail/habits/route.ts')
  assert.match(route, /h\.moved/)                         // the endpoint moves it
})

test('nothing the person kept is ever dropped to make room, and a hidden sender can always be brought back', () => {
  const route = read('src/app/api/gmail/habits/route.ts')
  // As many as may be kept are kept: the next one is refused in plain words. It used to push the oldest out silently,
  // so hiding five senders threw away the kept usual reply and then the nudge.
  assert.match(route, /if \(!hides && same >= MOST_ON\) return NextResponse\.json\(\{ ok: false, error: `\$\{MOST_ON\} are kept already\. Take one back to keep another\.` \}, \{ status: 409 \}\)/)
  assert.match(route, /if \(hides && same >= MOST_HIDDEN\) return NextResponse\.json\(/)
  assert.match(route, /next\.filter\(d => d\.state === "on"\), \.\.\.next\.filter\(d => d\.state === "off"\)\.slice\(-MOST_OFF\)/, 'only an old "not now" ever falls away')
  assert.doesNotMatch(route, /state === "on"\)\.slice\(/)
  // Hidden senders and kept words are counted apart: one cannot crowd out the other.
  assert.match(route, /\(d\.kind === "never_answered"\) === hides/)
  // A hidden sender is kept as its name alone; the rule it made is found again by that name, for "Show them again".
  assert.match(route, /const decision: Decision = hides\s*\? \{ id, kind: habit\.kind, state \}/)
  assert.match(route, /neverId\(r\.account, r\.value\) === id/)
  assert.match(route, /const without = \(\) => \{ const rule = ruleOf\(id, rules\); return rule \? rules\.filter\(r => r !== rule\) : rules \}/, 'undo takes away that one rule and no other')
  // Listed as hidden only while its rule is really there: taken away in Tidy up, it is simply shown again.
  assert.match(route, /!\(h\.kind === "never_answered" && !ruleOf\(h\.id, rules\)\)/)
  // The reply box is given kept words only; a hidden sender has none.
  assert.match(route, /const words = kept\.filter\(d => d\.kind !== "never_answered"\)/)
  // A chase whose second messages were each different has no words to offer, and the page says so.
  const section = read('src/app/dashboard/workflows/_components/habits.tsx')
  assert.match(section, /h\.typical \? "your nudge is ready\." : "MarketFit lists who went quiet\."/)
  assert.match(section, /your second messages were each different, so the words stay yours/)
})
