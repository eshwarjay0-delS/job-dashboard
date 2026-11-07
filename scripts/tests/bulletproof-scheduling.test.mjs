// Bulletproof scheduling, everywhere (7 Nov 2026, owner order): the same
// control — Send now (send-once-only, never arms the weekly, one-hour
// double-tap guard, the four-count binds only the automatic weekly send) +
// "Yes, send it for me every week" + ring-day ticks + Edit — on every
// surface where an email or thread is chosen. One shared control, reused;
// the mail thread and the tracker chain sheet render the same
// SubmissionFollowUp panel the Overview rows use. The reply composer does
// not get it: the composer sends a reply now, and the follow-up control
// lives on the thread view above it, on the same screen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decide, noteSent, autoSent, toSendForYou, emptyState, MOST_SENT_FOR_YOU } from '../../src/lib/interview-track.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 7, 18, 0, 0) // Saturday 7 Nov 2026

test('the four-count binds only the automatic weekly send, never a manual tap', () => {
  const id = 'me@example.com:quiet'
  let state = decide(emptyState(), id, 'send_for_me', NOW, undefined, [0, 1, 2, 3, 4, 5, 6])
  for (let i = 0; i < MOST_SENT_FOR_YOU; i++) state = noteSent(state, id, NOW + i * 7 * DAY)
  assert.equal(autoSent(state.handed[0]), 0, 'four manual taps leave the automatic count at zero')
  for (let i = 0; i < MOST_SENT_FOR_YOU; i++) state = noteSent(state, id, NOW + (4 + i) * 7 * DAY, true)
  assert.equal(autoSent(state.handed[0]), 4, 'four automatic sends fill the count')
  // A hand written before the split has no sentAuto list, so every send it recorded still counts.
  assert.equal(autoSent({ sent: [NOW, NOW + 7 * DAY, NOW + 14 * DAY, NOW + 21 * DAY] }), 4, 'legacy hands keep the old, stricter count')
  assert.equal(toSendForYou.length, 3, 'the gate takes active, state and now')
})

test('Send now never arms the weekly, and the double-tap guard binds it', () => {
  const interviewSender = read('src/lib/interview-followups.ts')
  const submissionSender = read('src/lib/submission-followups.ts')
  for (const [name, src] of [['interview', interviewSender], ['submission', submissionSender]]) {
    // The send-now path records the send and nothing else: no switch is ever turned on by a tap.
    assert.ok(src.includes('sendInterviewFollowUpNow') || src.includes('sendSubmissionFollowUpNow'), name)
    assert.ok(src.includes('60 * 60 * 1000'), `${name}: the hour's double-tap guard`)
    assert.ok(src.includes('skipped: true'), `${name}: a plain re-tap inside the hour is skipped, not sent twice`)
    assert.ok(src.includes('noteSent('), `${name}: the send is written down before the mail goes out`)
  }
  // The daily (automatic) path is the only one that records with auto: true.
  assert.ok(interviewSender.includes('noteSent(withHand(state, t.id, t.threadId, threadOf, now), t.id, now, true)'), 'interview daily job records automatic')
  assert.ok(submissionSender.includes('noteSent(withHand(state, t.id, t.threadId, threadOf, now), t.id, now, true)'), 'submission daily job records automatic')
  // The panels say so in plain words, on both surfaces.
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  const panel = read('src/app/dashboard/overview/_components/submission-followup.tsx')
  assert.ok(board.includes('It does not count toward the four automatic sends.'), 'board copy')
  assert.ok(panel.includes('It does not count toward the four automatic sends.'), 'submission panel copy')
  assert.ok(panel.includes('I sent four for you and stopped. Say the word and I will carry on.'), 'the submission panel names the limit, like the board')
})

