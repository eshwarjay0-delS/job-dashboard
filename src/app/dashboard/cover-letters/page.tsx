"use client"

import { useState, useEffect } from "react"
import { Briefcase, Rocket, Zap, Mail, PenLine, FileText, Sparkles, TriangleAlert, Check, Save, Folder, X } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"

const P = {
  surface: "#ffffff", text: "#1a2035", muted: "#6b7a99",
  hint: "#9aa4bc", border: "#e4e8ef", bg: "#f4f6f9",
}

const TONES = [
  { id: "professional", label: "Professional",   desc: "Formal and polished — best for enterprise, F500, finance", Icon: Briefcase, color: "#1d6fc4", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "enthusiastic", label: "Enthusiastic",   desc: "Warm and energetic — best for startups, product, creative", Icon: Rocket, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "concise",      label: "Sharp & Direct",  desc: "No fluff — best for engineering, DevOps, technical roles",   Icon: Zap, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
]

const TEMPLATES = {
  professional: `Dear Hiring Manager,

I am writing to express my strong interest in the {role} position at {company}. With {years}+ years of experience in {domain}, I have developed a deep understanding of {skill1} and {skill2}, which I believe aligns well with the challenges your team is tackling.

In my current role at {current_company}, I {achievement}. This experience has prepared me to contribute meaningfully from day one at {company}.

I am particularly excited about {company}'s work in {company_focus} and the opportunity to bring my expertise in {skill1} to a team that values {value}.

I would welcome the opportunity to discuss how my background can contribute to your team's success. Thank you for your consideration.

Sincerely,
{name}`,

  enthusiastic: `Hi {company} Team,

When I came across the {role} opportunity at {company}, I immediately knew this was the role I've been building toward. Your work in {company_focus} is exactly the kind of impact I want to be part of.

Here's what I bring: {years}+ years driving results in {domain} — specifically {achievement}. At {current_company}, I didn't just {skill1}, I made it count with measurable outcomes.

What excites me most about {company} is {value}. I'd bring that same energy and ownership to your team from day one.

Would love to connect and share more. Let's talk!

{name}`,

  concise: `Re: {role} — {name}

{years}+ years in {domain}. Currently at {current_company}.

Why I'm a fit:
• {achievement}
• Deep expertise in {skill1} and {skill2}
• Track record of {value}

Why {company}: {company_focus} aligns with where I want to apply my skills next.

Available for a call this week. Resume attached.

{name}`,
}

interface Profile {
  full_name?: string
  title?: string
  skills?: string[]
  yearsExp?: number
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function CoverLetterPage() {
  const [form, setForm] = useState({
    role: "", company: "", companyFocus: "", currentCompany: "", domain: "", years: "5",
    skill1: "", skill2: "", achievement: "", value: "", name: "",
  })
  const [tone, setTone]           = useState("professional")
  const [jd, setJd]               = useState("")
  const [letter, setLetter]       = useState("")
  const [aiLetter, setAiLetter]   = useState("")
  const [loadingAI, setLoadingAI] = useState(false)
  const [mode, setMode]           = useState<"template" | "ai">("ai")
  const [copied, setCopied]       = useState(false)
  const [saved, setSaved]         = useState<{ role: string; company: string; text: string; tone: string; date: string }[]>([])
  const [view, setView]           = useState<"compose" | "saved">("compose")

  // Load profile + saved letters
  useEffect(() => {
    try {
      const p: Profile = JSON.parse(localStorage.getItem("jd_profile") || "{}")
      if (p.full_name) setForm(f => ({ ...f, name: p.full_name! }))
      if (p.title)     setForm(f => ({ ...f, domain: p.title! }))
      if (p.yearsExp)  setForm(f => ({ ...f, years: String(p.yearsExp) }))
      if (p.skills?.length) setForm(f => ({ ...f, skill1: p.skills![0] || "", skill2: p.skills![1] || "" }))
    } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("jd_cover_letters") || "[]")
      setSaved(s)
    } catch {}
  }, [])

  // Generate template preview
  useEffect(() => {
    if (mode !== "template") return
    let tpl = TEMPLATES[tone as keyof typeof TEMPLATES]
    const replacements: Record<string, string> = {
      role:            form.role || "[Role]",
      company:         form.company || "[Company]",
      years:           form.years || "X",
      domain:          form.domain || "[Domain]",
      skill1:          form.skill1 || "[Skill 1]",
      skill2:          form.skill2 || "[Skill 2]",
      current_company: form.currentCompany || "[Current Company]",
      achievement:     form.achievement || "[Your key achievement]",
      company_focus:   form.companyFocus || "[what this company does]",
      value:           form.value || "[a core value or strength]",
      name:            form.name || "[Your Name]",
    }
    for (const [k, v] of Object.entries(replacements)) {
      tpl = tpl.replace(new RegExp(`\\{${k}\\}`, "g"), v)
    }
    setLetter(tpl)
  }, [form, tone, mode])

  async function generateAI() {
    if (!form.role && !jd) return
    setLoadingAI(true); setAiLetter("")
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    const toneDesc = TONES.find(t => t.id === tone)?.desc || ""
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "cover_letter",
          instruction: `Write a compelling cover letter. Tone: ${tone} (${toneDesc}).
Candidate: ${form.name || "the candidate"}, ${form.years} years exp in ${form.domain || "tech"}.
Role: ${form.role || "the position"} at ${form.company || "the company"}.
${form.currentCompany ? `Current employer: ${form.currentCompany}.` : ""}
${form.achievement ? `Key achievement: ${form.achievement}.` : ""}
${form.skill1 ? `Core skills: ${form.skill1}${form.skill2 ? `, ${form.skill2}` : ""}.` : ""}
${form.companyFocus ? `Company focus area: ${form.companyFocus}.` : ""}
${jd ? `\nJob description:\n${jd.slice(0, 800)}` : ""}

Write the full cover letter (250-350 words). No placeholders. Use REAL sentences. Make it sound human, not AI-generated. Start with a hook, not "I am writing to...". Include one specific quantified achievement. End with a confident call-to-action.`,
          current: "",
          claudeKey,
        }),
      })
      const data = await res.json()
      setAiLetter(data.text || "")
    } catch { setAiLetter("Unable to generate right now. Try again.") }
    setLoadingAI(false)
  }

  function copyLetter() {
    const text = mode === "ai" ? aiLetter : letter
    if (!text) return
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function saveLetter() {
    const text = mode === "ai" ? aiLetter : letter
    if (!text) return
    const entry = { role: form.role || "Unknown", company: form.company || "Unknown", text, tone, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
    const next = [entry, ...saved].slice(0, 20)
    setSaved(next)
    localStorage.setItem("jd_cover_letters", JSON.stringify(next))
  }

  const currentText = mode === "ai" ? aiLetter : letter
  const wc = wordCount(currentText)

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          icon={<Mail size={18}/>}
          title="Cover Letter Generator"
          description="AI-powered cover letters in 3 tones — sharper than Kickresume or Zety."
          actions={
            <div style={{ display: "flex", gap: 6 }}>
              {(["compose", "saved"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${view === v ? "var(--accent)" : P.border}`, background: view === v ? "#eff6ff" : P.surface, color: view === v ? "var(--accent)" : P.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {v === "compose" ? <><PenLine size={13}/> Compose</> : <><Folder size={13}/> Saved ({saved.length})</>}
                </button>
              ))}
            </div>
          }
        />
      </div>

      {view === "compose" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* ── Left: Input ── */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 6, padding: "4px", background: P.bg, borderRadius: 10, border: `1px solid ${P.border}` }}>
              <button onClick={() => setMode("ai")}
                style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: mode === "ai" ? "#fff" : "transparent", color: mode === "ai" ? P.text : P.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: mode === "ai" ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
                <Sparkles size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }}/>AI Generate
              </button>
              <button onClick={() => setMode("template")}
                style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: mode === "template" ? "#fff" : "transparent", color: mode === "template" ? P.text : P.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", boxShadow: mode === "template" ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
                <FileText size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }}/>Template
              </button>
            </div>

            {/* Tone */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 6 }}>TONE</label>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {TONES.map(t => (
                  <div key={t.id} onClick={() => setTone(t.id)}
                    style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${tone === t.id ? t.color : P.border}`, background: tone === t.id ? t.bg : P.surface, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: t.color, display: "flex", flexShrink: 0 }}><t.Icon size={17}/></span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: tone === t.id ? t.color : P.text, marginBottom: 1 }}>{t.label}</p>
                      <p style={{ fontSize: 11.5, color: P.muted }}>{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { key: "role",          label: "TARGET ROLE",       placeholder: "Senior Security Engineer" },
                { key: "company",       label: "COMPANY",           placeholder: "Palo Alto Networks" },
                { key: "name",          label: "YOUR NAME",         placeholder: "Eshwar Janjirala" },
                { key: "currentCompany",label: "CURRENT EMPLOYER",  placeholder: "Cigna Healthcare" },
                { key: "domain",        label: "YOUR DOMAIN",       placeholder: "OT Security / AppSec" },
                { key: "years",         label: "YEARS EXP",         placeholder: "8" },
                { key: "skill1",        label: "TOP SKILL",         placeholder: "Splunk, Dragos, NERC CIP" },
                { key: "skill2",        label: "SKILL 2",           placeholder: "Penetration Testing" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 3 }}>{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${P.border}`, fontSize: 12, color: P.text, background: P.surface, outline: "none", boxSizing: "border-box" as const }}/>
                </div>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 3 }}>KEY ACHIEVEMENT (with metric)</label>
              <input value={form.achievement} onChange={e => setForm(p => ({ ...p, achievement: e.target.value }))} placeholder="reduced detection time from 72hrs to 8hrs across 12 ICS sites"
                style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${P.border}`, fontSize: 12, color: P.text, background: P.surface, outline: "none" }}/>
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 3 }}>WHAT EXCITES YOU ABOUT THIS COMPANY</label>
              <input value={form.companyFocus} onChange={e => setForm(p => ({ ...p, companyFocus: e.target.value }))} placeholder="their AI-driven threat detection platform"
                style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${P.border}`, fontSize: 12, color: P.text, background: P.surface, outline: "none" }}/>
            </div>

            {/* JD paste (AI mode) */}
            {mode === "ai" && (
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 3 }}>JOB DESCRIPTION (optional — improves AI output)</label>
                <textarea value={jd} onChange={e => setJd(e.target.value)} rows={4} placeholder="Paste the job description here…"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 12, color: P.text, background: P.surface, outline: "none", resize: "vertical" as const, boxSizing: "border-box" as const }}/>
              </div>
            )}

            {mode === "ai" && (
              <button onClick={generateAI} disabled={loadingAI}
                style={{ width: "100%", padding: "10px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: loadingAI ? "wait" : "pointer", opacity: loadingAI ? 0.75 : 1 }}>
                {loadingAI ? "Writing your cover letter…" : "✨ Generate Cover Letter"}
              </button>
            )}
          </div>

          {/* ── Right: Preview ── */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.text }}>Preview</p>
                {currentText && (
                  <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: wc > 400 ? "#fef2f2" : wc > 300 ? "#fffbeb" : "#ecfdf5", color: wc > 400 ? "#dc2626" : wc > 300 ? "#d97706" : "#059669", border: "none" }}>
                    {wc} words {wc > 400 ? "⚠ too long" : wc < 200 ? "⚠ too short" : "✓"}
                  </span>
                )}
              </div>
              {currentText && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={saveLetter} style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${P.border}`, background: P.surface, color: P.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>💾 Save</button>
                  <button onClick={copyLetter} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: copied ? "#059669" : "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{copied ? "Copied!" : "Copy"}</button>
                </div>
              )}
            </div>

            {currentText ? (
              <div style={{ background: "#fafbff", border: `1.5px solid ${P.border}`, borderRadius: 14, padding: "22px 24px", flex: 1, overflowY: "auto" as const, fontFamily: "'Georgia', serif", lineHeight: 1.85, color: P.text, fontSize: 13.5, whiteSpace: "pre-wrap" as const, maxHeight: "70vh" }}>
                {currentText}
              </div>
            ) : (
              <div style={{ background: P.bg, border: `1.5px dashed ${P.border}`, borderRadius: 14, flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 10, minHeight: 400 }}>
                <span style={{ fontSize: 36 }}>✉️</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: P.text }}>Your cover letter will appear here</p>
                <p style={{ fontSize: 13, color: P.muted, textAlign: "center" as const }}>
                  {mode === "ai" ? "Fill in the fields and click Generate." : "Fill in the fields — the template updates live."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Saved letters ── */}
      {view === "saved" && (
        <div>
          {saved.length === 0 ? (
            <div style={{ textAlign: "center" as const, padding: "60px 24px", color: P.muted }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>📁</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 6 }}>No saved letters yet</p>
              <p>Generate a cover letter and click Save to store it here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {saved.map((s, i) => (
                <div key={i} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{s.role} @ {s.company}</p>
                      <p style={{ fontSize: 12, color: P.muted }}>{s.date} · {s.tone} tone · {wordCount(s.text)} words</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => navigator.clipboard.writeText(s.text)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Copy</button>
                      <button onClick={() => {
                        const next = saved.filter((_, j) => j !== i).slice(0, 20)
                        setSaved(next)
                        localStorage.setItem("jd_cover_letters", JSON.stringify(next))
                      }} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${P.border}`, background: "transparent", color: P.hint, fontSize: 12, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                  <pre style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.7, whiteSpace: "pre-wrap" as const, fontFamily: "inherit", margin: 0, maxHeight: 200, overflowY: "auto" as const }}>{s.text.slice(0, 400)}…</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
