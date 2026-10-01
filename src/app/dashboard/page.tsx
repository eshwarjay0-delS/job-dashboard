"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { getH1BScore } from "@/lib/h1b"
import { fetchJobs as fetchJobsApi } from "@/lib/jobsClient"
import { Globe, MapPin, DollarSign, X, Sparkles, FileText, Mic, Briefcase } from "lucide-react"
import PageIntro from "./_components/page-intro"
import { navItem } from "./_components/nav"

// Home is what MarketFit does, in the owner's order: Kompas, then Gmail, then the resume (1 Oct 2026).
// Each button opens the one page that does that job. No speed, match rate or callback figure is quoted:
// none was measured. Kompas is a static page served by MarketFit (next.config.js), so it is a plain link.
const KOMPAS_PATH = "/dashboard/kompas"
type Feature = { href: string; label: string; why: string; what: string; button: string; icon: React.ReactNode; plain?: boolean }
const MAIN: Feature[] = [
  { href: KOMPAS_PATH, plain: true, icon: <Mic size={18} />, label: "Kompas",
    why: "Don't freeze in an interview.",
    what: "Kompas hears the interviewer's question and shows you a short answer from your own resume, while the call is on.",
    button: "Open Kompas" },
  { href: "/dashboard/connections", icon: navItem("/dashboard/email").icon, label: "Gmail",
    why: "Don't miss a recruiter.",
    what: "Link your Gmail. Recruiter replies and interview invites come into one list, so none gets buried.",
    button: "Connect Gmail" },
  { href: "/dashboard/resume", icon: navItem("/dashboard/resume").icon, label: "Your resume",
    why: "Fit every job you apply to.",
    what: "Paste a job post. MarketFit rewrites your resume for that one job. You read it before you send it.",
    button: "Tailor my resume" },
]
const MORE: Feature[] = [
  { href: "/dashboard/extension", icon: navItem("/dashboard/extension").icon, label: "Chrome extension", why: "", what: navItem("/dashboard/extension").what, button: "" },
  { href: "/dashboard/whatsapp", icon: navItem("/dashboard/whatsapp").icon, label: "WhatsApp", why: "", what: navItem("/dashboard/whatsapp").what, button: "" },
  { href: "/dashboard/jobs", icon: <Briefcase size={18} />, label: "Find jobs", why: "", what: "Real jobs you can apply to today.", button: "" },
]

function Go({ f, className, style, children }: { f: Feature; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return f.plain
    ? <a href={f.href} className={className} style={style}>{children}</a>
    : <Link href={f.href} className={className} style={style}>{children}</Link>
}

// This page's colors used to be literal hex — an exact copy of the light-theme
// values in globals.css, but copied instead of referenced. Since every
// consumer below reads through this P object rather than a hardcoded string,
// the page never re-rendered for dark mode (or any of the 6 accent palettes) —
// it was permanently stuck on the light-theme snapshot these hex codes were
// taken from. Pointing every entry at the real CSS custom property (same
// values in light mode, correct values everywhere else) fixes that for the
// whole page with no call-site changes. borderStrong and the six category-
// color objects (rtr/reply/remote/intv/assess/follow) are dead code — 0
// references anywhere in this file — left as-is, not worth touching here.
const P = {
  bg:           "var(--surface-2)",
  surface:      "var(--surface)",
  surfaceAlt:   "var(--surface-2)",
  text:         "var(--text)",
  muted:        "var(--text-muted)",
  hint:         "var(--text-soft)",
  border:       "var(--border)",
  borderStrong: "#d3cdc0",
  // Category colors (unused — see note above)
  rtr:    { text: "#6b6858", bg: "#f7f5f0",  border: "#e4e0d6",  dot: "#7e7a68" },
  reply:  { text: "#13120d", bg: "var(--surface)",  border: "#ddd8cd",  dot: "#ccc6b7" },
  remote: { text: "#1c1b16", bg: "#f2f0ea",  border: "#d9d4c8",  dot: "#6e6b5b" },
  intv:   { text: "#7c7866", bg: "#f6f4f0",  border: "#e2ded4",  dot: "#b0aa99" },
  assess: { text: "#4d4b44", bg: "#f6f4ef",  border: "#e0dcd2",  dot: "#605d51" },
  follow: { text: "#58564c", bg: "#f6f4f0",  border: "#e2ded4",  dot: "#b0aa99" },
  accent: { text: "var(--accent)", bg: "var(--accent-soft)", border: "var(--accent-border)" },
}

// ── Company logo (Clearbit API — real logos) ──────────────────────────────────
function CompanyLogo({ domain, name, size = 44 }: { domain: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const colors = ["#1c1b16","#4d4b44","#1c1b16","#6b6858","#13120d","#7c7866","#757261","#888471"]
  const bg = colors[name.charCodeAt(0) % colors.length]
  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: size * 0.26, background: bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 800, fontSize: size * 0.38, userSelect: "none",
        boxShadow: `0 3px 10px ${bg}55`,
      }}>{initials}</div>
    )
  }
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      onError={() => setErr(true)}
      style={{
        width: size, height: size, borderRadius: size * 0.26, objectFit: "contain",
        background: "var(--surface)", border: "1px solid #e6e2d9", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(12,11,8,.08)", padding: 4,
      }}
    />
  )
}

