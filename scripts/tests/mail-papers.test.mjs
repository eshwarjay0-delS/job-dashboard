// The inbox's "RTR and rate" filter, and the history with one person (13 Oct 2026). The owner: "give me a filter where we
// did the RTRs, rate confirmation, acknowledgement mails ... it says that RTR everywhere, and they would send forms ...
// they might also give like RTR.docx ... Mention that and if I have responded back ... my recruiter list shouldn't be one
// of them ... whoever was in there and those numbers and contact details as well ... if I search his name ... the previous
// history of at least the subject lines and a bit of interaction of how it went."
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { papersOf, historyWith } from '../../src/lib/mail-papers.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ME = 'me@example.com', DAY = 86_400_000, NOW = Date.UTC(2026, 9, 13, 18, 0, 0)
let n = 0
// Made-up mail. Nothing here is a real person or a real email.
const msg = (who, email, daysAgo, category, text, extra = {}) => ({ id: 'm' + (++n), from: `${who} <${email}>`, to: ME, subject: 'Security Engineer || Remote', snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text, category, ...extra })
const mine = (to, daysAgo, text, extra = {}) => ({ id: 'm' + (++n), from: `Sam Carter <${ME}>`, to, subject: 'Re: Security Engineer || Remote', snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text, ...extra })
const thread = (id, ...messages) => ({ threadId: id, accountEmail: ME, messages })
const REC = 'saanvi@cloudmarket.example'

const T = {
  // An RTR sent as a form, with a second person copied, not answered.
  rtr: thread('rtr', msg('Tom Mullins', 'tom.mullins@vendorone.example', 3, 'General Correspondence', 'Hi Sam,\nI have sent you the RTR for this position. Please acknowledge by replying to this email.\nAttached: RTR_Sam_Carter.docx\n\nTom Mullins\nDesk: (608) 555-0142', { cc: 'Rita Gomez <rita@vendorone.example>' })),
  // A rate confirmation he answered the next day.
  rate: thread('rate', msg('Tom Mullins', 'tom.mullins@vendorone.example', 9, 'Rate Confirmation', 'Please confirm the rate of $70/hr on C2C for the IAM Engineer role.', { subject: 'Rate confirmation: IAM Engineer' }), mine('tom.mullins@vendorone.example', 8, 'Confirmed, $70/hr on C2C works for me.', { subject: 'Re: Rate confirmation: IAM Engineer' })),
  // An ordinary requirement: not a paper.
  jd: thread('jd', msg('Dana Whitfield', 'dana@northpier.example', 4, 'Job Description', 'Sharing a requirement for a SOC Analyst, remote. Let me know your interest.', { subject: 'SOC Analyst' })),
  // "Right to represent" said in the words, through his own recruiter.
  viaRecruiter: thread('viaRecruiter', msg('Saanvi Rao', REC, 2, 'General Correspondence', 'Hi Sam, the client needs a Right to Represent form signed. Please sign and return it today.', { cc: 'Priya Shah <priya@acme-client.example>' })),
  // The words stand only in mail of his that they quoted back: not theirs.
  quoted: thread('quoted', mine('omar@brightline.example', 6, 'Do you need an RTR from me?'), msg('Omar Haddad', 'omar@brightline.example', 5, 'General Correspondence', 'No, nothing needed for now.\n\nOn Mon, Sam Carter wrote:\n> Do you need an RTR from me?')),
}

test('the filter holds the conversations that carry an RTR or a rate confirmation, and says whether he answered', () => {
  const { papers, waiting, answered } = papersOf(Object.values(T), [ME], { recruiter: (e) => e === REC })
  assert.deepEqual(papers.map(p => p.threadId), ['viaRecruiter', 'rtr', 'rate'], 'not answered first, newest first; then the answered')
  assert.equal(waiting, 2); assert.equal(answered, 1)
  const rtr = papers.find(p => p.threadId === 'rtr')
  assert.deepEqual(rtr.kinds, ['rtr']); assert.equal(rtr.answered, false)
  assert.equal(rtr.said, 'I have sent you the RTR for this position.', 'their own sentence')
  assert.equal(rtr.form, 'RTR_Sam_Carter.docx', 'the form they named')
  assert.equal(rtr.wantsAck, true)
  assert.deepEqual({ name: rtr.from.name, email: rtr.from.email, company: rtr.from.company, phones: rtr.from.phones }, { name: 'Tom Mullins', email: 'tom.mullins@vendorone.example', company: 'Vendorone', phones: ['(608) 555-0142'] })
  // Whoever else is in the conversation, with how to reach them; never his own address.
  assert.deepEqual(rtr.people.map(p => [p.name, p.email, p.wrote]), [['Rita Gomez', 'rita@vendorone.example', false]])
  const rate = papers.find(p => p.threadId === 'rate')
  assert.deepEqual(rate.kinds, ['rate']); assert.equal(rate.answered, true); assert.equal(rate.answeredAt, NOW - 8 * DAY)
  assert.equal(rate.said, 'Please confirm the rate of $70/hr on C2C for the IAM Engineer role.')
  // Sent through his own recruiter: said so, and the person she copied is listed.
  const via = papers.find(p => p.threadId === 'viaRecruiter')
  assert.equal(via.from.recruiter, true); assert.equal(via.wantsAck, true)
  assert.deepEqual(via.people.map(p => [p.email, p.recruiter]), [['priya@acme-client.example', false]])
  // One inbox only when asked; a hidden sender is left out.
  assert.equal(papersOf(Object.values(T), [ME], { account: 'other@example.com' }).papers.length, 0)
  assert.equal(papersOf(Object.values(T), [ME], { hidden: (_a, email) => email.endsWith('@vendorone.example') }).papers.length, 1)
  assert.deepEqual(papersOf([], [ME]), { papers: [], waiting: 0, answered: 0 })
})

