"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { alertBuzz, arriveBuzz } from "@/lib/haptics"
import type { InboxAlert } from "@/lib/inbox-alerts"

// ── Inbox alert watcher ──────────────────────────────────────────────────
// The app taps you on the shoulder the moment something urgent lands in
// a connected inbox: a vibration (alertBuzz for interviews, arriveBuzz
// for the rest), a browser notification when you've allowed one, and a
// card here that already knows which application chain the email belongs
// to. Polls /api/gmail/alerts every 2 minutes and on focus — the same
// cadence as the mail page's live pulse. A local watermark means each
// item alerts exactly once; the first ever run only sets the baseline,
// so history never storms in.

const WM_KEY = "mf_inbox_alert_watermark"
const DISMISS_KEY = "mf_inbox_alert_dismissed"
const ENABLE_OFF_KEY = "mf_inbox_alert_enable_dismissed"
const POLL_MS = 120_000
const MAX_CARDS = 4

const KIND_LABEL: Record<InboxAlert["kind"], string> = {
  interview: "Interview confirmed",
  rtr: "RTR request",
  rate: "Rate confirmation",
  documents: "Documents requested",
  offer: "Offer",
}

function whenText(a: InboxAlert): string {
  const ts = a.kind === "interview" && a.meetingStart ? a.meetingStart : a.at
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function readSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key)
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export default function InboxAlertWatcher() {
  const [cards, setCards] = useState<InboxAlert[]>([])
  const [extra, setExtra] = useState(0)
  const [showEnable, setShowEnable] = useState(false)
  const busyRef = useRef(false)
  const seenRef = useRef<Set<string>>(new Set())

  const open = useCallback((a: InboxAlert) => {
    window.location.assign(
      `/dashboard/mail?open=${encodeURIComponent(a.threadId)}&account=${encodeURIComponent(a.accountEmail)}`,
    )
  }, [])

  const dismiss = useCallback((id: string) => {
    try {
      const set = readSet(DISMISS_KEY)
      set.add(id)
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...set].slice(-300)))
    } catch {
      /* storage unavailable — the card still closes for this session */
    }
    setCards(prev => prev.filter(c => c.id !== id))
  }, [])

  const poll = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      let wm = 0
      try {
        wm = Number(window.localStorage.getItem(WM_KEY)) || 0
      } catch {
        wm = 0
      }
      if (!wm) {
        // First run ever: baseline at now. Nothing historical alerts.
        try {
          window.localStorage.setItem(WM_KEY, String(Date.now()))
        } catch {
          /* ignore */
        }
        return
      }
      const res = await fetch(`/api/gmail/alerts?since=${wm}`, { credentials: "same-origin" })
      if (!res.ok) return
      const data = (await res.json()) as { ok?: boolean; alerts?: InboxAlert[] }
      if (!data.ok || !Array.isArray(data.alerts) || data.alerts.length === 0) return

      const dismissed = readSet(DISMISS_KEY)
      const fresh = data.alerts.filter(a => !dismissed.has(a.id) && !seenRef.current.has(a.id))
      const maxAt = Math.max(wm, ...data.alerts.map(a => a.at))
      try {
        window.localStorage.setItem(WM_KEY, String(maxAt))
      } catch {
        /* ignore */
      }
      if (fresh.length === 0) return
      for (const a of fresh) seenRef.current.add(a.id)

      // Feel it first, then show it.
      if (fresh.some(a => a.kind === "interview")) alertBuzz()
      else arriveBuzz()

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const a of fresh) {
          try {
            const n = new Notification(`${KIND_LABEL[a.kind]} — ${whenText(a)}`, {
              body: `${a.fromName}: ${a.subject}\n${a.connect.note}`,
              tag: a.id,
            })
            n.onclick = () => {
              window.focus()
              open(a)
            }
          } catch {
            /* notifications are a bonus channel; the card below is the record */
          }
        }
      }

      setCards(prev => {
        const merged = [...prev, ...fresh]
        if (merged.length > MAX_CARDS) {
          setExtra(merged.length - MAX_CARDS)
          return merged.slice(-MAX_CARDS)
        }
        return merged
      })
    } catch {
      /* a failed poll is silent — the next one retries in 2 minutes */
    } finally {
      busyRef.current = false
    }
  }, [open ])

  useEffect(() => {
    let enableOff = false
    try {
      enableOff = window.localStorage.getItem(ENABLE_OFF_KEY) === "1"
    } catch {
      enableOff = false
    }
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default" &&
      !enableOff
    ) {
      setShowEnable(true)
    }
    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    const onWake = () => {
      if (document.visibilityState === "visible") void poll()
    }
    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("focus", onWake)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("focus", onWake)
    }
  }, [poll])

  const enableNotifications = useCallback(async () => {
    try {
      await Notification.requestPermission()
    } catch {
      /* the in-app cards keep working either way */
    }
    setShowEnable(false)
    try {
      window.localStorage.setItem(ENABLE_OFF_KEY, "1")
    } catch {
      /* ignore */
    }
  }, [])

  const skipEnable = useCallback(() => {
    setShowEnable(false)
    try {
      window.localStorage.setItem(ENABLE_OFF_KEY, "1")
    } catch {
      /* ignore */
    }
  }, [])

  if (!showEnable && cards.length === 0) return null

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 84,
        right: 20,
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "min(360px, calc(100vw - 40px))",
      }}
    >
      {showEnable && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "12px 14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Inbox alerts are on</div>
          <div style={{ color: "var(--text-muted)", marginBottom: 10 }}>
            Interviews, RTRs and rate confirmations will buzz you here the moment they land.
            Allow browser notifications to hear about them on other tabs too.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={enableNotifications}
              style={{
                background: "var(--accent, #2563eb)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Allow notifications
            </button>
            <button
              onClick={skipEnable}
              style={{
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {cards.map(a => (
        <div
          key={a.id}
          style={{
            background: "var(--surface)",
            border: `1px solid ${a.connect.state === "check-chain" ? "#d97706" : "var(--border)"}`,
            borderLeft: `4px solid ${a.kind === "interview" ? "#16a34a" : a.connect.state === "check-chain" ? "#d97706" : "var(--accent, #2563eb)"}`,
            borderRadius: 12,
            padding: "12px 14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {KIND_LABEL[a.kind]} · {whenText(a)}
            </span>
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss alert"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 15,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 2, fontWeight: 600 }}>{a.fromName}</div>
          <div style={{ color: "var(--text-muted)", marginTop: 1 }}>{a.subject}</div>
          <div
            style={{
              marginTop: 8,
              color: a.connect.state === "check-chain" ? "#d97706" : "var(--text-muted)",
            }}
          >
            {a.connect.state === "check-chain" ? "⚠ " : ""}
            {a.connect.note}
          </div>
          <button
            onClick={() => open(a)}
            style={{
              marginTop: 10,
              background: "var(--accent, #2563eb)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Open the email
          </button>
        </div>
      ))}

      {extra > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "8px 14px",
            color: "var(--text-muted)",
            fontSize: 13,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          +{extra} more in Mail
        </div>
      )}
    </div>
  )
}
