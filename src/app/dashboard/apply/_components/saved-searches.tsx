"use client"
import { useState, useEffect } from "react"

export type SavedSearch = {
  id: string; query: string; location: string; type: string; remote: boolean
  createdAt: number; lastRunAt: number; lastCount: number
}

export function SavedSearches({ onRun, currentQuery, currentLocation, currentType, currentRemote, currentCount }: {
  onRun: (s: SavedSearch) => void
  currentQuery: string; currentLocation: string; currentType: string; currentRemote: boolean
  currentCount: number
}) {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [open, setOpen] = useState(false)

  const load = () => {
    fetch("/api/apply/searches").then(r => r.json()).then(j => {
      if (j.searches) setSearches(j.searches)
    }).catch(() => {})
  }
  useEffect(load, [])

  const save = async () => {
    if (!currentQuery.trim()) return
    const r = await fetch("/api/apply/searches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: currentQuery, location: currentLocation, type: currentType, remote: currentRemote, count: currentCount }),
    })
    const j = await r.json()
    if (j.ok) load()
  }

  const remove = async (id: string) => {
    await fetch("/api/apply/searches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete: id }),
    })
    load()
  }

  const alreadySaved = searches.some(s =>
    s.query.toLowerCase() === currentQuery.toLowerCase() &&
    s.location.toLowerCase() === currentLocation.toLowerCase() &&
    s.type === currentType && s.remote === currentRemote
  )

  return (
    <div style={{ margin: "12px 0" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {!alreadySaved && currentQuery.trim() && (
          <button type="button" className="btn-ghost" onClick={save} style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }}>
            ☆ Save this search
          </button>
        )}
        {searches.length > 0 && (
          <button type="button" className="btn-ghost" onClick={() => setOpen(v => !v)} style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} aria-expanded={open}>
            Saved searches ({searches.length}) {open ? "▾" : "▸"}
          </button>
        )}
      </div>
      {open && searches.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {searches.map(s => (
            <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
              <button type="button" onClick={() => onRun(s)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{s.query}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {[s.location, s.type !== "All contracts" && s.type, s.remote && "Remote"].filter(Boolean).join(" · ") || "All contracts"}
                  {s.lastCount > 0 && ` · ${s.lastCount} last time`}
                </div>
              </button>
              <button type="button" className="btn-ghost" onClick={() => remove(s.id)} style={{ minHeight: 32, padding: "0 10px", fontSize: 12 }} aria-label={`Delete saved search ${s.query}`}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
