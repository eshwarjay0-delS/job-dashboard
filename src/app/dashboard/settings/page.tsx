"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useTheme, type Accent, type ColorMode } from "../../theme-provider"
import { connectGoogleDrive } from "@/lib/google-auth"
import GmailSync from "@/components/GmailSync"
import { mergeGmailApplications } from "@/lib/applications"
import PageHeader from "@/components/layout/PageHeader"

interface Keys {
  claudeKey: string
  rapidApiKey: string
  usajobsApiKey: string
}

const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: "blue",    label: "Blue",    color: "#1d6fc4" },
  { id: "teal",    label: "Teal",    color: "#0d9488" },
  { id: "violet",  label: "Violet",  color: "#7c3aed" },
  { id: "rose",    label: "Rose",    color: "#e11d48" },
  { id: "amber",   label: "Amber",   color: "#d97706" },
  { id: "emerald", label: "Emerald", color: "#059669" },
]

const MODES: { id: ColorMode; label: string; icon: string }[] = [
  { id: "light",  label: "Light",  icon: "☀️" },
  { id: "dark",   label: "Dark",   icon: "🌙" },
  { id: "system", label: "System", icon: "💻" },
]

// Count tailors used this week (Mon 00:00 → Sun 23:59)
function weekStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))   // ISO Monday
  return d.getTime()
}

function getTailorsUsed(): number {
  try {
    const log: number[] = JSON.parse(localStorage.getItem("jd_tailor_log") || "[]")
    const start = weekStart()
    return log.filter(ts => ts >= start).length
  } catch { return 0 }
}

// Tiny usage-meter bar component
function UsageMeter({ used, max, warn, danger }: { used: number; max: number; warn: number; danger: number }) {
  const pct = Math.min(1, used / max)
  const color = used >= danger ? "#ef4444" : used >= warn ? "#f59e0b" : "var(--accent)"
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        height: 6, borderRadius: 99,
        background: "var(--surface-3)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct * 100}%`,
          background: color,
          borderRadius: 99,
          transition: "width 0.4s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: used >= danger ? "#ef4444" : "var(--text-soft)" }}>
          {used} / {max} used
        </span>
        {used >= danger && (
          <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Limit reached</span>
        )}
        {used >= warn && used < danger && (
          <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Running low</span>
        )}
      </div>
    </div>
  )
}

function DriveSuccessBanner() {
  const params = useSearchParams()
  if (params.get("drive") === "connected")
    return (
      <div className="mb-4 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--success-soft)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
        ✓ Google Drive connected — you can now store up to 78 resumes in your Drive.
      </div>
    )
  if (params.get("drive") === "error")
    return (
      <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger-border)" }}>
        Drive connection failed. Please try again.
      </div>
    )
  return null
}

