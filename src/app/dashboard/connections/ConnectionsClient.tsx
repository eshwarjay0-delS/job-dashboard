"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Mail, CalendarDays, Link2, Plus, ArrowRight } from "lucide-react"
import { connectGmail } from "@/lib/google-auth"
import { checkGmailRead } from "@/lib/connectionCheck"
import GoogleConsentExplainer from "./GoogleConsentExplainer"
import ConnectedWrap from "./ConnectedWrap"
import "./connections.css"

type GoogleAccount = {
  id: string
  google_email: string
  gmail_enabled: boolean
  calendar_enabled: boolean
  is_primary: boolean
  connected_at: string
  updated_at: string
}

type ConnectionStatus = {
  google: {
    accounts: GoogleAccount[]
    maxAccounts: number
    canAdd: boolean
  }
  whatsapp: {
    phoneVerified: boolean
    phoneLast4: string | null
    optedIn: boolean
    systemReady: boolean
    systemConfigured?: boolean
    providerState?: string
    webhookState?: string
    connected: boolean
    label: string | null
  }
}

const EMPTY: ConnectionStatus = {
  google: { accounts: [], maxAccounts: 4, canAdd: true },
  whatsapp: { phoneVerified: false, phoneLast4: null, optedIn: false, systemReady: false, connected: false, label: null },
}

function googleErrorMessage(code: string | null) {
  if (!code) return null
  const messages: Record<string, string> = {
    access_denied: "Google did not grant access. If this OAuth app is still in Testing, this Google address must be added as a test user.",
    redirect_uri_mismatch: "Google rejected the callback URL. Add the MarketFit callback URL to this OAuth client in Google Cloud.",
    limit_reached: "This MarketFit account already has four Google accounts connected.",
    already_linked: "That Google account is already linked to another MarketFit account.",
    refresh_token_missing: "Google did not return offline access. Reconnect and approve the requested access.",
    token_exchange_failed: "Google authorization completed, but MarketFit could not exchange the authorization code.",
    account_verification_failed: "MarketFit could not verify the Google account after authorization.",
    server_not_configured: "Google account linking is not configured on the server.",
    invalid_state: "The Google connection attempt expired. Start the connection again.",
    session_mismatch: "Your MarketFit login changed while Google was connecting. Try again.",
    save_failed: "Google authorized access, but MarketFit could not save the connection.",
  }
  return messages[code] || `Google connection failed: ${decodeURIComponent(code)}`
}

const PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: "full_name", label: "Full name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "work_auth", label: "Work authorization" },
  { key: "availability", label: "Availability" },
  { key: "interview_availability", label: "Interview availability" },
  { key: "education", label: "Education" },
  { key: "total_experience", label: "Total experience" },
  { key: "relevant_experience", label: "Relevant experience" },
  { key: "employer_name", label: "Employer name" },
  { key: "employer_contact_name", label: "Employer contact name" },
  { key: "employer_contact_phone", label: "Employer contact phone" },
  { key: "rate_default", label: "Default rate" },
  { key: "notes", label: "Notes" },
]

const PRIVATE_FIELDS: { key: string; label: string }[] = [
  { key: "ssn_last4", label: "SSN (last 4)" },
  { key: "dob", label: "Date of birth" },
  { key: "passport_no", label: "Passport number" },
  { key: "dl_number", label: "Driver's license number" },
  { key: "dl_state", label: "DL state" },
]

