// Submission follow-ups on the Overview page (7 Nov 2026, owner ask): the
// Interviews tab's follow-up machinery, pointed at submission chains.
// The stage filter, the four stage messages in his words, the hard blocks,
// and the rule that the four-count binds only the automatic weekly send —
// never a manual Send now tap — and that the weekly switches on only with
// the "Yes, send it for me every week" tap.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filterChainsByStage, submissionId, submissionContact, submissionWords, submissionSendNowBlockReason, trackSubmissions } from '../../src/lib/submission-track.ts'
import { decide, noteSent, toSendForYou, dueButUnsent, effectiveHand, withHand, emptyState, followUpWords } from '../../src/lib/interview-track.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 7, 18, 0, 0) // Saturday 7 Nov 2026
const MON = Date.UTC(2026, 10, 9, 12, 0, 0) // Monday 9 Nov 2026, 06:00 Chicago
let n = 0
// Made-up mail. Nothing here is a real person or a real email.
const ev = (who, email, daysAgo, isMe, at) => ({ at: at ?? NOW - daysAgo * DAY, from: `${who} <${email}>`, fromEmail: email, isMe, kind: 'response', label: '', detail: '', mentions: [], messageId: 'm' + (++n) })
const chain = (over = {}) => ({
  threadId: 't' + (++n),
  accountEmail: 'me@example.com',
  company: 'Northpier',
  role: 'Security Engineer',
  stops: [
    { key: 'rtr', label: 'RTR', reached: true, at: NOW - 10 * DAY },
    { key: 'submitted', label: 'Submitted', reached: false },
    { key: 'client', label: 'With client', reached: false },
    { key: 'interview', label: 'Interview', reached: false },
    { key: 'decision', label: 'Decision', reached: false },
  ],
  current: 'rtr',
  terminal: null,
  links: [],
  holder: 'Shikha Rao',
  stalledDays: 3,
  nextAction: 'Wait for news',
  lastActivity: NOW - 3 * DAY,
  events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false), ev('Sam Carter', 'me@example.com', 3, true)],
  contacts: [{ name: 'Shikha Rao', email: 'shikha@vendorone.example', emails: 2 }],
  ...over,
})
const contact = { name: 'Shikha Rao', email: 'shikha@vendorone.example', company: 'Northpier', phones: [], recruiter: false }

test('the stage filter shows all rows, or only the rows at one stage', () => {
  const chains = [
    chain({ current: 'rtr' }),
    chain({ current: 'submitted' }),
    chain({ current: 'client' }),
    chain({ current: 'interview' }),
    chain({ current: 'decision', terminal: 'offer' }),
  ]
  assert.equal(filterChainsByStage(chains, 'all').length, 5)
  for (const stage of ['rtr', 'submitted', 'client', 'interview', 'decision']) {
    const got = filterChainsByStage(chains, stage)
    assert.equal(got.length, 1, stage)
    assert.equal(got[0].current, stage)
  }
  assert.equal(submissionId(chains[0]), 'me@example.com:' + chains[0].threadId)
})

test('each stage asks its own question, in his words', () => {
  const rtr = submissionWords(chain({ current: 'rtr' }), contact, 'Eshwar')
  assert.equal(rtr.subject, 'Following up: Security Engineer, Northpier')
  assert.match(rtr.body, /^Hi Shikha,/)
  assert.ok(rtr.body.includes('for this position, any updates from the client?'), rtr.body)
  const submitted = submissionWords(chain({ current: 'submitted' }), contact, 'Eshwar')
  assert.ok(submitted.body.includes('did the client like my profile? Any updates yet so far?'), submitted.body)
  const client = submissionWords(chain({ current: 'client' }), contact, 'Eshwar')
  assert.ok(client.body.includes('Please share my availability with the client, and let me know if there is any update on the interview.'), client.body)
  assert.ok(client.body.includes('Monday to Thursday, 9 AM to 3 PM CST'), client.body)
  // Interview and Decision are the same phase: the Interviews tab words, verbatim.
  const atInterview = chain({ current: 'interview', stops: [
    { key: 'rtr', label: 'RTR', reached: true, at: NOW - 20 * DAY },
    { key: 'submitted', label: 'Submitted', reached: true, at: NOW - 18 * DAY },
    { key: 'client', label: 'With client', reached: true, at: NOW - 15 * DAY },
    { key: 'interview', label: 'Interview', reached: true, at: NOW - 9 * DAY },
    { key: 'decision', label: 'Decision', reached: false },
  ] })
  const interviewAt = NOW - 9 * DAY
  assert.deepEqual(
    submissionWords(atInterview, contact, 'Eshwar'),
    followUpWords({ role: 'Security Engineer', company: 'Northpier', contact, at: interviewAt, timeKnown: true }, 'Eshwar'),
  )
  // A closed submission has no words: there is nothing to follow up.
  assert.equal(submissionWords(chain({ current: 'decision', terminal: 'offer' }), contact, 'Eshwar'), null)
  assert.equal(submissionWords(chain({ current: 'decision', terminal: 'rejected' }), contact, 'Eshwar'), null)
})

