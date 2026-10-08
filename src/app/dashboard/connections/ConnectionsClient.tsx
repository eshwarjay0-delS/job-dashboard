"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { connectGmail } from "@/lib/google-auth"
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

export default function ConnectionsClient() {
  const params = useSearchParams()
  const [status, setStatus] = useState<ConnectionStatus>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/connections/status", { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not load connections.")
      setStatus(body)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Auto-sync Gmail right after a successful OAuth connection so the demo
  // flows straight from "connected" into live data with visible progress.
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  useEffect(() => {
    if (params.get("google") !== "connected" || syncing || syncDone) return
    setSyncing(true)
    fetch("/api/gmail-sync", { method: "POST", cache: "no-store" })
      .then(r => r.json())
      .then(() => setSyncDone(true))
      .catch(() => {})
      .finally(() => setSyncing(false))
  }, [params, syncing, syncDone])

  const syncMessage = syncing
    ? "Syncing your emails — this takes about 30 seconds…"
    : syncDone
      ? "Sync complete! Your mail, tracker, calendar and workflows are now live."
      : null

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
        sample={loading ? "Checking your connected accounts…" : `${googleAccounts.length} Google account${googleAccounts.length === 1 ? "" : "s"} connected · WhatsApp ${wa.connected ? "connected" : "not connected"}.`}
      />

      {!loading && (
        <MetricHero
          why={
            googleAccounts.length === 0
              ? "This is where you connect your Gmail. Without it, MarketFit can't read your job emails — nothing else here works."
              : googleAccounts.length >= status.google.maxAccounts
                ? "This is where you connect your Gmail. You're at the max — 4 accounts connected, everything is live."
                : `This is where you connect your Gmail. ${googleAccounts.length} connected — you can add ${status.google.maxAccounts - googleAccounts.length} more.`
          }
          metrics={[
            { value: `${googleAccounts.length} / ${status.google.maxAccounts}`, label: "Gmail accounts connected", hot: googleAccounts.length === 0 },
            { value: wa.connected ? "Yes" : "No", label: "WhatsApp connected" },
          ]}
        />
      )}

      {(callbackMessage || message || syncMessage) && (
        <div className="conn-banner" role="status">
          {callbackMessage || message}
          {syncMessage && (
            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {syncing ? "⏳ " : "✅ "}{syncMessage}
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
            <p>Connect up to four Google accounts. Each one keeps its own encrypted offline grant while MarketFit stays signed in as the same user.</p>
          </div>
          <div className="conn-count">{googleAccounts.length} / {status.google.maxAccounts}</div>
        </div>

        <div className="conn-account-list">
          {loading ? (
            <div className="conn-empty">Checking Google connections…</div>
          ) : googleAccounts.length === 0 ? (
            <div className="conn-empty">
              <strong>No Google mailbox is connected yet.</strong>
              <span>Connect one Gmail account first. You can add three more afterward.</span>
            </div>
          ) : googleAccounts.map(account => (
            <article className="conn-account" key={account.id}>
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
          ))}
        </div>

        <div className="conn-footer">
          <div>
            <strong>Primary account</strong>
            <span>Poke and other send actions use the primary account unless you explicitly choose another sender.</span>
          </div>
          <button
            className="btn-accent"
            disabled={!status.google.canAdd || loading}
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
          <div className={`conn-state ${wa.connected ? "ok" : ""}`}>{wa.connected ? "Connected" : "Needs setup"}</div>
        </div>

        <div className="conn-steps">
          <div className={wa.phoneVerified ? "done" : ""}><b>1</b><span><strong>Verify mobile number</strong><small>{wa.phoneVerified ? `Verified ${wa.label || ""}` : "Required before WhatsApp can be linked."}</small></span></div>
          <div className={wa.optedIn ? "done" : ""}><b>2</b><span><strong>Enable WhatsApp</strong><small>{wa.optedIn ? "This number is opted in for the MarketFit WhatsApp channel." : "Choose WhatsApp during mobile verification/setup."}</small></span></div>
          <div className={wa.systemReady ? "done" : ""}><b>3</b><span><strong>Bot transport ready</strong><small>{wa.systemReady ? "MarketFit's WhatsApp transport is configured." : "The server transport still needs configuration."}</small></span></div>
        </div>

        {!wa.connected && (
          <div className="conn-footer">
            <div><strong>Next step</strong><span>Finish the missing step above, then this page will show the channel as connected.</span></div>
            <Link className="btn-outline conn-link-button" href="/dashboard/setup">Open setup</Link>
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
