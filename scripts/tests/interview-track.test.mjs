// Interviews are kept in view until he says how they ended (13 Oct 2026). The owner: "it was just showcasing like one at
// each time ... we have to keep on following up with them about the next rounds ... Unless a user have selected it was
// rejected or completed ... it would go under the past interviews and no longer be tracked ... after the interview was
// happened about these many days, you basically suggest ... a follow up ... give the contact information of the
// recruiter ... not in a way that they feel ... super anxious ... it can be delegated ... weekly ones ... automatic follow
// up on behalf of the user ... Just by asking the user what they wanted to do."
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { trackInterviews, decide, noteSent, toSendForYou, followUpWords, validState, emptyState, weekdayForHim, dayList, cleanDays, FIRST_AFTER_DAYS, EVERY_DAYS, MOST_SENT_FOR_YOU, OLD_AFTER_DAYS } from '../../src/lib/interview-track.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ME = 'me@example.com', DAY = 86_400_000, NOW = Date.UTC(2026, 9, 13, 18, 0, 0)
let n = 0
// Made-up mail. Nothing here is a real person or a real email.
const msg = (who, email, daysAgo, text) => ({ id: 'm' + (++n), from: `${who} <${email}>`, to: ME, subject: 'Interview: Security Engineer', snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text, category: 'Interview Request' })
const mine = (to, daysAgo, text) => ({ id: 'm' + (++n), from: `Sam Carter <${ME}>`, to, subject: 'Re: Interview: Security Engineer', snippet: text.slice(0, 80), internalDate: String(NOW - daysAgo * DAY), bodyText: text })
const thread = (id, ...messages) => ({ threadId: id, accountEmail: ME, messages })
const found = (id, daysFromNow, more = {}) => ({ id: `${ME}:${id}`, threadId: id, account: ME, role: 'Security Engineer', company: 'Northpier', kind: 'Video', ts: NOW + daysFromNow * DAY, ...more })
const INVITE = 'Hi Sam, please confirm the interview below.\n\nShikha Rao\nDesk: (608) 555-0142'

test('each interview has its place and one calm sentence; none is ever called late', () => {
  const threads = [
    thread('soon', msg('Shikha Rao', 'shikha@vendorone.example', 2, INVITE)),
    thread('fresh', msg('Shikha Rao', 'shikha@vendorone.example', 6, INVITE)),
    thread('quiet', msg('Shikha Rao', 'shikha@vendorone.example', 12, INVITE)),
    thread('news', msg('Shikha Rao', 'shikha@vendorone.example', 10, INVITE), msg('Shikha Rao', 'shikha@vendorone.example', 1, 'The client would like a second round. Are you free Thursday?')),
    thread('chased', msg('Shikha Rao', 'shikha@vendorone.example', 12, INVITE), mine('shikha@vendorone.example', 3, 'Any update on next steps?')),
  ]
  const { active, past, due } = trackInterviews([found('soon', 3), found('fresh', -2), found('quiet', -9), found('news', -8), found('chased', -9)], threads, [ME], NOW)
  assert.deepEqual(active.map(t => t.threadId), ['news', 'quiet', 'soon', 'fresh', 'chased'], 'what needs him first, then what is coming, then the rest by the latest interview')
  assert.equal(past.length, 0); assert.equal(due, 2)
  const by = Object.fromEntries(active.map(t => [t.threadId, t]))
  assert.equal(by.soon.phase, 'coming'); assert.match(by.soon.say, /^Your interview is on .*, in 3 days\. Nothing to do but be ready\.$/); assert.equal(by.soon.action, 'none')
  assert.equal(by.fresh.phase, 'waiting'); assert.equal(by.fresh.due, false)
  assert.match(by.fresh.say, /^Your interview was 2 days ago\. It is normal to hear nothing yet\. I will bring it back on /)
  assert.equal(by.fresh.nextAt, NOW - 2 * DAY + FIRST_AFTER_DAYS * DAY)
  assert.equal(by.quiet.due, true); assert.equal(by.quiet.action, 'follow_up')
  assert.equal(by.quiet.say, 'Your interview was 9 days ago and there is no news yet. A short, friendly follow-up to Shikha is a good idea.')
  // The person who arranged it, and how to reach them.
  assert.deepEqual(by.quiet.contact, { name: 'Shikha Rao', email: 'shikha@vendorone.example', company: 'Vendorone', phones: ['(608) 555-0142'], recruiter: false })
  // They wrote after the interview: that is read and answered, not "followed up".
  assert.equal(by.news.action, 'reply'); assert.equal(by.news.say, 'Shikha wrote to you after the interview. Read it and answer.'); assert.equal(by.news.due, false)
  // He followed up three days ago: nothing to do until a week has passed.
  assert.equal(by.chased.due, false); assert.equal(by.chased.followUps, 1); assert.equal(by.chased.nextAt, NOW - 3 * DAY + EVERY_DAYS * DAY)
  assert.match(by.chased.say, /^You followed up 3 days ago\. Nothing to do now; I will bring it back on /)
  // No word that makes a person anxious.
  for (const t of active) assert.ok(!/overdue|late|urgent|asap|immediately|missed|!/i.test(t.say), t.say)
  // An interview with no time in the mail is placed by the day it was confirmed; one with no date at all is left out.
  const loose = trackInterviews([{ id: 'x', threadId: 'quiet', account: ME, role: 'R', company: 'C', requestTs: NOW - 9 * DAY }, { id: 'y', role: 'R', company: 'C' }], threads, [ME], NOW)
  assert.equal(loose.active.length, 1); assert.equal(loose.active[0].timeKnown, false)
})

