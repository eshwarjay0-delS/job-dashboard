"use client"

// Resume Formatting: a person's own resume, set in a clean layout they pick, to download as Word or PDF.
//
// The owner, 12 Oct 2026: "this had implemented so sloppy ... implement this perfectly." What was wrong with the page as
// it stood, and what this version does about each:
//
//   1. THE RESULT DID NOT LOOK LIKE A RESUME. Every template was the same plain paragraphs in another font. That is fixed
//      in src/lib/resume-formatting.ts (a job line keeps its title in weight and its dates at the right edge); this page
//      only shows it.
//   2. THE ORDER WAS BACKWARDS. Ten sample resumes came first and the person's own resume last, behind a second button
//      ("Load my resume") that appeared only after a file was chosen. Now it reads top to bottom as three steps: your
//      resume, the look, the download. Choosing a file loads it at once.
//   3. THE PREVIEW WAS SOMEWHERE ELSE. Choosing a template scrolled the page down to a preview. Now the preview stays
//      beside the choices, so changing the look is seen as it is changed, and every thumbnail is the person's own resume
//      once it is loaded, not a stranger's.
//   4. A LONG RESUME WAS CUT OFF AT ONE PAGE, with a note telling the person to scroll inside a frame. The sheet is now as
//      long as the resume, with a line where each page ends and the number of pages said in words.
//   5. THE PAGE HAD COLOURS OF ITS OWN (greys and a red written as hex), so it did not follow the night theme. It uses the
//      theme's tokens. The sheet itself stays white: it is paper, in every theme.
//   6. "PRINT" OPENED A NEW WINDOW, which browsers block. It prints from a frame inside the page.
//
// What it still will not do: rewrite anything. The words that come out are the words that went in.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import PageIntro from "../../_components/page-intro"
import { Card, Chip, Meta } from "../../_suite/ui"
import { RESUME_FORMATS, renderResumeHtml, resumeLines, type FormatId } from "@/lib/resume-formatting"
import styles from "./format.module.css"

const SAMPLE = `ALEX MORGAN
Software Engineer | alex.morgan@example.com | (555) 010-2048 | Austin, TX
PROFESSIONAL SUMMARY
Software engineer with experience delivering secure web applications and cloud services. Connects product priorities with practical architecture, dependable releases, and measurable improvements to customer experience.
EXPERIENCE
Software Engineer | Northstar Labs | 2023 – Present
• Built APIs and improved response times by 35% through query optimization.
• Collaborated with product and security teams to ship accessible features used by 12,000 monthly customers.
• Introduced service monitoring and incident playbooks, cutting average recovery time from 45 to 20 minutes.
• Mentored three developers through design reviews, pairing sessions, and ownership of production services.
Associate Developer | Cedar Systems | 2021 – 2023
• Automated release checks and reduced deployment errors by adding integration tests to the delivery pipeline.
• Migrated reporting queries to scheduled jobs, freeing the support team from four hours of manual work each week.
• Worked with designers to improve keyboard navigation and error messages throughout the customer portal.
EDUCATION
B.S. Computer Science | State University | 2021
TECHNICAL SKILLS
Languages: TypeScript, Python, SQL
Tools: React, AWS, CI/CD
PROJECTS
Developer Portal | TypeScript, React, PostgreSQL | 2024
• Built an internal dashboard combining service health, ownership, and searchable API documentation.
• Added role based access and audit records for configuration changes across five engineering teams.
CERTIFICATIONS
AWS Certified Developer – Associate | 2024`

const PAGE_W = 816    // US Letter at 96 px to the inch
const PAGE_H = 1056
const FAMILIES = ["All", "Technical", "Professional", "Experienced"] as const
const SMALL: CSSProperties = { fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }
const QUIET: CSSProperties = { minHeight: 44, padding: "0 16px", fontSize: 15 }

