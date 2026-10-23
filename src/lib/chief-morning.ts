// The Chief's 7am report: what the overnight jobs found, said in plain words, with the funnel at the bottom.
//
// The mistakes it prevents:
// - finished work that waits in the app where he does not look. Owner's spec, 23 Oct 2026: "the finished work is on his
//   phone by morning"; the overnight jobs (chief-goal.ts) saved their findings as in-app notifications only;
// - a report that hides what was not done. The funnel always says "0 sent without you", and the Apply line says it is
//   not wired yet instead of showing a made-up count;
// - a report he did not ask for. Whether it runs every day is still his decision (briefing, 23 Oct 2026), so it is off
//   until he sends "morning on" on WhatsApp, and "morning off" stops it. "morning" gives the report at once.
import type { ClassifiedThread } from "@/app/api/gmail/_lib"
import { runChecks } from "@/lib/agent/watchdog-checks"
import { neverContactHit } from "@/lib/chief-guard"
import { blob } from "@/lib/storage"

const DAY_MS = 86_400_000
const at = (m: { internalDate?: string }) => Number(m.internalDate) || 0
const latest = (t: ClassifiedThread) => t.messages[t.messages.length - 1]
const label = (t: ClassifiedThread) => { const l = latest(t); return `${l.vendor || l.from}: ${l.jobTitle || l.subject}`.slice(0, 120) }

/** Mail that asks for his call: each one is his to answer. */
const NEEDS_CALL: Record<string, string> = {
  "Interview Request": "interview invite",
  "RTR Request": "RTR",
  "Rate Confirmation": "rate confirmation",
  "Document Request": "document request",
  "Offer": "offer",
}
const NOT_WORTH = new Set(["Sales Pitch", "General Correspondence"])
const ACTIVE = new Set(["RTR Request", "Submission Confirmation", "Interview Request"])

export type MorningInput = {
  threads: ClassifiedThread[]
  now: number
  neverContact?: string[]
  /** Approval cards still waiting on his tap. */
  pendingCards?: number
}

export type MorningReport = {
  calls: string[]
  doubleSubmit: string[]
  quiet: string[]
  funnel: { inboxNew: number; worth: number; needCalls: number; chains: number; risks: number }
}

/** Pure: the report from the last day of mail. The runner fetches the threads. */
export function buildMorning(input: MorningInput): MorningReport {
  const { threads, now } = input
  const fresh = threads.filter(t => now - at(latest(t)) <= DAY_MS)
  const worth = fresh.filter(t => !NOT_WORTH.has(latest(t).category))
  const calls: string[] = []
  for (const t of fresh) {
    const kinds = [...new Set(t.messages.filter(m => NEEDS_CALL[m.category] && now - at(m) <= DAY_MS).map(m => NEEDS_CALL[m.category]))]
    for (const kind of kinds) calls.push(`${kind} — ${label(t)}`)
  }
  const chains = threads.filter(t => t.messages.some(m => ACTIVE.has(m.category)))
  const doubleSubmit = runChecks(threads)
    .filter(f => f.check === "duplicate-chains" || f.check === "rtr-conflict")
    .map(f => `${f.title} — call one before anyone files`)
  const quiet = chains.filter(t => {
    const l = latest(t)
    if (neverContactHit(input.neverContact || [], (l.from.match(/[\w.+-]+@[\w.-]+/) || [""])[0], l.vendor || "")) return false
    return (now - at(l)) / DAY_MS >= 7
  }).map(t => `${label(t)} — quiet ${Math.floor((now - at(latest(t))) / DAY_MS)} days`)
  return {
    calls: calls.slice(0, 10), doubleSubmit: doubleSubmit.slice(0, 6), quiet: quiet.slice(0, 8),
    funnel: { inboxNew: fresh.length, worth: worth.length, needCalls: calls.length, chains: chains.length, risks: doubleSubmit.length },
  }
}

