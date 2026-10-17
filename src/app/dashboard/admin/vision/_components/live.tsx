"use client"

import { useEffect, useState } from "react"

// Live Plan & Vision status — fetched fresh on every view. The decision & delivery
// journal is the single source of truth (ideas, prompts, wishes, approvals,
// delivery state, blockers, evidence, next steps); the commit feed reads the live
// git log. Approval, delivery and verification stay separate.

type JournalEntry = {
  id: string
  area: string
  updated: string
  title: string
  approval: string
  delivery: string
  detail: string
  evidence: string
  next: string
  commit?: string
}
type Commit = { hash: string; date: string; message: string; product: string }

const DELIVERY_META: Record<string, { label: string; color: string; bg: string }> = {
  "in progress": { label: "Building now", color: "#0f5132", bg: "#d1e7dd" },
  blocked:       { label: "Blocked · needs owner", color: "#842029", bg: "#f8d7da" },
  planned:       { label: "Queued", color: "#055160", bg: "#cff4fc" },
  deployed:      { label: "Shipped", color: "#41464b", bg: "#e2e3e5" },
  superseded:    { label: "Superseded", color: "#6c757d", bg: "#f0f0f0" },
}
const APPROVAL_META: Record<string, { label: string; color: string }> = {
  approved:   { label: "approved", color: "#0f5132" },
  proposed:   { label: "proposed — awaiting decision", color: "#664d03" },
  unapproved: { label: "unapproved", color: "#842029" },
  rejected:   { label: "rejected", color: "#6c757d" },
}

function EntryRow({ e }: { e: JournalEntry }) {
  const d = DELIVERY_META[e.delivery] ?? DELIVERY_META.planned
  const a = APPROVAL_META[e.approval] ?? APPROVAL_META.proposed
  return (
    <li style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: d.bg, color: d.color, whiteSpace: "nowrap" }}>
          {d.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: a.color }}>{a.label}</span>
        <span style={{ fontSize: 12, color: "var(--text-soft)" }}>{e.updated.slice(0, 10)}</span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: e.delivery === "in progress" ? 700 : 400, color: "var(--text)", lineHeight: 1.5 }}>{e.title}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, marginTop: 3 }}>{e.detail}</div>
      {e.next && <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginTop: 3 }}><strong>Next:</strong> {e.next}</div>}
    </li>
  )
}

export default function VisionLive({ product }: { product: string }) {
  const [data, setData] = useState<{ journal: JournalEntry[]; commits: Commit[]; visionUpdated: Record<string, string | null>; generatedAt: string; journalUpdated: string } | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/vision/live", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  if (error) return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Live status unavailable right now ({error}). The journal below is still current.</p>
  if (!data) return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Reading live status…</p>

  const pid = product === "apply" ? "applications" : product
  const entries = data.journal.filter(e => pid === "all" || e.area === pid || e.area === "all")
  const commits = data.commits.filter(c => pid === "all" || c.product === pid || c.product === "all").slice(0, 12)
  const updated = data.visionUpdated[pid === "applications" ? "apply" : pid]
  const ago = updated ? Math.max(0, Math.round((Date.now() - new Date(updated).getTime()) / 3600000)) : null

  const building = entries.filter(e => e.delivery === "in progress")
  const blocked = entries.filter(e => e.delivery === "blocked")
  const queued = entries.filter(e => e.delivery === "planned" && e.approval === "approved")
  const awaiting = entries.filter(e => (e.approval === "proposed" || e.approval === "unapproved") && e.delivery !== "rejected" && e.delivery !== "superseded")
  const shipped = entries.filter(e => e.delivery === "deployed").slice(0, 8)
  const notDoing = entries.filter(e => e.approval === "rejected" || e.delivery === "superseded")

  const sections: { title: string; items: JournalEntry[] }[] = [
    { title: "Building now", items: building },
    { title: "Blocked — needs the owner", items: blocked },
    { title: "Approved — queued", items: queued },
    { title: "Proposed / unapproved — awaiting decision", items: awaiting },
    { title: "Recently shipped", items: shipped },
    { title: "Not doing", items: notDoing },
  ]

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
        Live as of {new Date(data.generatedAt).toLocaleString()} · journal updated{" "}
        {new Date(data.journalUpdated).toLocaleString()} · vision doc{" "}
        {ago === null ? "freshness unknown" : ago < 1 ? "updated within the hour" : `updated ${ago}h ago`}
      </p>
      {sections.map(s => s.items.length > 0 && (
        <section key={s.title} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>{s.title}</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {s.items.map(e => <EntryRow key={e.id} e={e} />)}
          </ul>
        </section>
      ))}
      {commits.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>Recent commits</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {commits.map(c => (
              <li key={c.hash} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13, alignItems: "baseline" }}>
                <code style={{ color: "var(--text-soft)", fontSize: 12, whiteSpace: "nowrap" }}>{c.hash}</code>
                <span style={{ color: "var(--text)", flex: 1 }}>{c.message}</span>
                <span style={{ color: "var(--text-soft)", fontSize: 12, whiteSpace: "nowrap" }}>{c.date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
