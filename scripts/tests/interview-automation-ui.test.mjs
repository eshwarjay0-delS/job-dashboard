// The owner, 28 Oct 2026, looking at his own board: "I can not see what message is being automated." So what is
// sent for him stays in view while it is switched on, editable in place, sendable at once, and ringable on ticked
// days — and the inbox carries an Interviews pile that links both ways to the board.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')

test('the inbox carries an Interviews pile that links both ways to the board', () => {
  const mail = read('src/app/dashboard/mail/page.tsx')
  assert.ok(mail.includes('"interviews", "Interviews"'), 'Interviews pile')
  assert.ok(mail.includes('interviewBoardHref('), 'thread links to its board card')
  assert.ok(mail.includes('View this interview on the Interviews board'), 'open thread links back')
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  assert.ok(board.includes('interview-${t.threadId}'), 'board cards carry their thread anchor')
})

test('what is sent for him stays visible, editable, and sendable at once, on ticked days', () => {
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  for (const said of ['What I send to', 'Send now', 'Save words', 'Send edited now', 'Ring on', 'DayTicks']) assert.ok(board.includes(said), said)
  const api = read('src/app/api/gmail/interview-track/route.ts')
  for (const action of ['"send_now"', '"save_words"', '"set_days"']) assert.ok(api.includes(action), action)
  const sender = read('src/lib/interview-followups.ts')
  assert.ok(sender.includes('sendInterviewFollowUpNow('))
})
