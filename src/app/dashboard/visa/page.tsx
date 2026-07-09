"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Building2, GraduationCap, ClipboardList, Globe, Scale, TriangleAlert, BadgeCheck } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"

const P = {
  surface: "#ffffff", text: "#1a2035", muted: "#6b7a99",
  hint: "#9aa4bc", border: "#e4e8ef", bg: "#f4f6f9",
}

// ── Key USCIS dates for FY2025 ───────────────────────────────────────────────
const H1B_DATES = {
  regOpen:   new Date("2025-03-01"),
  regClose:  new Date("2025-03-20"),
  lottery:   new Date("2025-04-01"),
  petition:  new Date("2025-04-01"),
  startDate: new Date("2025-10-01"),
}

const VISA_TYPES = [
  { id: "h1b",    label: "H-1B",       Icon: Building2,    color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "opt",    label: "OPT/CPT",    Icon: GraduationCap, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "gc",     label: "Green Card", Icon: BadgeCheck,   color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "ead",    label: "EAD/AP",     Icon: ClipboardList, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { id: "l1",     label: "L-1",        Icon: Globe,        color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd" },
]

interface VisaEntry {
  id: string
  type: string
  status: "active" | "pending" | "expiring" | "expired"
  expiryDate: string
  notes: string
  priority?: string   // for GC priority date
  receiptNum?: string // USCIS receipt number
}

const STATUS_META = {
  active:   { label: "Active",    color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  pending:  { label: "Pending",   color: "#1558a0", bg: "#eff6ff", border: "#bfdbfe" },
  expiring: { label: "Expiring",  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  expired:  { label: "Expired",   color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
}

// OPT timeline stages
const OPT_STAGES = [
  { label: "Apply for OPT",          detail: "File Form I-765, ≥90 days before graduation",    done: true  },
  { label: "Receive EAD card",       detail: "USCIS processes in 3-5 months",                  done: true  },
  { label: "OPT starts",             detail: "Can start working within 60-day grace period",    done: true  },
  { label: "File for STEM OPT ext.", detail: "File 90+ days before OPT expires (Form I-765)",  done: false },
  { label: "STEM OPT approved",      detail: "24-month extension — total 36 months",            done: false },
  { label: "H-1B cap registration",  detail: "Annual lottery — register in March",              done: false },
]

const GC_STAGES = [
  { label: "PERM Labor Cert.",  detail: "Employer files LC with DOL (~6-18 months)", done: false },
  { label: "I-140 Petition",    detail: "Filed with USCIS after PERM approval",      done: false },
  { label: "Priority Date",     detail: "Date I-140 was filed — tracks queue",        done: false },
  { label: "I-485 Adjustment",  detail: "File when PD is current on Visa Bulletin",  done: false },
  { label: "EAD/AP issued",     detail: "Work & travel authorization during I-485",  done: false },
  { label: "Green Card issued", detail: "Lawful Permanent Resident status",           done: false },
]

const H1B_STAGES = [
  { label: "Employer registers",  detail: "~$10 fee per registration, March window",  done: false },
  { label: "Lottery selection",   detail: "USCIS selects 65K + 20K advanced degree",  done: false },
  { label: "File petition",       detail: "Premium ($2,805) or regular (3-6 months)", done: false },
  { label: "Approval Notice",     detail: "I-797 approval from USCIS",                done: false },
  { label: "H-1B status begins",  detail: "October 1 — new fiscal year start",        done: false },
  { label: "Extensions / Amend.", detail: "Renew every 3 years (max 6 years base)",   done: false },
]

function countdown(target: Date): string {
  const ms = target.getTime() - Date.now()
  if (ms <= 0) return "Passed"
  const days = Math.floor(ms / 86400000)
  if (days > 365) return `~${Math.floor(days / 30)} months`
  if (days > 30)  return `${Math.floor(days / 7)} weeks`
  return `${days} days`
}

function daysUntilExpiry(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function VisaPage() {
  const [visas, setVisas] = useState<VisaEntry[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newVisa, setNewVisa] = useState<Partial<VisaEntry>>({ type: "h1b", status: "active" })
  const [activeGuide, setActiveGuide] = useState<"h1b" | "opt" | "gc" | null>(null)
  const [aiAnswer, setAiAnswer] = useState("")
  const [aiQ, setAiQ]           = useState("")
  const [loadingAI, setLoadingAI] = useState(false)
  const [currentDate] = useState(new Date())

  useEffect(() => {
    try {
      const s: VisaEntry[] = JSON.parse(localStorage.getItem("jd_visas") || "[]")
      if (s.length) setVisas(s)
    } catch {}
  }, [])

  function persist(next: VisaEntry[]) {
    setVisas(next)
    localStorage.setItem("jd_visas", JSON.stringify(next))
  }

  function addVisa() {
    const v: VisaEntry = {
      id: `v-${Date.now()}`,
      type: newVisa.type || "h1b",
      status: newVisa.status as VisaEntry["status"] || "active",
      expiryDate: newVisa.expiryDate || "",
      notes: newVisa.notes || "",
      priority: newVisa.priority || "",
      receiptNum: newVisa.receiptNum || "",
    }
    persist([v, ...visas])
    setShowAdd(false)
    setNewVisa({ type: "h1b", status: "active" })
  }

  async function askAI() {
    if (!aiQ.trim()) return
    setLoadingAI(true); setAiAnswer("")
    let claudeKey = ""
    try { claudeKey = JSON.parse(localStorage.getItem("jd_settings") || "{}").claudeKey || "" } catch {}
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "immigration",
          instruction: `Answer this US immigration / visa question clearly and concisely (3-5 sentences). Be factual, note you're not a lawyer. Question: "${aiQ}"`,
          current: "",
          claudeKey,
        }),
      })
      const data = await res.json()
      setAiAnswer(data.text || "Unable to generate an answer right now. Please consult an immigration attorney for personalized advice.")
    } catch {
      setAiAnswer("Unable to connect right now. Please consult an immigration attorney for personalized legal advice.")
    }
    setLoadingAI(false)
  }

  const nextH1BReg = new Date("2026-03-01") // FY2026
  const today = currentDate

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          icon={<Scale size={18}/>}
          title="Visa & Immigration"
          description="Track your visa status, H-1B timeline, OPT/CPT countdown, and Green Card priority dates."
          actions={
            <button onClick={() => setShowAdd(!showAdd)} style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>+ Add Status</button>
          }
        />
      </div>

      {/* ── H-1B Calendar ── */}
      <div style={{ background: "linear-gradient(135deg, #0f1623 0%, #1a2644 100%)", border: "1.5px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: "0.5px", marginBottom: 4 }}>H-1B CAP FY2026 TIMELINE</p>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Registration Opens March 2026</h2>
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 9, background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)", fontSize: 12.5, fontWeight: 700, color: "#93c5fd" }}>
            ⏳ {countdown(nextH1BReg)} away
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Registration Opens", date: "Mar 1, 2026",  color: "#60a5fa", done: false },
            { label: "Registration Closes", date: "Mar 20, 2026", color: "#a78bfa", done: false },
            { label: "Lottery Results",     date: "Apr 1, 2026",  color: "#f59e0b", done: false },
            { label: "H-1B Work Begins",    date: "Oct 1, 2026",  color: "#34d399", done: false },
          ].map(m => (
            <div key={m.label} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, marginBottom: 8 }}/>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{m.label}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{m.date}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add status form ── */}
      {showAdd && (
        <div style={{ background: P.surface, border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 14 }}>Add Visa / Status</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>VISA TYPE</label>
              <select value={newVisa.type} onChange={e => setNewVisa(p => ({ ...p, type: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}>
                {VISA_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>STATUS</label>
              <select value={newVisa.status} onChange={e => setNewVisa(p => ({ ...p, status: e.target.value as VisaEntry["status"] }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}>
                <option value="active">Active</option>
                <option value="pending">Pending / Processing</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>EXPIRY / END DATE</label>
              <input type="date" value={newVisa.expiryDate} onChange={e => setNewVisa(p => ({ ...p, expiryDate: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none", boxSizing: "border-box" as const }}/>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>USCIS RECEIPT # (optional)</label>
              <input value={newVisa.receiptNum || ""} onChange={e => setNewVisa(p => ({ ...p, receiptNum: e.target.value }))} placeholder="e.g. IOE0123456789"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}/>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>GC PRIORITY DATE (if applicable)</label>
              <input type="date" value={newVisa.priority || ""} onChange={e => setNewVisa(p => ({ ...p, priority: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none", boxSizing: "border-box" as const }}/>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: P.hint, display: "block", marginBottom: 4 }}>NOTES</label>
              <input value={newVisa.notes || ""} onChange={e => setNewVisa(p => ({ ...p, notes: e.target.value }))} placeholder="Employer, attorney, case details…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, color: P.text, background: P.surface, outline: "none" }}/>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={addVisa} style={{ padding: "8px 20px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Add</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Active visa cards ── */}
      {visas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {visas.map(v => {
            const vt = VISA_TYPES.find(x => x.id === v.type) || VISA_TYPES[0]
            const sm = STATUS_META[v.status]
            const days = v.expiryDate ? daysUntilExpiry(v.expiryDate) : null
            return (
              <div key={v.id} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: vt.bg, border: `1px solid ${vt.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: vt.color, flexShrink: 0 }}><vt.Icon size={20}/></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 14.5, fontWeight: 700, color: P.text }}>{vt.label}</p>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>
                    {days !== null && days <= 90 && days > 0 && (
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>⚠ {days}d left</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12.5, color: P.muted }}>
                    {v.expiryDate && `Expires ${new Date(v.expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    {v.receiptNum && ` · ${v.receiptNum}`}
                    {v.priority && ` · Priority: ${new Date(v.priority).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    {v.notes && ` · ${v.notes}`}
                  </p>
                </div>
                <button onClick={() => persist(visas.filter(x => x.id !== v.id))} style={{ padding: "4px 8px", borderRadius: 7, border: "none", background: "transparent", color: P.hint, fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Step-by-step process guides ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["h1b","H-1B Process"], ["opt","OPT Timeline"], ["gc","Green Card"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setActiveGuide(activeGuide === k ? null : k)}
              style={{ padding: "8px 16px", borderRadius: 9, border: `1.5px solid ${activeGuide === k ? "var(--accent)" : P.border}`, background: activeGuide === k ? "#eff6ff" : P.surface, color: activeGuide === k ? "var(--accent)" : P.muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {l} {activeGuide === k ? "↑" : "↓"}
            </button>
          ))}
        </div>

        {activeGuide && (
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "20px 22px" }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: P.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
              {activeGuide === "h1b" ? <><Building2 size={15}/> H-1B Cap Process</> : activeGuide === "opt" ? <><GraduationCap size={15}/> OPT / STEM OPT Timeline</> : <><BadgeCheck size={15}/> Green Card (EB-2 / EB-3)</>}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(activeGuide === "h1b" ? H1B_STAGES : activeGuide === "opt" ? OPT_STAGES : GC_STAGES).map((s, i, arr) => (
                <div key={i} style={{ display: "flex", gap: 14, position: "relative" }}>
                  {/* Line */}
                  {i < arr.length - 1 && <div style={{ position: "absolute", left: 16, top: 32, bottom: 0, width: 2, background: s.done ? "#a7f3d0" : "#e4e8ef" }}/>}
                  {/* Dot */}
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: s.done ? "#059669" : P.bg, border: `2px solid ${s.done ? "#059669" : P.border}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                    {s.done
                      ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      : <span style={{ fontSize: 10, fontWeight: 700, color: P.hint }}>{i + 1}</span>
                    }
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 18 : 0, paddingTop: 4 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: s.done ? "#059669" : P.text, marginBottom: 2 }}>{s.label}</p>
                    <p style={{ fontSize: 12.5, color: P.muted }}>{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── AI Immigration Q&A ── */}
      <div style={{ background: "linear-gradient(135deg, #f8fbff 0%, #f5f3ff 100%)", border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Scale size={19}/>
          <p style={{ fontSize: 15, fontWeight: 800, color: P.text }}>Immigration Q&A (AI-powered)</p>
        </div>
        <p style={{ fontSize: 12.5, color: P.muted, marginBottom: 14 }}>Ask general immigration questions. This is not legal advice — always consult a licensed immigration attorney for your specific case.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            "What is cap-gap and how does it work?",
            "Can I work on OPT while my H-1B is pending?",
            "How long does PERM take in 2025?",
            "What is the H-1B premium processing fee?",
          ].map(q => (
            <button key={q} onClick={() => setAiQ(q)} style={{ padding: "5px 11px", borderRadius: 20, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1558a0", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" as const }}>{q}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={aiQ} onChange={e => setAiQ(e.target.value)} placeholder="Ask an immigration question…" onKeyDown={e => e.key === "Enter" && askAI()}
            style={{ flex: 1, padding: "9px 13px", borderRadius: 9, border: "1px solid #bfdbfe", fontSize: 13, color: P.text, background: "#fff", outline: "none" }}/>
          <button onClick={askAI} disabled={!aiQ.trim() || loadingAI} style={{ padding: "9px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", opacity: loadingAI ? 0.7 : 1 }}>
            {loadingAI ? "…" : "Ask"}
          </button>
        </div>

        {aiAnswer && (
          <div style={{ background: "#fff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "14px 16px", fontSize: 13.5, color: P.text, lineHeight: 1.65 }}>
            {aiAnswer}
            <p style={{ fontSize: 11.5, color: P.hint, marginTop: 10, fontStyle: "italic", display: "flex", alignItems: "center", gap: 5 }}><TriangleAlert size={11}/> This is general information only, not legal advice. Consult an immigration attorney for your specific situation.</p>
          </div>
        )}

        {/* Quick reference links */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { label: "USCIS Case Status", href: "https://egov.uscis.gov/casestatus/landing.do" },
            { label: "H-1B Visa Bulletin", href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
            { label: "H-1B Cap Filing Dates", href: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations" },
          ].map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.surface, color: P.muted, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>{l.label} ↗</a>
          ))}
        </div>
      </div>
    </div>
  )
}