// ── Recruiter avatar (pravatar — realistic profile photos) ────────────────────
function Avatar({ seed, name, size = 36 }: { seed: number; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2)
  const colors = ["#1c1b16","#4d4b44","#1c1b16","#6b6858","#7c7866","#13120d"]
  const bg = colors[seed % colors.length]
  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: size * 0.36, fontWeight: 700,
      }}>{initials}</div>
    )
  }
  return (
    <img
      src={`https://i.pravatar.cc/${size * 2}?img=${seed}`}
      alt={name}
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
    />
  )
}

// ── Match ring (Jobright-style per-job AI match indicator) ───────────────────
function MatchRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const color = pct >= 80 ? "#42413c" : pct >= 60 ? "#5b594e" : pct >= 40 ? "#6b6858" : "#a29d89"
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }} title={`${pct}% match with your profile`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e6e2d9" strokeWidth={4.5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={`${(pct/100)*circ} ${circ}`}
          style={{ transition: "stroke-dasharray .8s cubic-bezier(.34,1.56,.64,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: size * 0.19, color: "#a29d89", lineHeight: 1 }}>%</span>
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (Number.isNaN(mins)) return iso || "Recently"
    if (mins < 2)   return "just now"
    if (mins < 60)  return `${mins} minutes ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)   return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`
    const days = Math.floor(hrs / 24)
    if (days < 7)   return `${days} ${days === 1 ? "day" : "days"} ago`
    const weeks = Math.floor(days / 7)
    if (weeks < 5)  return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`
    const months = Math.floor(days / 30)
    return `${months} ${months === 1 ? "month" : "months"} ago`
  } catch { return "Recently" }
}

function computeMatchPct(title: string, desc: string, keywords: string[]): number {
  if (!keywords.length) return 0
  const text = (title + " " + desc).toLowerCase()
  return Math.round(keywords.filter(k => text.includes(k.toLowerCase())).length / keywords.length * 100)
}

// ── Data ─────────────────────────────────────────────────────────────────────
// Fallback jobs shown while the live /api/jobs response loads
interface LiveJob {
  id: string; title: string; company: string; domain?: string
  location: string; remote: boolean; salary: string | null
  posted: string; description?: string; workAuth: string[]; url: string; source?: string
}
const JOBS: LiveJob[] = [
  { id:"j1",  title:"Cloud Security Engineer",       company:"Palo Alto Networks", domain:"paloaltonetworks.com", location:"Santa Clara, CA", remote:true,  salary:"$175k–$230k", posted:"2h ago",  workAuth:["h1b","w2"],                        url:"https://www.paloaltonetworks.com/company/careers" },
  { id:"j2",  title:"Senior Software Engineer",       company:"Stripe",             domain:"stripe.com",           location:"San Francisco, CA",remote:true,  salary:"$180k–$240k", posted:"Today",   workAuth:["h1b","w2"],                        url:"https://stripe.com/jobs" },
  { id:"j3",  title:"Machine Learning Engineer",      company:"Meta",               domain:"meta.com",             location:"Menlo Park, CA",   remote:true,  salary:"$200k–$280k", posted:"Today",   workAuth:["h1b","green_card","w2"],           url:"https://metacareers.com" },
  { id:"j4",  title:"DevSecOps Engineer",             company:"CrowdStrike",        domain:"crowdstrike.com",      location:"Austin, TX",        remote:true,  salary:"$150k–$200k", posted:"1d ago",  workAuth:["h1b","c2c","w2"],                  url:"https://crowdstrike.com/careers" },
  { id:"j5",  title:"Staff Data Engineer",            company:"Databricks",         domain:"databricks.com",       location:"San Francisco, CA",remote:true,  salary:"$160k–$220k", posted:"Today",   workAuth:["opt_cpt","h1b","green_card","w2"], url:"https://databricks.com/company/careers" },
  { id:"j6",  title:"Full Stack Engineer",            company:"Vercel",             domain:"vercel.com",           location:"Remote",            remote:true,  salary:"$140k–$185k", posted:"2d ago",  workAuth:["h1b","w2"],                        url:"https://vercel.com/careers" },
  { id:"j7",  title:"Senior Data Scientist",          company:"Airbnb",             domain:"airbnb.com",           location:"San Francisco, CA",remote:false, salary:"$160k–$210k", posted:"3d ago",  workAuth:["opt_cpt","w2"],                    url:"https://careers.airbnb.com" },
  { id:"j8",  title:"Platform Engineer",              company:"Salesforce",         domain:"salesforce.com",       location:"San Francisco, CA",remote:true,  salary:"$190k–$260k", posted:"1w ago",  workAuth:["h1b","green_card","w2"],           url:"https://salesforce.com/company/careers" },
  { id:"j9",  title:"Cloud Solutions Architect",      company:"IBM",                domain:"ibm.com",              location:"Remote",            remote:true,  salary:"$140k–$200k", posted:"4d ago",  workAuth:["h1b","c2c","w2"],                  url:"https://ibm.com/employment" },
]

// Work-auth badge palette — the filter competitors charge for, we give for free
const WORK_AUTH_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  h1b:            { label:"H-1B",        color:"#1c1b16", bg:"#f2f0ea", border:"#d9d4c8" },
  opt_cpt:        { label:"OPT/CPT",     color:"#4d4b44", bg:"#f6f4ef", border:"#e0dcd2" },
  w2:             { label:"W2",           color:"#11100c", bg:"#e8e4db", border:"#c6c0b1" },
  c2c:            { label:"C2C",          color:"#6b6858", bg:"#f7f5f0", border:"#e4e0d6" },
  green_card:     { label:"Green Card",   color:"#7c7866", bg:"#f6f4f0", border:"#e2ded4" },
  no_sponsorship: { label:"No Sponsor",   color:"#13120d", bg:"var(--surface)", border:"#ddd8cd" },
}


const CAT_CONFIG: Record<string, { label: string; icon: string; color: keyof typeof P }> = {
  remote: { label:"Remote",     icon:"🌐", color:"remote" },
  intv:   { label:"Interview",  icon:"📞", color:"intv"   },
  assess: { label:"Assessment", icon:"🧪", color:"assess" },
  follow: { label:"Follow-up",  icon:"⏳", color:"follow" },
  rtr:    { label:"RTR",        icon:"📋", color:"rtr"    },
  reply:  { label:"Reply",      icon:"⚡", color:"reply"  },
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function Icon({ d, size = 16, stroke = 2 }: { d: string; size?: number; stroke?: number }) {
  return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={d}/></svg>
}

type DashJob = { id:string; title:string; company:string; domain:string; location:string; remote:boolean; salary:string|null; description:string; workAuth:string[]; url:string; source?:string; posted:string; catKey:keyof typeof CAT_CONFIG }

function normalizeStaticJobs(): DashJob[] {
  return JOBS.map(j => ({
    id: j.id, title: j.title, company: j.company,
    domain: j.domain ?? (j.company.toLowerCase().replace(/\s+/g,"") + ".com"),
    location: j.location, remote: j.remote, salary: j.salary,
    description: j.description ?? "", workAuth: j.workAuth, url: j.url, posted: j.posted,
    catKey: (j.workAuth.includes("h1b") ? "remote" : "follow") as keyof typeof CAT_CONFIG,
  }))
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [userKw, setUserKw] = useState<string[]>([])
  const [liveJobs, setLiveJobs] = useState<DashJob[] | null>(null)
  const [jobQuery, setJobQuery] = useState("")
  const [jobFilter, setJobFilter] = useState("all")
  const [jobsLive, setJobsLive] = useState(false)
  const [notInterested, setNotInterested] = useState<Set<string>>(new Set())

  const loadLiveJobs = useCallback(async (q = "") => {
    try {
      const res = await fetchJobsApi(`/api/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      const data = await res.json()
      if (Array.isArray(data.jobs)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalized: DashJob[] = data.jobs.slice(0, 9).map((j: any) => ({
          id: String(j.id), title: String(j.title), company: String(j.company),
          domain: String(j.company).toLowerCase().replace(/\s+/g,"") + ".com",
          location: String(j.location || ""), remote: Boolean(j.remote),
          salary: j.salary ? String(j.salary) : null,
          description: String(j.description || ""),
          workAuth: Array.isArray(j.workAuth) ? j.workAuth as string[] : [],
          url: String(j.url || "#"), source: j.source ? String(j.source) : undefined,
          posted: String(j.posted || ""), catKey: "remote" as keyof typeof CAT_CONFIG,
        }))
        setLiveJobs(normalized)
        setJobsLive(!!data.live)
      }
    } catch { /* keep static jobs as fallback */ }
  }, [])

  useEffect(() => {
    try { setSaved(new Set(JSON.parse(localStorage.getItem("jd_saved_ids") || "[]"))) } catch {}
    try { setNotInterested(new Set(JSON.parse(localStorage.getItem("jd_not_interested") || "[]"))) } catch {}
    // Load user keywords for match rings
    try {
      const r = JSON.parse(sessionStorage.getItem("careerkit_last_result") || "{}")
      if (Array.isArray(r.matched_on) && r.matched_on.length) { setUserKw(r.matched_on); return }
    } catch {}
    try {
      const p = JSON.parse(localStorage.getItem("jd_profile") || "{}")
      if (p.skills) setUserKw(String(p.skills).split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 30))
    } catch {}
    void loadLiveJobs("")
  }, [loadLiveJobs])

  function toggleSave(job: DashJob) {
    setSaved(prev => {
      const next = new Set(prev)
      const adding = !next.has(job.id)
      adding ? next.add(job.id) : next.delete(job.id)
      localStorage.setItem("jd_saved_ids", JSON.stringify([...next]))
      // Also keep jd_saved_jobs in sync so the Saved Jobs page can display them
      try {
        const existing = JSON.parse(localStorage.getItem("jd_saved_jobs") || "[]")
        const filtered = existing.filter((j: {id:string}) => j.id !== job.id)
        const updated = adding ? [{ ...job, savedAt: new Date().toISOString(), status: "interested", notes: "" }, ...filtered] : filtered
        localStorage.setItem("jd_saved_jobs", JSON.stringify(updated))
      } catch {}
      return next
    })
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
      <PageIntro page="/dashboard" action={{ label: "Open Kompas", onClick: () => { window.location.href = KOMPAS_PATH } }} />

      <section aria-label="What MarketFit does for you" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:16 }}>
        {MAIN.map((f, i) => (
          <article key={f.href} style={{ display:"flex", flexDirection:"column", gap:10, padding:"22px 22px 20px",
            background:P.surface, border:`1px solid ${P.border}`, borderRadius:"var(--radius-lg)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span className="home-tile-icon">{f.icon}</span>
              <span style={{ fontSize:13, fontWeight:600, color:P.hint }}>{i + 1}</span>
            </div>
            <h2 style={{ fontSize:22, fontWeight:600, color:P.text, margin:0 }}>{f.label}</h2>
            <p style={{ fontSize:16, fontWeight:600, color:P.text, margin:0 }}>{f.why}</p>
            <p style={{ fontSize:15, lineHeight:1.5, color:P.muted, margin:0, flex:1 }}>{f.what}</p>
            <Go f={f} className="btn-accent" style={{ minHeight:46, padding:"0 20px", fontSize:15, textDecoration:"none", marginTop:6 }}>
              {f.button} <span aria-hidden>→</span>
            </Go>
          </article>
        ))}
      </section>

      <section aria-label="More ways to use MarketFit" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:12 }}>
        {MORE.map(f => (
          <Go key={f.href} f={f} className="home-tile">
            <span className="home-tile-icon">{f.icon}</span>
            <span>
              <span style={{ display:"block", fontSize:17, fontWeight:600, color:P.text }}>{f.label}</span>
              <span style={{ display:"block", fontSize:14.5, lineHeight:1.45, color:P.muted, marginTop:3 }}>{f.what}</span>
            </span>
          </Go>
        ))}
      </section>

      <section aria-labelledby="home-jobs-title" style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          <div style={{ padding:"20px 20px 0" }}>
            <h2 id="home-jobs-title" style={{ fontSize:22, fontWeight:600, color:P.text, margin:0 }}>Jobs to look at</h2>
            <p style={{ fontSize:15, color:P.muted, margin:"4px 0 14px" }}>
              {jobsLive ? "Real jobs, from The Muse." : "These are made-up example jobs until real ones load."}
            </p>
            <div style={{ position:"relative", marginBottom:11 }}>
              <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:P.hint, pointerEvents:"none" }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input value={jobQuery} onChange={e => setJobQuery(e.target.value)} placeholder="Search by title, company, or keyword…"
                style={{ width:"100%", paddingLeft:30, paddingRight:jobQuery?30:12, paddingTop:8, paddingBottom:8, borderRadius:9, border:`1px solid ${P.border}`, fontSize:13, color:P.text, background:P.surfaceAlt, outline:"none", boxSizing:"border-box" as const, transition:"border-color .15s, background .15s" }}
                onFocus={e => { e.currentTarget.style.borderColor="#c6c0b1"; e.currentTarget.style.background="#f8f7f3" }}
                onBlur={e => { e.currentTarget.style.borderColor=P.border; e.currentTarget.style.background=P.surfaceAlt }}
              />
              {jobQuery && <button onClick={() => setJobQuery("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", border:"none", background:"none", cursor:"pointer", color:P.hint, padding:2, display:"flex" }}><X size={13}/></button>}
            </div>
            <div style={{ display:"flex", gap:8, paddingBottom:12, alignItems:"center" }}>
              <select value={jobFilter} onChange={e => setJobFilter(e.target.value as "all"|"remote"|"h1b"|"gc"|"salary")}
                style={{ padding:"6px 10px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer", outline:"none",
                  background: jobFilter !== "all" ? P.accent.bg : P.surfaceAlt,
                  color: jobFilter !== "all" ? P.accent.text : P.muted,
                  border: `1.5px solid ${jobFilter !== "all" ? P.accent.border : P.border}`,
                  flex:"0 0 auto",
                }}>
                <option value="all">All Jobs</option>
                <option value="remote">Remote only</option>
                <option value="h1b">H-1B Likely</option>
                <option value="gc">GC / Citizen</option>
                <option value="salary">Salary Listed</option>
              </select>
              {(jobFilter !== "all") && (
                <button onClick={() => setJobFilter("all")} style={{ padding:"4px 8px", borderRadius:7, border:"none", background:"#e6e2d9", color:"#13120d", fontSize:11, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:3 }}><X size={10}/> Clear</button>
              )}
            </div>
          </div>

          {/* ── JobRight-style vertical scrollable feed ── */}
          {(() => {
            const allJobs: DashJob[] = liveJobs ?? normalizeStaticJobs()
            let displayJobs = allJobs.filter(j => !notInterested.has(j.id))
            if (jobFilter === "remote") displayJobs = displayJobs.filter(j => j.remote)
            if (jobFilter === "h1b")    displayJobs = displayJobs.filter(j => getH1BScore(j.company).status === "likely")
            if (jobFilter === "gc")     displayJobs = displayJobs.filter(j => j.workAuth.some((k: string) => k.startsWith("gc") || k === "citizen"))
            if (jobFilter === "salary") displayJobs = displayJobs.filter(j => !!j.salary)
            if (jobQuery.trim()) {
              const q = jobQuery.toLowerCase()
              displayJobs = displayJobs.filter(j =>
                j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || (j.description||"").toLowerCase().includes(q)
              )
            }
            return (
              <div style={{ maxHeight:"74vh", overflowY:"auto", overflowX:"hidden", borderTop:`1px solid ${P.border}` }}>
                {displayJobs.length === 0 && (
                  <div className="mf-empty" style={{ margin:20 }}>
                    <p style={{ fontSize:15, color:P.muted, marginBottom:12 }}>No jobs match your filters.</p>
                    <button onClick={() => { setJobFilter("all"); setJobQuery("") }} className="btn-outline" style={{ minHeight:36, padding:"0 16px", fontSize:13.5 }}>Clear filters</button>
                  </div>
                )}
                {displayJobs.map(job => {
                  const match = computeMatchPct(job.title, job.description, userKw)
                  const isSaved = saved.has(job.id)
                  const h1b = getH1BScore(job.company)
                  return (
                    <div key={job.id}
                      style={{ borderBottom:`1px solid ${P.border}`, background:P.surface, transition:"background .15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="#f6f4f0" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background=P.surface }}
                    >
                      <div style={{ display:"flex", gap:13, padding:"15px 20px", alignItems:"flex-start" }}>
                        <div style={{ flexShrink:0, marginTop:2 }}><CompanyLogo domain={job.domain} name={job.company} size={42} /></div>
                        {/* Main info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                            <span style={{ fontSize:11, color:P.hint }}>{timeAgo(job.posted)}</span>
                            {job.source && job.source !== "sample" && <span style={{ fontSize:10.5, color:"#58564c", background:"#f6f4f0", padding:"1px 6px", borderRadius:10, fontWeight:600, border:"1px solid #e2ded4" }}>via {job.source}</span>}
                          </div>
                          <a href={job.url && job.url !== "#" ? job.url : undefined} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
                            <h3 style={{ fontWeight:700, fontSize:14.5, color:P.text, lineHeight:1.3, marginBottom:2 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#1c1b16" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color=P.text }}
                            >{job.title}</h3>
                          </a>
                          <p style={{ fontSize:13, color:P.muted, fontWeight:500, marginBottom:7 }}>{job.company}</p>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 14px", fontSize:12, color:P.muted, marginBottom:8 }}>
                            {job.location && <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}><MapPin size={11}/> {job.location}</span>}
                            {job.remote && <span style={{ color:"#1c1b16", fontWeight:600, display:"inline-flex", alignItems:"center", gap:3 }}><Globe size={11}/> Remote</span>}
                            {job.salary && <span style={{ color:"#1c1b16", fontWeight:700, display:"inline-flex", alignItems:"center", gap:3 }}><DollarSign size={11}/> {job.salary}</span>}
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                            <span title={h1b.reason} style={{ padding:"2px 8px", borderRadius:6, fontSize:10.5, fontWeight:700, background:h1b.bg, color:h1b.color, border:`1px solid ${h1b.border}`, cursor:"help", display:"inline-flex", alignItems:"center", gap:5 }}>
                              <span style={{ width:6, height:6, borderRadius:"50%", background:"currentColor", flexShrink:0 }}/> {h1b.label}
                            </span>
                            {job.workAuth.slice(0,3).map(key => {
                              const b = WORK_AUTH_BADGES[key]; if (!b) return null
                              return <span key={key} style={{ padding:"2px 8px", borderRadius:6, fontSize:10.5, fontWeight:700, background:b.bg, color:b.color, border:`1px solid ${b.border}` }}>{b.label}</span>
                            })}
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <Link href="/dashboard/ai-tools"
                              onClick={() => { try { const t=job.title+" at "+job.company+"\n\n"+(job.description||""); sessionStorage.setItem("jd_ai_tab","cover"); sessionStorage.setItem("jd_prefill_jd",t); sessionStorage.setItem("jd_prefill_role",job.title); sessionStorage.setItem("jd_prefill_company",job.company) } catch {} }}
                              className="btn-outline" style={{ minHeight:32, padding:"0 13px", fontSize:12.5, gap:5, textDecoration:"none" }}>
                              <Sparkles size={12}/> Cover letter
                            </Link>
                            <Link href="/dashboard/resume"
                              onClick={() => { try { const t=job.title+" at "+job.company+"\n\n"+(job.description||""); sessionStorage.setItem("jd_prefill",t); sessionStorage.setItem("jd_prefill_jd",t); sessionStorage.setItem("jd_prefill_role",job.title); sessionStorage.setItem("jd_prefill_company",job.company) } catch {} }}
                              className="btn-outline" style={{ minHeight:32, padding:"0 13px", fontSize:12.5, gap:5, textDecoration:"none" }}>
                              <FileText size={12}/> Tailor
                            </Link>
                            <button onClick={() => setNotInterested(prev => { const n=new Set(prev); n.add(job.id); localStorage.setItem("jd_not_interested",JSON.stringify([...n])); return n })}
                              style={{ marginLeft:"auto", padding:"4px 9px", borderRadius:7, border:"none", fontSize:11, fontWeight:600, color:P.hint, background:"transparent", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:3 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#13120d" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color=P.hint }}
                            ><X size={11}/> Hide</button>
                          </div>
                        </div>

                        {/* Match ring + bookmark (right column) */}
                        <div style={{ flexShrink:0, display:"flex", flexDirection:"column" as const, alignItems:"center", gap:8, paddingTop:2 }}>
                          {userKw.length > 0 && <MatchRing pct={match} size={52} />}
                          <button onClick={e => { e.stopPropagation(); toggleSave(job) }} style={{
                            padding:"6px", borderRadius:8, border:`1px solid ${isSaved?"#d9d4c8":P.border}`, cursor:"pointer",
                            color:isSaved?"#1c1b16":P.hint, background:isSaved?P.accent.bg:"transparent", transition:"all .15s",
                          }}>
                            <svg width="16" height="16" fill={isSaved?"currentColor":"none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div style={{ padding:"14px 20px", borderTop:`1px solid ${P.border}`, display:"flex", justifyContent:"flex-end" }}>
            <Link href="/dashboard/jobs" className="btn-outline" style={{ minHeight:44, padding:"0 18px", fontSize:15, textDecoration:"none" }}>See all jobs →</Link>
          </div>
      </section>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity:.5; transform:scale(1); }
          50% { opacity:0; transform:scale(1.8); }
        }
      `}</style>
    </div>
  )
}
