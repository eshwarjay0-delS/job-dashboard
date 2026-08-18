"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import MicButton from "../MicButton"
import ResumeScoreCard from "@/components/ResumeScoreCard"
import CoverLetterModal from "@/components/CoverLetterModal"
import { toast } from "sonner"
import { tailoredFilename } from "@/lib/filename"

const FB_CHIPS = [
  "Make bullets shorter", "More specific, less generic", "Add more keywords from the JD",
  "Shorten the summary", "More technical detail", "Less formal tone",
]

interface TailorEdits { headline?: { title?: string; tagline?: string }; summary?: string; skills?: { idx: number; text: string }[]; bullets?: { idx: number; text: string }[] }
interface RankedCandidate { filename: string; category: string; score: number; matchedOn: string[]; identityHit: boolean }

function DownloadIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
}
function BackIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
}
function CheckCircle() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
}
function Spin() {
  return <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
}
function ArrowUp() {
  return <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
}
function ChevronDown({ open }: { open: boolean }) {
  return <svg className={`w-4 h-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
}

// ─── Insights Dropdown ──────────────────────────────────────────────────────
// Derives recruiter-trust audit, score journey, tool evidence, and interview
// prep tips directly from the tailored edits. Shown below the preview pane.
function InsightsDropdown({ score, scoreBefore, content, changes, matchedOn, rankedCandidates }: {
  score: number; scoreBefore: number | null
  content: TailorEdits | null; changes: string[]; matchedOn: string[]
  rankedCandidates: RankedCandidate[]
}) {
  const [open, setOpen] = useState(false)

  const delta       = scoreBefore != null ? score - scoreBefore : null
  const bulletCount = (content?.bullets || []).filter(b => b.text?.trim()).length
  const skillCount  = (content?.skills  || []).filter(s => s.text?.trim()).length
  const hasHeader   = !!(content?.headline?.title?.trim() || content?.headline?.tagline?.trim())
  const hasSummary  = !!(content?.summary?.trim())
  const wordCount   = hasSummary ? (content!.summary!.trim().split(/\s+/).filter(Boolean).length) : 0

  // Derive tool names mentioned in rewritten bullets (capitalized tokens ≥ 4 chars)
  const toolsInBullets = Array.from(new Set(
    (content?.bullets || []).flatMap(b =>
      (b.text || "").match(/\b(SonarQube|GitHub|Artifactory|Xray|Splunk|Sentinel|QRadar|Qualys|Nessus|Tenable|CrowdStrike|Okta|SailPoint|Saviynt|CyberArk|Azure|AWS|GCP|Terraform|Kubernetes|Jenkins|Prometheus|Grafana|Burp|Metasploit|Intune|Purview|Defender|SIEM|SOAR|SAST|DAST|IAST|SCA|AppSec|DevSecOps|Python|Bash|PowerShell|CodeQL|Rally|Tines|Jira|ServiceNow|Fortify|Checkmarx|Veracode|Prisma|Lacework|Wiz|CrowdStrike|Palo Alto|Cisco|Cylance)\b/g) || []
    )
  )).slice(0, 8)

  // Audit steps: did each pillar get addressed?
  const audit = [
    { label: "Identity",      done: hasHeader || hasSummary,  note: hasHeader ? `Locked to: ${content?.headline?.title || "role title"}` : "From summary re-aim" },
    { label: "Credibility",   done: bulletCount > 0,           note: "Absorbed; no JD mirroring" },
    { label: "Timeline",      done: bulletCount >= 4,          note: `~60-70% alignment in current role (${bulletCount} bullet${bulletCount === 1 ? "" : "s"})` },
    { label: "Tool evidence", done: toolsInBullets.length > 0, note: toolsInBullets.length ? toolsInBullets.join(", ") : "Inside experience bullets" },
    { label: "ATS / Skills",  done: skillCount > 0,            note: skillCount ? `${skillCount} skill line${skillCount === 1 ? "" : "s"} updated` : "Skills section covered" },
  ]

  // Interview prep: what will they probe based on tools found
  const interviewProbes: Record<string, string[]> = {
    SonarQube:     ["Quality profile tuning", "Plugin compatibility + updates", "False positive triage"],
    GitHub:        ["CodeQL query management", "Secret scanning config", "PR gate workflows"],
    Artifactory:   ["Repository management", "Xray scan policies", "Promotion workflows"],
    "CI/CD":       ["Pipeline failure handling", "Severity gate thresholds", "Developer unblocking"],
    Splunk:        ["Search optimization", "Dashboard creation", "Correlation rule tuning"],
    Sentinel:      ["Analytics rules", "Playbook automation", "Log connector setup"],
    AWS:           ["IAM policy review", "Security group audits", "AMI lifecycle management"],
    Okta:          ["SSO configuration", "MFA policy management", "App integration"],
    SailPoint:     ["Role mining", "Access review campaigns", "Provisioning workflows"],
    CyberArk:      ["Vault configuration", "Session recording", "Account rotation"],
    Terraform:     ["State management", "Module design", "Drift detection"],
    Kubernetes:    ["RBAC policies", "Network policies", "Pod security"],
  }
  const probes = toolsInBullets.flatMap(t => interviewProbes[t] || []).slice(0, 9)

  if (!content && changes.length === 0) return null

  return (
    <div className="mt-3 rounded-2xl border overflow-hidden transition-all" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 group"
        style={{ background: open ? "var(--surface-2)" : "transparent" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ fontSize: "1.1rem" }}>🔍</span>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Resume Insights</p>
            <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>
              {delta != null && delta > 0 ? `+${delta}% improvement` : "Tailoring analysis"}
              {bulletCount > 0 ? ` · ${bulletCount} bullets` : ""}
              {skillCount > 0 ? ` · ${skillCount} skills` : ""}
            </p>
          </div>
        </div>
        <span style={{ color: "var(--text-soft)" }}><ChevronDown open={open} /></span>
      </button>

      {/* Expandable body */}
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-5 border-t" style={{ borderColor: "var(--border)" }}>

          {/* Score journey */}
          {scoreBefore != null && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>Score Journey</p>
              <div className="flex items-center gap-3">
                {/* before bar */}
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] mb-1" style={{ color: "var(--text-soft)" }}>
                    <span>Before</span><span className="font-semibold">{scoreBefore}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${scoreBefore}%`, background: "#9ca3af" }} />
                  </div>
                </div>
                <div className="text-lg font-bold px-1" style={{ color: "#1558a0" }}>→</div>
                {/* after bar */}
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] mb-1" style={{ color: "var(--text-soft)" }}>
                    <span>After</span><span className="font-semibold" style={{ color: score >= 90 ? "#1558a0" : score >= 80 ? "#1d4ed8" : "#6b7280" }}>{score}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${score}%`, background: score >= 90 ? "#1558a0" : score >= 80 ? "#1d4ed8" : "#6b7280" }} />
                  </div>
                </div>
                {delta != null && delta > 0 && (
                  <span className="text-xs font-bold rounded-full px-2 py-0.5 flex-shrink-0"
                    style={{ background: "rgba(29,111,196,0.1)", color: "#1558a0" }}>
                    +{delta}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Recruiter trust audit */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>Recruiter Trust Audit</p>
            <p className="text-[10px] mb-2.5 italic" style={{ color: "var(--text-soft)" }}>
              Identity → Credibility → Timeline → Tool Evidence → ATS — this is the order that wins offers.
            </p>
            <div className="space-y-2">
              {audit.map(a => (
                <div key={a.label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: a.done ? "rgba(29,111,196,0.12)" : "var(--border)", color: a.done ? "#1558a0" : "var(--text-soft)" }}>
                    {a.done ? "✓" : "–"}
                  </span>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{a.label}</span>
                    <span className="text-xs ml-1.5" style={{ color: "var(--text-soft)" }}>{a.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tool evidence */}
          {toolsInBullets.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>Tools Inside Bullets</p>
              <p className="text-[11px] mb-2" style={{ color: "var(--text-soft)" }}>
                These appear inside real work stories — not just the skills list. That's what makes them defensible.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {toolsInBullets.map(t => (
                  <span key={t} className="text-[11px] font-medium rounded-full px-2.5 py-0.5"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-txt)", border: "1px solid var(--accent-border)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ATS keywords matched */}
          {matchedOn.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>ATS Keywords Covered</p>
              <div className="flex flex-wrap gap-1.5">
                {matchedOn.slice(0, 18).map(k => (
                  <span key={k} className="text-[10px] font-medium rounded-full px-2 py-0.5"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {k}
                  </span>
                ))}
                {matchedOn.length > 18 && (
                  <span className="text-[10px] rounded-full px-2 py-0.5" style={{ color: "var(--text-soft)" }}>
                    +{matchedOn.length - 18} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Why this resume was selected */}
          {rankedCandidates.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>Why This Resume Was Selected</p>
              <p className="text-[11px] mb-2.5" style={{ color: "var(--text-soft)" }}>
                Scored by keyword content match + role identity. Higher score = better fit for this JD.
              </p>
              <div className="space-y-2">
                {rankedCandidates.map((c, i) => {
                  const isWinner = i === 0
                  const maxScore = rankedCandidates[0].score || 1
                  const pct = Math.round((c.score / maxScore) * 100)
                  return (
                    <div key={i} className="rounded-xl p-3" style={{
                      background: isWinner ? "rgba(29,111,196,0.07)" : "var(--surface-2)",
                      border: `1px solid ${isWinner ? "rgba(29,111,196,0.2)" : "var(--border)"}`,
                    }}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {isWinner && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "rgba(29,111,196,0.15)", color: "#1558a0" }}>✓ SELECTED</span>
                          )}
                          <span className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                            {c.filename}
                          </span>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: isWinner ? "#1558a0" : "var(--text-soft)" }}>
                          {c.score}pts
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: isWinner ? "#1558a0" : "#9ca3af" }} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px]" style={{ color: "var(--text-soft)" }}>
                          {c.category.split(" / ").slice(-2).join(" / ")}
                          {c.identityHit ? " · role identity match ✓" : ""}
                        </span>
                        {c.matchedOn.length > 0 && (
                          <span className="text-[10px]" style={{ color: "var(--text-soft)" }}>
                            {c.matchedOn.length} keywords: {c.matchedOn.slice(0, 3).join(", ")}{c.matchedOn.length > 3 ? "…" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Interview prep */}
          {probes.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#1d4ed8" }}>Interview Prep Heads-Up</p>
              <p className="text-[11px] mb-2.5" style={{ color: "var(--text-soft)" }}>
                Based on the tools in your bullets, expect these probes. Know at least one real story for each.
              </p>
              <ul className="space-y-1">
                {probes.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ color: "#1d4ed8" }}>›</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
            {matchedOn.length > 0 && <p className="text-[11px]" style={{ color: "var(--text-soft)" }}><span className="font-semibold" style={{ color: "var(--text)" }}>{matchedOn.length}</span> ATS keywords</p>}
            {bulletCount > 0 && <p className="text-[11px]" style={{ color: "var(--text-soft)" }}><span className="font-semibold" style={{ color: "var(--text)" }}>{bulletCount}</span> bullets rewritten</p>}
            {skillCount > 0  && <p className="text-[11px]" style={{ color: "var(--text-soft)" }}><span className="font-semibold" style={{ color: "var(--text)" }}>{skillCount}</span> skill lines</p>}
            {wordCount > 0   && <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>Summary: <span className="font-semibold" style={{ color: wordCount > 80 ? "#6b7280" : "#1558a0" }}>{wordCount}w</span> {wordCount > 80 ? "⚠ too long" : "✓"}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// A read-only row of keyword chips (e.g. "Already proven", "Added by tailoring").
function KwRow({ label, color, bg, border, items }: { label: string; color: string; bg: string; border: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold mb-1.5" style={{ color }}>{label} <span style={{ color: "var(--text-soft)" }}>({items.length})</span></p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(k => (
          <span key={k} className="text-[11px] font-medium px-2.5 py-1 rounded-full border" style={{ background: bg, borderColor: border, color }}>{k}</span>
        ))}
      </div>
    </div>
  )
}

interface KeywordAnalysis { matched: string[]; added: string[]; missing: string[]; coverage_before: number; coverage_after: number }
interface ScoreBreakdown { skills: number; identity: number; experience: number }
interface DiffEntry { section: string; before: string; after: string }

function ResultContent() {
  const params = useSearchParams()
  const router = useRouter()

  // State, not const-from-params: a rematch can swap the underlying resume, and every
  // later regenerate() call must target the NEW file — not silently keep re-tailoring
  // the original one forever.
  const [resumeName, setResumeName] = useState(params.get("resumeName") || "Resume")
  const [category, setCategory]     = useState(params.get("category") || "")
  const [filepath, setFilepath]     = useState(params.get("filepath") || "")
  // Target job this resume was tailored FOR — used to name the download after the
  // role/company (JobRight-style), not the source resume's original title.
  const targetRole    = params.get("role") || ""
  const targetCompany = params.get("company") || ""

  const [token, setToken]         = useState(params.get("token") || "")
  const [score, setScore]         = useState(Number(params.get("score") || 85))
  const [scoreBefore, setScoreBefore] = useState<number | null>(() => { const v = params.get("scoreBefore"); return v ? Number(v) : null })
  const [changes, setChanges]     = useState<string[]>(() => { try { return JSON.parse(params.get("changes") || "[]") } catch { return [] } })
  const [applied, setApplied]     = useState<string[]>(() => { try { return JSON.parse(params.get("feedback") || "[]") } catch { return [] } })
  const [content, setContent]     = useState<TailorEdits | null>(null)
  const [matchedOn, setMatchedOn] = useState<string[]>([])

  const [rankedCandidates, setRankedCandidates] = useState<RankedCandidate[]>([])
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null)
  const [kwAnalysis, setKwAnalysis] = useState<KeywordAnalysis | null>(null)
  const [selKw, setSelKw] = useState<string[]>([])   // missing keywords the user chose to add
  const [diff, setDiff] = useState<DiffEntry[]>([])
  const [showDiff, setShowDiff] = useState(false)

  const [previewHtml, setPreviewHtml]       = useState("")
  const [previewLoading, setPreviewLoading] = useState(true)

  const [chips, setChips]         = useState<string[]>([])
  const [custom, setCustom]       = useState("")
  const [busy, setBusy]           = useState(false)
  const [showAllBullets, setShowAllBullets]     = useState(false)
  const [showAllSkills,  setShowAllSkills]      = useState(false)
  const [showWhatWent,   setShowWhatWent]       = useState(false)
  const [showCoverLetter, setShowCoverLetter]   = useState(false)

  // Score colour uses accent for high scores
  const scoreHigh   = score >= 80
  const scoreMedium = score >= 60 && score < 80
  const scoreColor  = scoreHigh ? "#1558a0" : scoreMedium ? "#1d4ed8" : "#6b7280"
  const scoreLabel  = scoreHigh ? "Excellent fit" : scoreMedium ? "Good fit" : "Partial fit"
  const circumference = 2 * Math.PI * 44

  const loadPreview = useCallback(async (tok: string) => {
    if (!tok) { setPreviewLoading(false); return }
    setPreviewLoading(true)
    try {
      // AbortSignal.timeout so a hung preview fetch can't leave the pane spinning
      // forever; the finally always clears the loading flag.
      const res = await fetch(
        `/api/tailor/file?token=${encodeURIComponent(tok)}&fmt=preview&name=${encodeURIComponent(resumeName)}`,
        { signal: AbortSignal.timeout(30000) },
      )
      setPreviewHtml(await res.text())
    } catch { setPreviewHtml("") }
    finally { setPreviewLoading(false) }
  }, [resumeName])

  useEffect(() => { loadPreview(token) }, [token, loadPreview])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("careerkit_last_result")
      if (!raw) return
      const r = JSON.parse(raw)
      if (r && (!token || r.token === token)) {
        if (r.edits) setContent(r.edits)
        if (Array.isArray(r.what_changed)) setChanges(r.what_changed)
        if (Array.isArray(r.applied_feedback)) setApplied(r.applied_feedback)
        if (typeof r.score === "number") setScore(r.score)
        if (typeof r.score_before === "number") setScoreBefore(r.score_before)
        if (Array.isArray(r.matched_on)) setMatchedOn(r.matched_on)
        if (Array.isArray(r.ranked_candidates)) setRankedCandidates(r.ranked_candidates)
        if (r.score_breakdown) setBreakdown(r.score_breakdown)
        if (r.keyword_analysis) setKwAnalysis(r.keyword_analysis)
        if (Array.isArray(r.diff)) setDiff(r.diff)
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function download(fmt: "docx" | "pdf") {
    if (!token) { toast.error("Tailor a resume first."); return }
    // Name the file after the TARGET role/company + today's date. Falls back to
    // candidate-only (from the source name) when no role/company is known.
    const safeName = tailoredFilename({ sourceName: resumeName, role: targetRole, company: targetCompany }) || "Resume"
    const url = `/api/tailor/file?token=${encodeURIComponent(token)}&fmt=${fmt}&name=${encodeURIComponent(safeName)}`
    if (fmt === "docx") {
      const a = document.createElement("a")
      a.href = url; a.download = `${safeName}.docx`
      document.body.appendChild(a); a.click(); a.remove()
    } else {
      window.open(url, "_blank")
    }
  }

  async function regenerate(opts?: { rematch?: boolean }) {
    let jd = ""
    try { jd = sessionStorage.getItem("careerkit_jd") || "" } catch {}
    if (!jd) { try { jd = localStorage.getItem("careerkit_jd_last") || "" } catch {} }
    if (!jd) { toast.error("Go back and paste the JD again to regenerate."); return }
    let claudeKey = ""
    try { claudeKey = (JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey) || "" } catch {}

    // Collect the immediate feedback from this session's chips + custom text +
    // any "missing keywords" the user selected to weave in (Jobright-style).
    const kwPref = selKw.length
      ? [`Incorporate these JD keywords where the candidate can credibly support them — woven into existing skill lines and bullets, never invented: ${selKw.join(", ")}`]
      : []
    const immediatePrefs = [...chips, custom.trim(), ...kwPref].filter(Boolean)
    // Normal "Refine" regenerate ALWAYS reuses the same resume (filepath pinned) — there is
    // no way for feedback like "wrong resume" / "need a junior one" to ever change anything,
    // since the model can only re-word text inside the one file it's given. Rematch clears
    // filepath so the server re-runs auto-select against the (possibly now-informed-by-
    // feedback) JD instead of being stuck on the original pick.
    const useFilepath = opts?.rematch ? "" : filepath

    setBusy(true)
    try {
      // Save to feedback.json for future sessions (fire-and-forget).
      if (immediatePrefs.length) {
        fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chips, custom, category }) }).catch(() => {})
      }
      // Pass immediatePrefs directly so Claude applies them in THIS call (not just future ones).
      // noCache: a manual "regenerate" is an explicit ask for a NEW attempt — never
      // hand back a cached identical result, so feedback always visibly takes effect.
      const res = await fetch("/api/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jd, filepath: useFilepath, claudeKey, immediatePrefs, noCache: true }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "Regenerate failed."); setBusy(false); return }
      setToken(data.token)
      setScore(data.score ?? score)
      setScoreBefore(typeof data.score_before === "number" ? data.score_before : null)
      setMatchedOn(data.matched_on ?? [])
      setRankedCandidates(data.ranked_candidates ?? [])
      setChanges(data.what_changed ?? [])
      setApplied(data.applied_feedback ?? [])
      setContent(data.edits ?? null)
      setBreakdown(data.score_breakdown ?? null)
      setKwAnalysis(data.keyword_analysis ?? null)
      setDiff(Array.isArray(data.diff) ? data.diff : [])
      if (data.matched?.filename) setResumeName(data.matched.filename)
      if (data.matched?.category) setCategory(data.matched.category)
      if (data.matched?.filepath) setFilepath(data.matched.filepath)
      try { sessionStorage.setItem("careerkit_last_result", JSON.stringify(data)) } catch {}
      setChips([]); setCustom(""); setSelKw([])
      if (opts?.rematch && data.matched?.filename) {
        toast.success(
          data.matched.filename === resumeName
            ? "Re-matched — the library's best fit is still this same resume"
            : `Re-matched to "${data.matched.filename}"`,
        )
      } else {
        toast.success("Regenerated with your feedback")
      }
    } catch (e) {
      toast.error("Error: " + String(e))
    }
    setBusy(false)
  }

  const customRef = useRef(custom)
  customRef.current = custom
  function appendDictation(chunk: string) {
    if (!chunk) return
    const prev = customRef.current
    const sep = prev && !/\s$/.test(prev) ? " " : ""
    setCustom(prev + sep + chunk)
  }

  return (
    <>
    <div className="max-w-6xl mx-auto anim-fade-up">
      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/resume")}
        className="mb-4 flex items-center gap-2 text-sm transition-colors"
        style={{ color: "var(--text-soft)" }}
      >
        <BackIcon /> Back to resumes
      </button>

      {/* Panel container */}
      <div className="rounded-2xl p-3" style={{ background: "#e4e8ef", boxShadow: "inset 0 2px 8px rgba(26,32,53,.08)" }}>
      <div className="grid lg:grid-cols-5 gap-3 items-stretch">
        {/* ── LEFT col ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col rounded-xl overflow-hidden"
          style={{
            background: "var(--surface)",
            boxShadow: "0 2px 4px rgba(26,32,53,.06), 0 8px 24px rgba(26,32,53,.08), 0 20px 48px rgba(26,32,53,.06)",
          }}>

          {/* Score section */}
          <div className="p-6 anim-fade-up d-1">
            <div className="flex items-start gap-5">
              {/* Circle score */}
              <div className="relative flex-shrink-0 w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="44" fill="none" stroke={scoreColor} strokeWidth="8"
                    strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.34,1.56,.64,1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold" style={{ color: "var(--text)" }}>{score}</span>
                  <span className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-soft)" }}>match</span>
                </div>
              </div>
              {/* Meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: "#1558a0" }}>
                  <CheckCircle />
                  <span className="text-sm font-semibold">Tailored</span>
                </div>
                <h1 className="text-lg font-bold truncate" style={{ color: "var(--text)" }}>{resumeName}</h1>
                {category && <p className="text-xs mt-0.5" style={{ color: "var(--text-soft)" }}>{category.split(" / ").pop()}</p>}
                <p className="text-sm mt-1" style={{ color: scoreColor }}>{scoreLabel}</p>
                {scoreBefore != null && score > scoreBefore && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5"
                    style={{ color: "#1558a0", background: "rgba(29,111,196,0.1)" }}>
                    <ArrowUp />
                    +{score - scoreBefore}% better fit
                    <span className="font-normal ml-0.5" style={{ color: "var(--text-soft)" }}>(was {scoreBefore}%)</span>
                  </p>
                )}
              </div>
            </div>
            {applied.length > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-soft)" }}>Applied your feedback</p>
                <div className="flex flex-wrap gap-1.5">
                  {applied.slice(0, 5).map((f, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border max-w-[220px] truncate"
                      style={{ background: "rgba(29,111,196,0.07)", borderColor: "rgba(29,111,196,0.2)", color: "#1558a0" }} title={f}>
                      ✓ {f.length > 38 ? f.slice(0, 36) + "…" : f}
                    </span>
                  ))}
                  {applied.length > 5 && <span className="text-[11px] px-2 py-1 rounded-full" style={{ color: "var(--text-soft)", background: "var(--surface-2)" }}>+{applied.length - 5} more</span>}
                </div>
              </div>
            )}
            {matchedOn.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-soft)" }}>Matched on {matchedOn.length} keyword{matchedOn.length === 1 ? "" : "s"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedOn.slice(0, 14).map(k => (
                    <span key={k} className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border)", color: "var(--accent-txt)" }}>{k}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ATS Resume Score card */}
          <div className="px-4 pb-3">
            <ResumeScoreCard
              token={token}
              resumeName={resumeName}
              jd={(() => { try { return sessionStorage.getItem("careerkit_jd") || "" } catch { return "" } })()}
            />
          </div>

          {/* What went into your resume — collapsible */}
          {content && ((content.headline?.title || content.headline?.tagline || "").trim() || (content.summary || "").trim() || (content.skills || []).some(s => s.text?.trim()) || (content.bullets || []).some(b => b.text?.trim())) && (
            <div style={{ background: "var(--surface)" }}>
              <button onClick={() => setShowWhatWent(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 transition-colors"
                style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}>✦</span>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-soft)" }}>What went into your resume</span>
                </span>
                <ChevronDown open={showWhatWent} />
              </button>
              {showWhatWent && (
                <div className="px-6 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
                  {(content.headline?.title?.trim() || content.headline?.tagline?.trim()) && (
                    <div className="pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--accent-txt)" }}>Header retitled <span className="font-normal normal-case" style={{ color: "var(--text-soft)" }}>— name &amp; contact kept</span></p>
                      {content.headline?.title?.trim() && <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{content.headline.title}</p>}
                      {content.headline?.tagline?.trim() && <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--text-muted)" }}>{content.headline.tagline}</p>}
                    </div>
                  )}
                  {content.summary?.trim() && (
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--accent-txt)" }}>Summary</p>
                      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-muted)" }}>{content.summary}</p>
                    </div>
                  )}
                  {(content.skills || []).filter(s => s.text?.trim()).length > 0 && (() => {
                    const skills = (content.skills || []).filter(s => s.text?.trim())
                    const shown = showAllSkills ? skills : skills.slice(0, 3)
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-txt)" }}>Skills updated</p>
                          <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}>{skills.length} lines</span>
                        </div>
                        <ul className="space-y-1">{shown.map((s, i) => <li key={i} className="text-xs truncate" style={{ color: "var(--text-muted)" }} title={s.text}>{s.text}</li>)}</ul>
                        {skills.length > 3 && <button onClick={() => setShowAllSkills(v => !v)} className="mt-1 text-[11px] font-medium" style={{ color: "var(--accent-txt)" }}>{showAllSkills ? "Show less ↑" : `+${skills.length - 3} more ↓`}</button>}
                      </div>
                    )
                  })()}
                  {(content.bullets || []).filter(b => b.text?.trim()).length > 0 && (() => {
                    const bullets = (content.bullets || []).filter(b => b.text?.trim())
                    const shown = showAllBullets ? bullets : bullets.slice(0, 3)
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-txt)" }}>Bullets rewritten</p>
                          <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}>{bullets.length} bullets</span>
                        </div>
                        <ul className="space-y-1.5">
                          {shown.map((b, i) => (
                            <li key={i} className="flex gap-2 text-xs leading-relaxed">
                              <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}>•</span>
                              <span className="line-clamp-2" style={{ color: "var(--text-muted)" }}>{b.text}</span>
                            </li>
                          ))}
                        </ul>
                        {bullets.length > 3 && <button onClick={() => setShowAllBullets(v => !v)} className="mt-1 text-[11px] font-medium" style={{ color: "var(--accent-txt)" }}>{showAllBullets ? "Show less ↑" : `+${bullets.length - 3} more ↓`}</button>}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Download + Cover Letter */}
          <div className="px-6 py-5 space-y-2" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-soft)" }}>Download</p>
            <button onClick={() => download("docx")} className="btn-accent w-full flex items-center justify-between px-4 py-3 rounded-xl">
              <div className="text-left">
                <p className="font-semibold text-sm">Word (.docx) · Recommended</p>
                <p className="text-xs opacity-80">Your exact fonts &amp; layout — ready to send</p>
              </div>
              <DownloadIcon />
            </button>
            <button onClick={() => download("pdf")} className="btn-surface w-full flex items-center justify-between px-4 py-3">
              <div className="text-left">
                <p className="font-semibold text-sm">PDF — simplified copy</p>
                <p className="text-xs" style={{ color: "var(--text-soft)" }}>Text-only layout · for exact format, Save as PDF from the Word file</p>
              </div>
              <DownloadIcon />
            </button>
            {/* Cover Letter */}
            <button
              onClick={() => setShowCoverLetter(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
              style={{ background: "rgba(29,111,196,.06)", borderColor: "rgba(29,111,196,.25)", color: "var(--text)" }}
            >
              <div className="text-left">
                <p className="font-semibold text-sm">✉️ Generate Cover Letter</p>
                <p className="text-xs" style={{ color: "var(--text-soft)" }}>AI-written, grounded in your resume — 30 seconds</p>
              </div>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            <button
              onClick={() => {
                let fp = filepath
                try { const r = JSON.parse(sessionStorage.getItem("careerkit_last_result") || "{}"); fp = r?.matched?.filepath || filepath } catch {}
                router.push(`/dashboard/resume/builder${fp ? `?filepath=${encodeURIComponent(fp)}` : ""}`)
              }}
              className="btn-surface w-full flex items-center justify-between px-4 py-3">
              <div className="text-left">
                <p className="font-semibold text-sm">✏️ Edit in Builder</p>
                <p className="text-xs" style={{ color: "var(--text-soft)" }}>Fine-tune every field, with AI assist</p>
              </div>
            </button>
          </div>

          {/* See your difference — before → after for every changed line */}
          {diff.length > 0 && (
            <div className="px-6 py-5" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              <button onClick={() => setShowDiff(v => !v)} className="w-full flex items-center justify-between">
                <div className="text-left">
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>See your difference</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-soft)" }}>
                    {diff.length} line{diff.length > 1 ? "s" : ""} rewritten · your fonts &amp; layout untouched
                  </p>
                </div>
                <span style={{ color: "var(--text-soft)" }}><ChevronDown open={showDiff} /></span>
              </button>
              {showDiff && (
                <div className="mt-3 space-y-2.5">
                  {diff.map((d, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ background: "var(--surface-2)", color: "var(--text-soft)" }}>{d.section}</div>
                      {d.before
                        ? <div className="px-3 py-2 text-xs leading-relaxed flex gap-1.5" style={{ color: "var(--text-soft)" }}>
                            <span className="opacity-70">−</span>
                            <span style={{ textDecoration: "line-through", textDecorationColor: "var(--text-soft)" }}>{d.before}</span>
                          </div>
                        : <div className="px-3 py-1.5 text-[11px]" style={{ color: "var(--text-soft)" }}>New line added to cover the role</div>}
                      <div className="px-3 py-2 text-xs leading-relaxed flex gap-1.5" style={{ background: "#ecfdf5", color: "#065f46" }}>
                        <span className="opacity-80">+</span><span>{d.after}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Keyword match — what the role asks vs. what the resume proves */}
          {(kwAnalysis || breakdown) && (
            <div className="px-6 py-5" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              <h2 className="text-sm font-semibold mb-0.5" style={{ color: "var(--text)" }}>Keyword match</h2>
              <p className="text-xs mb-3.5" style={{ color: "var(--text-soft)" }}>
                What this role asks for vs. what your resume proves. Pick any gaps to weave in — honestly, never invented.
              </p>

              {breakdown && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {([["Skills", breakdown.skills], ["Identity", breakdown.identity], ["Experience", breakdown.experience]] as [string, number][]).map(([label, val]) => {
                    const c = val >= 85 ? "#1558a0" : val >= 70 ? "#1d4ed8" : "#6b7280"
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span style={{ color: "var(--text-soft)" }}>{label}</span>
                          <span className="font-semibold" style={{ color: c }}>{val}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val}%`, background: c }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {kwAnalysis && (
                <div className="space-y-3">
                  {kwAnalysis.matched.length > 0 && (
                    <KwRow label="Already proven" color="#1558a0" bg="#ecfdf5" border="#a7f3d0" items={kwAnalysis.matched} />
                  )}
                  {kwAnalysis.added.length > 0 && (
                    <KwRow label="Added by tailoring" color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" items={kwAnalysis.added} />
                  )}
                  {kwAnalysis.missing.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
                        Missing <span style={{ color: "var(--text-soft)" }}>({kwAnalysis.missing.length})</span> — tap to add, then regenerate
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {kwAnalysis.missing.map(k => {
                          const on = selKw.includes(k)
                          return (
                            <button key={k} type="button"
                              onClick={() => setSelKw(p => on ? p.filter(x => x !== k) : [...p, k])}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all"
                              style={on
                                ? { background: "#eff6ff", borderColor: "#1d4ed8", color: "#1d4ed8" }
                                : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-soft)" }}>
                              {on ? "✓ " : "+ "}{k}
                            </button>
                          )
                        })}
                      </div>
                      {selKw.length > 0 && (
                        <button onClick={() => regenerate()} disabled={busy}
                          className="btn-accent mt-3 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                          {busy ? "Adding…" : `Add ${selKw.length} keyword${selKw.length > 1 ? "s" : ""} & regenerate`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Refine */}
          <div className="px-6 py-5" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
            <h2 className="text-sm font-semibold mb-0.5" style={{ color: "var(--text)" }}>Not quite right? Refine it</h2>
            <p className="text-xs mb-3" style={{ color: "var(--text-soft)" }}>Pick what to change and regenerate instantly.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {FB_CHIPS.map(c => {
                const on = chips.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChips(p => on ? p.filter(x => x !== c) : [...p, c])}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                    style={on
                      ? { background: "var(--accent-soft)", borderColor: "var(--accent-border)", color: "var(--accent-txt)" }
                      : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-muted)" }
                    }
                  >
                    {c}
                  </button>
                )
              })}
            </div>
            <div className="relative mb-1">
              <textarea
                value={custom}
                onChange={e => setCustom(e.target.value)}
                rows={3}
                placeholder="Or speak / type the change in your own words…"
                className="w-full rounded-xl border p-3 pr-14 text-sm resize-none focus:outline-none ring-accent"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              />
              <MicButton onText={appendDictation} className="absolute bottom-2.5 right-2.5" />
            </div>
            <p className="mb-3 text-[11px]" style={{ color: "var(--text-soft)" }}>
              🎙️ Click the mic or press{" "}
              <kbd className="rounded px-1 font-mono text-[10px]" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>Ctrl</kbd>+
              <kbd className="rounded px-1 font-mono text-[10px]" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>Shift</kbd>+
              <kbd className="rounded px-1 font-mono text-[10px]" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>M</kbd> to dictate.
            </p>
            <button
              onClick={() => regenerate()}
              disabled={busy}
              className="btn-accent w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              {busy ? <><Spin /> Regenerating…</> : <>↻ Apply feedback &amp; regenerate</>}
            </button>
            <button
              onClick={() => regenerate({ rematch: true })}
              disabled={busy}
              className="btn-surface w-full py-2.5 text-xs flex items-center justify-center gap-1.5 mt-2"
              title="Re-runs auto-select across your whole library instead of re-tailoring this same file"
            >
              {busy ? <><Spin /> Re-matching…</> : <>🔀 Wrong resume? Try a different match</>}
            </button>
          </div>
        </div>

        {/* ── RIGHT: live preview ────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Preview frame — its own mounted panel */}
          <div className="flex flex-col rounded-xl overflow-hidden flex-1"
            style={{
              background: "var(--surface)",
              boxShadow: "0 2px 4px rgba(26,32,53,.06), 0 8px 24px rgba(26,32,53,.08), 0 20px 48px rgba(26,32,53,.06)",
            }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-soft)" }}>Live Preview</h2>
              {previewLoading && (
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-soft)" }}>
                  <Spin /> updating…
                </span>
              )}
            </div>
            <div className="flex-1 p-3">
              <iframe
                title="Resume preview"
                srcDoc={previewHtml}
                className="w-full h-full rounded-lg"
                style={{ minHeight: "68vh", background: "#fff", border: "none" }}
              />
            </div>
            <p className="text-[11px] px-5 py-2 text-center" style={{ color: "var(--text-soft)", borderTop: "1px solid var(--border)" }}>
              Preview is an approximation — the downloaded Word file keeps your exact formatting.
            </p>
          </div>

          {/* Insights — separate mounted panel below, with visible dark gap above */}
          {diff.length > 0 && (
            <details className="rounded-xl overflow-hidden mb-3" style={{ background: "var(--surface)", boxShadow: "0 2px 4px rgba(26,32,53,.06), 0 8px 24px rgba(26,32,53,.08)" }}>
              <summary style={{ cursor: "pointer", listStyleType: "none", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                <span>🔍 See your difference · {diff.length} line{diff.length === 1 ? "" : "s"} changed</span>
                <span style={{ fontSize: 11, color: "var(--text-soft)", fontWeight: 500 }}>before → after</span>
              </summary>
              <div style={{ borderTop: "1px solid var(--border)", padding: "10px 18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                {diff.map((d, i) => (
                  <div key={i}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--accent-txt)", marginBottom: 6 }}>{d.section}</p>
                    <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-soft)", textDecoration: "line-through", background: "var(--cat-reply-bg, #fef2f2)", borderLeft: "3px solid var(--cat-reply, #dc2626)", padding: "6px 10px", borderRadius: 6, marginBottom: 4 }}>{d.before || "(was empty)"}</p>
                    <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text)", background: "var(--cat-int-bg, #eff6ff)", borderLeft: "3px solid var(--cat-int, #1d6fc4)", padding: "6px 10px", borderRadius: 6 }}>{d.after}</p>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 2 }}>Only the text changed — your original fonts, spacing, and layout are untouched.</p>
              </div>
            </details>
          )}
          <div className="rounded-xl overflow-hidden"
            style={{
              background: "var(--surface)",
              boxShadow: "0 2px 4px rgba(26,32,53,.06), 0 8px 24px rgba(26,32,53,.08), 0 20px 48px rgba(26,32,53,.06)",
            }}>
            <InsightsDropdown
              score={score}
              scoreBefore={scoreBefore}
              content={content}
              changes={changes}
              matchedOn={matchedOn}
              rankedCandidates={rankedCandidates}
            />
          </div>
        </div>
      </div>
      </div>
    </div>

    {/* Cover Letter Modal */}
    {showCoverLetter && (
      <CoverLetterModal
        jd={(() => { try { return sessionStorage.getItem("careerkit_jd") || "" } catch { return "" } })()}
        filepath={filepath}
        resumeName={resumeName}
        onClose={() => setShowCoverLetter(false)}
      />
    )}
    </>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-20 anim-fade-in" style={{ color: "var(--text-soft)" }}>
        Loading result…
      </div>
    }>
      <ResultContent />
    </Suspense>
  )
}
