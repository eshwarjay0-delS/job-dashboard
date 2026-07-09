"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

/* ════════════════════════════════════════════════════════════════
   INLINE SVG ICONS
   ════════════════════════════════════════════════════════════════ */
const IcoZap    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
const IcoArrow  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
const IcoCheck  = ({ sz = 16 }: { sz?: number }) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoX      = ({ sz = 16 }: { sz?: number }) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoMinus  = ({ sz = 16 }: { sz?: number }) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoMenu   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IcoClose  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoBrain  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M9 13a4.5 4.5 0 0 0 3-4"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M12 13h4"/><path d="M12 18h6a2 2 0 0 1 2 2v1"/><path d="M12 8h8"/><path d="M16 8V5a2 2 0 0 1 2-2"/><circle cx="16" cy="13" r=".5"/><circle cx="18" cy="3" r=".5"/><circle cx="20" cy="21" r=".5"/><circle cx="20" cy="8" r=".5"/></svg>
const IcoUsers  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IcoShield = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
const IcoMail   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
const IcoStar   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>

/* ── Logo mark ─────────────────────────────────────────────────── */
function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#1d6fc4" fillOpacity="0.25"/>
      <path d="M7 22V10L13.5 18L16 14.5L18.5 18L25 10V22"
        stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="24" cy="9" r="2" fill="white" opacity="0.5"/>
    </svg>
  )
}

/* ── Animated counter ──────────────────────────────────────────── */
function AnimCounter({ target, suffix = "", duration = 1800 }: { target: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1)
          const ease = 1 - Math.pow(1 - t, 3)
          setVal(Math.round(ease * target))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        obs.disconnect()
      }
    }, { threshold: 0.5 })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])

  return <span ref={ref}>{val}{suffix}</span>
}

/* ── Email waitlist form ────────────────────────────────────────── */
function WaitlistInline({ plan = "starter" }: { plan?: string }) {
  const [email, setEmail]   = useState("")
  const [state, setState]   = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || state === "loading") return
    setState("loading")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plan }),
      })
      const data = await res.json()
      if (data.ok) {
        setState("success")
        setMessage(data.message || "You're on the list!")
      } else {
        setState("error")
        setMessage(data.error || "Something went wrong.")
      }
    } catch {
      setState("error")
      setMessage("Network error. Please try again.")
    }
  }

  if (state === "success") {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 100, padding: "12px 24px",
        fontSize: 15, color: "var(--white)",
      }}>
        <span style={{ fontSize: 18 }}>✓</span> {message}
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
      <input
        type="email" required
        value={email} onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        style={{
          padding: "14px 20px", borderRadius: 100,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "var(--white)", fontSize: 15, outline: "none",
          minWidth: 240, flex: 1, maxWidth: 320,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)" }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)" }}
      />
      <button type="submit" disabled={state === "loading"}
        className="mf-btn-hero"
        style={{ gap: 8, opacity: state === "loading" ? 0.7 : 1 }}>
        {state === "loading" ? "Joining…" : <><IcoZap /> Join waitlist</>}
      </button>
      {state === "error" && (
        <p style={{ width: "100%", textAlign: "center", fontSize: 13, color: "#ff6b6b" }}>{message}</p>
      )}
    </form>
  )
}

/* ── Product sections carousel — real redirects into the live app ──────── */
type CarouselSlide = {
  key: string; tag: string; title: React.ReactNode; body: string
  cta: string; href: string; accent: string; accentSoft: string
  stats: { v: string; l: string }[]
  visual: React.ReactNode
}

const CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    key: "jobs", tag: "Job Intelligence",
    title: <>20+ job boards.<br/>One intelligent feed.</>,
    body: "JSearch aggregates LinkedIn, Indeed, Glassdoor, Dice, and 16 more — filtered by match score, H1B sponsorship, salary, and visa category.",
    cta: "Browse live jobs →", href: "/dashboard/jobs",
    accent: "#60a5fa", accentSoft: "rgba(96,165,250,0.14)",
    stats: [{ v: "20+", l: "Boards unified" }, { v: "94%", l: "Top match" }, { v: "Live", l: "Real-time" }],
    visual: (
      <div className="mf-cvis-jobs">
        {[{ pct: "94%", w: "72%" }, { pct: "87%", w: "58%" }, { pct: "82%", w: "48%" }].map((row, i) => (
          <div key={i} className="mf-cvis-jobrow">
            <div className="mf-cvis-jobrow__dot"/>
            <div className="mf-cvis-jobrow__bars">
              <div className="mf-cvis-jobrow__bar" style={{ width: row.w }}/>
              <div className="mf-cvis-jobrow__bar mf-cvis-jobrow__bar--sm"/>
            </div>
            <span className="mf-cvis-jobrow__pct">{row.pct}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "resume", tag: "Resume AI",
    title: <>Tailored. Scored.<br/>Downloaded in seconds.</>,
    body: "Paste a JD — MarketFit rewrites your best-matching resume, scores it live against the ATS, and exports a clean .docx. Powered by Claude.",
    cta: "Tailor a resume →", href: "/dashboard/resume",
    accent: "#93c5fd", accentSoft: "rgba(147,197,253,0.14)",
    stats: [{ v: "12s", l: "Avg tailor time" }, { v: "98", l: "Peak ATS score" }, { v: "10", l: "Rule audit" }],
    visual: (
      <div className="mf-cvis-score">
        <div className="mf-cvis-score__row">
          <span className="mf-cvis-score__lbl">Before</span>
          <div className="mf-cvis-score__track"><div className="mf-cvis-score__fill" style={{ width: "67%", opacity: .45 }}/></div>
          <span className="mf-cvis-score__v" style={{ opacity: .6 }}>67</span>
        </div>
        <div className="mf-cvis-score__row">
          <span className="mf-cvis-score__lbl">After</span>
          <div className="mf-cvis-score__track"><div className="mf-cvis-score__fill" style={{ width: "96%" }}/></div>
          <span className="mf-cvis-score__v">96</span>
        </div>
      </div>
    ),
  },
  {
    key: "tracker", tag: "Application Tracker",
    title: <>6-stage pipeline.<br/>Full visibility.</>,
    body: "Saved → Applied → Screen → Interview → Offer → Closed. Every application, every candidate, one Kanban board.",
    cta: "Open the tracker →", href: "/dashboard/jobs",
    accent: "#fbbf24", accentSoft: "rgba(251,191,36,0.14)",
    stats: [{ v: "6", l: "Pipeline stages" }, { v: "Kanban", l: "& list views" }, { v: "Local", l: "Private data" }],
    visual: (
      <div className="mf-cvis-kanban">
        {[
          { label: "Applied",   chips: [true, false] },
          { label: "Screen",    chips: [true] },
          { label: "Interview", chips: [true, true] },
          { label: "Offer",     chips: [false] },
        ].map(col => (
          <div key={col.label} className="mf-cvis-kanban__col">
            <div className="mf-cvis-kanban__label">{col.label}</div>
            {col.chips.map((on, ci) => (
              <div key={ci} className={`mf-cvis-kanban__chip${on ? " on" : ""}`}/>
            ))}
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "aitools", tag: "AI Copilot",
    title: <>Interview prep.<br/>Cover letters. Always on.</>,
    body: "Seven Claude-powered tools — cover letters, interview prep, company research, reply drafting — in one workspace.",
    cta: "Try AI Tools →", href: "/dashboard/ai-tools",
    accent: "#c4b5fd", accentSoft: "rgba(196,181,253,0.14)",
    stats: [{ v: "7", l: "AI tools" }, { v: "1", l: "Workspace" }, { v: "Claude", l: "Powered" }],
    visual: (
      <div className="mf-cvis-chat">
        <div className="mf-cvis-chat__bubble mf-cvis-chat__bubble--user">Draft a cover letter for this role</div>
        <div className="mf-cvis-chat__bubble mf-cvis-chat__bubble--ai">
          <span/><span/><span/>
        </div>
      </div>
    ),
  },
  {
    key: "documents", tag: "Documents",
    title: <>Your resume library.<br/>Organized, not scattered.</>,
    body: "Upload, fold into folders, rename, and version every resume variant — then tailor straight from the library.",
    cta: "Manage documents →", href: "/dashboard/documents",
    accent: "#7dd3fc", accentSoft: "rgba(125,211,252,0.14)",
    stats: [{ v: "∞", l: "Resume slots" }, { v: "Zip", l: "Bulk import" }, { v: "Folders", l: "Organize" }],
    visual: (
      <div className="mf-cvis-files">
        {["📁 C2C GC", "📁 CYBER GC", "📄 Eshwar_Resume.docx"].map((f, i) => (
          <div key={i} className="mf-cvis-files__row" style={{ paddingLeft: i === 2 ? 20 : 0 }}>{f}</div>
        ))}
      </div>
    ),
  },
  {
    key: "extension", tag: "Chrome Extension",
    title: <>Autofill any ATS.<br/>Instantly.</>,
    body: "14 ATS platforms covered — Workday, Greenhouse, Lever, Workable, Rippling, iCIMS, Taleo, and more. One click fills every field.",
    cta: "Get the extension →", href: "/signup",
    accent: "#60a5fa", accentSoft: "rgba(96,165,250,0.14)",
    stats: [{ v: "14+", l: "ATS platforms" }, { v: "1-click", l: "Form fill" }, { v: "0s", l: "Manual typing" }],
    visual: (
      <div className="mf-cvis-ext">
        <div className="mf-cvis-ext__form">
          {[false, true, true, false, true].map((f, i) => (
            <div key={i} className={`mf-cvis-ext__field${f ? " on" : ""}`}/>
          ))}
        </div>
        <div className="mf-cvis-ext__panel">
          <div className="mf-cvis-ext__item"/><div className="mf-cvis-ext__item"/>
          <div className="mf-cvis-ext__item mf-cvis-ext__item--cta"/>
        </div>
      </div>
    ),
  },
]

function SectionsCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = CAROUSEL_SLIDES.length
  const s = CAROUSEL_SLIDES[active]

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActive(i => (i + 1) % total), 5000)
    return () => clearInterval(t)
  }, [paused, total])

  return (
    <div className="mf-carousel mf-reveal" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mf-carousel__main">
        <div className="mf-carousel__visual" style={{ "--slide-accent": s.accent, "--slide-accent-soft": s.accentSoft } as React.CSSProperties}>
          <div className="mf-carousel__glow" aria-hidden="true"/>
          <div className="mf-carousel__counter">{active + 1} / {total}</div>
          <div className="mf-carousel__mark" aria-hidden="true">
            {s.visual}
          </div>
        </div>
        <div className="mf-carousel__content">
          <span className="mf-carousel__tag" style={{ color: s.accent, borderColor: s.accent + "55", background: s.accentSoft }}>
            {s.tag}
          </span>
          <h3 className="mf-carousel__title">{s.title}</h3>
          <p className="mf-carousel__body">{s.body}</p>
          <div className="mf-carousel__stats">
            {s.stats.map(st => (
              <div key={st.l}>
                <p className="mf-carousel__stat-v" style={{ color: s.accent }}>{st.v}</p>
                <p className="mf-carousel__stat-l">{st.l}</p>
              </div>
            ))}
          </div>
          <Link href={s.href} className="mf-btn-hero" style={{ width: "fit-content", fontSize: 14, padding: "12px 26px" }}>
            {s.cta}
          </Link>
        </div>
      </div>

      <div className="mf-carousel__controls">
        <div className="mf-carousel__dots">
          {CAROUSEL_SLIDES.map((slide, i) => (
            <button key={slide.key} aria-label={`Go to ${slide.tag}`} onClick={() => setActive(i)}
              className={`mf-carousel__dot${i === active ? " on" : ""}`}
              style={i === active ? { background: s.accent } : undefined}/>
          ))}
        </div>
        <div className="mf-carousel__pills">
          {CAROUSEL_SLIDES.map((slide, i) => (
            <button key={slide.key} onClick={() => setActive(i)}
              className={`mf-carousel__pill${i === active ? " on" : ""}`}
              style={i === active ? { color: slide.accent, borderColor: slide.accent + "66", background: slide.accentSoft } : undefined}>
              {slide.tag}
            </button>
          ))}
        </div>
        <div className="mf-carousel__nav">
          <button aria-label="Previous section" onClick={() => setActive(i => (i - 1 + total) % total)}>←</button>
          <button aria-label="Next section" onClick={() => setActive(i => (i + 1) % total)}>→</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function Home() {
  const [scrolled,      setScrolled]      = useState(false)
  const [scrollPct,     setScrollPct]     = useState(0)
  const [heroReady,     setHeroReady]     = useState(false)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [ringAnimated,  setRingAnimated]  = useState(false)
  const ringRef  = useRef<SVGCircleElement>(null)

  /* scroll: nav blur + progress bar */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 60)
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrollPct(max > 0 ? (y / max) * 100 : 0)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* hero entrance */
  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 80)
    return () => clearTimeout(t)
  }, [])

  /* reveal observer */
  useEffect(() => {
    const els = document.querySelectorAll(".mf-reveal, .mf-stagger")
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("mf-in-view"); obs.unobserve(e.target) }
      })
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  /* score ring */
  useEffect(() => {
    if (!ringRef.current) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setRingAnimated(true); obs.disconnect() }
    }, { threshold: 0.4 })
    obs.observe(ringRef.current)
    return () => obs.disconnect()
  }, [])

  /* lock body scroll when mobile menu open */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  const headline = "Own Your Next Role."
  const words = headline.split(" ")
  const charDelay = (i: number) => 200 + i * 28

  const NAV_LINKS = [
    { href: "#features",     label: "Features"    },
    { href: "#pricing",      label: "Pricing"     },
    { href: "#vs",           label: "vs Jobright" },
    { href: "#testimonials", label: "Stories"     },
  ]

  return (
    <div className="mf-root">

      {/* ── GLOBAL STYLES ─────────────────────────────────────────── */}
      <style>{`
        .mf-root {
          --black: #060d1a;
          --gray-950: #090f1e;
          --gray-900: #0d1628;
          --gray-800: #122035;
          --gray-700: #1a2e47;
          --gray-600: #5c7a9e;
          --gray-400: #8ba5c2;
          --gray-200: #c8d9ef;
          --white: #ffffff;
          --accent: #1d6fc4;
          --accent-h: #1558a0;
          --accent-glow: rgba(29,111,196,0.35);
          --accent-vivid: #3b82f6;
          --font-display: 'Clash Display', 'Helvetica Neue', sans-serif;
          --font-body: 'Satoshi', 'Inter', system-ui, sans-serif;
          --ease: cubic-bezier(0.16, 1, 0.3, 1);
          background: var(--black);
          color: var(--white);
          font-family: var(--font-body);
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }
        .mf-root *, .mf-root *::before, .mf-root *::after { box-sizing: border-box; }
        .mf-root a { text-decoration: none; color: inherit; }

        /* SCROLL PROGRESS */
        .mf-progress {
          position: fixed; top: 0; left: 0; height: 2px; z-index: 9999;
          background: linear-gradient(90deg, var(--accent) 0%, var(--accent-vivid) 60%, #60a5fa 100%);
          transition: width .1s linear;
          pointer-events: none;
        }

        /* NAV */
        .mf-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 24px 32px;
          display: flex; align-items: center; justify-content: space-between;
          transition: background 0.4s var(--ease), backdrop-filter 0.4s;
        }
        .mf-nav.scrolled {
          background: rgba(6,13,26,.92);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(29,111,196,0.2);
        }
        .mf-nav__logo {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--font-display);
          font-weight: 700; font-size: 18px; letter-spacing: -0.02em;
        }
        .mf-nav__links { display: flex; align-items: center; gap: 32px; list-style: none; }
        .mf-nav__links a {
          font-size: 14px; color: var(--gray-400); letter-spacing: 0.02em;
          transition: color 0.2s;
        }
        .mf-nav__links a:hover { color: var(--white); }
        .mf-nav__cta { display: flex; align-items: center; gap: 16px; }
        .mf-btn-ghost {
          font-size: 14px; font-weight: 500; color: var(--gray-400);
          padding: 10px 20px; transition: color 0.2s;
          background: none; border: none; cursor: pointer;
        }
        .mf-btn-ghost:hover { color: var(--white); }
        .mf-btn-primary {
          font-size: 14px; font-weight: 600;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-vivid) 100%);
          color: var(--white);
          padding: 10px 24px; border-radius: 100px;
          transition: opacity .2s, transform .2s var(--ease), box-shadow .2s;
          display: inline-flex; align-items: center;
          box-shadow: 0 0 0 0 var(--accent-glow);
        }
        .mf-btn-primary:hover { opacity: .92; transform: scale(1.02); box-shadow: 0 4px 20px var(--accent-glow); }
        .mf-nav__hamburger {
          display: none; width: 44px; height: 44px;
          align-items: center; justify-content: center;
          background: none; border: none; cursor: pointer;
          color: var(--white);
        }

        /* MOBILE DRAWER */
        .mf-drawer-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          opacity: 0; pointer-events: none;
          transition: opacity .3s var(--ease);
        }
        .mf-drawer-overlay.open { opacity: 1; pointer-events: all; }
        .mf-drawer {
          position: fixed; top: 0; right: 0; bottom: 0; width: 300px;
          background: #0b1728; border-left: 1px solid rgba(29,111,196,0.2); z-index: 201;
          padding: 24px;
          transform: translateX(100%);
          transition: transform .3s var(--ease);
          display: flex; flex-direction: column; gap: 8px;
        }
        .mf-drawer.open { transform: translateX(0); }
        .mf-drawer__header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px;
        }
        .mf-drawer-link {
          display: block; padding: 14px 16px; border-radius: 8px;
          font-size: 16px; font-weight: 500; color: var(--gray-400);
          transition: all .15s;
        }
        .mf-drawer-link:hover { background: rgba(29,111,196,.1); color: var(--white); }
        .mf-drawer__cta { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }

        /* HERO */
        .mf-hero {
          position: relative; min-height: 100svh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 120px 32px 96px; overflow: hidden;
        }
        .mf-hero__bg {
          position: absolute; inset: 0; z-index: 0;
          background:
            radial-gradient(ellipse 70% 55% at 50% -5%, rgba(29,111,196,0.55) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 20%, rgba(59,130,246,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 40% 35% at 20% 30%, rgba(29,111,196,0.12) 0%, transparent 60%),
            var(--black);
        }
        .mf-hero__grain {
          position: absolute; inset: 0; z-index: 0; opacity: .06;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
        }
        .mf-hero__vignette {
          position: absolute; inset: 0; z-index: 0;
          background: radial-gradient(ellipse 120% 120% at 50% 50%, transparent 40%, rgba(0,0,0,.7) 100%);
        }
        .mf-hero__content { position: relative; z-index: 1; max-width: 1000px; }
        .mf-hero__eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 500;
          letter-spacing: .18em; text-transform: uppercase; color: #60a5fa;
          margin-bottom: 32px; opacity: 0;
          transition: opacity .6s var(--ease), transform .6s var(--ease);
          transform: translateY(12px);
          background: rgba(29,111,196,0.1); border: 1px solid rgba(29,111,196,0.25);
          padding: 8px 18px; border-radius: 100px;
        }
        .mf-hero__eyebrow.ready { opacity: 1; transform: translateY(0); }
        .mf-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-vivid); opacity: 1; box-shadow: 0 0 8px var(--accent-vivid); }
        .mf-hero__headline {
          font-family: var(--font-display);
          font-size: clamp(56px, 9vw, 140px);
          font-weight: 600; line-height: 1.0;
          letter-spacing: -.015em; color: var(--white); margin-bottom: 32px;
        }
        .mf-char {
          display: inline-block; opacity: 0; transform: translateY(40px);
          transition: opacity .7s var(--ease), transform .7s var(--ease);
        }
        .mf-char.space { width: 0.3em; }
        .mf-char.ready { opacity: 1; transform: translateY(0); }
        .mf-hero__sub {
          font-size: clamp(17px, 1.8vw, 22px); font-weight: 300; color: var(--gray-400);
          max-width: 560px; margin: 0 auto 40px; line-height: 1.65;
          opacity: 0; transform: translateY(16px);
          transition: opacity .8s var(--ease), transform .8s var(--ease);
        }
        .mf-hero__sub.ready { opacity: 1; transform: translateY(0); }
        .mf-hero__actions {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; flex-wrap: wrap;
          opacity: 0; transform: translateY(16px);
          transition: opacity .8s var(--ease), transform .8s var(--ease);
        }
        .mf-hero__actions.ready { opacity: 1; transform: translateY(0); }
        .mf-hero__waitlist {
          margin-top: 28px;
          opacity: 0; transform: translateY(16px);
          transition: opacity .8s var(--ease), transform .8s var(--ease);
        }
        .mf-hero__waitlist.ready { opacity: 1; transform: translateY(0); }
        .mf-hero__note {
          margin-top: 14px; font-size: 12px; color: var(--gray-600);
          opacity: 0; transition: opacity 1s;
        }
        .mf-hero__note.ready { opacity: 1; }
        .mf-btn-hero {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 16px; font-weight: 700;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-vivid) 100%);
          color: var(--white);
          padding: 14px 36px; border-radius: 100px;
          transition: transform .3s var(--ease), box-shadow .3s;
          border: none; cursor: pointer;
          box-shadow: 0 4px 24px rgba(29,111,196,0.45);
        }
        .mf-btn-hero:hover { transform: scale(1.04); box-shadow: 0 8px 36px rgba(29,111,196,0.6); }
        .mf-btn-hero-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 16px; font-weight: 500; color: var(--gray-400);
          padding: 14px 28px; border-radius: 100px;
          border: 1px solid rgba(29,111,196,0.25);
          transition: color .2s, border-color .2s, background .2s;
        }
        .mf-btn-hero-ghost:hover { color: var(--white); border-color: rgba(29,111,196,0.5); background: rgba(29,111,196,0.08); }
        .mf-scroll-cue {
          position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1;
          opacity: 0; animation: mf-scroll-pulse 2.5s ease-in-out 2s infinite;
        }
        .mf-scroll-cue span { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--gray-600); }
        .mf-scroll-line { width: 1px; height: 48px; background: linear-gradient(to bottom, rgba(29,111,196,0.7), transparent); }
        @keyframes mf-scroll-pulse {
          0%, 100% { opacity: .4; transform: translateX(-50%) translateY(0); }
          50% { opacity: .9; transform: translateX(-50%) translateY(6px); }
        }

        /* STAT BAR */
        .mf-stat-bar { background: var(--gray-900); border-top: 1px solid rgba(29,111,196,0.2); border-bottom: 1px solid rgba(29,111,196,0.2); padding: 32px; }
        .mf-stat-bar__inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(29,111,196,0.15); }
        .mf-stat-item { background: var(--gray-900); padding: 32px 24px; text-align: center; }
        .mf-stat-num { font-family: var(--font-display); font-size: clamp(28px, 3.5vw, 48px); font-weight: 600; color: var(--white); letter-spacing: -.03em; line-height: 1; margin-bottom: 8px; display: block; background: linear-gradient(135deg, #fff 30%, #93c5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .mf-stat-label { font-size: 12px; color: var(--gray-400); letter-spacing: .08em; text-transform: uppercase; }

        /* SECTIONS */
        .mf-section { padding: clamp(64px, 10vw, 128px) 32px; }
        .mf-container { max-width: 1200px; margin: 0 auto; }
        .mf-section-label { font-size: 12px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; color: #60a5fa; margin-bottom: 24px; }
        .mf-section-title { font-family: var(--font-display); font-size: clamp(28px, 3.5vw, 52px); font-weight: 600; line-height: 1.08; letter-spacing: -.03em; color: var(--white); }
        .mf-section-body { font-size: clamp(16px, 1.8vw, 20px); font-weight: 300; color: var(--gray-400); line-height: 1.65; max-width: 520px; }

        /* DIFF */
        .mf-diff { background: var(--black); }
        .mf-diff__grid { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(32px, 6vw, 96px); align-items: center; }
        .mf-diff__visual { aspect-ratio: 4/5; background: linear-gradient(160deg, var(--gray-900) 0%, #0d1e3a 100%); border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(29,111,196,0.15); }
        .mf-ring-track { fill: none; stroke: rgba(29,111,196,0.15); stroke-width: 3; }
        .mf-ring-fill { fill: none; stroke: url(#ringGrad); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 377; stroke-dashoffset: 377; transition: stroke-dashoffset 2s var(--ease); }
        .mf-ring-fill.animated { stroke-dashoffset: 8; }
        .mf-diff__list { margin-top: 48px; list-style: none; display: flex; flex-direction: column; gap: 24px; }
        .mf-diff__item { display: flex; align-items: flex-start; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid rgba(29,111,196,0.12); }
        .mf-diff__item:last-child { border-bottom: none; padding-bottom: 0; }
        .mf-diff__icon { color: #60a5fa; margin-top: 2px; flex-shrink: 0; }
        .mf-diff__title { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--white); margin-bottom: 4px; letter-spacing: -.01em; }
        .mf-diff__text { font-size: 14px; color: var(--gray-400); line-height: 1.6; }

        /* FEATURES */
        .mf-features { background: var(--gray-950); }

        /* SECTIONS CAROUSEL */
        .mf-carousel { border-radius: 4px; overflow: hidden; border: 1px solid rgba(29,111,196,0.18); background: var(--gray-950); margin-top: 64px; }
        .mf-carousel__main { display: grid; grid-template-columns: 1fr 1fr; min-height: 320px; }
        .mf-carousel__visual { position: relative; overflow: hidden; background: linear-gradient(160deg, var(--gray-900) 0%, #0d1e3a 100%); display: flex; align-items: center; justify-content: center; padding: 32px; }
        .mf-carousel__glow { position: absolute; inset: 0; background: radial-gradient(ellipse 60% 50% at 50% 40%, var(--slide-accent-soft, rgba(96,165,250,.14)) 0%, transparent 70%); transition: background .4s; pointer-events: none; }
        .mf-carousel__counter { position: absolute; bottom: 16px; left: 16px; background: rgba(0,0,0,.35); backdrop-filter: blur(8px); border-radius: 20px; padding: 4px 12px; font-size: 11px; font-weight: 700; color: #fff; letter-spacing: .03em; z-index: 1; }
        .mf-carousel__mark { position: relative; z-index: 1; width: 100%; max-width: 300px; display: flex; flex-direction: column; gap: 14px; }
        .mf-carousel__content { padding: 40px 44px; display: flex; flex-direction: column; justify-content: center; }

        /* Per-slide visual mockups */
        .mf-cvis-jobs { display: flex; flex-direction: column; gap: 10px; }
        .mf-cvis-jobrow { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.05); border-radius: 6px; padding: 10px 12px; }
        .mf-cvis-jobrow__dot { width: 22px; height: 22px; border-radius: 5px; background: rgba(255,255,255,.1); flex-shrink: 0; }
        .mf-cvis-jobrow__bars { flex: 1; display: flex; flex-direction: column; gap: 5px; }
        .mf-cvis-jobrow__bar { height: 7px; border-radius: 1px; background: var(--slide-accent, #60a5fa); opacity: .65; }
        .mf-cvis-jobrow__bar--sm { width: 40%; opacity: .25; background: #fff; }
        .mf-cvis-jobrow__pct { font-family: var(--font-display); font-size: 11px; font-weight: 700; color: var(--slide-accent, #60a5fa); flex-shrink: 0; }

        .mf-cvis-score { display: flex; flex-direction: column; gap: 18px; width: 100%; }
        .mf-cvis-score__row { display: flex; align-items: center; gap: 12px; }
        .mf-cvis-score__lbl { font-size: 11px; color: var(--gray-400); width: 44px; flex-shrink: 0; }
        .mf-cvis-score__track { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); overflow: hidden; }
        .mf-cvis-score__fill { height: 100%; border-radius: 4px; background: var(--slide-accent, #93c5fd); transition: width 1s var(--ease); }
        .mf-cvis-score__v { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--white); width: 24px; text-align: right; flex-shrink: 0; }

        .mf-cvis-kanban { display: flex; gap: 8px; width: 100%; }
        .mf-cvis-kanban__col { flex: 1; background: rgba(255,255,255,.04); border-radius: 4px; padding: 8px 6px; display: flex; flex-direction: column; gap: 5px; }
        .mf-cvis-kanban__label { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 4px; }
        .mf-cvis-kanban__chip { height: 22px; border-radius: 2px; background: rgba(255,255,255,.06); }
        .mf-cvis-kanban__chip.on { background: var(--slide-accent, #fbbf24); opacity: .8; }

        .mf-cvis-chat { display: flex; flex-direction: column; gap: 10px; width: 100%; }
        .mf-cvis-chat__bubble { border-radius: 12px; padding: 10px 14px; font-size: 12px; line-height: 1.5; max-width: 85%; }
        .mf-cvis-chat__bubble--user { align-self: flex-end; background: rgba(255,255,255,.08); color: var(--gray-200); border-bottom-right-radius: 2px; }
        .mf-cvis-chat__bubble--ai { align-self: flex-start; background: var(--slide-accent, #c4b5fd); border-bottom-left-radius: 2px; display: flex; gap: 4px; opacity: .85; }
        .mf-cvis-chat__bubble--ai span { width: 5px; height: 5px; border-radius: 50%; background: #0d1628; animation: mf-carousel-typing 1.2s infinite; }
        .mf-cvis-chat__bubble--ai span:nth-child(2) { animation-delay: .15s; }
        .mf-cvis-chat__bubble--ai span:nth-child(3) { animation-delay: .3s; }
        @keyframes mf-carousel-typing { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }

        .mf-cvis-files { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .mf-cvis-files__row { background: rgba(255,255,255,.05); border-radius: 6px; padding: 9px 12px; font-size: 12px; color: var(--gray-200); }

        .mf-cvis-ext { display: flex; width: 100%; height: 160px; border-radius: 6px; overflow: hidden; background: rgba(255,255,255,.03); }
        .mf-cvis-ext__form { flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .mf-cvis-ext__field { height: 20px; border-radius: 2px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); }
        .mf-cvis-ext__field.on { background: var(--slide-accent-soft, rgba(96,165,250,.14)); border-color: var(--slide-accent, #60a5fa); }
        .mf-cvis-ext__panel { width: 64px; background: rgba(0,0,0,.2); padding: 10px 8px; display: flex; flex-direction: column; gap: 6px; }
        .mf-cvis-ext__item { height: 16px; border-radius: 2px; background: rgba(255,255,255,.08); }
        .mf-cvis-ext__item--cta { background: var(--slide-accent, #60a5fa); height: 20px; margin-top: 4px; }
        .mf-carousel__tag { display: inline-flex; width: fit-content; padding: 4px 14px; border-radius: 999px; border: 1px solid; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 18px; transition: all .3s; }
        .mf-carousel__title { font-family: var(--font-display); font-size: clamp(22px, 2.4vw, 30px); font-weight: 600; color: var(--white); letter-spacing: -.02em; line-height: 1.2; margin-bottom: 14px; }
        .mf-carousel__body { font-size: 14px; color: var(--gray-400); line-height: 1.65; max-width: 400px; margin-bottom: 24px; }
        .mf-carousel__stats { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 28px; }
        .mf-carousel__stat-v { font-family: var(--font-display); font-size: 20px; font-weight: 700; letter-spacing: -.02em; line-height: 1; transition: color .3s; }
        .mf-carousel__stat-l { font-size: 10.5px; color: var(--gray-600); font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: .05em; }
        .mf-carousel__controls { background: var(--gray-900); border-top: 1px solid rgba(29,111,196,0.15); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .mf-carousel__dots { display: flex; gap: 6px; align-items: center; }
        .mf-carousel__dot { width: 7px; height: 7px; border-radius: 4px; background: rgba(29,111,196,0.25); border: none; cursor: pointer; padding: 0; transition: width .25s, background .25s; }
        .mf-carousel__dot.on { width: 22px; }
        .mf-carousel__pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .mf-carousel__pill { padding: 4px 11px; border-radius: 20px; border: 1px solid rgba(29,111,196,0.2); background: transparent; color: var(--gray-600); font-size: 11px; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap; }
        .mf-carousel__nav { display: flex; gap: 6px; }
        .mf-carousel__nav button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(29,111,196,0.25); background: transparent; color: var(--white); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .15s, background .15s; }
        .mf-carousel__nav button:hover { border-color: var(--accent-vivid); background: rgba(29,111,196,.1); }
        @media (max-width: 900px) {
          .mf-carousel__main { grid-template-columns: 1fr; }
          .mf-carousel__visual { min-height: 180px; }
          .mf-carousel__controls { justify-content: center; }
          .mf-carousel__pills { display: none; }
        }

        /* TESTIMONIALS */
        .mf-testi { background: var(--black); }
        .mf-testi__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(29,111,196,0.18); margin-top: 64px; }
        .mf-testi-card { background: var(--black); padding: 32px; }
        .mf-testi-stars { display: flex; gap: 3px; color: #fbbf24; margin-bottom: 16px; }
        .mf-testi-quote { font-family: var(--font-display); font-size: clamp(16px, 1.4vw, 20px); font-weight: 500; color: var(--white); line-height: 1.45; letter-spacing: -.015em; margin-bottom: 24px; }
        .mf-testi-meta { display: flex; align-items: center; gap: 12px; }
        .mf-testi-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-vivid) 100%); border: 1px solid rgba(29,111,196,0.3); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 14px; font-weight: 600; color: var(--white); flex-shrink: 0; }
        .mf-testi-name { font-size: 14px; font-weight: 500; color: var(--white); }
        .mf-testi-role { font-size: 12px; color: var(--gray-600); margin-top: 2px; }

        /* VS TABLE */
        .mf-vs { background: var(--black); }
        .mf-vs__wrap { margin-top: 64px; overflow-x: auto; }
        .mf-vs__table { width: 100%; border-collapse: collapse; border: 1px solid rgba(29,111,196,0.15); }
        .mf-vs__table thead tr { border-bottom: 1px solid rgba(29,111,196,0.2); }
        .mf-vs__table th { padding: 20px 24px; font-family: var(--font-display); font-size: 14px; font-weight: 600; color: var(--white); text-align: left; }
        .mf-vs__table th:not(:first-child) { text-align: center; }
        .mf-vs__table th.mf-col { background: rgba(29,111,196,0.12); border-left: 1px solid rgba(29,111,196,0.25); border-right: 1px solid rgba(29,111,196,0.25); }
        .mf-vs__table td { padding: 14px 24px; font-size: 14px; color: var(--gray-400); border-top: 1px solid rgba(29,111,196,0.08); vertical-align: middle; }
        .mf-vs__table td:not(:first-child) { text-align: center; }
        .mf-vs__table td.mf-col { background: rgba(29,111,196,0.06); border-left: 1px solid rgba(29,111,196,0.15); border-right: 1px solid rgba(29,111,196,0.15); color: var(--white); }
        .mf-check { color: #60a5fa; } .mf-cross { color: var(--gray-600); }

        /* PRICING */
        .mf-pricing { background: var(--gray-950); }
        .mf-pricing__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(29,111,196,0.18); margin-top: 64px; }
        .mf-price-card { background: var(--gray-950); padding: 32px; position: relative; }
        .mf-price-card--feat { background: linear-gradient(145deg, #0d2248 0%, #0f2d5a 100%); color: var(--white); border: 1px solid rgba(29,111,196,0.4); box-shadow: 0 0 60px rgba(29,111,196,0.2); }
        .mf-price-tier { font-size: 12px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 16px; }
        .mf-price-card--feat .mf-price-tier { color: #93c5fd; }
        .mf-price-amount { font-family: var(--font-display); font-size: clamp(36px, 4vw, 56px); font-weight: 600; color: var(--white); letter-spacing: -.04em; line-height: 1; margin-bottom: 8px; }
        .mf-price-card--feat .mf-price-amount { color: var(--white); }
        .mf-price-period { font-size: 12px; color: var(--gray-600); margin-bottom: 24px; }
        .mf-price-card--feat .mf-price-period { color: rgba(147,197,253,.6); }
        .mf-price-desc { font-size: 14px; color: var(--gray-400); line-height: 1.6; margin-bottom: 32px; min-height: 48px; }
        .mf-price-card--feat .mf-price-desc { color: rgba(147,197,253,.8); }
        .mf-price-feats { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
        .mf-price-feat { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: var(--gray-400); }
        .mf-price-card--feat .mf-price-feat { color: rgba(147,197,253,.85); }
        .mf-btn-plan { width: 100%; display: block; text-align: center; font-size: 14px; font-weight: 600; padding: 14px 24px; border-radius: 2px; border: 1px solid rgba(29,111,196,0.25); color: var(--white); transition: background .2s; cursor: pointer; }
        .mf-btn-plan:hover { background: rgba(29,111,196,0.1); }
        .mf-price-card--feat .mf-btn-plan { background: linear-gradient(135deg, var(--accent) 0%, var(--accent-vivid) 100%); color: var(--white); border-color: transparent; box-shadow: 0 4px 20px rgba(29,111,196,0.4); }
        .mf-price-card--feat .mf-btn-plan:hover { box-shadow: 0 6px 30px rgba(29,111,196,0.6); opacity: .9; }

        /* CTA FINALE */
        .mf-cta { background: var(--black); text-align: center; padding: clamp(96px, 14vw, 160px) 32px; position: relative; overflow: hidden; }
        .mf-cta__bg { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 100%, rgba(29,111,196,0.4) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 20% 80%, rgba(59,130,246,0.15) 0%, transparent 60%); }
        .mf-cta__content { position: relative; z-index: 1; }
        .mf-cta__title { font-family: var(--font-display); font-size: clamp(40px, 5vw, 80px); font-weight: 600; color: var(--white); letter-spacing: -.035em; line-height: 1.0; margin-bottom: 24px; max-width: 800px; margin-left: auto; margin-right: auto; }
        .mf-cta__sub { font-size: clamp(16px, 1.8vw, 22px); font-weight: 300; color: var(--gray-400); margin-bottom: 48px; max-width: 440px; margin-left: auto; margin-right: auto; }
        .mf-cta__actions { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; }

        /* FOOTER */
        .mf-footer { background: var(--gray-950); border-top: 1px solid rgba(29,111,196,0.2); padding: 48px 32px; }
        .mf-footer__inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 24px; }
        .mf-footer__logo { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: 15px; color: var(--gray-400); }
        .mf-footer__links { display: flex; gap: 24px; list-style: none; flex-wrap: wrap; }
        .mf-footer__links a { font-size: 12px; color: var(--gray-600); transition: color .2s; }
        .mf-footer__links a:hover { color: var(--gray-400); }
        .mf-footer__copy { font-size: 12px; color: var(--gray-600); }

        /* REVEAL */
        .mf-reveal { opacity: 0; transform: translateY(28px); transition: opacity .8s var(--ease), transform .8s var(--ease); }
        .mf-reveal.mf-in-view { opacity: 1; transform: translateY(0); }
        .mf-stagger > * { opacity: 0; transform: translateY(24px); transition: opacity .7s var(--ease), transform .7s var(--ease); }
        .mf-stagger.mf-in-view > * { opacity: 1; transform: translateY(0); }
        .mf-stagger.mf-in-view > *:nth-child(1) { transition-delay: 0ms; }
        .mf-stagger.mf-in-view > *:nth-child(2) { transition-delay: 80ms; }
        .mf-stagger.mf-in-view > *:nth-child(3) { transition-delay: 160ms; }
        .mf-stagger.mf-in-view > *:nth-child(4) { transition-delay: 240ms; }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .mf-nav { padding: 18px 20px; }
          .mf-nav__links { display: none; }
          .mf-nav__hamburger { display: flex; }
          .mf-diff__grid { grid-template-columns: 1fr; }
          .mf-diff__visual { aspect-ratio: 16/9; }
          .mf-testi__grid { grid-template-columns: 1fr; }
          .mf-pricing__grid { grid-template-columns: 1fr; }
          .mf-stat-bar__inner { grid-template-columns: repeat(2, 1fr); }
          .mf-footer__inner { flex-direction: column; align-items: flex-start; }
        }
        @media (max-width: 600px) {
          .mf-nav__cta .mf-btn-ghost { display: none; }
          .mf-hero__actions { flex-direction: column; align-items: stretch; }
          .mf-btn-hero, .mf-btn-hero-ghost { justify-content: center; }
          .mf-hero__waitlist form { flex-direction: column; align-items: stretch; }
          .mf-hero__waitlist input[type="email"] { max-width: 100%; }
        }
      `}</style>

      {/* ── SCROLL PROGRESS ───────────────────────────────────────── */}
      <div className="mf-progress" style={{ width: `${scrollPct}%` }} aria-hidden="true"/>

      {/* ── MOBILE DRAWER ─────────────────────────────────────────── */}
      <div className={`mf-drawer-overlay${mobileOpen ? " open" : ""}`} onClick={() => setMobileOpen(false)} aria-hidden="true"/>
      <nav className={`mf-drawer${mobileOpen ? " open" : ""}`} aria-label="Mobile navigation">
        <div className="mf-drawer__header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark size={28}/>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>MarketFit</span>
          </div>
          <button onClick={() => setMobileOpen(false)} style={{ background: "none", border: "none", color: "var(--white)", cursor: "pointer", padding: 4 }}>
            <IcoClose/>
          </button>
        </div>
        {NAV_LINKS.map(l => (
          <a key={l.href} href={l.href} className="mf-drawer-link" onClick={() => setMobileOpen(false)}>
            {l.label}
          </a>
        ))}
        <div className="mf-drawer__cta">
          <Link href="/login" onClick={() => setMobileOpen(false)}
            style={{ display: "block", padding: "14px 16px", borderRadius: 8, textAlign: "center",
              border: "1px solid rgba(29,111,196,.25)", fontSize: 15, fontWeight: 600, color: "var(--white)" }}>
            Sign in
          </Link>
          <Link href="/signup" onClick={() => setMobileOpen(false)}
            style={{ display: "block", padding: "14px 16px", borderRadius: 8, textAlign: "center",
              background: "linear-gradient(135deg, #1d6fc4, #3b82f6)", color: "#fff", fontSize: 15, fontWeight: 700,
              boxShadow: "0 4px 16px rgba(29,111,196,0.4)" }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <header>
        <nav className={`mf-nav${scrolled ? " scrolled" : ""}`} aria-label="Main navigation">
          <Link href="/" className="mf-nav__logo">
            <LogoMark/>
            MarketFit
          </Link>
          <ul className="mf-nav__links">
            {NAV_LINKS.map(l => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
          </ul>
          <div className="mf-nav__cta">
            <Link href="/login"  className="mf-btn-ghost">Sign in</Link>
            <Link href="/signup" className="mf-btn-primary">Get started free</Link>
            <button className="mf-nav__hamburger" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
              <IcoMenu/>
            </button>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className="mf-hero" aria-labelledby="hero-heading">
          <div className="mf-hero__bg" aria-hidden="true"/>
          <div className="mf-hero__grain" aria-hidden="true"/>
          <div className="mf-hero__vignette" aria-hidden="true"/>

          <div className="mf-hero__content">
            <p className={`mf-hero__eyebrow${heroReady ? " ready" : ""}`}>
              <span className="mf-eyebrow-dot" aria-hidden="true"/>
              AI-Powered Career Intelligence · The Smarter Alternative to Jobright
            </p>

            <h1 className="mf-hero__headline" id="hero-heading">
              {(() => {
                let i = 0
                return words.map((word, wi) => {
                  const wordEl = (
                    <span key={`w${wi}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                      {word.split("").map(ch => {
                        const idx = i++
                        return (
                          <span key={idx}
                            className={`mf-char${heroReady ? " ready" : ""}`}
                            style={{ transitionDelay: `${charDelay(idx)}ms` }}>
                            {ch}
                          </span>
                        )
                      })}
                    </span>
                  )
                  if (wi === words.length - 1) return wordEl
                  const spaceIdx = i++
                  return (
                    <span key={`g${wi}`}>
                      {wordEl}
                      <span className={`mf-char space${heroReady ? " ready" : ""}`}
                        style={{ transitionDelay: `${charDelay(spaceIdx)}ms` }}>
                        {" "}
                      </span>
                    </span>
                  )
                })
              })()}
              <span className="sr-only">{headline}</span>
            </h1>

            <p className={`mf-hero__sub${heroReady ? " ready" : ""}`}
              style={{ transitionDelay: `${charDelay(headline.length) + 200}ms` }}>
              MarketFit matches, tailors, and applies — so you show up with the right resume,
              at the right company, at exactly the right moment.
            </p>

            <div className={`mf-hero__actions${heroReady ? " ready" : ""}`}
              style={{ transitionDelay: `${charDelay(headline.length) + 320}ms` }}>
              <Link href="/signup" className="mf-btn-hero">
                <IcoZap/> Start free — no card needed
              </Link>
              <a href="#features" className="mf-btn-hero-ghost">
                See how it works <IcoArrow/>
              </a>
            </div>

            {/* Waitlist capture */}
            <div className={`mf-hero__waitlist${heroReady ? " ready" : ""}`}
              style={{ transitionDelay: `${charDelay(headline.length) + 460}ms` }}>
              <WaitlistInline plan="starter"/>
            </div>

            <p className={`mf-hero__note${heroReady ? " ready" : ""}`}
              style={{ transitionDelay: `${charDelay(headline.length) + 600}ms` }}>
              🔒 No credit card · Free tier forever · Cancel any time
            </p>
          </div>

          <div className="mf-scroll-cue" aria-hidden="true">
            <span>Scroll</span>
            <div className="mf-scroll-line"/>
          </div>
        </section>

        {/* ── STAT BAR ────────────────────────────────────────────────── */}
        <section className="mf-stat-bar mf-stagger" aria-label="Platform statistics">
          <div className="mf-stat-bar__inner">
            {[
              { target: 98,  suffix: "%", label: "Peak ATS Score"          },
              { target: 20,  suffix: "+", label: "Job Boards Unified"       },
              { target: 6,   suffix: "",  label: "AI Features Live"         },
              { target: 14,  suffix: "+", label: "ATS Platforms Autofilled" },
            ].map(s => (
              <div key={s.label} className="mf-stat-item">
                <span className="mf-stat-num">
                  <AnimCounter target={s.target} suffix={s.suffix} duration={1800}/>
                </span>
                <span className="mf-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── DIFFERENTIATOR ──────────────────────────────────────────── */}
        <section className="mf-section mf-diff" id="differentiator">
          <div className="mf-container">
            <div className="mf-diff__grid">
              <div className="mf-diff__visual" aria-hidden="true">
                <div style={{ textAlign: "center", width: "80%", maxWidth: 320 }}>
                  <svg viewBox="0 0 160 160" width="160" height="160" style={{ overflow: "visible" }}>
                    <defs>
                      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1d6fc4"/>
                        <stop offset="100%" stopColor="#60a5fa"/>
                      </linearGradient>
                    </defs>
                    <circle className="mf-ring-track" cx="80" cy="80" r="60"/>
                    <circle ref={ringRef}
                      className={`mf-ring-fill${ringAnimated ? " animated" : ""}`}
                      cx="80" cy="80" r="60" transform="rotate(-90 80 80)"/>
                    <text style={{ fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 600,
                      fill: "var(--white)", letterSpacing: "-.04em" }}
                      x="80" y="76" textAnchor="middle" dominantBaseline="central">98</text>
                    <text style={{ fontFamily: "var(--font-body)", fontSize: 11, fill: "#93c5fd",
                      letterSpacing: ".12em" }}
                      x="80" y="96" textAnchor="middle" dominantBaseline="central">ATS SCORE</text>
                  </svg>
                  <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[95, ringAnimated ? 88 : 0, ringAnimated ? 72 : 0].map((w, i) => (
                      <div key={i} style={{ height: 6, background: "rgba(29,111,196,0.15)", borderRadius: 1 }}>
                        <div style={{ height: "100%", background: `linear-gradient(90deg, #1d6fc4, #60a5fa)`, borderRadius: 1, width: `${w}%`,
                          transition: `width ${1.5 + i * .3}s ${i * .2}s var(--ease)` }}/>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="mf-section-label mf-reveal">Why MarketFit</p>
                <h2 className="mf-section-title mf-reveal" style={{ marginBottom: 24 }}>
                  Not just matched.<br/>Optimized.
                </h2>
                <p className="mf-section-body mf-reveal">
                  Every other platform shows you jobs. MarketFit rebuilds your resume for each one,
                  scores it live against the ATS, and fills the application — automatically.
                </p>
                <ul className="mf-diff__list">
                  {[
                    { icon: <IcoBrain/>, title: "Live ATS scoring",           text: "Watch your score climb 83% → 98% in real time as AI tailors each resume." },
                    { icon: <IcoUsers/>, title: "Iterative resume refinement", text: "Feedback chips instantly regenerate your tailored resume — no starting over." },
                    { icon: <IcoShield/>, title: "Visa intelligence built in", text: "H1B sponsor badges from DOL LCA data. Filter C2C, GC, OPT, TN — first-class search filters." },
                    { icon: <IcoMail/>, title: "Gmail autosync",              text: "Connect once. Offers, rejections, and interview invites log automatically — no manual entry." },
                  ].map(item => (
                    <li key={item.title} className="mf-diff__item mf-reveal">
                      <span className="mf-diff__icon">{item.icon}</span>
                      <div>
                        <p className="mf-diff__title">{item.title}</p>
                        <p className="mf-diff__text">{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────────────── */}
        <section className="mf-section mf-features" id="features">
          <div className="mf-container">
            <p className="mf-section-label mf-reveal">Platform</p>
            <h2 className="mf-section-title mf-reveal" style={{ marginBottom: 16 }}>
              Every tool you need.<br/>Nothing you don&apos;t.
            </h2>
            <p className="mf-section-body mf-reveal" style={{ marginTop: 16 }}>
              Six AI features, one unified workspace — built on Claude, connected to 20+ job boards.
              Explore each section below — no signup needed to try them.
            </p>

            <SectionsCarousel/>
          </div>
        </section>

        {/* ── TESTIMONIALS ────────────────────────────────────────────── */}
        <section className="mf-section mf-testi" id="testimonials">
          <div className="mf-container">
            <p className="mf-section-label mf-reveal">Stories</p>
            <h2 className="mf-section-title mf-reveal">Real people. Real offers.</h2>
            <div className="mf-testi__grid mf-stagger">
              {[
                { init: "AK", name: "Arjun K.", role: "Software Engineer — OPT, landed at Stripe",
                  quote: "\"My resume went from 67% to 96% in under three minutes. The job I got was the first one MarketFit recommended.\"" },
                { init: "PM", name: "Priya M.", role: "Director — TechRecruit Staffing, Chicago",
                  quote: "\"We placed 18 candidates in 60 days using the agency dashboard. No other platform even has this feature.\"" },
                { init: "ZL", name: "Zheng L.", role: "Data Scientist — H1B, landed at Meta",
                  quote: "\"The H1B filter saved me weeks of research. I only applied to companies I knew would sponsor.\"" },
              ].map(t => (
                <blockquote key={t.name} className="mf-testi-card">
                  <div className="mf-testi-stars">
                    {[...Array(5)].map((_, i) => <IcoStar key={i}/>)}
                  </div>
                  <p className="mf-testi-quote">{t.quote}</p>
                  <footer className="mf-testi-meta">
                    <div className="mf-testi-avatar" aria-hidden="true">{t.init}</div>
                    <div>
                      <p className="mf-testi-name">{t.name}</p>
                      <p className="mf-testi-role">{t.role}</p>
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* ── VS JOBRIGHT ─────────────────────────────────────────────── */}
        <section className="mf-section mf-vs" id="vs">
          <div className="mf-container">
            <p className="mf-section-label mf-reveal">Comparison</p>
            <h2 className="mf-section-title mf-reveal">The honest comparison.</h2>
            <p className="mf-section-body mf-reveal" style={{ marginTop: 16 }}>
              We built MarketFit because Jobright couldn&apos;t do what staffing firms and visa holders actually need.
            </p>
            <div className="mf-vs__wrap mf-reveal">
              <table className="mf-vs__table">
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    <th scope="col" className="mf-col">MarketFit</th>
                    <th scope="col">Jobright</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feat: "H1B / visa filter (DOL LCA data)",                  mf: true,  jr: null  },
                    { feat: "Gmail OAuth autosync",                              mf: true,  jr: false },
                    { feat: "Live ATS score (real-time)",                        mf: true,  jr: true  },
                    { feat: "Chrome autofill (14 ATS platforms: Workday, Greenhouse, Lever, Workable, Rippling…)", mf: true, jr: true },
                    { feat: "Iterative resume refinement",                       mf: true,  jr: false },
                    { feat: "AI model transparency (shown in UI)",               mf: true,  jr: false },
                    { feat: "Agency pricing (unlimited candidates)",             mf: true,  jr: false },
                    { feat: "Starting price",                                    mf: "free", jr: "$39.99/mo" },
                  ].map(row => (
                    <tr key={row.feat}>
                      <td>{row.feat}</td>
                      <td className="mf-col">
                        {row.mf === true ? <span className="mf-check"><IcoCheck/></span>
                          : row.mf === false ? <span className="mf-cross"><IcoX/></span>
                          : <span style={{ color: "var(--white)", fontWeight: 600 }}>Free</span>}
                      </td>
                      <td>
                        {row.jr === true  ? <span className="mf-check"><IcoCheck/></span>
                          : row.jr === false ? <span className="mf-cross"><IcoX/></span>
                          : row.jr === null  ? <span className="mf-cross"><IcoMinus/></span>
                          : row.jr}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────────────── */}
        <section className="mf-section mf-pricing" id="pricing">
          <div className="mf-container">
            <p className="mf-section-label mf-reveal">Pricing</p>
            <h2 className="mf-section-title mf-reveal">Straightforward.<br/>No surprises.</h2>
            <div className="mf-pricing__grid mf-stagger">
              {[
                { tier: "Starter", price: "Free", period: "Forever free · no card required",
                  desc: "Full platform access for one candidate. Try every feature at zero cost.",
                  feats: ["1 candidate workspace", "All AI features (Nexus AI)", "Resume tailoring + ATS score", "20+ job boards", "Chrome extension", "Visa intelligence"],
                  cta: "Get started free", href: "/signup", featured: false },
                { tier: "Pro", price: "$49", period: "per month · up to 10 candidates",
                  desc: "For serious job seekers and small recruiting teams managing multiple searches.",
                  feats: ["Up to 10 candidate workspaces", "Gmail OAuth autosync", "Priority AI (faster responses)", "Visa category management", "Advanced analytics", "Everything in Starter"],
                  cta: "Start Pro — $49/mo", href: "/signup?plan=pro", featured: true },
                { tier: "Agency", price: "$199", period: "per month · unlimited candidates",
                  desc: "For staffing firms that need serious scale. Full AI suite, team analytics.",
                  feats: ["Unlimited candidate workspaces", "Team collaboration (Q3 2026)", "Agency analytics dashboard", "Dedicated support", "White-label options", "Everything in Pro"],
                  cta: "Start Agency — $199/mo", href: "/signup?plan=agency", featured: false },
              ].map(plan => (
                <div key={plan.tier} className={`mf-price-card${plan.featured ? " mf-price-card--feat" : ""}`}>
                  <p className="mf-price-tier">{plan.tier}</p>
                  <p className="mf-price-amount">{plan.price}</p>
                  <p className="mf-price-period">{plan.period}</p>
                  <p className="mf-price-desc">{plan.desc}</p>
                  <ul className="mf-price-feats">
                    {plan.feats.map(f => (
                      <li key={f} className="mf-price-feat"><IcoCheck sz={16}/> {f}</li>
                    ))}
                  </ul>
                  <Link href={plan.href} className="mf-btn-plan">{plan.cta}</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINALE ──────────────────────────────────────────────── */}
        <section className="mf-cta" aria-labelledby="cta-heading">
          <div className="mf-cta__bg" aria-hidden="true"/>
          <div className="mf-cta__content">
            <h2 className="mf-cta__title mf-reveal" id="cta-heading">
              Your next role<br/>is already out there.
            </h2>
            <p className="mf-cta__sub mf-reveal">
              Stop sending generic applications. Start landing the roles you were built for.
            </p>
            <div className="mf-cta__actions mf-reveal" style={{ marginBottom: 24 }}>
              <Link href="/signup" className="mf-btn-hero">
                <IcoZap/> Get MarketFit free
              </Link>
              <Link href="/dashboard" className="mf-btn-hero-ghost">
                Go to dashboard →
              </Link>
            </div>
            {/* Second waitlist at CTA for conversion */}
            <div className="mf-reveal" style={{ marginTop: 32, maxWidth: 480, margin: "32px auto 0" }}>
              <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 12, textAlign: "center" }}>
                Not ready? Join the waitlist for early access.
              </p>
              <WaitlistInline plan="cta"/>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="mf-footer">
        <div className="mf-footer__inner">
          <div className="mf-footer__logo">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M7 22V10L13.5 18L16 14.5L18.5 18L25 10V22"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            MarketFit
          </div>
          <ul className="mf-footer__links">
            {[["#features","Features"],["#pricing","Pricing"],["#vs","vs Jobright"],["#testimonials","Stories"],
              ["/dashboard","Dashboard"],["/login","Sign in"],["/signup","Get started"],
              ["mailto:hello@marketfit.ai","Contact"]].map(([href, label]) => (
              <li key={label}><a href={href}>{label}</a></li>
            ))}
          </ul>
          <p className="mf-footer__copy">© 2026 MarketFit. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
