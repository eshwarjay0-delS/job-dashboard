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
  for (const said of ['What I send to', 'Send now', 'Save words', 'Send edited now', 'Ring on', 'DayTicks', 'History', 'Last sent']) assert.ok(board.includes(said), said)
  assert.ok(board.includes('untick them all and it rings Monday and Thursday'), 'untick-all falls back to Monday and Thursday')
  assert.ok(board.includes('AbortSignal.timeout'), 'the button can never spin forever')
  assert.ok(board.includes('check Sent before tapping again'), 'a timed-out send warns before any re-tap')
  // The board never pauses, and its frequency is visible: one card's busy state never disables another,
  // ticks save in the background and say Saved, the days sit at the top right, a sent follow-up raises a
  // little toast, ticked days are solid-filled, and the panel folds shut on its header tap.
  for (const said of ['busyFor(t.id)', 'Ring on, once a week:', 'Saved</span>', 'mfit-toast-in', 'Sent to ${who}.', 'on ? "var(--accent)"', '▸', '▾', 'aria-expanded']) assert.ok(board.includes(said), said)
  const api = read('src/app/api/gmail/interview-track/route.ts')
  for (const action of ['"send_now"', '"save_words"', '"set_days"']) assert.ok(api.includes(action), action)
  const sender = read('src/lib/interview-followups.ts')
  assert.ok(sender.includes('sendInterviewFollowUpNow('))
  assert.ok(sender.includes('threadsIn'), 'send-now verifies against the kept copy')
  assert.ok(sender.includes('double-tap'), 'a plain re-tap is named as a double-tap, not a new send')
  assert.ok(sender.includes('60 * 60 * 1000'), 'the double-tap window is one hour')
})

test('a tap never claims a send it did not make: the toast is gated on ok, a skipped re-tap says so', () => {
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  // The ok gate sits before any panel is closed or any toast is raised, so a failed tap keeps the
  // person's edit open and shows only the error line — and a failed day tick reverts instead of
  // saying Saved (choose returns false, toggleDay falls back to a fresh read).
  const gate = board.indexOf('if (!j?.ok) return false')
  assert.ok(gate > -1, 'choose gates on the answer ok')
  assert.ok(gate < board.indexOf('setEditing("")'), 'a failed tap does not close the edit panel')
  assert.ok(gate < board.indexOf('setToast('), 'a failed tap raises no toast')
  assert.ok(board.includes('Already sent a moment ago — nothing sent twice.'), 'a skipped re-tap names itself')
  assert.ok(board.includes('j.skipped ?'), 'the toast tells a skip apart from a real send')
  const sender = read('src/lib/interview-followups.ts')
  assert.ok(sender.includes('return { ok: true, skipped: true }'), 'the guard reports its skip')
  const api = read('src/app/api/gmail/interview-track/route.ts')
  assert.ok(api.includes('sent.skipped ? { ...out, skipped: true } : out'), 'the route carries the skip to the board')
})
