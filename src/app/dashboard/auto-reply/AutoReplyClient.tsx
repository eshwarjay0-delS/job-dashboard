"use client"

// Read-only triage board for the auto-reply recruiter-selection algorithm.
//
// Two endpoints, and only two:
//   GET  /api/auto-reply/jobs  — settings + lastRun + counts + jobs
//   POST /api/auto-reply/tick  — kick a scan now (can take ~30s)
//
// The centrepiece is the candidate table per job. On these bench-sales threads
// a freemail address is almost always a COMPETING JOB CANDIDATE who happens to
// be CC'd on the same blast, so it is rendered as an explicit danger — the one
// thing the algorithm must never do is put the user's resume in front of them.

import { useState, useEffect, useMemo, useCallback } from "react"

// ── API shapes ────────────────────────────────────────────────────────────────

type JobState =
  | "discovered" | "jd_extracted" | "recruiter_resolved" | "tailoring" | "tailored"
  | "awaiting_approval" | "needs_human" | "skipped" | "rejected" | "cancelled"

type CandidateClass = "corporate" | "freemail" | "middleman" | "self"

interface Candidate {
  address: string
  field: string               // "to" | "cc" (kept loose — server owns the vocabulary)
  klass: CandidateClass
  selected: boolean
  reason: string | null
}

interface Job {
  id: string
  state: JobState
  threadId: string
  subject: string
  middlemanEmail: string
  middlemanName: string
  roleTitle: string
  jdLocation: string
  jdRemote: boolean
  jdSkills: string[]
  jdExcerpt: string
  threadTo: string[]
  threadCc: string[]
  recruiterTo: string[]
  recruiterCc: string[]
  recruiterSource: string
  recruiterRationale: string
  recruiterCandidates: Candidate[]
  skipReason: string | null
  lastError: string | null
  haltCode: string | null
  updatedAt: string
  // M3 tailoring. The file URLs authenticate by TOKEN only — treat them as
  // capability links and never log or share them.
  tailorFilename: string | null
  tailorScore: number | null
  tailoredAt: string | null
  resumeDownloadUrl: string | null
  resumePreviewUrl: string | null
}

interface Settings {
  enabled: boolean
  autonomy: string
  dryRun: boolean
  killSwitch: boolean
  senderAllowlist: string[]
}

interface LastRun {
  id: string
  startedAt: string
  finishedAt: string | null
  discovered: number
  advanced: number
  failed: number
  halted: boolean
  haltReason: string | null
  ageMinutes: number
  tailored?: number
  /** The loop's fail-loud channel — e.g. the R2 durability warning. */
  tailorNote?: string | null
}

interface Counts {
  needsHuman: number; resolved: number; tailored: number; skipped: number; total: number
  /** Rows actually returned in this page, vs `total` across all rows. */
  shown?: number
  truncated?: boolean
}

interface JobsResponse {
  ok: boolean
  settings?: Settings | null
  lastRun?: LastRun | null
  counts?: Counts | null
  jobs?: Job[] | null
  nextCursor?: string | null
  error?: string
}

// ── State vocabulary ──────────────────────────────────────────────────────────

const STATE_META: Record<JobState, { label: string; color: string }> = {
  discovered:         { label: "Discovered",     color: "var(--text-soft)" },
  jd_extracted:       { label: "JD extracted",   color: "#0891b2" },
  recruiter_resolved: { label: "Resolved",       color: "#059669" },
  tailoring:          { label: "Tailoring…",     color: "#0891b2" },
  tailored:           { label: "Ready to send",  color: "#059669" },
  awaiting_approval:  { label: "Awaiting you",   color: "#d97706" },
  needs_human:        { label: "Needs you",      color: "#d97706" },
  skipped:            { label: "Skipped",        color: "var(--text-soft)" },
  rejected:           { label: "Rejected",       color: "#dc2626" },
  cancelled:          { label: "Cancelled",      color: "var(--text-soft)" },
}

