"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import PageIntro from "../_components/page-intro"
import { VENDOR_PORTALS } from "@/lib/vendorPortals"

type Filter = "all" | "cyber" | "core" | "portal" | "large"
type Tab = "jobs" | "portals"

type CrawlJob = {
  id: string; portal: string; firm: string; title: string; location: string | null
  work_type: string; engagement: string | null; pay_range: string | null
  posted_at: string | null; url: string; last_seen_at: string
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cyber", label: "Cybersecurity practice" },
  { key: "core", label: "Cyber-only firms" },
  { key: "portal", label: "Direct portal link" },
  { key: "large", label: "Large national" },
]

// ── Smart query parsing ─────────────────────────────────────────────────
// Understands "cyber firms in texas with portals", "large cyber-only firms",
// "boston staffing", etc. Pulls intent words out of the query and leaves the
// rest as keywords.
const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
}

function parseQuery(raw: string): { keywords: string; auto: Filter[] } {
  let q = ` ${raw.toLowerCase()} `
  const auto: Filter[] = []
  const take = (re: RegExp, f: Filter) => {
    if (re.test(q)) { auto.push(f); q = q.replace(re, " ") }
  }
  take(/\b(cyber(\s*-\s*only)?|cybersecurity|infosec|information security|soc)\b/, "cyber")
  // "cyber-only" / "cyber only" narrows further to cyber-core firms
  if (/\bcyber[\s-]*only\b/.test(raw.toLowerCase()) && !auto.includes("core")) {
    auto.push("core")
  }
  take(/\b(portal|portals|direct link|apply online|website)\b/, "portal")
  take(/\b(large|big|national|enterprise)\b/, "large")
  // State names → abbreviation keyword (hq is "City, ST")
  for (const [name, abbr] of Object.entries(STATE_ABBR)) {
    const re = new RegExp(`\\b${name}\\b`)
    if (re.test(q)) q = q.replace(re, ` ${abbr} `)
  }
  // Filler words that carry no search meaning
  q = q.replace(/\b(firms?|companies|company|vendors?|portals?|with|in|near|that|have|has|for|the|a|an|and|or)\b/g, " ")
  const keywords = q.replace(/\s+/g, " ").trim()
  return { keywords, auto: [...new Set(auto)] }
}

function WorkBadge({ workType }: { workType: string }) {
  const label = workType === "contract" ? "Contract" : workType === "permanent" ? "Permanent" : "Type n/a"
  const style: React.CSSProperties =
    workType === "contract"
      ? { background: "var(--accent)", color: "var(--bg)", border: "1px solid var(--accent)" }
      : { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, ...style }}>
      {label.toUpperCase()}
    </span>
  )
}