test('the control is on every surface where a thread is chosen', () => {
  const overview = read('src/app/dashboard/overview/page.tsx')
  const calendar = read('src/app/dashboard/calendar/page.tsx')
  const mail = read('src/app/dashboard/mail/page.tsx')
  const folded = read('src/app/dashboard/mail/_components/folded-conversation.tsx')
  const tracker = read('src/app/dashboard/tracker/page.tsx')
  const detail = read('src/app/dashboard/tracker/_components/chain-detail.tsx')
  // Interviews tab: the board is the control.
  assert.ok(calendar.includes('<InterviewBoard'), 'Interviews tab mounts the board')
  // Overview rows and the mind-map view: the shared panel.
  assert.ok(overview.includes('SubmissionFollowUp'), 'Overview rows carry the panel')
  assert.equal(overview.split('<SubmissionFollowUp target={target}').length - 1, 2, 'the panel is on the row and inside the mind-map view')
  // Mail thread view: the page loads the submission track once and hands the thread's target to the conversation.
  assert.ok(mail.includes('fetch("/api/gmail/submission-track"'), 'mail page loads the submission track')
  assert.ok(mail.includes('subTrack.active.find(t => t.id === `${m.account}:${m.id}`)'), 'mail page finds the thread in view')
  assert.ok(mail.includes('<FoldedConversation') && mail.includes('target={mailTarget}'), 'mail page passes the target into the conversation')
  assert.ok(folded.includes('SubmissionFollowUp'), 'the conversation renders the shared panel')
  assert.ok(folded.includes('Follow up'), 'the conversation labels the section Follow up')
  // Tracker chain sheet: the page loads the same track and hands the open chain's target to the sheet.
  assert.ok(tracker.includes('fetch("/api/gmail/submission-track"'), 'tracker page loads the submission track')
  assert.ok(tracker.includes('subTrack.active.find(t => t.id === `${openChain.accountEmail}:${openChain.threadId}`)'), 'tracker page finds the open chain')
  assert.ok(tracker.includes('<ChainDetail') && tracker.includes('target={openTarget}'), 'tracker page passes the target into the sheet')
  assert.ok(detail.includes('SubmissionFollowUp'), 'the chain sheet renders the shared panel')
  // The sheet's "Draft the follow-up" opens the actual thread in mail, not the mail list.
  assert.ok(detail.includes('/dashboard/mail?open=${encodeURIComponent(chain.threadId)}&account=${encodeURIComponent(chain.accountEmail)}'), 'the sheet links to the thread itself')
})

test('the declutter removals: nothing dead is left showing', () => {
  const overview = read('src/app/dashboard/overview/page.tsx')
  const calendar = read('src/app/dashboard/calendar/page.tsx')
  // The progress bar had two overlapping track lines in the same colour: the second, width-proportional one
  // could never be seen. One line remains; the dots still show what is reached.
  assert.equal(overview.split('position: "absolute", top: TOP + DOT / 2 - 1').length - 1, 1, 'one track line in the progress bar')
  assert.ok(overview.includes('<TrackBar chain={chain}'), 'the bar itself stays')
  // The upcoming week's Previous/Next buttons had no tap handler: they looked live and did nothing. The past
  // view keeps its wired week buttons.
  assert.ok(!calendar.includes('title="Previous week"'), 'no dead Previous week button')
  assert.ok(!calendar.includes('title="Next week"'), 'no dead Next week button')
  assert.ok(calendar.includes('title="Older week"') && calendar.includes('title="Newer week"'), 'the past view keeps its week buttons')
  assert.ok(calendar.includes('setWeekOff'), 'the past view buttons still move weeks')
})

test('no thread link anywhere still reads Open and reply', () => {
  // Owner order, 6 Nov 2026: the thread link reads Open and follow up whenever
  // there is something to do; there is no Open and reply label anywhere. Two
  // survived the Nov 6 fix (papers, standing) and were renamed here.
  for (const p of ['src/app/dashboard/mail/_components/papers.tsx', 'src/app/dashboard/overview/_components/standing.tsx']) {
    const src = read(p)
    assert.ok(!src.includes('Open and reply'), `${p} still reads Open and reply`)
    assert.ok(!src.includes('Open and nudge'), `${p} still reads Open and nudge`)
    assert.ok(src.includes('Open and follow up'), `${p} does not read Open and follow up`)
  }
})
