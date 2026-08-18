"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDialogs } from "@/components/ui/dialog-provider"
import type { ResumeFile } from "./page"
import LibraryTree from "./LibraryTree"
import ResumeBuilder from "./ResumeBuilder"
import DocumentsClient from "../documents/DocumentsClient"
import { IllustLibrary, IllustBuilder } from "@/components/Illustrations"
import PageHeader from "@/components/layout/PageHeader"
import { tailoredFilename, extractRoleCompany } from "@/lib/filename"

// ── Recent tailored resumes (persisted to localStorage) ───────────────────────
const RECENT_KEY = "mf_recent_tailors"
// An in-flight background tailoring job, so it can be recovered if the user
// navigates away mid-generation and comes back.
const ACTIVE_JOB_KEY = "mf_active_job"
interface RecentTailor {
  token: string
  resumeName: string
  category: string
  filepath: string
  score: number
  scoreBefore: number | null
  jdSnippet: string
  tailoredAt: number
  // Target job this resume was tailored FOR — drives the download filename so it
  // reflects the role/company, not the source resume's original title.
  targetRole?: string
  targetCompany?: string
  downloadName?: string
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function CloudIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 11.095"/>
    </svg>
  )
}
function CheckIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
}
function SpinIcon() {
  return <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
}
function SparkIcon({ size = 4 }: { size?: number }) {
  return <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
}
function BoltIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
}
function LockIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
}

// ── Keyword → category matcher ─────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Penetration Tester": ["penetration", "pentest", "pen test", "offensive", "exploit", "vulnerability assessment", "kali", "metasploit", "burp"],
  "Appsec Engineer":    ["application security", "appsec", "owasp", "secure code", "sast", "dast", "code review", "web application security"],
  "Cloud Security":     ["cloud security", "aws", "azure", "gcp", "cloud native", "s3", "iam policy", "kubernetes security", "terraform"],
  "Devsecops":          ["devsecops", "devops", "ci/cd", "pipeline", "jenkins", "gitlab", "github actions", "shift left", "container security", "docker"],
  "SOC & Detection":    ["soc", "security operations", "siem", "splunk", "incident response", "threat detection", "log analysis", "alert triage"],
  "IAM & PAM":          ["identity", "iam", "pam", "privileged access", "okta", "active directory", "ldap", "zero trust", "access management"],
  "Network":            ["network security", "firewall", "routing", "switching", "vpn", "ids", "ips", "wireshark", "packet", "cisco"],
  "Security Analyst":   ["security analyst", "threat intelligence", "vulnerability management", "risk assessment", "compliance", "nessus"],
  "Red Team":           ["red team", "adversary simulation", "c2", "command and control", "cobalt strike", "lateral movement", "post exploitation"],
  "Security Architect & GRC": ["security architect", "grc", "governance", "risk", "compliance", "iso 27001", "nist", "soc 2", "architecture review"],
  "Security Engineer":  ["security engineer", "endpoint", "edr", "xdr", "cryptography", "pki", "zero day", "hardening"],
  "OT Security":        ["ot security", "ics", "scada", "industrial", "plc", "operational technology", "critical infrastructure"],
  "Database Admin":     ["database", "dba", "sql", "mysql", "postgresql", "oracle", "mongodb", "data security"],
  "Business Analyst + System Engineer": ["business analyst", "system engineer", "requirements", "stakeholder", "process improvement", "bpmn"],
  "Admin":              ["administrator", "it admin", "system admin", "sysadmin", "helpdesk", "active directory admin", "group policy"],
}

function bestMatchCategory(jd: string): string | null {
  const text = jd.toLowerCase()
  let best: string | null = null
  let bestScore = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(k => text.includes(k)).length
    if (score > bestScore) { bestScore = score; best = cat }
  }
  return bestScore > 0 ? best : null
}

function findBestResume(jd: string, resumes: ResumeFile[]): ResumeFile | null {
  if (!resumes.length) return null
  const cat = bestMatchCategory(jd)
  if (!cat) return resumes[0]
  const catLower = cat.toLowerCase()
  const match = resumes.find(r => r.category.toLowerCase().includes(catLower))
    ?? resumes.find(r => catLower.includes(r.category.toLowerCase().split(" / ").pop()?.toLowerCase() ?? ""))
    ?? resumes[0]
  return match
}

