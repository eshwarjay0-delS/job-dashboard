// Monthly interview calendar: month grid, stated-date extraction, and the
// verified-vs-stated placement rule. Stated dates are never rendered as
// confirmed — they always carry verified: false.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  monthGrid, monthLabel, shiftMonth, extractStatedDate,
  toCalendarEvent, toCalendarEvents, groupByDay, dateKeyOf,
} from '../../src/lib/interview-calendar.ts'

test('month grid is Monday-first with complete weeks', () => {
  // November 2026: Nov 1 is a Sunday, so the grid opens Mon Oct 26.
  const weeks = monthGrid(2026, 11)
  assert.equal(weeks.length, 6)
  for (const week of weeks) {
    assert.equal(week.length, 7)
    // Every week starts on a Monday.
    const first = new Date(`${week[0].dateKey}T00:00:00`)
    assert.equal(first.getDay(), 1)
  }
  assert.equal(weeks[0][0].dateKey, '2026-10-26')
  assert.equal(weeks[0][0].inMonth, false)
  assert.equal(weeks[0][6].dateKey, '2026-11-01')
  assert.equal(weeks[0][6].inMonth, true)
  // Nov 2, 2026 is a Monday in-month.
  assert.equal(weeks[1][0].dateKey, '2026-11-02')
  assert.equal(weeks[1][0].inMonth, true)
})

test('month grid drops a trailing week entirely outside the month', () => {
  // February 2027: Feb 1 is a Monday and February has exactly 28 days.
  const weeks = monthGrid(2027, 2)
  assert.equal(weeks.length, 4)
  assert.equal(weeks[3][6].dateKey, '2027-02-28')
})

test('stated dates parse from invite text in US month/day order', () => {
  assert.deepEqual(
    extractStatedDate('2nd Round - Akkodis/BNYM; MS Teams Interview; Monday, 11/2 at 1:30 PM EST'),
    { month: 11, day: 2, timeLabel: '1:30 PM' },
  )
  assert.deepEqual(
    extractStatedDate('Akkodis/BNYM; MS Teams Interview; Wednesday, 10/28 at 2 PM EST'),
    { month: 10, day: 28, timeLabel: '2 PM' },
  )
  assert.equal(extractStatedDate('screening call, no date yet'), null)
  assert.equal(extractStatedDate('see you on 13/40'), null)
  assert.equal(extractStatedDate('see you on 2/30'), null)
})

test('timestamp wins; stated date is unverified; no date stays undated', () => {
  const ts = new Date(2026, 10, 2, 13, 30).getTime() // Nov 2, 2026 local
  const dated = toCalendarEvent({ id: 'a', company: 'BNYM', role: 'Security Analyst III', ts })
  assert.equal(dated.dateKey, '2026-11-02')
  assert.equal(dated.timeLabel, '1:30 PM')
  assert.equal(dated.verified, true)

  const stated = toCalendarEvent(
    { id: 'b', company: 'BNYM', role: '2nd Round - Akkodis/BNYM; MS Teams Interview; Monday, 11/2 at 1:30 PM EST' },
    2026,
  )
  assert.equal(stated.dateKey, '2026-11-02')
  assert.equal(stated.timeLabel, '1:30 PM')
  assert.equal(stated.verified, false)

  const undated = toCalendarEvent({ id: 'c', company: 'Acme', role: 'screening call, date TBD' }, 2026)
  assert.equal(undated.dateKey, null)
  assert.equal(undated.verified, false)
})

test('grouping by day skips undated events', () => {
  const events = toCalendarEvents([
    { id: 'a', company: 'BNYM', role: 'Security Analyst III', ts: new Date(2026, 10, 2, 13, 30).getTime() },
    { id: 'b', company: 'BNYM', role: 'Monday, 11/2 at 1:30 PM EST' },
    { id: 'c', company: 'Acme', role: 'no date' },
  ], 2026)
  const byDay = groupByDay(events)
  assert.equal(byDay.get('2026-11-02').length, 2)
  assert.equal(byDay.has('2026-11-03'), false)
})

test('month labels and month shifting wrap the year', () => {
  assert.equal(monthLabel(2026, 11), 'November 2026')
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 })
  assert.equal(dateKeyOf(new Date(2026, 0, 5)), '2026-01-05')
})
