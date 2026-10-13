// Overview, with the dots connected (13 Oct 2026). The owner: "if someone ... addressed those requirements and followed
// up, sent my details and they have shooted back ... that actually goes to the overview since something was started ...
// if no one is following up it anymore then it is gonna be a major hassle for me ... the best guidance. Like, hey, you
// have received this email and you have to send an updated resume. Here's this recruiter's contact ... I need a contact
// box for everyone." And: "the dots are [not] connected well in the overview even now, the contact info about everyone
// and ignore list ... use intelligence to throw for user what's important and not."
// These hold that every sentence Overview says comes from the mail: a kind it was given, a date, or the other person's
// own words; and that what matters is put first for a reason that is said.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { overviewOf, askedFor, companyOf, STAGE_WORDS } from '../../src/lib/mail-overview.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ME = 'me@example.com'
const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 13, 18, 0, 0)
let n = 0
// Made-up mail. Nothing here is a real person or a real email.
const theirs = (who, email, daysAgo, category, text, subject = 'Security Analyst || Remote') => ({ id: 'm' + (++n), from: `${who} <${email}>`, to: ME, subject, snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text, category })
const mine = (to, daysAgo, text, subject = 'Re: Security Analyst || Remote') => ({ id: 'm' + (++n), from: `Sam Carter <${ME}>`, to, subject, snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text + '\n\nThanks,\nSam Carter\n\nOn Mon, Oct 5, 2026 at 9:14 AM Someone <x@y.example> wrote:\n> the earlier message', category: 'General Correspondence' })
const thread = (id, ...messages) => ({ threadId: id, accountEmail: ME, messages })
const JD = 'Sharing a requirement for a Security Analyst, 12 months, remote.'
const ANSWER = 'Hi,\n\nYes, I am interested. My details are below and my resume is attached.'

const T = {
  // A requirement, answered with details; they wrote back asking for two things. This is "started", and it waits on him.
  cameBack: thread('cameBack', theirs('Dana Whitfield', 'dana@northpier-staffing.example', 6, 'Job Description', JD), mine('dana@northpier-staffing.example', 5, ANSWER),
    theirs('Dana Whitfield', 'dana@northpier-staffing.example', 1, 'General Correspondence', 'Thank you, I received your details.\nCould you send your updated resume and confirm your visa status?\n\nThanks,\nDana Whitfield\nDesk: (608) 555-0142')),
  // Answered six days ago; nothing since.
  quiet: thread('quiet', theirs('Omar Haddad', 'omar@brightline.example', 8, 'Job Description', JD, 'IAM Engineer || Hybrid'), mine('omar@brightline.example', 6, ANSWER, 'Re: IAM Engineer || Hybrid')),
  // Written to three times in a row, no answer; their number is in their first mail.
  thrice: thread('thrice', theirs('Priya Menon', 'priya@harborview.example', 14, 'Job Description', JD + '\n\nPriya Menon\n(555) 010-2211', 'SOC Lead'), mine('priya@harborview.example', 13, ANSWER, 'Re: SOC Lead'), mine('priya@harborview.example', 9, 'Just checking in on this one.', 'Re: SOC Lead'), mine('priya@harborview.example', 5, 'Is there any update?', 'Re: SOC Lead')),
  // Answered yesterday.
  fresh: thread('fresh', theirs('Daniel Okoro', 'daniel@quayside.example', 2, 'Job Description', JD, 'PAM Engineer'), mine('daniel@quayside.example', 1, ANSWER, 'Re: PAM Engineer')),
  // They said there is no news yet and they will come back.
  waits: thread('waits', theirs('Lena Fischer', 'lena@oldcastle.example', 9, 'Job Description', JD, 'Splunk Engineer'), mine('lena@oldcastle.example', 8, ANSWER, 'Re: Splunk Engineer'), theirs('Lena Fischer', 'lena@oldcastle.example', 2, 'Follow-up', 'No update yet from the client. I will keep you posted.', 'RE: Splunk Engineer')),
  // They acknowledged nine days ago and nothing has moved.
  stale: thread('stale', theirs('Noor Aziz', 'noor@kestrel.example', 12, 'Job Description', JD, 'GRC Analyst'), mine('noor@kestrel.example', 11, ANSWER, 'Re: GRC Analyst'), theirs('Noor Aziz', 'noor@kestrel.example', 9, 'General Correspondence', 'Thanks, noted. I have shared it with the account manager.', 'RE: GRC Analyst')),
  // An interview is being set up and they are waiting for times.
  interview: thread('interview', theirs('Mara Lind', 'mara@steadfast.example', 7, 'Job Description', JD, 'Security Engineer'), mine('mara@steadfast.example', 6, ANSWER, 'Re: Security Engineer'), theirs('Mara Lind', 'mara@steadfast.example', 1, 'Interview Request', 'The manager would like to speak with you. Please share your availability for tomorrow.', 'Interview || Security Engineer')),
  // A go-ahead asked, and he has not written a word yet.
  rtr: thread('rtr', theirs('Tomas Reyes', 'tomas@ridgeway.example', 2, 'RTR Request', 'Please confirm the right to represent for this role at $62/hr.', 'RTR || Cloud Security Engineer')),
  // A requirement nobody answered: not started.
  unanswered: thread('unanswered', theirs('Vik Rao', 'vik@blastmail.example', 3, 'Job Description', 'Hot requirement!!! Java developer.', 'Java Developer')),
  // Closed: they said no; he said no; and one that went cold two months ago.
  rejected: thread('rejected', theirs('Ivo Marsh', 'ivo@closed.example', 10, 'Job Description', JD), mine('ivo@closed.example', 9, ANSWER), theirs('Ivo Marsh', 'ivo@closed.example', 3, 'Rejection', 'Unfortunately the client went with another candidate.')),
  declined: thread('declined', theirs('Uma Roy', 'uma@passed.example', 10, 'Job Description', JD), mine('uma@passed.example', 9, 'Hi Uma,\n\nThank you, but this is not the right fit for me.')),
  cold: thread('cold', theirs('Old Hand', 'old@longago.example', 62, 'Job Description', JD), mine('old@longago.example', 60, ANSWER)),
  // A machine: a receipt nobody can call.
  machine: thread('machine', theirs('Careers', 'no-reply@lakeshore.example', 4, 'Submission Confirmation', 'Your application was received.', 'Application received')),
}
const ALL = Object.values(T)
const o = overviewOf(ALL, [ME], NOW)
const by = Object.fromEntries([...o.needsYou, ...o.goneQuiet, ...o.moving].map(s => [s.threadId, s]))