const CLASS_META: Record<CandidateClass, { label: string; color: string; bg: string; note: string }> = {
  corporate:  { label: "Corporate", color: "#059669", bg: "rgba(5,150,105,.10)",  note: "Company domain — a real recruiter address." },
  freemail:   { label: "Freemail",  color: "#dc2626", bg: "rgba(220,38,38,.12)",  note: "Personal inbox on this thread — almost certainly a competing job candidate. Never send here." },
  middleman:  { label: "Middleman", color: "var(--text-soft)", bg: "rgba(148,163,184,.10)", note: "The bench-sales contact the thread came from." },
  self:       { label: "You",       color: "var(--text-soft)", bg: "rgba(148,163,184,.10)", note: "Your own address." },
}

const NEEDS_YOU: JobState[] = ["needs_human", "awaiting_approval"]
const READY:     JobState[] = ["tailored"]
const RESOLVED:  JobState[] = ["recruiter_resolved", "tailoring"]
const DROPPED:   JobState[] = ["skipped", "rejected", "cancelled"]

type FilterKey = "all" | "needs" | "ready" | "resolved" | "skipped"

// ── Helpers ───────────────────────────────────────────────────────────────────

function ageColor(mins: number): string {
  if (mins > 180) return "#dc2626"
  if (mins > 45) return "#d97706"
  return "#059669"
}

