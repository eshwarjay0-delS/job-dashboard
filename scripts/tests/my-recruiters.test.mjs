// "My recruiters" (13 Oct 2026). The owner, with a picture of two Overview cards telling him to nudge people who market
// his profile: "he's my recruiter so ... I don't have to follow up with him over the Gmail ... not ignore, like a
// recruiter list ... whoever these guys are emailing would be my loop guys and that's where you start the connecting dots
// from ... whenever there is an email, in whichever tab, if I say this is my recruiter, once I click that, it would be
// added. And also give me an option like: any person from this company is my recruiter."
// What went wrong before: Overview put "You wrote 14 days ago and Saanvi has not answered. A short, friendly nudge is
// due" on top, about someone who works for him and owes him no answer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tidyRecruiter, validRecruiters, isMyRecruiter, recruiterRuleFor, withRecruiter, withoutRecruiter, addressesIn, companyDomainOf, MOST_RECRUITERS } from '../../src/lib/my-recruiters.ts'
import { overviewOf } from '../../src/lib/mail-overview.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ME = 'me@example.com', DAY = 86_400_000, NOW = Date.UTC(2026, 9, 13, 18, 0, 0)
let n = 0
// Made-up mail. Nothing here is a real person or a real email.
const msg = (who, email, daysAgo, category, text, extra = {}) => ({ id: 'm' + (++n), from: `${who} <${email}>`, to: ME, subject: 'Cyber Security Engineer', snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text, category, ...extra })
const mine = (to, daysAgo, text) => ({ id: 'm' + (++n), from: `Sam Carter <${ME}>`, to, subject: 'Re: Cyber Security Engineer', snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text })
const thread = (id, ...messages) => ({ threadId: id, accountEmail: ME, messages })
const REC = 'saanvi@cloudmarket.example'

test('the list holds one person by address, or everyone at a company, and nothing else', () => {
  assert.deepEqual(tidyRecruiter({ kind: 'person', value: ' Saanvi@CloudMarket.example ', name: '  Saanvi   Rao ' }, 5), { kind: 'person', value: REC, name: 'Saanvi Rao', at: 5 })
  assert.deepEqual(tidyRecruiter({ kind: 'company', value: 'CloudMarket.example' }, 5), { kind: 'company', value: 'cloudmarket.example', at: 5 })
  // An address may be handed in for a company: what stands after its @ is the company.
  assert.equal(tidyRecruiter({ kind: 'company', value: REC }, 5).value, 'cloudmarket.example')
  // "Everyone at gmail.com" is everyone: a free mail service is never a company.
  for (const free of ['gmail.com', 'someone@gmail.com', 'outlook.com', 'yahoo.co.in', 'proton.me']) assert.equal(tidyRecruiter({ kind: 'company', value: free }, 5), null, free)
  assert.equal(companyDomainOf('someone@gmail.com'), ''); assert.equal(companyDomainOf(REC), 'cloudmarket.example')
  for (const bad of [null, {}, { kind: 'person', value: 'not an address' }, { kind: 'person', value: 'a@b' }, { kind: 'company', value: 'nodot' }, { kind: 'thread', value: REC }, { kind: 'person', value: '<script>@x.example' }]) assert.equal(tidyRecruiter(bad, 5), null, JSON.stringify(bad))

  const rules = validRecruiters([{ kind: 'person', value: REC }, { kind: 'person', value: REC.toUpperCase() }, { kind: 'company', value: 'vendorfirm.example' }, 'junk', { kind: 'company', value: 'gmail.com' }])
  assert.deepEqual(rules.map(r => `${r.kind}:${r.value}`), [`person:${REC}`, 'company:vendorfirm.example'], 'each once, and only what can be a rule')
  assert.ok(isMyRecruiter(rules, 'Saanvi@cloudmarket.example') && isMyRecruiter(rules, 'anyone@vendorfirm.example') && isMyRecruiter(rules, 'x@us.vendorfirm.example'))
  assert.ok(!isMyRecruiter(rules, 'other@cloudmarket.example') && !isMyRecruiter(rules, 'x@notvendorfirm.example') && !isMyRecruiter(rules, '') && !isMyRecruiter([], REC))
  assert.equal(recruiterRuleFor(rules, 'anyone@vendorfirm.example').kind, 'company')
  // Added once; a full list says so instead of dropping someone; removing one leaves the others.
  assert.equal(withRecruiter(rules, { kind: 'person', value: REC, at: 9 }).why, 'there')
  const full = Array.from({ length: MOST_RECRUITERS }, (_, i) => ({ kind: 'person', value: `p${i}@firm.example`, at: 1 }))
  assert.deepEqual({ added: withRecruiter(full, { kind: 'person', value: 'new@firm.example', at: 1 }).added, why: withRecruiter(full, { kind: 'person', value: 'new@firm.example', at: 1 }).why }, { added: false, why: 'full' })
  assert.deepEqual(withoutRecruiter(rules, 'person', REC.toUpperCase()).map(r => r.value), ['vendorfirm.example'])
  assert.deepEqual(addressesIn('"Shah, Priya" <priya@acme.example>, raj@acme.example; Lee Wong <LEE@acme.example>, priya@acme.example'), [{ name: 'Shah, Priya', email: 'priya@acme.example' }, { name: '', email: 'raj@acme.example' }, { name: 'Lee Wong', email: 'lee@acme.example' }])
  assert.deepEqual(addressesIn(''), [])
})

