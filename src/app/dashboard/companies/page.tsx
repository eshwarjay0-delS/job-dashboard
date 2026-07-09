"use client"

/**
 * Company Intelligence — MarketFit's answer to MigrateMate & LinkedIn Company pages.
 * Aggregates H1B sponsorship status, live job counts, rate ranges, and category
 * distribution for every company in the Contract + Full-Time boards.
 *
 * Data: CONTRACT_JOBS (1 021 static postings) + getH1BScore (DOL LCA pattern matching)
 * Note: Full-Time board uses live API data; only contract data is available here.
 */

import { useState, useMemo } from "react"
import Link from "next/link"
import { CONTRACT_JOBS, type ContractJobRec } from "../contracts/contractData"
import { getH1BScore, type H1BResult } from "@/lib/h1b"
import PageHeader from "@/components/layout/PageHeader"
import { Building2, Search, X, Check, TriangleAlert, HelpCircle, BarChart3, DollarSign, ArrowDownAZ } from "lucide-react"

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  card:   "var(--surface)",
  border: "var(--border)",
  text:   "var(--text)",
  muted:  "var(--text-muted)",
  hint:   "var(--text-soft)",
  teal:   "#14b8a6",
  indigo: "#6366f1",
  green:  "#22c55e",
  amber:  "#f59e0b",
  red:    "#f87171",
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseRate(rate: string): number {
  const m = rate.match(/\$?([\d,]+)/)
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0
}