function ageLabel(mins: number): string {
  if (!Number.isFinite(mins) || mins < 0) return "unknown"
  if (mins < 1) return "just now"
  if (mins < 60) return `${Math.round(mins)}m ago`
  const h = mins / 60
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)}h ago`
  return `${Math.round(h / 24)}d ago`
}

function classOf(k: string): CandidateClass {
  return (k in CLASS_META ? k : "corporate") as CandidateClass
}

function stateOf(s: string): JobState {
  return (s in STATE_META ? s : "discovered") as JobState
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutoReplyClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<JobsResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [runNote, setRunNote] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [openJobs, setOpenJobs] = useState<Record<string, boolean>>({})
  const [openJd, setOpenJd] = useState<Record<string, boolean>>({})

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    try {
      const res = await fetch("/api/auto-reply/jobs", { cache: "no-store" })
      const body = (await res.json().catch(() => null)) as JobsResponse | null
      if (!res.ok || !body || body.ok === false) {
        setError(body?.error || `Could not load the board (HTTP ${res.status}).`)
      } else {
        setData(body)
        setError(null)
      }
    } catch {
      setError("Network error — could not reach /api/auto-reply/jobs.")
    } finally {
      setLoading(false)
    }
  }, [])

  // `loading` already starts true, so the mount fetch runs quiet — no synchronous
  // setState in the effect body, no cascading first render.
  useEffect(() => { void load({ quiet: true }) }, [load])

  async function runNow() {
    setRunning(true)
    setRunNote(null)
    try {
      const res = await fetch("/api/auto-reply/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = await res.json().catch(() => null) as
        | { halted?: boolean; halt_reason?: string; error?: string; discovered?: number; advanced?: number; tailored?: number; tailor_note?: string }
        | null
      if (res.status === 409)      setRunNote("A scan is already running — showing the latest state.")
      else if (res.status === 423) setRunNote("The loop is disabled or the kill switch is on. Nothing ran.")
      else if (!res.ok)            setRunNote(payload?.error ? `Scan failed: ${payload.error}` : `Scan failed (HTTP ${res.status}).`)
      else if (payload?.halted)    setRunNote(`Scan HALTED: ${payload.halt_reason ?? "unknown"}${payload.error ? ` — ${payload.error}` : ""}`)
      else {
        const bits = [
          `${payload?.discovered ?? 0} found`,
          `${payload?.advanced ?? 0} advanced`,
          `${payload?.tailored ?? 0} tailored`,
        ]
        setRunNote(`Scan finished — ${bits.join(" · ")}.${payload?.tailor_note ? ` Note: ${payload.tailor_note}` : ""}`)
      }
    } catch {
      setRunNote("Scan failed — network error.")
    } finally {
      setRunning(false)
      await load({ quiet: true })
    }
  }

  const jobs = useMemo(() => data?.jobs ?? [], [data])
  const settings = data?.settings ?? null
  const lastRun = data?.lastRun ?? null
  const counts = data?.counts ?? null

  // needs_human / awaiting_approval float to the top; then newest first.
  const sorted = useMemo(() => {
    const rank = (j: Job) =>
      NEEDS_YOU.includes(stateOf(j.state)) ? 0 : READY.includes(stateOf(j.state)) ? 1 : 2
    return [...jobs].sort((a, b) => {
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    })
  }, [jobs])

  const chipCounts = useMemo(() => ({
    all: jobs.length,
    needs:    jobs.filter(j => NEEDS_YOU.includes(stateOf(j.state))).length,
    ready:    jobs.filter(j => READY.includes(stateOf(j.state))).length,
    resolved: jobs.filter(j => RESOLVED.includes(stateOf(j.state))).length,
    skipped:  jobs.filter(j => DROPPED.includes(stateOf(j.state))).length,
  }), [jobs])

  const rows = useMemo(() => sorted.filter(j => {
    const s = stateOf(j.state)
    if (filter === "needs")    return NEEDS_YOU.includes(s)
    if (filter === "ready")    return READY.includes(s)
    if (filter === "resolved") return RESOLVED.includes(s)
    if (filter === "skipped")  return DROPPED.includes(s)
    return true
  }), [sorted, filter])

  const freemailSeen = useMemo(
    () => jobs.reduce((n, j) => n + (j.recruiterCandidates ?? []).filter(c => classOf(c.klass) === "freemail").length, 0),
    [jobs],
  )

  return (
    <div>
      {/* ── Status strip ───────────────────────────────────────────────── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "14px 16px", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        {/* Read-only badge — the single most load-bearing thing on this page */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 800,
          letterSpacing: ".02em", whiteSpace: "nowrap",
          background: "rgba(148,163,184,.14)", color: "var(--text-muted)",
          border: "1px dashed var(--border)",
        }}>
          🔒 READ-ONLY — this milestone cannot send email
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ fontWeight: 700, color: "var(--text-soft)" }}>Last scan</span>
          {lastRun ? (
            <span style={{ fontWeight: 800, color: ageColor(lastRun.ageMinutes) }}>
              {ageLabel(lastRun.ageMinutes)}
            </span>
          ) : (
            <span style={{ fontWeight: 700, color: "var(--text-soft)" }}>never</span>
          )}
          {lastRun && (
            <span style={{ color: "var(--text-soft)" }}>
              · {lastRun.discovered} found · {lastRun.advanced} advanced
              {typeof lastRun.tailored === "number" ? ` · ${lastRun.tailored} tailored` : ""}
              {lastRun.failed > 0 ? ` · ${lastRun.failed} failed` : ""}
            </span>
          )}
        </div>

        {lastRun?.halted && (
          <span style={{
            padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700,
            background: "rgba(220,38,38,.10)", color: "#dc2626", border: "1px solid rgba(220,38,38,.25)",
          }}>
            ⛔ Halted{lastRun.haltReason ? ` — ${lastRun.haltReason}` : ""}
          </span>
        )}

        {/* The loop's fail-loud channel. Previously written to the run row and
            read by nothing, which made a silent-data-loss mode look healthy. */}
        {lastRun?.tailorNote && (
          <div style={{
            flexBasis: "100%", marginTop: 8, padding: "8px 12px", borderRadius: 8,
            fontSize: 12, lineHeight: 1.6,
            background: lastRun.tailorNote.startsWith("WARNING") ? "rgba(217,119,6,.10)" : "var(--surface-2)",
            color: lastRun.tailorNote.startsWith("WARNING") ? "#b45309" : "var(--text-soft)",
            border: `1px solid ${lastRun.tailorNote.startsWith("WARNING") ? "rgba(217,119,6,.30)" : "var(--border)"}`,
          }}>
            {lastRun.tailorNote.startsWith("WARNING") ? "⚠ " : "· "}{lastRun.tailorNote}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Needs you", value: counts?.needsHuman ?? chipCounts.needs,    color: "#d97706" },
            { label: "Ready",     value: counts?.tailored   ?? chipCounts.ready,    color: "#059669" },
            { label: "Resolved",  value: counts?.resolved  ?? chipCounts.resolved,  color: "#0891b2" },
            { label: "Skipped",   value: counts?.skipped   ?? chipCounts.skipped,   color: "var(--text-soft)" },
            { label: "Total",     value: counts?.total     ?? chipCounts.all,       color: "var(--text)" },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 9, padding: "5px 12px", textAlign: "center", minWidth: 62,
            }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => load()} style={ghostBtn} disabled={loading || running}>⟳ Refresh</button>
          <button onClick={runNow} style={{ ...accentBtn, opacity: running ? .7 : 1 }} disabled={running}>
            {running ? <><Spinner /> Scanning…</> : "▶ Run now"}
          </button>
        </div>
      </div>

      {/* ── Settings line ──────────────────────────────────────────────── */}
      {settings && (
        <div style={{
          display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 12,
          fontSize: 11.5, color: "var(--text-muted)",
        }}>
          <span style={pill(settings.enabled ? "#059669" : "var(--text-soft)")}>
            {settings.enabled ? "Loop enabled" : "Loop disabled"}
          </span>
          <span style={pill("var(--text-soft)")}>Autonomy: {settings.autonomy}</span>
          <span style={pill(settings.dryRun ? "#0891b2" : "#d97706")}>
            {settings.dryRun ? "Dry run" : "Live mode"}
          </span>
          {settings.killSwitch && <span style={pill("#dc2626")}>⛔ Kill switch ON</span>}
          <span style={{ color: "var(--text-soft)" }}>
            Allowlist: {(settings.senderAllowlist ?? []).join(", ") || "—"}
          </span>
        </div>
      )}

      {counts?.truncated && (
        <div style={{
          margin: "0 0 10px", padding: "7px 12px", borderRadius: 8, fontSize: 12,
          background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-soft)",
        }}>
          Showing the {counts.shown ?? 0} most recently updated of {counts.total} jobs. The tiles above count all of
          them; the list below does not — oldest-untouched jobs, i.e. the actual backlog, fall off this page.
        </div>
      )}

      {runNote && (
        <div style={{
          background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10,
          padding: "9px 13px", marginBottom: 12, fontSize: 12.5, color: "var(--text-muted)",
        }}>{runNote}</div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => setFilter("all")}      style={chip(filter === "all")}>All ({chipCounts.all})</button>
        <button onClick={() => setFilter("needs")}    style={chip(filter === "needs", "#d97706")}>⚠ Needs you ({chipCounts.needs})</button>
        <button onClick={() => setFilter("ready")}    style={chip(filter === "ready", "#059669")}>📎 Ready to send ({chipCounts.ready})</button>
        <button onClick={() => setFilter("resolved")} style={chip(filter === "resolved", "#0891b2")}>✓ Resolved ({chipCounts.resolved})</button>
        <button onClick={() => setFilter("skipped")}  style={chip(filter === "skipped", "var(--text-soft)")}>↷ Skipped ({chipCounts.skipped})</button>
        {freemailSeen > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#dc2626" }}>
            {freemailSeen} freemail address{freemailSeen === 1 ? "" : "es"} seen on these threads — none may ever be a recipient.
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {loading ? (
        <Panel><Spinner /> <span style={{ marginLeft: 8 }}>Loading the board…</span></Panel>
      ) : error ? (
        <div style={{
          textAlign: "center", padding: "50px 20px", background: "var(--surface)",
          border: "1px solid rgba(220,38,38,.28)", borderRadius: 16,
        }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>Couldn&apos;t load auto-reply jobs</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>{error}</p>
          <button onClick={() => load()} style={accentBtn}>Try again</button>
        </div>
      ) : jobs.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "70px 20px", background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 16,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Nothing to grade yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18, maxWidth: 460, margin: "0 auto 18px" }}>
            The loop looks for threads from {(settings?.senderAllowlist ?? ["tekblu", "cloudquestit"]).join(" and ")} where
            you have already written a reply draft. Draft one in Gmail, then run a scan.
          </p>
          <button onClick={runNow} style={accentBtn} disabled={running}>
            {running ? <><Spinner /> Scanning…</> : "▶ Run a scan now"}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <Panel>No jobs match this filter.</Panel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(job => (
            <JobCard
              key={job.id}
              job={job}
              expanded={!!openJobs[job.id]}
              jdOpen={!!openJd[job.id]}
              onToggle={() => setOpenJobs(p => ({ ...p, [job.id]: !p[job.id] }))}
              onToggleJd={() => setOpenJd(p => ({ ...p, [job.id]: !p[job.id] }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({ job, expanded, jdOpen, onToggle, onToggleJd }: {
  job: Job
  expanded: boolean
  jdOpen: boolean
  onToggle: () => void
  onToggleJd: () => void
}) {
  const state = stateOf(job.state)
  const meta = STATE_META[state]
  const needsYou = NEEDS_YOU.includes(state)
  const candidates = job.recruiterCandidates ?? []
  const to = job.recruiterTo ?? []
  const cc = job.recruiterCc ?? []

  return (
    <div style={{
      background: needsYou ? "rgba(217,119,6,.06)" : "var(--surface)",
      border: `1px solid ${needsYou ? "rgba(217,119,6,.34)" : "var(--border)"}`,
      borderLeft: `3px solid ${needsYou ? "#d97706" : "transparent"}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      {/* Header row — click to expand */}
      <div
        onClick={onToggle}
        style={{ padding: "13px 16px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}
      >
        <span style={{
          flexShrink: 0, marginTop: 3, fontSize: 11, color: "var(--text-soft)",
          transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-block",
        }}>▶</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              {job.roleTitle || "Untitled role"}
            </span>
            {job.jdLocation && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {job.jdRemote ? "🌐 " : "📍 "}{job.jdLocation}
              </span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
              textTransform: "uppercase", letterSpacing: ".04em",
              background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
              color: meta.color, border: `1px solid color-mix(in srgb, ${meta.color} 32%, transparent)`,
            }}>{meta.label}</span>
          </div>

          <div style={{
            fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{job.subject || "(no subject)"}</div>

          <div style={{ fontSize: 11.5, color: "var(--text-soft)", marginTop: 3 }}>
            from {job.middlemanName ? `${job.middlemanName} · ` : ""}{job.middlemanEmail || "unknown sender"}
          </div>
        </div>

        {/* Chosen recipients — the algorithm's answer, visible without expanding */}
        <div style={{ flexShrink: 0, textAlign: "right", maxWidth: 300 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".05em" }}>Would address</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: to.length ? "#059669" : "var(--text-soft)", wordBreak: "break-all" }}>
            {to.length ? to.join(", ") : "— nothing chosen —"}
          </div>
          {cc.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>cc {cc.join(", ")}</div>
          )}
        </div>
      </div>

      {/* Needs-you banner is always visible, expanded or not */}
      {needsYou && (job.lastError || job.skipReason || job.haltCode) && (
        <div style={{
          margin: "0 16px 13px", padding: "10px 13px", borderRadius: 10,
          background: "rgba(217,119,6,.10)", border: "1px solid rgba(217,119,6,.28)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
            ⚠ Needs a human
          </div>
          {!job.lastError && job.haltCode && (
            <p style={{ fontSize: 12.5, color: "var(--text)", margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: "#b45309" }}>Halted:</strong> {job.haltCode.replace(/_/g, " ")}
            </p>
          )}
          {job.lastError && (
            <p style={{ fontSize: 12.5, color: "var(--text)", margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: "#b45309" }}>Error:</strong> {job.lastError}
            </p>
          )}
          {job.skipReason && (
            <p style={{ fontSize: 12.5, color: "var(--text)", margin: job.lastError ? "4px 0 0" : 0, lineHeight: 1.6 }}>
              <strong style={{ color: "#b45309" }}>Skipped:</strong> {job.skipReason}
            </p>
          )}
        </div>
      )}

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Rationale, verbatim */}
          {job.recruiterRationale && (
            <div style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                Why it picked that {job.recruiterSource ? `· source: ${job.recruiterSource}` : ""}
              </div>
              <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, margin: 0 }}>
                {job.recruiterRationale}
              </p>
            </div>
          )}

          {/* Tailored resume (M3). Present once the loop has generated one. */}
          {job.resumeDownloadUrl && (
            <div style={{
              background: "rgba(5,150,105,.06)", border: "1px solid rgba(5,150,105,.28)",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                Tailored resume · ready to attach
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--text)", wordBreak: "break-all" }}>
                  {job.tailorFilename || "Resume"}.docx
                </span>
                {typeof job.tailorScore === "number" && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                    color: job.tailorScore >= 80 ? "#059669" : "#d97706",
                    background: job.tailorScore >= 80 ? "rgba(5,150,105,.12)" : "rgba(217,119,6,.12)",
                  }}>match {job.tailorScore}</span>
                )}
                <span style={{ flex: 1 }} />
                {job.resumePreviewUrl && (
                  <a href={job.resumePreviewUrl} target="_blank" rel="noreferrer"
                     style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>Preview</a>
                )}
                <a href={job.resumeDownloadUrl}
                   style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>Download .docx</a>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-soft)", margin: "8px 0 0", lineHeight: 1.6 }}>
                This milestone cannot send. Download the file, attach it to your draft in Gmail, and send it yourself.
              </p>
            </div>
          )}

          {/* Candidate table — the point of this page */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>
              Addresses considered ({candidates.length})
            </div>
            {candidates.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--text-soft)", padding: "10px 0" }}>
                No candidates recorded for this thread.
              </div>
            ) : (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                        <th style={cth}>Address</th>
                        <th style={cth}>Field</th>
                        <th style={cth}>Class</th>
                        <th style={cth}>Verdict</th>
                        <th style={cth}>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((c, i) => {
                        const k = classOf(c.klass)
                        const cm = CLASS_META[k]
                        const danger = k === "freemail"
                        return (
                          <tr key={`${c.address}-${i}`} style={{
                            borderTop: "1px solid var(--border)",
                            background: danger ? "rgba(220,38,38,.07)" : c.selected ? "rgba(5,150,105,.07)" : "transparent",
                          }}>
                            <td style={{
                              ...ctd, fontWeight: c.selected || danger ? 700 : 500,
                              color: danger ? "#dc2626" : "var(--text)",
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              fontSize: 12, wordBreak: "break-all",
                            }}>
                              {danger ? "⚠ " : c.selected ? "✓ " : ""}{c.address}
                            </td>
                            <td style={{ ...ctd, textTransform: "uppercase", fontSize: 11, fontWeight: 700, color: "var(--text-soft)" }}>
                              {c.field || "—"}
                            </td>
                            <td style={ctd}>
                              <span style={{
                                display: "inline-block", padding: "2px 9px", borderRadius: 20,
                                fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap",
                                background: cm.bg, color: cm.color,
                                border: `1px solid color-mix(in srgb, ${cm.color} 34%, transparent)`,
                              }} title={cm.note}>{cm.label}</span>
                            </td>
                            <td style={{ ...ctd, whiteSpace: "nowrap" }}>
                              {c.selected ? (
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#059669" }}>Selected</span>
                              ) : danger ? (
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626" }}>Blocked</span>
                              ) : (
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-soft)" }}>Dropped</span>
                              )}
                            </td>
                            <td style={{ ...ctd, fontSize: 12, color: danger ? "#dc2626" : "var(--text-muted)", lineHeight: 1.5 }}>
                              {c.selected ? "—" : (c.reason || cm.note)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {candidates.some(c => classOf(c.klass) === "freemail") && (
              <p style={{ fontSize: 11.5, color: "#dc2626", fontWeight: 600, margin: "7px 0 0", lineHeight: 1.6 }}>
                Freemail addresses on a bench-sales thread are competing job candidates CC&apos;d on the same blast.
                Your resume must never reach them.
              </p>
            )}
          </div>

          {/* Thread vs chosen recipients */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            <Facts title="Original thread" rows={[
              ["To", (job.threadTo ?? []).join(", ") || "—"],
              ["Cc", (job.threadCc ?? []).join(", ") || "—"],
            ]} />
            <Facts title="Chosen recipients" rows={[
              ["To", to.join(", ") || "—"],
              ["Cc", cc.join(", ") || "—"],
            ]} accent />
          </div>

          {/* Skills */}
          {(job.jdSkills ?? []).length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".05em" }}>Skills</span>
              {job.jdSkills.map(s => (
                <span key={s} style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                  background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)",
                }}>{s}</span>
              ))}
            </div>
          )}

          {/* JD excerpt, collapsed */}
          {job.jdExcerpt && (
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <button onClick={onToggleJd} style={{
                width: "100%", textAlign: "left", padding: "9px 13px", background: "transparent",
                border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)",
              }}>
                {jdOpen ? "▾" : "▸"} Job description excerpt
              </button>
              {jdOpen && (
                <pre style={{
                  margin: 0, padding: "0 13px 13px", fontSize: 12.5, lineHeight: 1.7,
                  color: "var(--text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  fontFamily: "inherit",
                }}>{job.jdExcerpt}</pre>
              )}
            </div>
          )}

          <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
            Thread {job.threadId || "—"} · updated {job.updatedAt ? new Date(job.updatedAt).toLocaleString() : "—"}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function Facts({ title, rows, accent }: { title: string; rows: [string, string][]; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? "rgba(5,150,105,.06)" : "var(--surface-2)",
      border: `1px solid ${accent ? "rgba(5,150,105,.25)" : "var(--border)"}`,
      borderRadius: 10, padding: "11px 13px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: "var(--text-soft)", fontWeight: 700, flexShrink: 0, width: 22 }}>{k}</span>
          <span style={{ color: "var(--text)", wordBreak: "break-all" }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "60px 20px", background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16, fontSize: 13, color: "var(--text-muted)",
    }}>{children}</div>
  )
}

function Spinner() {
  return (
    <>
      <span style={{
        display: "inline-block", width: 13, height: 13, borderRadius: "50%",
        border: "2px solid currentColor", borderTopColor: "transparent",
        animation: "ar-spin .8s linear infinite", verticalAlign: "-2px",
      }} />
      <style>{"@keyframes ar-spin { to { transform: rotate(360deg) } }"}</style>
    </>
  )
}

// ── Style helpers (same idiom as applications/page.tsx) ───────────────────────

function chip(active: boolean, color = "var(--accent)"): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    background: active ? color : "var(--surface)",
    color: active ? "#fff" : "var(--text-muted)",
    border: `1px solid ${active ? color : "var(--border)"}`,
  }
}

function pill(color: string): React.CSSProperties {
  return {
    padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
  }
}

const cth: React.CSSProperties = { textAlign: "left", padding: "9px 12px", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--text-soft)", whiteSpace: "nowrap" }
const ctd: React.CSSProperties = { padding: "9px 12px", fontSize: 13, color: "var(--text)", verticalAlign: "middle" }
const accentBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, textDecoration: "none" }
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "var(--surface)", color: "var(--text-soft)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }
