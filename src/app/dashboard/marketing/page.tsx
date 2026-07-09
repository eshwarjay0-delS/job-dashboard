"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  FileText, Globe, Zap, Target, BarChart3, Bot, Mail, Mic, ClipboardList,
  Rocket, Search, Frown, CircleCheck, Lightbulb,
} from "lucide-react"

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      "#0b1220",
  card:    "#111827",
  cardAlt: "#141f30",
  border:  "rgba(255,255,255,.07)",
  text:    "#f0f4ff",
  muted:   "#8892a8",
  hint:    "#4b5568",
  accent:  "#3b82f6",
  accentL: "#60a5fa",
  teal:    "#14b8a6",
  purple:  "#8b5cf6",
  green:   "#60a5fa",
  amber:   "#f59e0b",
}

// ── Animated counter ─────────────────────────────────────────────────────────
function AnimCount({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      let start = 0
      const dur = 1800, step = 16
      const inc = to / (dur / step)
      const t = setInterval(() => {
        start = Math.min(start + inc, to)
        setVal(Math.round(start))
        if (start >= to) clearInterval(t)
      }, step)
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

// ── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    problem: "\"I've sent 200 applications. Zero callbacks. I don't know what I'm doing wrong.\"",
    solution: "MarketFit scores your resume against every JD before you apply — so you fix it first, not after the rejection.",
    stat: "87% of resumes never pass ATS. MarketFit shows you why yours would fail, then fixes it.",
    cta: { label: "Tailor My Resume →", href: "/dashboard/resume", color: C.accent },
    hotspot: "My Resume → Tailor",
    Icon: FileText,
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #0b1220 100%)",
  },
  {
    problem: "\"H1B sponsorship jobs are impossible to find. Companies don't advertise it.\"",
    solution: "We crawl company career pages and flag H1B-likely employers based on DOL public records — before anyone else sees the role.",
    stat: "Only 4% of US companies sponsor H1B. MarketFit surfaces all of them with one filter.",
    cta: { label: "Find H1B Jobs →", href: "/dashboard/jobs", color: C.teal },
    hotspot: "Jobs & Apply → H1B Filter",
    Icon: Globe,
    gradient: "linear-gradient(135deg, #0d3330 0%, #0b1220 100%)",
  },
  {
    problem: "\"I filled out the same application 50 times this week. Name, email, resume, work auth — every single time.\"",
    solution: "Install MarketFit's Chrome extension. One click autofills your entire application — name, address, work auth, resume, cover letter.",
    stat: "3 minutes from job posting to submitted application. No copy-paste.",
    cta: { label: "Get the Extension →", href: "/dashboard/settings", color: C.purple },
    hotspot: "Chrome Extension → Autofill",
    Icon: Zap,
    gradient: "linear-gradient(135deg, #2d1b69 0%, #0b1220 100%)",
  },
  {
    problem: "\"My resume looks the same whether I'm applying for a data role or a DevOps role. I can't afford custom resumes for every job.\"",
    solution: "AI-tailored resume in 30 seconds. We rewrite your bullets, inject the right keywords, and check ATS score — automatically.",
    stat: "Average ATS score improvement: +34 points after one tailoring pass.",
    cta: { label: "Score My Resume →", href: "/dashboard/ai-tools", color: C.amber },
    hotspot: "AI Tools → ATS Score",
    Icon: Target,
    gradient: "linear-gradient(135deg, #3d2000 0%, #0b1220 100%)",
  },
  {
    problem: "\"I have 5 different emails for different job hunts. My pipeline is a mess. I miss follow-ups constantly.\"",
    solution: "One dashboard tracks every application, auto-reads your email for recruiter replies, and reminds you when to follow up.",
    stat: "Candidates with structured follow-up get 2.3× more second-round interviews.",
    cta: { label: "Track Applications →", href: "/dashboard/jobs", color: C.green },
    hotspot: "Jobs & Apply → Pipeline",
    Icon: BarChart3,
    gradient: "linear-gradient(135deg, #0d3320 0%, #0b1220 100%)",
  },
]

// ── Capability cards ─────────────────────────────────────────────────────────
const CAPABILITIES = [
  {
    Icon: Bot,
    title: "AI Resume Tailor",
    desc: "Rewrites your resume for each JD. Injects missing keywords, caps bullets at 6, strips AI fingerprints.",
    href: "/dashboard/ai-tools",
    tag: "AI-powered",
    color: C.accent,
  },
  {
    Icon: BarChart3,
    title: "Job Pipeline",
    desc: "Kanban board tracks every application. Stage badges, follow-up reminders, CSV export.",
    href: "/dashboard/jobs",
    tag: "Organized",
    color: C.teal,
  },
  {
    Icon: Zap,
    title: "One-Click Autofill",
    desc: "Chrome extension fills Workday, Greenhouse, Lever forms in seconds. Work auth, salary, resume upload — everything.",
    href: "/dashboard/settings",
    tag: "Extension",
    color: C.purple,
  },
  {
    Icon: Target,
    title: "ATS Score",
    desc: "Scores your resume A–F before you apply. Shows exactly which keywords are missing and why you'd be filtered out.",
    href: "/dashboard/ai-tools",
    tag: "Score",
    color: C.amber,
  },
  {
    Icon: Mail,
    title: "Cover Letter AI",
    desc: "3 tones (professional, warm, direct). Generated from your resume + JD in 10 seconds. Copy or download.",
    href: "/dashboard/ai-tools",
    tag: "AI-powered",
    color: C.green,
  },
  {
    Icon: Mic,
    title: "Interview Prep",
    desc: "Role-specific questions. AI evaluates your answers in real time. Audio recording with instant feedback.",
    href: "/dashboard/ai-tools",
    tag: "Practice",
    color: "#f43f5e",
  },
]