test('what a mail asks for is taken from sentences that ask, in plain words', () => {
  assert.deepEqual(askedFor('Thank you, I received your details.\nCould you send your updated resume and confirm your visa status?'), ['your updated resume', 'your visa status'])
  assert.deepEqual(askedFor('I received your resume. The rate for this role is good.'), [], 'saying a word is not asking for the thing')
  assert.deepEqual(askedFor('Please share your availability for tomorrow.'), ['the times you are free'])
  assert.deepEqual(askedFor('Kindly confirm the right to represent and your hourly rate.'), ['your go-ahead to put you forward', 'your rate'])
  assert.deepEqual(askedFor('What is your current location? Do you have a LinkedIn profile?'), ['your location', 'your LinkedIn'])
  assert.equal(askedFor('Please send your resume, rate, availability, visa status, location, phone number and references.').length, 4, 'four things are enough for one sentence')
  assert.deepEqual(askedFor(''), [])
})

test('a requirement that was answered and came back is on Overview, with what to do next in one sentence', () => {
  const s = by.cameBack
  assert.equal(s.stage, 'came_back')
  assert.equal(STAGE_WORDS[s.stage], 'They came back')
  assert.equal(s.group, 'needs_you')
  assert.equal(s.doNext, 'Dana asked for your updated resume and your visa status.')
  assert.equal(s.action, 'reply')
  assert.equal(s.about, 'Security Analyst')
  // The contact box: who, where they work, and the number THEY wrote.
  assert.deepEqual(s.contact, { name: 'Dana Whitfield', email: 'dana@northpier-staffing.example', company: 'Northpier Staffing', phones: ['(608) 555-0142'] })
})

test('one that went quiet is named, with how long, and a nudge is due; three in a row and a call is suggested', () => {
  assert.equal(by.quiet.group, 'gone_quiet')
  assert.equal(by.quiet.doNext, 'You wrote 6 days ago and Omar has not answered. A short, friendly nudge is due.')
  assert.equal(by.quiet.action, 'nudge')
  assert.equal(by.quiet.quietDays, 6)
  assert.equal(by.thrice.nudges, 2)
  assert.equal(by.thrice.action, 'call')
  assert.equal(by.thrice.doNext, 'You have written 3 times in a row and Priya has not answered. Calling may do more: (555) 010-2211.')
  assert.equal(by.stale.group, 'gone_quiet')
  assert.equal(by.stale.doNext, 'Noor last wrote 9 days ago and nothing has moved since. Ask where it stands.')
  // How long is waited before a nudge is the person's own habit when it is known.
  assert.equal(o.nudgeAfterDays, 4)
  const patient = overviewOf(ALL, [ME], NOW, { nudgeAfterDays: 7 })
  assert.equal(patient.goneQuiet.some(s => s.threadId === 'quiet'), false)
  assert.equal(patient.moving.find(s => s.threadId === 'quiet').doNext, 'You answered 6 days ago. Nothing to do yet; a nudge is due after 7 days of silence.')
})

test('nothing is asked of him when it is not his turn', () => {
  assert.equal(by.fresh.group, 'moving')
  assert.equal(by.fresh.doNext, 'You answered 1 day ago. Nothing to do yet; a nudge is due after 4 days of silence.')
  assert.equal(by.waits.group, 'moving')
  assert.equal(by.waits.doNext, 'Lena said they will come back to you. Nothing to do yet.')
  assert.equal([by.fresh, by.waits].every(s => s.action === 'none' && !s.yourTurn), true)
})

test('an ask counts before he has written a word; a requirement nobody answered has not started', () => {
  assert.equal(by.rtr.stage, 'rtr')
  assert.equal(by.rtr.group, 'needs_you')
  assert.equal(by.rtr.doNext, 'Tomas asked for your go-ahead to put you forward.')    // a figure in the mail is not a question about it
  assert.equal(by.unanswered, undefined)
  assert.equal(by.interview.stage, 'interview')
  assert.equal(by.interview.doNext, 'Mara asked for the times you are free.')
})