function JobsResults({ query }: { query: string }) {
  const [jobs, setJobs] = useState<CrawlJob[]>([])
  const [state, setState] = useState<"loading" | "ready" | "unconfigured">("loading")
  const [contractOnly, setContractOnly] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    setState("loading")
    timer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          work_type: contractOnly ? "contract" : "all",
          limit: "30",
        })
        const res = await fetch(`/api/crawl/jobs?${params}`)
        const data = await res.json()
        if (!data.ok && data.reason === "crawl store not configured") {
          setState("unconfigured")
          return
        }
        setJobs(data.jobs ?? [])
        setState("ready")
      } catch {
        setJobs([])
        setState("ready")
      }
    }, 400)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query, contractOnly])

  return (
    <div id="jobs">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} role="group" aria-label="Job type">
        <button
          type="button"
          onClick={() => setContractOnly(v => !v)}
          aria-pressed={contractOnly}
          style={{
            minHeight: 36, padding: "0 14px", fontSize: 13.5, fontWeight: 600, borderRadius: 999,
            border: "1px solid var(--border)",
            background: contractOnly ? "var(--accent)" : "var(--surface)",
            color: contractOnly ? "var(--bg)" : "var(--text)",
            cursor: "pointer",
          }}
        >
          Contract only
        </button>
        <span style={{ fontSize: 13, color: "var(--text-muted)", alignSelf: "center" }}>
          W2 · C2C · 1099 · C2H — the portal only carries contract work
        </span>
      </div>

      {state === "loading" && (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }} role="status">Searching crawled listings…</p>
      )}

      {state === "unconfigured" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", padding: "18px 20px", marginBottom: 8 }}>
          <p style={{ fontSize: 14.5, color: "var(--text)", margin: "0 0 6px", fontWeight: 600 }}>
            The job crawler hasn't run its first pass yet.
          </p>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
            Once it does, this tab searches live contract listings spidered from every prime vendor portal.
            The portal directory below is live right now.
          </p>
        </div>
      )}

      {state === "ready" && jobs.length === 0 && (
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
          No {contractOnly ? "contract " : ""}jobs match “{query.trim()}” in the latest crawl. The crawler refreshes
          daily — try the portal directory below for more.
        </p>
      )}

      {state === "ready" && jobs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {jobs.map(j => (
            <article
              key={j.id}
              style={{
                border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)",
                padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.35 }}>
                  {j.title}
                </h2>
                <WorkBadge workType={j.work_type} />
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                {j.firm}{j.location ? ` · ${j.location}` : ""}
              </p>
              {(j.pay_range || j.posted_at) && (
                <p style={{ fontSize: 12.5, color: "var(--text-soft)", margin: 0 }}>
                  {[j.pay_range, j.posted_at ? `Posted ${j.posted_at}` : ""].filter(Boolean).join(" · ")}
                </p>
              )}
              <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", gap: 14, alignItems: "center" }}>
                <a
                  href={j.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}
                >
                  Apply <span aria-hidden="true">→</span>
                </a>
                <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                  via {j.firm}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ApplyPage() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [tab, setTab] = useState<Tab>("jobs")

  const { results, autoFilters } = useMemo(() => {
    const { keywords, auto } = parseQuery(query)
    const active: Filter[] = [...new Set([filter, ...auto])]
    const hits = VENDOR_PORTALS.filter(v => {
      for (const f of active) {
        if (f === "cyber" && !v.cyber) return false
        if (f === "core" && !v.cyberCore) return false
        if (f === "portal" && !v.url) return false
        if (f === "large" && v.size !== "Large national") return false
      }
      if (!keywords) return true
      return keywords.split(" ").every(kw =>
        [v.firm, v.hq, v.specialties, v.size, v.notes].join(" ").toLowerCase().includes(kw)
      )
    })
    return { results: hits, autoFilters: auto.filter(a => a !== filter) }
  }, [query, filter])

  const cyberCount = VENDOR_PORTALS.filter(v => v.cyber).length
  const portalCount = VENDOR_PORTALS.filter(v => v.url).length

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 64px" }}>
      <PageIntro
        page="/dashboard/apply"
        action={{ label: "Browse portals", href: "#portals" }}
      />

      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px", maxWidth: 680, lineHeight: 1.6 }}>
        {VENDOR_PORTALS.length} prime vendor portals · {portalCount} with direct links · {cyberCount} with a
        cybersecurity practice. The Jobs tab searches contract listings the crawler spidered from those portals —
        refreshed daily. Before you say yes to any submission, check it against your tracker — two filings on one
        req is a disqualification.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }} role="tablist" aria-label="Apply views">
        {(["jobs", "portals"] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              minHeight: 38, padding: "0 18px", fontSize: 14, fontWeight: 600, borderRadius: 999,
              border: "1px solid var(--border)",
              background: tab === t ? "var(--accent)" : "var(--surface)",
              color: tab === t ? "var(--bg)" : "var(--text)",
              cursor: "pointer",
            }}
          >
            {t === "jobs" ? "Jobs" : "Portals"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          id="apply-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={tab === "jobs" ? "Try “security engineer” or “developer”… " : "Try “cyber firms in Texas with portals”…"}
          aria-label={tab === "jobs" ? "Search crawled jobs" : "Search vendor portals"}
          style={{
            flex: "1 1 260px", minHeight: 44, padding: "0 16px", fontSize: 15,
            borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text)",
          }}
        />
      </div>

      {tab === "jobs" ? (
        <JobsResults query={query} />
      ) : (
        <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }} role="group" aria-label="Filter portals">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            style={{
              minHeight: 36, padding: "0 14px", fontSize: 13.5, fontWeight: 600, borderRadius: 999,
              border: "1px solid var(--border)",
              background: filter === f.key ? "var(--accent)" : "var(--surface)",
              color: filter === f.key ? "var(--bg)" : "var(--text)",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {autoFilters.length > 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
          Showing {autoFilters.map(a => FILTERS.find(f => f.key === a)?.label).join(" · ").toLowerCase()} —
          from your search.
        </p>
      )}

      <div id="portals" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {results.map(v => (
          <article
            key={v.firm}
            style={{
              border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)",
              padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "var(--text)", margin: 0 }}>{v.firm}</h2>
              {v.cyberCore && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--accent)", color: "var(--bg)" }}>
                  CYBER-ONLY
                </span>
              )}
              {v.cyber && !v.cyberCore && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  CYBER
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              {v.hq}{v.hq && v.size ? " · " : ""}{v.size}
            </p>
            <p style={{ fontSize: 13.5, color: "var(--text)", margin: 0, lineHeight: 1.5 }}>{v.specialties}</p>
            {v.notes && (
              <p style={{ fontSize: 12.5, color: "var(--text-soft)", margin: 0, lineHeight: 1.5 }}>{v.notes}</p>
            )}
            <div style={{ marginTop: "auto", paddingTop: 10 }}>
              {v.url ? (
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}
                >
                  Open portal <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-soft)" }}>
                  No direct portal link — search “careers” on their site
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      {results.length === 0 && (
        <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 32 }}>
          No portals match “{query}”. Try a different search.
        </p>
      )}
        </>
      )}
    </div>
  )
}
