"use client"

import { useEffect, useState } from "react"

// Live Plan & Vision status — fetched fresh on every view. Wishes from
// docs/wishes.md, commits from live git log, vision freshness from docs mtimes.

type Wish = { product: string; status: string; title: string; date: string | null; note: string }
type Commit = { hash: string; date: string; message: string; product: string }

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  building: { label: "Building now", color: "#0f5132", bg: "#d1e7dd" },
  approved: { label: "Approved · queued", color: "#055160", bg: "#cff4fc" },
  proposed: { label: "Proposed · awaiting approval", color: "#664d03", bg: "#fff3cd" },
  blocked:  { label: "Blocked · needs owner", color: "#842029", bg: "#f8d7da" },
  done:     { label: "Shipped", color: "#41464b", bg: "#e2e3e5" },
  rejected: { label: "Not doing", color: "#6c757d", bg: "#f0f0f0" },
}

function WishRow({ w }: { w: Wish }) {
  const meta = STATUS_META[w.status] ?? STATUS_META.proposed
  return (
    <li style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)", alignItems: "baseline" }}>
      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: meta.bg, color: meta.color, whiteSpace: "nowrap" }}>
        {meta.label}
      </span>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        <span style={{ color: "var(--text)", fontWeight: w.status === "building" ? 700 : 400 }}>{w.title}</span>
        {w.note && <span style={{ color: "var(--text-muted)" }}> — {w.note}</span>}
        {w.date && <span style={{ color: "var(--text-soft)", fontSize: 12 }}> · {w.date}</span>}
      </div>
    </li>
  )
}

export default function VisionLive({ product }: { product: string }) {
  const [data, setData] = useState<{ wishes: Wish[]; commits: Commit[]; visionUpdated: Record<string, string | null>; generatedAt: string } | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/vision/live", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  if (error) return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Live status unavailable right now ({error}). The vision documents below are still current.</p>
  if (!data) return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Reading live status…</p>

  const pid = product === "applications" ? "apply" : product
  const wishes = data.wishes.filter(w => w.product === pid || pid === "all")
  const commits = data.commits.filter(c => pid === "all" || c.product === pid || c.product === "general").slice(0, 12)
  const by = (s: string) => wishes.filter(w => w.status === s)
  const updated = data.visionUpdated[pid]
  const ago = updated ? Math.max(0, Math.round((Date.now() - new Date(updated).getTime()) / 3600000)) : null

  const sections: { key: string; title: string; items: Wish[] }[] = [
    { key: "building", title: "Building now", items: by("building") },
    { key: "blocked", title: "Blocked — needs the owner", items: by("blocked") },
    { key: "approved", title: "Approved — queued", items: by("approved") },
    { key: "proposed", title: "Proposed — awaiting approval", items: by("proposed") },
    { key: "done", title: "Recently shipped", items: by("done").slice(0, 8) },
  ]

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
        Live as of {new Date(data.generatedAt).toLocaleString()} · vision doc{" "}
        {ago === null ? "freshness unknown" : ago < 1 ? "updated within the hour" : `updated ${ago}h ago`} ·{" "}
        <span style={{ fontWeight: 600 }}>wishes ledger: docs/wishes.md</span>
      </p>
      {sections.map(s => s.items.length > 0 && (
        <section key={s.key} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>{s.title}</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {s.items.map((w, i) => <WishRow key={`${w.title}-${i}`} w={w} />)}
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