/** The report in plain words, for WhatsApp. */
export function morningText(r: MorningReport, pendingCards = 0): string {
  const list = (head: string, items: string[]) => items.length ? [head, ...items.map(i => `• ${i}`), ""] : []
  const f = r.funnel
  const quietHead = `${r.quiet.length} thread${r.quiet.length === 1 ? "" : "s"} quiet 7+ days. Say _goal: draft follow-ups_ and each draft comes to you as a card:`
  return [
    "*Good morning. Here is last night.*",
    "",
    ...list("Needs your call:", r.calls),
    ...list("Double-submit risk:", r.doubleSubmit),
    ...list(quietHead, r.quiet),
    ...(pendingCards ? [`${pendingCards} draft${pendingCards === 1 ? "" : "s"} still wait on your Send, Edit or Skip.`, ""] : []),
    ...(!r.calls.length && !r.doubleSubmit.length && !r.quiet.length && !pendingCards ? ["Nothing needs you this morning.", ""] : []),
    "*Funnel*",
    `Inbox: ${f.inboxNew} new → ${f.worth} worth your time → ${f.needCalls} need your call → 0 sent without you.`,
    `Submissions: ${f.chains} active → ${f.risks} double-submit risk${f.risks === 1 ? "" : "s"}.`,
    "Apply: new matches are not in this report yet.",
    "",
    "_morning off_ stops this report.",
  ].join("\n")
}

// ── On or off, per person. Off until he says so. ─────────────────────────────
const PREFIX = "chief/morning/users/"
const key = (userId: string) => `${PREFIX}${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`

export async function morningOn(userId: string): Promise<boolean> {
  const raw = await blob.getText(key(userId)).catch(() => null)
  try { return !!raw && JSON.parse(raw).on === true } catch { return false }
}

export async function setMorning(userId: string, on: boolean): Promise<void> {
  await blob.put(key(userId), JSON.stringify({ on, userId, at: Date.now() }))
}

/** Everyone who turned the report on. */
export async function morningUsers(): Promise<string[]> {
  const keys = await blob.list(PREFIX).catch(() => [] as string[])
  const out: string[] = []
  for (const k of keys.filter(k => k.endsWith(".json")).slice(0, 50)) {
    const raw = await blob.getText(k).catch(() => null)
    try { const v = raw ? JSON.parse(raw) : null; if (v?.on === true && typeof v.userId === "string") out.push(v.userId) } catch { /* skip */ }
  }
  return out
}

/** "morning", "morning on", "morning off" on WhatsApp. */
export const MORNING_WORDS = /^morning(?:\s+report)?(?:\s+(on|off))?\s*[.!?]?$/i

/**
 * Build the report for one person and put it on his phone. The in-app notification is always saved; WhatsApp gets it
 * only on the number that answers as this same account (cardRecipientFor). Outside WhatsApp's 24-hour window Meta
 * refuses a plain message, and the report then waits in the app; this says so instead of retrying.
 */
export async function runMorningReport(userId: string, opts: { now?: number } = {}): Promise<{ sent: boolean; saved: boolean; why?: string }> {
  const now = opts.now ?? Date.now()
  const { fetchClassifiedThreads } = await import("@/app/api/gmail/_lib")
  const { readBrief } = await import("@/lib/chief-brief")
  const { listPendingCards, cardRecipientFor } = await import("@/lib/chief-approvals")
  const { threads } = await fetchClassifiedThreads(userId, { days: 21, max: 100 })
  const brief = await readBrief(userId)
  const to = await cardRecipientFor(userId)
  const pending = to ? (await listPendingCards(to)).filter(c => c.userId === userId).length : 0
  const text = morningText(buildMorning({ threads, now, neverContact: brief.neverContact }), pending)

  let saved = false
  try {
    const { serviceClientAvailable, createServiceClient } = await import("@/lib/supabase/service")
    if (serviceClientAvailable()) {
      const { error } = await createServiceClient().from("mfit_notifications").insert({
        user_id: userId, type: "chief-morning", read: false, link: null, title: "Chief: your morning report", body: text.slice(0, 2000),
      })
      saved = !error
    }
  } catch { /* the WhatsApp copy still goes */ }

  if (!to) return { sent: false, saved, why: "no WhatsApp number answers as this account" }
  try {
    const { sendText, waConfigured } = await import("@/lib/whatsapp")
    if (!waConfigured()) return { sent: false, saved, why: "WhatsApp is not set up on this deployment" }
    await sendText(to, text)
    return { sent: true, saved }
  } catch (e) {
    return { sent: false, saved, why: String(e).slice(0, 160) }
  }
}