// One sheet of the resume, drawn to fit the space it is given. The frame may not run scripts. It is allowed to be read by
// this page for one reason: to measure how long the resume is, so the sheet can be as long as the resume and not one page
// with the rest hidden. A thumbnail shows the first page only.
function Sheet({ html, title, thumbnail = false, actual = false, onPages }: { html: string; title: string; thumbnail?: boolean; actual?: boolean; onPages?: (pages: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(thumbnail ? 0.25 : 0.6)
  const [pages, setPages] = useState(1)

  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setScale(actual ? 1 : Math.min(1, entry.contentRect.width / PAGE_W)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [actual])

  const measure = useCallback(() => {
    if (thumbnail) return
    let tall = PAGE_H
    // The body's own height, not the frame's scroll height: a frame that was made two pages tall for the last resume would
    // report two pages for ever, however short the next one is.
    try { tall = frame.current?.contentDocument?.body?.offsetHeight || PAGE_H } catch { /* a browser that will not let the sheet be read: one page is shown */ }
    const count = Math.max(1, Math.ceil((tall - 4) / PAGE_H))
    setPages(count)
    onPages?.(count)
  }, [thumbnail, onPages])

  const tall = pages * PAGE_H
  return (
    <div ref={box} className={styles.sheet} style={{ height: tall * scale, width: actual ? PAGE_W : "100%" }}>
      <iframe ref={frame} title={title} srcDoc={html} sandbox="allow-same-origin" onLoad={measure} tabIndex={-1} aria-hidden={thumbnail || undefined}
        style={{ width: PAGE_W, height: tall, transform: `scale(${scale})`, pointerEvents: "none" }} />
      {!thumbnail && Array.from({ length: pages - 1 }, (_, i) => (
        <div key={i} className={styles.pageEnd} style={{ top: (i + 1) * PAGE_H * scale }}><span>Page {i + 2}</span></div>
      ))}
    </div>
  )
}

export default function ResumeFormattingPage() {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [template, setTemplate] = useState<FormatId>("jakes")
  const [family, setFamily] = useState<(typeof FAMILIES)[number]>("All")
  const [busy, setBusy] = useState<"" | "reading" | "word">("")
  const [error, setError] = useState("")
  const [typing, setTyping] = useState(false)
  const [actual, setActual] = useState(false)
  const [pages, setPages] = useState(1)
  const latest = useRef(0)          // which reading or download an answer belongs to: a newer one makes it stale
  const picker = useRef<HTMLInputElement>(null)

  const mine = text.trim().length > 0
  const shown = mine ? text : SAMPLE
  const selected = RESUME_FORMATS.find(t => t.id === template)!
  const html = useMemo(() => renderResumeHtml(shown, template), [shown, template])
  const looks = useMemo(() => RESUME_FORMATS.filter(t => family === "All" || t.family === family), [family])
  // Every thumbnail is the same resume the person is looking at, so the only thing that differs between two is the look.
  const thumbs = useMemo(() => Object.fromEntries(RESUME_FORMATS.map(t => [t.id, renderResumeHtml(shown, t.id)])), [shown])

  const read = async (file: File) => {
    const mineNow = ++latest.current
    setError(""); setFileName(file.name)
    if (!/\.docx$/i.test(file.name)) { setError("That is not a Word file. Choose a file ending in .docx, or paste the text of your resume below."); setFileName(""); return }
    setBusy("reading")
    try {
      const data = new FormData()
      data.set("template", template); data.set("output", "preview"); data.set("file", file)
      const response = await fetch("/api/resume/format", { method: "POST", body: data })
      const answer = await response.json().catch(() => ({}))
      if (mineNow !== latest.current) return
      if (!response.ok) { setError(response.status === 401 ? "You have been signed out. Sign in again, then choose the file once more." : answer.error || "That file could not be read. Paste the text of your resume instead."); setFileName(""); return }
      setText(String(answer.text || ""))
      setTyping(false)
    } catch {
      if (mineNow === latest.current) { setError("That could not be sent. Check your connection and try again."); setFileName("") }
    } finally {
      if (mineNow === latest.current) setBusy("")
    }
  }

  const word = async () => {
    if (!mine || busy) return
    const mineNow = ++latest.current
    setError(""); setBusy("word")
    try {
      const data = new FormData()
      data.set("template", template); data.set("output", "docx"); data.set("text", text)
      const response = await fetch("/api/resume/format", { method: "POST", body: data })
      if (mineNow !== latest.current) return
      if (!response.ok) { const answer = await response.json().catch(() => ({})); setError(response.status === 401 ? "You have been signed out. Sign in again, then download once more: your text is still here." : answer.error || "The Word file could not be made. Try again."); return }
      const url = URL.createObjectURL(await response.blob())
      const a = document.createElement("a")
      a.href = url; a.download = `Resume_${selected.label.replace(/[^A-Za-z0-9]+/g, "_")}.docx`
      document.body.append(a); a.click(); a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      if (mineNow === latest.current) setError("That could not be sent. Check your connection and try again.")
    } finally {
      if (mineNow === latest.current) setBusy("")
    }
  }

  // Printing is how a browser makes a PDF. It is done from a frame inside this page: a new window is what browsers block.
  const pdf = () => {
    if (!mine) return
    setError("")
    const frame = document.createElement("iframe")
    frame.setAttribute("sandbox", "allow-same-origin allow-modals")
    frame.setAttribute("aria-hidden", "true")
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
    frame.srcdoc = html
    frame.onload = () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print() }
      catch { setError("This browser would not open its print window. Download the Word file and save it as a PDF from Word.") }
      window.setTimeout(() => frame.remove(), 60_000)
    }
    document.body.append(frame)
  }

  const startOver = () => { latest.current++; setText(""); setFileName(""); setError(""); setTyping(false); setBusy(""); if (picker.current) picker.current.value = "" }
  const lines = mine ? resumeLines(text).length : 0

  return (
    <div className={styles.page}>
      <PageIntro page="/dashboard/resume/format"
        action={mine ? { label: busy === "word" ? "Making the file…" : "Download Word file", onClick: () => void word() } : { label: busy === "reading" ? "Reading your file…" : "Choose your resume", htmlFor: "resume-file" }}
        sample={mine ? "Your words are used exactly as they are. Nothing is rewritten." : "Until you add yours, the pictures show a made-up person's resume."} />

      {error && <div role="alert" className={styles.alert}>{error}</div>}

      <div className={styles.work}>
        <div className={styles.steps}>
          <Card>
            <Meta>Step 1</Meta>
            <h2 className={styles.h2}>Your resume</h2>
            <input ref={picker} id="resume-file" type="file" hidden disabled={busy !== ""} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => { const f = e.target.files?.[0]; if (f) void read(f) }} />
            {mine ? (
              <>
                <p style={{ ...SMALL, fontSize: 15.5, color: "var(--text)", marginTop: 8 }}>{fileName ? `${fileName}: ` : ""}{lines} {lines === 1 ? "line" : "lines"} loaded.</p>
                <div className={styles.row}>
                  <button type="button" className="btn-outline" style={QUIET} aria-expanded={typing} onClick={() => setTyping(!typing)}>{typing ? "Done editing" : "Edit the text"}</button>
                  <label htmlFor="resume-file" className="btn-ghost" style={{ ...QUIET, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>Choose another file</label>
                  <button type="button" className="btn-ghost" style={QUIET} onClick={startOver}>Start over</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ ...SMALL, marginTop: 8 }}>A Word file (.docx), or paste the text. It is read to lay it out and is not kept.</p>
                <div className={styles.row}>
                  <label htmlFor="resume-file" className="btn-outline" style={{ ...QUIET, display: "inline-flex", alignItems: "center", cursor: busy ? "default" : "pointer" }}>{busy === "reading" ? "Reading your file…" : "Choose a Word file"}</label>
                  <button type="button" className="btn-ghost" style={QUIET} aria-expanded={typing} onClick={() => setTyping(!typing)}>{typing ? "Hide the box" : "Paste the text instead"}</button>
                </div>
                <p style={{ ...SMALL, marginTop: 10 }}>Only have a PDF? Open it, select everything, copy, and paste it here.</p>
              </>
            )}
            {typing && (
              <label className={styles.typing}>
                <span>The text of your resume. One thing on each line: your name first, then how to reach you, then each section.</span>
                <textarea value={text} rows={14} spellCheck={false} placeholder={"Your name\nyou@example.com | your phone | your city\nEXPERIENCE\nJob title | Company | 2021 – Present\n• What you did"}
                  onChange={e => { latest.current++; setText(e.target.value); setError("") }} />
              </label>
            )}
          </Card>

          <Card>
            <Meta>Step 2</Meta>
            <h2 className={styles.h2}>Pick a look</h2>
            <div className={styles.row} role="group" aria-label="Kinds of layout">
              {FAMILIES.map(value => <Chip key={value} label={value} active={family === value} onClick={() => setFamily(value)} />)}
            </div>
            <div className={styles.gallery}>
              {looks.map(t => (
                <button key={t.id} type="button" className={styles.look} aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
                  <span className={styles.thumb}><Sheet html={thumbs[t.id]} title={`${t.label}, first page`} thumbnail /></span>
                  <span className={styles.caption}><strong>{t.label}</strong><span>{t.description}</span></span>
                </button>
              ))}
            </div>
            <p style={{ ...SMALL, fontSize: 13, marginTop: 12 }}>These are our own layouts in well known styles. A university&apos;s name describes a style and is not that university&apos;s approval.</p>
          </Card>

          <Card>
            <Meta>Step 3</Meta>
            <h2 className={styles.h2}>Download it</h2>
            <p style={{ ...SMALL, marginTop: 8 }}>{mine ? `${selected.label}, about ${pages} ${pages === 1 ? "page" : "pages"}. Read it through once before you send it anywhere.` : "Add your resume in step 1 and the buttons here will work."}</p>
            <div className={styles.row}>
              <button type="button" className="btn-outline" style={QUIET} disabled={!mine || busy !== ""} onClick={() => void word()}>{busy === "word" ? "Making the file…" : "Word file (.docx)"}</button>
              <button type="button" className="btn-ghost" style={QUIET} disabled={!mine || busy !== ""} onClick={pdf}>Save as PDF</button>
            </div>
            <p style={{ ...SMALL, fontSize: 13, marginTop: 10 }}>Save as PDF opens your browser&apos;s print window: choose &quot;Save as PDF&quot; there. Where a page ends can differ a little between the picture, Word and the PDF.</p>
          </Card>
        </div>

        <section className={styles.preview} aria-label="How your resume will look">
          <div className={styles.bar}>
            <span>{mine ? "Your resume" : "A made-up resume"} · {selected.label} · {pages} {pages === 1 ? "page" : "pages"}</span>
            <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: "0 12px", fontSize: 14 }} aria-pressed={actual} onClick={() => setActual(!actual)}>{actual ? "Fit to the space" : "Actual size"}</button>
          </div>
          <div className={styles.desk}>
            <div style={{ width: actual ? PAGE_W : "100%", maxWidth: PAGE_W, margin: "0 auto" }}>
              <Sheet html={html} title={`${selected.label}: your resume`} actual={actual} onPages={setPages} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