test('the follow-up goes to the person who last wrote, or the contact with the most mail', () => {
  const c = chain({
    events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false), ev('Priya Nair', 'priya@vendorone.example', 8, false), ev('Sam Carter', 'me@example.com', 3, true)],
    contacts: [
      { name: 'Shikha Rao', email: 'shikha@vendorone.example', emails: 2 },
      { name: 'Priya Nair', email: 'priya@vendorone.example', emails: 5 },
    ],
  })
  assert.equal(submissionContact(c).email, 'priya@vendorone.example', 'the last writer, not the most-mailed contact')
  const quiet = chain({ events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false)], contacts: [{ name: 'Shikha Rao', email: 'shikha@vendorone.example', emails: 1 }] })
  assert.equal(submissionContact(quiet).email, 'shikha@vendorone.example')
  const noMail = chain({ events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false)], contacts: [{ name: 'Shikha Rao', emails: 1 }] })
  assert.equal(submissionContact(noMail), null, 'a contact with no email address cannot be written to')
})

test('the hard blocks say why, in plain words — and none of them is the four-count', () => {
  const open = { terminal: null, contact, theyWrote: false }
  assert.equal(submissionSendNowBlockReason(open), '')
  assert.equal(submissionSendNowBlockReason({ ...open, theyWrote: true }), 'The recruiter wrote last, so there is nothing to follow up right now.')
  assert.equal(submissionSendNowBlockReason({ ...open, contact: { ...contact, recruiter: true } }), 'This contact is one of your own recruiters, so nothing is sent to them.')
  assert.equal(submissionSendNowBlockReason({ ...open, contact: null }), 'There is no outside contact to follow up with on this submission.')
  assert.equal(submissionSendNowBlockReason({ ...open, terminal: 'rejected' }), 'This submission is closed, so Send now can\'t go out.')
})

test('the four-count binds only the automatic weekly send, never a manual tap', () => {
  const c = chain({ lastActivity: NOW - 8 * DAY, events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false), ev('Sam Carter', 'me@example.com', 8, true)] })
  const id = submissionId(c)
  const fourSent = { marks: [], handed: [{ id, on: true, at: NOW - 30 * DAY, sent: [NOW - 28 * DAY, NOW - 21 * DAY, NOW - 14 * DAY, NOW - 7 * DAY] }] }
  const { active } = trackSubmissions([c], fourSent, NOW)
  assert.equal(active.length, 1)
  assert.equal(active[0].action, 'follow_up', 'still due: the count never takes the follow-up off the list')
  assert.equal(active[0].due, true)
  // The daily job will not send a fifth: the gate, not the tap, carries the count.
  assert.deepEqual(toSendForYou(active, fourSent, NOW).map(t => t.id), [], 'the automatic send stops at four')
  assert.equal(active[0].forYou.ended, 'limit')
  // The tap is his word to carry on past four: no block reason ever names the count.
  assert.equal(submissionSendNowBlockReason({ terminal: null, contact: active[0].contact, theyWrote: false }), '')
  // And the daily job says why it stayed, instead of going silent.
  assert.ok(dueButUnsent(active, fourSent, NOW, "submission").some(d => d.id === id && /Four follow-ups already sent for this submission/.test(d.reason)))
})

