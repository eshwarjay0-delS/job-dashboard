"use client"

import { useState, useEffect, useCallback } from "react"
import type { Mail, App, Interview, Step } from "@/app/dashboard/_suite/sample"

// ── Shared Gmail data hook ──────────────────────────────────────────────────
// Fetches real classified Gmail data from /api/gmail/* routes.
// Returns data shaped exactly like the _suite/sample.ts interfaces so pages
// can swap the mock import for this hook without touching their UI.

interface GmailData {
  mails: Mail[]
  applications: App[]
  interviews: Interview[]
  steps: Step[]
  unfollowed: Array<{ id: string; domain: string; company_name: string; reason: string }>
  drafts: Array<{ id: string; threadId: string; account: string; to: string; subject: string; snippet: string }>
  radar: Array<{ threadId: string; account: string; to: string; subject: string; snippet: string; daysWaiting: number; jobTitle: string; vendor: string }>
  issues: Array<{ account: string; reason: string }>
  loading: boolean
  connected: boolean
  error: string | null
  refresh: () => void
}

async function getJSON<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.ok === false) {
      return { data: null, error: body.error || `Request failed (${res.status})` }
    }
    return { data: (body as T), error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Network error" }
  }
}

export function useGmailData(): GmailData {
  const [mails, setMails] = useState<Mail[]>([])
  const [applications, setApplications] = useState<App[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [unfollowed, setUnfollowed] = useState<GmailData["unfollowed"]>([])
  const [drafts, setDrafts] = useState<GmailData["drafts"]>([])
  const [radar, setRadar] = useState<GmailData["radar"]>([])
  const [issues, setIssues] = useState<GmailData["issues"]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)

      // Check Gmail connection first
      const status = await getJSON<{ connected: boolean; reason?: string }>("/api/gmail-sync")
      if (cancelled) return
      const isConnected = !!status.data?.connected
      setConnected(isConnected)

      if (!isConnected) {
        // Say WHY, not just "not connected".
        const reason = status.data?.reason || status.error
        setError(reason === "not_logged_in"
          ? "You're not signed in to MarketFit in this browser — sign in, then your connected Gmail accounts will show up."
          : reason && reason !== "not_logged_in"
            ? `Gmail check failed: ${reason}`
            : null)
        setLoading(false)
        return
      }

      const [threadsRes, trackerRes, interviewsRes, stepsRes, unfollowedRes, draftsRes, radarRes] =
        await Promise.all([
          getJSON<{ mails: Mail[]; issues?: GmailData["issues"] }>("/api/gmail/threads?days=30&max=50"),
          getJSON<{ applications: App[] }>("/api/gmail/tracker?days=60"),
          getJSON<{ interviews: Interview[] }>("/api/gmail/interviews?days=60"),
          getJSON<{ steps: Step[] }>("/api/gmail/workflow-steps"),
          getJSON<{ domains: GmailData["unfollowed"] }>("/api/gmail/unfollowed"),
          getJSON<{ drafts: GmailData["drafts"] }>("/api/gmail/drafts"),
          getJSON<{ radar: GmailData["radar"] }>("/api/gmail/followup-radar"),
        ])
      if (cancelled) return

      setMails(threadsRes.data?.mails || [])
      setIssues(threadsRes.data?.issues || [])
      setApplications(trackerRes.data?.applications || [])
      setInterviews(interviewsRes.data?.interviews || [])
      setSteps(stepsRes.data?.steps || [])
      setUnfollowed(unfollowedRes.data?.domains || [])
      setDrafts(draftsRes.data?.drafts || [])
      setRadar(radarRes.data?.radar || [])

      // Surface the first real failure instead of showing a silent empty inbox.
      const firstErr = threadsRes.error || draftsRes.error || radarRes.error
      const gotMails = (threadsRes.data?.mails || []).length
      const acctIssues = threadsRes.data?.issues || []
      if (acctIssues.length > 0 && gotMails === 0) {
        const throttled = acctIssues.some(i => /throttling|wait .* refresh/i.test(i.reason))
        setError(
          `Couldn't read ${acctIssues.length === 1 ? "this account" : "these accounts"}: ` +
          acctIssues.map(i => `${i.account} — ${i.reason}`).join(" ") +
          (throttled
            ? ` Just wait a couple of minutes and tap refresh.`
            : ` Reconnect ${acctIssues.length === 1 ? "it" : "them"} on the connections page, then refresh.`)
        )
      } else if (firstErr && gotMails === 0) {
        setError(`Couldn't read your Gmail just now: ${firstErr}. Tap refresh to retry.`)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  return { mails, applications, interviews, steps, unfollowed, drafts, radar, issues, loading, connected, error, refresh }
}

// ── Unfollowed domain helpers ───────────────────────────────────────────────

export function isUnfollowedDomain(domain: string, unfollowed: Array<{ domain: string }>): boolean {
  const d = domain.toLowerCase()
  return unfollowed.some(u => {
    const ud = u.domain.toLowerCase()
    return d === ud || d.endsWith("." + ud)
  })
}

export async function unfollowDomain(domain: string, companyName?: string): Promise<boolean> {
  try {
    const res = await fetch("/api/gmail/unfollowed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, company_name: companyName }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function refollowDomain(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/gmail/unfollowed?domain=${encodeURIComponent(domain)}`, {
      method: "DELETE",
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Account adapters ────────────────────────────────────────────────────────
// The _suite pages call acct(accountId) where accountId was "a1".."a4".
// Real Mail.account is the Gmail address. This adapter handles both.

export interface GmailAccount {
  id: string
  email: string
  label: string
  tint: string
  connected: boolean
}

const TINTS = ["#1c1b16", "#58564c", "#8d8975", "#bcb6a6", "#4d4b44"]

export function buildAccounts(emails: string[]): GmailAccount[] {
  const unique = [...new Set(emails)]
  return unique.map((email, i) => ({
    id: email,
    email,
    label: email.split("@")[0] || email,
    tint: TINTS[i % TINTS.length] as string,
    connected: true,
  }))
}

const FALLBACK_ACCOUNT: GmailAccount = {
  id: "unknown",
  email: "unknown",
  label: "Unknown",
  tint: "#8d8975",
  connected: false,
}

export function makeAcct(accounts: GmailAccount[]) {
  return (idOrEmail: string): GmailAccount =>
    accounts.find(a => a.id === idOrEmail || a.email === idOrEmail) || {
      ...FALLBACK_ACCOUNT,
      id: idOrEmail,
      email: idOrEmail.includes("@") ? idOrEmail : idOrEmail,
    }
}
