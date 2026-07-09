"use client"

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { getH1BScore, type H1BResult } from "@/lib/h1b"
import { connectGmail } from "@/lib/google-auth"
import { fetchJobs as fetchJobsApi } from "@/lib/jobsClient"
import SampleDataBanner from "@/components/SampleDataBanner"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/dialog-provider"
import {
  DATE_FILTERS, matchesDatePosted, type DateFilterKey,
  EXPERIENCE_LEVELS, detectExpLevel, type ExperienceLevel,
  extractSalaryNumber,
  DISTANCE_OPTIONS, METRO_OPTIONS, matchesDistance, type DistanceKey,
  extractSkills, topSkills, companyFacets, isStaffingAgency,
} from "@/lib/jobFilters"
import {
  ClipboardList, Sparkles, BarChart3, Globe, FileText, Zap, Check, Send, Phone,
  Handshake, Laptop, PartyPopper, X, Bell, MapPin, Lock, TriangleAlert, Clock3,
  Search, Bookmark, Link2, Ban, Key, Calendar, GraduationCap, DollarSign,
  Wrench, Building2, ChevronDown, Undo2, Briefcase, Pencil, Mic, Mail,
} from "lucide-react"

// Lazy-load heavy panels
const NexusPanel = dynamic(() => import("@/components/NexusPanel"), { ssr: false })
const MatchBreakdown = dynamic(() => import("@/components/MatchBreakdown"), { ssr: false })
const SalaryInsights = dynamic(() => import("@/components/SalaryInsights"), { ssr: false })

// ── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string; title: string; company: string; location: string; remote: boolean
  salary: string | null; posted: string; description: string
  workAuth: string[]; url: string; source: string
}

interface Profile {
  name?: string; skills?: string[] | string; yearsExp?: number | string
  workAuth?: string; education?: string; targetRoles?: string[]
}

type TabId = "recommended" | "saved" | "applied" | "external"
type DetailTab = "description" | "nexus" | "match"
type ViewMode = "board" | "pipeline" | "analytics"

const WORK_AUTH_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  h1b:           { label: "H-1B",         color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  opt_cpt:       { label: "OPT/CPT",      color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  green_card:    { label: "Green Card",   color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  w2:            { label: "W2",           color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  c2c:           { label: "C2C",          color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  no_sponsorship:{ label: "No Sponsorship",color:"#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

const VISA_FILTER_OPTIONS = [
  { key: "h1b",    label: "H-1B Sponsor" },
  { key: "opt_cpt",label: "OPT / CPT" },
  { key: "green_card", label: "Green Card" },
  { key: "w2",     label: "W2" },
  { key: "c2c",    label: "C2C" },
]

// ── Match helpers ─────────────────────────────────────────────────────────────
function baselineMatch(jobTitle: string, jobDesc: string): number {
  const s = jobTitle + "|" + jobDesc
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return 58 + (h % 37)
}

function computeMatch(jobTitle: string, jobDesc: string, userKeywords: string[]): number {
  if (!userKeywords.length) return baselineMatch(jobTitle, jobDesc)
  const text = (jobTitle + " " + jobDesc).toLowerCase()
  const matched = userKeywords.filter(k => text.includes(k.toLowerCase()))
  const overlap = Math.round((matched.length / userKeywords.length) * 100)
  return Math.max(overlap, Math.round(baselineMatch(jobTitle, jobDesc) * 0.7))
}

function matchVerdict(pct: number): { text: string; color: string; bg: string } {
  if (pct >= 85) return { text: "STRONG MATCH", color: "#065f46", bg: "#ecfdf5" }
  if (pct >= 70) return { text: "GOOD MATCH",   color: "#1558a0", bg: "#eff6ff" }
  if (pct >= 55) return { text: "FAIR MATCH",   color: "#92400e", bg: "#fffbeb" }
  return { text: "LOW MATCH", color: "#6b7280", bg: "#f9fafb" }
}

function getUserKeywords(): string[] {
  try {
    const r = JSON.parse(sessionStorage.getItem("careerkit_last_result") || "{}")
    if (Array.isArray(r.matched_on) && r.matched_on.length) return r.matched_on
  } catch {}
  try {
    const p = JSON.parse(localStorage.getItem("jd_profile") || "{}")
    if (p.skills && typeof p.skills === "string") {
      return p.skills.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 30)
    }
    if (Array.isArray(p.skills)) return p.skills.slice(0, 30)
  } catch {}
  return []
}

function getProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem("jd_profile") || "{}")
    return {
      name: p.full_name || p.name || "",
      skills: p.skills || [],
      yearsExp: p.yearsExp || p.years_experience || 0,
      workAuth: p.workAuth || p.work_auth || "",
      education: p.education || "",
      targetRoles: p.targetRoles || [],
    }
  } catch { return {} }
}

function timeAgo(iso: string): string {
  try {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
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

// ── Company avatar ────────────────────────────────────────────────────────────
function CompanyAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const domain = name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const colors = ["#1d6fc4","#7c3aed","#1d6fc4","#d97706","#dc2626","#0ea5e9","#6366f1","#ea580c"]
  const bg = colors[name.charCodeAt(0) % colors.length]
  if (err) return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), background: bg,
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"#fff", fontWeight:800, fontSize:size*0.38, flexShrink:0,
      boxShadow:`0 3px 10px ${bg}55`,
    }}>{initials}</div>
  )
  return (
    <img src={`https://logo.clearbit.com/${domain}`} alt={name} onError={() => setErr(true)}
      style={{ width:size, height:size, borderRadius:Math.round(size*0.26), objectFit:"contain",
        background:"#fff", border:"1px solid var(--border)", flexShrink:0,
        boxShadow:"0 2px 8px rgba(0,0,0,.08)", padding:4 }}
    />
  )
}

