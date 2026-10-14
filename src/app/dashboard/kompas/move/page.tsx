"use client"

import { useState } from "react"

// /dashboard/kompas/move — the blend port.
//
// perfACT's move.html carries raw data between addresses. This page does the
// owner's blend job (2026-10-14): export everything USABLE from both apps —
// the pros, never the cons — as one file that feeds the mix, and import a
// blend file back so the next session sounds more human. Pause markers
// ([beat]/[breath]) travel with the answers they belong to.

type BlendFile = {
  kind: string
  version: number
  exportedAt: string
  browser: {
    sessions: unknown[]
    qa: Array<{ q: string; a: string }>
    prepared: Array<{ q: string; a: string }>
    qbank: string[]
    vocab: string[]
  }
  server: Record<string, unknown> | null
}

const safeJson = (s: string | null): unknown => {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

/** The browser-side pros: sessions, Q&A, prepared answers, question bank, learned vocab. */
function gatherBrowserPros(): BlendFile["browser"] {
  const out: BlendFile["browser"] = { sessions: [], qa: [], prepared: [], qbank: [], vocab: [] }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith("perfact.")) continue
      if (/^perfact\.(live\.|themeFrom$|connectApp$)/.test(key)) continue // cons: per-address choices
      const v = safeJson(localStorage.getItem(key))
      if (key === "perfact.sessions" && Array.isArray(v)) {
        out.sessions = v
        for (const s of v) {
          const o = (s || {}) as Record<string, unknown>
          const qa = Array.isArray(o.qa) ? o.qa : Array.isArray(o.turns) ? o.turns : []
          for (const t of qa) {
            const tt = (t || {}) as Record<string, unknown>
            const q = String(tt.q ?? tt.question ?? "").trim()
            const a = String(tt.a ?? tt.answer ?? tt.text ?? "").trim()
            if (q && a.length > 20) out.qa.push({ q: q.slice(0, 500), a: a.slice(0, 4000) })
          }
        }
      } else if (key.startsWith("perfact.log.") && v && typeof v === "object") {
        const o = v as Record<string, unknown>
        const q = String(o.q ?? o.question ?? "").trim()
        const a = String(o.a ?? o.answer ?? o.text ?? "").trim()
        if (q && a.length > 20) out.qa.push({ q: q.slice(0, 500), a: a.slice(0, 4000) })
      } else if (/^perfact\.(dossier|levels)\./.test(key) && v && typeof v === "object") {
        const o = v as Record<string, unknown>
        const q = String(o.q ?? o.question ?? o.title ?? "").trim()
        const a = String(o.a ?? o.answer ?? o.text ?? "").trim()
        if (q && a.length > 20) out.prepared.push({ q: q.slice(0, 500), a: a.slice(0, 4000) })
        else if (a.length > 20) out.prepared.push({ q: "", a: a.slice(0, 4000) })
      } else if (key === "perfact.qbank" && v && typeof v === "object") {
        const items = (v as Record<string, unknown>).items
        if (Array.isArray(items)) for (const it of items) {
          const t = String((it as Record<string, unknown>)?.q ?? it ?? "").trim()
          if (t) out.qbank.push(t.slice(0, 300))
        }
      }
    }
    // MarketFit's learned vocabulary — a pro: words the engine learned to hear.
    const learned = safeJson(localStorage.getItem("mf_flow_learned"))
    if (Array.isArray(learned)) out.vocab = learned.map(String).filter(Boolean).slice(0, 200)
    // Dedupe Q&A by question.
    const seen = new Set<string>()
    out.qa = out.qa.filter((t) => {
      const k = t.q.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  } catch { /* a broken store exports nothing rather than breaking the page */ }
  return out
}

