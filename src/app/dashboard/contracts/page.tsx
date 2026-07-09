"use client"

import { useState, useMemo, useEffect, type CSSProperties } from "react"
import { CONTRACT_JOBS, CONTRACT_CATEGORIES, type ContractJobRec, type ContractCategory } from "./contractData"
import {
  DISTANCE_OPTIONS, METRO_OPTIONS, matchesDistance, extractSkills, topSkills, companyFacets,
  DATE_FILTERS, matchesDatePosted, type DateFilterKey,
  EXPERIENCE_LEVELS, detectExpLevel, type ExperienceLevel,
} from "@/lib/jobFilters"
import PageHeader from "@/components/layout/PageHeader"
import { fetchJobs as fetchJobsApi } from "@/lib/jobsClient"
import SampleDataBanner from "@/components/SampleDataBanner"
import {
  ClipboardList, Search, X, Globe, Clock, DollarSign, Star, Target, Building2, MapPin,
  ChevronDown, ChevronUp, Mail, ExternalLink, Check, Bookmark,
} from "lucide-react"

// ── Tokens ───────────────────────────────────────────────────────────────────
// Structural colors are theme-aware — same var(--*) tokens the Jobs & Apply hub
// uses, so this board matches it exactly and switches with the theme selector.
// Accent colors stay literal hex (concatenated with a hex-alpha suffix elsewhere).
const C = {
  card:   "var(--surface)",
  border: "var(--border)",
  text:   "var(--text)",
  muted:  "var(--text-muted)",
  hint:   "var(--text-soft)",
  teal:   "#14b8a6",
  amber:  "#f59e0b",
  green:  "#34d399",
}

const CAT_COLOR: Record<ContractCategory, string> = {
  "Cybersecurity":    "#f87171",
  "AI / ML":          "#c084fc",
  "Data Engineering": "#38bdf8",
  "DevOps / Cloud":   "#34d399",
  "ERP / Platform":   "#fbbf24",
  "Software Dev":     "#60a5fa",
  "BA / PM":          "#f472b6",
  "QA / Testing":     "#2dd4bf",
  "Other":            "#94a3b8",
}

const TYPE_COLOR: Record<ContractJobRec["type"], string> = {
  W2: "#60a5fa", C2C: "#93c5fd", C2H: "#c4b5fd", Both: "#fbbf24",
}

const PAGE = 25

// Parse hourly rate to a number (returns 0 if not parseable)
function parseRate(rate: string): number {
  const m = rate.match(/\$?([\d,]+)/)
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0
}

// Parse "posted" field (relative time like "2h", "3d", "1w") to ms offset from now
function relPostedMs(posted: string): number {
  const m = posted.match(/^(\d+)\s*([hdwm])/i)
  if (!m) return Date.now()
  const n = parseInt(m[1], 10)
  const unit = m[2].toLowerCase()
  const mult = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 }[unit] ?? 86400000
  return Date.now() - n * mult
}

// Expand compact relative strings to full English: "2h" → "2 hours ago"
function expandPosted(posted: string): string {
  const m = posted.match(/^(\d+)\s*([hdwm])/i)
  if (!m) return posted
  const n = parseInt(m[1], 10)
  const unit = m[2].toLowerCase()
  const labels: Record<string, [string, string]> = {
    h: ["hour", "hours"], d: ["day", "days"], w: ["week", "weeks"], m: ["month", "months"],
  }
  const [singular, plural] = labels[unit] ?? ["day", "days"]
  return `${n} ${n === 1 ? singular : plural} ago`
}