// ── Match ring ────────────────────────────────────────────────────────────────
function MatchRing({ pct, size = 52 }: { pct: number; size?: number }) {
  const r = (size - 7) / 2
  const circ = 2 * Math.PI * r
  const color = pct >= 80 ? "#1558a0" : pct >= 60 ? "#1d4ed8" : pct >= 40 ? "#d97706" : "#9ca3af"
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${(pct/100)*circ} ${circ}`}
          style={{ transition: "stroke-dasharray .8s cubic-bezier(.34,1.56,.64,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.25, fontWeight: 800, color, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: size * 0.18, color: "#9ca3af", lineHeight: 1, marginTop: 1 }}>%</span>
      </div>
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
      padding: "16px 20px",
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Avatar skeleton */}
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--surface-2)",
          flexShrink: 0, animation: "sk-pulse 1.5s ease-in-out infinite" }}/>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 16, width: "55%", borderRadius: 4, background: "var(--surface-2)",
                marginBottom: 7, animation: "sk-pulse 1.5s ease-in-out infinite" }}/>
              <div style={{ height: 12, width: "35%", borderRadius: 4, background: "var(--surface-2)",
                animation: "sk-pulse 1.5s ease-in-out infinite 0.1s" }}/>
            </div>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--surface-2)",
              flexShrink: 0, animation: "sk-pulse 1.5s ease-in-out infinite 0.05s" }}/>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <div style={{ height: 10, width: 60, borderRadius: 20, background: "var(--surface-2)",
              animation: "sk-pulse 1.5s ease-in-out infinite 0.15s" }}/>
            <div style={{ height: 10, width: 80, borderRadius: 20, background: "var(--surface-2)",
              animation: "sk-pulse 1.5s ease-in-out infinite 0.2s" }}/>
            <div style={{ height: 10, width: 50, borderRadius: 20, background: "var(--surface-2)",
              animation: "sk-pulse 1.5s ease-in-out infinite 0.25s" }}/>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 10, width: "100%", borderRadius: 4, background: "var(--surface-2)",
              marginBottom: 5, animation: "sk-pulse 1.5s ease-in-out infinite 0.3s" }}/>
            <div style={{ height: 10, width: "75%", borderRadius: 4, background: "var(--surface-2)",
              animation: "sk-pulse 1.5s ease-in-out infinite 0.35s" }}/>
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
            <div style={{ height: 30, width: 90, borderRadius: 9, background: "var(--surface-2)",
              animation: "sk-pulse 1.5s ease-in-out infinite 0.4s" }}/>
            <div style={{ height: 30, width: 70, borderRadius: 9, background: "var(--surface-2)",
              animation: "sk-pulse 1.5s ease-in-out infinite 0.45s" }}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── H1B Badge ─────────────────────────────────────────────────────────────────
function H1BBadge({ company }: { company: string }) {
  const result: H1BResult = getH1BScore(company)
  return (
    <span title={result.reason} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: result.bg, border: `1px solid ${result.border}`, color: result.color,
      cursor: "help",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }}/> {result.label}
    </span>
  )
}

// ── Job Detail Panel ──────────────────────────────────────────────────────────
function JobDetailPanel({
  job, match, verdict, isSaved, isApplied, profile,
  onClose, onSave, onApply,
}: {
  job: Job; match: number; verdict: { text: string; color: string; bg: string }
  isSaved: boolean; isApplied: boolean; profile: Profile
  onClose: () => void; onSave: () => void; onApply: () => void
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("description")
  const h1bResult = getH1BScore(job.company)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const DETAIL_TABS: { id: DetailTab; label: string; Icon: typeof ClipboardList }[] = [
    { id: "description", label: "Job Details", Icon: ClipboardList },
    { id: "nexus",       label: "Nexus AI",    Icon: Sparkles  },
    { id: "match",       label: "Match Score", Icon: BarChart3 },
  ]

  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,.35)",
        zIndex:300, backdropFilter:"blur(2px)",
      }}/>
      <div style={{
        position:"fixed", top:0, right:0, bottom:0, width:520, maxWidth:"92vw",
        background:"#fff", zIndex:301,
        boxShadow:"-8px 0 40px rgba(0,0,0,.15)",
        display:"flex", flexDirection:"column",
        animation:"slideInRight .22s cubic-bezier(.16,1,.3,1)",
      }}>
        {/* Header */}
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <CompanyAvatar name={job.company} size={50} />
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontSize:16, fontWeight:800, color:"var(--text)", lineHeight:1.25, marginBottom:3 }}>
                {job.title}
              </h2>
              <p style={{ fontSize:13, color:"var(--text-muted)", fontWeight:500 }}>
                {job.company}
                {job.location && <span style={{ color:"var(--text-soft)" }}> · {job.location}</span>}
              </p>
            </div>
            {/* Match ring */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0 }}>
              <MatchRing pct={match} size={52} />
              <span style={{ fontSize:8, fontWeight:800, letterSpacing:".4px",
                padding:"2px 7px", borderRadius:20, whiteSpace:"nowrap",
                color:verdict.color, background:verdict.bg, border:`1px solid ${verdict.color}22`,
              }}>{verdict.text}</span>
            </div>
            <button onClick={onClose} style={{
              width:28, height:28, borderRadius:8, border:"1px solid var(--border)",
              background:"var(--surface-2)", cursor:"pointer", display:"flex",
              alignItems:"center", justifyContent:"center", fontSize:14, color:"var(--text-muted)", flexShrink:0,
            }}>×</button>
          </div>

          {/* Meta row */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 12px", marginTop:10, fontSize:12, color:"var(--text-soft)", alignItems:"center" }}>
            {job.remote && <span style={{ color:"var(--accent)", fontWeight:700, display:"inline-flex", alignItems:"center", gap:3 }}><Globe size={11}/> Remote</span>}
            {job.salary && <span style={{ color:"var(--accent)", fontWeight:700 }}>{job.salary}</span>}
            <span>{timeAgo(job.posted)}</span>
            <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20,
              background: job.source === "sample" ? "#f9fafb" : "#eff6ff",
              border:`1px solid ${job.source === "sample" ? "#e5e7eb" : "#bfdbfe"}`,
              color: job.source === "sample" ? "var(--text-soft)" : "var(--accent)", fontWeight:700,
            }}>{job.source === "sample" ? "Sample" : "Live"}</span>
          </div>

          {/* Work auth + H1B badge */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:10 }}>
            {/* H1B smart badge */}
            <H1BBadge company={job.company} />
            {job.workAuth.map(w => {
              const s = WORK_AUTH_LABELS[w]
              return s ? (
                <span key={w} style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700,
                  background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>
                  {s.label}
                </span>
              ) : null
            })}
          </div>
        </div>

        {/* Tab nav */}
        <div style={{
          display:"flex", borderBottom:"1px solid var(--border)", flexShrink:0,
          background:"#f8f9fb",
        }}>
          {DETAIL_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                flex:1, padding:"10px 8px", border:"none", cursor:"pointer",
                fontSize:12, fontWeight: activeTab === tab.id ? 700 : 600,
                color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
                background: activeTab === tab.id ? "#fff" : "transparent",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                transition:"all .15s", display:"flex", alignItems:"center", justifyContent:"center", gap:5,
              }}>
              <tab.Icon size={13}/>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>

          {/* Description tab */}
          {activeTab === "description" && (
            <>
              {/* AI Quick Actions */}
              <div style={{
                padding:"12px 20px", borderBottom:"1px solid var(--border)",
                background:"linear-gradient(135deg,#f8fbff,#f5f3ff)", flexShrink:0,
              }}>
                <p style={{ fontSize:10.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px",
                  color:"var(--text-soft)", marginBottom:8 }}>AI Quick Actions</p>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  <button onClick={() => setActiveTab("nexus")} style={{
                    display:"inline-flex", alignItems:"center", gap:5, padding:"7px 13px",
                    background:"linear-gradient(135deg,var(--accent),var(--accent-h))", color:"#fff", borderRadius:8,
                    fontSize:11.5, fontWeight:700, border:"none", cursor:"pointer",
                    boxShadow:"0 3px 10px color-mix(in srgb, var(--accent) 28%, transparent)",
                  }}><Sparkles size={13}/> Ask Nexus AI</button>
                  <Link
                    href="/dashboard/resume"
                    onClick={() => {
                      try {
                        const jd = job.title + " at " + job.company + ".\n\n" + job.description
                        sessionStorage.setItem("jd_prefill", jd)
                        sessionStorage.setItem("jd_prefill_jd", jd)
                        sessionStorage.setItem("jd_prefill_role", job.title)
                        sessionStorage.setItem("jd_prefill_company", job.company)
                      } catch {}
                    }}
                    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"7px 13px",
                      background:"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"#fff", borderRadius:8,
                      fontSize:11.5, fontWeight:700, textDecoration:"none",
                      boxShadow:"0 3px 10px rgba(124,58,237,.28)",
                    }}><FileText size={13}/> Tailor Resume</Link>
                  <button onClick={() => setActiveTab("match")} style={{
                    display:"inline-flex", alignItems:"center", gap:5, padding:"7px 13px",
                    background:"linear-gradient(135deg,#0ea5e9,#0f766e)", color:"#fff", borderRadius:8,
                    fontSize:11.5, fontWeight:700, border:"none", cursor:"pointer",
                    boxShadow:"0 3px 10px rgba(13,148,136,.28)",
                  }}><BarChart3 size={13}/> Match Breakdown</button>
                </div>
              </div>

              {/* H1B explanation block */}
              <div style={{
                margin:"14px 20px 0", padding:"10px 12px", borderRadius:9,
                background: h1bResult.bg, border:`1px solid ${h1bResult.border}`,
                flexShrink:0,
              }}>
                <p style={{ fontSize:11, fontWeight:700, color: h1bResult.color, marginBottom:2, display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"currentColor", flexShrink:0 }}/> {h1bResult.label}
                </p>
                <p style={{ fontSize:11, color:"#374151", lineHeight:1.5 }}>{h1bResult.reason}</p>
              </div>

              {/* Description */}
              <div style={{ flex:1, overflowY:"auto", padding:"14px 20px", display:"flex", flexDirection:"column", gap:12 }}>
                {/* Salary intelligence — lazy loads on first click */}
                <SalaryInsights role={job.title} company={job.company} location={job.location} />

                <div>
                  <h3 style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", color:"var(--text-soft)", marginBottom:10 }}>
                    Job Description
                  </h3>
                  {job.description ? (
                    <p style={{ fontSize:13, color:"#4b5563", lineHeight:1.75, whiteSpace:"pre-wrap" }}>
                      {job.description}
                    </p>
                  ) : (
                    <p style={{ fontSize:13, color:"var(--text-soft)", fontStyle:"italic" }}>
                      No description available for this listing.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Nexus AI tab */}
          {activeTab === "nexus" && (
            <NexusPanel
              job={job}
              profile={profile}
              matchScore={match}
              h1bStatus={h1bResult.status}
            />
          )}

          {/* Match breakdown tab */}
          {activeTab === "match" && (
            <div style={{ flex:1, overflowY:"auto" }}>
              <MatchBreakdown
                jd={job.description}
                profile={{
                  skills: profile.skills,
                  yearsExp: profile.yearsExp,
                  education: profile.education,
                }}
              />
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div style={{
          padding:"14px 20px", borderTop:"1px solid var(--border)",
          background:"#f8f9fb", display:"flex", gap:8, alignItems:"center", flexShrink:0,
        }}>
          {job.url && job.url !== "#" ? (
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              onClick={onApply}
              style={{ flex:1, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
                padding:"10px 18px",
                background: isApplied
                  ? "linear-gradient(135deg,var(--accent-h),var(--success))"
                  : "linear-gradient(135deg,var(--accent),var(--accent-h))",
                color:"#fff", borderRadius:9, fontSize:13, fontWeight:700, textDecoration:"none",
                boxShadow:"0 3px 12px color-mix(in srgb, var(--accent) 30%, transparent)",
              }}>
              {isApplied ? <><Check size={14}/> Applied</> : <><Zap size={14} fill="currentColor"/> Apply with Autofill</>}
            </a>
          ) : (
            <span style={{ flex:1, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
              padding:"10px 18px", background:"var(--accent-soft)", color:"var(--accent-txt)",
              border:"1px solid #bfdbfe", borderRadius:9, fontSize:13, fontWeight:700 }}>
              <Zap size={14} fill="currentColor"/> Apply with Autofill
            </span>
          )}
          <button onClick={onSave} style={{
            padding:"10px 14px", borderRadius:9, cursor:"pointer",
            color: isSaved ? "var(--accent)" : "var(--text-muted)",
            background: isSaved ? "#eff6ff" : "#fff",
            border: `1px solid ${isSaved ? "#bfdbfe" : "var(--border)"}`,
            transition:"all .15s", fontSize:12, fontWeight:700,
            display:"flex", alignItems:"center", gap:5,
          }}>
            <svg width="14" height="14" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
            </svg>
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ── Inline Pipeline (rich Kanban) ─────────────────────────────────────────────
type AppStage = "applied" | "screening" | "interview" | "technical" | "offer" | "rejected"
interface AppItem {
  id: string; company: string; role: string; location: string; remote: boolean
  salary: string; stage: AppStage; appliedDate: string; followUpDate?: string
  notes: string; url: string; visa: string; priority: "high" | "mid" | "low"
}
// Each pipeline stage gets its own fixed hue (not tied to the brand accent) so
// stage meaning stays readable regardless of which accent color is active,
// and so no two stages are ever visually confused with each other.
const APP_STAGES: { id: AppStage; label: string; color: string; rgb: string; Icon: typeof Send }[] = [
  { id: "applied",    label: "Applied",    color: "#1d6fc4", rgb: "29,111,196",  Icon: Send },
  { id: "screening",  label: "Screening",  color: "#d97706", rgb: "217,119,6",   Icon: Phone },
  { id: "interview",  label: "Interview",  color: "#0ea5e9", rgb: "14,165,233",  Icon: Handshake },
  { id: "technical",  label: "Technical",  color: "#7c3aed", rgb: "124,58,237",  Icon: Laptop },
  { id: "offer",      label: "Offer",      color: "#059669", rgb: "5,150,105",   Icon: PartyPopper },
  { id: "rejected",   label: "Rejected",   color: "#dc2626", rgb: "220,38,38",   Icon: X },
]
const APP_PRIORITY = {
  high: { label: "High", color: "#ef4444" },
  mid:  { label: "Mid",  color: "#f59e0b" },
  low:  { label: "Low",  color: "#6b7280" },
}
const APP_COLORS = ["bg-blue-600","bg-violet-600","bg-emerald-600","bg-orange-500","bg-teal-600","bg-rose-500","bg-indigo-600","bg-amber-500"]
function appCo(name: string) { return APP_COLORS[(name||"A").charCodeAt(0) % APP_COLORS.length] }
function appUid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
function appIsOverdue(d?: string) { return !!d && new Date(d) < new Date(new Date().toDateString()) }
function appIsDueSoon(d?: string) {
  if (!d) return false
  const dt = new Date(d), tom = new Date(); tom.setDate(tom.getDate() + 1)
  return dt >= new Date(new Date().toDateString()) && dt <= tom
}
function appDaysSince(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return "Today"; if (d === 1) return "1d ago"
  if (d < 7) return `${d}d ago`; if (d < 30) return `${Math.floor(d/7)}w ago`
  return `${Math.floor(d/30)}mo ago`
}
function makeSampleApps(): AppItem[] {
  const dAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
  return [
    { id: appUid(), company:"Palo Alto Networks", role:"Cloud Security Engineer",    location:"Santa Clara, CA", remote:true,  salary:"$175k – $230k", stage:"interview", appliedDate:dAgo(12), followUpDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10), notes:"3rd round next Tuesday", url:"#", visa:"Green Card", priority:"high" },
    { id: appUid(), company:"CrowdStrike",         role:"DevSecOps Engineer",         location:"Austin, TX",      remote:true,  salary:"$155k – $200k", stage:"screening", appliedDate:dAgo(7),  followUpDate:new Date(Date.now()-1*86400000).toISOString().slice(0,10), notes:"Recruiter call scheduled", url:"#", visa:"H-1B", priority:"high" },
    { id: appUid(), company:"Cisco",               role:"Network Security Architect", location:"San Jose, CA",    remote:false, salary:"$160k – $210k", stage:"applied",   appliedDate:dAgo(3),  notes:"", url:"#", visa:"Green Card", priority:"mid" },
    { id: appUid(), company:"Databricks",          role:"Senior Data Engineer",       location:"San Francisco",   remote:true,  salary:"$160k – $220k", stage:"offer",     appliedDate:dAgo(30), notes:"Offer: $185k + equity", url:"#", visa:"Green Card", priority:"high" },
    { id: appUid(), company:"Stripe",              role:"Senior Software Engineer",   location:"San Francisco",   remote:true,  salary:"$180k – $240k", stage:"applied",   appliedDate:dAgo(1),  notes:"", url:"#", visa:"H-1B", priority:"mid" },
  ]
}
function exportPipelineCSV(apps: AppItem[]) {
  const esc = (v: string) => `"${String(v??"").replace(/"/g,'""')}"`
  const hdrs = ["Company","Role","Location","Remote","Salary","Stage","Visa","Priority","Applied Date","Follow-up Date","Notes","URL"]
  const rows = apps.map(a => [
    a.company, a.role, a.location, a.remote?"Yes":"No", a.salary,
    APP_STAGES.find(s=>s.id===a.stage)?.label??a.stage,
    a.visa, a.priority.toUpperCase(),
    a.appliedDate?new Date(a.appliedDate).toLocaleDateString():"",
    a.followUpDate??"", a.notes, a.url,
  ].map(esc).join(","))
  const csv = "﻿" + [hdrs.map(esc).join(","), ...rows].join("\r\n")
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const el = document.createElement("a"); el.href=url; el.download=`pipeline_${new Date().toISOString().slice(0,10)}.csv`; el.click(); URL.revokeObjectURL(url)
}

