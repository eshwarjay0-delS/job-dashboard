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
  loading: boolean
  connected: boolean
  error: string | null
  refresh: () => void
}

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.ok ? (data as T) : null
  } catch {
    return null
  }
}

export function useGmailData(): GmailData {
  const [mails, setMails] = useState<Mail[]>([])
  const [applications, setApplications] = useState<App[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [unfollowed, setUnfollowed] = useState<GmailData["unfollowed"]>([])
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
      const status = await getJSON<{ connected: boolean }>("/api/gmail-sync")
      if (cancelled) return
      const isConnected = !!status?.connected
      setConnected(isConnected)

      if (!isConnected) {
        setLoading(false)
        return
      }

      const [threadsRes, trackerRes, interviewsRes, stepsRes, unfollowedRes] =
        await Promise.all([
          getJSON<{ mails: Mail[] }>("/api/gmail/threads?days=30&max=50"),
          getJSON<{ applications: App[] }>("/api/gmail/tracker?days=60"),
          getJSON<{ interviews: Interview[] }>("/api/gmail/interviews?days=60"),
          getJSON<{ steps: Step[] }>("/api/gmail/workflow-steps"),
          getJSON<{ domains: GmailData["unfollowed"] }>("/api/gmail/unfollowed"),
        ])
      if (cancelled) return

      setMails(threadsRes?.mails || [])
      setApplications(trackerRes?.applications || [])
      setInterviews(interviewsRes?.interviews || [])
      setSteps(stepsRes?.steps || [])
      setUnfollowed(unfollowedRes?.domains || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  return { mails, applications, interviews, steps, unfollowed, loading, connected, error, refresh }
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
