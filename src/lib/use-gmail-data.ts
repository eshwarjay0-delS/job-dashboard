"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
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

// ── One copy of the mail data for the whole open app ────────────────────────
// Inbox, Today, Interviews, My Jobs and Follow-ups show the same mail. Each used to load it on its own: open one page,
// then another, and the second asked the server for all of it again (eight requests) before it settled (14 Oct 2026:
// "zero lags towards any place in the whole web app"). Now the open app keeps one copy. A page opened within FRESH_MS
// of the last load shows it at once and asks nothing; an older copy is shown at once and checked quietly behind it;
// pages that open together share one load. Refresh, the two-minute pulse and coming back to the tab still ask the
// server, which only asks Gmail for what is new.
const FRESH_MS = 15_000
const PULSE_MS = 120_000

type Loaded = Omit<GmailData, "loading" | "refresh">
const EMPTY: Loaded = {
  mails: [], applications: [], interviews: [], steps: [], unfollowed: [], drafts: [], radar: [], issues: [],
  connected: false, error: null,
}

let shared: { data: Loaded; at: number } | null = null
let inflight: Promise<Loaded> | null = null
let generation = 0
const listeners = new Set<(d: Loaded) => void>()

// ── Instant copy on this device ─────────────────────────────────────────────
// The last good copy lives in localStorage, so a page paints with mail at once even after a reload, exactly how the
// Gmail app feels. It is kept under the signed-in person's id: until 14 Oct 2026 it was one copy per browser that
// signing out left behind, so the next person to sign in on that browser would have seen the last person's mail.
const SNAPSHOT_PREFIX = "mfit:gmail-snapshot:"

interface Snapshot {
  mails: Mail[]
  applications: App[]
  interviews: Interview[]
  steps?: Step[]
  unfollowed?: GmailData["unfollowed"]
  drafts: GmailData["drafts"]
  radar: GmailData["radar"]
  issues: GmailData["issues"]
  savedAt: number
}

async function snapshotKey(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession()
    const id = data.session?.user?.id
    return id ? `${SNAPSHOT_PREFIX}v2:${id}` : null
  } catch {
    return null
  }
}

function readSnapshot(key: string): Snapshot | null {
  try {
    localStorage.removeItem(`${SNAPSHOT_PREFIX}v1`) // the old copy, kept for whoever was signed in
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as Snapshot
    if (!s || !Array.isArray(s.mails)) return null
    return s
  } catch {
    return null
  }
}

function writeSnapshot(key: string, s: Snapshot): void {
  try {
    localStorage.setItem(key, JSON.stringify(s))
  } catch {
    /* storage full or unavailable — the live load still works */
  }
}

/** Signing out forgets the mail kept in this tab and on this device. */
export function forgetGmailData(): void {
  generation++
  shared = null
  inflight = null
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(SNAPSHOT_PREFIX)) localStorage.removeItem(k)
  } catch { /* storage unavailable: nothing was kept */ }
}