// ── Upload entry type ──────────────────────────────────────────────────────────
interface UploadedEntry {
  file: ResumeFile
  status: "scanning" | "ready" | "error"
  errorMsg?: string
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
      style={done
        ? { background: "var(--success)", color: "#fff" }
        : active
        ? { background: "var(--accent)", color: "#fff", boxShadow: "0 0 0 3px var(--accent-soft)" }
        : { background: "var(--surface-2)", color: "var(--text-soft)", border: "1px solid var(--border)" }
      }
    >
      {done ? <CheckIcon /> : n}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ResumeClient({ initialFiles, initialFolders = [] }: { initialFiles: ResumeFile[]; initialFolders?: string[] }) {
  const router = useRouter()
  const { confirm, prompt } = useDialogs()
  const [activeTab, setActiveTab] = useState<"tailor" | "build" | "docs">(() => {
    // Support ?tab=docs (from /dashboard/documents redirect) and ?tab=build
    const t = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null
    if (t === "docs" || t === "build") return t
    return "tailor"
  })

  const [preloaded, setPreloaded] = useState<ResumeFile[]>(initialFiles)
  useEffect(() => { setPreloaded(initialFiles) }, [initialFiles])
  const [uploaded, setUploaded]   = useState<UploadedEntry[]>([])
  const [dragging, setDragging]   = useState(false)
  const [selected, setSelected]   = useState<string | null>(null)
  const [autoSelect, setAutoSelect] = useState(true)
  const [onePage, setOnePage]     = useState(false)
  const [sections, setSections]   = useState<{ summary: boolean; skills: boolean; experience: boolean }>({ summary: true, skills: true, experience: true })
  const [mode, setMode]           = useState<"quick" | "full">("full")

  const [jd, setJd]               = useState(() => {
    // Pre-fill from any source: job card "Tailor Resume" or dashboard quick-tailor
    try {
      for (const key of ["jd_prefill", "jd_prefill_jd", "careerkit_quick_jd"]) {
        const q = sessionStorage.getItem(key)
        if (q) {
          sessionStorage.removeItem(key)
          return q
        }
      }
    } catch {}
    return ""
  })
  // Read role/company context set by job card "Tailor Resume" button
  const [prefillRole] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("jd_prefill_role")
      if (v) sessionStorage.removeItem("jd_prefill_role")
      return v ?? ""
    } catch { return "" }
  })
  const [prefillCompany] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem("jd_prefill_company")
      if (v) sessionStorage.removeItem("jd_prefill_company")
      return v ?? ""
    } catch { return "" }
  })
  const [tailoring, setTailoring] = useState(false)
  const [err, setErr]             = useState("")
  const [notice, setNotice]       = useState("")
  const [checked, setChecked]     = useState<Set<string>>(new Set())
  function toggleCheck(key: string) {
    setChecked(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }

  const [recentTailors, setRecentTailors] = useState<RecentTailor[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) setRecentTailors(JSON.parse(raw))
    } catch {}
  }, [])

  // The background-job flow was removed (it couldn't complete on serverless —
  // Vercel freezes a function once it responds). Clear any stale job pointer a
  // previous version may have left so it doesn't trigger a phantom poll on mount.
  useEffect(() => {
    try { localStorage.removeItem(ACTIVE_JOB_KEY) } catch {}
  }, [])

  const allResumes: ResumeFile[] = [
    ...preloaded,
    ...uploaded.filter(u => u.status === "ready").map(u => u.file),
  ]

  const activeResume: ResumeFile | null = allResumes.find(r => r.id === selected) ?? null

  // Detect keyword match live as user types
  const [liveMatch, setLiveMatch] = useState<string | null>(null)
  useEffect(() => {
    if (!autoSelect || !jd.trim()) { setLiveMatch(null); return }
    const cat = bestMatchCategory(jd)
    setLiveMatch(cat)
  }, [jd, autoSelect])

  function handleJdChange(text: string) { setJd(text) }

  function pickResume(f: ResumeFile) {
    if (selected === f.id) { setSelected(null); return }
    setSelected(f.id)
    setAutoSelect(false)
  }

  // Steps for UX flow
  const step1Done = allResumes.length > 0
  const step2Done = jd.trim().length > 50
  const step3Active = step1Done && step2Done

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function uploadZip(file: File) {
    const tempId = `zip_${Date.now()}`
    setUploaded(prev => [{ file: { id: tempId, filename: `${file.name} — extracting…`, filepath: "", category: "ZIP", size: `${(file.size / 1024).toFixed(0)} KB`, uploadedAt: new Date().toISOString() }, status: "scanning" }, ...prev])
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/resumes", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      setUploaded(prev => prev.filter(u => u.file.id !== tempId))
      if (res.ok && data.zip) {
        setNotice(`Imported ${data.added} resume${data.added === 1 ? "" : "s"} from ${file.name}${data.skipped ? ` · skipped ${data.skipped} duplicate${data.skipped === 1 ? "" : "s"}` : ""}.`)
        router.refresh()
      } else {
        setErr(data.error ?? "Zip import failed.")
      }
    } catch (e) {
      setUploaded(prev => prev.filter(u => u.file.id !== tempId))
      setErr(`Zip error: ${String(e)}`)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const accepted = [...files].filter(f => /\.(docx|zip)$/i.test(f.name))
    if (!accepted.length) { setErr("Upload a .docx resume or a .zip of resumes."); return }
    setErr(""); setNotice("")

    for (const file of accepted) {
      if (/\.zip$/i.test(file.name)) { await uploadZip(file); continue }
      const tempId = `tmp_${Date.now()}_${Math.random()}`
      const tempEntry: UploadedEntry = {
        file: { id: tempId, filename: file.name.replace(/\.docx$/i, ""), filepath: "", category: "Uploaded", size: `${(file.size/1024).toFixed(0)} KB`, uploadedAt: new Date().toISOString() },
        status: "scanning",
      }
      setUploaded(prev => [tempEntry, ...prev])
      setSelected(tempId)

      try {
        const fd = new FormData()
        fd.append("file", file)
        const res  = await fetch("/api/resumes", { method: "POST", body: fd })
        const data = await res.json()
        if (res.ok && data.duplicate) {
          const replace = await confirm(`"${data.file.filename}" is already in your library.\n\nIs this a modified version?`, { title: "File already exists", confirmLabel: "Replace", cancelLabel: "Keep existing" })
          if (replace) {
            const fd2 = new FormData()
            fd2.append("file", file)
            fd2.append("replace", "true")
            const res2 = await fetch("/api/resumes", { method: "POST", body: fd2 })
            const data2 = await res2.json().catch(() => ({}))
            if (res2.ok && data2.file) {
              setUploaded(prev => prev.map(u => u.file.id === tempId ? { file: data2.file, status: "ready" } : u))
              setSelected(data2.file.id)
              router.refresh()
            } else {
              setUploaded(prev => prev.map(u => u.file.id === tempId ? { ...u, status: "error", errorMsg: data2.error ?? "Replace failed" } : u))
              setErr(data2.error ?? "Replace failed")
            }
          } else {
            setUploaded(prev => prev.map(u => u.file.id === tempId ? { file: data.file, status: "ready" } : u))
            setSelected(data.file.id)
          }
        } else if (res.ok && data.file) {
          setUploaded(prev => prev.map(u => u.file.id === tempId ? { file: data.file, status: "ready" } : u))
          setSelected(data.file.id)
          router.refresh()
        } else {
          setUploaded(prev => prev.map(u => u.file.id === tempId ? { ...u, status: "error", errorMsg: data.error ?? `HTTP ${res.status}` } : u))
          setErr(data.error ?? `Upload failed (HTTP ${res.status})`)
        }
      } catch (e) {
        setUploaded(prev => prev.map(u => u.file.id === tempId ? { ...u, status: "error", errorMsg: String(e) } : u))
        setErr(`Network error: ${String(e)}`)
      }
    }
  }

  // ── Tailor ─────────────────────────────────────────────────────────────────
  async function doTailor() {
    if (!jd.trim()) { setErr("Paste a job description first."); return }
    if (allResumes.length === 0) { setErr("Add a resume to your library first."); return }
    if (!autoSelect && !activeResume) { setErr("Pick a resume from the file map, or turn on Auto-match."); return }
    setErr("")
    setTailoring(true)

    try {
      let claudeKey = ""
      try { claudeKey = (JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey) || "" } catch {}
      try { sessionStorage.setItem("careerkit_jd", jd.trim()) } catch {}
      try { localStorage.setItem("careerkit_jd_last", jd.trim()) } catch {}

      const filepath = autoSelect ? "" : (activeResume?.filepath ?? "")
      try { sessionStorage.setItem("careerkit_one_page", onePage ? "1" : "0") } catch {}

      // Generate SYNCHRONOUSLY — one request that returns the finished result.
      // The old background flow (/api/tailor/start + poll /api/tailor/status) can't
      // work on serverless (Vercel): the function is frozen the moment it responds,
      // so the "background" generation never ran and the poll hung forever. The sync
      // route completes the whole tailor inside one request, which works on both
      // localhost and Vercel.
      // Hard client timeout so the spinner can NEVER hang forever. The server returns
      // (or Vercel 504s) by ~60s; abort a bit after that as a final safety net.
      const ctrl = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 75000)
      let res: Response
      try {
        res = await fetch("/api/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd: jd.trim(), filepath, claudeKey, onePage, sections, mode }),
          signal: ctrl.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.token) {
        const msg = res.status === 504 || res.status === 408
          ? "That rewrite took too long and timed out. Try again, or switch to Quick mode for a faster pass."
          : res.status === 429
          ? (data.error ?? "Too many requests in a short window — wait about a minute, then try again.")
          : (data.error ?? `Tailoring failed (HTTP ${res.status})`)
        setErr(msg)
        setTailoring(false)
        return
      }

      try { sessionStorage.setItem("careerkit_last_result", JSON.stringify(data)) } catch {}

      // Resolve the TARGET role/company: prefer the job card that started this
      // tailor, fall back to a best-effort parse of the pasted JD.
      const parsed = extractRoleCompany(jd)
      const targetRole = (prefillRole || parsed.role || "").trim()
      const targetCompany = (prefillCompany || parsed.company || "").trim()
      const sourceName = data.matched?.filename ?? activeResume?.filename ?? "Resume"
      const downloadName = tailoredFilename({ sourceName, role: targetRole, company: targetCompany })

      // Persist to recent tailors library (survives navigation + tab close)
      try {
        const entry: RecentTailor = {
          token:      data.token,
          resumeName: sourceName,
          category:   data.matched?.category ?? activeResume?.category ?? "",
          filepath:   data.matched?.filepath  ?? activeResume?.filepath  ?? "",
          score:      data.score      ?? 80,
          scoreBefore: typeof data.score_before === "number" ? data.score_before : null,
          jdSnippet:  jd.trim().slice(0, 120),
          tailoredAt: Date.now(),
          targetRole, targetCompany, downloadName,
        }
        const prev: RecentTailor[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
        const updated = [entry, ...prev.filter(r => r.token !== entry.token)].slice(0, 3)
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
        setRecentTailors(updated)
      } catch {}

      // Log this tailor for weekly usage tracking (Settings → Plan & Storage)
      try {
        const log: number[] = JSON.parse(localStorage.getItem("jd_tailor_log") || "[]")
        log.push(Date.now())
        // Keep only the last 90 days of entries to avoid unbounded growth
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
        localStorage.setItem("jd_tailor_log", JSON.stringify(log.filter(ts => ts > cutoff)))
      } catch {}

      const matched = data.matched ?? {}
      const params = new URLSearchParams({
        token:       String(data.token ?? ""),
        score:       String(data.score ?? 80),
        scoreBefore: String(data.score_before ?? ""),
        changes:    JSON.stringify(data.what_changed ?? []),
        feedback:   JSON.stringify(data.applied_feedback ?? []),
        resumeName: matched.filename ?? activeResume?.filename ?? "Resume",
        category:   matched.category ?? activeResume?.category ?? "",
        filepath:   matched.filepath ?? activeResume?.filepath ?? "",
        role:       targetRole,
        company:    targetCompany,
      })
      router.push(`/dashboard/resume/result?${params}`)
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError"
      setErr(aborted
        ? "That took too long and timed out. Try again, or use Quick mode for a faster pass."
        : "Network error while tailoring: " + String(e))
      setTailoring(false)
    }
  }

  // ── Folder management ──────────────────────────────────────────────────────
  async function createFolder() {
    const name = await prompt("New folder name (use / for sub-folders, e.g. Cyber/SOC):", { title: "New folder", placeholder: "e.g. Cyber/SOC" })
    if (!name || !name.trim()) return
    try {
      const res = await fetch("/api/resumes/folder", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setNotice(`Created folder "${d.folder}".`); router.refresh() }
      else setErr(d.error ?? "Could not create folder.")
    } catch (e) { setErr("Folder error: " + String(e)) }
  }

  async function moveChecked() {
    const files = [...checked].filter(k => k.startsWith("f:")).map(k => k.slice(2))
    if (!files.length) { setErr("Check one or more files to move (folders can't be moved)."); return }
    const target = await prompt("Move selected file(s) into which folder? (use / for sub-folders)", { title: "Move files", placeholder: "Folder name" })
    if (!target || !target.trim()) return
    try {
      const res = await fetch("/api/resumes/move", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, target: target.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setChecked(new Set()); setNotice(`Moved ${d.moved} file${d.moved === 1 ? "" : "s"} to "${d.target}".`); router.refresh() }
      else setErr(d.error ?? "Move failed.")
    } catch (e) { setErr("Move error: " + String(e)) }
  }

  async function deleteChecked() {
    if (checked.size === 0) return
    const files = [...checked].filter(k => k.startsWith("f:")).map(k => k.slice(2))
    const folders = [...checked].filter(k => k.startsWith("d:")).map(k => k.slice(2))
    const label = `${files.length} file${files.length === 1 ? "" : "s"}` + (folders.length ? ` and ${folders.length} folder${folders.length === 1 ? "" : "s"}` : "")
    if (!await confirm(`Delete ${label}? Folders are removed with everything inside them.`, { title: "Delete", confirmLabel: "Delete", destructive: true })) return
    try {
      const res = await fetch("/api/resumes", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, folders }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        if (selected && files.includes(activeResume?.filepath ?? "")) setSelected(null)
        setChecked(new Set())
        setNotice(`Deleted ${d.deleted} item${d.deleted === 1 ? "" : "s"}.`)
        router.refresh()
      } else setErr(d.error ?? "Delete failed.")
    } catch (e) { setErr("Delete error: " + String(e)) }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 anim-fade-up">

      {/* ── Header — built from the shared PageHeader primitive (see
          src/components/layout/PageHeader.tsx) instead of a hand-rolled
          title/description block, so this page's header structure matches
          every other page that migrates to it. ── */}
      <div className="d-0">
        <PageHeader
          title="Tailor Resume"
          description={
            allResumes.length > 0
              ? `${allResumes.length} resume${allResumes.length !== 1 ? "s" : ""} in library · AI tailoring ready`
              : "Add resumes in Documents, then tailor them here to any job in seconds"
          }
          actions={
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setActiveTab("tailor")}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={activeTab === "tailor"
                  ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.1)" }
                  : { color: "var(--text-soft)" }
                }
              >
                ✨ AI Tailor
              </button>
              <button
                onClick={() => setActiveTab("build")}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={activeTab === "build"
                  ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.1)" }
                  : { color: "var(--text-soft)" }
                }
              >
                🏗 Builder
              </button>
              <button
                onClick={() => setActiveTab("docs")}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={activeTab === "docs"
                  ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.1)" }
                  : { color: "var(--text-soft)" }
                }
              >
                📁 Documents
              </button>
            </div>
          }
        />
      </div>

      {/* ── Documents tab ── */}
      {activeTab === "docs" && (
        <DocumentsClient
          initialFiles={initialFiles}
          initialFolders={initialFolders}
          onDone={() => setActiveTab("tailor")}
        />
      )}

      {/* ── Build tab ── */}
      {activeTab === "build" && <ResumeBuilder />}

      {/* ── Tailor tab ── */}
      {activeTab === "tailor" && (
        <div className="space-y-5">

          {/* Step progress bar */}
          <div className="anim-fade-up d-1 flex items-center gap-0 rounded-2xl border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {[
              { n: 1, label: "Select Resume", sublabel: step1Done ? `${allResumes.length} resume${allResumes.length !== 1 ? "s" : ""} ready` : "Pick from your library", done: step1Done, active: !step1Done },
              { n: 2, label: "Job Description", sublabel: step2Done ? `${jd.trim().length} characters` : "Paste the JD", done: step2Done, active: step1Done && !step2Done },
              { n: 3, label: "AI Tailoring", sublabel: step3Active ? "Ready to generate" : "Complete steps above", done: false, active: step3Active },
            ].map((step, i) => (
              <div key={i} className="flex-1 flex items-center gap-3 px-5 py-4 relative"
                style={i < 2 ? { borderRight: "1px solid var(--border)" } : undefined}>
                <StepBadge n={step.n} done={step.done} active={step.active} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: step.done || step.active ? "var(--text)" : "var(--text-soft)" }}>
                    {step.label}
                  </p>
                  <p className="text-xs truncate" style={{ color: step.done ? "var(--success)" : "var(--text-soft)" }}>
                    {step.sublabel}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Main two-column layout: JD LEFT · Library + options RIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

            {/* ── LEFT col (3/5): JD + Auto-match + Depth + Generate ──── */}
            <div className="lg:col-span-3 flex flex-col gap-3 anim-fade-up d-2">

              {/* Auto-match status card */}
              <div
                className="rounded-xl border px-4 py-3 flex items-center gap-3 transition-all"
                style={{
                  background: autoSelect ? "var(--accent-soft)" : "var(--surface)",
                  borderColor: autoSelect ? "var(--accent-border, var(--accent))" : "var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => { setAutoSelect(a => !a); if (!autoSelect) setSelected(null) }}
                  title="Toggle keyword auto-match"
                  aria-pressed={autoSelect}
                  className="relative flex-shrink-0 rounded-full transition-colors"
                  style={{ height: 24, width: 44, background: autoSelect ? "var(--accent)" : "var(--border)" }}
                >
                  <span
                    className="absolute rounded-full bg-white shadow-sm transition-all"
                    style={{ top: 3, height: 18, width: 18, left: autoSelect ? "calc(100% - 21px)" : "3px" }}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  {autoSelect ? (
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-2 flex-wrap" style={{ color: "var(--accent-txt)" }}>
                        Auto-match by keywords
                        {liveMatch && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "var(--accent)", color: "#fff" }}>
                            → {liveMatch}
                          </span>
                        )}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-soft)" }}>Picks the best-fit resume from your library automatically.</p>
                    </div>
                  ) : activeResume ? (
                    <div>
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{activeResume.filename}</p>
                      <p className="text-xs" style={{ color: "var(--text-soft)" }}>{activeResume.category.split(" / ").pop()} · click again to deselect</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#d97706" }}>No resume selected</p>
                      <p className="text-xs" style={{ color: "var(--text-soft)" }}>Pick one in the library →, or turn Auto-match back on.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* JD textarea */}
              <div className="flex flex-col rounded-2xl border overflow-hidden"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="px-4 py-3 flex items-center justify-between border-b"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: "var(--text-soft)" }}>
                      Job Description
                    </p>
                    {jd.trim().length > 0 && (prefillRole || prefillCompany) && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{
                        background: "var(--success-soft, rgba(16,185,129,.12))",
                        color: "var(--success, #10b981)",
                        border: "1px solid rgba(16,185,129,.25)",
                      }}>
                        from {[prefillCompany, prefillRole].filter(Boolean).join(" – ")}
                      </span>
                    )}
                  </div>
                  {jd.trim().length > 0 && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-medium" style={{ color: jd.trim().length < 100 ? "var(--warning)" : "var(--success)" }}>
                        {jd.trim().length} chars {jd.trim().length < 100 ? "· too short" : "· ✓"}
                      </span>
                      <button onClick={() => setJd("")} className="text-xs" style={{ color: "var(--text-soft)" }}>Clear</button>
                    </div>
                  )}
                </div>
                <textarea
                  value={jd}
                  onChange={e => handleJdChange(e.target.value)}
                  placeholder={"Paste the full job description here…\n\nThe AI reads every line to find which of your resumes is the closest match, then rewrites it to hit 90–95% keyword alignment."}
                  className="w-full p-4 text-sm resize-none focus:outline-none leading-relaxed"
                  style={{ background: "var(--surface)", color: "var(--text)", minHeight: 280 }}
                />
              </div>

              {/* Tailoring depth */}
              <div className="rounded-xl border px-4 py-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-soft)" }}>Tailoring Depth</p>
                <div className="flex gap-2">
                  {([
                    ["quick", "⚡ Quick", "Headline, summary & top bullets"],
                    ["full",  "✦ Full",  "Every relevant line — most thorough"],
                  ] as const).map(([key, label, desc]) => {
                    const on = mode === key
                    return (
                      <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={on}
                        className="flex-1 rounded-xl border px-3 py-2.5 text-left transition-all"
                        style={on
                          ? { background: "var(--accent-soft)", borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" }
                          : { background: "var(--surface-2)", borderColor: "var(--border)" }}>
                        <p className="text-sm font-bold" style={{ color: on ? "var(--accent-txt)" : "var(--text)" }}>{label}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-soft)" }}>{desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={doTailor}
                disabled={tailoring || !jd.trim()}
                className="btn-accent w-full py-4 flex items-center justify-center gap-2.5 text-base font-bold rounded-2xl"
                style={!jd.trim() ? { opacity: 0.45 } : { boxShadow: "0 4px 20px var(--accent-shadow, rgba(99,102,241,.35))" }}
              >
                {tailoring
                  ? <><SpinIcon /> Tailoring your resume — usually ~20s (up to a minute for a deep rewrite)…</>
                  : <><SparkIcon size={5} /> Tailor &amp; Generate Resume →</>
                }
              </button>

            </div>

            {/* ── RIGHT col (2/5): Upload + Library + 1-page + Sections + Recent ── */}
            <div className="lg:col-span-2 flex flex-col gap-3 anim-fade-up d-3">

              {/* Quick upload — drop a new resume straight into the tailor flow
                  without leaving for the Documents tab. Uploaded files are
                  merged into allResumes and auto-selected for tailoring. */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={e => { e.preventDefault(); setDragging(false) }}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
                className="rounded-2xl border-2 border-dashed transition-all"
                style={{
                  borderColor: dragging ? "var(--accent)" : "var(--border)",
                  background: dragging ? "var(--accent-soft)" : "var(--surface)",
                }}
              >
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <div className="flex-shrink-0" style={{ color: "var(--accent-txt)" }}><CloudIcon /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Upload a new resume</p>
                    <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                      Drop or browse a .docx (or .zip) — it&apos;s added here and selected for tailoring.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".docx,.zip"
                    multiple
                    className="hidden"
                    onChange={e => { handleFiles(e.target.files); e.currentTarget.value = "" }}
                  />
                </label>
                {uploaded.length > 0 && (
                  <div className="border-t px-3 py-2 space-y-1.5" style={{ borderColor: "var(--border)" }}>
                    {uploaded.map(u => (
                      <div key={u.file.id} className="flex items-center gap-2 text-xs">
                        <span className="flex-shrink-0" style={{ color: u.status === "error" ? "var(--warning)" : u.status === "ready" ? "var(--success)" : "var(--text-soft)" }}>
                          {u.status === "scanning" ? <SpinIcon /> : u.status === "ready" ? <CheckIcon /> : "!"}
                        </span>
                        <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{u.file.filename}</span>
                        {u.status === "error" && <span className="truncate" style={{ color: "var(--warning)" }}>{u.errorMsg}</span>}
                        {u.status === "ready" && <span style={{ color: "var(--success)" }}>ready</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resume library — always visible, no collapse */}
              {(preloaded.length > 0 || initialFolders.length > 0) ? (
                <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="px-4 py-2.5 border-b flex items-center justify-between gap-2"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>Resume Folders</p>
                    <button onClick={() => setActiveTab("docs")} className="text-xs font-medium flex items-center gap-1"
                      style={{ color: "var(--accent-txt)", background: "none", border: "none", cursor: "pointer" }}>
                      Manage
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto p-2" style={{ maxHeight: 320 }}>
                    <LibraryTree
                      files={preloaded}
                      folders={initialFolders}
                      activeId={activeResume?.id ?? null}
                      onSelect={pickResume}
                      checked={checked}
                      onToggle={toggleCheck}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-8 text-center"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <IllustLibrary style={{ width: 180, height: 135, borderRadius: 12 }}/>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>No resumes yet</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-soft)" }}>Upload .docx files in Documents first</p>
                  </div>
                  <button onClick={() => setActiveTab("docs")}
                    className="text-xs font-semibold px-4 py-2 rounded-xl"
                    style={{ background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
                    Go to Documents →
                  </button>
                </div>
              )}

              {/* ── 1-Page toggle — eye-catching card ─────────────────── */}
              <button
                type="button"
                onClick={() => setOnePage(v => !v)}
                aria-pressed={onePage}
                className="rounded-2xl border w-full text-left transition-all overflow-hidden"
                style={onePage
                  ? { background: "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #7c3aed) 100%)", borderColor: "var(--accent)", boxShadow: "0 4px 20px var(--accent-shadow, rgba(99,102,241,.4))" }
                  : { background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="px-4 py-4 flex items-center gap-4">
                  {/* Page icon */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl"
                    style={{
                      width: 44, height: 54,
                      background: onePage ? "rgba(255,255,255,.2)" : "var(--surface-2)",
                      border: onePage ? "1.5px solid rgba(255,255,255,.35)" : "1.5px solid var(--border)",
                      gap: 3, padding: "6px 7px",
                    }}>
                    {[80, 60, 70, 50, 65].map((w, i) => (
                      <div key={i} className="rounded-full" style={{
                        height: 3, width: `${w}%`,
                        background: onePage ? "rgba(255,255,255,.8)" : "var(--border)",
                        transition: "background .2s",
                      }}/>
                    ))}
                    <div className="mt-1 rounded-sm" style={{
                      fontSize: 8, fontWeight: 800, lineHeight: 1,
                      color: onePage ? "white" : "var(--text-soft)",
                      letterSpacing: "0.05em",
                    }}>1 PG</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: onePage ? "#fff" : "var(--text)" }}>
                      One-Page Resume
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: onePage ? "rgba(255,255,255,.75)" : "var(--text-soft)" }}>
                      {onePage ? "Active — AI will condense to a single page" : "Condense to one page · ideal for &lt;5 yrs exp"}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="relative rounded-full transition-colors"
                      style={{ height: 26, width: 48, background: onePage ? "rgba(255,255,255,.3)" : "var(--surface-2)", border: onePage ? "1.5px solid rgba(255,255,255,.4)" : "1.5px solid var(--border)" }}>
                      <div className="absolute rounded-full bg-white shadow transition-all"
                        style={{ top: 3, height: 18, width: 18, left: onePage ? "calc(100% - 21px)" : "3px" }}/>
                    </div>
                  </div>
                </div>
              </button>

              {/* Sections to enhance */}
              <div className="rounded-xl border px-4 py-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-soft)" }}>Sections to Rewrite</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["summary", "📝 Summary"],
                    ["skills",  "🛠 Skills"],
                    ["experience", "💼 Experience"],
                  ] as const).map(([key, label]) => {
                    const on = sections[key]
                    return (
                      <button
                        key={key} type="button"
                        onClick={() => setSections(s => ({ ...s, [key]: !s[key] }))}
                        aria-pressed={on}
                        className="text-xs font-semibold rounded-full border px-3 py-1.5 transition-all flex items-center gap-1"
                        style={on
                          ? { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent-txt)", boxShadow: "0 0 0 1px var(--accent)" }
                          : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-soft)" }}
                      >
                        <span>{on ? "✓ " : ""}</span>{label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recent tailored resumes */}
              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="px-4 py-2.5 border-b flex items-center justify-between"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>Recent Tailored</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}>last 3</span>
                </div>
                {recentTailors.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-xs" style={{ color: "var(--text-soft)" }}>Your last 3 tailored resumes appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {recentTailors.map(r => {
                      const dlName = r.downloadName || tailoredFilename({ sourceName: r.resumeName, role: r.targetRole, company: r.targetCompany })
                      const params = new URLSearchParams({
                        token:       r.token,
                        score:       String(r.score),
                        scoreBefore: r.scoreBefore != null ? String(r.scoreBefore) : "",
                        resumeName:  r.resumeName,
                        category:    r.category,
                        filepath:    r.filepath,
                        role:        r.targetRole ?? "",
                        company:     r.targetCompany ?? "",
                      })
                      const minsAgo = Math.round((Date.now() - r.tailoredAt) / 60000)
                      const timeLabel = minsAgo < 1 ? "just now" : minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo/60)}h ago` : `${Math.round(minsAgo/1440)}d ago`
                      const scoreColor = r.score >= 90 ? "var(--success)" : r.score >= 80 ? "var(--accent)" : "var(--text-soft)"
                      return (
                        <div key={r.token} className="px-4 py-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                            style={{ background: r.score >= 90 ? "var(--success-soft)" : "var(--accent-soft)", color: scoreColor }}>
                            {r.score}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{r.resumeName}</p>
                            <p className="text-[10px]" style={{ color: "var(--text-soft)" }}>
                              {timeLabel}{r.scoreBefore != null ? ` · ${r.scoreBefore}% → ${r.score}%` : ` · ${r.score}% match`}
                            </p>
                            {r.jdSnippet && (
                              <p className="text-[10px] truncate italic mt-0.5" style={{ color: "var(--text-soft)" }}>{r.jdSnippet}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <a
                              href={`/api/tailor/file?token=${r.token}&fmt=docx&name=${encodeURIComponent(dlName)}`}
                              download={`${dlName}.docx`}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg border text-center"
                              style={{ borderColor: "var(--border)", color: "var(--text-soft)", background: "var(--surface-2)", textDecoration: "none" }}>
                              ↓ .docx
                            </a>
                            <button
                              onClick={() => router.push(`/dashboard/resume/result?${params}`)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                              style={{ background: "var(--accent)", color: "#fff" }}>
                              View
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