export default function ContractsDashboard() {
  const [cat, setCat] = useState<"all" | ContractCategory>("all")
  const [type, setType] = useState<"all" | "W2" | "C2C">("all")
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [search, setSearch] = useState("")
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [tracked, setTracked] = useState<Set<string>>(new Set())
  const [openBody, setOpenBody] = useState<Set<string>>(new Set())

  // Persist saved + tracked across refreshes
  useEffect(() => {
    try { setSaved(new Set(JSON.parse(localStorage.getItem("mf_contract_saved") || "[]"))) } catch {}
    try { setTracked(new Set(JSON.parse(localStorage.getItem("jd_applied_ids") || "[]"))) } catch {}
  }, [])

  function toggleSaved(id: string) {
    setSaved(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem("mf_contract_saved", JSON.stringify([...next]))
      return next
    })
  }

  function trackJob(j: ContractJobRec) {
    if (tracked.has(j.id)) return
    setTracked(prev => {
      const next = new Set(prev); next.add(j.id)
      localStorage.setItem("jd_applied_ids", JSON.stringify([...next]))
      return next
    })
    try {
      const existing: Array<{ id: string }> = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
      if (!existing.find(a => a.id === j.id)) {
        const entry = {
          id: j.id, company: j.company, role: j.title, location: j.location,
          remote: /remote/i.test(j.location), salary: j.rate || "",
          stage: "applied", appliedDate: new Date().toISOString(),
          notes: j.contact ? `Recruiter: ${j.contact}` : "",
          url: j.applyUrl, visa: j.type === "C2C" ? "c2c" : "w2", priority: "mid",
        }
        localStorage.setItem("jd_applications_v2", JSON.stringify([entry, ...existing]))
      }
    } catch {}
  }
  const [visible, setVisible] = useState(PAGE)
  // ── JobRight-style extra filters ──────────────────────────────────────────
  const [rateMin, setRateMin] = useState(0)   // 0 = any
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("any")
  const [expLevel, setExpLevel] = useState<ExperienceLevel>("all")
  const [sortBy, setSortBy] = useState<"newest" | "rate" | "relevance">("newest")
  // ── Company / distance / skills filters ───────────────────────────────────
  const [companyFilter, setCompanyFilter] = useState<string[]>([])
  const [originCity, setOriginCity] = useState("")
  const [distanceFilter, setDistanceFilter] = useState<(typeof DISTANCE_OPTIONS)[number]["key"]>("any")
  const [skillFilter, setSkillFilter] = useState<string[]>([])
  const [showCompanyPanel, setShowCompanyPanel] = useState(false)
  const [showDistancePanel, setShowDistancePanel] = useState(false)
  const [showDatePanel, setShowDatePanel] = useState(false)
  const [showRatePanel, setShowRatePanel] = useState(false)
  const [showExpPanel, setShowExpPanel] = useState(false)

  // Only one filter dropdown open at a time.
  function openPanel(which: "company" | "distance" | "date" | "rate" | "exp" | null) {
    setShowCompanyPanel(which === "company")
    setShowDistancePanel(which === "distance")
    setShowDatePanel(which === "date")
    setShowRatePanel(which === "rate")
    setShowExpPanel(which === "exp")
  }

  // ── Live API fetch — prepend live results to static library ──────────────
  const [jobs, setJobs] = useState<ContractJobRec[]>(CONTRACT_JOBS)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadLiveContracts() {
      try {
        // Prefer the user's own saved title (Settings/Profile) over a generic
        // query — "contract developer w2 c2c staffing" matched almost nothing
        // relevant for e.g. a security or ServiceNow candidate, which is why
        // this board felt generic and off-target.
        let q = "contract developer w2 c2c staffing"
        try {
          const title = JSON.parse(localStorage.getItem("jd_profile") || "{}").title
          if (title) q = `${title} contract w2 c2c`
        } catch { /* keep generic default */ }
        const res = await fetchJobsApi(`/api/jobs?type=contract&q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data.live || !Array.isArray(data.jobs) || data.jobs.length === 0) return
        // Map API jobs → ContractJobRec shape
        const live: ContractJobRec[] = (data.jobs as Array<{
          id: string; title: string; company: string; location: string; remote: boolean
          salary: string | null; description: string; workAuth: string[]; url: string
          posted: string; source?: string
        }>).map(j => {
          const workAuth = (j.workAuth ?? []).map((w: string) => w.toLowerCase())
          const type: ContractJobRec["type"] =
            workAuth.includes("c2c") ? "C2C" :
            workAuth.includes("w2")  ? "W2"  : "Both"
          return {
            id:       `live_${j.id}`,
            title:    j.title,
            company:  j.company,
            poster:   j.company,
            location: j.remote ? "Remote" : j.location,
            type,
            rate:     j.salary || "Rate DOE",
            duration: "Contract",
            posted:   j.posted ?? new Date().toISOString(),
            category: "Other" as ContractJobRec["category"],
            tags:     [],
            contact:  "",
            source:   "indeed" as const,
            applyUrl: j.url || "https://www.linkedin.com/jobs",
            body:     j.description || "",
          }
        })
        // Prepend live results, keeping static library as fallback
        setJobs([...live, ...CONTRACT_JOBS])
        setIsLive(true)
      } catch {
        // API unavailable — stay on static data
      }
    }
    loadLiveContracts()
  }, [])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const j of jobs) m[j.category] = (m[j.category] || 0) + 1
    return m
  }, [jobs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = jobs.filter(j => {
      if (cat !== "all" && j.category !== cat) return false
      if (type !== "all" && j.type !== type && j.type !== "Both") return false
      if (remoteOnly && !/remote/i.test(j.location)) return false
      if (rateMin > 0) {
        const r = parseRate(j.rate)
        if (r > 0 && r < rateMin) return false
      }
      if (!matchesDatePosted(j.posted, dateFilter)) return false
      if (expLevel !== "all" && detectExpLevel(j.title) !== expLevel) return false
      if (companyFilter.length && !companyFilter.includes(j.company)) return false
      if (!matchesDistance(j.location, /remote/i.test(j.location), originCity, distanceFilter)) return false
      if (skillFilter.length) {
        const jobSkills = extractSkills(`${j.title} ${j.tags.join(" ")} ${j.body}`)
        if (!skillFilter.some(s => jobSkills.includes(s))) return false
      }
      if (q && !(
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.body.toLowerCase().includes(q) ||
        j.tags.some(t => t.toLowerCase().includes(q))
      )) return false
      return true
    })
    // Sort
    if (sortBy === "newest") {
      list = [...list].sort((a, b) => relPostedMs(b.posted) - relPostedMs(a.posted))
    } else if (sortBy === "rate") {
      list = [...list].sort((a, b) => parseRate(b.rate) - parseRate(a.rate))
    }
    // "relevance" keeps natural order (already ranked in data by recency)
    return list
  }, [jobs, cat, type, remoteOnly, rateMin, dateFilter, expLevel, sortBy, search, companyFilter, originCity, distanceFilter, skillFilter])

  const shown = filtered.slice(0, visible)

  // Facets computed from the raw job list — what's available to filter by.
  const companyOptions = useMemo(() => companyFacets(jobs, j => j.company), [jobs])
  const skillOptions = useMemo(() => topSkills(jobs, j => `${j.title} ${j.tags.join(" ")} ${j.body}`), [jobs])

  function toggleCompany(name: string) {
    setCompanyFilter(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
  }
  function toggleSkill(skill: string) {
    setSkillFilter(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
  }

  // reset to first page when the active filter set changes
  const sig = `${cat}|${type}|${remoteOnly}|${rateMin}|${dateFilter}|${expLevel}|${sortBy}|${search}|${companyFilter.join(",")}|${originCity}|${distanceFilter}|${skillFilter.join(",")}`
  const [lastSig, setLastSig] = useState(sig)
  if (sig !== lastSig) { setLastSig(sig); setVisible(PAGE) }

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n)
  }

  const hasActive = type !== "all" || remoteOnly || rateMin > 0 || dateFilter !== "any" || expLevel !== "all"
    || companyFilter.length > 0 || distanceFilter !== "any" || skillFilter.length > 0

  return (
    <div>
      <SampleDataBanner live={isLive} variant="snapshot" />

      {/* ── Sticky header: title + search + filters all stay put while the feed below scrolls ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", paddingBottom: 12, marginBottom: 4 }}>
        <div style={{ marginBottom: 16 }}>
          <PageHeader
            icon={<ClipboardList size={18}/>}
            title="Contract Board"
            badge={
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: isLive ? "rgba(52,211,153,.15)" : "rgba(148,163,184,.12)",
                color: isLive ? C.green : C.muted,
                border: `1px solid ${isLive ? "rgba(52,211,153,.3)" : "rgba(148,163,184,.25)"}`,
              }}>{isLive ? `● Live · ${jobs.length} posts` : `◎ ${jobs.length} posts · add a job API key in Settings for live`}</span>
            }
            description="Recruiter contract posts from LinkedIn — categorized, bench-sales removed. Message the recruiter directly."
          />
        </div>

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.hint }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${jobs.length} contract posts — role, company, skill, location…`}
            style={{
              width: "100%", padding: "12px 14px 12px 38px", borderRadius: 12, fontSize: 14,
              background: C.card, border: `1px solid ${C.border}`, color: C.text, outline: "none", boxSizing: "border-box",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex",
            }}><X size={16}/></button>
          )}
        </div>

        {/* ── Category chips ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => setCat("all")} style={chip(cat === "all", C.teal)}>
            All <span style={{ opacity: .65 }}>{jobs.length}</span>
          </button>
          {CONTRACT_CATEGORIES.filter(c => catCounts[c]).map(c => (
            <button key={c} onClick={() => setCat(c)} style={chip(cat === c, CAT_COLOR[c])}>
              {c} <span style={{ opacity: .65 }}>{catCounts[c]}</span>
            </button>
          ))}
        </div>

        {/* ── Toggle row: type + remote + sort ─────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <select value={type} onChange={e => setType(e.target.value as "all"|"W2"|"C2C")}
            style={{ padding: "7px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", outline: "none",
              background: type !== "all" ? "rgba(20,184,166,.12)" : "var(--surface)",
              color: type !== "all" ? C.teal : "var(--text-muted)",
              border: `1.5px solid ${type !== "all" ? "rgba(20,184,166,.4)" : C.border}` }}>
            <option value="all">Contract Type</option>
            <option value="W2">W2</option>
            <option value="C2C">C2C</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, cursor: "pointer",
            background: remoteOnly ? "rgba(20,184,166,.12)" : "var(--surface)",
            border: `1.5px solid ${remoteOnly ? "rgba(20,184,166,.4)" : C.border}`,
            fontSize: 12.5, fontWeight: 600, color: remoteOnly ? C.teal : "var(--text-muted)", whiteSpace: "nowrap" as const,
          }}>
            <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} style={{ accentColor: C.teal, width: 13, height: 13 }} />
            <Globe size={13}/> Remote
          </label>
          {/* Sort */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 3, padding: 3, background: "var(--surface)", border: `1px solid ${C.border}`, borderRadius: 10 }}>
            {([
              { key: "newest" as const, Icon: Clock, label: "New" },
              { key: "rate" as const, Icon: DollarSign, label: "Rate" },
              { key: "relevance" as const, Icon: Star, label: "Best" },
            ]).map(({ key, Icon, label }) => (
              <button key={key} onClick={() => setSortBy(key)} style={{
                padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
                background: sortBy === key ? C.teal : "transparent",
                color: sortBy === key ? "#04201c" : C.muted,
              }}><Icon size={12}/> {label}</button>
            ))}
          </div>
        </div>

        {/* ── Advanced filters: organized dropdowns, not a wall of buttons ── */}
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {/* Date posted (dropdown) */}
          <div style={{ position: "relative" }}>
            <button onClick={() => openPanel(showDatePanel ? null : "date")} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: dateFilter !== "any" ? "rgba(20,184,166,.15)" : "var(--surface)",
              color: dateFilter !== "any" ? C.teal : C.muted,
              border: `1px solid ${dateFilter !== "any" ? "rgba(20,184,166,.4)" : C.border}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><Clock size={12}/> {DATE_FILTERS.find(d => d.key === dateFilter)?.label} <ChevronDown size={12}/></button>
            {showDatePanel && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, minWidth: 150,
                background: "var(--popover)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 6,
                boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              }}>
                {DATE_FILTERS.map(d => (
                  <button key={d.key} onClick={() => { setDateFilter(d.key); openPanel(null) }} style={{
                    display: "block", width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 7,
                    background: dateFilter === d.key ? "rgba(20,184,166,.15)" : "transparent",
                    color: dateFilter === d.key ? C.teal : C.text, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: dateFilter === d.key ? 700 : 500,
                  }}>{d.label}</button>
                ))}
              </div>
            )}
          </div>
          {/* Rate floor (dropdown) */}
          <div style={{ position: "relative" }}>
            <button onClick={() => openPanel(showRatePanel ? null : "rate")} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: rateMin > 0 ? "rgba(251,191,36,.15)" : "var(--surface)",
              color: rateMin > 0 ? "#d97706" : C.muted,
              border: `1px solid ${rateMin > 0 ? "rgba(251,191,36,.4)" : C.border}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><DollarSign size={12}/> {rateMin === 0 ? "Any rate" : `$${rateMin}+/hr`} <ChevronDown size={12}/></button>
            {showRatePanel && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, minWidth: 130,
                background: "var(--popover)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 6,
                boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              }}>
                {([0, 50, 75, 100] as const).map(r => (
                  <button key={r} onClick={() => { setRateMin(r); openPanel(null) }} style={{
                    display: "block", width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 7,
                    background: rateMin === r ? "rgba(251,191,36,.15)" : "transparent",
                    color: rateMin === r ? "#d97706" : C.text, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: rateMin === r ? 700 : 500,
                  }}>{r === 0 ? "Any rate" : `$${r}+/hr`}</button>
                ))}
              </div>
            )}
          </div>
          {/* Experience level (dropdown) */}
          <div style={{ position: "relative" }}>
            <button onClick={() => openPanel(showExpPanel ? null : "exp")} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: expLevel !== "all" ? "var(--accent-soft)" : "var(--surface)",
              color: expLevel !== "all" ? "var(--accent-txt)" : "var(--text-muted)",
              border: `1px solid ${expLevel !== "all" ? "var(--accent-border)" : C.border}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><Target size={12}/> {EXPERIENCE_LEVELS.find(l => l.key === expLevel)?.label} <ChevronDown size={12}/></button>
            {showExpPanel && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, minWidth: 130,
                background: "var(--popover)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 6,
                boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              }}>
                {EXPERIENCE_LEVELS.map(l => (
                  <button key={l.key} onClick={() => { setExpLevel(l.key); openPanel(null) }} style={{
                    display: "block", width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 7,
                    background: expLevel === l.key ? "var(--accent-soft)" : "transparent",
                    color: expLevel === l.key ? "var(--accent-txt)" : C.text, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: expLevel === l.key ? 700 : 500,
                  }}>{l.label}</button>
                ))}
              </div>
            )}
          </div>
          <span style={{ width: 1, height: 20, background: C.border, margin: "0 2px" }} />
          {/* Company (multi-select popover) */}
          <div style={{ position: "relative" }}>
            <button onClick={() => openPanel(showCompanyPanel ? null : "company")} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: companyFilter.length ? "var(--accent-soft)" : "var(--surface)",
              color: companyFilter.length ? "var(--accent-txt)" : "var(--text-muted)",
              border: `1px solid ${companyFilter.length ? "var(--accent-border)" : C.border}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><Building2 size={12}/> Company{companyFilter.length ? ` (${companyFilter.length})` : ""} <ChevronDown size={12}/></button>
            {showCompanyPanel && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, minWidth: 220, maxHeight: 260, overflowY: "auto",
                background: "var(--popover)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 6,
                boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              }}>
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
          {/* Distance / near me */}
          <div style={{ position: "relative" }}>
            <button onClick={() => openPanel(showDistancePanel ? null : "distance")} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: distanceFilter !== "any" && originCity ? "var(--accent-soft)" : "var(--surface)",
              color: distanceFilter !== "any" && originCity ? "var(--accent-txt)" : "var(--text-muted)",
              border: `1px solid ${distanceFilter !== "any" && originCity ? "var(--accent-border)" : C.border}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><MapPin size={12}/> {originCity && distanceFilter !== "any" ? DISTANCE_OPTIONS.find(d => d.key === distanceFilter)?.label : "Distance"} <ChevronDown size={12}/></button>
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
                      background: distanceFilter === d.key ? C.teal : "var(--surface-2)",
                      color: distanceFilter === d.key ? "#04201c" : "var(--text-muted)", border: "none",
                    }}>{d.label}</button>
                  ))}
                </div>
                <p style={{ fontSize: 10.5, color: C.hint, marginTop: 8, marginBottom: 0 }}>Remote posts always match, regardless of distance.</p>
              </div>
            )}
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>
            {filtered.length} {filtered.length === 1 ? "post" : "posts"}
            {hasActive && (
              <button onClick={() => { setType("all"); setRemoteOnly(false); setRateMin(0); setDateFilter("any"); setExpLevel("all"); setCompanyFilter([]); setOriginCity(""); setDistanceFilter("any"); setSkillFilter([]); openPanel(null) }}
                style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <X size={11}/> Clear
              </button>
            )}
          </span>
        </div>

        {/* ── Skills (derived from current results) ── */}
        {skillOptions.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 10.5, color: C.hint, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Skills:</span>
            {skillOptions.map(({ skill, count }) => {
              const active = skillFilter.includes(skill)
              return (
                <button key={skill} onClick={() => toggleSkill(skill)} style={{
                  padding: "3px 10px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: active ? "rgba(192,132,252,.18)" : "var(--surface)",
                  color: active ? "#c084fc" : "var(--text-muted)",
                  border: `1px solid ${active ? "rgba(192,132,252,.4)" : C.border}`,
                  textTransform: "capitalize",
                }}>{skill} <span style={{ opacity: .6 }}>{count}</span></button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Feed: one big scrollable box, cards inside stay contained ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, color: C.muted }}>
          No posts match. Clear the search or pick a different category.
        </div>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", gap: 12,
          maxHeight: "calc(100vh - 300px)", minHeight: 300, overflowY: "auto", overscrollBehavior: "contain",
          padding: "2px 4px 4px 2px", margin: "-2px -4px -4px -2px",
        }}>
          {shown.map(j => {
            const bodyOpen = openBody.has(j.id)
            const isMail = j.applyUrl.startsWith("mailto:")
            const long = j.body.length > 300
            return (
              <article key={j.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px" }}>

                {/* poster row */}
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, ${CAT_COLOR[j.category]}, var(--bg))`,
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14,
                  }}>{(j.company || j.poster || "?").slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {j.company}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
                      {j.poster !== j.company ? j.poster + " · " : ""}
                      {relPostedMs(j.posted) > Date.now() - 86400000 && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", textTransform: "uppercase", letterSpacing: ".04em" }}>NEW</span>
                      )}
                      {expandPosted(j.posted)} · LinkedIn
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: `${CAT_COLOR[j.category]}1f`, color: CAT_COLOR[j.category], border: `1px solid ${CAT_COLOR[j.category]}44`, whiteSpace: "nowrap" }}>
                    {j.category}
                  </span>
                </div>

                {/* title + meta */}
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{j.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${TYPE_COLOR[j.type]}22`, color: TYPE_COLOR[j.type], border: `1px solid ${TYPE_COLOR[j.type]}44`, textTransform: "uppercase" }}>{j.type}</span>
                  {j.rate !== "Rate DOE" && <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{j.rate}</span>}
                  <span style={{ fontSize: 12.5, color: C.muted, display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12}/> {j.location}</span>
                  {j.duration !== "Contract" && <span style={{ fontSize: 12.5, color: C.muted }}>· {j.duration}</span>}
                </div>

                {/* post body */}
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <div style={{
                    fontSize: 13, color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap",
                    maxHeight: long && !bodyOpen ? 128 : "none", overflow: "hidden",
                  }}>{j.body}</div>
                  {long && !bodyOpen && (
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 46, background: `linear-gradient(transparent, ${C.card})`, pointerEvents: "none" }} />
                  )}
                </div>
                {long && (
                  <button onClick={() => toggle(openBody, j.id, setOpenBody)} style={{
                    background: "none", border: "none", color: CAT_COLOR[j.category], cursor: "pointer",
                    fontSize: 12.5, fontWeight: 600, padding: 0, marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 3,
                  }}>{bodyOpen ? <>Show less <ChevronUp size={13}/></> : <>Show more <ChevronDown size={13}/></>}</button>
                )}

                {/* tags */}
                {j.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {j.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--surface-2)", color: C.muted, border: `1px solid ${C.border}` }}>#{t}</span>
                    ))}
                  </div>
                )}

                {/* actions */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <a
                    href={j.applyUrl}
                    target={isMail ? undefined : "_blank"}
                    rel="noreferrer"
                    onClick={() => trackJob(j)}
                    style={{ padding: "8px 16px", borderRadius: 9, background: C.teal, color: "#04201c", fontSize: 12.5, fontWeight: 800, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
                  >{isMail ? <><Mail size={13}/> Contact recruiter</> : <><ExternalLink size={13}/> View on LinkedIn</>}</a>
                  <button
                    onClick={() => trackJob(j)}
                    title="Add to pipeline tracker"
                    style={{
                      padding: "8px 12px", borderRadius: 9, border: `1px solid ${tracked.has(j.id) ? "rgba(34,197,94,.35)" : C.border}`,
                      background: tracked.has(j.id) ? "rgba(34,197,94,.10)" : "transparent",
                      color: tracked.has(j.id) ? "#16a34a" : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}
                  >{tracked.has(j.id) ? <><Check size={13}/> Tracked</> : <><ClipboardList size={13}/> Track</>}</button>
                  <button
                    onClick={() => toggleSaved(j.id)}
                    style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: saved.has(j.id) ? C.amber : C.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}
                  ><Bookmark size={13} fill={saved.has(j.id) ? "currentColor" : "none"}/> {saved.has(j.id) ? "Saved" : "Save"}</button>
                </div>
              </article>
            )
          })}

          {/* Show more */}
          {visible < filtered.length && (
            <button onClick={() => setVisible(v => v + PAGE)} style={{
              margin: "8px auto 0", padding: "11px 24px", borderRadius: 11, cursor: "pointer",
              fontSize: 13, fontWeight: 700, background: C.card, color: C.text, border: `1px solid ${C.border}`,
            }}>Load {Math.min(PAGE, filtered.length - visible)} more posts ({filtered.length - visible} left)</button>
          )}
        </div>
      )}
    </div>
  )
}

// Category chip
function chip(active: boolean, color: string): CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
    // "active" text sits on a bright accent-colored chip in BOTH themes, so it
    // stays a fixed near-black for contrast — only the inactive state is themed.
    background: active ? color : "var(--surface)", color: active ? "#0b1220" : "var(--text-muted)",
    border: `1px solid ${active ? color : "var(--border)"}`, whiteSpace: "nowrap",
  }
}

// Small toggle pill — same var(--accent-*) tokens as the Jobs & Apply hub's
// "Remote only" toggle, so it matches exactly and follows the chosen accent.
function pill(active: boolean): CSSProperties {
  return {
    padding: "6px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600,
    background: active ? "var(--accent-soft)" : "var(--surface)",
    color: active ? "var(--accent-txt)" : "var(--text-muted)",
    border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`, whiteSpace: "nowrap",
  }
}
