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
  enginePolicy?: Record<string, unknown> | null
}

const safeJson = (s: string | null): unknown => {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

/** The browser-side pros: sessions, Q&A, prepared answers, question bank, learned vocab. */
function gatherBrowserPros(): BlendFile["browser"] {
  const out: BlendFile["browser"] = { sessions: [], qa: [], prepared: [], qbank: [], vocab: [] }
  // perfACT stores completed replies as session-log events (t:"answer"),
  // not necessarily on the session object itself. Keep alternative replies
  // to the same question as separate examples, preserving their pause markers.
  const collectAnswer = (item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return
    const row = item as Record<string, unknown>
    if (row.noQuestion || row.busy || row.degraded || row.state === "mis-heard" || row.state === "both-sides") return
    if (row.t && row.t !== "answer") return
    const q = String(row.q ?? row.question ?? row.derived ?? "").trim()
    const raw = row.a ?? row.answer ?? row.text
    const a = (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string").join("\n") : typeof raw === "string" ? raw : "").trim()
    if (q && a.length > 20) out.qa.push({ q: q.slice(0, 500), a: a.slice(0, 4000) })
  }
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
          for (const slot of [o.qa, o.turns, o.answers]) {
            if (Array.isArray(slot)) for (const entry of slot) collectAnswer(entry)
          }
        }
      } else if (key.startsWith("perfact.log.") && v && typeof v === "object") {
        if (Array.isArray(v)) for (const event of v) collectAnswer(event)
        else collectAnswer(v)
      } else if (/^perfact\.(dossier|levels)\./.test(key) && v && typeof v === "object") {
        const o = v as Record<string, unknown>
        const q = String(o.q ?? o.question ?? o.title ?? ("Prepared material from " + key)).trim()
        const engineer = o.engineer && typeof o.engineer === "object" ? (o.engineer as Record<string, unknown>).prose : ""
        const director = o.director && typeof o.director === "object" ? (o.director as Record<string, unknown>).prose : ""
        for (const draft of [o.a, o.answer, o.text, o.md, o.content, engineer, director]) {
          if (typeof draft === "string" && draft.trim().length > 20)
            out.prepared.push({ q: q.slice(0, 500), a: draft.trim().slice(0, 4000) })
        }
      } else if (key === "perfact.qbank" && v && typeof v === "object") {
        const items = (v as Record<string, unknown>).items
        if (Array.isArray(items)) for (const it of items) {
          const row = it && typeof it === "object" && !Array.isArray(it) ? it as Record<string, unknown> : null
          const t = String(row ? (row.text ?? row.question ?? row.q ?? "") : typeof it === "string" ? it : "").trim()
          if (t && t.length >= 8) out.qbank.push(t.slice(0, 300))
        }
      }
    }
    // MarketFit's learned vocabulary — a pro: words the engine learned to hear.
    const learned = safeJson(localStorage.getItem("mf_flow_learned"))
    if (Array.isArray(learned)) out.vocab = learned.map(String).filter(Boolean).slice(0, 200)
    // Dedupe exact answer pairs only. A regenerated answer to the same
    // question may be more natural, and the original should still survive.
    const seen = new Set<string>()
    out.qa = out.qa.filter((t) => {
      const k = t.q.toLowerCase().replace(/\s+/g, " ") + "\u0000" + t.a.toLowerCase().replace(/\s+/g, " ")
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    out.qbank = [...new Set(out.qbank.map(q => q.replace(/\s+/g, " ").trim()))]
  } catch { /* a broken store exports nothing rather than breaking the page */ }
  return out
}

