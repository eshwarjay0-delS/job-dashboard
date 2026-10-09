"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { connectGmail } from "@/lib/google-auth"
import { checkGmailRead } from "@/lib/connectionCheck"
import PageIntro from "../_components/page-intro"
import MetricHero from "../_components/metric-hero"
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

function googleErrorMessage(code: string | null) {  if (!code) return null
  const messages: Record<string,string> = {
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

/** Per-account Smart Reply profile editor. The user fills in their own
 *  details (including sensitive ones); drafts are only ever pre-filled,
 *  and nothing sends without their explicit approval in the inbox. */
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
      setMessage("Reply profile saved. Suggestion chips in your inbox will use these details.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const field = (f: { key: string; label: string }) => (
    <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
      {f.label}
      <input
        value={values[f.key] || ""}
        onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
        style={{ height: 36, padding: "0 10px", borderRadius: 10, border: "1px solid var(--border-strong)", fontSize: 13.5, color: "var(--text)", background: "var(--surface)" }}
      />
    </label>
  )

  return (
    <div style={{ padding: "12px 24px 16px", borderBottom: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => void toggle()}
        className="btn-outline"
        style={{ minHeight: 38, padding: "0 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}
      >
        {open ? "Hide reply profile" : "Reply profile"}
      </button>
      {open && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Smart Reply fills inbox suggestion chips from this profile for {email}. Fill in whatever you want
            auto-filled — you always approve the draft before anything sends.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {PROFILE_FIELDS.map(field)}
          </div>
          <div style={{ border: "1px solid var(--border-strong)", borderRadius: 12, padding: 14, background: "var(--surface-2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Private details</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
              Stored in your Supabase, only you see them. Used only to pre-fill drafts you approve.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {PRIVATE_FIELDS.map(field)}
            </div>
          </div>
          {message && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{message}</div>}
          <div>
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

  // A saved OAuth grant is separate from a successful Gmail request. Check once;
  // failures are explicit and retry only when the person asks.
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [syncError, setSyncError] = useState("")
  const attemptedSync = useRef(false)
  const checkGmail = useCallback(async () => {
    setSyncing(true)
    setSyncError("")
    setSyncDone(false)
    try {
      if (!(await checkGmailRead())) throw new Error("Gmail could not be read. Retry, or reconnect the account if Google access was revoked.")
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

  const syncMessage = syncing
    ? "Checking Gmail access…"
    : syncDone
      ? "Gmail access verified. Open your inbox to load your mail. Calendar access is checked separately when you open it."
      : syncError || null

  const callbackMessage = useMemo(() => {
    if (params.get("google") === "connected") {
      const email = params.get("email")
      return email ? `${email} is now connected.` : "Google account connected."
    }
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

  return (
    <div className="conn-page">
      <PageIntro
        page="/dashboard/connections"
        action={{ label: googleAccounts.length < status.google.maxAccounts ? "Add Google account" : "Review accounts", href: "#google-accounts" }}
        sample={loadError ? "Connection status could not be checked." : loading ? "Checking your connected accounts…" : `${googleAccounts.length} Google account${googleAccounts.length === 1 ? "" : "s"} saved · WhatsApp ${wa.connected ? "linked" : "needs attention"}.`}
      />

      {!loading && !loadError && (
        <MetricHero
          why={
            googleAccounts.length === 0
              ? "This is where you connect your Gmail. Without it, MarketFit can't read your job emails — nothing else here works."
              : googleAccounts.length >= status.google.maxAccounts
                ? "This is where you connect your Gmail. You're at the max — 4 saved Google grants. Access is checked when you use each account."
                : `This is where you connect your Gmail. ${googleAccounts.length} connected — you can add ${status.google.maxAccounts - googleAccounts.length} more.`
          }
          metrics={[
            { value: `${googleAccounts.length} / ${status.google.maxAccounts}`, label: "Saved Google accounts", hot: googleAccounts.length === 0 },
            { value: wa.connected ? "Yes" : "No", label: "WhatsApp linked" },
          ]}
        />
      )}

      {(callbackMessage || message || syncMessage) && (
        <div className="conn-banner" role="status">
          {message || callbackMessage}
          {loadError && <button className="btn-outline" onClick={() => void load()}>Retry status check</button>}
          {syncMessage && (
            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {syncing ? "⏳ " : syncDone ? "✅ " : ""}{syncMessage}
              {syncError && <button className="btn-outline" onClick={() => void checkGmail()}>Retry Gmail check</button>}
              {syncDone && (
                <div style={{ marginTop: 8 }}>
                  <a href="/dashboard/mail" style={{ marginRight: 16, fontWeight: 700 }}>View your inbox →</a>
                  {status.google.canAdd && <span>Add another account above to connect more.</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <section id="google-accounts" className="conn-section">
        <div className="conn-heading">
          <div>
            <div className="ink-label">Google</div>
            <h2>Gmail + Calendar accounts</h2>
            <p>Connect up to four Google accounts. Saved grants are shown below; Google access is checked when you read mail or calendar events.</p>
          </div>
          <div className="conn-count">{googleAccounts.length} / {status.google.maxAccounts}</div>
        </div>

        <div className="conn-account-list">
          {loading ? (
            <div className="conn-empty">Checking Google connections…</div>
          ) : loadError ? (
            <div className="conn-empty">Saved accounts could not be loaded. Retry the status check above.</div>
          ) : googleAccounts.length === 0 ? (
            <div className="conn-empty">
              <strong>No Google mailbox is connected yet.</strong>
              <span>Connect one Gmail account first. You can add three more afterward.</span>
            </div>
          ) : googleAccounts.map(account => (
            <div key={account.id}>
            <article className="conn-account">
              <div className="conn-account-main">
                <div className="conn-account-avatar">G</div>
                <div>
                  <div className="conn-email">{account.google_email}</div>
                  <div className="conn-badges">
                    {account.is_primary && <span className="conn-badge primary">Primary</span>}
                    {account.gmail_enabled && <span className="conn-badge">Gmail</span>}
                    {account.calendar_enabled && <span className="conn-badge">Calendar</span>}
                  </div>
                </div>
              </div>
              <div className="conn-actions">
                {!account.is_primary && (
                  <button disabled={busy === account.id} onClick={() => void setPrimary(account.id)} className="btn-outline">
                    Make primary
                  </button>
                )}
                <button disabled={busy === account.id} onClick={() => void disconnect(account.id)} className="conn-danger">
                  Disconnect
                </button>
              </div>
            </article>
            <ReplyProfileEditor email={account.google_email} />
            </div>
          ))}
        </div>

        <div className="conn-footer">
          <div>
            <strong>Primary account</strong>
            <span>Poke and other send actions use the primary account unless you explicitly choose another sender.</span>
          </div>
          <button
            className="btn-accent"
            disabled={!status.google.canAdd || loading || loadError}
            onClick={() => void connectGmail("/dashboard/connections")}
          >
            {status.google.canAdd ? "Add Google account" : "4 accounts connected"}
          </button>
        </div>

        <div className="conn-permissions">
          <div><span>Gmail read</span><small>Find job mail and application updates.</small></div>
          <div><span>Gmail send</span><small>Send only when a MarketFit feature explicitly performs a send action.</small></div>
          <div><span>Calendar read</span><small>Read interview and recruiting events.</small></div>
        </div>
      </section>

      <section className="conn-section">
        <div className="conn-heading">
          <div>
            <div className="ink-label">WhatsApp</div>
            <h2>Your verified mobile channel</h2>
            <p>The WhatsApp channel is tied to the same MarketFit user and subscription, not to a separate account.</p>
          </div>
          <div className={`conn-state ${wa.connected ? "ok" : ""}`}>{loadError ? "Unknown" : wa.connected ? "Linked" : wa.phoneVerified && wa.optedIn ? "Provider needs attention" : "Needs setup"}</div>
        </div>

        {loadError ? <p>Phone and channel status could not be loaded. Retry the status check above.</p> : <div className="conn-steps">
          <div className={wa.phoneVerified ? "done" : ""}><b>1</b><span><strong>Verify mobile number</strong><small>{wa.phoneVerified ? `Verified ${wa.label || ""}` : "Required before WhatsApp can be linked."}</small></span></div>
          <div className={wa.optedIn ? "done" : ""}><b>2</b><span><strong>Enable WhatsApp</strong><small>{wa.optedIn ? "This number is opted in for the MarketFit WhatsApp channel." : "Choose WhatsApp during mobile verification/setup."}</small></span></div>
          <div className={wa.systemReady ? "done" : ""}><b>3</b><span><strong>Provider access</strong><small>{wa.systemReady ? "Meta accepted access to the sender. Webhook delivery has not been verified by this check." : wa.providerState === "test_number" ? "This sender is restricted to approved test recipients." : wa.systemConfigured ? "Credentials are saved, but Meta access could not be verified. This requires service recovery, not repeating your phone setup." : "The WhatsApp sender still needs configuration."}</small></span></div>
        </div>}

        {!wa.connected && !loadError && (
          <div className="conn-footer">
            <div><strong>Next step</strong><span>{wa.phoneVerified && wa.optedIn ? "Your phone setup is saved. Check again after the WhatsApp service recovers." : "Verify your number and choose WhatsApp to link your account."}</span></div>
            {wa.phoneVerified && wa.optedIn ? <button className="btn-outline" onClick={() => void load()}>Check again</button> : <Link className="btn-outline conn-link-button" href="/dashboard/setup">Open setup</Link>}
          </div>
        )}
      </section>

      <section className="conn-section muted">
        <div className="conn-heading">
          <div>
            <div className="ink-label">LinkedIn</div>
            <h2>Not connected</h2>
            <p>LinkedIn access remains unavailable. MarketFit will not pretend it is connected until there is a real provider integration.</p>
          </div>
          <div className="conn-state">Coming soon</div>
        </div>
      </section>
    </div>
  )
}