/** Per-account Smart Reply profile editor, living inside the account card. */
function ReplyProfileEditor({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (loaded) return
    try {
      const res = await fetch(`/api/candidate-profiles?account=${encodeURIComponent(email)}`, { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not load profile.")
      const p = (body.profile || {}) as Record<string, unknown>
      const v: Record<string, string> = {}
      for (const f of [...PROFILE_FIELDS, ...PRIVATE_FIELDS]) {
        v[f.key] = typeof p[f.key] === "string" ? (p[f.key] as string) : ""
      }
      setValues(v)
      setLoaded(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function save() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/candidate-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_email: email, ...values }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not save profile.")
      setMessage("Saved — inbox suggestion chips will use these details.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="conn-profile">
      <button
        type="button"
        onClick={() => void toggle()}
        className="btn-outline"
        style={{ minHeight: 38, padding: "0 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}
      >
        {open ? "Hide reply profile" : "Reply profile"}
      </button>
      {open && (
        <div>
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Smart Reply fills inbox suggestion chips from this profile. You always approve the draft before anything sends.
          </p>
          <div className="conn-profile-grid">
            {[...PROFILE_FIELDS, ...PRIVATE_FIELDS].map(f => (
              <label key={f.key}>
                {f.label}
                <input
                  value={values[f.key] || ""}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          {message && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-muted)" }}>{message}</div>}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="btn-accent"
              style={{ minHeight: 42, padding: "0 18px", borderRadius: 999, fontWeight: 700 }}
            >
              {saving ? "Saving…" : "Save reply profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function initials(email: string) {
  const name = email.split("@")[0].replace(/[._-]+/g, " ").trim()
  const parts = name.split(" ").filter(Boolean)
  return ((parts[0]?.[0] || "G") + (parts[1]?.[0] || "")).toUpperCase()
}

function connectedDate(iso: string) {
  const d = new Date(iso)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : ""
}

export default function ConnectionsClient() {
  const params = useSearchParams()
  const [status, setStatus] = useState<ConnectionStatus>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch("/api/connections/status", { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not load connections.")
      setStatus(body)
    } catch (e) {
      setLoadError(true)
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [syncError, setSyncError] = useState("")
  const [showConsentModal, setShowConsentModal] = useState(false)
  const attemptedSync = useRef(false)
  const checkGmail = useCallback(async () => {
    setSyncing(true)
    setSyncError("")
    setSyncDone(false)
    try {
      if (!(await checkGmailRead())) throw new Error("Gmail could not be read.")
      setSyncDone(true)
    } catch {
      setSyncError("Gmail could not be read. Retry, or reconnect the account if Google access was revoked.")
    } finally {
      setSyncing(false)
    }
  }, [])
  useEffect(() => {
    if (params.get("google") !== "connected" || attemptedSync.current) return
    attemptedSync.current = true
    void checkGmail()
  }, [params, checkGmail])

  const callbackMessage = useMemo(() => {
    if (params.get("google") === "connected") return null
    return googleErrorMessage(params.get("google_error"))
  }, [params])

  async function setPrimary(accountId: string) {
    setBusy(accountId)
    setMessage("")
    try {
      const res = await fetch("/api/identity/google-workspace/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not change the primary account.")
      await load()
      setMessage("Primary Google account updated.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy("")
    }
  }

  async function disconnect(accountId: string) {
    if (!window.confirm("Disconnect this Google account from MarketFit?")) return
    setBusy(accountId)
    setMessage("")
    try {
      const res = await fetch("/api/identity/google-workspace/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not disconnect the Google account.")
      await load()
      setMessage("Google account disconnected.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy("")
    }
  }

  const googleAccounts = status.google.accounts
  const wa = status.whatsapp
  const justConnected = params.get("google") === "connected"

  return (
    <div className="mf-home conn-redesign">
      <header className="mf-home-heading">
        <p className="mf-eyebrow">CONNECTED ACCOUNTS</p>
        <h1>Your inboxes, one place.</h1>
        <p>
          {googleAccounts.length === 0
            ? "Connect your Gmail and MarketFit reads your job emails — RTRs, rates, interviews, follow-ups. Nothing else here works without it."
            : `${googleAccounts.length} of ${status.google.maxAccounts} Google accounts connected. Sends and drafts use your primary account unless you pick another.`}
        </p>
      </header>

      {justConnected && (
        <ConnectedWrap
          email={params.get("email")}
          canAddMore={status.google.canAdd}
          onAddAnother={() => setShowConsentModal(true)}
        />
      )}

      {/* Status pipeline */}
      {!loading && !loadError && googleAccounts.length > 0 && !justConnected && (
        <div className="conn-status-strip" role="status">
          <div className="conn-status-step done">
            <span className="conn-status-dot">✓</span>
            <div><strong>Connected</strong><small>{googleAccounts.length} Google grant{googleAccounts.length === 1 ? "" : "s"} saved</small></div>
          </div>
          <span className="conn-status-link">→</span>
          <div className={`conn-status-step ${syncing ? "active" : syncDone ? "done" : ""}`}>
            <span className="conn-status-dot">{syncDone ? "✓" : "2"}</span>
            <div>
              <strong>Gmail access</strong>
              <small>{syncing ? "Checking…" : syncDone ? "Verified — your mail is readable" : syncError ? "Couldn't be verified" : "Checked when you open your inbox"}</small>
            </div>
          </div>
          <span className="conn-status-link">→</span>
          <div className="conn-status-step">
            <span className="conn-status-dot">3</span>
            <div><strong>Your inbox</strong><small>Sorted into RTRs, rates, interviews</small></div>
          </div>
          <div className="conn-status-actions">
            {syncError
              ? <button className="btn-outline" style={{ minHeight: 40 }} onClick={() => void checkGmail()}>Retry check</button>
              : <Link href="/dashboard/mail" className="btn-outline" style={{ minHeight: 40, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Open inbox <ArrowRight size={15} style={{ marginLeft: 6 }} />
                </Link>}
          </div>
        </div>
      )}

      {(callbackMessage || message) && (
        <div className="conn-status-strip" role="alert" style={{ borderLeft: "3px solid var(--danger)" }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            {message || callbackMessage}
            {loadError && (
              <div style={{ marginTop: 8 }}>
                <button className="btn-outline" style={{ minHeight: 38 }} onClick={() => void load()}>Retry status check</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accounts */}
      <section aria-label="Google accounts" style={{ marginTop: 8 }}>
        <div className="conn-section-title">
          <div>
            <h2>Google accounts</h2>
            <p>Each card is one Gmail + Calendar grant. The reply profile inside powers Smart Reply for that inbox.</p>
          </div>
          <span className="conn-count-pill">{googleAccounts.length} / {status.google.maxAccounts}</span>
        </div>

        <div className="conn-grid">
          {loading ? (
            <div className="conn-card" style={{ padding: 24, color: "var(--text-muted)", fontSize: 13.5 }}>
              Checking your Google connections…
            </div>
          ) : loadError ? (
            <div className="conn-card" style={{ padding: 24, fontSize: 13.5 }}>
              Saved accounts couldn&apos;t be loaded.
              <div style={{ marginTop: 10 }}>
                <button className="btn-outline" style={{ minHeight: 38 }} onClick={() => void load()}>Retry</button>
              </div>
            </div>
          ) : (
            <>
              {googleAccounts.map(account => (
                <article key={account.id} className={`conn-card${account.is_primary ? " is-primary" : ""}`}>
                  <div className="conn-card-top">
                    <div className="conn-avatar" aria-hidden="true">{initials(account.google_email)}</div>
                    <div className="conn-card-id">
                      <div className="conn-email">{account.google_email}</div>
                      <div className="conn-since">Connected {connectedDate(account.connected_at)}</div>
                      <div className="conn-badges">
                        {account.is_primary && <span className="conn-badge primary">Primary</span>}
                        <span className={`conn-badge${account.gmail_enabled ? " on" : ""}`}>
                          <Mail size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Gmail
                        </span>
                        <span className={`conn-badge${account.calendar_enabled ? " on" : ""}`}>
                          <CalendarDays size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Calendar
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="conn-card-actions">
                    {!account.is_primary && (
                      <button disabled={busy === account.id} onClick={() => void setPrimary(account.id)} className="btn-outline">
                        Make primary
                      </button>
                    )}
                    <button disabled={busy === account.id} onClick={() => void disconnect(account.id)} className="conn-danger">
                      Disconnect
                    </button>
                  </div>
                  <ReplyProfileEditor email={account.google_email} />
                </article>
              ))}
              {status.google.canAdd && (
                <button
                  className="conn-add-card"
                  disabled={loading || loadError}
                  onClick={() => setShowConsentModal(true)}
                >
                  <span className="plus"><Plus size={22} /></span>
                  Add Google account
                  <small>{googleAccounts.length === 0
                    ? "Connect your first Gmail — everything else unlocks after this."
                    : `${status.google.maxAccounts - googleAccounts.length} slot${status.google.maxAccounts - googleAccounts.length === 1 ? "" : "s"} left`}</small>
                </button>
              )}
            </>
          )}
        </div>

        <div className="conn-perms">
          <div><strong>Gmail read</strong><span>Finds your job emails, recruiter replies, and interview invites.</span></div>
          <div><strong>Gmail send</strong><span>Only ever used when you tap approve on a reply — nothing sends on its own.</span></div>
          <div><strong>Calendar read</strong><span>Spots interview and recruiting events.</span></div>
        </div>
      </section>

      {/* Other channels */}
      <section className="conn-channels" aria-label="Other channels">
        <div className="conn-section-title" style={{ marginBottom: 12 }}>
          <div>
            <h2>Other channels</h2>
          </div>
        </div>
        <div className="conn-channel">
          <div className="conn-avatar" aria-hidden="true"><Link2 size={17} /></div>
          <div className="conn-channel-info">
            <strong>WhatsApp — {loadError ? "unknown" : wa.connected ? "linked" : "needs setup"}</strong>
            <small>
              {loadError
                ? "Status couldn't be loaded."
                : wa.connected
                  ? `Verified ${wa.label || ""} · opted in`
                  : "Verify your number and choose WhatsApp during setup to link it."}
            </small>
          </div>
          {!wa.connected && !loadError && (
            <Link href="/dashboard/setup" className="btn-outline" style={{ minHeight: 40, display: "inline-flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap" }}>
              Open setup
            </Link>
          )}
        </div>
        <div className="conn-channel" style={{ opacity: 0.75 }}>
          <div className="conn-avatar" aria-hidden="true">in</div>
          <div className="conn-channel-info">
            <strong>LinkedIn — coming soon</strong>
            <small>MarketFit won&apos;t pretend it&apos;s connected until there&apos;s a real integration.</small>
          </div>
        </div>
      </section>

      {showConsentModal && (
        <GoogleConsentExplainer
          onContinue={() => { setShowConsentModal(false); void connectGmail("/dashboard/connections") }}
          onCancel={() => setShowConsentModal(false)}
        />
      )}
    </div>
  )
}
