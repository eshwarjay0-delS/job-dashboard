"use client"

// What the resumes made for jobs have in common, by kind of job: shown on Files once there is something to show.
// Read from /api/resumes/library; nothing here calls a model.
import { useEffect, useState } from "react"

type Kind = { email: string; category: string; jobs: number; files: number; common: { word: string; jobs: number }[]; recent: string[]; points: { text: string; jobs: number }[] }

export default function Learned({ refresh = 0 }: { refresh?: number }) {
  const [kinds, setKinds] = useState<Kind[]>([])
  const [commonAt, setCommonAt] = useState(3)
  const [open, setOpen] = useState("")

  useEffect(() => {
    let live = true
    fetch("/api/resumes/library", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (live && j?.ok) { setKinds(Array.isArray(j.kinds) ? j.kinds : []); setCommonAt(Number(j.commonAt) || 3) } })
      .catch(() => {})
    return () => { live = false }
  }, [refresh])

  if (!kinds.length) return null
  const chip = { display: "inline-block", padding: "3px 10px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13.5, color: "var(--text)" } as const

  return (
    <section aria-label="What your tailored resumes have in common" className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--text)", margin: 0 }}>Made for jobs, and what those jobs keep asking for</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        {kinds.map(k => {
          const id = `${k.email} / ${k.category}`
          const shown = open === id
          return (
            <div key={id}>
              <p style={{ margin: 0, fontSize: 15, color: "var(--text)" }}>
                <strong>{k.category}</strong>
                <span style={{ color: "var(--text-muted)" }}> · {k.files} saved · {k.jobs} job{k.jobs === 1 ? "" : "s"}{k.email && k.email !== "Needs email review" ? ` · ${k.email}` : ""}</span>
              </p>
              {k.common.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }} aria-label={`Asked for by ${commonAt} or more jobs`}>
                  {k.common.slice(0, 14).map(c => <span key={c.word} style={chip}>{c.word} <span style={{ color: "var(--text-muted)" }}>{c.jobs}</span></span>)}
                </div>
              ) : (
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
                  {k.jobs < commonAt ? `After ${commonAt} jobs of this kind, what they all ask for is listed here.` : `No word has been asked for by ${commonAt} of these jobs yet.`}
                </p>
              )}
              {(k.recent.length > 0 || k.points.length > 0) && (
                <button type="button" onClick={() => setOpen(shown ? "" : id)} aria-expanded={shown}
                  style={{ marginTop: 8, padding: 0, border: 0, background: "none", fontSize: 14, color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
                  {shown ? "Show less" : "Show the newest asks and the lines that were reused"}
                </button>
              )}
              {shown && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {k.recent.length > 0 && <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>Asked once or twice, newest first: {k.recent.join(", ")}</p>}
                  {k.points.slice(0, 8).map((p, i) => <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>{p.text} <span style={{ color: "var(--text-muted)" }}>({p.jobs} jobs)</span></p>)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