test('what is put in front of him is what is still alive: measured on his own mail the hour it shipped', () => {
  // 13 Oct 2026: the first version said a follow-up was "a good idea" for 12 of his 15 open interviews. Eight were 63 to
  // 83 days old with not a word since, and one was to a person on his own recruiter list.
  const threads = [
    thread('ancient', msg('Shikha Rao', 'shikha@vendorone.example', 70, INVITE)),
    thread('ancientNews', msg('Shikha Rao', 'shikha@vendorone.example', 70, INVITE), msg('Shikha Rao', 'shikha@vendorone.example', 1, 'Good news, they want a final round.')),
    thread('carried', msg('Saanvi Rao', 'saanvi@cloudmarket.example', 15, INVITE), mine('saanvi@cloudmarket.example', 13, 'Thank you, any update?')),
    thread('quiet', msg('Shikha Rao', 'shikha@vendorone.example', 12, INVITE)),
  ]
  const rec = (email) => email === 'saanvi@cloudmarket.example'
  const { active, due } = trackInterviews([found('ancient', -67), found('ancientNews', -67), found('carried', -13), found('quiet', -9)], threads, [ME], NOW, { recruiter: rec })
  const by = Object.fromEntries(active.map(t => [t.threadId, t]))
  // Long past with nothing since: set apart, asked only whether it is over, and no follow-up is planned.
  assert.equal(by.ancient.old, true); assert.equal(by.ancient.action, 'none'); assert.equal(by.ancient.due, false); assert.equal(by.ancient.nextAt, 0)
  assert.equal(by.ancient.say, 'Your interview was 67 days ago and nothing has come since. If it is over, tell me and I will stop following it.')
  assert.ok(67 > OLD_AFTER_DAYS)
  // However old, a word from them brings it to the top.
  assert.equal(by.ancientNews.old, false); assert.equal(by.ancientNews.action, 'reply')
  // His own recruiter is never the one he is told to chase.
  assert.equal(by.carried.action, 'none'); assert.equal(by.carried.say, 'Your recruiter Saanvi is carrying this one. There is nothing for you to chase.')
  assert.equal(by.quiet.action, 'follow_up')
  assert.equal(due, 2, 'two things to do, not four')
  assert.deepEqual(active.map(t => t.threadId), ['ancientNews', 'quiet', 'carried', 'ancient'], 'the old one last')
  // The page keeps the old ones under one line, and they can be closed with one press.
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  assert.ok(board.includes('const live = data.active.filter(t => !t.old), old = data.active.filter(t => t.old)') && board.includes('They are all over') && board.includes('I am not asking you to chase'))
})

test('marked rejected or completed, it is past and no longer followed; it can be brought back', () => {
  const threads = [thread('quiet', msg('Shikha Rao', 'shikha@vendorone.example', 12, INVITE))]
  const id = `${ME}:quiet`
  let state = decide(emptyState(), id, 'rejected', NOW)
  let t = trackInterviews([found('quiet', -9)], threads, [ME], NOW, { state })
  assert.equal(t.active.length, 0); assert.equal(t.due, 0)
  assert.equal(t.past[0].outcome, 'rejected'); assert.match(t.past[0].say, /^Not going ahead\. Marked on .*, and no longer followed\.$/)
  state = decide(state, id, 'completed', NOW + 5)
  assert.equal(trackInterviews([found('quiet', -9)], threads, [ME], NOW, { state }).past[0].outcome, 'completed')
  assert.deepEqual(state.marks.length, 1, 'one mark for one interview')
  state = decide(state, id, 'reopen', NOW + 9)
  assert.equal(trackInterviews([found('quiet', -9)], threads, [ME], NOW, { state }).active.length, 1)
  assert.deepEqual(validState({ marks: [{ id, outcome: 'won' }, { id, outcome: 'rejected', at: 5 }, null], handed: [{ id, on: 'yes', sent: ['x', 7] }, {}] }), { marks: [{ id, outcome: 'rejected', at: 5 }], handed: [{ id, on: false, at: 0, sent: [7] }] })
  for (const junk of [null, 'x', 5, []]) assert.deepEqual(validState(junk), emptyState())
})

