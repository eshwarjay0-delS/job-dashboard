"use client"
import { useState } from "react"
import { RESUME_FORMATS, renderResumeHtml, type FormatId } from "@/lib/resume-formatting"

const SAMPLE = `ALEX MORGAN
Software Engineer | alex.morgan@example.com | (555) 010-2048 | Austin, TX
PROFESSIONAL SUMMARY
Software engineer building secure, reliable web applications and cloud services.
EXPERIENCE
Software Engineer | Northstar Labs | 2023–Present
• Built APIs and improved response times by 35% through query optimization.
• Collaborated with product and security teams to ship accessible features.
Associate Developer | Cedar Systems | 2021–2023
• Automated release checks and reduced deployment errors.
EDUCATION
B.S. Computer Science | State University | 2021
TECHNICAL SKILLS
TypeScript, Python, React, SQL, AWS, CI/CD
PROJECTS
Developer Portal | Built an internal dashboard for service health and documentation.`

export default function ResumeFormattingPage() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState("")
  const [template, setTemplate] = useState<FormatId>("jakes")
  const [html, setHtml] = useState("")
  const previewHtml = html || renderResumeHtml(text || SAMPLE, template)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
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
  return <section style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 }}>
    <div><p style={{ fontSize: 12, opacity: .7 }}>RESUME DASHBOARD / FORMATTING</p><h1 style={{ fontSize: 30, fontWeight: 700 }}>Resume Formatting</h1><p>Explore every layout with sample content before uploading. Then upload once, review your text, and download. Your career facts stay yours.</p></div>
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))" }}>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <label style={{ display: "grid", gap: 6 }}>Upload your resume when ready (DOCX)
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { setFile(e.target.files?.[0] || null); setText(""); setHtml("") }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Approved template
          <select value={template} onChange={e => { setTemplate(e.target.value as FormatId); setHtml("") }} style={{ padding: 12, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", borderRadius: 8 }}>
            {RESUME_FORMATS.map(t => <option key={t.id} value={t.id}>{t.label} · {t.family}</option>)}
          </select>
        </label>
        <p style={{ fontSize: 13, opacity: .75 }}>{RESUME_FORMATS.find(t => t.id === template)?.description}. Inspired by the approved reference, not endorsed by its publisher.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }} aria-label="Resume template gallery">{RESUME_FORMATS.map(t => <button key={t.id} type="button" onClick={() => { setTemplate(t.id); setHtml("") }} aria-pressed={template === t.id} style={{ padding: 10, textAlign: "left", border: template === t.id ? "2px solid var(--accent)" : "1px solid var(--border-strong)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}><strong style={{ display: "block", fontSize: 13 }}>{t.label}</strong><span style={{ fontSize: 12, opacity: .7 }}>{t.family}</span></button>)}</div>
        <button disabled={busy} onClick={() => call("preview")} style={{ padding: 12, borderRadius: 8, background: "var(--accent)", color: "var(--bg)", fontWeight: 700 }}>{busy ? "Working…" : "Extract and preview"}</button>
        {text && <label style={{ display: "grid", gap: 6 }}>Check and correct extracted resume text
          <textarea value={text} onChange={e => { setText(e.target.value); setHtml("") }} rows={14} style={{ width: "100%", border: "1px solid var(--border-strong)", padding: 12, background: "var(--surface)", color: "var(--text)" }} />
        </label>}
        {text && <button disabled={busy} onClick={() => call("docx")} style={{ padding: 12, border: "1px solid var(--border-strong)", borderRadius: 8 }}>Download Word document</button>}
        {html && <button onClick={() => { const w = window.open("", "_blank"); if (!w) { setError("Allow popups to print your resume."); return } w.document.write(html); w.document.close(); w.focus(); w.print() }} style={{ padding: 12, border: "1px solid var(--border-strong)", borderRadius: 8 }}>Print or save as PDF</button>}
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      </div>
      <div style={{ minHeight: 560, border: "1px solid var(--border-strong)", background: "#eee", padding: 12, borderRadius: 10 }}>
        <p style={{ fontSize: 12, color: "#555", margin: "0 0 8px" }}>{text ? "Your resume preview" : "Sample preview · No upload required"}</p>
        <iframe key={template} title="Resume preview" srcDoc={previewHtml} sandbox="" style={{ width: "100%", height: 700, background: "white", border: 0 }} />
      </div>
    </div>
  </section>
}
