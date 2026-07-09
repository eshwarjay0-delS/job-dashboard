"use client"

import { useState, useEffect, useCallback } from "react"
import { connectGmail } from "@/lib/google-auth"

// ─────────────────────────────────────────────────────────────────────────────
// GmailSync component
// Shows:
//   • Not connected → "Connect Gmail" button (triggers Google OAuth)
//   • Connected     → "Sync Gmail" button + last sync info
//   • Syncing       → spinner + progress
//   • Done          → result toast
//
// Usage in tracker:
//   <GmailSync onSync={(apps) => mergeApps(apps)} />
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedApplication {
  id: string
  company: string
  role: string
  location: string
  remote: boolean
  salary: string
  stage: string
  appliedDate: string
  notes: string
  url: string
  visa: string
  priority: "high" | "mid" | "low"
  source: string
  gmailThreadId: string
}

interface GmailSyncProps {
  onSync: (apps: ParsedApplication[]) => void
  /** If true, shows a compact inline button rather than a full card */
  compact?: boolean
}

type Status = "checking" | "disconnected" | "connected" | "syncing" | "done" | "error"

// Map a raw status/OAuth reason code to plain-English guidance for the user.
// Module-level so it's stable across renders (no hook-dependency churn).
function explainReason(reason?: string | null): string {
  if (!reason) return ""
  const r = reason.toLowerCase()
  if (r.includes("not_logged_in")) return "Sign in to your account first, then connect Gmail."
  if (r.includes("no_gmail_token")) return "Click “Connect Gmail” and grant read-only access to continue."
  if (r.includes("token_invalid") || r.includes("expired")) return "Your Gmail access expired — click Reconnect to refresh it."
  if (r.includes("access_denied")) return "Access was denied. Make sure you approve the Gmail (read-only) permission, and that your Google account is added as a test user on the OAuth consent screen."
  if (r.includes("redirect")) return "The callback URL isn’t allow-listed. Add it under Supabase → Auth → URL Configuration → Redirect URLs, then try again."
  return reason
}