test('a follow-up is sent for him only on his standing word, once a week, and it stops by itself', () => {
  const id = `${ME}:quiet`
  const threads = [thread('quiet', msg('Shikha Rao', 'shikha@vendorone.example', 12, INVITE))]
  const run = (state, now = NOW, t = threads) => { const r = trackInterviews([found('quiet', -9)], t, [ME], now, { state }); return { r, send: toSendForYou(r.active, state, now) } }
  // Not asked for: nothing is ever sent.
  assert.deepEqual(run(emptyState()).send, [])
  let state = decide(emptyState(), id, 'send_for_me', NOW)
  let { r, send } = run(state)
  assert.deepEqual(send.map(t => t.id), [id], 'due now, and he asked for it')
  assert.equal(r.active[0].action, 'none', 'he is not asked to do what is being done for him'); assert.equal(r.active[0].forYou.on, true)
  assert.match(r.active[0].say, /^I am sending Shikha a short follow-up for you\./)
  // Once sent, not again for a week.
  state = noteSent(state, id, NOW)
  assert.deepEqual(run(state, NOW + 3 * DAY).send, [])
  assert.match(run(state, NOW + 3 * DAY).r.active[0].say, /^I send Shikha a short follow-up for you every week until there is news\. The next one is on /)
  assert.deepEqual(run(state, NOW + 7 * DAY).send.map(t => t.id), [id])
  // They answered: it stops, and he is told to read what they wrote.
  const answered = [thread('quiet', msg('Shikha Rao', 'shikha@vendorone.example', 12, INVITE), { ...msg('Shikha Rao', 'shikha@vendorone.example', 0, 'Thanks Sam, feedback is expected Friday.'), internalDate: String(NOW + 2 * DAY) })]
  const after = run(state, NOW + 8 * DAY, answered)
  assert.deepEqual(after.send, []); assert.equal(after.r.active[0].action, 'reply'); assert.equal(after.r.active[0].forYou.ended, 'answered')
  // Four at most, then it stops and he is asked again.
  for (let i = 1; i < MOST_SENT_FOR_YOU; i++) state = noteSent(state, id, NOW + i * 7 * DAY)
  const spent = run(state, NOW + 40 * DAY)
  assert.deepEqual(spent.send, []); assert.equal(spent.r.active[0].forYou.ended, 'limit'); assert.equal(spent.r.active[0].action, 'none'); assert.equal(spent.r.active[0].old, true)
  // Marked finished, or stopped by him: nothing more goes out. Never to one of his own recruiters.
  assert.deepEqual(run(decide(decide(emptyState(), id, 'send_for_me', NOW), id, 'completed', NOW)).send, [])
  assert.deepEqual(run(decide(decide(emptyState(), id, 'send_for_me', NOW), id, 'stop_sending', NOW)).send, [])
  const mineRec = trackInterviews([found('quiet', -9)], threads, [ME], NOW, { state: decide(emptyState(), id, 'send_for_me', NOW), recruiter: () => true })
  assert.deepEqual(toSendForYou(mineRec.active, decide(emptyState(), id, 'send_for_me', NOW), NOW), [])
  // The words: short, his name, nothing invented.
  const words = followUpWords(r.active[0], 'Sam')
  assert.equal(words.subject, 'Following up: Security Engineer, Northpier')
  assert.match(words.body, /^Hi Shikha,\n\nI wanted to follow up on my interview on .* for the Security Engineer role at Northpier\. I enjoyed the conversation and I am still very interested\.\n\nIs there any update on the next steps\? I am happy to share anything else that would help\.\n\nThank you,\nSam$/)
})

test('the Interviews page shows every interview with what to do, and sending for him is his own switch', () => {
  const api = read('src/app/api/gmail/interview-track/route.ts'), board = read('src/app/dashboard/calendar/_components/interview-board.tsx'), page = read('src/app/dashboard/calendar/page.tsx'), sender = read('src/lib/interview-followups.ts'), daily = read('src/app/api/agent/watchdog/route.ts')
  assert.ok(page.includes('<InterviewBoard'))
  assert.ok(api.includes('export async function GET') && api.includes('export async function POST') && api.includes('trackInterviews('))
  for (const said of ['Still going', 'Past interviews', 'It is finished', 'Not going ahead', 'Send one for me every week', 'Follow them again']) assert.ok(board.includes(said), said)
  // The exact words are shown before he says yes to sending for him.
  assert.ok(board.includes('This is what I will send') && board.includes('"send_for_me"') && board.includes('"stop_sending"'))
  // What is sent for him: only what toSendForYou allows, written down before the next is considered, by the daily job.
  assert.ok(sender.includes('toSendForYou(') && sender.includes('noteSent(') && sender.includes('followUpWords('))
  assert.ok(daily.includes('sendInterviewFollowUps('))
})

