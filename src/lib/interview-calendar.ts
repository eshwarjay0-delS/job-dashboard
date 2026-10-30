// Monthly calendar helpers for the dashboard calendar page.
//
// One monthly calendar shows the interview overview across the three views
// the page already has — Upcoming invites, Past scheduled, Date unverified —
// and it re-filters whenever the selected view changes.
//
// Date honesty, per the anchor rule: a plotted date is either the parsed
// interview timestamp (the page's scheduled bucket) or a date stated in the
// invite text (the unverified bucket). A stated date is NEVER presented as
// confirmed — it always carries verified: false and the UI badges it as
// "Date unverified". An interview with no timestamp and no stated date
// cannot be placed on any day; it is returned as undated so the UI lists it
// instead of dropping it.

export type CalendarInterviewInput = {
  id: string
  company: string
  role: string
  kind?: string
  account?: string
  with?: string
  ts?: number
  threadId?: string
  evidence?: string
  inviteVia?: string
}

export type CalendarEvent = {
  id: string
  company: string
  role: string
  kind?: string
  account?: string
  with?: string
  threadId?: string
  evidence?: string
  inviteVia?: string
  /** yyyy-mm-dd in local time, or null when no date could be placed. */
  dateKey: string | null
  /** Display time, e.g. "1:30 PM". Absent when no time is known. */
  timeLabel?: string
  /** false = date stated in invite text, not verified. Never render as confirmed. */
  verified: boolean
}

export type StatedDate = {
  month: number
  day: number
  timeLabel?: string
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function dateKeyOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export function timeLabelOf(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/** Extract a stated month/day (and optional time) from invite text.
 *  Observed format: "Monday, 11/2 at 1:30 PM EST", "Wednesday, 10/28 at 2 PM EST".
 *  US month/day order. Returns null when nothing parseable is present, or
 *  when the month/day cannot be a real calendar date. The weekday, when
 *  present, is NOT used to reject the match — the result is unverified
 *  either way, and the UI says so. */
export function extractStatedDate(text: string): StatedDate | null {
  if (!text) return null
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*([AP]M))?/i)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Reject impossible month/day pairs (Feb 30, Apr 31, ...). Leap years
  // do not matter for a stated-date display: Feb 29 is accepted.
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (day > daysInMonth) return null
  let timeLabel: string | undefined
  if (m[3]) {
    const hour = Number(m[3])
    if (hour < 1 || hour > 12) return { month, day }
    timeLabel = m[4] ? `${hour}:${m[4]} ${m[5].toUpperCase()}` : `${hour} ${m[5].toUpperCase()}`
  }
  return timeLabel ? { month, day, timeLabel } : { month, day }
}

/** Place one interview on the calendar. Timestamp wins; otherwise the
 *  stated date from the role text, marked unverified; otherwise undated. */
export function toCalendarEvent(iv: CalendarInterviewInput, yearHint?: number): CalendarEvent {
  const base = {
    id: iv.id,
    company: iv.company,
    role: iv.role,
    kind: iv.kind,
    account: iv.account,
    with: iv.with,
    threadId: iv.threadId,
    evidence: iv.evidence,
    inviteVia: iv.inviteVia,
  }
  if (iv.ts) {
    const d = new Date(iv.ts)
    return { ...base, dateKey: dateKeyOf(d), timeLabel: timeLabelOf(d), verified: true }
  }
  const stated = extractStatedDate(iv.role)
  if (stated) {
    const year = yearHint ?? new Date().getFullYear()
    const dateKey = `${year}-${String(stated.month).padStart(2, "0")}-${String(stated.day).padStart(2, "0")}`
    return { ...base, dateKey, timeLabel: stated.timeLabel, verified: false }
  }
  return { ...base, dateKey: null, verified: false }
}

export function toCalendarEvents(
  interviews: CalendarInterviewInput[],
  yearHint?: number,
): CalendarEvent[] {
  return interviews.map((iv) => toCalendarEvent(iv, yearHint))
}

export function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    if (!ev.dateKey) continue
    const list = map.get(ev.dateKey) ?? []
    list.push(ev)
    map.set(ev.dateKey, list)
  }
  return map
}

export type MonthCell = {
  dateKey: string
  day: number
  inMonth: boolean
}

/** Month grid, Monday-first weeks, 6 rows max. Cells outside the month are
 *  included (dimmed by the UI) so every week is complete. */
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(year, month - 1, 1)
  // Monday-first: Sunday (0) becomes offset 6.
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month - 1, 1 - lead)
  const weeks: MonthCell[][] = []
  for (let w = 0; w < 6; w++) {
    const week: MonthCell[] = []
    for (let d = 0; d < 7; d++) {
      const cell = new Date(start)
      cell.setDate(start.getDate() + w * 7 + d)
      week.push({
        dateKey: dateKeyOf(cell),
        day: cell.getDate(),
        inMonth: cell.getMonth() === month - 1,
      })
    }
    // A trailing week entirely outside the month is not a row at all.
    if (w > 0 && week.every((c) => !c.inMonth)) break
    weeks.push(week)
  }
  return weeks
}

/** Shift a (year, month) pair by delta months. Month is 1-12. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = (year * 12 + (month - 1)) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}