export default function GmailSync({ onSync, compact = false }: GmailSyncProps) {
  const [status, setStatus]   = useState<Status>("checking")
  const [email, setEmail]     = useState<string>("")
  const [result, setResult]   = useState<{ added: number; skipped: number } | null>(null)
  const [error, setError]     = useState<string>("")
  const [connecting, setConnecting] = useState(false)

  // Check connection status on mount + when returning from OAuth
  const checkStatus = useCallback(async () => {
    setStatus("checking")
    try {
      const res = await fetch("/api/gmail-sync")
      const data = await res.json()
      if (data.connected) {
        setStatus("connected")
        setError("")
        if (data.email) setEmail(data.email)
      } else {
        setStatus("disconnected")
        // Keep the reason so the UI can tell the user WHY it's not connected.
        setError(explainReason(data.reason))
      }
    } catch {
      setStatus("disconnected")
      setError("Couldn’t reach the server. Is the app running (npm run dev)?")
    }
  }, [])

  useEffect(() => {
    checkStatus()
    // If we just returned from OAuth with ?gmail=connected, re-check
    const params = new URLSearchParams(window.location.search)
    if (params.get("gmail") === "connected") {
      // Clean the URL
      const url = new URL(window.location.href)
      url.searchParams.delete("gmail")
      window.history.replaceState({}, "", url.toString())
    } else if (params.get("gmail") === "error") {
      setStatus("error")
      const reason = params.get("reason")
      setError(reason ? explainReason(reason) : "Gmail connection failed. Please try again.")
      const url = new URL(window.location.href)
      url.searchParams.delete("gmail")
      url.searchParams.delete("reason")
      window.history.replaceState({}, "", url.toString())
    }
  }, [checkStatus])

  async function handleConnect() {
    setConnecting(true)
    try {
      await connectGmail()
      // Supabase will redirect to /auth/callback/gmail then back here
    } catch (err) {
      setError(String(err))
      setStatus("error")
      setConnecting(false)
    }
  }

  async function handleSync() {
    setStatus("syncing")
    setResult(null)
    setError("")
    try {
      const res = await fetch("/api/gmail-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 90, max: 50 }),
      })
      const data = await res.json()

      if (!data.ok) throw new Error(data.error || "Sync failed")

      onSync(data.applications as ParsedApplication[])
      setResult({ added: data.count, skipped: data.skipped || 0 })
      setStatus("done")

      // Auto-dismiss result after 8s
      setTimeout(() => setStatus("connected"), 8000)
    } catch (err) {
      setError(String(err))
      setStatus("error")
    }
  }

  // ── Compact mode (just a button in the header) ────────────────────────────
  if (compact) {
    if (status === "checking") {
      return (
        <button disabled className="btn-outline px-4 py-2 text-sm" style={{ opacity: 0.5 }}>
          <Spinner /> Gmail
        </button>
      )
    }

    if (status === "disconnected" || status === "error") {
      return (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="btn-outline px-4 py-2 text-sm flex items-center gap-2"
          style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
          title="Connect Gmail to auto-import job applications"
        >
          <GmailIcon />
          {connecting ? "Connecting…" : "Connect Gmail"}
        </button>
      )
    }

    if (status === "syncing") {
      return (
        <button disabled className="btn-outline px-4 py-2 text-sm flex items-center gap-2" style={{ opacity: 0.7 }}>
          <Spinner /> Syncing…
        </button>
      )
    }

    // connected / done
    return (
      <div className="flex items-center gap-2">
        {status === "done" && result && (
          <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
            +{result.added} added
          </span>
        )}
        <button
          onClick={handleSync}
          className="btn-outline px-4 py-2 text-sm flex items-center gap-2"
          style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
          title={email ? `Sync from ${email}` : "Sync from Gmail"}
        >
          <GmailIcon />
          Sync Gmail
        </button>
      </div>
    )
  }

  // ── Full card mode (for Settings page) ───────────────────────────────────
  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#EA4335" + "18" }}
        >
          <GmailIcon size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Gmail Integration</h3>
          <p className="text-xs" style={{ color: "var(--text-soft)" }}>
            Auto-import job applications from your inbox
          </p>
        </div>
        {status === "connected" || status === "done" || status === "syncing" ? (
          <span
            className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "#22c55e18", color: "#16a34a" }}
          >
            ✓ Connected{email ? ` · ${email}` : ""}
          </span>
        ) : status === "checking" ? (
          <span className="ml-auto">
            <Spinner />
          </span>
        ) : null}
      </div>

      {/* What it does */}
      {(status === "disconnected" || status === "error") && (
        <ul className="space-y-1.5">
          {[
            "Scans for application confirmation emails",
            "Detects interview invites and offers automatically",
            "Fills your tracker with company + role + stage",
            "Deduplicates — never adds the same job twice",
          ].map(line => (
            <li key={line} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-soft)" }}>
              <span style={{ color: "var(--accent)", marginTop: 1 }}>✓</span>
              {line}
            </li>
          ))}
        </ul>
      )}

      {/* Result */}
      {status === "done" && result && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}
        >
          <strong>{result.added}</strong> new application{result.added !== 1 ? "s" : ""} added
          {result.skipped > 0 && <span style={{ opacity: 0.7 }}> · {result.skipped} duplicates skipped</span>}
        </div>
      )}

      {/* Error / reason — shown on hard error AND when disconnected with a reason */}
      {(status === "error" || status === "disconnected") && error && (
        <div
          className="rounded-xl px-4 py-3 text-xs"
          style={{ background: "#ef44440f", color: "#dc2626", border: "1px solid #ef444420" }}
        >
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {status === "disconnected" || status === "error" ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="btn-accent px-5 py-2.5 text-sm flex items-center gap-2"
          >
            <GmailIcon size={14} color="white" />
            {connecting ? "Connecting…" : "Connect Gmail"}
          </button>
        ) : status === "syncing" ? (
          <button disabled className="btn-accent px-5 py-2.5 text-sm flex items-center gap-2" style={{ opacity: 0.7 }}>
            <Spinner />
            Syncing inbox…
          </button>
        ) : status === "checking" ? (
          <button disabled className="btn-outline px-5 py-2.5 text-sm" style={{ opacity: 0.5 }}>
            Checking…
          </button>
        ) : (
          <>
            <button
              onClick={handleSync}
              className="btn-accent px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              Sync Now
            </button>
            <button
              onClick={checkStatus}
              className="btn-outline px-4 py-2.5 text-sm"
              style={{ color: "var(--text-soft)" }}
            >
              Reconnect
            </button>
          </>
        )}
        {(status === "disconnected" || status === "error") && (
          <span className="text-xs ml-2" style={{ color: "var(--text-soft)" }}>
            Read-only access · We never send emails
          </span>
        )}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function GmailIcon({ size = 16, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill={color || "#EA4335"} opacity=".15"/>
      <path d="M22 6L12 13 2 6" stroke={color || "#EA4335"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 14, height: 14,
      border: "2px solid currentColor",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      flexShrink: 0,
    }} />
  )
}
