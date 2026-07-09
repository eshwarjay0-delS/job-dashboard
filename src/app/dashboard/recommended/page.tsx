"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getH1BScore } from "@/lib/h1b"
import { fetchJobs as fetchJobsApi } from "@/lib/jobsClient"
import { computeMatchScore, type UserProfile } from "@/lib/matching/computeMatchScore"

const P = {
  bg:      "#f4f6f9",
  surface: "#ffffff",
  text:    "#1a2035",
  muted:   "#6b7a99",
  hint:    "#9aa4bc",
  border:  "#e4e8ef",
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface RecommendedJob {
  id: string
  title: string
  company: string
  domain: string
  location: string
  remote: boolean
  salary: string | null
  workAuth: string[]
  url: string
  posted: string
  description: string
  matchPct: number
  matchReasons: string[]
  source: string
}

const WORK_AUTH_COLORS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  h1b:         { label: "H-1B",       color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  opt_cpt:     { label: "OPT/CPT",    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  green_card:  { label: "Green Card", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  w2:          { label: "W2",         color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  c2c:         { label: "C2C",        color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
}

function timeAgo(iso: string): string {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch { return "Recently" }
}

function MatchRing({ pct }: { pct: number }) {
  const size = 48, r = 19, circ = 2 * Math.PI * r
  const color = pct >= 88 ? "#059669" : pct >= 75 ? "#1d6fc4" : pct >= 60 ? "#d97706" : "#9ca3af"
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e4e8ef" strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round" strokeDasharray={`${(pct/100)*circ} ${circ}`}/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: 8, color: "#9ca3af", lineHeight: 1 }}>%</span>
      </div>
    </div>
  )
}

function CompanyLogo({ domain, name, size = 40 }: { domain: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const colors = ["#1d6fc4","#7c3aed","#d97706","#dc2626","#0ea5e9","#6366f1"]
  const bg = colors[name.charCodeAt(0) % colors.length]
  if (err) return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: size * 0.38 }}>{initials}</div>
  )
  return (
    <img src={`https://logo.clearbit.com/${domain}`} alt={name} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: size * 0.26, objectFit: "contain", background: "#fff", border: "1px solid #e4e8ef", flexShrink: 0, padding: 4 }}/>
  )
}

// Merge the real server profile (Supabase `profiles` — skills/location/work_auth,
// the source of truth since Phase 1A wired the setup wizard to actually write it)
// with the localStorage cache for fields the DB profile doesn't carry (years of
// experience, education — extracted from a resume, not asked in onboarding yet).
// API wins on any field both provide; localStorage only fills genuine gaps.
async function loadRealProfile(): Promise<UserProfile & { title: string }> {
  let local: Record<string, unknown> = {}
  try { local = JSON.parse(localStorage.getItem("jd_profile") || "{}") } catch {}
  const localSkills = Array.isArray(local.skills)
    ? local.skills as string[]
    : typeof local.skills === "string"
    ? (local.skills as string).split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
    : []

  let apiProfile: Record<string, unknown> | null = null
  try {
    const res = await fetch("/api/profile")
    const data = await res.json()
    apiProfile = data?.profile || null
  } catch { /* offline / not signed in — localStorage-only */ }

  const skills = (Array.isArray(apiProfile?.skills) && (apiProfile!.skills as string[]).length)
    ? apiProfile!.skills as string[]
    : localSkills
  const location = String(apiProfile?.location || local.location || "")
  const title = String(apiProfile?.title || local.title || "")

  return {
    skills,
    location,
    title,
    experience_years: Number(local.yearsExp || local.years_experience || 0),
    education: String(local.education || ""),
  }
}

// A job listing's "skills" aren't pre-tagged (unlike a parsed resume) — score
// runs computeMatchScore's own extractSkillsFromJD() over the description text,
// same keyword/alias approach the single-JD Tailor flow already trusts, just
// looped across the whole board instead of one pasted JD at a time.
function deriveMatchReasons(profile: UserProfile, job: { location: string; remote: boolean }, matched: string[]): string[] {
  const reasons = matched.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1))
  if (job.remote) reasons.push("Remote")
  else if (profile.location && job.location && job.location.toLowerCase().includes(profile.location.toLowerCase().split(",")[0].trim())) {
    reasons.push("Local to you")
  }
  return reasons
}