export default function KompasMovePage() {
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState("")
  const [selectedFile, setSelectedFile] = useState<BlendFile | null>(null)

  async function doExport() {
    setBusy(true); setMsg("")
    try {
      const browser = gatherBrowserPros()
      // Completeness matters more than pretending a partial download worked.
      // The old route exported only the newest 50 sessions. Keep every page
      // and stop on any failed request rather than silently dropping history.
      let server: Record<string, unknown> | null = null
      let expected = -1
      for (let page = 0; page < 1000; page++) {
        const r = await fetch(`/api/kompas/blend/export?page=${page}`, { cache: "no-store" })
        if (!r.ok) throw new Error(r.status === 401
          ? "Sign in to MarketFit to export the full server dossier. The separate original-data port still works offline."
          : "The server dossier export did not finish. No incomplete blend was downloaded.")
        const data = await r.json() as Record<string, unknown>
        const rows = Array.isArray(data.sessions) ? data.sessions : []
        if (Number(data.page) !== page || typeof data.totalSessions !== "number")
          throw new Error("The server sent an incompatible dossier page. No incomplete blend was downloaded.")
        if (expected < 0) expected = data.totalSessions
        else if (expected !== data.totalSessions)
          throw new Error("The dossier changed during export. Retry so no sessions are omitted.")
        if (!server) server = { ...data, sessions: [] as unknown[] }
        ;(server.sessions as unknown[]).push(...rows)
        if (data.nextPage === null) break
        if (data.nextPage !== page + 1 || page === 999)
          throw new Error("The dossier is too large or paging stopped unexpectedly. No incomplete blend was downloaded.")
      }
      if (!server || (server.sessions as unknown[]).length !== expected)
        throw new Error("Not every server session arrived. The blend was not downloaded.")
      ;(server.counts as Record<string, number>) = {
        sessions: expected,
        qa: (server.sessions as Array<{ qa?: unknown[] }>).reduce((n, row) => n + (Array.isArray(row.qa) ? row.qa.length : 0), 0),
        fields: Object.keys((server.fields || {}) as Record<string, unknown>).length,
      }
      const manifest = await fetch("/api/kompas/migration/manifest", { cache: "no-store" })
      if (!manifest.ok) throw new Error("The engine workflow manifest could not be verified. Retry the complete export.")
      const enginePolicy = await manifest.json() as Record<string, unknown>
      if (enginePolicy.kind !== "kompas-engine-policy")
        throw new Error("Invalid engine workflow manifest. No incomplete blend was downloaded.")
      const file: BlendFile = {
        kind: "kompas-blend", version: 1,
        exportedAt: new Date().toISOString(), browser, server, enginePolicy,
      }
      const blob = new Blob([JSON.stringify(file)], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `kompas-blend-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      const n = browser.qa.length + browser.prepared.length
      setMsg(`Exported ${n} answers, ${browser.qbank.length} bank questions, ${browser.vocab.length} learned words${server ? " + the server dossier" : ""} — pros only.`)
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Export failed. Try again.")
    } finally { setBusy(false) }
  }

  async function onFile(f: File | undefined) {
    setPlan(""); setMsg(""); setSelectedFile(null)
    if (!f) return
    if (f.size > 20 * 1024 * 1024) { setPlan("That file is too large for the blend import. Use the full local archive port instead."); return }
    try {
      const file = JSON.parse(await f.text()) as BlendFile
      if (!file || file.kind !== "kompas-blend" || file.version !== 1) { setPlan("This is not a supported Kompas blend file. For a full original archive, use the browser data port below."); return }
      const b = file.browser || ({} as BlendFile["browser"])
      const s = (file.server || {}) as Record<string, unknown>
      const sCounts = (s.counts || {}) as Record<string, number>
      setPlan(
        `This file holds ${(b.qa || []).length} answers, ${(b.prepared || []).length} prepared answers, ` +
        `${(b.qbank || []).length} bank questions, ${(b.vocab || []).length} learned words from the browser, ` +
        `and ${sCounts.qa || 0} answers in ${sCounts.sessions || 0} server sessions. ` +
        `Importing adds what's new — nothing here is replaced.`
      )
      setSelectedFile(file)
    } catch { setPlan("This file couldn't be read.") }
  }

  async function doImport() {
    const file = selectedFile
    if (!file) return
    setBusy(true); setMsg("")
    try {
      // The authenticated import takes the file as a whole, including
      // historical browser Q&A and prepared answers. None is silently discarded.
      let serverMsg = "server dossier was not updated"
      const r = await fetch("/api/kompas/blend/import", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(file),
      }).catch(() => null)
      if (r) {
        const d = await r.json().catch(() => ({})) as Record<string, unknown>
        if (r.ok) serverMsg = `server dossier gained ${d.qaAdded || 0} Q&A across ${d.sessionsAdded || 0} sessions; ${d.preparedAdded || 0} prepared examples`
        else serverMsg = `server import not completed: ${String(d.error || (r.status === 401 ? "sign in to MarketFit" : "retry later"))}`
      }
      // The local merge is independent of server authentication and always
      // keeps existing sessions/questions. It never replaces existing IDs.
      const b = file.browser
      let sessionsAdded = 0, questionsAdded = 0, wordsAdded = 0
      if (b && Array.isArray(b.sessions)) {
        const prior = safeJson(localStorage.getItem("perfact.sessions"))
        const sessions = Array.isArray(prior) ? [...prior] : []
        const ids = new Set(sessions.map(x => String((x as Record<string, unknown>)?.id || "")).filter(Boolean))
        for (const row of b.sessions.slice(0, 2000)) {
          if (!row || typeof row !== "object" || Array.isArray(row)) continue
          const id = String((row as Record<string, unknown>).id || "")
          if (!id || id.length > 100 || ids.has(id)) continue
          sessions.push(row); ids.add(id); sessionsAdded++
        }
        if (sessionsAdded) localStorage.setItem("perfact.sessions", JSON.stringify(sessions))
      }
      if (b && Array.isArray(b.qbank)) {
        const prior = safeJson(localStorage.getItem("perfact.qbank"))
        const bank = prior && typeof prior === "object" && !Array.isArray(prior)
          ? prior as Record<string, unknown> : { items: [] as unknown[] }
        const items = Array.isArray(bank.items) ? [...bank.items] : []
        const normalized = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()
        const have = new Set(items.map(x => normalized(String((x as Record<string, unknown>)?.text || ""))))
        for (const q of b.qbank.slice(0, 3000)) {
          if (typeof q !== "string" || q.length < 8 || q.length > 500) continue
          const key = normalized(q)
          if (!key || have.has(key)) continue
          items.push({ id: `blend-${Date.now()}-${questionsAdded}`, text: q.slice(0, 300), category: "Technical",
            company: "", role: "", source: "Kompas blend", createdAt: Date.now(), practiced: 0, answer: "" })
          have.add(key); questionsAdded++
        }
        if (questionsAdded) localStorage.setItem("perfact.qbank", JSON.stringify({ ...bank, items }))
      }
      if (b && Array.isArray(b.vocab)) {
        const cur = safeJson(localStorage.getItem("mf_flow_learned"))
        const have = new Set(Array.isArray(cur) ? cur.map(String) : [])
        for (const w of b.vocab.slice(0, 500)) {
          if (typeof w !== "string" || !w.trim() || w.length > 120) continue
          if (!have.has(w.trim())) { have.add(w.trim()); wordsAdded++ }
        }
        if (wordsAdded) localStorage.setItem("mf_flow_learned", JSON.stringify([...have].slice(0, 1000)))
      }
      setMsg(`Browser merged ${sessionsAdded} sessions, ${questionsAdded} bank questions and ${wordsAdded} learned words; ${serverMsg}. Original documents, transcripts and IndexedDB pages require the complete browser transfer below.`)
      setSelectedFile(null)
      setPlan("")
    } catch {
      setMsg("Import failed. Try again.")
    } finally { setBusy(false) }
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 64px" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 10px" }}>Blend your Kompas data</h1>
      <p style={{ color: "var(--muted, #666)", margin: "0 0 12px" }}>
        This curated blend holds useful interview answers, prepared examples,
        question-bank entries and learned vocabulary. The export combines data
        from this browser with your signed-in MarketFit dossier, and importing
        sends the approved blend back to your account. Keep the original
        full-fidelity archive separately, including transcripts and documents.
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
          Choose a curated blend file. The server adds new grounded examples only when you are signed in; the local session and question-bank merge never replaces existing entries.
        </p>
        <input type="file" accept="application/json,.json" aria-label="The Kompas blend file"
          onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "block", margin: "10px 0 12px" }} />
        {plan && <p style={{ minHeight: "1.2em" }}>{plan}</p>}
        <button onClick={doImport} disabled={busy || !selectedFile}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer", opacity: busy || !plan ? 0.45 : 1 }}>
          {busy ? "Working…" : "Add it here"}
        </button>
      </section>

      {msg && <p role="status" style={{ fontWeight: 600 }}>{msg}</p>}
      <section style={{ border: "1px solid var(--border, #ddd)", borderRadius: 12, padding: "18px 20px", margin: "18px 0" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Preserve every original record first</h2>
        <p style={{ color: "var(--muted, #666)", marginBottom: 10 }}>
          The full browser transfer preserves all original Kompas sessions, transcripts, Question Bank data,
          prepared pages, resumes and documents, including IndexedDB files. Export on the old perfACT
          address, then import on this MarketFit address. Keep both download files as a backup.
        </p>
        <p><a href="https://perfact-ten.vercel.app/move.html" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>1. Export originals from perfACT</a></p>
        <p><a href="/kompas/move.html" style={{ color: "inherit" }}>2. Import originals into MarketFit</a></p>
      </section>
      <p><a href="/dashboard/kompas" style={{ color: "inherit" }}>Back to Kompas</a></p>
    </main>
  )
}
