"use client"

/**
 * Full-Time STEM Job Board
 * STEM-only • H1B/OPT/CPT labels • DOL H1B sponsor likelihood badge
 * Wraps /api/jobs with role preset queries for CS/IT/Engineering
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { getH1BScore } from "@/lib/h1b"
import { fetchJobs as fetchJobsApi } from "@/lib/jobsClient"
import SampleDataBanner from "@/components/SampleDataBanner"
import {
  DISTANCE_OPTIONS, METRO_OPTIONS, matchesDistance, extractSkills, topSkills, companyFacets,
  DATE_FILTERS, matchesDatePosted, type DateFilterKey, EXPERIENCE_LEVELS, detectExpLevel, type ExperienceLevel,
  extractSalaryNumber, isStaffingAgency,
} from "@/lib/jobFilters"
import PageHeader from "@/components/layout/PageHeader"
import {
  Briefcase, Search, Ban, Globe, Building2, MapPin, Loader2, Zap, ExternalLink,
  X, FileText, Clock, DollarSign, Star, ChevronUp, ChevronDown,
} from "lucide-react"

// ── Tokens ───────────────────────────────────────────────────────────────────
// Structural colors (bg/card/border/text/muted/hint) are theme-aware — same
// var(--*) tokens the Jobs & Apply hub uses, so this board matches it exactly
// and switches with the theme selector (light = white cards, dark = navy).
// Accent colors stay literal hex — they're concatenated with a hex-alpha
// suffix (e.g. `${C.blue}33`) which only works with a real 6-digit hex value.
const C = {
  bg:     "var(--bg)",
  card:   "var(--surface)",
  border: "var(--border)",
  text:   "var(--text)",
  muted:  "var(--text-muted)",
  hint:   "var(--text-soft)",
  accent: "var(--accent)",
  accentH: "var(--accent-h)",
  accentSoft: "var(--accent-soft)",
  accentTxt: "var(--accent-txt)",
  teal:   "#14b8a6",
  green:  "var(--success)",
  amber:  "var(--warning)",
  purple: "#8b5cf6",
  red:    "var(--danger)",
}

// Fixed, saturated avatar palette — solid backgrounds with white text so
// company initials stay readable regardless of the active accent color.
const AVATAR_COLORS = ["#1d6fc4", "#7c3aed", "#059669", "#d97706", "#e11d48", "#0d9488"]
function avatarColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// Alpha-blend a color (literal hex or a var(--token) reference) against
// transparent — works for both, unlike string-concatenating a hex-alpha suffix.
function mix(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

// job.posted is a raw ISO timestamp from the API/sample data — format it as
// a human-readable relative label: "just now", "2 hours ago", "3 days ago".
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

// True if job was posted within the last 24 hours
function isNewPost(iso: string): boolean {
  try { return Date.now() - new Date(iso).getTime() < 86400000 } catch { return false }
}

// ── STEM query presets ────────────────────────────────────────────────────────
const STEM_CATEGORIES = [
  { key: "all",      label: "All STEM",       query: "software engineer developer" },
  { key: "swe",      label: "Software Eng",   query: "software engineer developer" },
  { key: "data",     label: "Data / AI",      query: "data scientist machine learning engineer" },
  { key: "devops",   label: "DevOps / Cloud", query: "devops cloud engineer aws azure" },
  { key: "cyber",    label: "Cybersecurity",  query: "cybersecurity security engineer analyst" },
  { key: "sap",      label: "SAP / ERP",      query: "SAP HANA ERP consultant" },
  { key: "servicenow", label: "ServiceNow",   query: "ServiceNow developer administrator" },
]

// ── H1B likelihood — canonical scorer (same one jobs/page.tsx + /api/h1b use) ──
// Was a local heuristic that could disagree with the rest of the app for the
// same company; now every board and /api/h1b?company= agree on one answer.
// Coarse rank for sorting — the canonical scorer only gives 3 tiers, not a
// precise 0-100 score (the old numeric score was fabricated precision).
function h1bRank(company: string): number {
  return { likely: 2, possible: 1, unknown: 0 }[getH1BScore(company).status]
}

// ── Salary parser ─────────────────────────────────────────────────────────────
function parseSalary(raw: string | null): string {
  if (!raw) return "—"
  const match = raw.match(/\$?[\d,]+k?/gi)
  if (!match) return raw
  return match.slice(0, 2).join(" – ")
}

// ── Job card ─────────────────────────────────────────────────────────────────
type FtJob = {
  id: string; title: string; company: string; location: string; remote: boolean
  salary: string | null; posted: string; description: string; url: string; workAuth: string[]
}
function JobCard({ job, onApply }: { job: FtJob; onApply: (job: FtJob) => void }) {
  const [expanded, setExpanded] = useState(false)
  const h1b = getH1BScore(job.company)
  const avColor = avatarColor(job.company || "?")
  const long = (job.description || "").length > 300

  return (
    <article className="job-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px" }}>

      {/* poster row — matches Contract Board's card header exactly */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${avColor}, var(--bg))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 14,
        }}>{job.company.slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {job.company}
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            {job.location}
            {job.posted && (
              <>
                {" · "}
                {isNewPost(job.posted) && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", textTransform: "uppercase", letterSpacing: ".04em" }}>NEW</span>
                )}
                {timeAgo(job.posted)}
              </>
            )}
          </div>
        </div>
        <span title={h1b.reason} style={{
          fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
          background: mix(h1b.color, 15), color: h1b.color, border: `1px solid ${mix(h1b.color, 35)}`,
          whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em", cursor: "help",
        }}>H1B: {h1b.status === "likely" ? "Likely" : h1b.status === "possible" ? "Possible" : "Unknown"}</span>
      </div>

      {/* title + meta */}
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{job.title}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        {job.salary && <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{parseSalary(job.salary)}</span>}
        {job.remote && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(20,184,166,.12)", color: C.teal, border: "1px solid rgba(20,184,166,.3)" }}>Remote</span>
        )}
        {job.workAuth.includes("opt_cpt") && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(139,92,246,.12)", color: C.purple, border: "1px solid rgba(139,92,246,.3)" }}>OPT/CPT</span>
        )}
      </div>

      {/* GC OK badge if applicable */}
      {job.workAuth?.includes("green_card") && (
        <div style={{ marginBottom: 10 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
            background: "rgba(16,185,129,.1)", color: "#059669", border: "1px solid rgba(16,185,129,.25)",
          }}>GC OK</span>
        </div>
      )}

      {/* description */}
      {job.description && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <div style={{
            fontSize: 13, color: C.muted, lineHeight: 1.65, whiteSpace: "pre-wrap",
            maxHeight: long && !expanded ? 84 : "none", overflow: "hidden",
          }}>{job.description.slice(0, 800)}{job.description.length > 800 ? "…" : ""}</div>
          {long && !expanded && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, background: `linear-gradient(transparent, ${C.card})`, pointerEvents: "none" }} />
          )}
          {long && (
            <button onClick={() => setExpanded(e => !e)} style={{ marginTop: 6, background: "none", border: "none", color: C.accentTxt, cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: 0, display: "inline-flex", alignItems: "center", gap: 3 }}>
              {expanded ? <>Show less <ChevronUp size={13}/></> : <>Show more <ChevronDown size={13}/></>}
            </button>
          )}
        </div>
      )}

      {/* actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => onApply(job)}
          style={{
            padding: "8px 16px", borderRadius: 9, background: C.teal,
            color: "#04201c", fontWeight: 800, fontSize: 12.5, border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        ><Zap size={14} fill="currentColor"/> Apply Now</button>
        <a
          href={job.url} target="_blank" rel="noreferrer"
          style={{
            padding: "8px 12px", borderRadius: 9, background: "var(--surface-2)",
            color: C.muted, border: `1px solid ${C.border}`, textDecoration: "none",
            fontSize: 12, display: "flex", alignItems: "center", gap: 5,
          }}
        >View posting <ExternalLink size={12}/></a>
      </div>
    </article>
  )
}

// ── Pipeline save helper — mirrors jobs/page.tsx markApplied logic ────────────
function saveToTracking(job: { id: string; title: string; company: string; location: string; remote: boolean; salary: string | null; url: string; workAuth: string[] }) {
  try {
    const existing: Array<{ id: string }> = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
    if (existing.find(a => a.id === job.id)) return // already tracked
    const entry = {
      id: job.id, company: job.company, role: job.title, location: job.location,
      remote: job.remote, salary: job.salary || "", stage: "applied",
      appliedDate: new Date().toISOString(), notes: "", url: job.url,
      visa: job.workAuth?.[0] || "", priority: "mid",
    }
    localStorage.setItem("jd_applications_v2", JSON.stringify([entry, ...existing]))
    // Also track in applied IDs set
    const appliedIds: string[] = JSON.parse(localStorage.getItem("jd_applied_ids") || "[]")
    if (!appliedIds.includes(job.id)) {
      localStorage.setItem("jd_applied_ids", JSON.stringify([job.id, ...appliedIds]))
    }
  } catch {}
}

// ── Apply modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }: {
  job: FtJob | null
  onClose: () => void
}) {
  const [tracked, setTracked] = useState(false)
  if (!job) return null

  function handleOption() {
    saveToTracking(job!)
    setTracked(true)
  }

  function handleTailorResume() {
    handleOption()
    // Prefill AI Tools tailor tab with this job's full description so the user
    // lands on a ready-to-go tailoring form — same pattern as jobs/page.tsx.
    try {
      sessionStorage.setItem("jd_prefill_jd", job!.description || "")
      sessionStorage.setItem("jd_prefill_role", job!.title || "")
      sessionStorage.setItem("jd_prefill_company", job!.company || "")
      // Legacy key still read by ResumeClient (jd_prefill) and CareerOS
      sessionStorage.setItem("jd_prefill", job!.title + " at " + job!.company + ".\n\n" + (job!.description || ""))
      sessionStorage.setItem("jd_ai_tab", "tailor")
    } catch { /* ignore — sessionStorage not available */ }
    onClose()
  }

  const optStyle = (primary: boolean): React.CSSProperties => ({
    display: "flex", gap: 12, alignItems: "center", padding: "14px 16px",
    borderRadius: 12, textDecoration: "none",
    background: primary ? C.accentSoft : "var(--surface-2)",
    border: `1px solid ${primary ? "var(--accent-border)" : C.border}`,
    transition: "all .15s", cursor: "pointer",
  })
  const iconStyle = (primary: boolean): React.CSSProperties => ({
    flexShrink: 0, width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
    background: primary ? "var(--accent)" : "var(--surface)", color: primary ? "#fff" : C.muted,
  })

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 18, padding: "28px 30px", width: "100%", maxWidth: 460,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>
              Apply to {job.company}
            </h3>
            {tracked && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", textTransform: "uppercase", letterSpacing: ".04em", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Tracked
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{job.title}</p>
          {!tracked && (
            <p style={{ fontSize: 11.5, color: C.hint, margin: "6px 0 0" }}>
              Clicking any option below will automatically add this job to your pipeline tracker.
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {/* One-Click Autofill — opens external apply URL */}
          <a href={job.url} target="_blank" rel="noreferrer"
            onClick={handleOption}
            style={optStyle(true)}>
            <span style={iconStyle(true)}><Zap size={16}/></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>One-Click Autofill</div>
              <div style={{ fontSize: 12, color: C.muted }}>Use the MarketFit Chrome Extension to fill this form in seconds.</div>
            </div>
          </a>

          {/* Tailor Resume First — prefills AI Tools with this job's JD */}
          <a href="/dashboard/ai-tools" onClick={e => { e.preventDefault(); handleTailorResume(); window.location.href = "/dashboard/ai-tools" }}
            style={optStyle(false)}>
            <span style={iconStyle(false)}><FileText size={16}/></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Tailor Resume First</div>
              <div style={{ fontSize: 12, color: C.muted }}>Opens AI Tools with this JD pre-loaded — ready to tailor.</div>
            </div>
          </a>

          {/* Apply Directly — opens external apply URL */}
          <a href={job.url} target="_blank" rel="noreferrer"
            onClick={handleOption}
            style={optStyle(false)}>
            <span style={iconStyle(false)}><ExternalLink size={16}/></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Apply Directly</div>
              <div style={{ fontSize: 12, color: C.muted }}>Go to the job listing and apply manually.</div>
            </div>
          </a>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "10px", borderRadius: 10,
            background: "var(--surface-2)", color: C.muted,
            border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13,
          }}
        >{tracked ? "Close" : "Cancel"}</button>
      </div>
    </div>
  )
}


