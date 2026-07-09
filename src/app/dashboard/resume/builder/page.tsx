"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import MicButton from "../MicButton"

type Field = { idx: number; text: string }
type Role = { role: string; current: boolean; bullets: Field[] }
type Extra = { idx: number; text: string; section: string }
type Model = {
  header: { name: string; title: string; tagline: string; hasHeader: boolean }
  summary: string
  skills: Field[]
  roles: Role[]
  extras: Extra[]
  experienceCount: number
  bulletCount: number
}
type ResumeFile = { id: string; filename: string; filepath: string; category: string }

function getKey(): string {
  try { return (JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey) || "" } catch { return "" }
}

// One editable field (input or textarea) with an inline "✨ AI" assist box.
function EditField({ value, onChange, section, jd, multiline, placeholder }: {
  value: string; onChange: (v: string) => void; section: string; jd: string
  multiline?: boolean; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [instr, setInstr] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function run() {
    if (!instr.trim()) return
    setBusy(true); setErr("")
    try {
      const res = await fetch("/api/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, current: value, instruction: instr, jd, claudeKey: getKey() }),
      })
      const d = await res.json()
      if (!res.ok || d.error) { setErr(d.error || "Failed"); setBusy(false); return }
      onChange(d.text || value)
      setInstr(""); setOpen(false)
    } catch (e) { setErr(String(e)) }
    setBusy(false)
  }

  return (
    <div className="relative">
      <div className="flex gap-2 items-start">
        {multiline ? (
          <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={Math.max(2, Math.ceil(value.length / 80))}
            className="flex-1 text-sm rounded-lg border px-3 py-2 leading-relaxed resize-y"
            style={{ background: "var(--surface,#fff)", borderColor: "var(--border,#e5e7eb)", color: "var(--text,#111)" }} />
        ) : (
          <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="flex-1 text-sm rounded-lg border px-3 py-2"
            style={{ background: "var(--surface,#fff)", borderColor: "var(--border,#e5e7eb)", color: "var(--text,#111)" }} />
        )}
        <button type="button" onClick={() => setOpen(o => !o)} title="AI assist"
          className="flex-shrink-0 text-xs font-semibold rounded-lg px-2.5 py-2 border transition-colors"
          style={{ borderColor: "var(--border,#e5e7eb)", color: open ? "#0d9488" : "var(--text-soft,#6b7280)" }}>
          ✨ AI
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: "#99f6e4", background: "#f0fdfa" }}>
          <div className="flex gap-2">
            <input autoFocus value={instr} onChange={e => setInstr(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") run() }}
              placeholder={`Tell the AI how to change this ${section}…  (e.g. "add Kubernetes and make it tighter")`}
              className="flex-1 text-sm rounded-md border px-2.5 py-1.5" style={{ borderColor: "#5eead4" }} />
            <button type="button" onClick={run} disabled={busy}
              className="text-xs font-semibold rounded-md px-3 py-1.5 text-white" style={{ background: "#0d9488", opacity: busy ? 0.6 : 1 }}>
              {busy ? "…" : "Apply"}
            </button>
          </div>
          {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
        </div>
      )}
    </div>
  )
}

// Section-level mic + AI instruction — one per section, not per line.
function SectionAssist({ section, jd, onApply }: {
  section: string; jd: string; onApply: (instr: string) => Promise<void>
}) {
  const [instr, setInstr] = useState("")
  const [busy, setBusy]   = useState(false)
  const instrRef = useRef(instr)
  instrRef.current = instr

  function appendMic(chunk: string) {
    if (!chunk) return
    const prev = instrRef.current
    const sep = prev && !/\s$/.test(prev) ? " " : ""
    setInstr(prev + sep + chunk)
  }

  async function apply() {
    if (!instr.trim() || busy) return
    setBusy(true)
    await onApply(instr.trim())
    setInstr("")
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: "1px solid var(--border,#e5e7eb)" }}>
      <MicButton onText={appendMic} />
      <input
        value={instr}
        onChange={e => setInstr(e.target.value)}
        onKeyDown={e => e.key === "Enter" && apply()}
        placeholder={`AI instruction for this ${section}…`}
        className="flex-1 text-sm rounded-lg border px-3 py-2"
        style={{ background: "var(--surface,#fff)", borderColor: "var(--border,#e5e7eb)", color: "var(--text,#111)" }}
      />
      <button onClick={apply} disabled={busy || !instr.trim()}
        className="text-xs font-semibold rounded-lg px-3 py-2 text-white whitespace-nowrap"
        style={{ background: "#0d9488", opacity: (busy || !instr.trim()) ? 0.5 : 1 }}>
        {busy ? "Applying…" : "✨ Apply"}
      </button>
    </div>
  )
}