function mix(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

const AVATAR_PALETTE = [
  "#1d6fc4", "#7c3aed", "#059669", "#d97706",
  "#e11d48", "#0d9488", "#dc2626", "#6366f1",
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

// ── Company aggregation ───────────────────────────────────────────────────────
interface CompanyStats {
  name: string
  jobCount: number
  w2Count: number
  c2cCount: number
  rateMin: number
  rateMax: number
  rateAvg: number
  categories: Set<string>
  topTags: string[]
  contacts: string[]
  h1b: H1BResult
  recentPost: string   // most recent "posted" field
}

function buildCompanyStats(): CompanyStats[] {
  const map = new Map<string, {
    jobs: ContractJobRec[]
    rates: number[]
    cats: Set<string>
    tags: Map<string, number>
    contacts: Set<string>
  }>()

  for (const j of CONTRACT_JOBS) {
    const key = j.company.trim()
    if (!map.has(key)) map.set(key, { jobs: [], rates: [], cats: new Set(), tags: new Map(), contacts: new Set() })
    const entry = map.get(key)!
    entry.jobs.push(j)
    const r = parseRate(j.rate)
    if (r > 0) entry.rates.push(r)
    if (j.category) entry.cats.add(j.category)
    for (const t of j.tags ?? []) entry.tags.set(t, (entry.tags.get(t) ?? 0) + 1)
    if (j.contact && j.contact.includes("@")) entry.contacts.add(j.contact)
  }

  return [...map.entries()]
    .map(([name, e]) => {
      const rates = e.rates.sort((a, b) => a - b)
      // Sort jobs by posted time (newest first)
      const sortedJobs = [...e.jobs].sort((a, b) => {
        const toMs = (p: string) => {
          const m = p.match(/^(\d+)\s*([hdwm])/i)
          if (!m) return 0
          const n = parseInt(m[1])
          const mult = ({ h: 3600000, d: 86400000, w: 604800000, m: 2592000000 } as Record<string, number>)[m[2].toLowerCase()] ?? 86400000
          return mult * n
        }
        return toMs(a.posted) - toMs(b.posted) // lower = more recent
      })
      return {
        name,
        jobCount: e.jobs.length,
        w2Count: e.jobs.filter(j => j.type === "W2" || j.type === "Both").length,
        c2cCount: e.jobs.filter(j => j.type === "C2C" || j.type === "Both").length,
        rateMin: rates[0] ?? 0,
        rateMax: rates[rates.length - 1] ?? 0,
        rateAvg: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0,
        categories: e.cats,
        topTags: [...e.tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t),
        contacts: [...e.contacts].slice(0, 3),
        h1b: getH1BScore(name),
        recentPost: sortedJobs[0]?.posted ?? "",
      }
    })
    .sort((a, b) => b.jobCount - a.jobCount)
}

const ALL_COMPANIES = buildCompanyStats()

// ── Company card ──────────────────────────────────────────────────────────────
function CompanyCard({ c, onClick }: { c: CompanyStats; onClick: () => void }) {
  const initials = c.name.split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const bg = avatarColor(c.name)
  const h1bLabel = c.h1b.status === "likely" ? "H1B Likely" : c.h1b.status === "possible" ? "H1B Possible" : "H1B Unknown"

  return (
    <article
      onClick={onClick}
      style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: "16px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s",
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = mix(C.teal, 60)
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${mix(C.teal, 8)}`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = C.border
        ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
      }}
    >
      {/* header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${bg}, ${bg}99)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 15, userSelect: "none",
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 3 }}>{c.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* H1B badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: c.h1b.bg, color: c.h1b.color, border: `1px solid ${c.h1b.border}`,
              textTransform: "uppercase", letterSpacing: ".03em",
            }}>{h1bLabel}</span>
            {/* Job count */}
            <span style={{ fontSize: 11.5, color: C.muted }}>
              {c.jobCount} {c.jobCount === 1 ? "posting" : "postings"}
            </span>
          </div>
        </div>
        {/* Job count circle */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: mix(C.indigo, 12), border: `1.5px solid ${mix(C.indigo, 30)}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.indigo, lineHeight: 1 }}>{c.jobCount}</span>
          <span style={{ fontSize: 8, color: C.muted, lineHeight: 1.2 }}>jobs</span>
        </div>
      </div>

      {/* rate + type row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        {c.rateAvg > 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>
            {c.rateMin === c.rateMax ? `$${c.rateAvg}/hr` : `$${c.rateMin}–$${c.rateMax}/hr`}
          </span>
        )}
        {c.w2Count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "rgba(96,165,250,.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,.3)" }}>
            W2 ×{c.w2Count}
          </span>
        )}
        {c.c2cCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "rgba(147,197,253,.12)", color: "#93c5fd", border: "1px solid rgba(147,197,253,.3)" }}>
            C2C ×{c.c2cCount}
          </span>
        )}
        {[...c.categories].slice(0, 2).map(cat => (
          <span key={cat} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "var(--surface-2,rgba(255,255,255,.05))", color: C.muted, border: `1px solid ${C.border}` }}>
            {cat}
          </span>
        ))}
      </div>

      {/* top tags */}
      {c.topTags.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {c.topTags.slice(0, 5).map(tag => (
            <span key={tag} style={{ fontSize: 10.5, color: C.hint, padding: "1px 6px", borderRadius: 4, background: mix(C.indigo, 6), border: `1px solid ${mix(C.indigo, 15)}` }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
function CompanyDrawer({ c, onClose }: { c: CompanyStats | null; onClose: () => void }) {
  if (!c) return null
  const initials = c.name.split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const bg = avatarColor(c.name)
  const relatedJobs = CONTRACT_JOBS.filter(j => j.company === c.name).slice(0, 8)

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 300, backdropFilter: "blur(2px)",
      }} />
      {/* panel */}
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: "min(520px, 95vw)",
        background: "var(--bg)", borderLeft: `1px solid ${C.border}`,
        zIndex: 400, overflowY: "auto", padding: "28px 24px",
      }}>
        {/* close */}
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 16, background: "none", border: "none",
          fontSize: 22, cursor: "pointer", color: C.muted, lineHeight: 1,
        }}>✕</button>

        {/* avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg, ${bg}, ${bg}88)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 20,
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{c.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{c.jobCount} active {c.jobCount === 1 ? "posting" : "postings"}</div>
          </div>
        </div>

        {/* H1B status card */}
        <div style={{ background: c.h1b.bg, border: `1px solid ${c.h1b.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: c.h1b.color, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>
            {c.h1b.label}
          </div>
          <div style={{ fontSize: 13, color: c.h1b.color, opacity: .85, lineHeight: 1.5 }}>{c.h1b.reason}</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { label: "Postings", val: c.jobCount, sub: "contract" },
            { label: "W2 roles", val: c.w2Count, sub: "available" },
            { label: "C2C roles", val: c.c2cCount, sub: "available" },
          ].map(({ label, val, sub }) => (
            <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{val}</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{label}</div>
              <div style={{ fontSize: 9.5, color: C.hint }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Rate range */}
        {c.rateAvg > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Rate Range</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: C.teal }}>${c.rateAvg}<span style={{ fontSize: 14, fontWeight: 600 }}>/hr</span></span>
              <span style={{ fontSize: 12, color: C.muted }}>avg</span>
              {c.rateMin !== c.rateMax && (
                <span style={{ fontSize: 12, color: C.hint, marginLeft: "auto" }}>${c.rateMin} – ${c.rateMax}/hr range</span>
              )}
            </div>
            {/* simple rate bar */}
            {c.rateMin !== c.rateMax && (
              <div style={{ marginTop: 10, height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden", position: "relative" }}>
                <div style={{
                  position: "absolute", left: `${((c.rateAvg - c.rateMin) / (c.rateMax - c.rateMin || 1)) * 80}%`,
                  top: 0, bottom: 0, width: "20%", background: C.teal, borderRadius: 4,
                }} />
              </div>
            )}
          </div>
        )}

        {/* Categories */}
        {c.categories.size > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Hires For</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[...c.categories].map(cat => (
                <span key={cat} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: mix(C.indigo, 10), color: C.indigo, border: `1px solid ${mix(C.indigo, 25)}`, fontWeight: 600 }}>
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top skills */}
        {c.topTags.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Top Skills Required</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.topTags.map(tag => (
                <span key={tag} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 6, background: "var(--surface-2,rgba(99,102,241,.07))", color: C.hint, border: `1px solid ${C.border}` }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {c.contacts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Recruiter Contact</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {c.contacts.map(email => (
                <a key={email} href={`mailto:${email}`} style={{
                  fontSize: 13, color: C.teal, textDecoration: "none", fontWeight: 600,
                  padding: "6px 12px", borderRadius: 8, background: mix(C.teal, 8),
                  border: `1px solid ${mix(C.teal, 25)}`, display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  ✉ {email}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Active postings */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Active Postings</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {relatedJobs.map(j => (
              <div key={j.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{j.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: C.teal, fontWeight: 700 }}>{j.rate}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{j.type}</span>
                  <span style={{ fontSize: 10, color: C.hint }}>·</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{j.location}</span>
                  <a href={j.applyUrl} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#fff", padding: "3px 10px", borderRadius: 6, background: C.teal, textDecoration: "none" }}>
                    Apply
                  </a>
                </div>
              </div>
            ))}
          </div>
          {c.jobCount > 8 && (
            <Link href={`/dashboard/contracts?company=${encodeURIComponent(c.name)}`} style={{
              display: "block", marginTop: 10, fontSize: 12.5, color: C.indigo, fontWeight: 700,
              textAlign: "center", textDecoration: "none",
            }}>
              View all {c.jobCount} postings →
            </Link>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompaniesPage() {
  const [search, setSearch] = useState("")
  const [h1bFilter, setH1bFilter] = useState<"all" | "likely" | "possible" | "unknown">("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "W2" | "C2C">("all")
  const [rateFilter, setRateFilter] = useState(0)
  const [sortBy, setSortBy] = useState<"jobs" | "rate" | "name">("jobs")
  const [selected, setSelected] = useState<CompanyStats | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = ALL_COMPANIES.filter(c => {
      if (q && !c.name.toLowerCase().includes(q)) return false
      if (h1bFilter !== "all" && c.h1b.status !== h1bFilter) return false
      if (typeFilter === "W2" && c.w2Count === 0) return false
      if (typeFilter === "C2C" && c.c2cCount === 0) return false
      if (rateFilter > 0 && c.rateAvg > 0 && c.rateAvg < rateFilter) return false
      return true
    })
    if (sortBy === "jobs")  list = [...list].sort((a, b) => b.jobCount - a.jobCount)
    if (sortBy === "rate")  list = [...list].sort((a, b) => b.rateAvg - a.rateAvg)
    if (sortBy === "name")  list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [search, h1bFilter, typeFilter, rateFilter, sortBy])

  const totalJobs = ALL_COMPANIES.reduce((s, c) => s + c.jobCount, 0)
  const likelyCount = ALL_COMPANIES.filter(c => c.h1b.status === "likely").length
  const avgRate = Math.round(
    ALL_COMPANIES.filter(c => c.rateAvg > 0).reduce((s, c) => s + c.rateAvg, 0) /
    (ALL_COMPANIES.filter(c => c.rateAvg > 0).length || 1)
  )

  const hasActive = h1bFilter !== "all" || typeFilter !== "all" || rateFilter > 0

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {selected && <CompanyDrawer c={selected} onClose={() => setSelected(null)} />}

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          icon={<Building2 size={18}/>}
          title="Company Intelligence"
          badge={
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(99,102,241,.12)", color: C.indigo, border: "1px solid rgba(99,102,241,.3)" }}>
              {ALL_COMPANIES.length} companies
            </span>
          }
          description="H1B sponsorship data, recruiter contacts, and live job counts — all in one place."
        />

        {/* Stat bar */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { label: "Total postings", val: totalJobs, color: C.indigo },
            { label: "H1B Likely sponsors", val: likelyCount, color: "#22c55e" },
            { label: "Companies tracked", val: ALL_COMPANIES.length, color: C.teal },
            { label: "Avg contract rate", val: `$${avgRate}/hr`, color: C.amber },
          ].map(({ label, val, color }) => (
            <div key={label} style={{
              flex: 1, minWidth: 130, background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "12px 14px", borderTop: `3px solid ${color}`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{val}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sticky filters ───────────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", paddingBottom: 12, marginBottom: 8 }}>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.hint }}/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${ALL_COMPANIES.length} companies by name…`}
            style={{
              width: "100%", padding: "11px 14px 11px 36px", borderRadius: 11, fontSize: 14,
              background: C.card, border: `1px solid ${C.border}`, color: C.text, outline: "none", boxSizing: "border-box",
            }}
          />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex" }}><X size={15}/></button>}
        </div>

        {/* Filter row */}
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {/* H1B status */}
          {(["all", "likely", "possible", "unknown"] as const).map(s => {
            const labels = { all: "All H1B", likely: "Likely", possible: "Possible", unknown: "Unknown" }
            const icons: Partial<Record<string, typeof Check>> = { likely: Check, possible: TriangleAlert, unknown: HelpCircle }
            const colors: Record<string, string> = { likely: "#22c55e", possible: C.amber, unknown: C.muted, all: C.indigo }
            const active = h1bFilter === s
            const FilterIcon = icons[s]
            return (
              <button key={s} onClick={() => setH1bFilter(s)} style={{
                padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600, border: "1px solid",
                background: active ? `${colors[s]}18` : C.card,
                color: active ? colors[s] : C.muted,
                borderColor: active ? `${colors[s]}55` : C.border,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>{FilterIcon && <FilterIcon size={11}/>} {labels[s]}</button>
            )
          })}
          <span style={{ width: 1, height: 18, background: C.border, margin: "0 2px" }} />
          {/* Type */}
          {(["all", "W2", "C2C"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: typeFilter === t ? mix(C.teal, 15) : C.card, color: typeFilter === t ? C.teal : C.muted,
              border: `1px solid ${typeFilter === t ? mix(C.teal, 40) : C.border}`,
            }}>{t === "all" ? "All types" : t}</button>
          ))}
          <span style={{ width: 1, height: 18, background: C.border, margin: "0 2px" }} />
          {/* Rate */}
          {([0, 60, 80, 100] as const).map(r => (
            <button key={r} onClick={() => setRateFilter(r)} style={{
              padding: "5px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
              background: rateFilter === r ? "rgba(251,191,36,.15)" : C.card, color: rateFilter === r ? C.amber : C.muted,
              border: `1px solid ${rateFilter === r ? "rgba(251,191,36,.4)" : C.border}`,
            }}>{r === 0 ? "Any rate" : `$${r}+/hr`}</button>
          ))}
          {/* Sort */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 3, padding: 3, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            {([
              { key: "jobs" as const, Icon: BarChart3, label: "Jobs" },
              { key: "rate" as const, Icon: DollarSign, label: "Rate" },
              { key: "name" as const, Icon: ArrowDownAZ, label: "A–Z" },
            ]).map(({ key, Icon, label }) => (
              <button key={key} onClick={() => setSortBy(key)} style={{
                padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
                background: sortBy === key ? C.teal : "transparent",
                color: sortBy === key ? "#04201c" : C.muted,
              }}><Icon size={11}/> {label}</button>
            ))}
          </div>
        </div>

        {/* Active filters count */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, minHeight: 22 }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            {filtered.length} of {ALL_COMPANIES.length} companies
          </span>
          {hasActive && (
            <button onClick={() => { setH1bFilter("all"); setTypeFilter("all"); setRateFilter(0) }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 700 }}>
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, color: C.muted }}>
          No companies match your filters. Try broadening your search.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filtered.map(c => (
            <CompanyCard key={c.name} c={c} onClick={() => setSelected(c)} />
          ))}
        </div>
      )}
    </div>
  )
}
