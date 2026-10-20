"use client"

// What the bot was sent and what it answered, newest first (GET /api/whatsapp/trace, owner only). Owner, 19 Oct 2026:
// "it wasn't real time or make any sense from what I've sent" and "see chats": this is the chat as the bot saw it.
// Shown only to the owner: for anyone else the route answers 403 and the card stays hidden.

import { useEffect, useState } from "react"
import { Card, Meta } from "../_suite/ui"

type Event = { at: number; dir: "in" | "out"; kind: string; text?: string; file?: string }
type Conversation = { ending: string; events: Event[] }

const when = (at: number) => new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

export default function ConversationCard() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [error, setError] = useState("")

  const load = () => {
    fetch("/api/whatsapp/trace", { cache: "no-store" })
      .then(async r => {
        if (r.status === 401 || r.status === 403) { setConversations(null); return }
        const j = await r.json()
        if (!r.ok || !j.ok) throw new Error(j.error || `The conversation could not be read (${r.status}).`)
        setConversations(j.conversations || [])
        setError("")
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(() => { load() }, [])

  if (!conversations && !error) return null
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Meta>Recent conversation</Meta>
        <button type="button" className="btn-outline" onClick={load}>Refresh</button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 14 }}>{error}</p>}
      {conversations && !conversations.some(c => c.events.length) && (
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>Nothing yet. Messages sent to the bot from your number appear here, with every reply it sent.</p>
      )}
      {conversations?.filter(c => c.events.length).map(c => (
        <div key={c.ending} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--text-soft)" }}>Number ending {c.ending}</div>
          {[...c.events].reverse().slice(0, 30).map((e, i) => (
            <div key={i} style={{ alignSelf: e.dir === "in" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "8px 12px", borderRadius: 12,
              background: e.dir === "in" ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface-2)", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 2 }}>
                {e.dir === "in" ? "You" : "MarketFit"} · {when(e.at)}{e.file ? ` · ${e.file}` : ""}
              </div>
              {e.text ? (e.text.length > 400 ? `${e.text.slice(0, 400)}…` : e.text) : e.kind === "document" ? "(a Word file)" : `(${e.kind})`}
            </div>
          ))}
        </div>
      ))}
    </Card>
  )
}