export default function BuilderPage() {
  const router = useRouter()
  const [resumes, setResumes] = useState<ResumeFile[]>([])
  const [selected, setSelected] = useState("")
  const [jd, setJd] = useState("")
  const [model, setModel] = useState<Model | null>(null)
  const [filename, setFilename] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [notice, setNotice] = useState("")
  const [tailored, setTailored] = useState(false)

  const load = useCallback(async (filepath: string, jdText: string) => {
    if (!filepath) return
    setLoading(true); setErr(""); setNotice("")
    try {
      const res = await fetch("/api/build/load", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filepath, jd: jdText, claudeKey: getKey() }),
      })
      const d = await res.json()
      if (!res.ok || d.error) { setErr(d.error || "Load failed"); setLoading(false); return }
      setModel(d.model); setFilename(d.filename); setTailored(!!d.tailored)
      setNotice(d.tailored ? "Loaded and tailored to your JD — edit anything below." : "Loaded — edit anything below.")
    } catch (e) { setErr(String(e)) }
    setLoading(false)
  }, [])

  useEffect(() => {
    let jdVal = ""
    try { jdVal = sessionStorage.getItem("careerkit_jd") || "" } catch {}
    setJd(jdVal)
    fetch("/api/resumes").then(r => r.json()).then(d => setResumes(d.files || [])).catch(() => {})
    const fp = new URLSearchParams(window.location.search).get("filepath") || ""
    if (fp) { setSelected(fp); load(fp, jdVal) }
  }, [load])

  function patch(p: Partial<Model>) { setModel(m => (m ? { ...m, ...p } : m)) }
  function setSkill(i: number, text: string) { setModel(m => m ? { ...m, skills: m.skills.map((s, j) => j === i ? { ...s, text } : s) } : m) }
  function setBullet(ri: number, bi: number, text: string) {
    setModel(m => m ? { ...m, roles: m.roles.map((r, j) => j === ri ? { ...r, bullets: r.bullets.map((b, k) => k === bi ? { ...b, text } : b) } : r) } : m)
  }
  function setExtra(i: number, text: string) { setModel(m => m ? { ...m, extras: m.extras.map((e, j) => j === i ? { ...e, text } : e) } : m) }

  async function retailor() {
    if (!selected || !jd) return
    setLoading(true); setErr(""); setNotice("")
    try {
      const res = await fetch("/api/tailor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd, filepath: selected, claudeKey: getKey() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setErr(data.error || "Tailor failed"); setLoading(false); return }
      try { sessionStorage.setItem("careerkit_last_result", JSON.stringify(data)) } catch {}
      try { sessionStorage.setItem("careerkit_jd", jd) } catch {}
      const p = new URLSearchParams({
        token: data.token || "",
        score: String(data.score ?? ""),
        scoreBefore: String(data.score_before ?? ""),
        resumeName: data.matched?.filename || filename,
        category: data.matched?.category || "",
        filepath: data.matched?.filepath || selected,
        changes: JSON.stringify(data.what_changed || []),
        feedback: JSON.stringify(data.applied_feedback || []),
      })
      router.push(`/dashboard/resume/result?${p}`)
    } catch (e) { setErr(String(e)) }
    setLoading(false)
  }

  async function save() {
    if (!model || !selected) return
    setSaving(true); setErr(""); setNotice("")
    const edits = {
      headline: { title: model.header.title, tagline: model.header.tagline },
      summary: model.summary,
      skills: model.skills,
      bullets: model.roles.flatMap(r => r.bullets),
      extras: model.extras,
    }
    try {
      const res = await fetch("/api/build/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filepath: selected, edits }),
      })
      const d = await res.json()
      if (!res.ok || d.error) { setErr(d.error || "Save failed"); setSaving(false); return }
      const a = document.createElement("a")
      a.href = `/api/tailor/file?token=${encodeURIComponent(d.token)}&fmt=docx&name=${encodeURIComponent(d.filename || filename)}`
      a.download = `${d.filename || filename}.docx`
      document.body.appendChild(a); a.click(); a.remove()
      setNotice("Saved ✓ — your resume downloaded.")
    } catch (e) { setErr(String(e)) }
    setSaving(false)
  }

  // group resumes by top-level folder for the selector
  const grouped = resumes.reduce<Record<string, ResumeFile[]>>((acc, f) => {
    const top = f.category.split("/")[0].trim() || "Resumes"
    ;(acc[top] ||= []).push(f); return acc
  }, {})

  const Section = ({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) => (
    <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--surface,#fff)", borderColor: "var(--border,#e5e7eb)" }}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text,#111)" }}>{title}</h2>
        {hint && <span className="text-xs" style={{ color: "var(--text-soft,#9ca3af)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text,#111)" }}>Resume Builder</h1>
          <p className="text-sm" style={{ color: "var(--text-soft,#6b7280)" }}>Pick a role template, everything pre-fills — edit anything, or hit ✨ AI on a field.</p>
        </div>
        <button onClick={() => router.push("/dashboard/resume")} className="text-sm" style={{ color: "var(--text-soft,#6b7280)" }}>← Resumes</button>
      </div>

      {/* template selector */}
      <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--surface,#fff)", borderColor: "var(--border,#e5e7eb)" }}>
        <label className="text-sm font-semibold block mb-2" style={{ color: "var(--text,#111)" }}>Role template (your resume)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={selected} onChange={e => { setSelected(e.target.value); load(e.target.value, jd) }}
            className="flex-1 text-sm rounded-lg border px-3 py-2" style={{ borderColor: "var(--border,#e5e7eb)", background: "var(--surface,#fff)", color: "var(--text,#111)" }}>
            <option value="">— Select a resume —</option>
            {Object.entries(grouped).map(([top, files]) => (
              <optgroup key={top} label={top}>
                {files.map(f => <option key={f.id} value={f.filepath}>{f.category.split("/").slice(1).join(" / ") || f.category} — {f.filename}</option>)}
              </optgroup>
            ))}
          </select>
          {selected && (
            <button onClick={retailor} disabled={loading || !jd || !selected}
              title={jd ? "Tailor and preview the result" : "Paste a JD on the My Resume page first"}
              className="text-sm font-semibold rounded-lg px-4 py-2 text-white whitespace-nowrap" style={{ background: "var(--accent)", opacity: (loading || !jd || !selected) ? 0.5 : 1 }}>
              {loading ? "Tailoring…" : "↻ Re-tailor to JD"}
            </button>
          )}
        </div>
        {jd && <p className="text-xs mt-2" style={{ color: "var(--text-soft,#9ca3af)" }}>JD detected from My Resume — selecting a template loads it; “Re-tailor to JD” fills the JD-matched content.</p>}
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-2.5 mb-4">{err}</div>}
      {notice && <div className="rounded-lg border border-teal-200 bg-teal-50 text-teal-700 text-sm px-4 py-2.5 mb-4">{notice}</div>}
      {loading && !model && <div className="text-sm py-10 text-center" style={{ color: "var(--text-soft,#6b7280)" }}>Loading resume…</div>}

      {model && (
        <>
          {/* header */}
          <Section title="Header" hint={`${model.experienceCount} experience${model.experienceCount === 1 ? "" : "s"} • ${model.bulletCount} bullets`}>
            <p className="text-sm mb-3" style={{ color: "var(--text-soft,#6b7280)" }}>
              <span className="font-semibold" style={{ color: "var(--text,#111)" }}>{model.header.name || "(name)"}</span> — name & contact are kept automatically.
            </p>
            <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-soft,#6b7280)" }}>Title</label>
            <div className="mb-3"><EditField section="title" jd={jd} value={model.header.title} onChange={v => patch({ header: { ...model.header, title: v } })} placeholder="e.g. Application Security Engineer" /></div>
            <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-soft,#6b7280)" }}>Identity strip (• separated)</label>
            <EditField section="tagline" jd={jd} value={model.header.tagline} onChange={v => patch({ header: { ...model.header, tagline: v } })} placeholder="Application Security • Secure Code Review • SAST/DAST • CI/CD • AWS" />
          </Section>

          {/* summary */}
          <Section title="Professional Summary" hint={`${model.summary.trim().split(/\s+/).filter(Boolean).length} words`}>
            <EditField section="summary" jd={jd} multiline value={model.summary} onChange={v => patch({ summary: v })} placeholder="One tight 3-4 sentence paragraph…" />
            <SectionAssist section="summary" jd={jd} onApply={async instr => {
              const res = await fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ section: "summary", current: model.summary, instruction: instr, jd, claudeKey: getKey() }) })
              const d = await res.json()
              if (d.text) patch({ summary: d.text })
            }} />
          </Section>

          {/* skills */}
          <Section title="Technical Skills" hint={`${model.skills.length} lines`}>
            <div className="space-y-2">
              {model.skills.map((s, i) => (
                <EditField key={s.idx} section="skill line" jd={jd} multiline value={s.text} onChange={v => setSkill(i, v)} />
              ))}
              {model.skills.length === 0 && <p className="text-sm" style={{ color: "var(--text-soft,#9ca3af)" }}>No separate skills section detected.</p>}
            </div>
            {model.skills.length > 0 && (
              <SectionAssist section="skills" jd={jd} onApply={async instr => {
                const results = await Promise.all(model.skills.map(s =>
                  fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ section: "skill line", current: s.text, instruction: instr, jd, claudeKey: getKey() }) })
                    .then(r => r.json()).then(d => d.text || s.text)
                ))
                setModel(m => m ? { ...m, skills: m.skills.map((s, i) => ({ ...s, text: results[i] })) } : m)
              }} />
            )}
          </Section>

          {/* experience */}
          {model.roles.map((r, ri) => (
            <Section key={ri} title={r.role === "Projects" ? "Projects" : `Experience ${ri + 1}`} hint={r.current ? "current role" : undefined}>
              <p className="text-sm font-semibold mb-3" style={{ color: "var(--text,#111)" }}>{r.role}</p>
              <div className="space-y-2">
                {r.bullets.map((b, bi) => (
                  <EditField key={b.idx} section="bullet" jd={jd} multiline value={b.text} onChange={v => setBullet(ri, bi, v)} />
                ))}
              </div>
              {r.bullets.length > 0 && (
                <SectionAssist section="role" jd={jd} onApply={async instr => {
                  const results = await Promise.all(r.bullets.map(b =>
                    fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ section: "bullet", current: b.text, instruction: instr, jd, claudeKey: getKey() }) })
                      .then(res => res.json()).then(d => d.text || b.text)
                  ))
                  setModel(m => m ? { ...m, roles: m.roles.map((role, j) => j === ri
                    ? { ...role, bullets: role.bullets.map((b, k) => ({ ...b, text: results[k] })) }
                    : role) } : m)
                }} />
              )}
            </Section>
          ))}

          {/* extras (certs / education) */}
          {model.extras.length > 0 && (
            <Section title="Certifications & Education">
              <div className="space-y-2">
                {model.extras.map((e, i) => (
                  <div key={e.idx}>
                    <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--text-soft,#9ca3af)" }}>{e.section}</span>
                    <EditField section="line" jd={jd} value={e.text} onChange={v => setExtra(i, v)} />
                  </div>
                ))}
              </div>
              <SectionAssist section="certifications & education" jd={jd} onApply={async instr => {
                const results = await Promise.all(model.extras.map(e =>
                  fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ section: "line", current: e.text, instruction: instr, jd, claudeKey: getKey() }) })
                    .then(r => r.json()).then(d => d.text || e.text)
                ))
                setModel(m => m ? { ...m, extras: m.extras.map((e, i) => ({ ...e, text: results[i] })) } : m)
              }} />
            </Section>
          )}
        </>
      )}

      {/* sticky save bar */}
      {model && (
        <div className="fixed bottom-0 left-0 right-0 border-t px-4 py-3" style={{ background: "var(--surface,#fff)", borderColor: "var(--border,#e5e7eb)" }}>
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <span className="text-sm" style={{ color: "var(--text-soft,#6b7280)" }}>{tailored ? "Tailored draft" : "Draft"} · {filename}</span>
            <button onClick={save} disabled={saving} className="text-sm font-bold rounded-lg px-6 py-2.5 text-white" style={{ background: "#0d9488", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save & Generate .docx"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