export default function RecommendedPage() {
  const [jobs, setJobs] = useState<RecommendedJob[]>([])
  const [filter, setFilter] = useState<"all" | "remote" | "h1b" | "strong">("all")
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [profileSkills, setProfileSkills] = useState<string[]>([])
  const [lastRefresh] = useState(new Date())
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const d = new Set<string>(JSON.parse(localStorage.getItem("jd_reco_dismissed") || "[]"))
      setDismissed(d)
    } catch {}

    async function loadAndScore() {
      const profile = await loadRealProfile()
      setProfileSkills((profile.skills || []).slice(0, 20))

      try {
        // Query the board with the user's own stated title/target role when we
        // have one — a fixed "security engineer" query (the old hardcoded
        // default) has nothing to do with a non-security candidate's profile.
        const q = profile.title || "software engineer"
        const res = await fetchJobsApi(`/api/jobs?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setIsLive(data.live === true)
        if (Array.isArray(data.jobs) && data.jobs.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const scored: RecommendedJob[] = data.jobs.map((j: any) => {
            const match = computeMatchScore(profile, { description: j.description, location: j.location, work_model: j.remote ? "remote" : undefined })
            return {
              id: String(j.id || j.url || Math.random()),
              title: String(j.title || ""),
              company: String(j.company || ""),
              domain: String(j.company || "").toLowerCase().replace(/\s+/g, "") + ".com",
              location: String(j.location || ""),
              remote: Boolean(j.remote),
              salary: j.salary ? String(j.salary) : null,
              workAuth: Array.isArray(j.workAuth) ? j.workAuth : [],
              url: String(j.url || "#"),
              posted: String(j.posted || new Date().toISOString()),
              description: String(j.description || ""),
              matchPct: match.overall,
              matchReasons: deriveMatchReasons(profile, { location: String(j.location || ""), remote: Boolean(j.remote) }, match.matchedSkills),
              source: String(j.source || "Live"),
            }
          }).sort((a: RecommendedJob, b: RecommendedJob) => b.matchPct - a.matchPct)
          setJobs(scored)
        }
      } catch { /* leave jobs empty — the empty state below explains why */ }
      setLoading(false)
    }
    void loadAndScore()
  }, [])

  function dismiss(id: string) {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem("jd_reco_dismissed", JSON.stringify([...next]))
      return next
    })
  }

  const filtered = jobs.filter(j => {
    if (dismissed.has(j.id)) return false
    if (filter === "remote") return j.remote
    if (filter === "h1b") return j.workAuth.includes("h1b") || getH1BScore(j.company).status === "likely"
    if (filter === "strong") return j.matchPct >= 85
    return true
  })

  const hasProfile = profileSkills.length > 0

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: P.text, letterSpacing: "-0.4px", marginBottom: 6 }}>
            ✨ Recommended for You
          </h1>
          <p style={{ fontSize: 13.5, color: P.muted }}>
            {hasProfile
              ? `Matched to your ${profileSkills.slice(0, 3).join(", ")} skills — updated ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Complete your profile to get personalized matches — showing broad recommendations now."}
            {" "}{isLive
              ? <span style={{ color: "#059669", fontWeight: 600 }}>● Live</span>
              : jobs.length > 0 && <span style={{ color: P.hint, fontWeight: 600 }}>Sample data — no job API key configured</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!hasProfile && (
            <Link href="/dashboard/profile" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              Complete Profile →
            </Link>
          )}
          <button onClick={() => window.location.reload()} style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: P.surface, color: P.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Profile skills bar ── */}
      {hasProfile && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1558a0", flexShrink: 0 }}>Matching on:</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {profileSkills.slice(0, 12).map(s => (
              <span key={s} style={{ padding: "2px 9px", borderRadius: 20, background: "rgba(29,111,196,.12)", color: "#1558a0", fontSize: 11.5, fontWeight: 600 }}>{s}</span>
            ))}
          </div>
          <Link href="/dashboard/profile" style={{ marginLeft: "auto", fontSize: 11.5, color: "#1d6fc4", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>Edit profile →</Link>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { key: "all",    label: "All Matches" },
          { key: "strong", label: "✦ 85%+ Match" },
          { key: "h1b",    label: "H-1B Sponsor" },
          { key: "remote", label: "Remote" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)} style={{
            padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${filter === f.key ? "var(--accent)" : P.border}`,
            background: filter === f.key ? "var(--accent)" : P.surface,
            color: filter === f.key ? "#fff" : P.muted,
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all .15s",
          }}>{f.label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: P.hint, alignSelf: "center" }}>
          {filtered.length} jobs
        </span>
      </div>

      {/* ── Job cards ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: P.muted, fontSize: 14 }}>
          Loading recommendations…
        </div>
      )}
      {!loading && filtered.length === 0 && jobs.length > 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", background: P.surface, borderRadius: 16, border: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8 }}>No matches for this filter</p>
          <button onClick={() => setFilter("all")} style={{ padding: "8px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Show All</button>
        </div>
      )}
      {!loading && jobs.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", background: P.surface, borderRadius: 16, border: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8 }}>No live job data configured yet</p>
          <p style={{ fontSize: 13, color: P.muted, marginBottom: 16, maxWidth: 420, margin: "0 auto 16px" }}>
            This board needs a job-search API key (RapidAPI/JSearch) to pull real postings — either set one
            in Settings yourself, or ask whoever runs this deployment to configure <code>RAPID_API_KEY</code>.
          </p>
          <Link href="/dashboard/settings" style={{ padding: "8px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Open Settings →</Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(job => {
          const h1b = getH1BScore(job.company)
          return (
            <div key={job.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start", boxShadow: "0 1px 4px rgba(26,32,53,.05)", transition: "box-shadow .2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(26,32,53,.10)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(26,32,53,.05)" }}
            >
              <CompanyLogo domain={job.domain} name={job.company} size={42} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: P.text }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = P.text }}
                    >{job.title}</span>
                  </a>
                  {job.remote && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#eff6ff", color: "#1d6fc4", border: "1px solid #bfdbfe" }}>Remote</span>}
                  <span style={{ fontSize: 10, color: P.hint, marginLeft: "auto" }}>{timeAgo(job.posted)} via {job.source}</span>
                </div>
                <p style={{ fontSize: 13, color: P.muted, marginBottom: 8 }}>{job.company} · {job.location}{job.salary ? ` · ${job.salary}` : ""}</p>
                <p style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.55, marginBottom: 10 }}>{job.description}</p>

                {/* Match reasons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {job.matchReasons.map(r => (
                    <span key={r} style={{ padding: "2px 9px", borderRadius: 6, background: "#eff6ff", color: "#1558a0", fontSize: 11, fontWeight: 600, border: "1px solid #bfdbfe" }}>✓ {r}</span>
                  ))}
                  <span style={{ padding: "2px 8px", borderRadius: 6, background: h1b.bg, color: h1b.color, fontSize: 11, fontWeight: 700, border: `1px solid ${h1b.border}` }}>{h1b.label}</span>
                  {job.workAuth.slice(0, 2).map(k => {
                    const b = WORK_AUTH_COLORS[k]; if (!b) return null
                    return <span key={k} style={{ padding: "2px 8px", borderRadius: 6, background: b.bg, color: b.color, fontSize: 11, fontWeight: 700, border: `1px solid ${b.border}` }}>{b.label}</span>
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--accent-h))", color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                    Apply Now →
                  </a>
                  <Link href="/dashboard/resume"
                    onClick={() => { try { sessionStorage.setItem("jd_prefill", job.title + " at " + job.company + "\n\n" + job.description) } catch {} }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "#f5f3ff", color: "#6d28d9", fontSize: 12.5, fontWeight: 700, textDecoration: "none", border: "1px solid #ddd6fe" }}>
                    Tailor Resume
                  </Link>
                  <Link href="/dashboard/ai-tools"
                    onClick={() => { try { const t=job.title+" at "+job.company+"\n\n"+job.description; sessionStorage.setItem("jd_ai_tab","cover"); sessionStorage.setItem("jd_prefill_jd",t); sessionStorage.setItem("jd_prefill_role",job.title); sessionStorage.setItem("jd_prefill_company",job.company) } catch {} }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "#eff6ff", color: "#1558a0", fontSize: 12.5, fontWeight: 700, textDecoration: "none", border: "1px solid #bfdbfe" }}>
                    Ask Nexus
                  </Link>
                  <button onClick={() => dismiss(job.id)} style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 7, border: "none", background: "transparent", color: P.hint, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#dc2626" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = P.hint }}
                  >✕ Not interested</button>
                </div>
              </div>

              <MatchRing pct={job.matchPct} />
            </div>
          )
        })}
      </div>

      {/* ── CTA: improve recommendations ── */}
      <div style={{ marginTop: 24, background: "linear-gradient(135deg, #eff6ff, #f5f3ff)", border: "1px solid #bfdbfe", borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 4 }}>Get sharper recommendations</p>
          <p style={{ fontSize: 13, color: P.muted }}>Complete your profile with skills, work auth, and salary expectations to unlock personalized AI matching.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard/profile" style={{ padding: "9px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Complete Profile →</Link>
          <Link href="/dashboard/jobs" style={{ padding: "9px 20px", borderRadius: 9, background: P.surface, color: P.muted, fontSize: 13, fontWeight: 600, textDecoration: "none", border: `1px solid ${P.border}` }}>Browse All Jobs</Link>
        </div>
      </div>
    </div>
  )
}