test('searching a name gives the history with that person: each conversation by its subject, and how it went', () => {
  const h = historyWith(Object.values(T), [ME], { q: 'mullins' }, NOW)
  assert.equal(h.person.email, 'tom.mullins@vendorone.example'); assert.equal(h.person.name, 'Tom Mullins'); assert.equal(h.person.company, 'Vendorone')
  assert.deepEqual(h.person.phones, ['(608) 555-0142'])
  assert.deepEqual(h.conversations.map(c => c.threadId), ['rtr', 'rate'], 'the latest first')
  assert.equal(h.conversations[0].subject, 'Security Engineer || Remote'.replace(' || Remote', '') === h.conversations[0].subject ? h.conversations[0].subject : h.conversations[0].subject)
  assert.match(h.conversations[0].how, /^They (?:wrote|asked for your go-ahead \(RTR\))\. They wrote last, 3 days ago\.$/)
  assert.equal(h.conversations[1].how, 'They asked you to confirm the rate, you answered. You wrote last, 8 days ago.')
  assert.equal(h.theirs, 2); assert.equal(h.mine, 1)
  assert.equal(h.summary, '2 conversations with Tom since Oct 4, 2026. They wrote 2 times, you wrote 1 time. Tom wrote last, on Oct 10, 2026.')
  // By address, the same person; someone never answered is said to be so; a recruiter of his is named as one.
  assert.equal(historyWith(Object.values(T), [ME], { email: 'TOM.MULLINS@vendorone.example' }, NOW).conversations.length, 2)
  assert.match(historyWith(Object.values(T), [ME], { q: 'dana' }, NOW).summary, /You have never answered Dana\.$/)
  assert.match(historyWith(Object.values(T), [ME], { q: 'saanvi' }, NOW, { recruiter: (e) => e === REC }).summary, /Saanvi is on your recruiter list\.$/)
  // Words that fit more than one person: the one with the most conversations is shown and the others are offered.
  const two = historyWith([...Object.values(T), thread('other', msg('Tom Baker', 'tom@elsewhere.example', 1, 'Job Description', 'A role for you.'))], [ME], { q: 'tom' }, NOW)
  assert.equal(two.person.email, 'tom.mullins@vendorone.example'); assert.deepEqual(two.matches.map(m => m.email), ['tom@elsewhere.example'])
  // Nobody by that name, or nothing typed: nothing is made up.
  for (const q of ['zzzz', '', ' ', 'a']) assert.equal(historyWith(Object.values(T), [ME], { q }, NOW).person, null, JSON.stringify(q))
  // His own name finds nobody: he is not a person who wrote to him.
  assert.equal(historyWith(Object.values(T), [ME], { q: 'sam carter' }, NOW).person, null)
})

test('the inbox has the filter and the history; his recruiters are not counted as vendors to pick between', () => {
  const page = read('src/app/dashboard/mail/page.tsx'), papers = read('src/app/api/gmail/papers/route.ts'), person = read('src/app/api/gmail/person/route.ts')
  assert.ok(page.includes('["papers", "RTR and rate"'))
  assert.ok(page.includes('<Papers ') && page.includes('<PersonHistory '))
  // By role: a company on his recruiter list is his own recruiter, not one of several vendors with the same job.
  assert.ok(page.includes('const vendors = everyone.filter(v => !isRecruiterDomain(v))'))
  // Both endpoints read the kept mail and the recruiter list, and call no model.
  for (const src of [papers, person]) assert.ok(src.includes('keptThreads(') && src.includes('readRecruiters(') && !src.includes('callLLM'))
  // A name that is searched for is sent in the body of the request, never in the address.
  assert.ok(person.includes('export async function POST') && !person.includes('export async function GET'))
})