export default function SettingsPage() {
  const { accent, mode, setAccent, setMode } = useTheme()

  const [keys, setKeys] = useState<Keys>({ claudeKey: "", rapidApiKey: "", usajobsApiKey: "" })
  const [saved, setSaved] = useState(false)
  const [showProBanner, setShowProBanner] = useState(false)
  const [tailorsUsed, setTailorsUsed] = useState(0)
  const [resumeCount, setResumeCount] = useState(0)
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveConnecting, setDriveConnecting] = useState(false)
  const [driveError, setDriveError] = useState("")
  const [resumeLimit, setResumeLimit] = useState(2)

  // Profile fields — loaded from Supabase, used by extension autofill
  // remoteOk/reloOk/startImmediately/hasTransportation/hasClearance are tri-state
  // ("yes" | "no" | "" for not-yet-answered) even though they're booleans in
  // Supabase — matches the string-only shape updateProfile() already expects,
  // and "" lets the extension skip an unanswered question instead of guessing.
  const [profile, setProfile] = useState({
    name: "", phone: "", location: "", linkedin: "", github: "",
    title: "", visaStatus: "", workAuth: "",
    remoteOk: "", reloOk: "", startImmediately: "", hasTransportation: "", hasClearance: "",
  })
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("jd_settings") || "{}")
      setKeys(k => ({ ...k, ...stored }))
    } catch {}
    setTailorsUsed(getTailorsUsed())
    // If user arrived from a pricing CTA, auto-open the upgrade banner and scroll to #plan
    try {
      const plan = sessionStorage.getItem("mf_signup_plan")
      if (plan === "pro" || plan === "agency") {
        sessionStorage.removeItem("mf_signup_plan")
        setShowProBanner(true)
        setTimeout(() => {
          document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 400)
      }
    } catch {}
    // Fetch user resume count + tier from the auth-aware API
    fetch("/api/user-resumes")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setResumeCount(d.count ?? 0)
          setResumeLimit(d.limit ?? 2)
          setDriveConnected(d.driveConnected ?? false)
        }
      })
      .catch(() => {
        // Fall back to shared library count if not signed in
        fetch("/api/resumes")
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.files?.length) setResumeCount(d.files.length) })
          .catch(() => {})
      })
  }, [])

  // Load profile separately so it doesn't block the rest of settings
  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.profile) return
        const p = d.profile
        const triState = (v: unknown) => v === true ? "yes" : v === false ? "no" : ""
        setProfile({
          name:        p.full_name    || "",
          phone:       p.phone        || "",
          location:    p.location     || "",
          linkedin:    p.linkedin     || "",
          github:      p.github       || "",
          title:       p.title        || "",
          visaStatus:  p.visa_status  || "",
          workAuth:    p.work_auth    || "",
          remoteOk:          triState(p.remote_ok),
          reloOk:            triState(p.relo_ok),
          startImmediately:  triState(p.start_immediately),
          hasTransportation: triState(p.has_transportation),
          hasClearance:      triState(p.has_clearance),
        })
        // Hydrate jd_profile so jobs board, NexusPanel, and brief see Supabase data
        // without waiting for a separate API call. Merge to preserve skills/yearsExp
        // that profile/page.tsx writes independently.
        try {
          const existing = JSON.parse(localStorage.getItem("jd_profile") || "{}")
          localStorage.setItem("jd_profile", JSON.stringify({
            ...existing,
            full_name:   p.full_name    || "",
            phone:       p.phone        || "",
            location:    p.location     || "",
            linkedin:    p.linkedin     || "",
            github:      p.github       || "",
            title:       p.title        || "",
            visa_status: p.visa_status  || "",
            work_auth:   p.work_auth    || "",
          }))
        } catch {}
      })
      .catch(() => {})
  }, [])

  async function handleConnectDrive() {
    setDriveConnecting(true)
    setDriveError("")
    const { error } = await connectGoogleDrive()
    if (error) {
      setDriveConnecting(false)
      setDriveError("Could not start Google Drive connection: " + error.message)
    }
    // On success: browser redirects to Google → /auth/callback/drive → back to settings?drive=connected
  }

  function save() {
    localStorage.setItem("jd_settings", JSON.stringify(keys))
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  function update(field: keyof Keys, value: string) {
    setKeys(k => ({ ...k, [field]: value }))
  }

  function updateProfile(field: keyof typeof profile, value: string) {
    setProfile(p => ({ ...p, [field]: value }))
  }

  async function saveProfile() {
    setProfileSaving(true)
    try {
      const fromTriState = (v: string) => v === "yes" ? true : v === "no" ? false : null
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       profile.name,
          phone:      profile.phone,
          location:   profile.location,
          linkedin:   profile.linkedin,
          github:     profile.github,
          title:      profile.title,
          visaStatus: profile.visaStatus,
          workAuth:   profile.workAuth,
          remoteOk:          fromTriState(profile.remoteOk),
          reloOk:            fromTriState(profile.reloOk),
          startImmediately:  fromTriState(profile.startImmediately),
          hasTransportation: fromTriState(profile.hasTransportation),
          hasClearance:      fromTriState(profile.hasClearance),
          profileComplete: !!profile.name,
        }),
      })
      if (r.ok) {
        // Also sync to jd_profile so client-side pages (jobs board, NexusPanel,
        // brief, profile completeness) see it without a page reload.
        try {
          const existing = JSON.parse(localStorage.getItem("jd_profile") || "{}")
          localStorage.setItem("jd_profile", JSON.stringify({
            ...existing,
            full_name:  profile.name,
            phone:      profile.phone,
            location:   profile.location,
            linkedin:   profile.linkedin,
            github:     profile.github,
            title:      profile.title,
            visa_status: profile.visaStatus,
            work_auth:  profile.workAuth,
          }))
        } catch {}
        setProfileSaved(true)
        setTimeout(() => setProfileSaved(false), 2200)
      }
    } catch {}
    setProfileSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Suspense fallback={null}><DriveSuccessBanner/></Suspense>
      <div className="anim-fade-up d-0">
        <PageHeader
          icon="⚙️"
          title="Settings"
          description="Manage your plan, storage, and API keys."
        />
      </div>

      {/* ── Plan & Storage ───────────────────────────────────────── */}
      <div
        className="anim-fade-up d-1 rounded-2xl border overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Plan banner */}
        <div id="plan" style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "var(--surface-2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--accent-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>
              ✦
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Free Plan</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                  padding: "2px 8px", borderRadius: 99,
                  background: "var(--accent-soft)", color: "var(--accent-txt)",
                  textTransform: "uppercase",
                }}>
                  Current
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 2 }}>
                7 tailors / week · {resumeLimit} resumes stored{driveConnected ? " (Drive connected)" : " · Connect Drive for 78"}
              </p>
            </div>
          </div>
          <button
            style={{
              padding: "8px 16px", borderRadius: 10,
              background: "var(--accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
              boxShadow: "0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent)",
              transition: "all var(--t-base)",
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.88" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
            onClick={() => setShowProBanner(true)}
          >
            Upgrade to Pro
          </button>
        </div>

        {/* Pro coming-soon banner */}
        {showProBanner && (
          <div style={{
            margin: "0 24px 4px", padding: "12px 16px", borderRadius: 10,
            background: "linear-gradient(135deg,rgba(124,58,237,.12),rgba(99,102,241,.08))",
            border: "1px solid rgba(124,58,237,.25)",
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🚀</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                Pro plan launching soon
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                Unlimited tailors · Team seats · Priority AI · Advanced analytics
              </p>
            </div>
            <button
              onClick={() => setShowProBanner(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-soft)", fontSize: 16, lineHeight: 1, flexShrink: 0 }}
            >✕</button>
          </div>
        )}

        {/* Usage meters */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Tailors this week */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                AI Tailors this week
              </span>
              <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
                Resets every Monday
              </span>
            </div>
            <UsageMeter used={tailorsUsed} max={7} warn={5} danger={7} />
          </div>

          {/* Resume library */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                Resume library
              </span>
              <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
                Stored on this server
              </span>
            </div>
            <UsageMeter used={resumeCount} max={resumeLimit} warn={Math.floor(resumeLimit * 0.8)} danger={resumeLimit} />
            {!driveConnected && (
              <p style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 6 }}>
                Connect Google Drive in the section below to store up to 78 resumes in your own Drive — still free.
              </p>
            )}
          </div>

          {/* Google Drive */}
          <div style={{
            padding: 16, borderRadius: 12,
            border: driveConnected
              ? "1px solid var(--success-border)"
              : "1px dashed var(--border-strong)",
            background: driveConnected ? "var(--success-soft)" : "var(--surface-2)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Google Drive icon */}
              <svg width="28" height="28" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.6 66.85L1.5 75.6A4.77 4.77 0 005.6 78h76.1a4.77 4.77 0 004.1-2.4l-5.1-8.75z" fill="#0066da"/>
                <path d="M43.65 0L27 29.4l16.65 28.8 16.65-28.8z" fill="#00ac47"/>
                <path d="M81.6 78l5.1-8.75-21.6-37.4h-16.7l21.6 37.4z" fill="#ea4335"/>
                <path d="M6.6 66.85l21.6-37.45h16.7L6.6 66.85z" fill="#00832d"/>
                <path d="M43.65 0L27 29.4H6.6L43.65 0z" fill="#2684fc"/>
                <path d="M86.7 69.25l-21.6-37.4-16.65 28.8L64.8 78l17-9.75z" fill="#ffba00"/>
              </svg>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  Google Drive storage
                </p>
                <p style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 2 }}>
                  {driveConnected
                    ? "Your resumes sync to your personal Drive"
                    : "Store resumes in your own Drive — zero server cost"}
                </p>
              </div>
            </div>
            {driveConnected ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 600, color: "var(--success)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
                Connected
              </div>
            ) : (
              <button
                onClick={handleConnectDrive}
                disabled={driveConnecting}
                style={{
                  padding: "7px 14px", borderRadius: 8,
                  background: driveConnecting ? "var(--surface-3)" : "var(--surface)",
                  border: "1px solid var(--border-strong)",
                  fontSize: 12, fontWeight: 600, color: "var(--text)",
                  cursor: driveConnecting ? "wait" : "pointer",
                  transition: "all var(--t-base)", flexShrink: 0,
                  display: "flex", alignItems: "center", gap: 6,
                }}
                onMouseEnter={e => { if (!driveConnecting) (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)" }}
              >
                {driveConnecting ? (
                  <>
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/>
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                    </svg>
                    Connecting…
                  </>
                ) : "Connect Drive"}
              </button>
            )}
            {driveError && (
              <p className="text-xs mt-2" style={{ color: "var(--error, #dc2626)" }}>{driveError}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Gmail Integration ────────────────────────────────────── */}
      {/* onSync used to be a no-op — the "N added" toast was real (the API
          genuinely parsed that many emails) but nothing ever reached the
          tracker, so Sync Now silently did nothing. Now actually merges. */}
      <div className="anim-fade-up d-2">
        <GmailSync onSync={(apps) => mergeGmailApplications(apps)} />
      </div>

      {/* ── Profile & Work Authorization ─────────────────────────── */}
      {/* Extension autofill reads this via GET /api/profile — if empty, work-auth   */}
      {/* dropdowns on ATS forms never fill. Saved to Supabase profiles table.        */}
      <div
        className="anim-fade-up d-2 rounded-2xl border p-6 space-y-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl logo-mark flex items-center justify-center text-white text-base">
              👤
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: "var(--text)" }}>Profile & Work Authorization</h2>
              <p className="text-sm" style={{ color: "var(--text-soft)" }}>
                Used by the browser extension to autofill ATS forms.
              </p>
            </div>
          </div>
        </div>

        {/* Row 1 — Name + Title */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Full Name",  field: "name"  as const, placeholder: "Eshwar Janjirala" },
            { label: "Job Title",  field: "title" as const, placeholder: "Senior Security Engineer" },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-soft)" }}>
                {label}
              </label>
              <input
                type="text"
                value={profile[field]}
                onChange={e => updateProfile(field, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
              />
            </div>
          ))}
        </div>

        {/* Row 2 — Phone + Location */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Phone",    field: "phone"    as const, placeholder: "+1 (314) 255-9156" },
            { label: "Location", field: "location" as const, placeholder: "St. Louis, MO" },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-soft)" }}>
                {label}
              </label>
              <input
                type="text"
                value={profile[field]}
                onChange={e => updateProfile(field, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
              />
            </div>
          ))}
        </div>

        {/* Row 3 — LinkedIn + GitHub */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "LinkedIn URL", field: "linkedin" as const, placeholder: "linkedin.com/in/jayy-eshwar" },
            { label: "GitHub URL",   field: "github"   as const, placeholder: "github.com/eshwar" },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-soft)" }}>
                {label}
              </label>
              <input
                type="text"
                value={profile[field]}
                onChange={e => updateProfile(field, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
              />
            </div>
          ))}
        </div>

        {/* Row 4 — Work Authorization (most important for extension) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-soft)" }}>
              Work Authorization
            </label>
            <select
              value={profile.workAuth}
              onChange={e => updateProfile("workAuth", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
            >
              <option value="">— Select —</option>
              <option value="U.S. Citizen">U.S. Citizen</option>
              <option value="Green Card">Green Card (GC)</option>
              <option value="H-1B Visa">H-1B Visa</option>
              <option value="OPT">OPT</option>
              <option value="STEM OPT">STEM OPT</option>
              <option value="TN Visa">TN Visa</option>
              <option value="L-1 Visa">L-1 Visa</option>
              <option value="O-1 Visa">O-1 Visa</option>
              <option value="J-1 Visa">J-1 Visa</option>
              <option value="C2C">C2C (Corp-to-Corp)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-soft)" }}>
              Visa / Contract Type
            </label>
            <select
              value={profile.visaStatus}
              onChange={e => updateProfile("visaStatus", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
            >
              <option value="">— Select —</option>
              <option value="gc">GC (Green Card)</option>
              <option value="h1b">H-1B Visa</option>
              <option value="opt">OPT</option>
              <option value="stem_opt">STEM OPT</option>
              <option value="citizen">U.S. Citizen</option>
              <option value="tn">TN Visa</option>
              <option value="c2c">C2C</option>
              <option value="w2">W2</option>
            </select>
          </div>
        </div>

        <div className="p-3 rounded-xl text-xs" style={{
          background: "rgba(20,184,166,.06)", border: "1px solid rgba(20,184,166,.18)", color: "var(--text-muted)",
        }}>
          <strong style={{ color: "var(--text-soft)" }}>Used by extension autofill.</strong>{" "}
          Work Authorization fills ATS dropdowns like "Employment Status" and "Work Eligibility."
          Saved to your account — stays across devices.
        </div>

        {/* ── Application preferences — answer once here, the extension reuses
            the answer on every application's Yes/No screening questions instead
            of asking again each time. Left blank = extension leaves that
            question for you to answer instead of guessing. ── */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-soft)" }}>
            Application Preferences
          </label>
          <div className="space-y-2">
            {([
              { field: "remoteOk" as const,          label: "Open to remote work?" },
              { field: "reloOk" as const,             label: "Willing to relocate?" },
              { field: "startImmediately" as const,   label: "Can you start immediately?" },
              { field: "hasTransportation" as const,  label: "Reliable transportation?" },
              { field: "hasClearance" as const,       label: "Active government security clearance?" },
            ]).map(({ field, label }) => (
              <div key={field} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--text)" }}>{label}</span>
                <div className="flex gap-1.5 flex-shrink-0">
                  {(["yes", "no"] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateProfile(field, profile[field] === v ? "" : v)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold"
                      style={profile[field] === v
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--surface)", color: "var(--text-soft)", border: "1px solid var(--border)" }
                      }
                    >
                      {v === "yes" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={saveProfile}
          disabled={profileSaving}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={profileSaved
            ? { background: "var(--success)", color: "#fff" }
            : { background: "var(--accent)", color: "#fff", opacity: profileSaving ? 0.7 : 1 }
          }
        >
          {profileSaved ? "✓ Profile Saved!" : profileSaving ? "Saving…" : "Save Profile"}
        </button>
      </div>

      {/* ── Theme customizer ─────────────────────────────────────── */}
      <div
        className="anim-fade-up d-2 rounded-2xl border p-6 space-y-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl logo-mark flex items-center justify-center text-white text-base">
            🎨
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Appearance</h2>
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>Theme colour and dark/light mode.</p>
          </div>
        </div>

        {/* Accent picker */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-soft)" }}>
            Accent Color
          </p>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map(a => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: a.color,
                    transform: accent === a.id ? "scale(1.2)" : "scale(1)",
                    boxShadow: accent === a.id
                      ? `0 0 0 3px white, 0 0 0 5px ${a.color}, 0 4px 14px ${a.color}60`
                      : `0 2px 8px ${a.color}40`,
                    transition: "all var(--t-spring)",
                  }}
                >
                  {accent === a.id && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                    </svg>
                  )}
                </span>
                <span
                  className="text-xs font-medium transition-colors"
                  style={{ color: accent === a.id ? a.color : "var(--text-soft)" }}
                >
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode picker */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-soft)" }}>
            Color Mode
          </p>
          <div className="flex gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all"
                style={{
                  background: mode === m.id ? "var(--accent-soft)" : "var(--surface-2)",
                  borderColor: mode === m.id ? "var(--accent-border)" : "var(--border)",
                  color: mode === m.id ? "var(--accent-txt)" : "var(--text-muted)",
                  transform: mode === m.id ? "translateY(-1px)" : "",
                  boxShadow: mode === m.id ? `0 4px 12px color-mix(in srgb, var(--accent) 20%, transparent)` : "",
                  transition: "all var(--t-base)",
                }}
              >
                <span>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live preview strip */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="gradient-strip h-1.5 w-full" />
          <div className="p-3 flex items-center gap-2" style={{ background: "var(--surface-2)" }}>
            <span className="logo-mark w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white">J</span>
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Theme preview</span>
            <span
              className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}
            >
              {accent.charAt(0).toUpperCase() + accent.slice(1)} · {mode}
            </span>
          </div>
        </div>
      </div>

      {/* ── AI Provider — Claude or OpenRouter ───────────────────── */}
      <div
        className="anim-fade-up d-3 rounded-2xl border p-6 space-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>AI Provider — Resume Tailoring</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-soft)" }}>Accepts Anthropic or OpenRouter keys — auto-detected by prefix.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0 ml-4">
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              OpenRouter →
            </a>
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium" style={{ color: "var(--text-soft)" }}>
              Anthropic →
            </a>
          </div>
        </div>

        {/* Key type toggle hint */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "sk-or-…", desc: "OpenRouter", color: "var(--cat-int)", bg: "var(--cat-int-bg)", border: "var(--cat-int-b)" },
            { label: "sk-ant-…", desc: "Anthropic", color: "var(--cat-out)", bg: "var(--cat-out-bg)", border: "var(--cat-out-b)" },
          ].map(t => {
            const active = keys.claudeKey.startsWith(t.label.replace("…",""))
            return (
              <div key={t.label} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
                borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: active ? t.bg : "var(--surface-2)",
                border: `1px solid ${active ? t.border : "var(--border)"}`,
                color: active ? t.color : "var(--text-soft)",
                transition: "all var(--t-base)",
              }}>
                {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color, display: "inline-block" }} />}
                <span style={{ fontFamily: "monospace" }}>{t.label}</span>
                <span style={{ fontWeight: 400 }}>{t.desc}</span>
              </div>
            )
          })}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-soft)" }}>
            API Key
          </label>
          <input
            type="password"
            value={keys.claudeKey}
            onChange={e => update("claudeKey", e.target.value)}
            placeholder="sk-or-… or sk-ant-…"
            className="ring-accent w-full px-4 py-2.5 rounded-xl border text-sm font-mono"
            style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
          />
        </div>

        <div className="p-3 rounded-xl text-xs" style={{
          background: "var(--cat-int-bg)", border: "1px solid var(--cat-int-b)", color: "var(--cat-int)"
        }}>
          <strong>Auto-routed.</strong> Paste either key — the app detects the prefix and calls the right API.
          OpenRouter gives access to Claude Sonnet, GPT-4o, and others on one key.
          ~$0.001–0.003 per tailor either way.
        </div>
      </div>

      {/* ── Live Job Data ─────────────────────────────────────────
          Without these, every job board silently falls back to a small set of
          sample listings — no error shown, they just look like real jobs. Keys
          are saved here (same as the AI key above) and sent per-request; nothing
          to edit in a file, no restart needed. */}
      <div
        className="anim-fade-up d-4 rounded-2xl border p-6 space-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Live Job Data</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-soft)" }}>
              Without a key here, every job board shows sample listings, not real ones.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-soft)" }}>
              RapidAPI Key <span style={{ fontWeight: 400, textTransform: "none" }}>— LinkedIn, Indeed, Glassdoor</span>
            </label>
            <a href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch" target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              Get free key →
            </a>
          </div>
          <input
            type="password"
            value={keys.rapidApiKey}
            onChange={e => update("rapidApiKey", e.target.value)}
            placeholder="Paste your RapidAPI key"
            className="ring-accent w-full px-4 py-2.5 rounded-xl border text-sm font-mono"
            style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-soft)" }}>
            Free sign-up, 200 searches/month at no cost. Sign up → subscribe to the free JSearch plan → copy the key shown there.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-soft)" }}>
              USAJobs API Key <span style={{ fontWeight: 400, textTransform: "none" }}>— federal roles</span>
            </label>
            <a href="https://developer.usajobs.gov/APIRequest" target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              Get free key →
            </a>
          </div>
          <input
            type="password"
            value={keys.usajobsApiKey}
            onChange={e => update("usajobsApiKey", e.target.value)}
            placeholder="Paste your USAJobs key"
            className="ring-accent w-full px-4 py-2.5 rounded-xl border text-sm font-mono"
            style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)", outline: "none" }}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-soft)" }}>
            Free, no approval wait — the key is emailed to you instantly after you submit the form.
          </p>
        </div>
      </div>

      {/* ── Setup guide ──────────────────────────────────────────── */}
      <div
        className="anim-fade-up d-4 rounded-2xl border p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Quick Setup Guide</h2>
        <ol className="space-y-3 text-sm" style={{ color: "var(--text-muted)" }}>
          {[
            { n: "1", t: "Get a RapidAPI key for live jobs", d: "Click \"Get free key\" above → sign up free → subscribe to the free JSearch plan → copy the key shown there. This enables real LinkedIn, Indeed & Glassdoor listings." },
            { n: "2", t: "Get a USAJobs key for federal roles", d: "Click \"Get free key\" above → fill the short form → the key arrives by email instantly, no approval wait." },
            { n: "3", t: "Paste both keys above and click Save", d: "No restart, no file editing. Jobs pages switch from ◎ Sample to ● Live the next time they load." },
            { n: "4", t: "Get a Claude API key", d: "Go to console.anthropic.com → API keys → Create key. Add $5 credits." },
            { n: "5", t: "Paste your Claude key above", d: "Enter it above and click Save — no restart needed." },
            { n: "6", t: "Tailor a resume", d: "Go to My Resume, upload a resume, paste a job description, and click Tailor & Generate." },
          ].map((s, i) => (
            <li key={s.n} className={`flex gap-3 anim-fade-up d-${i + 4}`}>
              <span
                className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "var(--accent)", boxShadow: `0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent)` }}
              >
                {s.n}
              </span>
              <div>
                <p className="font-medium" style={{ color: "var(--text)" }}>{s.t}</p>
                <p className="mt-0.5 whitespace-pre-line" style={{ color: "var(--text-muted)" }}>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Save button */}
      <button
        onClick={save}
        className={`anim-fade-up d-5 w-full py-3 text-sm font-semibold transition-all ${saved ? "" : "btn-accent"}`}
        style={saved
          ? { background: "var(--success)", color: "#fff", borderRadius: "var(--radius)", transform: "scale(1.01)", transition: "all var(--t-spring)" }
          : undefined
        }
      >
        {saved ? "✓ Saved!" : "Save Settings"}
      </button>

      {/* ── Admin panel ──────────────────────────────────────────── */}
      <div
        className="anim-fade-up rounded-2xl border p-5 flex items-center gap-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div style={{ flex: 1 }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Admin Panel</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-soft)" }}>
            Manage candidates, LinkedIn posts, and system-level settings.
          </p>
        </div>
        <a
          href="/dashboard/admin"
          style={{
            padding: "8px 16px", borderRadius: 9,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
            textDecoration: "none", flexShrink: 0,
          }}
        >
          Open Admin →
        </a>
      </div>
    </div>
  )
}