test('the weekly switches on only with the tap, and a Send now never switches it on', () => {
  const c = chain()
  const id = submissionId(c)
  const threadOf = new Map([[id, c.threadId]])
  assert.equal(decide(emptyState(), id, 'send_for_me', NOW).handed[0].on, true, 'the Yes tap switches it on')
  assert.equal(decide(emptyState(), id, 'save_words', NOW, { subject: 's', body: 'b' }).handed[0].on, false, 'rewording never switches it on')
  assert.equal(decide(emptyState(), id, 'set_days', NOW, undefined, [1, 4]).handed[0].on, false, 're-ticking never switches it on')
  const afterTap = noteSent(withHand(emptyState(), id, c.threadId, threadOf, NOW), id, NOW)
  assert.equal(afterTap.handed[0].on, false, 'a Send now records only the send, never the weekly')
  assert.equal(afterTap.handed[0].sent.length, 1)
  // An inherited switch is kept: a card that only inherited its switch keeps it after a tap.
  const inherited = { marks: [], handed: [{ id: 'me@example.com:other', on: true, at: NOW - 5 * DAY, sent: [] }] }
  const eff = effectiveHand(inherited, id, c.threadId, new Map([['me@example.com:other', c.threadId]]))
  assert.equal(eff?.on, true)
})

test('a submission waits, comes due, hears back, or closes — like the Interviews tab', () => {
  const fresh = chain({ lastActivity: NOW - 2 * DAY, events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false), ev('Sam Carter', 'me@example.com', 2, true)] })
  const { active: freshActive } = trackSubmissions([fresh], emptyState(), NOW)
  assert.equal(freshActive[0].action, 'none')
  assert.equal(freshActive[0].due, false)
  assert.equal(freshActive[0].nextAt, NOW - 2 * DAY + 7 * DAY, 'a week after his last word')
  const quiet = chain({ lastActivity: NOW - 8 * DAY, events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false), ev('Sam Carter', 'me@example.com', 8, true)] })
  const { active: quietActive, due } = trackSubmissions([quiet], emptyState(), NOW)
  assert.equal(quietActive[0].action, 'follow_up')
  assert.equal(quietActive[0].due, true)
  assert.equal(due, 1)
  const answered = chain({ lastActivity: NOW - 1 * DAY, events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false), ev('Sam Carter', 'me@example.com', 3, true), ev('Shikha Rao', 'shikha@vendorone.example', 1, false)] })
  const { active: answeredActive } = trackSubmissions([answered], emptyState(), NOW)
  assert.equal(answeredActive[0].action, 'reply', 'they wrote last: read it and answer, do not follow up')
  assert.equal(answeredActive[0].due, false)
  const offered = chain({ current: 'decision', terminal: 'offer', lastActivity: NOW - 1 * DAY })
  const { active: offeredActive, past } = trackSubmissions([offered], emptyState(), NOW)
  assert.equal(offeredActive.length, 0)
  assert.equal(past[0].phase, 'past')
  assert.equal(past[0].outcome, 'completed')
  const stale = chain({ lastActivity: NOW - 40 * DAY, stalledDays: 40, events: [ev('Shikha Rao', 'shikha@vendorone.example', 45, false), ev('Sam Carter', 'me@example.com', 40, true)] })
  const { active: staleActive } = trackSubmissions([stale], emptyState(), NOW)
  assert.equal(staleActive[0].old, true)
  assert.equal(staleActive[0].action, 'none', 'more than five weeks quiet: set apart, not chased')
})