test('what is over is counted and not shown: they said no, he said no, or it went cold', () => {
  assert.equal(by.rejected, undefined)
  assert.equal(by.declined, undefined)
  assert.equal(by.cold, undefined)
  assert.deepEqual(o.counts, { closed: 2, cold: 1, lapsed: 0 })
})

test('what matters most is on top, and the reasons are said', () => {
  assert.deepEqual(o.needsYou.map(s => s.threadId), ['interview', 'rtr', 'cameBack'])       // furthest along first
  assert.deepEqual(o.highlights.map(s => s.threadId), ['interview', 'rtr', 'cameBack'])
  assert.deepEqual(by.interview.why, ['Interview', 'waiting on you'])
  assert.deepEqual(by.quiet.why, ['You answered', 'quiet 6 days'])
  assert.ok(by.interview.weight > by.rtr.weight && by.rtr.weight > by.cameBack.weight)
  // With nothing waiting on him, the quiet ones are what is put on top.
  const calm = overviewOf([T.quiet, T.thrice, T.stale, T.fresh], [ME], NOW)
  assert.deepEqual(calm.highlights.map(s => s.group), ['gone_quiet', 'gone_quiet', 'gone_quiet'])
  // How close it is to the work he looks for counts, when that is known, and is said.
  const fit = overviewOf(ALL, [ME], NOW, { fit: (id) => (id === 'cameBack' ? 90 : 10) })
  const s = fit.needsYou.find(x => x.threadId === 'cameBack')
  assert.equal(s.weight, by.cameBack.weight + 18)
  assert.ok(s.why.includes('close to the work you look for'))
})

test('everyone who wrote has a contact box; a machine has none', () => {
  const people = Object.fromEntries(o.people.map(p => [p.email, p]))
  assert.equal(o.looked.people, 12)
  assert.equal(o.looked.machines, 1)
  assert.equal(people['no-reply@lakeshore.example'], undefined)
  assert.deepEqual(people['priya@harborview.example'].phones, ['(555) 010-2211'])
  assert.equal(people['dana@northpier-staffing.example'].company, 'Northpier Staffing')
  assert.deepEqual([people['dana@northpier-staffing.example'].working, people['dana@northpier-staffing.example'].stage, people['dana@northpier-staffing.example'].yourTurn, people['dana@northpier-staffing.example'].answered], [true, 'came_back', true, true])
  // Someone who only ever wrote, and was never answered, is still a person with a box: just not one he is working with.
  assert.deepEqual([people['vik@blastmail.example'].working, people['vik@blastmail.example'].answered, people['vik@blastmail.example'].conversations], [false, false, 1])
  assert.equal(people['ivo@closed.example'].working, false, 'a closed conversation is not work in hand')
  // The people he is working with come first, the furthest along first.
  assert.deepEqual(o.people.slice(0, 2).map(p => p.email), ['mara@steadfast.example', 'tomas@ridgeway.example'])
  assert.ok(o.people.findIndex(p => p.email === 'vik@blastmail.example') > o.people.findIndex(p => p.email === 'lena@oldcastle.example'))
})

test('where someone works is read from their address, and a free mail address says nothing', () => {
  assert.equal(companyOf('dana@northpier-staffing.example'), 'Northpier Staffing')
  assert.equal(companyOf('x@apex.com'), 'Apex')
  assert.equal(companyOf('x@mail.apex.co.uk'), 'Apex')
  assert.equal(companyOf('someone@gmail.com'), '')
  assert.equal(companyOf(''), '')
})

test('someone hidden by a rule of his own is not put in front of him again', () => {
  const hid = overviewOf(ALL, [ME], NOW, { hidden: (account, email) => account === ME && email === 'mara@steadfast.example' })
  assert.equal([...hid.needsYou, ...hid.goneQuiet, ...hid.moving].some(s => s.threadId === 'interview'), false)
  assert.equal(hid.people.some(p => p.email === 'mara@steadfast.example'), true, 'the person is still listed, so the rule can be taken back')
})

test('nothing typed by him and nothing read here can be mistaken: empty and odd mail is handled', () => {
  assert.deepEqual(overviewOf([], [ME], NOW).highlights, [])
  assert.deepEqual(overviewOf([{ threadId: 'x', accountEmail: ME, messages: [] }], [ME], NOW).people, [])
  const noBody = thread('nb', { id: 'a', from: 'A B <a@b.example>', subject: 'Role', snippet: 'Please confirm the right to represent and send your resume', internalDate: String(NOW - DAY), category: 'RTR Request' })
  assert.equal(overviewOf([noBody], [ME], NOW).needsYou[0].doNext, 'A asked for your go-ahead to put you forward and your updated resume.')
  assert.equal(overviewOf(ALL, [], NOW).needsYou.every(s => s.stage !== 'answered' && s.stage !== 'came_back'), true, 'with no inbox of his own named, nothing is "answered"')
})