test('no nudge is ever due to his recruiter; the person to watch is whoever the recruiter sent him on to', () => {
  // He wrote 14 days ago, his recruiter has said nothing since: before, "a short, friendly nudge is due".
  const quiet = thread('quiet', msg('Saanvi Rao', REC, 16, 'Submission Confirmation', 'I have submitted your profile for this role.'), mine(REC, 14, 'Thank you, please keep me posted.'))
  const before = overviewOf([quiet], [ME], NOW)
  assert.equal(before.goneQuiet.length, 1); assert.match(before.goneQuiet[0].doNext, /nudge is due/)
  const rec = (email) => email === REC
  const after = overviewOf([quiet], [ME], NOW, { recruiter: rec })
  assert.equal(after.goneQuiet.length, 0, 'nothing is said to be due to her')
  assert.equal(after.moving.length, 1)
  assert.equal(after.moving[0].action, 'none')
  assert.equal(after.moving[0].doNext, 'Saanvi is your recruiter and is carrying this. There is nothing for you to chase.')
  assert.deepEqual(after.moving[0].through, { name: 'Saanvi Rao', email: REC })
  assert.ok(after.moving[0].why.includes('through your recruiter'))
  assert.equal(after.highlights.length, 0, 'and it is not put on top')
  assert.equal(after.people.find(p => p.email === REC).recruiter, true)

  // She forwarded his profile to someone: that person is the one to let reach out, and has a contact box already.
  const sent = thread('sent', msg('Saanvi Rao', REC, 9, 'Submission Confirmation', 'Hi Priya, sharing the profile of Sam for the Cyber Security Engineer role.', { to: 'Priya Shah <priya@acme-client.example>', cc: ME }), mine(REC, 8, 'Thank you.'))
  const o = overviewOf([sent], [ME], NOW, { recruiter: rec })
  assert.equal(o.goneQuiet.length, 0)
  const s = o.moving[0]
  assert.deepEqual({ name: s.contact.name, email: s.contact.email, company: s.contact.company }, { name: 'Priya Shah', email: 'priya@acme-client.example', company: 'Acme Client' })
  assert.equal(s.doNext, 'Saanvi is your recruiter and sent this on to Priya Shah at Acme Client 9 days ago. Let them reach out; there is nothing for you to chase.')
  assert.equal(s.introduced, true)
  const priya = o.people.find(p => p.email === 'priya@acme-client.example')
  assert.ok(priya, 'she is in the list of people before she has written a word')
  assert.equal(priya.via, 'Saanvi Rao'); assert.equal(priya.conversations, 0); assert.equal(priya.working, true)
  // His own address on the Cc line is not a person, and another recruiter of his on it is not one to watch either.
  assert.ok(!o.people.some(p => p.email === ME))
})