test('an armed submission rings on a ticked day, and the daily job says why it stays on other days', () => {
  const at = (d) => MON - d * DAY
  const c = chain({
    lastActivity: at(8),
    events: [ev('Shikha Rao', 'shikha@vendorone.example', 10, false, at(10)), ev('Sam Carter', 'me@example.com', 8, true, at(8))],
  })
  const id = submissionId(c)
  const state = { marks: [], handed: [{ id, on: true, at: at(9), sent: [] }] }
  const { active } = trackSubmissions([c], state, MON)
  assert.equal(active[0].forYou.on, true)
  assert.deepEqual(toSendForYou(active, state, MON).map(t => t.id), [id], 'Monday is a ring day: the job sends')
  const saturday = trackSubmissions([c], state, NOW).active
  assert.deepEqual(toSendForYou(saturday, state, NOW), [], 'Saturday is not a ring day: the job holds')
  // Sunday the follow-up is due (a week after his last word) but Sunday is not
  // a ring day, so the job holds it — and names the hold instead of going silent.
  const SUN = Date.UTC(2026, 10, 8, 18, 0, 0) // Sunday 8 Nov 2026, 12:00 Chicago
  const sunday = trackSubmissions([c], state, SUN).active
  assert.deepEqual(toSendForYou(sunday, state, SUN), [], 'Sunday is not a ring day either')
  assert.ok(dueButUnsent(sunday, state, SUN).some(d => d.id === id && /ring days/.test(d.reason)), 'and the hold is named, not silent')
})

test('the Overview carries the filter and the follow-up control on every row', () => {
  const page = read('src/app/dashboard/overview/page.tsx')
  assert.ok(page.includes('aria-label="Filter by stage"'), 'stage filter dropdown')
  assert.ok(page.includes('<option value="all">All stages</option>'), 'All stages option')
  assert.ok(page.includes('filterChainsByStage(chains, stageFilter)'), 'the rows are filtered by the stage')
  assert.ok(page.includes('SubmissionFollowUp'), 'per-row follow-up control')
  assert.ok(page.includes('target && target.action !== "none" ? "Open and follow up" : "View"'), 'the thread link reads Open and follow up whenever there is something to do')
  assert.ok(page.includes('"/api/gmail/submission-track"'), 'the page reads the submission track')
  const panel = read('src/app/dashboard/overview/_components/submission-followup.tsx')
  for (const said of ['Yes, send it for me every week', 'Send now', 'Ring on, once a week:', 'DayTicks', 'History', 'Last sent', 'Stop sending for me', 'No, I will do it myself', 'Send edited now', 'jayeshwar44@gmail.com']) assert.ok(panel.includes(said), said)
  assert.ok(panel.includes('AbortSignal.timeout'), 'the button can never spin forever')
  assert.ok(panel.includes('check Sent before tapping again'), 'a timed-out send warns before any re-tap')
  assert.ok(panel.includes('Already sent a moment ago — nothing sent twice.'), 'a skipped re-tap names itself')
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  assert.ok(board.includes('export function DayTicks'), 'the Overview uses the Interviews tab ticks, not a copy')
})

test('the submission track route mirrors the interview track route, and the daily job sends submissions too', () => {
  const api = read('src/app/api/gmail/submission-track/route.ts')
  for (const action of ['"send_for_me"', '"stop_sending"', '"save_words"', '"set_days"', '"send_now"']) assert.ok(api.includes(action), action)
  assert.ok(!api.includes('"rejected"') && !api.includes('"completed"'), 'no outcome marking: a submission ends when the mail says so')
  const sender = read('src/lib/submission-followups.ts')
  assert.ok(sender.includes('sendSubmissionFollowUpNow('))
  assert.ok(sender.includes('sendSubmissionFollowUps('))
  assert.ok(sender.includes('BOARD_SENDER'), 'board sends go from jayeshwar44')
  assert.ok(sender.includes('jayeshwar44@gmail.com'), 'the board sender is named')
  assert.ok(sender.includes('60 * 60 * 1000'), 'the double-tap window is one hour')
  assert.ok(sender.includes('double-tap'), 'a plain re-tap is named as a double-tap, not a new send')
  assert.ok(sender.includes('return { ok: true, skipped: true }'), 'the guard reports its skip')
  assert.ok(!sender.includes('MOST_SENT_FOR_YOU'), 'no count check on the tap path: the four-count binds only the automatic send')
  const watchdog = read('src/app/api/agent/watchdog/route.ts')
  assert.ok(watchdog.includes('sendSubmissionFollowUps'), 'the daily job sends due submission follow-ups')
  assert.ok(watchdog.includes('submissionFollowUps'), 'the run record carries the submission sends apart from the interviews')
})
