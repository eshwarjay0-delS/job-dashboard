"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

// ── Instant local cache: Gmail-speed ────────────────────────────────────────
// The last good snapshot lives in localStorage. Pages render it INSTANTLY on
// mount, then a silent background load refreshes it — exactly how the Gmail
// app feels: your mail is already there, and new mail slides in.
const LOCAL_CACHE_KEY = "mfit:gmail-snapshot:v1"

interface Snapshot {
  mails: Mail[]
  applications: App[]
  interviews: Interview[]
  drafts: GmailData["drafts"]
  radar: GmailData["radar"]
  issues: GmailData["issues"]
  savedAt: number
}

function readSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Snapshot
    if (!s || !Array.isArray(s.mails)) return null
    return s
  } catch {
    return null
  }
}

function writeSnapshot(s: Snapshot): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(s))
  } catch {
    /* storage full or unavailable — the live load still works */
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

  // Manual refresh forces an incremental Gmail sync (only what's new — fast).
  // The silent pulse below refreshes quietly without any spinner.
  const freshRef = useRef(false)
  const silentRef = useRef(false)
  const refresh = useCallback((force = true) => { freshRef.current = force; setTick(t => t + 1) }, [])

  const lastLoadRef = useRef(0)
  // Hydrate from the local snapshot BEFORE the first network load so the
  // page paints instantly, then the load below refreshes silently.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const snap = readSnapshot()
    if (snap && snap.mails.length > 0) {
      setMails(snap.mails)
      setApplications(snap.applications || [])
      setInterviews(snap.interviews || [])
      setDrafts(snap.drafts || [])
      setRadar(snap.radar || [])
      setIssues(snap.issues || [])
      setLoading(false)
      setConnected(true)
      // The load below will still run — silently — to bring in anything new.
      silentRef.current = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const silent = silentRef.current
      silentRef.current = false
      const force = freshRef.current
      freshRef.current = false
      if (!silent) setLoading(true)
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
          getJSON<{ mails: Mail[]; issues?: GmailData["issues"] }>(`/api/gmail/threads?days=30&max=50${force ? "&fresh=1" : ""}`),
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
      // Save the fresh snapshot so the next page opens instantly.
      if ((threadsRes.data?.mails || []).length > 0) {
        writeSnapshot({
          mails: threadsRes.data?.mails || [],
          applications: trackerRes.data?.applications || [],
          interviews: interviewsRes.data?.interviews || [],
          drafts: draftsRes.data?.drafts || [],
          radar: radarRes.data?.radar || [],
          issues: threadsRes.data?.issues || [],
          savedAt: Date.now(),
        })
      }

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
      lastLoadRef.current = Date.now()
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  // Real-time pulse: quietly re-check every 2 minutes. The server answers from
  // cache and only asks Gmail for what's new, so this feels live without
  // re-downloading anything or spinning the UI.
  useEffect(() => {
    if (!connected) return
    const id = setInterval(() => { silentRef.current = true; setTick(t => t + 1) }, 120000)
    // Like the Gmail app: when the tab comes back into focus, quietly catch up.
    const onFocus = () => {
      if (Date.now() - lastLoadRef.current > 60000) {
        silentRef.current = true
        setTick(t => t + 1)
      }
    }
    const onVis = () => { if (!document.hidden) onFocus() }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [connected])

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
