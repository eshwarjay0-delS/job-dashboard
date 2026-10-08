"use client"
import { useState } from "react"
import { RESUME_FORMATS, type FormatId } from "@/lib/resume-formatting"

export default function ResumeFormattingPage() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState("")
  const [template, setTemplate] = useState<FormatId>("jakes")
  const [html, setHtml] = useState("")
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
    <div><p style={{ fontSize: 12, opacity: .7 }}>RESUME DASHBOARD / FORMATTING</p><h1 style={{ fontSize: 30, fontWeight: 700 }}>Resume Formatting</h1><p>Upload once, choose a professional layout, review the text, and download. Your career facts stay yours.</p></div>
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
  </section>
}