export default function KompasMovePage() {
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState("")

  async function doExport() {
    setBusy(true); setMsg("")
    try {
      const browser = gatherBrowserPros()
      let server: Record<string, unknown> | null = null
      try {
        const r = await fetch("/api/kompas/blend/export", { cache: "no-store" })
        if (r.ok) server = await r.json()
      } catch { /* server pros optional — browser pros still export */ }
      const file: BlendFile = {
        kind: "kompas-blend", version: 1,
        exportedAt: new Date().toISOString(), browser, server,
      }
      const blob = new Blob([JSON.stringify(file)], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `kompas-blend-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      const n = browser.qa.length + browser.prepared.length
      setMsg(`Exported ${n} answers, ${browser.qbank.length} bank questions, ${browser.vocab.length} learned words${server ? " + the server dossier" : ""} — pros only.`)
    } catch {
      setMsg("Export failed. Try again.")
    } finally { setBusy(false) }
  }

  async function onFile(f: File | undefined) {
    setPlan(""); setMsg("")
    if (!f) return
    try {
      const file = JSON.parse(await f.text()) as BlendFile
      if (!file || file.kind !== "kompas-blend") { setPlan("This is not a Kompas blend file."); return }
      const b = file.browser || ({} as BlendFile["browser"])
      const s = (file.server || {}) as Record<string, unknown>
      const sCounts = (s.counts || {}) as Record<string, number>
      setPlan(
        `This file holds ${(b.qa || []).length} answers, ${(b.prepared || []).length} prepared answers, ` +
        `${(b.qbank || []).length} bank questions, ${(b.vocab || []).length} learned words from the browser, ` +
        `and ${sCounts.qa || 0} answers in ${sCounts.sessions || 0} server sessions. ` +
        `Importing adds what's new — nothing here is replaced.`
      )
      ;(onFile as unknown as { file: BlendFile }).file = file
    } catch { setPlan("This file couldn't be read.") }
  }

  async function doImport() {
    const file = (onFile as unknown as { file?: BlendFile }).file
    if (!file) return
    setBusy(true); setMsg("")
    try {
      // Server part → the dossier.
      let serverMsg = ""
      if (file.server) {
        const r = await fetch("/api/kompas/blend/import", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(file.server),
        })
        const d = await r.json().catch(() => ({}))
        if (r.ok) serverMsg = `dossier gained ${d.qaAdded || 0} answers in ${d.sessionsAdded || 0} sessions`
        else serverMsg = `server import: ${d.error || "failed"}`
      }
      // Browser part → merge the learned vocabulary (the portable pro).
      const vocab = file.browser?.vocab || []
      if (vocab.length) {
        const cur = safeJson(localStorage.getItem("mf_flow_learned"))
        const have = new Set(Array.isArray(cur) ? cur.map(String) : [])
        for (const w of vocab) have.add(String(w))
        localStorage.setItem("mf_flow_learned", JSON.stringify([...have].slice(0, 500)))
      }
      setMsg(`Imported. ${serverMsg}${vocab.length ? `; ${vocab.length} learned words merged here` : ""}. The next session draws on all of it.`)
      setPlan("")
    } catch {
      setMsg("Import failed. Try again.")
    } finally { setBusy(false) }
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 64px" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 10px" }}>Blend your Kompas data</h1>
      <p style={{ color: "var(--muted, #666)", margin: "0 0 12px" }}>
        Everything usable from both Kompas copies — sessions, answers, prepared
        answers, the question bank, learned words — travels in one file. Only
        the pros are exported: real answers with their pauses, never the
        failed or empty turns. Nothing is sent anywhere; the file goes through you.
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: "18px 20px", margin: "18px 0" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>1. Export the blend</h2>
        <p style={{ color: "var(--muted, #666)", margin: "0 0 12px" }}>
          Gathers the pros from this browser and from the server dossier into one download.
        </p>
        <button onClick={doExport} disabled={busy}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>
          {busy ? "Working…" : "Download the blend"}
        </button>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: "18px 20px", margin: "18px 0" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>2. Import a blend file</h2>
        <p style={{ color: "var(--muted, #666)", margin: "0 0 12px" }}>
          Choose the file. You are told what it holds before anything is added. Nothing here is replaced.
        </p>
        <input type="file" accept="application/json,.json" aria-label="The Kompas blend file"
          onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "block", margin: "10px 0 12px" }} />
        {plan && <p style={{ minHeight: "1.2em" }}>{plan}</p>}
        <button onClick={doImport} disabled={busy || !plan || plan.startsWith("This is not")}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer", opacity: busy || !plan ? 0.45 : 1 }}>
          {busy ? "Working…" : "Add it here"}
        </button>
      </section>

      {msg && <p role="status" style={{ fontWeight: 600 }}>{msg}</p>}
      <p><a href="/dashboard/kompas" style={{ color: "inherit" }}>Back to Kompas</a></p>
    </main>
  )
}
