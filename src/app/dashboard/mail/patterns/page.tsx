"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

type Card = {
  key: string; threadId: string; account: string; role: string; client: string; req: string
  recruiterName: string; recruiterEmail: string; senderClass: string
  latestAsk: string; category: string; pattern: string | null; patternReason: string
  gateBody: string | null; availabilityBody: string | null
  bucket: "needs-you" | "waiting" | "done"; doubleSubmitHold: boolean; gateAlreadySent: boolean
  skipped: boolean; header: { what: string; todo: string; ifIgnored: string }
}

type OptIn = { patternId: string; account: string; senderClass: string; enabledAt: string }

const CACHE_KEY = "mfit:reply-pattern-cards:v1"
const BUCKETS = [
  { id: "needs-you", label: "Needs you" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
] as const

export default function ReplyPatternsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [counts, setCounts] = useState({ needsYou: 0, waiting: 0, done: 0 })
  const [bucket, setBucket] = useState<"needs-you" | "waiting" | "done">("needs-you")
  const [optIns, setOptIns] = useState<OptIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const absentRef = useRef<Record<string, number>>({})

  // Paint the kept snapshot instantly on later visits; fresh cards then
  // merge in (new cards append, known cards update in place, a card gone
  // from the server twice in a row drops). No full rescan per visit.
  const mergeCards = useCallback((prev: Card[], fresh: Card[]) => {
    const freshKeys = new Set(fresh.map(c => c.key))
    const byKey = new Map(prev.map(c => [c.key, c]))
    for (const c of fresh) byKey.set(c.key, c)
    const merged: Card[] = []
    for (const c of byKey.values()) {
      if (!freshKeys.has(c.key)) {
        absentRef.current[c.key] = (absentRef.current[c.key] || 0) + 1
        if (absentRef.current[c.key] < 2) merged.push(c)
      } else {
        absentRef.current[c.key] = 0
        merged.push(c)
      }
    }
    for (const c of fresh) if (!prev.some(p => p.key === c.key)) merged.push(c)
    return merged
  }, [])

  const load = useCallback(async (initial: boolean) => {
    try {
      const res = await fetch("/api/gmail/reply-patterns?view=cards", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load pattern cards.")
      setCards(prev => {
        const merged = initial && prev.length === 0 ? data.cards : mergeCards(prev, data.cards)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(merged)) } catch { /* cache is best-effort */ }
        return merged
      })
      setCounts(data.counts || { needsYou: 0, waiting: 0, done: 0 })
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load pattern cards.")
    } finally {
      setLoading(false)
    }
  }, [mergeCards])

  useEffect(() => {
    try {
      const snap = localStorage.getItem(CACHE_KEY)
      if (snap) setCards(JSON.parse(snap))
    } catch { /* ignore a stale snapshot */ }
    void load(true)
    const lib = fetch("/api/gmail/reply-patterns", { cache: "no-store" })
      .then(r => r.json()).then(d => { if (d.ok) setOptIns(d.optIns || []) }).catch(() => {})
    void lib
    const id = setInterval(() => void load(false), 120_000)
    return () => clearInterval(id)
  }, [load])

  const post = async (action: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/gmail/reply-patterns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || data.reasons?.join("; ") || "That did not work.")
    return data
  }

  const act = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(b => ({ ...b, [key]: true }))
    setNotice(""); setError("")
    try {
      await fn()
      setNotice(okMsg)
      await load(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.")
    } finally {
      setBusy(b => ({ ...b, [key]: false }))
    }
  }

  const shown = cards.filter(c => c.bucket === bucket)
  const verb = (c: Card) => c.pattern === "gate-c2c-c2h" ? "Ask C2C or C2H" : c.pattern === "availability-interview" ? "Confirm availability" : "Send this reply"
  const bodyOf = (c: Card) => editing[c.key] ?? c.gateBody ?? c.availabilityBody ?? ""

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 64px" }}>
      <p><Link href="/dashboard/mail">← Back to Mail</Link></p>
      <h1 style={{ fontSize: 26, margin: "8px 0 4px" }}>Reply patterns</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        One card per role and chain — not one per email. Each card is one decision, already written for you.
        Nothing here auto-sends except an availability reply you explicitly delegated, and only the exact template.
      </p>
      <p style={{ fontWeight: 700 }}>
        Needs you: {counts.needsYou} · Waiting: {counts.waiting} · Done: {counts.done}
      </p>
      {loading && cards.length === 0 && <p>Loading pattern cards…</p>}
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "var(--success)" }}>{notice}</p>}
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {BUCKETS.map(b => (
          <button key={b.id} onClick={() => setBucket(b.id)}
            style={{ padding: "8px 14px", borderRadius: 999, fontWeight: bucket === b.id ? 800 : 500, cursor: "pointer" }}>
            {b.label}
          </button>
        ))}
      </div>
      {shown.length === 0 && !loading && <p>Nothing in {BUCKETS.find(b => b.id === bucket)?.label} right now.</p>}
      {shown.map(c => {
        const delegated = optIns.some(o => o.patternId === "availability-interview" && o.account === c.account && o.senderClass === c.senderClass)
        return (
          <section key={c.key} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>{c.header.what}</h2>
            <p style={{ margin: "4px 0" }}><strong>What do I need to do?</strong> {c.header.todo}</p>
            <p style={{ margin: "4px 0", color: "var(--text-muted)" }}><strong>What happens if I ignore it?</strong> {c.header.ifIgnored}</p>
            <p style={{ margin: "4px 0", fontSize: 13, color: "var(--text-muted)" }}>
              {c.recruiterName} · {c.recruiterEmail} · {c.senderClass === "marketing" ? "marketing firm — filed, never replied" : c.senderClass} · {c.category}
              {c.req ? ` · req ${c.req}` : " · req number not stated"}
            </p>
            <blockquote style={{ margin: "8px 0", paddingLeft: 12, borderLeft: "3px solid var(--border)" }}>{c.latestAsk}</blockquote>
            <p style={{ fontSize: 13 }}>{c.patternReason}</p>
            {c.doubleSubmitHold && <p role="alert" style={{ color: "var(--danger)", fontWeight: 700 }}>Double-submit hold: two chains on this req. Pick one chain before anything sends.</p>}
            {c.skipped && <p style={{ fontSize: 13 }}>Skipped: this ask will not re-nudge for 48 hours. The weekly follow-up cadence is unchanged.</p>}
            {c.pattern && (
              <>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 12 }}>What MarketFit will send</label>
                <textarea value={bodyOf(c)} onChange={e => setEditing(ed => ({ ...ed, [c.key]: e.target.value }))}
                  rows={7} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button disabled={!!busy[c.key]} onClick={() => void act(c.key, () => post("send", { mode: "tier1", patternId: c.pattern, account: c.account, threadId: c.threadId, body: bodyOf(c) }), "Sent. The card moves to Waiting.")}>
                    {verb(c)}
                  </button>
                  <button disabled={!!busy[c.key]} onClick={() => setEditing(ed => ({ ...ed, [c.key]: bodyOf(c) }))}>Edit this reply</button>
                  <button disabled={!!busy[c.key]} onClick={() => void act(c.key, () => post("skip", { cardKey: c.key, patternId: c.pattern }), "Skipped for 48 hours.")}>Skip</button>
                  <button disabled={!!busy[c.key]} onClick={() => void act(c.key, () => post("handled", { cardKey: c.key }), "Moved to Done.")}>I have already handled this</button>
                </div>
                {c.pattern === "availability-interview" && (
                  <div style={{ marginTop: 12, fontSize: 13 }}>
                    {delegated ? (
                      <button disabled={!!busy[c.key + ":del"]} onClick={() => void act(c.key + ":del", () => post("optout", { patternId: "availability-interview", account: c.account, senderClass: c.senderClass }).then(d => setOptIns(d.optIns || [])), "Delegate stopped for this pattern. Next asks show a nudge card again.")}>
                        Stop delegate for this pattern
                      </button>
                    ) : (
                      <button disabled={!!busy[c.key + ":del"]} onClick={() => void act(c.key + ":del", () => post("optin", { patternId: "availability-interview", account: c.account, senderClass: c.senderClass }).then(d => setOptIns(d.optIns || [])), "Delegated: future pure availability asks from this sender class auto-send the exact template, and only after you have sent it once by hand.")}>
                        Delegate availability to MarketFit
                      </button>
                    )}
                    <p style={{ color: "var(--text-muted)" }}>Delegate covers this exact pattern only, never PII, rates, RTRs or documents, and never marketing firms or held reqs.</p>
                  </div>
                )}
              </>
            )}
          </section>
        )
      })}
    </main>
  )
}
