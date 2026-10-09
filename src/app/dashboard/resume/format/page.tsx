"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { RESUME_FORMATS, renderResumeHtml, type FormatId } from "@/lib/resume-formatting"
import styles from "./format.module.css"

const SAMPLE = `ALEX MORGAN
Software Engineer | alex.morgan@example.com | (555) 010-2048 | Austin, TX
PROFESSIONAL SUMMARY
Software engineer with experience delivering secure web applications and cloud services. Connects product priorities with practical architecture, dependable releases, and measurable improvements to customer experience.
EXPERIENCE
Software Engineer | Northstar Labs | 2023–Present
• Built APIs and improved response times by 35% through query optimization.
• Collaborated with product and security teams to ship accessible features used by 12,000 monthly customers.
• Introduced service monitoring and incident playbooks, cutting average recovery time from 45 to 20 minutes.
• Mentored three developers through design reviews, pairing sessions, and ownership of production services.
Associate Developer | Cedar Systems | 2021–2023
• Automated release checks and reduced deployment errors by adding integration tests to the delivery pipeline.
• Migrated reporting queries to scheduled jobs, freeing the support team from four hours of manual work each week.
• Worked with designers to improve keyboard navigation and error messages throughout the customer portal.
EDUCATION
B.S. Computer Science | State University | 2021
TECHNICAL SKILLS
TypeScript, Python, React, SQL, AWS, CI/CD
PROJECTS
Developer Portal | TypeScript, React, PostgreSQL
• Built an internal dashboard combining service health, ownership, and searchable API documentation.
• Added role based access and audit records for configuration changes across five engineering teams.
CERTIFICATIONS
AWS Certified Developer – Associate | 2024
LEADERSHIP
Engineering Learning Circle | Facilitated monthly architecture discussions and shared practical debugging guides.`

function PaperPreview({ html, title, miniature = false }: { html: string; title: string; miniature?: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(miniature ? .25 : .6)
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / 816)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={container} className={styles.paperViewport} style={{ height: 1056 * scale }}>
    <iframe title={title} srcDoc={html} sandbox="" tabIndex={miniature ? -1 : 0} aria-hidden={miniature || undefined} style={{ width: 816, height: 1056, transform: `scale(${scale})`, pointerEvents: miniature ? "none" : "auto" }} />
  </div>
}

export default function ResumeFormattingPage() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState("")
  const [template, setTemplate] = useState<FormatId>("jakes")
  const [family, setFamily] = useState("All")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [zoom, setZoom] = useState(false)
  const revision = useRef(0)
  const preview = useRef<HTMLElement>(null)
  const selected = RESUME_FORMATS.find(t => t.id === template)!
  const previewHtml = useMemo(() => renderResumeHtml(text.trim() ? text : SAMPLE, template), [text, template])
  const samples = useMemo(() => Object.fromEntries(RESUME_FORMATS.map(t => [t.id, renderResumeHtml(SAMPLE, t.id)])), [])
  async function call(output: "preview" | "docx") {
    const requestRevision = revision.current
    setBusy(true); setError("")
    try {
      const data = new FormData()
      data.set("template", template); data.set("output", output)
      if (text.trim()) data.set("text", text)
      else if (file) data.set("file", file)
      else throw new Error("Choose a DOCX resume or paste your resume text first.")
      const response = await fetch("/api/resume/format", { method: "POST", body: data })
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Formatting failed.") }
      if (requestRevision !== revision.current) return
      if (output === "docx") {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = `MarketFit_${template}_Resume.docx`; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        const result = await response.json()
        if (requestRevision === revision.current) setText(result.text)
      }
    } catch (e) { if (requestRevision === revision.current) setError(e instanceof Error ? e.message : "Something went wrong.") }
    finally { setBusy(false) }
  }
  function printResume() {
    const w = window.open("", "_blank")
    if (!w) { setError("Allow popups to print your resume."); return }
    w.onload = () => { w.focus(); w.print() }
    w.document.write(previewHtml); w.document.close()
  }
  return <section className={styles.page}>
    <header><p className={styles.eyebrow}>RESUME STUDIO</p><h1>Choose the look. Keep your story.</h1><p>Compare complete sample resumes first. Upload or paste your own when you find a style you like.</p></header>
    <div className={styles.filters} aria-label="Filter templates">{["All", "Technical", "Professional", "Experienced"].map(value => <button key={value} type="button" aria-pressed={family === value} onClick={() => setFamily(value)}>{value}</button>)}</div>
    <div className={styles.gallery} aria-label="Resume template gallery">{RESUME_FORMATS.filter(t => family === "All" || t.family === family).map(t => <button key={t.id} type="button" className={styles.template} aria-pressed={template === t.id} onClick={() => { setTemplate(t.id); preview.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }}>
      <div className={styles.thumbnail}><PaperPreview html={samples[t.id]} title={`${t.label} sample`} miniature /></div>
      <div className={styles.caption}><span className={styles.category}>{t.family}{template === t.id ? " · Selected" : ""}</span><strong>{t.label}</strong><span>{t.description}</span></div>
    </button>)}</div>
    <p className={styles.note}>Reference inspired layouts, independently designed. University names do not imply endorsement.</p>
    <section ref={preview} className={styles.workspace} aria-label="Customize selected resume">
      <div className={styles.controls}>
        <div><p className={styles.eyebrow}>YOUR SELECTED STYLE</p><h2>{selected.label}</h2><p>{selected.description}</p></div>
        <label>Upload your resume (DOCX)<input type="file" disabled={busy} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { revision.current++; setFile(e.target.files?.[0] || null); setText(""); setError("") }} /></label>
        {file && <button disabled={busy} onClick={() => call("preview")} className={styles.primary}>{busy ? "Working…" : "Load my resume"}</button>}
        <label>Or paste and edit your resume text<textarea value={text} disabled={busy} onChange={e => { revision.current++; setText(e.target.value); setError("") }} rows={12} placeholder="Your name, contact details, experience, education, and skills" /></label>
        <p className={styles.note}>Formatting uses your words without AI rewriting. Review extracted text before downloading.</p>
        <button disabled={busy || !text.trim()} onClick={() => call("docx")} className={styles.primary}>{busy ? "Working…" : "Download Word document"}</button>
        <button disabled={busy || !text.trim()} onClick={printResume}>Print or save as PDF</button>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewToolbar}><span>{text.trim() ? "Your resume" : "Sample resume"} · US Letter</span><button type="button" onClick={() => setZoom(!zoom)} aria-pressed={zoom}>{zoom ? "Fit page" : "Actual size"}</button></div>
        <div className={styles.previewScroll}><div style={{ width: zoom ? 816 : "100%", maxWidth: 816, margin: "auto" }}><PaperPreview html={previewHtml} title={`${selected.label} resume preview`} /></div></div>
        <p className={styles.note}>Scroll inside the preview for longer resumes. Word and PDF use the same style settings; page breaks can vary by font availability.</p>
      </div>
    </section>
  </section>
}