function AddAppModal({ onAdd, onClose }: { onAdd:(a:AppItem)=>void; onClose:()=>void }) {
  const [form, setForm] = useState<Omit<AppItem,"id">>({
    company:"", role:"", location:"", remote:false, salary:"",
    stage:"applied", appliedDate:new Date().toISOString(), followUpDate:"", notes:"", url:"", visa:"", priority:"mid",
  })
  const setF = <K extends keyof typeof form>(k:K, v:(typeof form)[K]) => setForm(p=>({...p,[k]:v}))
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company.trim()||!form.role.trim()) return
    onAdd({...form, id:appUid(), appliedDate:new Date().toISOString()}); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,.5)"}} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border p-6" style={{background:"var(--surface)",borderColor:"var(--border)",boxShadow:"0 24px 64px -12px rgba(0,0,0,.4)"}} onClick={e=>e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4" style={{color:"var(--text)"}}>Add Application</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(["company","role","location","salary"] as const).map(k=>(
              <div key={k}>
                <label className="block text-xs font-semibold mb-1 capitalize" style={{color:"var(--text-soft)"}}>{k}{(k==="company"||k==="role")?" *":""}</label>
                <input required={k==="company"||k==="role"} value={String(form[k]??"")} onChange={e=>setF(k,e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}/>
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{color:"var(--text-soft)"}}>Visa / Work Auth</label>
              <select value={form.visa} onChange={e=>setF("visa",e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}>
                <option value="">Not specified</option><option>H-1B</option><option>Green Card</option><option>OPT/CPT</option><option>W2</option><option>C2C</option><option>US Citizen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{color:"var(--text-soft)"}}>Priority</label>
              <select value={form.priority} onChange={e=>setF("priority",e.target.value as AppItem["priority"])} className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}>
                <option value="high">High</option><option value="mid">Mid</option><option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{color:"var(--text-soft)"}}>Job URL</label>
              <input type="url" value={form.url} onChange={e=>setF("url",e.target.value)} placeholder="https://..." className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}/>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 inline-flex items-center gap-1" style={{color:"var(--text-soft)"}}><Bell size={11}/> Follow-up Date</label>
              <input type="date" value={form.followUpDate??""} onChange={e=>setF("followUpDate",e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{color:"var(--text-soft)"}}>Notes</label>
            <textarea value={form.notes} onChange={e=>setF("notes",e.target.value)} rows={2} placeholder="Recruiter name, interview date, next steps…" className="w-full px-3 py-2 text-sm rounded-xl border resize-none" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}/>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{color:"var(--text-muted)"}}>
            <input type="checkbox" checked={form.remote} onChange={e=>setF("remote",e.target.checked)} style={{accentColor:"var(--accent)"}}/>
            Remote position
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button type="submit" className="btn-accent flex-1 py-2.5 text-sm">Add Application</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AppCard({ app, onMove, onDelete, onEdit }: { app:AppItem; onMove:(id:string,to:AppStage)=>void; onDelete:(id:string)=>void; onEdit:(a:AppItem)=>void }) {
  const { confirm } = useDialogs()
  const [expanded, setExpanded] = useState(false)
  const stage = APP_STAGES.find(s=>s.id===app.stage)!
  const pri = APP_PRIORITY[app.priority]
  const nextStages = APP_STAGES.filter(s=>s.id!==app.stage&&s.id!=="rejected")
  return (
    <div className="rounded-xl border p-3 space-y-2 cursor-pointer"
      style={{background:"var(--surface)",borderColor:"var(--border)",borderLeft:`3px solid ${stage.color}`,transition:"box-shadow .15s,transform .15s"}}
      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow="var(--shadow-card-hover)";(e.currentTarget as HTMLElement).style.transform="translateY(-1px)"}}
      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow="";(e.currentTarget as HTMLElement).style.transform=""}}
      onClick={()=>setExpanded(!expanded)}>
      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-lg ${appCo(app.company)} flex-shrink-0 flex items-center justify-center text-white font-bold text-sm select-none`}>{app.company[0]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{color:"var(--text)"}}>{app.role}</p>
          <p className="text-xs truncate" style={{color:"var(--text-muted)"}}>{app.company}</p>
        </div>
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" title={`${pri.label} priority`} style={{background:pri.color}}/>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{color:"var(--text-soft)"}}>
        {app.location&&<span className="inline-flex items-center gap-1">{app.remote?<Globe size={11}/>:<MapPin size={11}/>} {app.location}</span>}
        {app.salary&&<span className="font-semibold" style={{color:"#3b82f6"}}>{app.salary}</span>}
        <span className="ml-auto">{appDaysSince(app.appliedDate)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {app.visa&&<span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{background:"var(--accent-soft)",color:"var(--accent-txt)"}}>{app.visa}</span>}
        {app.followUpDate&&appIsOverdue(app.followUpDate)&&<span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1" style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca"}}><Bell size={10}/> Overdue: {new Date(app.followUpDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
        {app.followUpDate&&appIsDueSoon(app.followUpDate)&&!appIsOverdue(app.followUpDate)&&<span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1" style={{background:"#fffbeb",color:"#d97706",border:"1px solid #fde68a"}}><Bell size={10}/> Soon: {new Date(app.followUpDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
        {app.followUpDate&&!appIsOverdue(app.followUpDate)&&!appIsDueSoon(app.followUpDate)&&<span className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1" style={{background:"#f0f9ff",color:"#0369a1",border:"1px solid #bae6fd"}}><Bell size={10}/> {new Date(app.followUpDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
      </div>
      {expanded&&(
        <div className="pt-1 space-y-2 border-t" style={{borderColor:"var(--border)"}}>
          {app.notes&&<p className="text-xs leading-relaxed inline-flex items-start gap-1.5" style={{color:"var(--text-muted)"}}><ClipboardList size={12} style={{flexShrink:0,marginTop:2}}/> {app.notes}</p>}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--text-soft)"}}>Move to</p>
            <div className="flex flex-wrap gap-1">
              {nextStages.map(s=>(
                <button key={s.id} onClick={e=>{e.stopPropagation();onMove(app.id,s.id)}} className="text-xs px-2 py-1 rounded-lg font-medium inline-flex items-center gap-1" style={{background:`rgba(${s.rgb},.12)`,color:s.color,border:`1px solid rgba(${s.rgb},.25)`}}><s.Icon size={11}/> {s.label}</button>
              ))}
              <button onClick={e=>{e.stopPropagation();onMove(app.id,"rejected")}} className="text-xs px-2 py-1 rounded-lg font-medium inline-flex items-center gap-1" style={{background:"rgba(239,68,68,.1)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)"}}><X size={11}/> Reject</button>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/dashboard/ai-tools#interviews" onClick={e=>e.stopPropagation()} className="text-xs px-2 py-1 rounded-lg font-semibold inline-flex items-center gap-1" style={{background:"rgba(124,58,237,.1)",color:"#7c3aed",textDecoration:"none"}}><Mic size={11}/> Prep</a>
            <a href="/dashboard/ai-tools#cover" onClick={e=>e.stopPropagation()} className="text-xs px-2 py-1 rounded-lg font-semibold inline-flex items-center gap-1" style={{background:"color-mix(in srgb, var(--accent) 10%, transparent)",color:"var(--accent)",textDecoration:"none"}}><Mail size={11}/> Cover</a>
          </div>
          <div className="flex gap-2 pt-1">
            {app.url&&app.url!=="#"&&<a href={app.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="btn-ghost text-xs px-2 py-1">Open Job →</a>}
            <button onClick={e=>{e.stopPropagation();onEdit(app)}} className="btn-ghost text-xs px-2 py-1">Edit</button>
            <button onClick={async e=>{e.stopPropagation();if(await confirm("Delete this application?",{title:"Delete application",confirmLabel:"Delete",destructive:true}))onDelete(app.id)}} className="btn-ghost text-xs px-2 py-1 ml-auto" style={{color:"var(--danger)"}}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AppColumn({ stage, apps, onMove, onDelete, onEdit }: { stage:typeof APP_STAGES[0]; apps:AppItem[]; onMove:(id:string,to:AppStage)=>void; onDelete:(id:string)=>void; onEdit:(a:AppItem)=>void }) {
  return (
    <div className="flex flex-col flex-shrink-0" style={{width:"clamp(200px,22vw,260px)",minWidth:210}}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{background:stage.color}}/>
          <span className="text-xs font-bold uppercase tracking-wider" style={{color:"var(--text-muted)"}}>{stage.label}</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:apps.length?`rgba(${stage.rgb},.12)`:"var(--surface-2)",color:apps.length?stage.color:"var(--text-soft)"}}>{apps.length}</span>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {apps.map(a=><AppCard key={a.id} app={a} onMove={onMove} onDelete={onDelete} onEdit={onEdit}/>)}
        {apps.length===0&&(
          <div className="rounded-xl border-2 border-dashed p-6 text-center" style={{borderColor:`rgba(${stage.rgb},.2)`}}>
            <p className="text-xs" style={{color:"var(--text-soft)"}}>{stage.id==="rejected"?"No rejections":`No ${stage.label.toLowerCase()} yet`}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Gmail Gate blur wrapper ────────────────────────────────────────────────────
// Shows content at 95% opacity (5% teaser veil) so users can see everything.
// A small floating badge in the top-right corner prompts them to connect Gmail.
function GmailGate({ children, connected, onConnect }: {
  children: ReactNode
  connected: boolean
  onConnect: () => void
}) {
  if (connected) return <>{children}</>
  return (
    <div style={{ position: "relative" }}>
      {/* 5% opacity veil — content is fully readable, just hinted as "teaser" */}
      <div style={{
        opacity: 0.95,
        pointerEvents: "none",
        userSelect: "none",
        transition: "opacity 0.3s ease",
      }}>
        {children}
      </div>

      {/* Small floating CTA badge — top right, non-blocking */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 10,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "12px 16px",
        boxShadow: "0 4px 20px rgba(0,0,0,.12)",
        display: "flex", alignItems: "center", gap: 12, maxWidth: 340,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: "linear-gradient(135deg,#4285f4,#34a853)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        }}><Lock size={16}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", marginBottom: 1 }}>
            Connect Gmail to unlock
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
            Auto-track recruiter replies &amp; offers
          </div>
        </div>
        <button
          onClick={onConnect}
          style={{
            flexShrink: 0, padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#4285f4,#34a853)",
            color: "#fff", fontSize: 12, fontWeight: 700,
            boxShadow: "0 2px 10px rgba(66,133,244,.4)",
          }}
        >Connect →</button>
      </div>
    </div>
  )
}

function PipelineView() {
  const [apps, setApps] = useState<AppItem[]>([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AppItem | null>(null)
  const [mounted, setMounted] = useState(false)
  const [pipeView, setPipeView] = useState<"board"|"list">("board")

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("jd_applications_v2") || "null")
      setApps(stored ?? makeSampleApps())
    } catch { setApps(makeSampleApps()) }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) { try { localStorage.setItem("jd_applications_v2", JSON.stringify(apps)) } catch {} }
  }, [apps, mounted])

  function addApp(a: AppItem) { setApps(p=>[a,...p]) }
  function moveApp(id: string, to: AppStage) { setApps(p=>p.map(a=>a.id===id?{...a,stage:to}:a)) }
  function deleteApp(id: string) { setApps(p=>p.filter(a=>a.id!==id)) }
  function saveEdit(updated: AppItem) { setApps(p=>p.map(a=>a.id===updated.id?updated:a)); setEditing(null) }

  const counts = Object.fromEntries(APP_STAGES.map(s=>[s.id,apps.filter(a=>a.stage===s.id).length])) as Record<AppStage,number>
  const active = apps.filter(a=>a.stage!=="rejected").length

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 style={{fontSize:20,fontWeight:800,color:"var(--text)",letterSpacing:"-0.4px"}}>My Pipeline</h2>
          <p style={{fontSize:13,color:"var(--text-muted)",marginTop:2}}>{active} active · {apps.length} total · {counts.offer??0} offer{counts.offer!==1?"s":""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl p-0.5 gap-0.5" style={{background:"var(--surface-2)",border:"1px solid var(--border)"}}>
            <button onClick={()=>setPipeView("board")} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={pipeView==="board"?{background:"var(--surface)",color:"var(--text)",boxShadow:"0 1px 3px rgba(0,0,0,.1)"}:{color:"var(--text-soft)"}}>⬜ Board</button>
            <button onClick={()=>setPipeView("list")} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={pipeView==="list"?{background:"var(--surface)",color:"var(--text)",boxShadow:"0 1px 3px rgba(0,0,0,.1)"}:{color:"var(--text-soft)"}}>≡ List</button>
          </div>
          <button onClick={()=>exportPipelineCSV(apps)} className="btn-ghost px-3 py-2 text-sm" style={{border:"1px solid var(--border)"}}>⬇ CSV</button>
          <button onClick={()=>setAdding(true)} className="btn-accent px-4 py-2 text-sm">+ Add Application</button>
        </div>
      </div>

      {/* Stage stats bar */}
      <div className="flex gap-3 flex-wrap mb-4">
        {APP_STAGES.map(s=>(
          <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2 border text-sm" style={{background:counts[s.id]?`rgba(${s.rgb},.07)`:"var(--surface)",borderColor:counts[s.id]?`rgba(${s.rgb},.25)`:"var(--border)"}}>
            <span style={{color:s.color, display:"flex"}}><s.Icon size={14}/></span>
            <span className="font-semibold" style={{color:s.color}}>{counts[s.id]}</span>
            <span className="text-xs" style={{color:"var(--text-soft)"}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Board view */}
      {pipeView==="board"&&(
        <div className="flex gap-4 overflow-x-auto pb-4" style={{scrollSnapType:"x mandatory"}}>
          {APP_STAGES.map(stage=>(
            <AppColumn key={stage.id} stage={stage} apps={apps.filter(a=>a.stage===stage.id)} onMove={moveApp} onDelete={deleteApp} onEdit={setEditing}/>
          ))}
        </div>
      )}

      {/* List view */}
      {pipeView==="list"&&(
        <div className="rounded-2xl border overflow-hidden" style={{background:"var(--surface)",borderColor:"var(--border)"}}>
          <table className="w-full">
            <thead>
              <tr style={{background:"var(--surface-2)"}}>
                {["Company / Role","Stage","Salary","Follow-up","Applied",""].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{color:"var(--text-soft)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map(app=>{
                const s=APP_STAGES.find(st=>st.id===app.stage)!
                return (
                  <tr key={app.id} style={{borderTop:"1px solid var(--border)",transition:"background var(--t-fast)"}}
                    onMouseEnter={e=>((e.currentTarget as HTMLElement).style.background="var(--surface-2)")}
                    onMouseLeave={e=>((e.currentTarget as HTMLElement).style.background="")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${appCo(app.company)} flex-shrink-0 flex items-center justify-center text-white font-bold text-sm`}>{app.company[0]}</div>
                        <div><p className="text-sm font-semibold" style={{color:"var(--text)"}}>{app.role}</p><p className="text-xs" style={{color:"var(--text-muted)"}}>{app.company}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1" style={{background:`rgba(${s.rgb},.12)`,color:s.color}}><s.Icon size={11}/> {s.label}</span></td>
                    <td className="px-4 py-3 text-sm font-medium" style={{color:"#3b82f6"}}>{app.salary||"—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {app.followUpDate
                        ?<span className="inline-flex items-center gap-1" style={{color:appIsOverdue(app.followUpDate)?"#dc2626":appIsDueSoon(app.followUpDate)?"#d97706":"var(--text-soft)",fontWeight:appIsOverdue(app.followUpDate)?700:400}}>
                          {appIsOverdue(app.followUpDate)?<TriangleAlert size={10}/>:appIsDueSoon(app.followUpDate)?<Clock3 size={10}/>:null}{new Date(app.followUpDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                         </span>
                        :<span style={{color:"var(--text-soft)"}}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{color:"var(--text-soft)"}}>{appDaysSince(app.appliedDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <select value={app.stage} onChange={e=>moveApp(app.id,e.target.value as AppStage)} className="text-xs px-2 py-1 rounded-lg border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}} onClick={e=>e.stopPropagation()}>
                          {APP_STAGES.map(st=><option key={st.id} value={st.id}>{st.label}</option>)}
                        </select>
                        <button onClick={()=>setEditing(app)} className="btn-ghost px-2 py-1 text-xs flex items-center"><Pencil size={12}/></button>
                        <button onClick={()=>deleteApp(app.id)} className="btn-ghost px-2 py-1 text-xs flex items-center" style={{color:"#ef4444"}}><X size={12}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {apps.length===0&&<div className="py-10 flex flex-col items-center" style={{color:"var(--text-soft)"}}><p className="text-sm font-medium">No applications yet. Click <strong style={{color:"var(--text)"}}>+ Add Application</strong> to get started.</p></div>}
        </div>
      )}

      {/* Add modal */}
      {adding&&<AddAppModal onAdd={addApp} onClose={()=>setAdding(false)}/>}

      {/* Edit modal */}
      {editing&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,.5)"}} onClick={()=>setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl border p-6" style={{background:"var(--surface)",borderColor:"var(--border)",boxShadow:"0 24px 64px -12px rgba(0,0,0,.4)"}} onClick={e=>e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{color:"var(--text)"}}>Edit Application</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {(["company","role","location","salary","visa","url"] as const).map(k=>(
                  <div key={k}>
                    <label className="block text-xs font-semibold mb-1 capitalize" style={{color:"var(--text-soft)"}}>{k}</label>
                    <input value={String(editing[k]??"")} onChange={e=>setEditing(p=>p?{...p,[k]:e.target.value}:p)} className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}/>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{color:"var(--text-soft)"}}>Stage</label>
                  <select value={editing.stage} onChange={e=>setEditing(p=>p?{...p,stage:e.target.value as AppStage}:p)} className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}>
                    {APP_STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 inline-flex items-center gap-1" style={{color:"var(--text-soft)"}}><Bell size={11}/> Follow-up</label>
                  <input type="date" value={editing.followUpDate??""} onChange={e=>setEditing(p=>p?{...p,followUpDate:e.target.value}:p)} className="w-full px-3 py-2 text-sm rounded-xl border" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color:"var(--text-soft)"}}>Notes</label>
                <textarea value={editing.notes} onChange={e=>setEditing(p=>p?{...p,notes:e.target.value}:p)} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border resize-none" style={{background:"var(--surface-2)",borderColor:"var(--border)",color:"var(--text)",outline:"none"}}/>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={()=>setEditing(null)} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
                <button onClick={()=>saveEdit(editing!)} className="btn-accent flex-1 py-2.5 text-sm">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline Analytics view ─────────────────────────────────────────────────────
function AnalyticsView() {
  const [apps, setApps] = useState<AppItem[]>([])
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
      if (stored.length) setApps(stored)
    } catch {}
  }, [])

  const totalApps = apps.length
  const byStage = APP_STAGES.map(s => ({
    ...s,
    count: apps.filter(a => a.stage === s.id).length,
    pct: totalApps > 0 ? Math.round((apps.filter(a => a.stage === s.id).length / totalApps) * 100) : 0,
  }))
  const offerCount   = apps.filter(a => a.stage === "offer").length
  const interviewCount = apps.filter(a => ["interview", "technical", "offer"].includes(a.stage)).length
  const rejectCount  = apps.filter(a => a.stage === "rejected").length

  // Last 7 days applications
  const last7 = apps.filter(a => {
    try { return (Date.now() - new Date(a.appliedDate).getTime()) < 7 * 86400000 } catch { return false }
  }).length

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:"var(--text)", letterSpacing:"-0.4px" }}>Pipeline Analytics</h2>
        <p style={{ fontSize:13, color:"var(--text-muted)", marginTop:2 }}>
          Powered by your {totalApps} tracked applications
        </p>
      </div>

      {totalApps === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"var(--text-muted)" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:12, color:"var(--text-soft)" }}><BarChart3 size={44}/></div>
          <p style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>No application data yet</p>
          <p style={{ fontSize:13, color:"var(--text-muted)", marginTop:6 }}>
            Start tracking applications using the Pipeline tab or the "Track" button on job cards.
          </p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, marginBottom:20 }}>
            {[
              { label:"Total Applied",   value:totalApps,      color:"var(--accent)", Icon:Send },
              { label:"Interviews",      value:interviewCount,  color:"#0ea5e9", Icon:Handshake },
              { label:"Offers",          value:offerCount,      color:"#059669", Icon:PartyPopper },
              { label:"Last 7 Days",     value:last7,           color:"#7c3aed", Icon:Calendar },
            ].map(s => (
              <div key={s.label} style={{
                background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14,
                padding:"14px 16px", textAlign:"center",
              }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:4, color:s.color }}><s.Icon size={20}/></div>
                <div style={{ fontSize:24, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", fontWeight:600, marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pipeline funnel */}
          <div style={{
            background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16,
            padding:"20px 22px", marginBottom:16,
          }}>
            <h3 style={{ fontSize:14, fontWeight:800, color:"var(--text)", marginBottom:16 }}>
              Stage Breakdown
            </h3>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {byStage.map(s => (
                <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:80, fontSize:12, fontWeight:600, color:"var(--text-muted)", textAlign:"right", flexShrink:0, display:"inline-flex", alignItems:"center", justifyContent:"flex-end", gap:4 }}>
                    <s.Icon size={12}/> {s.label}
                  </div>
                  <div style={{ flex:1, height:24, background:"var(--surface-2)", borderRadius:8, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", borderRadius:8,
                      background:`linear-gradient(135deg, ${s.color}, ${s.color}bb)`,
                      width:`${Math.max(s.pct, s.count > 0 ? 4 : 0)}%`,
                      transition:"width .8s cubic-bezier(.34,1.56,.64,1)",
                      display:"flex", alignItems:"center", paddingLeft:8,
                    }}>
                      {s.count > 0 && <span style={{ fontSize:10, fontWeight:800, color:"#fff" }}>{s.count}</span>}
                    </div>
                  </div>
                  <div style={{ width:42, fontSize:11, fontWeight:700, color:"var(--text-muted)", textAlign:"right", flexShrink:0 }}>
                    {s.pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversion rates */}
          {totalApps > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12 }}>
              {[
                { label:"Interview Rate",  value:`${Math.round((interviewCount/totalApps)*100)}%`, sub:"applications → interviews" },
                { label:"Offer Rate",      value:`${Math.round((offerCount/totalApps)*100)}%`,     sub:"applications → offers" },
                { label:"Rejection Rate",  value:`${Math.round((rejectCount/totalApps)*100)}%`,    sub:"applications rejected" },
              ].map(s => (
                <div key={s.label} style={{
                  background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14,
                  padding:"14px 16px", textAlign:"center",
                }}>
                  <div style={{ fontSize:22, fontWeight:900, color:"var(--text)", marginBottom:4 }}>{s.value}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text-soft)" }}>{s.label}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const [jobs, setJobs]             = useState<Job[]>([])
  const [loading, setLoading]       = useState(true)
  const [query, setQuery]           = useState("")
  const [location, setLocation]     = useState("")
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [visaFilter, setVisaFilter] = useState<string[]>([])
  const [userKw, setUserKw]         = useState<string[]>([])
  const [profile, setProfile]       = useState<Profile>({})
  const [saved, setSaved]           = useState<Set<string>>(new Set())
  const [applied, setApplied]       = useState<Set<string>>(new Set())
  const [notInterested, setNotInterested] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab]   = useState<TabId>("recommended")
  const [viewMode, setViewMode]     = useState<ViewMode>("board")
  const [sourceLabel, setSourceLabel] = useState("")
  const [isLive, setIsLive] = useState(false)
  const [detailJob, setDetailJob]   = useState<Job | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [sortBy, setSortBy] = useState<"match" | "newest" | "salary">("match")
  // ── JobRight-style extra filters ──────────────────────────────────────────
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("any")
  const [expLevel, setExpLevel]     = useState<ExperienceLevel>("all")
  const [salaryMin, setSalaryMin]   = useState(0)          // 0 = no min
  const [hideAgencies, setHideAgencies] = useState(false)
  const [companyFilter, setCompanyFilter] = useState<string[]>([])
  const [originCity, setOriginCity] = useState("")
  const [distanceFilter, setDistanceFilter] = useState<DistanceKey>("any")
  const [skillFilter, setSkillFilter] = useState<string[]>([])
  const [showCompanyPanel, setShowCompanyPanel] = useState(false)
  const [showDistancePanel, setShowDistancePanel] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  // Unlock the Pipeline/Analytics blur by connecting Gmail FOR REAL: kick off the
  // Supabase Google OAuth flow (gmail.readonly). When Supabase is configured this
  // redirects to Google → /auth/callback/gmail persists the session and returns
  // with ?gmail=connected. If Supabase isn't configured (local demo), fall back to
  // the local flag so the demo still unlocks. Either way the gate gates on the
  // mf_gmail_connected signal the callback sets.
  async function handleGmailConnect() {
    try {
      // Return to THIS page (the pipeline) after OAuth, not the email page.
      const back = typeof window !== "undefined" ? window.location.pathname : undefined
      const res = await connectGmail(back)
      if (res?.error) throw res.error      // unconfigured / denied → demo fallback
      // success: the browser is redirecting to Google now; nothing else to do.
    } catch {
      try { localStorage.setItem("mf_gmail_connected", "1") } catch {}
      setGmailConnected(true)
      toast.warning("Gmail connect needs Supabase config — unlocked in demo mode.")
    }
  }

  useEffect(() => {
    setUserKw(getUserKeywords())
    setProfile(getProfile())
    try { setSaved(new Set(JSON.parse(localStorage.getItem("jd_saved_ids") || "[]"))) } catch {}
    try { setApplied(new Set(JSON.parse(localStorage.getItem("jd_applied_ids") || "[]"))) } catch {}
    try { setNotInterested(new Set(JSON.parse(localStorage.getItem("jd_not_interested") || "[]"))) } catch {}
    try { setGmailConnected(!!localStorage.getItem("mf_gmail_connected")) } catch {}
    // Returning from Gmail OAuth (?gmail=connected) → persist + unlock the gate, clean URL.
    try {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get("gmail") === "connected") {
        localStorage.setItem("mf_gmail_connected", "1")
        setGmailConnected(true)
        window.history.replaceState({}, "", window.location.pathname)
      }
    } catch {}
    // Allow home page quick-actions to jump straight to a view
    try {
      const view = sessionStorage.getItem("jd_view") as ViewMode | null
      if (view && ["board","pipeline","analytics"].includes(view)) {
        setViewMode(view)
        sessionStorage.removeItem("jd_view")
      }
    } catch {}
  }, [])

  function markApplied(id: string) {
    setApplied(prev => {
      const next = new Set(prev); next.add(id)
      localStorage.setItem("jd_applied_ids", JSON.stringify([...next]))
      return next
    })
    // Auto-add to pipeline if not already tracked
    try {
      const job = jobs.find(j => j.id === id)
      if (!job) return
      const existing: Array<{id:string}> = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
      if (!existing.find(a => a.id === id)) {
        const entry = {
          id, company: job.company, role: job.title, location: job.location,
          remote: job.remote, salary: job.salary || "", stage: "applied",
          appliedDate: new Date().toISOString(), notes: "", url: job.url,
          visa: job.workAuth[0] || "", priority: "mid",
        }
        localStorage.setItem("jd_applications_v2", JSON.stringify([entry, ...existing]))
      }
    } catch {}
  }

  function markNotInterested(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setNotInterested(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem("jd_not_interested", JSON.stringify([...next]))
      return next
    })
  }

  const fetchJobs = useCallback(async (q: string, loc: string, remote: boolean) => {
    // Tag this request; if a newer one starts before this resolves (e.g. the
    // user kept typing), its result is dropped instead of clobbering fresher data.
    const reqId = ++requestIdRef.current
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q)      p.set("q",        q)
      if (loc)    p.set("location", loc)
      if (remote) p.set("remote",   "true")
      const res = await fetchJobsApi(`/api/jobs?${p.toString()}`)
      const data = await res.json()
      if (reqId !== requestIdRef.current) return
      setJobs(data.jobs || [])
      setSourceLabel(data.live ? `Live · ${(data.sources as string[])?.join(" + ") ?? ""}` : "Sample data")
      setIsLive(!!data.live)
    } catch { if (reqId === requestIdRef.current) setJobs([]) }
    if (reqId === requestIdRef.current) setLoading(false)
  }, [])

  useEffect(() => { fetchJobs("", "", false) }, [fetchJobs])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchJobs(query, location, remoteOnly), 420)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, location, remoteOnly, fetchJobs])

  function toggleSave(job: Job) {
    setSaved(prev => {
      const next = new Set(prev)
      if (next.has(job.id)) {
        next.delete(job.id)
      } else {
        next.add(job.id)
      }
      localStorage.setItem("jd_saved_ids", JSON.stringify([...next]))
      // Keep jd_saved_jobs in sync so the Saved Jobs page can display them.
      // Augment with SavedJob-specific fields that the saved page expects.
      try {
        const existing = JSON.parse(localStorage.getItem("jd_saved_jobs") || "[]")
        const filtered = existing.filter((j: {id:string}) => j.id !== job.id)
        const savedEntry = next.has(job.id) ? [{
          ...job,
          savedAt: new Date().toISOString(),
          status: "interested",
          notes: "",
        }, ...filtered] : filtered
        localStorage.setItem("jd_saved_jobs", JSON.stringify(savedEntry))
      } catch {}
      return next
    })
  }

  function toggleVisa(v: string) {
    setVisaFilter(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])
  }

  function toggleCompany(name: string) {
    setCompanyFilter(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
  }
  function toggleSkill(skill: string) {
    setSkillFilter(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
  }

  const tabJobs: Job[] = (() => {
    switch (activeTab) {
      case "saved":    return jobs.filter(j => saved.has(j.id))
      case "applied":  return jobs.filter(j => applied.has(j.id))
      case "external": return []
      default:         return jobs
    }
  })()

  const visibleJobs = (() => {
    let list = visaFilter.length
      ? tabJobs.filter(j => visaFilter.some(v => {
          // H-1B: match on explicit workAuth tag OR known sponsor company (aligns with badge)
          if (v === "h1b") {
            return j.workAuth.includes("h1b") || getH1BScore(j.company).status === "likely"
          }
          return j.workAuth.includes(v)
        }))
      : tabJobs
    // Exclude jobs that explicitly say "no sponsorship" when visa filters are active
    if (visaFilter.some(v => ["h1b", "opt_cpt", "green_card"].includes(v))) {
      list = list.filter(j => !j.workAuth.includes("no_sponsorship"))
    }
    // Date posted filter
    list = list.filter(j => matchesDatePosted(j.posted, dateFilter))
    // Experience level filter
    if (expLevel !== "all") {
      list = list.filter(j => detectExpLevel(j.title) === expLevel)
    }
    // Salary min
    if (salaryMin > 0) {
      list = list.filter(j => {
        const n = extractSalaryNumber(j.salary)
        return n === 0 || n >= salaryMin   // unlisted salary doesn't get excluded
      })
    }
    // Hide staffing/recruiting agencies
    if (hideAgencies) list = list.filter(j => !isStaffingAgency(j.company))
    // Company
    if (companyFilter.length) list = list.filter(j => companyFilter.includes(j.company))
    // Distance ("near me")
    list = list.filter(j => matchesDistance(j.location, j.remote, originCity, distanceFilter))
    // Skills — job passes if it mentions ANY selected skill
    if (skillFilter.length) {
      list = list.filter(j => {
        const jobSkills = extractSkills(`${j.title} ${j.description || ""}`)
        return skillFilter.some(s => jobSkills.includes(s))
      })
    }
    if (!showHidden) list = list.filter(j => !notInterested.has(j.id))
    // Sort
    if (sortBy === "newest") {
      list = [...list].sort((a, b) => new Date(b.posted).getTime() - new Date(a.posted).getTime())
    } else if (sortBy === "salary") {
      list = [...list].sort((a, b) => extractSalaryNumber(b.salary) - extractSalaryNumber(a.salary))
    } else {
      // sort by match score
      list = [...list].sort((a, b) =>
        computeMatch(b.title, b.description, userKw) - computeMatch(a.title, a.description, userKw)
      )
    }
    return list
  })()

  const hiddenCount = tabJobs.filter(j => notInterested.has(j.id)).length

  // Facets computed from the raw job list — what's available to filter by right now.
  const companyOptions = useMemo(() => companyFacets(tabJobs, j => j.company), [tabJobs])
  const skillOptions = useMemo(() => topSkills(tabJobs, j => `${j.title} ${j.description || ""}`), [tabJobs])
  const hasExtraFilters = dateFilter !== "any" || expLevel !== "all" || salaryMin > 0 || hideAgencies
    || companyFilter.length > 0 || distanceFilter !== "any" || skillFilter.length > 0

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>


      {/* ── Top action bar (replaces redundant "Jobs & Apply" title) ── */}
      <div className="anim-fade-up d-0" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        {/* Left: view mode tabs */}
        <div style={{ display:"flex", gap:3, padding:4, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
          {([
            { id:"board",     label:"Live Board",  Icon:Search },
            { id:"pipeline",  label:"Pipeline",    Icon:ClipboardList },
            { id:"analytics", label:"Analytics",   Icon:BarChart3 },
          ] as { id:ViewMode; label:string; Icon:typeof Search }[]).map(v => {
            const isActive = viewMode === v.id
            return (
              <button key={v.id} onClick={() => setViewMode(v.id)} style={{
                display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
                borderRadius:9, border:"none", cursor:"pointer", fontSize:12.5,
                fontWeight:isActive ? 700 : 600, transition:"all .15s",
                background:isActive ? "var(--accent)" : "transparent",
                color:isActive ? "#fff" : "var(--text-soft)",
                boxShadow:isActive ? "0 2px 8px color-mix(in srgb, var(--accent) 25%, transparent)" : "none",
              }}>
                <v.Icon size={13}/>
                {v.label}
              </button>
            )
          })}
        </div>
        {/* Right: quick-action buttons */}
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <Link href="/dashboard/contracts" style={{
            display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
            borderRadius:9, background:"var(--surface)", border:"1px solid var(--border)",
            color:"var(--text-soft)", fontSize:12.5, fontWeight:600, textDecoration:"none",
            boxShadow:"0 1px 3px rgba(0,0,0,.04)",
          }}><ClipboardList size={13}/> Contracts</Link>
          <Link href="/dashboard/jobs-ft" style={{
            display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
            borderRadius:9, background:"var(--surface)", border:"1px solid var(--border)",
            color:"var(--text-soft)", fontSize:12.5, fontWeight:600, textDecoration:"none",
            boxShadow:"0 1px 3px rgba(0,0,0,.04)",
          }}><Briefcase size={13}/> Full-Time</Link>
          <Link href="/dashboard/resume" style={{
            display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
            borderRadius:9, background:"var(--accent)", border:"none",
            color:"#fff", fontSize:12.5, fontWeight:700, textDecoration:"none",
            boxShadow:"0 2px 8px color-mix(in srgb, var(--accent) 25%, transparent)",
          }}><Sparkles size={13}/> Tailor Resume</Link>
        </div>
      </div>

      {/* ── Pipeline view ────────────────────────────────────────── */}
      {viewMode === "pipeline" && (
        <GmailGate connected={gmailConnected} onConnect={handleGmailConnect}>
          <PipelineView />
        </GmailGate>
      )}

      {/* ── Analytics view ───────────────────────────────────────── */}
      {viewMode === "analytics" && (
        <GmailGate connected={gmailConnected} onConnect={handleGmailConnect}>
          <AnalyticsView />
        </GmailGate>
      )}

      {/* ── Board view ─────────────────────────────────────────── */}
      {viewMode === "board" && <>

      {sourceLabel && <SampleDataBanner live={isLive} />}

      {/* ── Sticky header: title/tabs/search stay pinned while the list scrolls below ── */}
      <div style={{ position:"sticky", top:0, zIndex:5, background:"var(--bg)", paddingBottom:14 }}>
      <div>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:12 }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:800, color:"var(--text)", letterSpacing:"-0.4px", marginBottom:4 }}>
              Live Board
            </h2>
            <p style={{ fontSize:13.5, color:"var(--text-soft)" }}>
              {sourceLabel && (() => {
                const live = !sourceLabel.toLowerCase().startsWith("sample")
                return (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:5, marginRight:10,
                    background: live ? "#eff6ff" : "rgba(107,114,128,.08)",
                    border: live ? "1px solid #bfdbfe" : "1px solid rgba(107,114,128,.2)",
                    color: live ? "var(--accent)" : "var(--text-soft)",
                    fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20,
                  }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background: live ? "var(--accent)" : "var(--text-soft)", display:"inline-block" }}/>
                    {sourceLabel}
                  </span>
                )
              })()}
              {visibleJobs.length} jobs{loading && jobs.length > 0 ? " · updating…" : ""}
              {hiddenCount > 0 && !showHidden && (
                <button onClick={() => setShowHidden(true)} style={{
                  marginLeft:10, fontSize:11, color:"var(--text-soft)", background:"none", border:"none",
                  cursor:"pointer", textDecoration:"underline",
                }}>
                  +{hiddenCount} hidden
                </button>
              )}
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Sort control */}
            <div style={{ display:"flex", gap:2, padding:3, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10 }}>
              {([
                { id:"match",  label:"Best Match" },
                { id:"newest", label:"Newest" },
                { id:"salary", label:"Salary" },
              ] as { id: typeof sortBy; label: string }[]).map(s => (
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{
                  padding:"5px 10px", borderRadius:7, border:"none", cursor:"pointer",
                  fontSize:11.5, fontWeight:sortBy===s.id ? 700 : 500,
                  background:sortBy===s.id ? "var(--surface-3)" : "transparent",
                  color:sortBy===s.id ? "var(--text)" : "var(--text-soft)",
                  transition:"all .15s",
                }}>{s.label}</button>
              ))}
            </div>
            <Link href="/dashboard/alerts" style={{
              display:"inline-flex", alignItems:"center", gap:7, padding:"8px 16px",
              borderRadius:9, background:"var(--accent-soft)", border:"1px solid var(--accent-border)",
              color:"var(--accent-txt)", fontSize:12, fontWeight:700, textDecoration:"none",
            }}>
              <Bell size={13}/> Alerts
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display:"flex", gap:2, background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:12, padding:4, boxShadow:"0 1px 3px rgba(26,32,53,.05)",
        }}>
          {([
            { id:"recommended", label:"Recommended", count: jobs.length },
            { id:"saved",       label:"Saved",        count: saved.size },
            { id:"applied",     label:"Applied",      count: applied.size },
            { id:"external",    label:"External",     count: 0 },
          ] as { id: TabId; label: string; count: number }[]).map(t => {
            const isActive = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  padding:"8px 10px", borderRadius:9, border:"none", cursor:"pointer",
                  fontSize:12.5, fontWeight:isActive ? 700 : 600,
                  background: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "#fff" : "var(--text-soft)",
                  transition:"all .15s",
                }}>
                {t.label}
                {t.count > 0 && (
                  <span style={{
                    fontSize:10, fontWeight:800, padding:"1px 6px", borderRadius:20,
                    background: isActive ? "rgba(255,255,255,.22)" : "var(--surface-2)",
                    color: isActive ? "#fff" : "var(--text-muted)",
                    border: isActive ? "1px solid rgba(255,255,255,.2)" : "1px solid var(--border)",
                    lineHeight:"16px",
                  }}>{t.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Search + Filter ─────────────────────────────────────── */}
      <div className="anim-fade-up d-1" style={{
        background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16,
        padding:"16px 20px", boxShadow:"0 1px 3px rgba(26,32,53,.05)",
      }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto auto", gap:8, marginBottom:10 }}>
          <div style={{ position:"relative" }}>
            <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)", pointerEvents:"none" }} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Role, skill, or keyword…"
              style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, borderRadius:9, border:"1.5px solid var(--border)", background:"var(--surface-2)", color:"var(--text)", fontSize:13, outline:"none", boxSizing:"border-box" as const }}
              onFocus={e => { e.currentTarget.style.borderColor="var(--accent)" }}
              onBlur={e => { e.currentTarget.style.borderColor="var(--border)" }}
            />
          </div>
          <div style={{ position:"relative" }}>
            <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)", pointerEvents:"none" }} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="City, state, or Remote…"
              style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, borderRadius:9, border:"1.5px solid var(--border)", background:"var(--surface-2)", color:"var(--text)", fontSize:13, outline:"none", boxSizing:"border-box" as const }}
              onFocus={e => { e.currentTarget.style.borderColor="var(--accent)" }}
              onBlur={e => { e.currentTarget.style.borderColor="var(--border)" }}
            />
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:9, cursor:"pointer", whiteSpace:"nowrap" as const,
            background: remoteOnly ? "var(--accent-soft)" : "var(--surface-2)",
            border: `1.5px solid ${remoteOnly ? "var(--accent-border)" : "var(--border)"}`,
            fontSize:12.5, fontWeight:600, color: remoteOnly ? "var(--accent-txt)" : "var(--text-soft)",
          }}>
            <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} style={{ accentColor:"var(--accent)", width:13, height:13 }} />
            <Globe size={12}/> Remote
          </label>
          <label style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:9, cursor:"pointer", whiteSpace:"nowrap" as const,
            background: hideAgencies ? "#fef2f2" : "var(--surface-2)",
            border: `1.5px solid ${hideAgencies ? "#fca5a5" : "var(--border)"}`,
            fontSize:12.5, fontWeight:600, color: hideAgencies ? "#dc2626" : "var(--text-soft)",
          }}>
            <input type="checkbox" checked={hideAgencies} onChange={e => setHideAgencies(e.target.checked)} style={{ accentColor:"#dc2626", width:13, height:13 }} />
            <Ban size={12}/> No agencies
          </label>
          <button onClick={() => {
              setQuery(""); setLocation(""); setRemoteOnly(false); setVisaFilter([]); setShowHidden(false)
              setDateFilter("any"); setExpLevel("all"); setSalaryMin(0); setHideAgencies(false)
              setCompanyFilter([]); setOriginCity(""); setDistanceFilter("any"); setSkillFilter([])
            }}
            style={{ padding:"8px 14px", borderRadius:9, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-soft)", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" as const, display:"inline-flex", alignItems:"center", gap:5 }}>
            <X size={11}/> Clear
          </button>
        </div>

        {/* Row 2: Dropdown filters */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginTop:10 }}>
          <select value={visaFilter[0] || ""} onChange={e => { const v = e.target.value; setVisaFilter(v ? [v] : []) }}
            style={{ padding:"7px 10px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer", outline:"none",
              background:"var(--surface-2)", color: visaFilter.length ? "var(--accent-txt)" : "var(--text-soft)",
              border: `1.5px solid ${visaFilter.length ? "var(--accent-border)" : "var(--border)"}` }}>
            <option value="">Work Auth</option>
            {VISA_FILTER_OPTIONS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>

          <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilterKey)}
            style={{ padding:"7px 10px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer", outline:"none",
              background:"var(--surface-2)", color: dateFilter !== "any" ? "var(--accent-txt)" : "var(--text-soft)",
              border: `1.5px solid ${dateFilter !== "any" ? "#bfdbfe" : "var(--border)"}` }}>
            <option value="any">Date Posted</option>
            {DATE_FILTERS.filter(d => d.key !== "any").map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>

          <select value={expLevel} onChange={e => setExpLevel(e.target.value as ExperienceLevel)}
            style={{ padding:"7px 10px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer", outline:"none",
              background:"var(--surface-2)", color: expLevel !== "all" ? "#15803d" : "var(--text-soft)",
              border: `1.5px solid ${expLevel !== "all" ? "#bbf7d0" : "var(--border)"}` }}>
            <option value="all">Experience</option>
            {EXPERIENCE_LEVELS.filter(l => l.key !== "all").map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>

          <select value={String(salaryMin)} onChange={e => setSalaryMin(Number(e.target.value))}
            style={{ padding:"7px 10px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer", outline:"none",
              background:"var(--surface-2)", color: salaryMin > 0 ? "#92400e" : "var(--text-soft)",
              border: `1.5px solid ${salaryMin > 0 ? "#fde68a" : "var(--border)"}` }}>
            <option value="0">Min Salary</option>
            {[80000,100000,120000,140000,160000,180000,200000].map(v => <option key={v} value={String(v)}>${(v/1000).toFixed(0)}k+</option>)}
          </select>

          {skillOptions.length > 0 && (
            <select value={skillFilter[0] || ""} onChange={e => { const v = e.target.value; setSkillFilter(v ? [v] : []) }}
              style={{ padding:"7px 10px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer", outline:"none",
                background:"var(--surface-2)", color: skillFilter.length ? "#7c3aed" : "var(--text-soft)",
                border: `1.5px solid ${skillFilter.length ? "#ddd6fe" : "var(--border)"}` }}>
              <option value="">Skill</option>
              {skillOptions.map(({ skill, count }) => <option key={skill} value={skill}>{skill} ({count})</option>)}
            </select>
          )}

          <div style={{ position:"relative" }}>
            <button onClick={() => { setShowCompanyPanel(v => !v); setShowDistancePanel(false) }} style={{
              padding:"7px 12px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer",
              background: companyFilter.length ? "var(--accent-soft)" : "var(--surface-2)",
              color: companyFilter.length ? "var(--accent-txt)" : "var(--text-soft)",
              border: `1.5px solid ${companyFilter.length ? "var(--accent-border)" : "var(--border)"}`,
              display:"inline-flex", alignItems:"center", gap:5,
            }}><Building2 size={12}/> Company{companyFilter.length ? ` (${companyFilter.length})` : ""} <ChevronDown size={12}/></button>
            {showCompanyPanel && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:30, minWidth:230, maxHeight:260, overflowY:"auto",
                background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:8,
                boxShadow:"0 16px 40px rgba(0,0,0,.18)",
              }}>
                {companyOptions.length === 0
                  ? <div style={{ padding:"10px 8px", fontSize:12, color:"var(--text-soft)" }}>No companies yet.</div>
                  : companyOptions.map(({ company, count }) => (
                    <label key={company} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", borderRadius:7, cursor:"pointer", fontSize:12.5, color:"var(--text)" }}>
                      <input type="checkbox" checked={companyFilter.includes(company)} onChange={() => toggleCompany(company)} style={{ accentColor:"var(--accent)" }} />
                      <span style={{ flex:1 }}>{company}</span>
                      <span style={{ color:"var(--text-soft)", fontSize:11 }}>{count}</span>
                    </label>
                  ))
                }
              </div>
            )}
          </div>

          <div style={{ position:"relative" }}>
            <button onClick={() => { setShowDistancePanel(v => !v); setShowCompanyPanel(false) }} style={{
              padding:"7px 12px", borderRadius:9, fontSize:12.5, fontWeight:600, cursor:"pointer",
              background: distanceFilter !== "any" && originCity ? "var(--accent-soft)" : "var(--surface-2)",
              color: distanceFilter !== "any" && originCity ? "var(--accent-txt)" : "var(--text-soft)",
              border: `1.5px solid ${distanceFilter !== "any" && originCity ? "var(--accent-border)" : "var(--border)"}`,
              display:"inline-flex", alignItems:"center", gap:5,
            }}><MapPin size={12}/> {originCity && distanceFilter !== "any" ? DISTANCE_OPTIONS.find(d => d.key === distanceFilter)?.label : "Distance"} <ChevronDown size={12}/></button>
            {showDistancePanel && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:30, width:250,
                background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:12,
                boxShadow:"0 16px 40px rgba(0,0,0,.18)",
              }}>
                <p style={{ fontSize:11, color:"var(--text-soft)", fontWeight:600, marginBottom:6 }}>Near this city</p>
                <select value={originCity} onChange={e => setOriginCity(e.target.value)} style={{
                  width:"100%", padding:"7px 10px", borderRadius:9, fontSize:12.5, marginBottom:10,
                  background:"var(--surface-2)", border:"1px solid var(--border)", color:"var(--text)", outline:"none",
                }}>
                  <option value="">Choose a city…</option>
                  {METRO_OPTIONS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <p style={{ fontSize:11, color:"var(--text-soft)", fontWeight:600, marginBottom:6 }}>Radius</p>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {DISTANCE_OPTIONS.map(d => (
                    <button key={d.key} onClick={() => setDistanceFilter(d.key)} style={{
                      padding:"5px 10px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600,
                      background: distanceFilter === d.key ? "var(--accent)" : "var(--surface-2)",
                      color: distanceFilter === d.key ? "#fff" : "var(--text-muted)", border:"none",
                    }}>{d.label}</button>
                  ))}
                </div>
                <p style={{ fontSize:10.5, color:"var(--text-soft)", marginTop:8 }}>Remote roles always match regardless of distance.</p>
              </div>
            )}
          </div>

          {hasExtraFilters && (
            <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11.5, color:"var(--text-muted)" }}>
                {[visaFilter.length > 0, dateFilter !== "any", expLevel !== "all", salaryMin > 0, hideAgencies, companyFilter.length > 0, distanceFilter !== "any", skillFilter.length > 0].filter(Boolean).length} active
              </span>
              <button onClick={() => {
                  setDateFilter("any"); setExpLevel("all"); setSalaryMin(0); setHideAgencies(false)
                  setCompanyFilter([]); setOriginCity(""); setDistanceFilter("any"); setSkillFilter([]); setVisaFilter([])
                }}
                style={{ padding:"3px 8px", borderRadius:7, border:"none", background:"#fee2e2", color:"#dc2626", fontSize:11, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
                <X size={10}/> Reset filters
              </button>
            </span>
          )}
        </div>

      </div>
      </div>

      {/* ── Job cards: one big scrollable box, Jobright-style ─────── */}
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .45; }
        }
      `}</style>
      <div style={{
        maxHeight: "calc(100vh - 280px)", minHeight: 400, overflowY: "auto", overscrollBehavior: "contain",
        padding: "2px 4px 4px 2px", margin: "-2px -4px -4px -2px",
      }}>
      {loading && jobs.length === 0 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i}/>)}
        </div>
      ) : visibleJobs.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"var(--text-muted)" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
            {activeTab === "applied" ? <Check size={36}/> : activeTab === "saved" ? <Bookmark size={36}/> : activeTab === "external" ? <Link2 size={36}/> : <Search size={36}/>}
          </div>
          <p style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>
            {activeTab === "applied" ? "No applications tracked yet"
              : activeTab === "saved" ? "No saved jobs yet"
              : activeTab === "external" ? "No external jobs imported"
              : hiddenCount > 0 ? `All jobs hidden (${hiddenCount} marked Not Interested)`
              : "No jobs matched your filters"}
          </p>
          {hiddenCount > 0 && activeTab === "recommended" && (
            <button onClick={() => setShowHidden(true)} style={{
              marginTop:14, padding:"9px 20px", borderRadius:9, background:"var(--surface)",
              color:"var(--text)", border:"1px solid var(--border)", fontSize:13, fontWeight:700, cursor:"pointer",
            }}>Show hidden jobs</button>
          )}
          {activeTab !== "external" && hiddenCount === 0 && (
            <button onClick={() => { setVisaFilter([]); setQuery(""); setLocation(""); setActiveTab("recommended") }}
              style={{ marginTop:16, padding:"9px 20px", borderRadius:9, background:"var(--accent)", color:"#fff",
                border:"none", cursor:"pointer", fontSize:13, fontWeight:700 }}>
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }} className="anim-fade-up d-2">
          {visibleJobs.map((job, idx) => {
            const match = computeMatch(job.title, job.description, userKw)
            const verdict = matchVerdict(match)
            const isSaved = saved.has(job.id)
            const isApplied = applied.has(job.id)
            const isHidden = notInterested.has(job.id)
            const snippet = job.description
              ? job.description.replace(/\n+/g, " ").trim().slice(0, 140)
              : null
            const h1b = getH1BScore(job.company)
            const isNew = (() => {
              try { return Date.now() - new Date(job.posted).getTime() < 86400000 } catch { return false }
            })()

            return (
              <div key={job.id}
                style={{
                  background: isHidden ? "#f9fafb" : "var(--surface)",
                  border:`1px solid ${isHidden ? "#e5e7eb" : "var(--border)"}`,
                  borderRadius:16, overflow:"hidden",
                  transition:"box-shadow .2s, border-color .2s, opacity .2s",
                  boxShadow:"0 1px 3px rgba(26,32,53,.05)",
                  opacity: isHidden ? 0.6 : 1,
                  animationDelay: `${Math.min(idx, 10) * 40}ms`,
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!isHidden) { el.style.boxShadow="0 4px 20px rgba(26,32,53,.1)"; el.style.borderColor="var(--accent-border)" } }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow="0 1px 3px rgba(26,32,53,.05)"; el.style.borderColor=isHidden ? "#e5e7eb" : "var(--border)" }}
              >
                <div style={{ padding:"16px 20px" }}>
                  <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                    <CompanyAvatar name={job.company} size={46} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                            <h3
                              onClick={() => !isHidden && setDetailJob(job)}
                              style={{ fontWeight:700, fontSize:15, color: isHidden ? "#9ca3af" : "var(--text)",
                                lineHeight:1.3, margin:0, cursor: isHidden ? "default" : "pointer" }}
                              onMouseEnter={e => { if (!isHidden) (e.currentTarget as HTMLElement).style.color="var(--accent)" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color=isHidden ? "#9ca3af" : "var(--text)" }}
                            >{job.title}</h3>
                            {isNew && (
                              <span style={{ fontSize:9, fontWeight:800, padding:"2px 6px", borderRadius:20,
                                background:"#dcfce7", color:"#15803d", border:"1px solid #bbf7d0",
                                letterSpacing:".3px", textTransform:"uppercase", flexShrink:0,
                              }}>New</span>
                            )}
                          </div>
                          <p style={{ fontSize:13, color:"var(--text-soft)", fontWeight:500 }}>
                            {job.company}
                            {job.location && <span style={{ color:"var(--text-muted)" }}> · {job.location}</span>}
                          </p>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                            <MatchRing pct={match} size={50} />
                            <span style={{ fontSize:8, fontWeight:800, letterSpacing:".4px",
                              padding:"2px 6px", borderRadius:20, whiteSpace:"nowrap",
                              color:verdict.color, background:verdict.bg, border:`1px solid ${verdict.color}22`,
                            }}>{verdict.text}</span>
                          </div>
                          <button onClick={() => toggleSave(job)} title={isSaved ? "Unsave" : "Save job"}
                            style={{ padding:"7px", borderRadius:9, border:"none", cursor:"pointer",
                              color: isSaved ? "var(--accent)" : "var(--text-muted)",
                              background: isSaved ? "var(--accent-soft)" : "var(--surface-2)",
                              transition:"all .15s",
                            }}>
                            <svg width="15" height="15" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"2px 12px", marginTop:6, fontSize:12, color:"var(--text-muted)", alignItems:"center" }}>
                        {job.remote && <span style={{ color:"var(--accent)", fontWeight:700, display:"inline-flex", alignItems:"center", gap:3 }}><Globe size={11}/> Remote</span>}
                        {job.salary && <span style={{ color:"var(--accent)", fontWeight:700 }}>{job.salary}</span>}
                        <span>{timeAgo(job.posted)}</span>
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20,
                          background:job.source === "sample" ? "#f9fafb" : "#eff6ff",
                          border:`1px solid ${job.source === "sample" ? "#e5e7eb" : "#bfdbfe"}`,
                          color: job.source === "sample" ? "var(--text-soft)" : "var(--accent)", fontWeight:700,
                        }}>{job.source === "sample" ? "Sample" : "Live"}</span>
                      </div>

                      {/* Snippet */}
                      {snippet && (
                        <p style={{ fontSize:12.5, color:"var(--text-soft)", lineHeight:1.55, marginTop:8,
                          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
                        } as React.CSSProperties}>{snippet}…</p>
                      )}

                      {/* Badges row: H1B + work auth */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8, alignItems:"center" }}>
                        {/* H1B badge */}
                        <span style={{
                          padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700,
                          background: h1b.bg, border:`1px solid ${h1b.border}`, color: h1b.color,
                          cursor:"help", display:"inline-flex", alignItems:"center", gap:5,
                        }} title={h1b.reason}>
                          <span style={{ width:6, height:6, borderRadius:"50%", background:"currentColor", flexShrink:0 }}/> {h1b.label}
                        </span>
                        {job.workAuth.map(w => {
                          const s = WORK_AUTH_LABELS[w]
                          return s ? (
                            <span key={w} style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700,
                              background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>{s.label}</span>
                          ) : null
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div style={{ display:"flex", gap:7, marginTop:12, alignItems:"center", flexWrap:"wrap" }}>
                    {job.url && job.url !== "#" ? (
                      <a href={job.url} target="_blank" rel="noopener noreferrer"
                        onClick={() => markApplied(job.id)}
                        style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
                          background: isApplied ? "linear-gradient(135deg,var(--accent-h),var(--success))" : "linear-gradient(135deg,var(--accent),var(--accent-h))",
                          color:"#fff", borderRadius:9, fontSize:12, fontWeight:700, textDecoration:"none",
                          boxShadow:"0 3px 10px color-mix(in srgb, var(--accent) 30%, transparent)",
                        }}>
                        {isApplied ? <><Check size={13}/> Applied</> : <><Zap size={13} fill="currentColor"/> Apply</>}
                      </a>
                    ) : null}
                    <Link
                      href="/dashboard/ai-tools"
                      onClick={() => {
                        try {
                          sessionStorage.setItem("jd_prefill_jd", job.description)
                          sessionStorage.setItem("jd_prefill_role", job.title)
                          sessionStorage.setItem("jd_prefill_company", job.company)
                          sessionStorage.setItem("jd_ai_tab", "tailor")
                          sessionStorage.setItem("jd_prefill", job.title + " at " + job.company + ".\n\n" + job.description)
                        } catch {}
                      }}
                      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"7px 13px",
                        background:"var(--accent)", color:"#fff", borderRadius:9, fontSize:12, fontWeight:700,
                        textDecoration:"none", boxShadow:"0 3px 10px color-mix(in srgb, var(--accent) 28%, transparent)",
                      }}>
                      <Sparkles size={13}/> Tailor
                    </Link>
                    <button
                      onClick={() => {
                        try {
                          // markApplied already handles the jd_applications_v2 write (with job.id
                          // as the entry ID). Don't write a separate random-ID entry here — doing
                          // both caused two duplicate pipeline cards every time Track was clicked.
                          const existing: {id:string}[] = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
                          if (!existing.find(a => a.id === job.id)) {
                            markApplied(job.id)
                            toast.success(`Tracked "${job.title}"`)
                          } else {
                            toast.warning("Already in your Applications tracker")
                          }
                        } catch { toast.error("Could not save to tracker") }
                      }}
                      title="Add to Applications Tracker"
                      style={{ padding:"7px 13px", border:"1px solid var(--accent-border)", borderRadius:9,
                        fontSize:12, fontWeight:700, color:"var(--accent)", background:"var(--accent-soft)",
                        cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5,
                      }}>
                      <ClipboardList size={13}/> Track
                    </button>
                    <button onClick={() => setDetailJob(job)}
                      style={{ padding:"7px 12px", border:"1px solid var(--border)", borderRadius:9,
                        fontSize:12, fontWeight:600, color:"var(--text-muted)", background:"transparent",
                        cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5,
                      }}>
                      View · Nexus AI →
                    </button>
                    {/* Not Interested */}
                    <button onClick={e => markNotInterested(job.id, e)}
                      title={isHidden ? "Remove from hidden" : "Not Interested — hide this job"}
                      style={{
                        marginLeft:"auto", padding:"6px 10px", borderRadius:9, border:"none",
                        fontSize:11, fontWeight:600, cursor:"pointer", transition:"all .15s",
                        color: isHidden ? "var(--text-soft)" : "#c4c9d4",
                        background: isHidden ? "#f1f5f9" : "transparent",
                      }}
                      onMouseEnter={e => { if (!isHidden) (e.currentTarget as HTMLElement).style.color="#dc2626" }}
                      onMouseLeave={e => { if (!isHidden) (e.currentTarget as HTMLElement).style.color="#c4c9d4" }}
                    >
                      {isHidden ? <><Undo2 size={11}/> Undo</> : <><X size={11}/> Not interested</>}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>

      {/* Alert CTA */}
      {!loading && visibleJobs.length > 0 && (
        <div className="anim-fade-up" style={{ textAlign:"center", paddingBottom:24 }}>
          <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:10 }}>
            Set up alerts and get notified when new matching jobs post.
          </p>
          <Link href="/dashboard/alerts" style={{
            display:"inline-flex", alignItems:"center", gap:7, padding:"10px 22px",
            background:"var(--surface)", border:"1px solid var(--border)", borderRadius:9,
            fontSize:13, fontWeight:700, color:"var(--text-soft)", textDecoration:"none",
          }}>
            <Bell size={13}/> Create a Job Alert
          </Link>
        </div>
      )}

      {/* Job detail panel */}
      {detailJob && (
        <JobDetailPanel
          job={detailJob}
          match={computeMatch(detailJob.title, detailJob.description, userKw)}
          verdict={matchVerdict(computeMatch(detailJob.title, detailJob.description, userKw))}
          isSaved={saved.has(detailJob.id)}
          isApplied={applied.has(detailJob.id)}
          profile={profile}
          onClose={() => setDetailJob(null)}
          onSave={() => toggleSave(detailJob)}
          onApply={() => markApplied(detailJob.id)}
        />
      )}

      {/* End board view conditional */}
      </>}
    </div>
  )
}
