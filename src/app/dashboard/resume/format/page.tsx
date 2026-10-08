"use client"
import { useState } from "react"
import { RESUME_FORMATS, renderResumeHtml, type FormatId } from "@/lib/resume-formatting"

const SAMPLE = `ALEX MORGAN
Chicago, IL | alex.morgan@example.com | (312) 555-0199 | linkedin.com/in/alexmorgan
PROFESSIONAL SUMMARY
Product and operations leader with 12 years of experience building scalable teams, improving customer outcomes, and leading cross-functional programs.
PROFESSIONAL EXPERIENCE
Senior Director, Business Operations | Northstar Group | 2021–Present
Led strategic planning for a 45-person organization across four business units.
Reduced operating costs by 18% while improving on-time delivery by 23%.
Partnered with finance and engineering leadership to implement annual planning.
Director, Program Management | Meridian Systems | 2017–2021
Managed a $12M portfolio of enterprise initiatives across three regions.
Built performance dashboards and standardized quarterly reviews.
Senior Program Manager | Horizon Partners | 2013–2017
Launched customer programs that increased retention by 14%.
EDUCATION
MBA | State University | 2014
BS, Business Administration | State University | 2010
CORE COMPETENCIES
Strategy • Operations • Team Leadership • Financial Planning • Program Delivery`

export default function ResumeFormattingPage() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState("")
  const [template, setTemplate] = useState<FormatId>("jakes")
  const [html, setHtml] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(false)
  const [zoom, setZoom] = useState(false)
  async function call(output: "preview" | "docx") {
    setBusy(true); setError("")
    try {
      const data = new FormData()
      data.set("template", template); data.set("output", output)
      if (text) data.set("text", text)
      else if (file) data.set("file", file)
      else throw new Error("Choose a DOCX resume first.")
      const response = await fetch("/api/resume/format", { method: "POST", body: data })
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Formatting failed.") }
      if (output === "docx") {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = "MarketFit_Formatted_Resume.docx"; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        const result = await response.json()
        setText(result.text); setHtml(result.html)
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong.") }
    finally { setBusy(false) }
  }
  return <section style={{ maxWidth: 1150, margin: "0 auto", display: "grid", gap: 20 }}>
    <div><p style={{ fontSize: 12, opacity: .7 }}>RESUME DASHBOARD / FORMATTING</p><h1 style={{ fontSize: 30, fontWeight: 700 }}>Choose your resume style</h1><p>Browse real sample layouts first. Previewing and choosing a design is free. Upload only when you're ready.</p></div>
    {!selected ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 }}>
        {RESUME_FORMATS.map(t => <button type="button" key={t.id} onClick={() => { setTemplate(t.id); setZoom(true) }} style={{ textAlign: "left", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", padding: 12, borderRadius: 12, cursor: "pointer" }}>
          <div style={{ height: 265, overflow: "hidden", background: "#fff", border: "1px solid #ddd", position: "relative", pointerEvents: "none" }}>
            <iframe tabIndex={-1} title={t.label + " sample"} srcDoc={renderResumeHtml(SAMPLE, t.id)} sandbox="" scrolling="no" style={{ width: 816, height: 1056, border: 0, transform: "scale(.235)", transformOrigin: "top left", pointerEvents: "none" }} />
          </div>
          <strong style={{ display: "block", marginTop: 10 }}>{t.label}</strong><span style={{ fontSize: 12, opacity: .7 }}>{t.family} · View larger</span>
        </button>)}
      </div>
      {zoom && <div role="dialog" aria-modal="true" aria-label="Template preview" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.75)", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ background: "var(--surface)", color: "var(--text)", borderRadius: 14, padding: 16, width: "min(100%,850px)", maxHeight: "95vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}><strong>{RESUME_FORMATS.find(t => t.id === template)?.label} · Sample preview</strong><button onClick={() => setZoom(false)} aria-label="Close preview">✕ Close</button></div>
          <iframe title="Enlarged sample resume" srcDoc={renderResumeHtml(SAMPLE, template)} sandbox="" style={{ width: "100%", height: "min(68vh,850px)", background: "#fff", border: "1px solid #ddd" }} />
          <p style={{ fontSize: 12, opacity: .7 }}>Illustrative content only. Actual page count depends on your resume. This is a design preview, not an endorsement by the reference institution.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}><button onClick={() => setZoom(false)}>Keep browsing</button><button onClick={() => { setSelected(true); setZoom(false) }} style={{ background: "var(--accent)", color: "var(--bg)", borderRadius: 8, padding: "10px 18px", fontWeight: 700 }}>Use this style →</button></div>
        </div>
      </div>}
    </> : <>
      <button type="button" onClick={() => { setSelected(false); setHtml("") }} style={{ justifySelf: "start" }}>← Browse all templates</button>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>{RESUME_FORMATS.find(t => t.id === template)?.label}</h2>
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))" }}>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <label style={{ display: "grid", gap: 6 }}>Upload your resume (DOCX)
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { setFile(e.target.files?.[0] || null); setText(""); setHtml("") }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Approved template
          <select value={template} onChange={e => { setTemplate(e.target.value as FormatId); setHtml("") }} style={{ padding: 12, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", borderRadius: 8 }}>
            {RESUME_FORMATS.map(t => <option key={t.id} value={t.id}>{t.label} · {t.family}</option>)}
          </select>
        </label>
        <p style={{ fontSize: 13, opacity: .75 }}>{RESUME_FORMATS.find(t => t.id === template)?.description}. Inspired by the approved reference, not endorsed by its publisher.</p>
        <button disabled={busy} onClick={() => call("preview")} style={{ padding: 12, borderRadius: 8, background: "var(--accent)", color: "var(--bg)", fontWeight: 700 }}>{busy ? "Working…" : "Extract and preview"}</button>
        {text && <label style={{ display: "grid", gap: 6 }}>Check and correct extracted resume text
          <textarea value={text} onChange={e => { setText(e.target.value); setHtml("") }} rows={14} style={{ width: "100%", border: "1px solid var(--border-strong)", padding: 12, background: "var(--surface)", color: "var(--text)" }} />
        </label>}
        {text && <button disabled={busy} onClick={() => call("docx")} style={{ padding: 12, border: "1px solid var(--border-strong)", borderRadius: 8 }}>Download Word document</button>}
        {html && <button onClick={() => { const w = window.open("", "_blank"); if (!w) { setError("Allow popups to print your resume."); return } w.document.write(html); w.document.close(); w.focus(); w.print() }} style={{ padding: 12, border: "1px solid var(--border-strong)", borderRadius: 8 }}>Print or save as PDF</button>}
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      </div>
      <div style={{ minHeight: 560, border: "1px solid var(--border-strong)", background: "#eee", padding: 12, borderRadius: 10 }}>
        {html ? <iframe title="Resume preview" srcDoc={html} sandbox="" style={{ width: "100%", height: 700, background: "white", border: 0 }} /> : <p style={{ color: "#555", padding: 24 }}>Your resume preview will appear here.</p>}
      </div>
    </div>
    </>
  </section>
}
