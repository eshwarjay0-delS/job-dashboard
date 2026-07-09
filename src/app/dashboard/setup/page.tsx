"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const P = {
  surface: "#ffffff", text: "#1a2035", muted: "#6b7a99",
  hint: "#9aa4bc", border: "#e4e8ef", bg: "#f4f6f9",
}

const STEPS = [
  { id: "profile",     label: "Your Profile",     icon: "👤", desc: "Name, title, location, work authorization" },
  { id: "resume",      label: "Resume",            icon: "📄", desc: "Upload your base resume" },
  { id: "gmail",       label: "Connect Gmail",     icon: "📧", desc: "Track email threads with recruiters" },
  { id: "preferences", label: "Job Preferences",  icon: "🎯", desc: "Roles, salary, location, visa filters" },
  { id: "done",        label: "Ready to Go",       icon: "🚀", desc: "Your workspace is set up" },
]

const WORK_AUTHS = ["US Citizen", "Green Card", "H-1B", "OPT (STEM)", "CPT", "TN Visa", "L-1", "Need Sponsorship"]
const ROLES_LIST = ["Software Engineer", "Senior Software Engineer", "Security Engineer", "DevOps / SRE", "ML Engineer", "Data Scientist", "Full Stack Engineer", "Backend Engineer", "Product Manager", "Cloud Architect", "ServiceNow Developer", "Data Engineer"]
const LOCS = ["Remote (US)", "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX", "Chicago, IL", "Boston, MA", "Los Angeles, CA", "Denver, CO"]

interface SetupData {
  full_name: string; title: string; location: string; workAuth: string; email: string; phone: string; linkedin: string
  targetRoles: string[]; targetLocs: string[]; minSalary: string; openToRemote: boolean; yearsExp: string
  resumeUploaded: boolean; gmailConnected: boolean
}

// Maps this wizard's field names to what POST /api/profile (the `profiles` table)
// actually persists — see src/app/api/profile/route.ts. targetLocs has no backing
// column there yet, so it stays localStorage-only rather than silently dropped or
// smuggled into an unrelated field.
function toProfileBody(d: SetupData, profileComplete: boolean) {
  return {
    name: d.full_name || undefined,
    title: d.title || undefined,
    phone: d.phone || undefined,
    location: d.location || undefined,
    linkedin: d.linkedin || undefined,
    workAuth: d.workAuth || undefined,
    remoteOk: d.openToRemote,
    salaryMin: d.minSalary ? Number(d.minSalary) : undefined,
    openToRoles: d.targetRoles.length ? d.targetRoles : undefined,
    profileComplete,
  }
}

const DEFAULT: SetupData = {
  full_name: "", title: "", location: "", workAuth: "", email: "", phone: "", linkedin: "",
  targetRoles: [], targetLocs: [], minSalary: "", openToRemote: true, yearsExp: "",
  resumeUploaded: false, gmailConnected: false,
}