test('Overview shows it first, reads kept mail only, and hiding is the inbox\'s own ignore list', () => {
  const page = read('src/app/dashboard/overview/page.tsx'), section = read('src/app/dashboard/overview/_components/standing.tsx'), route = read('src/app/api/gmail/overview/route.ts')
  // Above the evidence map, and not behind its slow read of Gmail's history.
  assert.ok(page.indexOf('<StandingSection account={account} />') > 0 && page.indexOf('<StandingSection account={account} />') < page.indexOf('Filter inbox'))
  assert.match(section, /fetch\(`\/api\/gmail\/overview\$\{account \? `\?account=\$\{encodeURIComponent\(account\)\}` : ""\}`/)
  assert.match(route, /requireAuth\(\)/)
  assert.match(route, /keptThreads\(ctx, TRACKING_DAYS/)
  assert.doesNotMatch(route, /gmail-send|sendGmailMessage|updateUser|googleapis/, 'it reads; it sends nothing and changes nothing')
  // How long to wait before a nudge is his own habit, who is close to his work is the inbox's own score, and someone
  // he hid is not put in front of him again.
  assert.match(route, /nudgeAfterDays: chase\?\.days, fit: id => fit\.get\(id\), hidden: hiddenBy/)
  assert.match(route, /jdFitScore\(/)
  // The ones he never answers are offered for hiding, unless hidden already or set aside.
  assert.ok(route.includes('h.kind === "never_answered" && h.sender && h.state !== "off" && (!account || h.sender.account === account) && !hiddenBy(h.sender.account, h.sender.email)'))
  // Hide and Show again go through the same rules Tidy up keeps: read the list as it is, change one entry, save it.
  assert.match(section, /fetch\("\/api\/gmail\/ignore-rules"\)\.then/)
  assert.match(section, /fetch\("\/api\/gmail\/ignore-rules", \{ method: "PUT"/)
  assert.doesNotMatch(section, /gmail-send|\/api\/gmail\/habits/)
  // A contact box is a way to reach someone: their address and the number they wrote, one press each.
  // The part before the @ is made safe before it goes into a link: 'x?body=...&to=...' must stay an address.
  assert.ok(section.includes('href={mailHref(email)}') && section.includes('href={mailHref(p.email)}') && !section.includes('`mailto:${email}`') && !section.includes('`mailto:${p.email}`'))
  assert.ok(section.includes('`mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}`'))
  assert.match(section, /href=\{`tel:\$\{digits\(p\)\}`\}/)
  // What is on top says why, and a nudge says honestly whether the words will be waiting.
  assert.match(section, /On top because: \{s\.why\.join/)
  assert.match(section, /Keep your usual nudge on Follow-ups and it will be written for you here\./)
  assert.match(section, /href=\{openHref\(s\.threadId\)\}/)
  assert.match(section, /`\/dashboard\/mail\?open=\$\{encodeURIComponent\(threadId\)\}`/)
})

// ── Found by the review of 13 Oct 2026, each with the case that failed ───────────────────────────────────────────────
const { contactsOf, readThread, saidNo, isMachine, tidy } = await import('../../src/lib/mail-reading.ts')
const { hasQuestion, topOf } = await import('../../src/lib/mail-overview.ts')
const all = (o) => [...o.needsYou, ...o.goneQuiet, ...o.moving]
const reply = (who, email, daysAgo, text, category = 'General Correspondence') => thread('r' + (++n), theirs(who, email, daysAgo + 3, 'Job Description', JD), mine(email, daysAgo + 2, ANSWER), theirs(who, email, daysAgo, category, text))

test('"not available on Monday" is not a no; "I have accepted a position" is', () => {
  // Was: an interview vanished because his reply said "not available on Monday, but Tuesday works".
  for (const text of ['I am not available on Monday, but Tuesday at 2pm or Wednesday morning works well.', 'I am not interested in relocating. Is remote possible for this one?', 'I am not looking at anything under $70 an hour. Can the client do that?', 'It is not the right fit as written, however I would consider it at a higher rate.']) assert.equal(saidNo(text), false, text)
  for (const text of ['Thank you, but this is not the right fit for me.', 'Thank you, but I have accepted a position with another company.', 'I am not interested in this one.', 'Thank you, but I will pass.', 'I would like to withdraw from this one.', 'I am no longer looking.']) assert.equal(saidNo(text), true, text)
  assert.equal(saidNo('Sounds good.\n\nOn Mon, Oct 5, 2026 at 9:14 AM Dana <d@x.example> wrote:\n> If you are not interested, I will pass on this.'), false, 'words in mail he only quoted are not his')
  const interview = thread('iv', theirs('Mara Lind', 'mara@steadfast.example', 3, 'Interview Request', 'Please share your availability.'), mine('mara@steadfast.example', 2, 'I am not available on Monday, but Tuesday at 2pm works well.'))
  const o1 = overviewOf([interview], [ME], NOW)
  assert.deepEqual([o1.counts.closed, all(o1).length, all(o1)[0].stage], [0, 1, 'interview'])
  // He said no and they answered "Okay, thank you": it stays over. Nobody is nudged about a role that was turned down.
  const over = thread('ov', theirs('Uma Roy', 'uma@passed.example', 12, 'Job Description', JD), mine('uma@passed.example', 10, 'I am not interested in this one.'), theirs('Uma Roy', 'uma@passed.example', 8, 'General Correspondence', 'Okay, thank you for the quick response.'))
  const accepted = thread('ac', theirs('Uma Roy', 'uma@passed.example', 12, 'Job Description', JD), mine('uma@passed.example', 9, 'Thank you, but I have accepted a position with another company.'))
  assert.deepEqual([overviewOf([over, accepted], [ME], NOW).counts.closed, all(overviewOf([over, accepted], [ME], NOW)).length], [2, 0])
  // Unless they come back with something to answer.
  const back = { ...over, threadId: 'bk', messages: [...over.messages, theirs('Uma Roy', 'uma@passed.example', 1, 'Rate Confirmation', 'The client raised the rate. Could you confirm $80/hr?')] }
  assert.equal(overviewOf([back], [ME], NOW).needsYou.length, 1)
})

test('a person whose address begins like a machine\'s word is a person; a machine with the word further in is a machine', () => {
  for (const e of ['jobrien@steadfast.example', 'newsome.kate@ridgeway.example', 'alertson@x.example', 'updatesmith@x.example', 'systemsguy@x.example', 'bouncer.tom@x.example', 'teamlead.dana@x.example']) assert.equal(isMachine(e), false, e)
  for (const e of ['no-reply@lakeshore.example', 'noreply@x.example', 'careers-noreply@lakeshore.example', 'auto-reply@lakeshore.example', 'donotreply@x.example', 'notifications@x.example', 'jobs-alerts@x.example', 'news@x.example', 'mailer-daemon@x.example', 'updates+jobs@x.example']) assert.equal(isMachine(e), true, e)
  // Was: the interview from J. O'Brien was not shown at all, and "careers-noreply" got a contact box and a reply button.
  const obrien = thread('ob', theirs("John O'Brien", 'jobrien@steadfast.example', 1, 'Interview Request', 'Please share your availability.\n\nJohn\n(555) 010-9090'))
  const machine = thread('mc', theirs('Lakeshore Careers', 'careers-noreply@lakeshore.example', 1, 'Interview Request', 'Do not reply to this message. Please share your availability in the portal.'))
  const o1 = overviewOf([obrien, machine], [ME], NOW)
  assert.deepEqual(o1.needsYou.map(s => s.threadId), ['ob'])
  assert.deepEqual(o1.people.map(p => p.email), ['jobrien@steadfast.example'])
  assert.equal(o1.looked.machines, 1)
  // The repeats finder uses the same rule: a person is not left out of "never answered" for how their address begins.
  const habits = read('src/lib/mail-habits.ts')
  assert.match(habits, /isMachine\(p\.email\) \|\| SHARED_BOX\.test\(p\.email\)/)
  assert.doesNotMatch(habits, /const AUTOMATED|const SAID_NO/)
})

test('"asked for" is only said of a sentence that asks him', () => {
  // Each of these was read as an ask.
  assert.deepEqual(askedFor('Thank you. I will share your resume with the hiring manager today.'), [])
  assert.deepEqual(askedFor('Thanks Sam. I need to confirm the rate with my manager first.'), [])
  assert.deepEqual(askedFor('Got it, thanks. Please reference job 4411 in the subject line.'), [])
  assert.deepEqual(askedFor('If you are not available or not interested, please ignore this email.'), [])
  assert.deepEqual(askedFor('Please find the job description attached. The rate is $60/hr.'), [])
  assert.deepEqual(askedFor("We'll send your resume to the client and confirm the rate."), [])
  // And these still are.
  assert.deepEqual(askedFor('Could you send two references?'), ['references'])
  assert.deepEqual(askedFor('What is your rate?'), ['your rate'])
  assert.deepEqual(askedFor('Kindly share your updated resume.'), ['your updated resume'])
  assert.equal(hasQuestion('Thanks, noted.\nhttps://northpier.example/team?id=dana'), false, 'a question mark in a link is not a question')
  assert.equal(hasQuestion('Does Tuesday work?'), true)
  const shared = overviewOf([reply('Dana Whitfield', 'dana@northpier.example', 1, 'Thank you. I will share your resume with the hiring manager today.')], [ME], NOW)
  assert.deepEqual([all(shared)[0].group, all(shared)[0].action, all(shared)[0].doNext], ['moving', 'none', 'Dana wrote 1 day ago and asked nothing of you. Nothing to do yet.'])
  const link = overviewOf([reply('Dana Whitfield', 'dana@northpier.example', 1, 'Thanks, noted.\n\nDana\nhttps://northpier.example/team?id=dana')], [ME], NOW)
  assert.equal(all(link)[0].yourTurn, false)
  // Only Gmail's first line was kept, and it runs on into his own earlier question, quoted: that question is not theirs.
  const snippet = thread('sn', theirs('Dana Whitfield', 'dana@northpier.example', 4, 'Job Description', JD), mine('dana@northpier.example', 3, ANSWER),
    { id: 'sx', from: 'Dana Whitfield <dana@northpier.example>', subject: 'RE: Security Analyst', internalDate: String(NOW - DAY), category: 'General Correspondence', snippet: 'Sure, will check. From: Sam Carter <me@example.com> Sent: Thursday, October 8, 2026 To: Dana Whitfield Subject: Re: Security Analyst Could you please confirm the rate for this role?' })
  assert.deepEqual([all(overviewOf([snippet], [ME], NOW))[0].yourTurn, all(overviewOf([snippet], [ME], NOW))[0].asked], [false, []])
})

test('a contact box never holds his own number, a job number, or a number said to be someone else\'s', () => {
  const box = (...messages) => contactsOf(readThread(thread('cb', ...messages), [ME])).phones
  // His number, repeated back to him by the recruiter. Was: shown as hers, and in "Calling may do more".
  assert.deepEqual(box(theirs('Priya Menon', 'priya@harborview.example', 9, 'Job Description', JD), mine('priya@harborview.example', 8, 'Yes, I am interested.\n\nSam Carter\n(312) 555-0199'), theirs('Priya Menon', 'priya@harborview.example', 7, 'General Correspondence', 'I tried calling you on (312) 555-0199 and got voicemail.')), [])
  // A reply with nothing typed above his quoted mail: the signature in the quote is his.
  assert.deepEqual(box(theirs('Priya Menon', 'priya@harborview.example', 7, 'General Correspondence', 'On Wed, Sep 30, 2026 at 9:14 AM Someone Else <else@x.example> wrote:\n> Thanks\n> Someone Else\n> (444) 555-0177')), [])
  // Ten digits in a row and the tail of a link are not phone numbers; another country's number is not cut to fit.
  assert.deepEqual(box(theirs('Dana Whitfield', 'dana@northpier.example', 2, 'Job Description', 'Requisition 2026101355. Apply at https://northpier.example/apply/4012345678\nMobile: +91-9876543210')), [])
  assert.deepEqual(box(theirs('Dana Whitfield', 'dana@northpier.example', 2, 'Job Description', 'Call me.\n\nDana\nCell: 6085550142\nDesk 608.555.0143 x12')).map(p => p.number), ['(608) 555-0142', '(608) 555-0143 ext. 12'])
  // "Omar's direct line is ..." in Dana's mail is Omar's, once Omar signs with it.
  assert.deepEqual(box(theirs('Dana Whitfield', 'dana@northpier.example', 3, 'Job Description', "Omar's direct line is (608) 555-0142 if you need him."), theirs('Omar Haddad', 'omar@northpier.example', 2, 'General Correspondence', 'Happy to talk.\n\nOmar Haddad\n(608) 555-0142')), [{ number: '(608) 555-0142', who: 'Omar Haddad' }])
  // In Overview: written to three times, and her own number is the one suggested for the call.
  const o1 = overviewOf([thread('cl', theirs('Priya Menon', 'priya@harborview.example', 14, 'Job Description', JD + '\n\nPriya Menon\n(555) 010-2211'), mine('priya@harborview.example', 13, ANSWER + '\n(312) 555-0199'), mine('priya@harborview.example', 9, 'Just checking in.'), mine('priya@harborview.example', 5, 'Any update?'))], [ME], NOW)
  assert.equal(o1.goneQuiet[0].doNext, 'You have written 3 times in a row and Priya has not answered. Calling may do more: (555) 010-2211.')
  assert.deepEqual([companyOf('dana@us.apex.com'), companyOf('dana@careers.apex.com'), companyOf('dana@apex.co.uk'), companyOf('dana@uni.ac.in')], ['Apex', 'Apex', 'Apex', 'Uni'])
})

test('the one to answer is whoever asked last, and "I will keep you posted" does not close an open request', () => {
  // Was: "Omar asked for your updated resume" when Dana had asked and Omar only added himself.
  const two = thread('tw', theirs('Dana Whitfield', 'dana@northpier.example', 5, 'Job Description', JD), mine('dana@northpier.example', 4, ANSWER),
    theirs('Dana Whitfield', 'dana@northpier.example', 2, 'General Correspondence', 'Could you send your updated resume and confirm your visa status?'), theirs('Omar Haddad', 'omar@northpier.example', 1, 'General Correspondence', 'Thanks Dana, adding myself here.'))
  const s = overviewOf([two], [ME], NOW).needsYou[0]
  assert.equal(s.doNext, 'Dana asked for your updated resume and your visa status.')
  assert.equal(s.contact.email, 'dana@northpier.example')
  assert.equal(s.others, 1)
  assert.equal(overviewOf([two], [ME], NOW).people.find(p => p.email === 'dana@northpier.example').working, true)
  // Was: filed as "nothing to do" because the last message said they would keep him posted.
  const open = thread('op', theirs('Lena Fischer', 'lena@oldcastle.example', 5, 'Job Description', JD), mine('lena@oldcastle.example', 4, ANSWER),
    theirs('Lena Fischer', 'lena@oldcastle.example', 2, 'General Correspondence', 'Could you send your updated resume and confirm your visa status?'), theirs('Lena Fischer', 'lena@oldcastle.example', 1, 'General Correspondence', 'Also, I will keep you posted on the interview slot.'))
  assert.deepEqual([overviewOf([open], [ME], NOW).needsYou.length, overviewOf([open], [ME], NOW).needsYou[0].doNext], [1, 'Lena asked for your updated resume and your visa status.'])
})

test('on top is what weighs most, whichever pile it is in', () => {
  // Was: whatever waited on him filled the top before weight was looked at, so three small asks pushed out an interview
  // that had gone quiet.
  const small = [1, 2, 3].map(i => thread('sm' + i, theirs('Asker ' + i, `asker${i}@papers.example`, 14, 'Job Description', JD, 'Role ' + i), mine(`asker${i}@papers.example`, 13, ANSWER, 'Re: Role ' + i), theirs('Asker ' + i, `asker${i}@papers.example`, 10 + i, 'General Correspondence', 'Could you send two references?', 'RE: Role ' + i)))
  const quietInterview = thread('qi', theirs('Mara Lind', 'mara@steadfast.example', 8, 'Interview Request', 'Please share your availability.'), mine('mara@steadfast.example', 5, 'Tuesday at 2pm works well for me.'))
  const o1 = overviewOf([...small, quietInterview], [ME], NOW)
  assert.deepEqual([o1.needsYou.length, o1.goneQuiet.length], [3, 1])
  assert.equal(o1.highlights[0].threadId, 'qi')
  assert.equal(o1.highlights.length, 3)
  assert.deepEqual(topOf(o1.needsYou, o1.goneQuiet).map(s => s.threadId), o1.highlights.map(s => s.threadId))
  assert.ok(o1.highlights.every((s, i, xs) => i === 0 || xs[i - 1].weight >= s.weight))
})

test('what is put in front of him is what is still alive: measured on his own mail the morning it shipped', () => {
  // The first version said 36 conversations "need you". 21 were cold "send your resume" mails he had never answered,
  // and the three on top were interview requests 2, 13 and 20 days old.
  const cold = (id, category, daysAgo) => thread(id, theirs('Cold Caller', id + '@blast.example', daysAgo, category, 'Please send your updated resume and confirm the right to represent.', 'Role ' + id))
  const shown = (threads) => { const o1 = overviewOf(threads, [ME], NOW); return [...o1.needsYou, ...o1.goneQuiet, ...o1.moving].map(s => s.threadId) }
  // "Send your resume" from someone he never wrote to is a requirement like any other: it has not started.
  assert.deepEqual(shown([cold('doc', 'Document Request', 1)]), [])
  // A step in an application (a go-ahead, a rate, an interview, an offer) counts before he writes, for a week.
  assert.deepEqual(shown([cold('rtr2', 'RTR Request', 2), cold('rtr7', 'RTR Request', 7), cold('rtr8', 'RTR Request', 8), cold('iv20', 'Interview Request', 20)]), ['rtr2', 'rtr7'])
  // Once he has written, a request for papers is a real ask.
  assert.deepEqual(shown([thread('docs', theirs('Dana Whitfield', 'dana@northpier.example', 5, 'Job Description', JD), mine('dana@northpier.example', 4, ANSWER), theirs('Dana Whitfield', 'dana@northpier.example', 1, 'Document Request', 'Please send your passport copy.'))]), ['docs'])
  // An ask he has left for more than two weeks is no longer "waiting on you": it is counted, not shown.
  const left = (id, daysAgo) => thread(id, theirs('Mara Lind', id + '@steadfast.example', daysAgo + 3, 'Job Description', JD), mine(id + '@steadfast.example', daysAgo + 2, ANSWER), theirs('Mara Lind', id + '@steadfast.example', daysAgo, 'Interview Request', 'Please share your availability.'))
  const o2 = overviewOf([left('d14', 14), left('d15', 15), left('d20', 20)], [ME], NOW)
  assert.deepEqual([o2.needsYou.map(s => s.threadId), o2.counts.lapsed], [['d14'], 2])
  // Silence is nudged for a month; and after four of his messages in a row it is let rest.
  const silent = (id, daysAgo) => thread(id, theirs('Omar Haddad', id + '@brightline.example', daysAgo + 1, 'Job Description', JD), mine(id + '@brightline.example', daysAgo, ANSWER))
  const o3 = overviewOf([silent('q30', 30), silent('q31', 31)], [ME], NOW)
  assert.deepEqual([o3.goneQuiet.map(s => s.threadId), o3.counts.cold], [['q30'], 1])
  const four = thread('four', theirs('Priya Menon', 'priya@harborview.example', 20, 'Job Description', JD), mine('priya@harborview.example', 19, ANSWER), mine('priya@harborview.example', 15, 'Just checking in.'), mine('priya@harborview.example', 11, 'Any update?'), mine('priya@harborview.example', 6, 'One last note on this.'))
  assert.deepEqual([shown([four]), overviewOf([four], [ME], NOW).counts.cold], [[], 1])
  // The page says what was left out, and the address he signs in with is his own, not a person who wrote to him.
  const section = read('src/app/dashboard/overview/_components/standing.tsx'), route = read('src/app/api/gmail/overview/route.ts')
  assert.ok(section.includes('{data.counts.lapsed} where you were asked something more than two weeks ago and left it.'))
  assert.ok(route.includes('[...ctx.accounts.map(a => a.google_email), user?.email || ""].filter(Boolean)'))
})

test('one inbox can be shown while all the mail is still read: answered from another inbox is answered', () => {
  const OTHER = 'me.too@example.com'
  const inA = [1, 2, 3, 4].map(i => thread('a' + i, theirs('Dana Reed', 'dana.reed@corp.example', i * 3, 'Job Description', JD, 'Role ' + i)))
  const inB = { threadId: 'b1', accountEmail: OTHER, messages: [{ ...theirs('Dana Reed', 'dana.reed@corp.example', 30, 'Job Description', JD), to: OTHER }, { ...mine('dana.reed@corp.example', 29, ANSWER), from: `Sam Carter <${OTHER}>` }] }
  const onlyA = overviewOf([...inA, inB], [ME, OTHER], NOW, { account: ME })
  assert.equal(onlyA.looked.conversations, 4)
  assert.deepEqual(onlyA.people.map(p => [p.account, p.conversations, p.answered]), [[ME, 4, true]])       // was: answered false, "never answered"
  assert.equal(overviewOf([...inA, inB], [ME, OTHER], NOW).people.length, 2)
  // A conversation he brought back, or hid, by itself is honoured: the rule is asked about the conversation, not only the sender.
  const seen = []
  overviewOf([reply('Lee Park', 'lee@corp.example', 1, 'Could you send your resume?')], [ME], NOW, { hidden: (account, email, id) => { seen.push([account, email, typeof id]); return false } })
  assert.deepEqual(seen, [[ME, 'lee@corp.example', 'string']])
})

test('a body of links that never close is read in no time', () => {
  // Measured before the fix: tidy() took 1 second on 100,000 characters of "x<https://y", and twenty such mails a minute.
  const bodies = ['x<https://y'.repeat(9000), '[a](https://b'.repeat(7500), 'a'.repeat(60000) + '@', ('https://' + 'h'.repeat(300) + ' ').repeat(300)]
  const t0 = performance.now()
  for (const b of bodies) tidy(b)
  const threads = [1, 2, 3, 4, 5].map(i => thread('big' + i, theirs('Dana Whitfield', 'dana@northpier.example', 3, 'Job Description', JD), mine('dana@northpier.example', 2, ANSWER), theirs('Dana Whitfield', 'dana@northpier.example', 1, 'General Correspondence', bodies[i % bodies.length])))
  overviewOf(threads, [ME], NOW)
  assert.ok(performance.now() - t0 < 2500, 'took ' + Math.round(performance.now() - t0) + ' ms')
})

test('the endpoint reads all the mail, honours every rule the inbox honours, and promises a nudge only where it will be there', () => {
  const route = read('src/app/api/gmail/overview/route.ts'), section = read('src/app/dashboard/overview/_components/standing.tsx')
  // Was: with one inbox chosen, someone answered from another inbox was offered for hiding as "never answered", and
  // the wait before a nudge fell back to four days. The habits are worked out on all the mail; only what is shown is
  // kept to the inbox chosen.
  assert.ok(route.includes('const threads = kept.threads'))
  assert.ok(route.includes('findHabits(threads, mine, now, decisions, TRACKING_DAYS)'))
  assert.ok(route.includes('hidden: hiddenBy, account })'))
  assert.ok(!route.includes('kept.threads.filter'))
  // Was: a conversation he brought back by itself stayed missing, and one he hid by itself was put on top. Hidden
  // means what the inbox means: the same function decides, with the conversation's own rule first.
  assert.ok(route.includes('!!ignoreReason({ account: inbox, id: threadId, fromEmail: email }, rules)'))
  // Was: "Your usual nudge will be the first choice" under conversations where the reply box would not offer it.
  assert.ok(route.includes('nudgeReady: !!nudge && s.action !== "reply" && s.lastMine && s.quietDays >= (nudge.days || 1)'))
  assert.ok(section.includes('{s.nudgeReady && <div'))
  assert.ok(section.includes('{!nudgeKept && s.action === "nudge" && s.lastMine && <div'))
  assert.ok(!section.includes('nudgeWords'))
  // Everyone can be reached: more people with each press, and it says how many are left. It used to stop at 60 in silence.
  assert.ok(section.includes('people.slice(0, shownPeople)') && section.includes('not shown)') && !section.includes('slice(0, 60)'))
  // The sentences at the edges.
  assert.ok(section.includes('data.looked.conversations === 1 ? "conversation" : "conversations"'))
  assert.ok(section.includes('data.nudgeAfterDays === 1 ? "day" : "days"'))
  assert.ok(section.includes('find.trim() ? "Nobody by that name." : "Nobody to show: everyone who wrote is hidden or is an automatic sender."'))
  assert.ok(section.includes('"It is the one shown on top."'))
})

test('an address with marks in it stays an address when it becomes a link', async () => {
  // senderEmail lets ? & = % # through, as an address may hold them. As a link, "x?body=...&to=..." would open a draft
  // to someone else with words the sender chose. The function is read out of the page and run here.
  const section = read('src/app/dashboard/overview/_components/standing.tsx')
  const src = section.split('\n').find(l => l.startsWith('const mailHref = '))
  const mailHref = new Function('return ' + src.slice('const mailHref = '.length).replace('(email: string)', '(email)'))()
  assert.equal(mailHref('dana@northpier.example'), 'mailto:dana@northpier.example')
  assert.equal(mailHref('x?body=send%20it&to=someone-else@corp.example'), 'mailto:x%3Fbody%3Dsend%2520it%26to%3Dsomeone-else@corp.example')
  assert.equal(new URL(mailHref('x?body=send%20it&to=someone-else@corp.example')).search, '', 'nothing after the address is read as a body or a second recipient')
  assert.equal(new URL(mailHref('pat#team@corp.example')).hash, '')
  assert.equal(mailHref('not-an-address'), '#')
})
