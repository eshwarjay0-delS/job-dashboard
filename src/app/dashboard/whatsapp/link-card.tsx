"use client"

// Join this account to a WhatsApp number for private resume tailoring. The bot does not file resumes in MarketFit Files.
// One button gives a code; the person sends it to the bot from their own WhatsApp; this card sees it arrive.
import { useCallback, useEffect, useState } from "react"

type Linked = { ending: string; at: number }
type Code = { code: string; send: string; minutes: number; expiresAt: number }

export default function LinkCard({ bot }: { bot: string }) {
  const [numbers, setNumbers] = useState<Linked[] | null>(null)
  const [code, setCode] = useState<Code | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")

  const read = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/link", { cache: "no-store" })
      const j = await r.json()
      if (r.ok && Array.isArray(j.numbers)) setNumbers(j.numbers)
      return (r.ok && Array.isArray(j.numbers) ? j.numbers : []) as Linked[]
    } catch { return [] as Linked[] }
  }, [])

  useEffect(() => { queueMicrotask(() => { void read() }) }, [read])

  // While a code is showing, look every few seconds for the number that sent it.
  useEffect(() => {
    if (!code) return
    const before = numbers?.length ?? 0
    const timer = setInterval(async () => {
      if (Date.now() > code.expiresAt) { setCode(null); setNote("That code ran out. Press the button for a new one."); return }
      const now = await read()
      if (now.length > before || now.some(n => n.at > code.expiresAt - code.minutes * 60_000)) { setCode(null); setNote("Linked. Send a Word resume and a job description to tailor it.") }
    }, 4000)
    return () => clearInterval(timer)
  }, [code, numbers, read])

  async function newCode() {
    setBusy(true); setNote("")
    try {
      const r = await fetch("/api/whatsapp/link", { method: "POST" })
      const j = await r.json()
      if (r.ok && j.code) setCode(j)
      else setNote(j.error || "A code could not be made just now. Try again in a moment.")
    } catch { setNote("A code could not be made just now. Try again in a moment.") }
    finally { setBusy(false) }
  }

  async function unlink() {
    setBusy(true); setNote("")
    try {
      await fetch("/api/whatsapp/link", { method: "DELETE" })
      setCode(null); await read()
      setNote("Unlinked. Your existing MarketFit Files were not changed.")
    } catch { setNote("That did not go through. Try again in a moment.") }
    finally { setBusy(false) }
  }

  const linked = (numbers || []).length > 0
  const soft = { margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)" } as const

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      {linked ? (
        <p style={{ ...soft, color: "var(--text)" }}>
          Linked to the number ending <strong>{(numbers || []).map(n => n.ending).join(", ")}</strong>. Send a Word resume and a job description for each tailoring request. The finished document comes back through WhatsApp.
        </p>
      ) : (
        <p style={soft}>Link your WhatsApp number to tailor resumes. Files are not automatically stored in MarketFit.</p>
      )}

      {code && (
        <div role="status" style={{ border: "1px solid var(--border-strong)", borderRadius: 12, padding: "14px 16px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ ...soft, color: "var(--text)" }}>Send this message to MarketFit on WhatsApp, from the number you want to link:</p>
          <p style={{ margin: 0, fontFamily: "var(--font-mono, ui-monospace, Consolas, monospace)", fontSize: 22, fontWeight: 700, letterSpacing: 1, color: "var(--text)" }}>{code.send}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {bot && (
              <a className="btn-accent" href={`https://wa.me/${bot}?text=${encodeURIComponent(code.send)}`} target="_blank" rel="noopener noreferrer"
                style={{ minHeight: 44, padding: "0 18px", fontSize: 15, textDecoration: "none" }}>Open WhatsApp with it written</a>
            )}
            <button type="button" className="btn-outline" style={{ minHeight: 44, padding: "0 18px", fontSize: 15 }}
              onClick={() => { void navigator.clipboard?.writeText(code.send).then(() => setNote("Copied."), () => setNote("Copy it by hand: it could not be copied for you.")) }}>Copy</button>
          </div>
          <p style={{ ...soft, fontSize: 14 }}>The code works once, for {code.minutes} minutes. This page will say so when it arrives.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {!code && (
          <button type="button" className={linked ? "btn-outline" : "btn-accent"} disabled={busy} onClick={newCode}
            style={{ minHeight: 46, padding: "0 22px", fontSize: 15 }}>{linked ? "Link another number" : "Link this number"}</button>
        )}
        {linked && !code && (
          <button type="button" className="btn-outline" disabled={busy} onClick={unlink} style={{ minHeight: 46, padding: "0 22px", fontSize: 15 }}>Unlink</button>
        )}
      </div>
      {note && <p role="status" style={soft}>{note}</p>}
    </div>
  )
}