// ── Stats ────────────────────────────────────────────────────────────────────
const STATS = [
  { label: "Applications tracked", value: 12400, suffix: "+" },
  { label: "Resumes tailored", value: 8900, suffix: "+" },
  { label: "Avg ATS score lift", value: 34, suffix: " pts" },
  { label: "Autofill time saved", value: 3, suffix: "min/app" },
]

export default function MarketingDashboard() {
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = SLIDES.length

  const next = useCallback(() => setSlide(s => (s + 1) % total), [total])
  const prev = useCallback(() => setSlide(s => (s - 1 + total) % total), [total])

  useEffect(() => {
    if (paused) return
    const t = setInterval(next, 5500)
    return () => clearInterval(t)
  }, [paused, next])

  const s = SLIDES[slide]

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 0 80px" }}>

      {/* ── Hero headline ──────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.25)",
          borderRadius: 20, padding: "5px 14px", marginBottom: 18,
        }}>
          <span style={{ fontSize: 11, color: C.accentL, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>
            MarketFit Platform
          </span>
        </div>
        <h1 style={{
          fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, color: C.text, margin: "0 0 14px",
          lineHeight: 1.2, letterSpacing: "-.02em",
        }}>
          Own Your Next Role
        </h1>
        <p style={{ fontSize: 16, color: C.muted, maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.7 }}>
          AI resume tailoring · H1B job intelligence · One-click autofill · Full pipeline tracking.
          Everything an international job seeker needs, in one place.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard/ai-tools" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: C.accent, color: "#fff", borderRadius: 10,
            padding: "11px 22px", fontWeight: 700, fontSize: 14,
            textDecoration: "none", boxShadow: `0 4px 20px ${C.accent}44`,
          }}><Zap size={14} fill="currentColor"/> Tailor My Resume</Link>
          <Link href="/dashboard/jobs" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,.06)", color: C.text,
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 10, padding: "11px 22px", fontWeight: 600, fontSize: 14,
            textDecoration: "none",
          }}><Globe size={14}/> Browse H1B Jobs</Link>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1,
        background: C.border, borderRadius: 14, overflow: "hidden", marginBottom: 40,
      }}>
        {STATS.map(st => (
          <div key={st.label} style={{
            background: C.card, padding: "22px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>
              <AnimCount to={st.value} suffix={st.suffix} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>
              {st.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Problem → Solution Carousel ────────────────────────────────────── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
            Real Problems. Real Solutions.
          </h2>
          <p style={{ fontSize: 13, color: C.muted, margin: "6px 0 0" }}>
            Click any solution to go directly to that feature
          </p>
        </div>

        <div
          style={{
            borderRadius: 18, overflow: "hidden", border: `1px solid ${C.border}`,
            background: s.gradient, position: "relative", cursor: "pointer",
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Progress bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,.1)" }}>
            <div style={{
              height: "100%", background: s.cta.color,
              width: paused ? "100%" : "0%",
              animation: paused ? "none" : "progress-fill 5.5s linear forwards",
            }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, minHeight: 260 }}>
            {/* Problem side */}
            <div style={{
              padding: "40px 36px", borderRight: `1px solid rgba(255,255,255,.06)`,
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{
                fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: ".08em",
                textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
              }}><Frown size={12}/> The Problem</div>
              <p style={{
                fontSize: 18, fontWeight: 500, color: "#e2e8f0", lineHeight: 1.6,
                fontStyle: "italic", margin: 0,
              }}>
                {s.problem}
              </p>
            </div>

            {/* Solution side */}
            <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{
                fontSize: 11, color: s.cta.color, fontWeight: 600, letterSpacing: ".08em",
                textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
              }}><CircleCheck size={12}/> MarketFit Solves It</div>
              <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.7, margin: "0 0 16px" }}>
                {s.solution}
              </p>
              <div style={{
                fontSize: 13, color: s.cta.color, background: `${s.cta.color}18`,
                border: `1px solid ${s.cta.color}30`, borderRadius: 8,
                padding: "8px 12px", marginBottom: 20, lineHeight: 1.5,
                display: "flex", alignItems: "flex-start", gap: 6,
              }}>
                <Lightbulb size={13} style={{ flexShrink: 0, marginTop: 2 }}/> {s.stat}
              </div>

              {/* Hotspot CTA */}
              <Link href={s.cta.href} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: s.cta.color, color: "#fff", borderRadius: 10,
                padding: "10px 18px", fontWeight: 700, fontSize: 13,
                textDecoration: "none", width: "fit-content",
                boxShadow: `0 4px 16px ${s.cta.color}44`,
              }}>
                <s.Icon size={14}/> {s.cta.label}
              </Link>
              <div style={{ fontSize: 11, color: C.hint, marginTop: 8 }}>
                ↗ Goes to: {s.hotspot}
              </div>
            </div>
          </div>

          {/* Slide nav */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 24px", borderTop: `1px solid rgba(255,255,255,.06)`,
            background: "rgba(0,0,0,.2)",
          }}>
            <button onClick={prev} style={{
              background: "rgba(255,255,255,.08)", border: "none", color: C.text,
              borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16,
            }}>←</button>

            <div style={{ display: "flex", gap: 8 }}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  style={{
                    width: i === slide ? 24 : 8, height: 8, borderRadius: 4,
                    background: i === slide ? s.cta.color : "rgba(255,255,255,.2)",
                    border: "none", cursor: "pointer", transition: "all .3s",
                  }}
                />
              ))}
            </div>

            <button onClick={next} style={{
              background: "rgba(255,255,255,.08)", border: "none", color: C.text,
              borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16,
            }}>→</button>
          </div>
        </div>
      </div>

      {/* ── Capabilities grid ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{
          fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 20px",
          textAlign: "center",
        }}>Everything You Need to Land the Role</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {CAPABILITIES.map(cap => (
            <Link key={cap.title} href={cap.href} style={{
              display: "block", textDecoration: "none",
              background: C.card, borderRadius: 14,
              border: `1px solid ${C.border}`,
              padding: "22px 20px",
              transition: "all .2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = cap.color + "50"
              ;(e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)"
              ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 8px 24px ${cap.color}18`
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = C.border
              ;(e.currentTarget as HTMLAnchorElement).style.transform = ""
              ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = ""
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: cap.color, display: "flex" }}><cap.Icon size={24}/></span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: ".06em",
                  textTransform: "uppercase", color: cap.color,
                  background: `${cap.color}18`, border: `1px solid ${cap.color}30`,
                  borderRadius: 6, padding: "3px 8px",
                }}>{cap.tag}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{cap.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{cap.desc}</div>
              <div style={{ marginTop: 14, fontSize: 12, color: cap.color, fontWeight: 600 }}>
                Open →
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: "36px 40px", marginBottom: 40,
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 28px", textAlign: "center" }}>
          How It Works
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
          {[
            { step: "1", Icon: ClipboardList, title: "Upload Your Resume", desc: "Drop your existing resume. We parse it instantly." },
            { step: "2", Icon: Search, title: "Find a Job", desc: "Browse H1B-verified roles or paste any JD." },
            { step: "3", Icon: Bot, title: "AI Tailors It", desc: "30 seconds. Targeted bullets, keywords, ATS score." },
            { step: "4", Icon: Zap, title: "One-Click Apply", desc: "Extension autofills the form. You just hit Submit." },
          ].map(item => (
            <div key={item.step} style={{ textAlign: "center" }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, margin: "0 auto 14px",
                background: `linear-gradient(135deg, ${C.accent}22, ${C.accent}0a)`,
                border: `1px solid ${C.accent}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.accent,
              }}>
                <item.Icon size={21}/>
              </div>
              <div style={{
                fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: ".08em",
                textTransform: "uppercase", marginBottom: 6,
              }}>Step {item.step}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA strip ──────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, #1e3a5f 0%, #1a1040 100%)`,
        border: `1px solid rgba(59,130,246,.25)`,
        borderRadius: 18, padding: "36px 40px", textAlign: "center",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: C.accentL }}><Rocket size={24}/></div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>
          Ready to land your role?
        </h2>
        <p style={{ fontSize: 14, color: C.muted, margin: "0 0 24px" }}>
          Start with a resume score — it takes 30 seconds and shows you exactly what recruiters see.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/dashboard/ai-tools" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: C.accent, color: "#fff", borderRadius: 10,
            padding: "12px 28px", fontWeight: 700, fontSize: 15,
            textDecoration: "none", boxShadow: `0 4px 24px ${C.accent}55`,
          }}><Target size={15}/> Score My Resume Free</Link>
          <Link href="/dashboard/jobs" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,.08)", color: C.text,
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 10, padding: "12px 24px", fontWeight: 600, fontSize: 15,
            textDecoration: "none",
          }}><Globe size={15}/> Browse Jobs</Link>
        </div>
      </div>

      <style>{`
        @keyframes progress-fill {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  )
}
