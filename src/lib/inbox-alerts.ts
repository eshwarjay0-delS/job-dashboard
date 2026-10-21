// ── Inbox alerts ─────────────────────────────────────────────────────────
// Decides which newly-arrived inbox messages deserve to tap the user on
// the shoulder, and connects each one to the application chain it belongs
// to. Pure and deterministic: the API route feeds it classified threads
// plus chain summaries; the dashboard watcher renders what comes back.
//
// The evidence bar is the app's standing one: an interview alerts only
// when the invite is CONFIRMED (.ics calendar invite, meeting link, or
// explicit confirmation language — see inviteEvidence in the Gmail lib).
// "Slots available" requests never alert. The chain connection is the
// part a plain notifier cannot do: an alert says whether it belongs to
// an existing chain (and who holds it), whether it looks like a SECOND
// chain on the same client + role arriving on a different thread (the
// double-submit pattern — confirm before replying), or is genuinely new.

export type InboxAlertKind = "interview" | "rtr" | "rate" | "documents" | "offer"

export interface AlertMessageInput {
  id: string
  fromName: string
  fromEmail: string
  isMe: boolean
  subject: string
  category: string
  at: number // ms epoch
  confirmedInvite?: boolean
  meetingStart?: number // ms epoch, from calendar evidence when present
  jobTitle?: string
  company?: string
}

export interface AlertThreadInput {
  threadId: string
  accountEmail: string
  messages: AlertMessageInput[]
}

export interface ChainSummary {
  threadIds: string[] // the chain's own thread plus any linked source threads
  company: string
  role: string
  holder: string
  people: string[]
}

export interface InboxAlert {
  id: string // threadId:messageId
  kind: InboxAlertKind
  at: number
  threadId: string
  accountEmail: string
  fromName: string
  subject: string
  meetingStart?: number
  connect: {
    state: "chain" | "check-chain" | "new"
    note: string
    company?: string
    role?: string
  }
}

const GENERIC_COMPANY = new Set([
  "inc", "llc", "corp", "corporation", "company", "co", "technologies",
  "technology", "tech", "group", "solutions", "services", "global",
  "digital", "systems", "consulting", "staffing", "the", "and",
])
const ROLE_STOP = new Set([
  "the", "and", "for", "with", "req", "id", "re", "fw", "fwd",
  "a", "an", "of", "in", "at", "on", "to",
])

function tokens(text: string, stop: Set<string>): string[] {
  return [
    ...new Set(
      (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stop.has(w)),
    ),
  ]
}

/** Two company names match when they share one distinctive token. */
function sameCompany(a: string, b: string): boolean {
  const ta = tokens(a, GENERIC_COMPANY)
  const tb = tokens(b, GENERIC_COMPANY)
  if (!ta.length || !tb.length) return false
  return ta.some(t => tb.includes(t))
}

/** Share of the shorter role title's distinctive tokens found in the other. */
function roleOverlap(a: string, b: string): number {
  const ta = tokens(a, ROLE_STOP)
  const tb = tokens(b, ROLE_STOP)
  if (!ta.length || !tb.length) return 0
  const hit = ta.filter(t => tb.includes(t)).length
  return hit / Math.min(ta.length, tb.length)
}

const KIND_BY_CATEGORY: Record<string, InboxAlertKind> = {
  "RTR Request": "rtr",
  "Rate Confirmation": "rate",
  "Document Request": "documents",
  Offer: "offer",
}

export function shapeInboxAlerts(
  threads: AlertThreadInput[],
  chains: ChainSummary[],
  sinceMs: number,
): InboxAlert[] {
  const chainByThread = new Map<string, ChainSummary>()
  for (const c of chains) for (const id of c.threadIds) chainByThread.set(id, c)

  const best = new Map<string, InboxAlert>()
  for (const t of threads) {
    for (const m of t.messages) {
      if (m.isMe || !(m.at > sinceMs)) continue
      let kind: InboxAlertKind | undefined
      if (m.category === "Interview Request" && m.confirmedInvite) kind = "interview"
      else kind = KIND_BY_CATEGORY[m.category]
      if (!kind) continue

      const role = m.jobTitle || m.subject
      const company = m.company || ""
      const own = chainByThread.get(t.threadId)
      let connect: InboxAlert["connect"]
      if (own && own.threadIds.length > 1) {
        // The thread is linked into a wider chain — this alert is that
        // chain moving, and the holder is who has the profile now.
        connect = {
          state: "chain",
          company: own.company,
          role: own.role,
          note: `Part of your ${own.company} chain — currently held by ${own.holder}.`,
        }
      } else {
        const match = chains.find(
          c => c !== own && sameCompany(company, c.company) && roleOverlap(role, c.role) >= 0.6,
        )
        if (match) {
          const via = match.people.length ? ` (${match.people.slice(0, 3).join(", ")})` : ""
          connect = {
            state: "check-chain",
            company: match.company,
            role: match.role,
            note: `Looks like your existing ${match.company} chain${via} — but it arrived on a different thread. Confirm it is the same chain before replying.`,
          }
        } else {
          connect = { state: "new", note: "No existing chain matches this — a new thread." }
        }
      }

      const alert: InboxAlert = {
        id: `${t.threadId}:${m.id}`,
        kind,
        at: m.at,
        threadId: t.threadId,
        accountEmail: t.accountEmail,
        fromName: m.fromName,
        subject: m.subject,
        meetingStart: kind === "interview" ? m.meetingStart : undefined,
        connect,
      }
      const key = `${t.threadId}:${kind}`
      const prev = best.get(key)
      if (!prev || alert.at > prev.at) best.set(key, alert)
    }
  }
  return [...best.values()].sort((a, b) => a.at - b.at).slice(-10)
}
