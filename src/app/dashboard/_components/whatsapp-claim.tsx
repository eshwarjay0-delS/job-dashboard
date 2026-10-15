"use client"

// The resumes the WhatsApp bot made, brought into Files (POST /api/whatsapp/collect). For the owner of the site.
// When the page opens: the owner's numbers named in settings are joined and their resumes saved, with nothing to press.
// When no number is named there, the numbers that have used the bot are offered by their last four digits, and one
// press ("It is mine") joins that number and brings its resumes in. Found on 13 Oct 2026: eighteen resumes had been made
// over WhatsApp that day, his Files held none, and no number was named or joined, so nothing could know it was his.

import { useCallback, useEffect, useState } from "react"

type Answer = { ok: boolean; owner?: boolean; moved?: number; unclaimed?: { ending: string; held: number }[]; error?: string }

export default function WhatsAppClaim({ onMoved }: { onMoved?: (moved: number) => void }) {
  const [loose, setLoose] = useState<{ ending: string; held: number }[]>([])
  const [busy, setBusy] = useState("")
  const [note, setNote] = useState("")
  const [hidden, setHidden] = useState<string[]>([])

  const ask = useCallback(async (claim?: string) => {
    try {
      const r = await fetch("/api/whatsapp/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(claim ? { claim } : {}) })
      const j = (await r.json().catch(() => ({}))) as Answer
      if (!j.ok) { if (claim) setNote(j.error || "That did not go through. Try again in a moment."); return }
      setLoose(j.unclaimed || [])
      if (j.moved) { setNote(`I put ${j.moved} resume${j.moved === 1 ? "" : "s"} made on WhatsApp into your Files, each in the folder for its kind of job.`); onMoved?.(j.moved) }
      else if (claim) { setNote("That number is yours now. Every resume made there is saved in your Files."); onMoved?.(0) }
    } catch { if (claim) setNote("That did not go through. Try again in a moment.") }
  }, [onMoved])
  useEffect(() => { queueMicrotask(() => { void ask() }) }, [ask])

  const shown = loose.filter(n => !hidden.includes(n.ending))
  if (!shown.length && !note) return null
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {shown.map(n => (
        <div key={n.ending} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface)" }}>
          <span style={{ flex: "1 1 260px", fontSize: 14.5, lineHeight: 1.5, color: "var(--text)" }}>
            A WhatsApp number ending <strong>{n.ending}</strong> has {n.held} {n.held === 1 ? "resume" : "resumes"} the bot made. If it is yours, I will put them in your Files and save every new one here.
          </span>
          <button type="button" className="btn-accent" disabled={!!busy} onClick={async () => { setBusy(n.ending); await ask(n.ending); setBusy("") }} style={{ minHeight: 44, padding: "0 18px", fontSize: 15 }}>{busy === n.ending ? "Bringing them in…" : "It is mine"}</button>
          <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => setHidden(h => [...h, n.ending])} style={{ minHeight: 44, padding: "0 12px", fontSize: 14 }}>Not mine</button>
        </div>
      ))}
      {note && <p role="status" style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>{note}</p>}
    </div>
  )
}