test('once the person she sent him on to has written, they are the one answered or nudged; a recruiter who asks is still answered', () => {
  const rec = (email) => email === REC
  // The client's person wrote and asked for times: it waits on him, and the contact is that person.
  const asked = thread('asked', msg('Saanvi Rao', REC, 6, 'Submission Confirmation', 'Sharing the profile of Sam.', { to: 'Priya Shah <priya@acme-client.example>', cc: ME }),
    msg('Priya Shah', 'priya@acme-client.example', 1, 'Interview Request', 'Hi Sam, could you share the times you are available this week?'))
  const a = overviewOf([asked], [ME], NOW, { recruiter: rec })
  assert.equal(a.needsYou.length, 1)
  assert.equal(a.needsYou[0].contact.email, 'priya@acme-client.example')
  assert.match(a.needsYou[0].doNext, /^Priya asked for the times you are free/)
  assert.equal(a.needsYou[0].through.email, REC)
  // The client's person went quiet after he answered: the nudge is to them, never to the recruiter who wrote later.
  const gone = thread('gone', msg('Priya Shah', 'priya@acme-client.example', 12, 'Interview Request', 'Could you share your availability?'), mine('priya@acme-client.example', 11, 'I am free Tuesday and Wednesday afternoon.'),
    msg('Saanvi Rao', REC, 10, 'Follow-up', 'I will keep pushing from my side.'))
  const g = overviewOf([gone], [ME], NOW, { recruiter: rec })
  assert.equal(g.goneQuiet.length, 1)
  assert.equal(g.goneQuiet[0].contact.email, 'priya@acme-client.example')
  assert.match(g.goneQuiet[0].doNext, /^Priya last wrote|Priya has not answered|and Priya has not answered/)
  // His recruiter asks him for something: that is a question, not a follow-up, and it waits on him.
  const question = thread('question', msg('Saanvi Rao', REC, 1, 'Document Request', 'Hi Sam, could you send your updated resume today?'))
  const q = overviewOf([thread('started', msg('Saanvi Rao', REC, 5, 'Job Description', 'A role for you.'), mine(REC, 4, 'Interested.')), question], [ME], NOW, { recruiter: rec })
  const waiting = q.needsYou.find(s => s.threadId === 'question')
  assert.ok(waiting, 'an ask from his recruiter is still shown')
  assert.match(waiting.doNext, /^Saanvi asked for your updated resume/)
  // Without the list every conversation reads as it did: the one to chase was whoever wrote last, here his own recruiter.
  assert.equal(overviewOf([gone], [ME], NOW).goneQuiet[0].contact.email, REC)
  assert.equal(overviewOf([asked], [ME], NOW).needsYou[0].through, undefined)
})

test('the button is one press, wherever a person is shown, and the list is the person\'s own', () => {
  const api = read('src/app/api/gmail/recruiters/route.ts'), store = read('src/lib/my-recruiters-store.ts'), overview = read('src/app/api/gmail/overview/route.ts'), button = read('src/app/dashboard/_components/recruiter-button.tsx'), standing = read('src/app/dashboard/overview/_components/standing.tsx'), inbox = read('src/app/dashboard/mail/_components/reading-pane.tsx')
  // Kept per person on the server, not in the sign-in cookie.
  assert.ok(store.includes('`mail/recruiters/${') && !api.includes('user_metadata') && !store.includes('user_metadata'))
  assert.ok(api.includes('export async function GET') && api.includes('export async function POST') && api.includes('export async function DELETE'))
  // Overview reads the list and never tells him to nudge someone on it.
  assert.ok(overview.includes('recruiter: email => isMyRecruiter(recruiters, email)'))
  // One press adds the person; a second choice adds everyone at their company; a press takes them off again.
  assert.ok(button.includes('My recruiter') && button.includes('Anyone at ') && button.includes('Your recruiter'))
  // The choices sit behind three dots, in a small window that floats; who already is his recruiter is said in plain sight.
  assert.ok(button.includes('aria-haspopup="menu"') && button.includes('role="menu"') && button.includes('role="menuitem"') && button.includes('position: "absolute"'))
  assert.ok(button.includes('run("POST", { kind: "person", value: address, name })') && button.includes('run("POST", { kind: "company", value: company })') && button.includes('run("DELETE", { kind: rule.kind, value: rule.value })'))
  // It is on the Overview cards, in the list of people, and in the inbox where a conversation is read.
  assert.ok((standing.match(/<RecruiterButton /g) || []).length >= 2, 'on the cards and in the list of people')
  assert.ok(inbox.includes('<RecruiterButton '), 'in the inbox')
})
