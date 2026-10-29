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

test('a Send now button the server must refuse is replaced by its reason, and a refused send counts nothing', () => {
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  assert.ok(board.includes('sendNowBlockReason('), 'the panel asks the server gate before showing Send now')
  assert.ok(board.includes('sendBlock ?'), 'a blocked card shows the reason instead of the button')
  const sender = read('src/lib/interview-followups.ts')
  assert.ok(sender.includes('sent: x.sent.slice(0, -1)'), 'a definite refusal rolls the recorded send back')
  assert.ok(sender.includes('Nothing was counted, so you can try again.'), 'a rolled-back refusal says nothing was counted')
  assert.ok(sender.includes('It is still counted, so it will not go twice.'), 'an ambiguous timeout still keeps the count')
})

test('a refused automatic send is never recorded: the daily job rolls it back like the tap path', () => {
  // 29 Oct 2026: the Thursday ring recorded sends that never reached Gmail — the daily job wrote
  // the send down first and, unlike the tap path, never rolled it back on a definite refusal, so
  // the card showed Last sent for mail that does not exist and the slot was consumed.
  const sender = read('src/lib/interview-followups.ts')
  const daily = sender.slice(0, sender.indexOf('export async function sendInterviewFollowUpNow'))
  assert.ok(daily.includes('a follow-up was refused'), 'the daily job names a definite refusal')
  assert.ok(daily.includes('sent: x.sent.slice(0, -1)'), 'a refused automatic send rolls its record back')
  assert.ok(daily.includes('must never consume one of the four'), 'the rollback rule is stated for the daily job')
  assert.ok(daily.includes('a follow-up could not be sent'), 'the ambiguous timeout keeps its own branch')
})

test('history always shows the exact time of every send, never a bare date', () => {
  // 29 Oct 2026, his words: "I need exact time always in history." A bare date cannot be checked
  // against Gmail Sent, and one once passed for a send that never went out.
  const board = read('src/app/dashboard/calendar/_components/interview-board.tsx')
  const fmt = board.slice(board.indexOf('const dayTime'), board.indexOf('const digits'))
  assert.ok(fmt.includes('hour') && fmt.includes('minute'), 'the send-time format carries hour and minute')
  assert.equal((board.match(/Last sent \{dayTime\(/g) || []).length, 2, 'both Last sent lines show the exact time')
  assert.ok(board.includes('<li key={at}>{dayTime(at)}</li>'), 'every History entry shows the exact time')
  assert.ok(board.includes('day(t.at)'), 'interview dates keep the bare date format')
})
