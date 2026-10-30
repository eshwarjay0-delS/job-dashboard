"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Card, Btn } from "../../_suite/ui"
import {
  monthGrid, monthLabel, shiftMonth, groupByDay, dateKeyOf,
  type CalendarEvent,
} from "@/lib/interview-calendar"

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// One monthly calendar for the interview overview. The page's view options
// (Upcoming invites / Past scheduled / Date unverified) decide which events
// it shows: the parent passes the already-filtered list, so switching the
// option re-filters the calendar. A stated date is never rendered as
// confirmed — unverified days get a dashed chip and a "Date unverified"
// badge in the day detail. Interviews with no date at all are listed below
// the grid so nothing disappears from the overview.
export default function MonthCalendar({ events, bucketLabel }: {
  events: CalendarEvent[]
  bucketLabel: string
}) {
  const today = new Date()
  const [monthOff, setMonthOff] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  const shown = shiftMonth(today.getFullYear(), today.getMonth() + 1, monthOff)
  const weeks = monthGrid(shown.year, shown.month)
  const byDay = groupByDay(events)
  const undated = events.filter((e) => !e.dateKey)
  const todayKey = dateKeyOf(today)

  const selectedEvents = selected ? (byDay.get(selected) ?? []) : []
  const selectedLabel = selected
    ? new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, Number(selected.slice(8, 10)))
        .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : null

  return (
    <Card style={{ padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <Btn variant="ghost" title="Previous month" style={{ padding: "0 8px" }} onClick={() => setMonthOff((o) => o - 1)}>
          <ChevronLeft size={16} />
        </Btn>
        <span style={{ fontSize: 17, fontWeight: 750, letterSpacing: "-0.02em" }}>{monthLabel(shown.year, shown.month)}</span>
        <Btn variant="ghost" title="Next month" style={{ padding: "0 8px" }} onClick={() => setMonthOff((o) => o + 1)}>
          <ChevronRight size={16} />
        </Btn>
        <Btn variant="ghost" title="Back to this month" style={{ padding: "0 10px", marginLeft: 4 }} onClick={() => setMonthOff(0)}>
          Today
        </Btn>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginLeft: "auto" }}>
          Showing: {bucketLabel} · {events.length} interview{events.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 6 }}>
        Dashed outline means the date was stated in the invite, not verified. Tap a day to see its interviews.
      </div>

      {events.length === 0 ? (
        <div style={{ padding: "28px 0 8px", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
          No interviews in this view to place on the calendar.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 14 }}>
            {WEEK_DAYS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--text-soft)", paddingBottom: 4 }}>
                {d.toUpperCase()}
              </div>
            ))}
            {weeks.flatMap((week) => week.map((cell) => {
              const dayEvents = byDay.get(cell.dateKey) ?? []
              const isSelected = selected === cell.dateKey
              const isToday = cell.dateKey === todayKey
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelected(cell.dateKey)}
                  aria-label={`${cell.dateKey}, ${dayEvents.length} interview${dayEvents.length === 1 ? "" : "s"}`}
                  style={{
                    minHeight: 76, padding: "6px 6px 8px", textAlign: "left", cursor: "pointer",
                    background: isSelected ? "var(--surface-2)" : "var(--surface)",
                    border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 10, font: "inherit", opacity: cell.inMonth ? 1 : 0.45,
                    display: "flex", flexDirection: "column", gap: 3, overflow: "hidden",
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, background: isToday ? "var(--accent)" : "transparent",
                    color: isToday ? "#fff" : "var(--text)",
                  }}>{cell.day}</span>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      title={ev.verified ? ev.company : `${ev.company} — date stated in invite, not verified`}
                      style={{
                        fontSize: 11, lineHeight: "14px", fontWeight: 650, color: "var(--text)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        padding: "2px 6px", borderRadius: 6, background: "var(--surface-3)",
                        borderLeft: ev.verified ? "3px solid #11100c" : "none",
                        border: ev.verified ? "none" : "1px dashed var(--border-strong)",
                      }}
                    >
                      {ev.company}{ev.timeLabel ? ` · ${ev.timeLabel}` : ""}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 6 }}>+{dayEvents.length - 3} more</span>
                  )}
                </button>
              )
            }))}
          </div>

          <div style={{ marginTop: 16 }}>
            {!selected ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Tap a day to see its interviews.</p>
            ) : selectedEvents.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No interviews on {selectedLabel} in this view.</p>
            ) : (
              <>
                <p style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>{selectedLabel}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedEvents.map((ev) => (
                    <div key={ev.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{ev.company}</span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{ev.role}</span>
                      {ev.timeLabel && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{ev.timeLabel}</span>}
                      {!ev.verified && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                          background: "var(--accent-soft)", border: "1px solid var(--accent-border)", color: "var(--accent-txt)",
                        }}>Date unverified</span>
                      )}
                      {ev.threadId && ev.account && (
                        <Link
                          href={`/dashboard/overview?chain=${encodeURIComponent(ev.threadId)}&account=${encodeURIComponent(ev.account)}`}
                          style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}
                        >Overview</Link>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {undated.length > 0 && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>
            No date to place on the calendar ({undated.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {undated.map((ev) => (
              <div key={ev.id} style={{ fontSize: 13, color: "var(--text-muted)" }}>
                <span style={{ fontWeight: 700, color: "var(--text)" }}>{ev.company}</span> — {ev.role} · Date unverified
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
