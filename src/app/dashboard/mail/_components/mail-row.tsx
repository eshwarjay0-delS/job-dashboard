"use client"
import type { CSSProperties } from "react"
import { Avatar, StagePill, leavingStyle } from "../../_suite/ui"
import type { Mail } from "../../_suite/sample"
import { decodeEntities, senderEmail, senderName } from "@/lib/mail-reading"

// One conversation in the list: who, what it is about, how it begins. One line each, never three.
// Before 12 Oct 2026 the middle line was the whole subject wrapped over three lines, the last line still had "&amp;" and
// "&#39;" in it, and a fit percentage and an account name competed with the one thing that matters here: what stage it is at.
const oneLine: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }

export default function MailRow({ m, on, restored, leaving, onClick, tint, inbox }: {
  m: Mail; on: boolean; restored: boolean; leaving: boolean; onClick: () => void; tint: string; inbox: string
}) {
  const who = senderName(m.fromEmail) || m.from || m.company
  const org = senderEmail(m.fromEmail).split("@")[1] || ""
  return (
    <button type="button" onClick={onClick} aria-current={on ? "true" : undefined}
      style={{
        ...leavingStyle(leaving), width: "100%", textAlign: "left", display: "flex", gap: 12, padding: "12px 14px", marginBottom: 6,
        borderRadius: 12, cursor: "pointer", background: on ? "var(--surface-2)" : "var(--surface)",
        border: `1px solid ${on ? "var(--border-strong)" : "var(--border)"}`,
      }}>
      <div style={{ position: "relative", flex: "none" }}>
        <Avatar name={who} tint={tint} size={38} />
        {m.unread && <span aria-label="Unread" style={{ position: "absolute", right: -1, top: -1, width: 11, height: 11, borderRadius: 10, background: "var(--spot)", border: "2px solid var(--surface)" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ ...oneLine, fontSize: 14.5, fontWeight: m.unread ? 700 : 600, color: "var(--text)" }}>{who}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", flex: "none" }}>{m.at}</span>
        </div>
        <div style={{ ...oneLine, fontSize: 13, color: "var(--text)", marginTop: 1 }}>{decodeEntities(m.role)}</div>
        <div style={{ ...oneLine, fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{decodeEntities(m.preview)}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 7, minWidth: 0 }}>
          {restored ? <StagePill stage="applied" label="Restored" /> : <StagePill stage={m.stage} />}
          <span style={{ ...oneLine, fontSize: 11.5, color: "var(--text-muted)" }}>{org ? org + " · " : ""}to {inbox}</span>
        </div>
      </div>
    </button>
  )
}