function StepDot({ index, current, done }: { index: number; current: number; done: boolean }) {
  const isActive = index === current
  const isPast   = done || index < current
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", flex: 1, position: "relative" as const }}>
      {index > 0 && (
        <div style={{ position: "absolute" as const, top: 16, right: "50%", left: "-50%", height: 2, background: isPast && index <= current ? "var(--accent)" : P.border, zIndex: 0 }}/>
      )}
      <div style={{
        width: 34, height: 34, borderRadius: "50%", border: `2px solid ${isActive ? "var(--accent)" : isPast ? "var(--accent)" : P.border}`,
        background: isPast ? "var(--accent)" : isActive ? "#eff6ff" : P.surface,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1,
        transition: "all .2s",
      }}>
        {isPast && !isActive
          ? <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          : <span style={{ fontSize: 14 }}>{STEPS[index].icon}</span>
        }
      </div>
      <p style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--accent)" : P.muted, marginTop: 5, textAlign: "center" as const, whiteSpace: "nowrap" as const }}>{STEPS[index].label}</p>
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep]       = useState(0)
  const [data, setData]       = useState<SetupData>(DEFAULT)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState("")
  const [gmailLoading, setGmailLoading] = useState(false)

  useEffect(() => {
    // Restore any existing profile
    try {
      const p = JSON.parse(localStorage.getItem("jd_profile") || "{}")
      if (p && Object.keys(p).length) {
        setData(d => ({ ...d, ...p }))
      }
    } catch {}
    // Restore setup progress
    try {
      const s = parseInt(localStorage.getItem("jd_setup_step") || "0", 10)
      if (s > 0 && s < STEPS.length - 1) setStep(s)
    } catch {}
  }, [])

  function save(patch: Partial<SetupData>) {
    const next = { ...data, ...patch }
    setData(next)
    localStorage.setItem("jd_profile", JSON.stringify(next))
  }

  // Persist to the real `profiles` table (fire-and-forget on intermediate steps;
  // the final call on Finish is awaited so profile_complete is true before the
  // user can navigate away — that flag is what the auth-callback redirect and the
  // sidebar's straggler-catch (Phase 1A) key off of).
  async function syncProfile(current: SetupData, complete: boolean) {
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toProfileBody(current, complete)),
      })
    } catch { /* best-effort; localStorage still has the data for this session */ }
  }

  async function uploadResume(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setResumeError("Only .docx resumes can be stored right now — re-export from Word/Google Docs as .docx.")
      return
    }
    setResumeUploading(true)
    setResumeError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/resumes", { method: "POST", body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body.error) {
        setResumeError(body.error || "Upload failed — try again.")
        setResumeUploading(false)
        return
      }
      setResumeFile(file)
      save({ resumeUploaded: true })
    } catch {
      setResumeError("Upload failed — check your connection and try again.")
    }
    setResumeUploading(false)
  }

  function advance() {
    const next = Math.min(step + 1, STEPS.length - 1)
    setStep(next)
    localStorage.setItem("jd_setup_step", String(next))
    const finishing = next === STEPS.length - 1
    syncProfile(data, finishing)
  }

  function toggleRole(r: string) {
    const arr = data.targetRoles.includes(r) ? data.targetRoles.filter(x => x !== r) : [...data.targetRoles, r]
    save({ targetRoles: arr })
  }
  function toggleLoc(l: string) {
    const arr = data.targetLocs.includes(l) ? data.targetLocs.filter(x => x !== l) : [...data.targetLocs, l]
    save({ targetLocs: arr })
  }

  const pct = Math.round((step / (STEPS.length - 1)) * 100)

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ textAlign: "center" as const, marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: P.text, letterSpacing: "-0.4px", marginBottom: 6 }}>Set Up Your Workspace</h1>
        <p style={{ fontSize: 13.5, color: P.muted }}>Takes about 3 minutes. You can always update everything in Settings later.</p>
      </div>

      {/* ── Step progress ── */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 28, padding: "0 10px" }}>
        {STEPS.map((s, i) => <StepDot key={s.id} index={i} current={step} done={i < step}/>)}
      </div>

      {/* ── Progress bar ── */}
      <div style={{ height: 4, borderRadius: 9, background: P.border, marginBottom: 28, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9, background: "var(--accent)", transition: "width .4s ease" }}/>
      </div>

      {/* ── Step content ── */}
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: "28px 32px" }}>

        {/* STEP 0: Profile */}
        {step === 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <span style={{ fontSize: 26 }}>👤</span>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: P.text }}>Tell us about yourself</p>
                <p style={{ fontSize: 13, color: P.muted }}>This pre-fills your resume and autofill extension.</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { key: "full_name", label: "Full Name *",         placeholder: "Eshwar Janjirala",          type: "text" },
                { key: "title",     label: "Current Title *",     placeholder: "Senior Security Engineer",  type: "text" },
                { key: "email",     label: "Email *",             placeholder: "you@email.com",             type: "email" },
                { key: "phone",     label: "Phone",               placeholder: "(314) 555-0192",            type: "tel" },
                { key: "location",  label: "Current Location",    placeholder: "St. Louis, MO",             type: "text" },
                { key: "yearsExp",  label: "Years of Experience", placeholder: "8",                         type: "number" },
                { key: "linkedin",  label: "LinkedIn URL",        placeholder: "linkedin.com/in/yourname",  type: "url" },
              ].map(f => (
                <div key={f.key} style={f.key === "linkedin" ? { gridColumn: "1 / -1" } : {}}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={(data as any)[f.key]}
                    onChange={e => save({ [f.key]: e.target.value } as any)}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.bg, outline: "none", boxSizing: "border-box" as const }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 6 }}>WORK AUTHORIZATION *</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {WORK_AUTHS.map(w => (
                  <button key={w} onClick={() => save({ workAuth: w })}
                    style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${data.workAuth === w ? "var(--accent)" : P.border}`, background: data.workAuth === w ? "#eff6ff" : P.surface, color: data.workAuth === w ? "var(--accent)" : P.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Resume */}
        {step === 1 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <span style={{ fontSize: 26 }}>📄</span>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: P.text }}>Upload your resume</p>
                <p style={{ fontSize: 13, color: P.muted }}>Used by AI Tailor, autofill, and ATS scoring.</p>
              </div>
            </div>

            {data.resumeUploaded ? (
              <div style={{ padding: "20px 24px", borderRadius: 14, background: "#ecfdf5", border: "1.5px solid #a7f3d0", display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>✅</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{resumeFile?.name || "Resume"} uploaded!</p>
                  <p style={{ fontSize: 12.5, color: P.muted }}>Stored in your resume library — ready for AI Tailor, autofill, and ATS scoring.</p>
                </div>
                <button onClick={() => { save({ resumeUploaded: false }); setResumeFile(null); setResumeError("") }} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 7, border: "1px solid #a7f3d0", background: "transparent", color: "#059669", fontSize: 12, cursor: "pointer" }}>Replace</button>
              </div>
            ) : (
              <label style={{ display: "block", cursor: resumeUploading ? "wait" : "pointer" }}>
                <div style={{ border: `2px dashed ${P.border}`, borderRadius: 14, padding: "40px 32px", textAlign: "center" as const, background: P.bg, transition: "border-color .2s", opacity: resumeUploading ? 0.6 : 1 }}
                  onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)" }}
                  onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = P.border }}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !resumeUploading) uploadResume(f) }}>
                  <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>{resumeUploading ? "⏳" : "📤"}</span>
                  <p style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 4 }}>{resumeUploading ? "Uploading…" : "Drop your resume here"}</p>
                  <p style={{ fontSize: 13, color: P.muted, marginBottom: 10 }}>or click to browse</p>
                  <span style={{ padding: "8px 18px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700 }}>Choose File</span>
                  <p style={{ fontSize: 11.5, color: P.hint, marginTop: 10 }}>DOCX only — max 5MB</p>
                </div>
                <input type="file" accept=".docx" disabled={resumeUploading} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadResume(f) }}/>
              </label>
            )}
            {resumeError && (
              <p style={{ fontSize: 12.5, color: "#dc2626", marginTop: 10 }}>⚠ {resumeError}</p>
            )}

            <div style={{ padding: "14px 16px", borderRadius: 10, background: P.bg, border: `1px solid ${P.border}`, marginTop: 14 }}>
              <p style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.6 }}>
                💡 <strong>Tip:</strong> Upload your most recent generic resume here. The AI Tailor feature will create role-specific versions on demand — you don't need to upload multiple files.
              </p>
            </div>

            <button onClick={() => { advance() }} style={{ marginTop: 16, width: "100%", padding: "9px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, cursor: "pointer" }}>
              Skip for now →
            </button>
          </div>
        )}

        {/* STEP 2: Gmail */}
        {step === 2 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <span style={{ fontSize: 26 }}>📧</span>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: P.text }}>Connect Gmail</p>
                <p style={{ fontSize: 13, color: P.muted }}>Automatically surface recruiter emails and track reply rates.</p>
              </div>
            </div>

            {data.gmailConnected ? (
              <div style={{ padding: "20px 24px", borderRadius: 14, background: "#ecfdf5", border: "1.5px solid #a7f3d0", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 28 }}>✅</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>Gmail connected!</p>
                  <p style={{ fontSize: 12.5, color: P.muted }}>Recruiter emails will appear in the Emails section.</p>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {[
                    { icon: "🔍", label: "Auto-detect recruiter emails" },
                    { icon: "📊", label: "Track reply rates" },
                    { icon: "⚡", label: "Pipeline auto-updates" },
                  ].map(f => (
                    <div key={f.label} style={{ padding: "14px", borderRadius: 12, background: P.bg, border: `1px solid ${P.border}`, textAlign: "center" as const }}>
                      <span style={{ fontSize: 24, display: "block", marginBottom: 6 }}>{f.icon}</span>
                      <p style={{ fontSize: 12, color: P.muted, lineHeight: 1.4 }}>{f.label}</p>
                    </div>
                  ))}
                </div>
                <button
                  disabled={gmailLoading}
                  onClick={async () => {
                    setGmailLoading(true)
                    try {
                      const { connectGmail } = await import("@/lib/google-auth")
                      await connectGmail()
                      save({ gmailConnected: true })
                    } catch { /* user cancelled */ }
                    setGmailLoading(false)
                  }}
                  style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.08)", fontSize: 14, fontWeight: 700, color: "#3c4043", cursor: gmailLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  {gmailLoading ? "Connecting…" : "Connect with Google"}
                </button>
              </>
            )}

            <button onClick={advance} style={{ marginTop: 14, width: "100%", padding: "9px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, cursor: "pointer" }}>
              Skip for now →
            </button>
          </div>
        )}

        {/* STEP 3: Job Preferences */}
        {step === 3 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <span style={{ fontSize: 26 }}>🎯</span>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: P.text }}>Job Preferences</p>
                <p style={{ fontSize: 13, color: P.muted }}>Personalizes Recommended Jobs and sets alert defaults.</p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 6 }}>TARGET ROLES (pick all that apply)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {ROLES_LIST.map(r => (
                  <button key={r} onClick={() => toggleRole(r)}
                    style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${data.targetRoles.includes(r) ? "var(--accent)" : P.border}`, background: data.targetRoles.includes(r) ? "#eff6ff" : P.surface, color: data.targetRoles.includes(r) ? "var(--accent)" : P.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 6 }}>PREFERRED LOCATIONS</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {LOCS.map(l => (
                  <button key={l} onClick={() => toggleLoc(l)}
                    style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${data.targetLocs.includes(l) ? "var(--accent)" : P.border}`, background: data.targetLocs.includes(l) ? "#eff6ff" : P.surface, color: data.targetLocs.includes(l) ? "var(--accent)" : P.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 4 }}>MINIMUM SALARY (USD)</label>
                <input type="number" value={data.minSalary} onChange={e => save({ minSalary: e.target.value })} placeholder="e.g. 130000"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.bg, outline: "none", boxSizing: "border-box" as const }}/>
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: P.hint, display: "block", marginBottom: 4 }}>OPEN TO REMOTE?</label>
                <div style={{ display: "flex", gap: 8, height: 38 }}>
                  {[true, false].map(v => (
                    <button key={String(v)} onClick={() => save({ openToRemote: v })}
                      style={{ flex: 1, borderRadius: 9, border: `1.5px solid ${data.openToRemote === v ? "var(--accent)" : P.border}`, background: data.openToRemote === v ? "#eff6ff" : P.surface, color: data.openToRemote === v ? "var(--accent)" : P.muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {v ? "Yes ✓" : "On-site"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 4 && (
          <div style={{ textAlign: "center" as const, padding: "16px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: P.text, letterSpacing: "-0.4px", marginBottom: 8 }}>You're all set!</h2>
            <p style={{ fontSize: 14, color: P.muted, marginBottom: 28, maxWidth: 380, margin: "0 auto 28px" }}>
              Your workspace is ready. Head to the dashboard to see personalized job recommendations and start tracking applications.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28, textAlign: "left" as const }}>
              {[
                { icon: "⭐", label: "Recommended Jobs", href: "/dashboard/recommended", desc: "AI-matched to your profile" },
                { icon: "📊", label: "Pipeline",          href: "/dashboard/applications", desc: "Track every application" },
                { icon: "✉️", label: "Cover Letters",     href: "/dashboard/cover-letters", desc: "AI-generated in 30 seconds" },
              ].map(l => (
                <a key={l.href} href={l.href} style={{ padding: "14px", borderRadius: 12, background: P.bg, border: `1px solid ${P.border}`, textDecoration: "none", display: "block" }}>
                  <span style={{ fontSize: 22, display: "block", marginBottom: 6 }}>{l.icon}</span>
                  <p style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 3 }}>{l.label}</p>
                  <p style={{ fontSize: 12, color: P.muted }}>{l.desc}</p>
                </a>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <a href="/dashboard" style={{ padding: "11px 28px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                Go to Dashboard →
              </a>
              <a href="/dashboard/settings" style={{ padding: "11px 20px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.surface, color: P.muted, fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
                Settings
              </a>
            </div>
          </div>
        )}

        {/* ── Nav buttons ── */}
        {step < 4 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 20, borderTop: `1px solid ${P.border}` }}>
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              style={{ padding: "9px 18px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.muted, fontSize: 13, fontWeight: 600, cursor: step === 0 ? "default" : "pointer", opacity: step === 0 ? 0.4 : 1 }}>
              ← Back
            </button>
            <div style={{ fontSize: 12, color: P.hint }}>Step {step + 1} of {STEPS.length}</div>
            <button onClick={advance}
              style={{ padding: "9px 24px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 800, border: "none", cursor: "pointer" }}>
              {step === STEPS.length - 2 ? "Finish Setup 🚀" : "Continue →"}
            </button>
          </div>
        )}
      </div>

      {/* ── Completion summary outside the card ── */}
      {step < 4 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18, flexWrap: "wrap" as const }}>
          {[
            { label: "Profile", done: !!(data.full_name && data.email && data.workAuth) },
            { label: "Resume",  done: data.resumeUploaded },
            { label: "Gmail",   done: data.gmailConnected },
            { label: "Prefs",   done: data.targetRoles.length > 0 },
          ].map(s => (
            <div key={s.label} style={{ padding: "4px 12px", borderRadius: 20, background: s.done ? "#ecfdf5" : P.bg, border: `1px solid ${s.done ? "#a7f3d0" : P.border}`, fontSize: 12, fontWeight: 600, color: s.done ? "#059669" : P.hint }}>
              {s.done ? "✓" : "○"} {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