async function fetchAll(force: boolean): Promise<Loaded> {
  // Check the Gmail connection first.
  const status = await getJSON<{ connected: boolean; reason?: string }>("/api/gmail-sync")
  if (!status.data) {
    // The check itself failed (a dropped connection, a server hiccup): keep what is on screen and say why.
    const msg = `Couldn't check Gmail just now: ${status.error}. Tap refresh to retry.`
    return shared ? { ...shared.data, error: msg } : { ...EMPTY, error: msg }
  }
  if (!status.data.connected) {
    // Say WHY, not just "not connected".
    const reason = status.data.reason
    return {
      ...EMPTY,
      error: reason === "not_logged_in"
        ? "You're not signed in to MarketFit in this browser — sign in, then your connected Gmail accounts will show up."
        : reason ? `Gmail check failed: ${reason}` : null,
    }
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

  const data: Loaded = {
    mails: threadsRes.data?.mails || [],
    issues: threadsRes.data?.issues || [],
    applications: trackerRes.data?.applications || [],
    interviews: interviewsRes.data?.interviews || [],
    steps: stepsRes.data?.steps || [],
    unfollowed: unfollowedRes.data?.domains || [],
    drafts: draftsRes.data?.drafts || [],
    radar: radarRes.data?.radar || [],
    connected: true,
    error: null,
  }

  // Surface the first real failure instead of showing a silent empty inbox.
  const firstErr = threadsRes.error || draftsRes.error || radarRes.error
  if (data.issues.length > 0 && data.mails.length === 0) {
    const throttled = data.issues.some(i => /throttling|wait .* refresh/i.test(i.reason))
    data.error =
      `Couldn't read ${data.issues.length === 1 ? "this account" : "these accounts"}: ` +
      data.issues.map(i => `${i.account} — ${i.reason}`).join(" ") +
      (throttled
        ? ` Just wait a couple of minutes and tap refresh.`
        : ` Reconnect ${data.issues.length === 1 ? "it" : "them"} on the connections page, then refresh.`)
  } else if (firstErr && data.mails.length === 0) {
    data.error = `Couldn't read your Gmail just now: ${firstErr}. Tap refresh to retry.`
  }

  // Save the fresh copy so the next page opens instantly, even after a reload.
  if (data.mails.length > 0) {
    const key = await snapshotKey()
    if (key) writeSnapshot(key, {
      mails: data.mails, applications: data.applications, interviews: data.interviews, steps: data.steps,
      unfollowed: data.unfollowed, drafts: data.drafts, radar: data.radar, issues: data.issues, savedAt: Date.now(),
    })
  }
  return data
}

// One load at a time for the whole app; whoever asks while it runs gets the same answer. A forced refresh starts its
// own. An answer that arrives after signing out is dropped.
function loadShared(force: boolean): Promise<Loaded> {
  if (inflight && !force) return inflight
  const gen = generation
  const p = fetchAll(force).then(data => {
    if (gen === generation) {
      shared = { data, at: Date.now() }
      listeners.forEach(hear => hear(data))
    }
    return data
  })
  inflight = p
  p.finally(() => { if (inflight === p) inflight = null }).catch(() => {})
  return p
}

export function useGmailData(): GmailData {
  const [data, setData] = useState<Loaded>(() => shared?.data ?? EMPTY)
  const [loading, setLoading] = useState(() => !shared)

  // Every page showing mail hears every load, whichever page started it.
  useEffect(() => {
    const hear = (d: Loaded) => { setData(d); setLoading(false) }
    listeners.add(hear)
    return () => { listeners.delete(hear) }
  }, [])

  // On opening: the copy in this tab if there is one, else the copy on this device, then a quiet check when it is old.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (shared) {
        if (Date.now() - shared.at >= FRESH_MS) void loadShared(false)
        return
      }
      const key = await snapshotKey()
      const snap = key ? readSnapshot(key) : null
      if (!cancelled && !shared && snap && snap.mails.length > 0) {
        setData({
          ...EMPTY, connected: true,
          mails: snap.mails, applications: snap.applications || [], interviews: snap.interviews || [],
          steps: snap.steps || [], unfollowed: snap.unfollowed || [], drafts: snap.drafts || [],
          radar: snap.radar || [], issues: snap.issues || [],
        })
        setLoading(false)
      }
      void loadShared(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Manual refresh forces an incremental Gmail sync (only what's new — fast).
  const refresh = useCallback((force = true) => {
    setLoading(true)
    void loadShared(force).then(() => setLoading(false))
  }, [])

  // Real-time pulse: quietly re-check every 2 minutes, and catch up when the tab comes back into focus, like the Gmail
  // app. However many pages are open, one check runs, since each asks only when the shared copy has aged.
  useEffect(() => {
    if (!data.connected) return
    const id = setInterval(() => {
      if (Date.now() - (shared?.at ?? 0) >= PULSE_MS - 5_000) void loadShared(false)
    }, PULSE_MS)
    const onFocus = () => { if (Date.now() - (shared?.at ?? 0) > 60_000) void loadShared(false) }
    const onVis = () => { if (!document.hidden) onFocus() }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [data.connected])

  return { ...data, loading, refresh }
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