// ── Date posted parser — converts raw posted string to ms since epoch ─────────
function postedMs(raw: string | null): number {
  if (!raw) return 0
  try {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d.getTime()
  } catch {}
  return 0
}

const PAGE_SIZE = 20

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FullTimeJobBoard() {
  const [category, setCategory] = useState("all")
  const [visaFilter, setVisaFilter] = useState("all")
  const [searchInput, setSearchInput] = useState("")   // bound to the input, updates instantly
  const [search, setSearch] = useState("")              // debounced value actually used to fetch
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [hybridOnly, setHybridOnly] = useState(false)
  const [jobs, setJobs] = useState<FtJob[]>([])
  const [loading, setLoading] = useState(false)
  const [applyModal, setApplyModal] = useState<FtJob | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [isLive, setIsLive] = useState(false)
  const [sourceLabel, setSourceLabel] = useState("Loading…")
  // ── New JobRight-style filters ────────────────────────────────────────────
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("any")
  const [expLevel, setExpLevel] = useState<"all" | "entry" | "mid" | "senior" | "lead">("all")
  const [salaryMin, setSalaryMin] = useState<number>(0)      // 0 = no min
  const [hideAgencies, setHideAgencies] = useState(false)
  const [sortBy, setSortBy] = useState<"match" | "newest" | "salary">("newest")
  // ── Company / distance / skills filters ───────────────────────────────────
  const [companyFilter, setCompanyFilter] = useState<string[]>([])
  const [originCity, setOriginCity] = useState("")
  const [distanceFilter, setDistanceFilter] = useState<(typeof DISTANCE_OPTIONS)[number]["key"]>("any")
  const [skillFilter, setSkillFilter] = useState<string[]>([])
  const [showCompanyPanel, setShowCompanyPanel] = useState(false)
  const [showDistancePanel, setShowDistancePanel] = useState(false)
  const requestIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wait for a pause in typing before firing a request
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(searchInput), 420)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const fetchJobs = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setLoading(true)
    try {
      const cat = STEM_CATEGORIES.find(c => c.key === category)!
      const q = search || cat.query
      const params = new URLSearchParams({ q, remote: remoteOnly ? "true" : "false" })
      const res = await fetchJobsApi(`/api/jobs?${params}`)
      const data = await res.json()
      if (reqId !== requestIdRef.current) return
      setJobs(data.jobs || [])
      setIsLive(!!data.live)
      setSourceLabel(data.live
        ? `Live · ${(data.sources as string[])?.join(" + ") ?? "API"}`
        : "Sample data · add a job API key in Settings for live listings")
    } catch {
      if (reqId !== requestIdRef.current) return
      setJobs([])
      setIsLive(false)
      setSourceLabel("Error loading jobs")
    } finally {
      if (reqId === requestIdRef.current) setLoading(false)
    }
  }, [category, search, remoteOnly])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // ── Client-side smart filtering ───────────────────────────────────────────────
  const filtered = (() => {
    let list = jobs.filter(j => {
      // Visa filter
      if (visaFilter === "h1b" && !j.workAuth?.includes("h1b")) return false
      if (visaFilter === "opt" && !j.workAuth?.includes("opt_cpt")) return false
      if (visaFilter === "gc" && !j.workAuth?.includes("green_card")) return false
      // Work type
      if (hybridOnly && !/(hybrid|flexible|onsite|on-site|in-office)/i.test(j.description || "")) return false
      // Date posted
      if (!matchesDatePosted(j.posted, dateFilter)) return false
      // Experience level
      if (expLevel !== "all" && detectExpLevel(j.title) !== expLevel) return false
      // Salary min — unlisted salary doesn't get excluded
      if (salaryMin > 0) {
        const n = extractSalaryNumber(j.salary)
        if (n > 0 && n < salaryMin) return false
      }
      // Hide staffing/recruiting agencies
      if (hideAgencies && isStaffingAgency(j.company)) return false
      // Company
      if (companyFilter.length && !companyFilter.includes(j.company)) return false
      // Distance ("near me")
      if (!matchesDistance(j.location, j.remote, originCity, distanceFilter)) return false
      // Skills — job passes if it mentions ANY selected skill
      if (skillFilter.length) {
        const jobSkills = extractSkills(`${j.title} ${j.description || ""}`)
        if (!skillFilter.some(s => jobSkills.includes(s))) return false
      }
      return true
    })
    // Sort
    if (sortBy === "newest") {
      list = [...list].sort((a, b) => postedMs(b.posted) - postedMs(a.posted))
    } else if (sortBy === "salary") {
      list = [...list].sort((a, b) => extractSalaryNumber(b.salary) - extractSalaryNumber(a.salary))
    } else {
      // "match" = h1b likelihood tier (canonical scorer, not a fabricated 0-100 score)
      list = [...list].sort((a, b) => h1bRank(b.company) - h1bRank(a.company))
    }
    return list
  })()
  const shown = filtered.slice(0, visible)

  // Facets computed from the raw job list — what's available to filter by.
  const companyOptions = useMemo(() => companyFacets(jobs, j => j.company), [jobs])
  const skillOptions = useMemo(() => topSkills(jobs, j => `${j.title} ${j.description || ""}`), [jobs])

  function toggleCompany(name: string) {
    setCompanyFilter(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
  }
  function toggleSkill(skill: string) {
    setSkillFilter(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
  }

  // Scroll back to page 1 when any filter changes
  const sig = `${category}|${search}|${remoteOnly}|${hybridOnly}|${visaFilter}|${dateFilter}|${expLevel}|${salaryMin}|${hideAgencies}|${sortBy}|${companyFilter.join(",")}|${originCity}|${distanceFilter}|${skillFilter.join(",")}`
  const [lastSig, setLastSig] = useState(sig)
  if (sig !== lastSig) { setLastSig(sig); setVisible(PAGE_SIZE) }

  function resetFilters() {
    setSearchInput(""); setSearch(""); setVisaFilter("all"); setRemoteOnly(false); setHybridOnly(false)
    setDateFilter("any"); setExpLevel("all"); setSalaryMin(0); setHideAgencies(false); setSortBy("newest"); setCategory("all")
    setCompanyFilter([]); setOriginCity(""); setDistanceFilter("any"); setSkillFilter([])
  }

  const hasActiveFilters = visaFilter !== "all" || remoteOnly || hybridOnly || dateFilter !== "any" || expLevel !== "all" || salaryMin > 0 || hideAgencies
    || companyFilter.length > 0 || distanceFilter !== "any" || skillFilter.length > 0

  return (
    <div>
      {!loading && <SampleDataBanner live={isLive} />}
      {/* ── Sticky header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", paddingBottom: 12, marginBottom: 4 }}>

        {/* ── Title row ── */}
        <div style={{ marginBottom: 16 }}>
          <PageHeader
            icon={<Briefcase size={18}/>}
            title="Full-Time Board"
            badge={
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: isLive ? "rgba(52,211,153,.15)" : "rgba(107,114,128,.1)",
                color: isLive ? C.green : C.muted,
                border: `1px solid ${isLive ? "rgba(52,211,153,.3)" : "rgba(107,114,128,.2)"}`,
              }}>
                {isLive ? `● ${jobs.length} live` : `◎ ${jobs.length} sample`}
              </span>
            }
            description={`STEM full-time roles with H1B sponsorship signals. ${loading && jobs.length > 0 ? "Refreshing…" : ""}`}
            actions={
              <Link href="/dashboard/jobs" style={{
                fontSize: 12, color: C.accentTxt, textDecoration: "none",
                padding: "6px 12px", borderRadius: 8,
                background: C.accentSoft, border: "1px solid var(--accent-border)", fontWeight: 600,
              }}>Pipeline →</Link>
            }
          />
        </div>

        {/* ── Search ── */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.hint }}/>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={`Search ${jobs.length} full-time roles — title, skill, company…`}
            style={{
              width: "100%", padding: "12px 14px 12px 38px", borderRadius: 12, fontSize: 14,
              background: C.card, border: `1px solid ${C.border}`, color: C.text, outline: "none", boxSizing: "border-box",
            }}
          />
          {searchInput && (
            <button onClick={() => setSearchInput("")} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex",
            }}><X size={16}/></button>
          )}
        </div>

        {/* ── STEM category chips ── */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
          {STEM_CATEGORIES.map(cat => {
            const active = category === cat.key && !search
            return (
              <button
                key={cat.key}
                onClick={() => { setCategory(cat.key); setSearchInput(""); setSearch("") }}
                style={{
                  padding: "6px 13px", borderRadius: 20, cursor: "pointer",
                  fontSize: 12, fontWeight: 600, transition: "all .15s", whiteSpace: "nowrap",
                  background: active ? "#6366f1" : "var(--surface)",
                  color: active ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${active ? "#6366f1" : "var(--border)"}`,
                }}
              >{cat.label}</button>
            )
          })}
        </div>

        {/* ── Filter row: dropdowns + sort ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          {/* Visa */}
          <select value={visaFilter} onChange={e => setVisaFilter(e.target.value as "all"|"h1b"|"opt"|"gc")}
            style={{ padding: "7px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", outline: "none",
              background: visaFilter !== "all" ? "rgba(20,184,166,.12)" : "var(--surface)",
              color: visaFilter !== "all" ? C.teal : "var(--text-muted)",
              border: `1.5px solid ${visaFilter !== "all" ? "rgba(20,184,166,.4)" : "var(--border)"}` }}>
            <option value="all">Work Auth</option>
            <option value="h1b">H-1B Sponsor</option>
            <option value="opt">OPT / CPT</option>
            <option value="gc">Green Card OK</option>
          </select>

          {/* Date posted */}
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilterKey)}
            style={{ padding: "7px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", outline: "none",
              background: dateFilter !== "any" ? "rgba(99,102,241,.12)" : "var(--surface)",
              color: dateFilter !== "any" ? "#6366f1" : "var(--text-muted)",
              border: `1.5px solid ${dateFilter !== "any" ? "rgba(99,102,241,.4)" : "var(--border)"}` }}>
            <option value="any">Date Posted</option>
            {DATE_FILTERS.filter(d => d.key !== "any").map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>

          {/* Experience level */}
          <select value={expLevel} onChange={e => setExpLevel(e.target.value as ExperienceLevel)}
            style={{ padding: "7px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", outline: "none",
              background: expLevel !== "all" ? "rgba(20,184,166,.12)" : "var(--surface)",
              color: expLevel !== "all" ? C.teal : "var(--text-muted)",
              border: `1.5px solid ${expLevel !== "all" ? "rgba(20,184,166,.4)" : "var(--border)"}` }}>
            <option value="all">Experience</option>
            <option value="entry">Entry level</option>
            <option value="mid">Mid level</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead+</option>
          </select>

          {/* Min salary */}
          <select value={String(salaryMin)} onChange={e => setSalaryMin(Number(e.target.value))}
            style={{ padding: "7px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", outline: "none",
              background: salaryMin > 0 ? "rgba(251,191,36,.12)" : "var(--surface)",
              color: salaryMin > 0 ? "#d97706" : "var(--text-muted)",
              border: `1.5px solid ${salaryMin > 0 ? "rgba(251,191,36,.4)" : "var(--border)"}` }}>
            <option value="0">Min Salary</option>
            {[80000,100000,120000,140000,160000,200000].map(v => <option key={v} value={String(v)}>${(v/1000).toFixed(0)}k+</option>)}
          </select>

          {/* Hide staffing/recruiting agencies */}
          <button onClick={() => setHideAgencies(h => !h)} title="Hide staffing/recruiting agencies re-posting the same role" style={{
            padding: "7px 11px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            background: hideAgencies ? "rgba(239,68,68,.1)" : "var(--surface)",
            color: hideAgencies ? "#dc2626" : "var(--text-muted)",
            border: `1.5px solid ${hideAgencies ? "rgba(239,68,68,.35)" : "var(--border)"}`,
            display: "inline-flex", alignItems: "center", gap: 5,
          }}><Ban size={13}/> Hide agencies</button>

          {/* Remote / Hybrid toggles */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, cursor: "pointer",
            background: remoteOnly ? "rgba(20,184,166,.12)" : "var(--surface)",
            border: `1.5px solid ${remoteOnly ? "rgba(20,184,166,.4)" : "var(--border)"}`,
            fontSize: 12.5, fontWeight: 600, color: remoteOnly ? C.teal : "var(--text-muted)", whiteSpace: "nowrap" as const,
          }}>
            <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} style={{ accentColor: C.teal, width: 13, height: 13 }} />
            <Globe size={13}/> Remote
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, cursor: "pointer",
            background: hybridOnly ? "rgba(251,191,36,.12)" : "var(--surface)",
            border: `1.5px solid ${hybridOnly ? "rgba(251,191,36,.35)" : "var(--border)"}`,
            fontSize: 12.5, fontWeight: 600, color: hybridOnly ? "#d97706" : "var(--text-muted)", whiteSpace: "nowrap" as const,
          }}>
            <input type="checkbox" checked={hybridOnly} onChange={e => setHybridOnly(e.target.checked)} style={{ accentColor: "#d97706", width: 13, height: 13 }} />
            <Building2 size={13}/> Hybrid
          </label>

          {/* Sort */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 3, padding: 3, background: "var(--surface)", border: `1px solid ${C.border}`, borderRadius: 10 }}>
            {([
              { key: "newest" as const, Icon: Clock, label: "New" },
              { key: "salary" as const, Icon: DollarSign, label: "Pay" },
              { key: "match" as const, Icon: Star, label: "Match" },
            ]).map(({ key, Icon, label }) => (
              <button key={key} onClick={() => setSortBy(key)} style={{
                padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
                background: sortBy === key ? "var(--accent)" : "transparent",
                color: sortBy === key ? "#fff" : "var(--text-muted)",
              }}><Icon size={12}/> {label}</button>
            ))}
          </div>
        </div>

        {/* ── Advanced filters: company + distance + skills + clear ── */}
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {skillOptions.length > 0 && (
            <select value={skillFilter[0] || ""} onChange={e => { const v = e.target.value; setSkillFilter(v ? [v] : []) }}
              style={{ padding: "7px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", outline: "none",
                background: skillFilter.length ? mix(C.purple, 18) : "var(--surface)",
                color: skillFilter.length ? C.purple : "var(--text-muted)",
                border: `1.5px solid ${skillFilter.length ? mix(C.purple, 40) : "var(--border)"}` }}>
              <option value="">Skill</option>
              {skillOptions.map(({ skill, count }) => <option key={skill} value={skill}>{skill} ({count})</option>)}
            </select>
          )}
          {/* Company (multi-select popover) */}
          <div style={{ position: "relative" }}>
            <button onClick={() => { setShowCompanyPanel(v => !v); setShowDistancePanel(false) }} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: companyFilter.length ? mix(C.accent, 15) : "var(--surface)",
              color: companyFilter.length ? C.accentTxt : "var(--text-muted)",
              border: `1px solid ${companyFilter.length ? "var(--accent-border)" : "var(--border)"}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><Building2 size={13}/> Company{companyFilter.length ? ` (${companyFilter.length})` : ""} <ChevronDown size={12}/></button>
            {showCompanyPanel && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, minWidth: 220, maxHeight: 260, overflowY: "auto",
                background: "var(--popover)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 6,
                boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              }}>
                {companyOptions.length === 0 && <div style={{ padding: 8, fontSize: 12, color: C.muted }}>No companies yet.</div>}
                {companyOptions.map(({ company, count }) => (
                  <label key={company} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer", fontSize: 12.5, color: C.text }}>
                    <input type="checkbox" checked={companyFilter.includes(company)} onChange={() => toggleCompany(company)} />
                    <span style={{ flex: 1 }}>{company}</span>
                    <span style={{ color: C.hint, fontSize: 11 }}>{count}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {/* Distance / near me (metro + radius popover) */}
          <div style={{ position: "relative" }}>
            <button onClick={() => { setShowDistancePanel(v => !v); setShowCompanyPanel(false) }} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: distanceFilter !== "any" && originCity ? mix(C.accent, 15) : "var(--surface)",
              color: distanceFilter !== "any" && originCity ? C.accentTxt : "var(--text-muted)",
              border: `1px solid ${distanceFilter !== "any" && originCity ? "var(--accent-border)" : "var(--border)"}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><MapPin size={13}/> {originCity && distanceFilter !== "any" ? `${DISTANCE_OPTIONS.find(d => d.key === distanceFilter)?.label}` : "Distance"} <ChevronDown size={12}/></button>
            {showDistancePanel && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, width: 240,
                background: "var(--popover)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10,
                boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              }}>
                <label style={{ fontSize: 11, color: C.hint, display: "block", marginBottom: 4 }}>Near this city</label>
                <select value={originCity} onChange={e => setOriginCity(e.target.value)} style={{
                  width: "100%", padding: "6px 8px", borderRadius: 8, fontSize: 12.5, marginBottom: 10,
                  background: "var(--surface)", border: `1px solid ${C.border}`, color: C.text,
                }}>
                  <option value="">Choose a city…</option>
                  {METRO_OPTIONS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <label style={{ fontSize: 11, color: C.hint, display: "block", marginBottom: 4 }}>Radius</label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {DISTANCE_OPTIONS.map(d => (
                    <button key={d.key} onClick={() => setDistanceFilter(d.key)} style={{
                      padding: "4px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
                      background: distanceFilter === d.key ? "var(--accent)" : "var(--surface-2)",
                      color: distanceFilter === d.key ? "#fff" : "var(--text-muted)", border: "none",
                    }}>{d.label}</button>
                  ))}
                </div>
                <p style={{ fontSize: 10.5, color: C.hint, marginTop: 8, marginBottom: 0 }}>Remote roles always match, regardless of distance.</p>
              </div>
            )}
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>
            {filtered.length} {filtered.length === 1 ? "role" : "roles"}
            {hasActiveFilters && (
              <button onClick={resetFilters} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><X size={11}/> Clear</button>
            )}
          </span>
        </div>

      </div>

      {/* ── Job list: one big scrollable box under the pinned filters ── */}
      {loading && jobs.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          color: C.muted, fontSize: 14,
        }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 10px" }}/>
          Loading STEM jobs…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          color: C.muted, fontSize: 14,
        }}>
          <Search size={24} style={{ margin: "0 auto 10px" }}/>
          No jobs found. Try adjusting your filters or broadening your search.
          <div style={{ marginTop: 14 }}>
            <button
              onClick={resetFilters}
              style={{
                padding: "8px 16px", borderRadius: 8, background: C.accent,
                color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
            >Reset Filters</button>
          </div>
        </div>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", gap: 10,
          maxHeight: "calc(100vh - 360px)", minHeight: 300, overflowY: "auto", overscrollBehavior: "contain",
          padding: "2px 4px 4px 2px", margin: "-2px -4px -4px -2px",
        }}>
          {shown.map((job, i) => (
            <JobCard key={job.id || i} job={job} onApply={setApplyModal} />
          ))}

          {visible < filtered.length && (
            <button
              onClick={() => setVisible(v => v + PAGE_SIZE)}
              style={{
                margin: "4px auto 0", padding: "10px 22px", borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 700, background: C.card, color: C.text, border: `1px solid ${C.border}`,
              }}
            >Load {Math.min(PAGE_SIZE, filtered.length - visible)} more ({filtered.length - visible} left)</button>
          )}
        </div>
      )}

      <ApplyModal job={applyModal} onClose={() => setApplyModal(null)} />
    </div>
  )
}