test('ticked days are the only days the automatic send may ring on, and a manual send is not bound by them', () => {
  const id = `${ME}:quiet`
  const threads = [thread('quiet', msg('Shikha Rao', 'shikha@vendorone.example', 12, INVITE))]
  const run = (state, now = NOW) => { const r = trackInterviews([found('quiet', -9)], threads, [ME], now, { state }); return { r, send: toSendForYou(r.active, state, now) } }
  // NOW is Tuesday 13:00 in Chicago (18:00 UTC). A ticked Tuesday rings; a ticked Wednesday does not.
  assert.equal(weekdayForHim(NOW), 2)
  assert.deepEqual(run(decide(emptyState(), id, 'send_for_me', NOW, undefined, [2])).send.map(t => t.id), [id])
  assert.deepEqual(run(decide(emptyState(), id, 'send_for_me', NOW, undefined, [3])).send, [])
  assert.deepEqual(run(decide(emptyState(), id, 'send_for_me', NOW, undefined, [])).send.map(t => t.id), [id], 'no ticks means any day')
  // Wednesday 02:00 UTC is still Tuesday evening in Chicago: the ticked Tuesday rings, the Wednesday does not.
  const tueNight = Date.UTC(2026, 9, 14, 2, 0, 0)
  assert.equal(weekdayForHim(tueNight), 2)
  assert.deepEqual(run(decide(emptyState(), id, 'send_for_me', NOW, undefined, [2]), tueNight).send.map(t => t.id), [id])
  assert.deepEqual(run(decide(emptyState(), id, 'send_for_me', NOW, undefined, [3]), tueNight).send, [])
  // What he is told names the ticked days instead of promising a next date the ticks may hold back.
  const ticked = run(decide(emptyState(), id, 'send_for_me', NOW, undefined, [1, 3]))
  assert.deepEqual(ticked.r.active[0].forYou.days, [1, 3])
  assert.equal(ticked.r.active[0].say, 'I send Shikha a short follow-up for you on Mon, Wed until there is news.')
  assert.equal(dayList([3, 1]), 'Mon, Wed')
})

test('rewording what is sent, or re-ticking its days, never switches it on or off and never forgets what went out', () => {
  const id = `${ME}:quiet`
  let state = decide(emptyState(), id, 'send_for_me', NOW, { subject: 'Old subject', body: 'Old body' }, [1])
  state = noteSent(state, id, NOW)
  state = decide(state, id, 'save_words', NOW + DAY, { subject: 'New subject', body: 'New body' })
  assert.deepEqual(state.handed, [{ id, on: true, at: NOW, sent: [NOW], subject: 'New subject', body: 'New body', days: [1] }])
  state = decide(state, id, 'set_days', NOW + DAY, undefined, [2, 5])
  assert.deepEqual(state.handed, [{ id, on: true, at: NOW, sent: [NOW], subject: 'New subject', body: 'New body', days: [2, 5] }])
  // Opting in again keeps the ticks he already chose unless he ticks new ones.
  state = decide(decide(emptyState(), id, 'send_for_me', NOW, undefined, [4]), id, 'stop_sending', NOW)
  assert.deepEqual(decide(state, id, 'send_for_me', NOW).handed[0].days, [4])
  assert.deepEqual(decide(state, id, 'send_for_me', NOW, undefined, [0]).handed[0].days, [0])
  // Clearing the ticks leaves the switch and the count alone.
  state = decide(state, id, 'set_days', NOW, undefined, [])
  assert.deepEqual(state.handed, [{ id, on: false, at: NOW, sent: [], days: [] }])
  // Only real weekdays survive, each once.
  assert.deepEqual(cleanDays([0, 2, 2, 8, -1, 'x', 6]), [0, 2, 6])
  assert.deepEqual(validState({ marks: [], handed: [{ id, on: true, at: 1, sent: [], days: [0, 2, 2, 8, -1] }] }).handed, [{ id, on: true, at: 1, sent: [], days: [0, 2] }])
  assert.deepEqual(validState({ marks: [], handed: [{ id, on: true, at: 1, sent: [], days: [] }] }).handed, [{ id, on: true, at: 1, sent: [] }])
})
