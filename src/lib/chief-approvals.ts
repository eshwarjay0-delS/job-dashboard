/**
 * Chief approval cards — Phase 4 of the Chief of Staff (docs/research/chief-of-staff-rea.md).
 *
 * When the Chief drafts something sensitive (a follow-up email, …), it is delivered to
 * the owner's WhatsApp as an interactive message with Send / Edit / Skip quick-reply
 * buttons (Meta interactive button message, max 3 buttons). The webhook answers the
 * button taps; nothing is ever sent without the owner tapping Send on the card.
 *
 * Storage is blob-backed, next to the WhatsApp sessions — no SQL migration needed.
 *
 * Since 23 Oct 2026 (the owner's spec: "Draft + [Send] [Edit] [Skip]", and "nothing moves without my yes"):
 * - no draft card is made for anyone on the person's never-contact list (NeverContactError), and every draft is put
 *   through the guard first (chief-guard.ts): a guessed rate, a skill the resume lacks, a submission taken as filed,
 *   an employer claim or a commitment is left as a visible flag in the draft and listed on the card, and a card with an
 *   open flag cannot be sent until the owner edits it;
 * - a card can carry the Chief's proposed jobs for a goal (kind "jobs-plan", chief-goal.ts): Yes saves them, nothing
 *   before;
 * - a card goes only to a WhatsApp number that answers as the same account (cardRecipientFor): another user's draft
 *   never lands on the owner's phone, where his tap would act on his own Gmail.
 */
import { randomBytes } from "crypto"
import { blob } from "@/lib/storage"
import { sendInteractiveButtons, waConfigured } from "@/lib/whatsapp"
import { trace } from "@/lib/whatsapp-trace"
import { guardDraft, neverContactHit, openFlags, type Flag } from "@/lib/chief-guard"
import type { JobsPlan } from "@/lib/chief-goal"

export type ApprovalCardKind = "followup-draft" | "jobs-plan"

export type ApprovalCard = {
  id: string
  userId: string
  /** WhatsApp digits of the owner (recipient of the card). */
  to: string
  kind: ApprovalCardKind
  /** Short label for the card header, e.g. "Follow-up draft". */
  label: string
  toEmail: string
  subject: string
  body: string
  /** Gmail draft id, when the card wraps a real Gmail draft. */
  draftId?: string
  accountEmail?: string
  /** For a draft: what the guard left for the owner (a rate to confirm, a resume gap, …). Shown on the card. */
  flags?: Flag[]
  /** For "jobs-plan": the Chief's proposed jobs. Saved only on Yes. */
  plan?: JobsPlan
  /** For "jobs-plan": a card the owner edited is replaced by a new one, so the old buttons cannot approve it. */
  replacedBy?: string
  status: "pending" | "sent" | "skipped"
  /** True after the owner tapped Edit — the next text message is the edited draft. */
  awaitingEdit?: boolean
  createdAt: number
  updatedAt: number
}

const cardKey = (id: string) => `whatsapp/approvals/${id}.json`
const pendingKey = () => `whatsapp/approvals/pending.json`

const digits = (s: string) => s.replace(/\D/g, "")

async function readPending(): Promise<string[]> {
  try {
    const raw = await blob.getText(pendingKey())
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.map(String) : []
  } catch { return [] }
}

async function writePending(ids: string[]) {
  await blob.put(pendingKey(), JSON.stringify([...new Set(ids)]))
}

/** A draft addressed to someone the person never contacts: no card is made. */
export class NeverContactError extends Error {
  constructor(public entry: string) { super(`${entry} is on your never-contact list, so no draft was made for them.`) }
}

export async function createApprovalCard(input: {
  userId: string
  to: string
  kind: ApprovalCardKind
  label?: string
  toEmail: string
  toName?: string
  subject: string
  body: string
  draftId?: string
  accountEmail?: string
  plan?: JobsPlan
  /** The person's never-contact list (their brief). */
  neverContact?: string[]
  /** For the guard: the person's own words, their resume text, whether the thread confirms the filing, the recruiter's words. */
  ownWords?: string[]
  resumeText?: string | null
  filed?: boolean
  context?: string
}): Promise<ApprovalCard> {
  let { subject, body } = input
  let flags: Flag[] | undefined
  if (input.kind !== "jobs-plan") {
    const hit = neverContactHit(input.neverContact || [], input.toEmail, input.toName)
    if (hit) throw new NeverContactError(hit)
    const guarded = guardDraft({ subject, body, to: input.toEmail, toName: input.toName, ownWords: input.ownWords,
      resumeText: input.resumeText, filed: input.filed, context: input.context })
    subject = guarded.subject; body = guarded.body
    if (guarded.flags.length) flags = guarded.flags
  }
  const card: ApprovalCard = {
    id: randomBytes(12).toString("hex"),
    userId: input.userId,
    to: digits(input.to),
    kind: input.kind,
    label: input.label || (input.kind === "followup-draft" ? "Follow-up draft" : input.kind === "jobs-plan" ? "Jobs for your goal" : "Draft"),
    toEmail: input.toEmail,
    subject,
    body,
    draftId: input.draftId,
    accountEmail: input.accountEmail,
    ...(flags ? { flags } : {}),
    ...(input.plan ? { plan: input.plan } : {}),
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await blob.put(cardKey(card.id), JSON.stringify(card))
  await writePending([...await readPending(), card.id])
  return card
}

export async function getApprovalCard(id: string): Promise<ApprovalCard | null> {
  try {
    const raw = await blob.getText(cardKey(id))
    return raw ? (JSON.parse(raw) as ApprovalCard) : null
  } catch { return null }
}

export async function saveApprovalCard(card: ApprovalCard): Promise<void> {
  card.updatedAt = Date.now()
  await blob.put(cardKey(card.id), JSON.stringify(card))
  const pending = await readPending()
  const isPending = card.status === "pending"
  const has = pending.includes(card.id)
  if (isPending && !has) await writePending([...pending, card.id])
  if (!isPending && has) await writePending(pending.filter(x => x !== card.id))
}

export async function listPendingCards(to: string): Promise<ApprovalCard[]> {
  const ids = await readPending()
  const cards: ApprovalCard[] = []
  for (const id of ids) {
    const c = await getApprovalCard(id)
    if (c && c.status === "pending" && c.to === digits(to)) cards.push(c)
  }
  return cards.sort((a, b) => a.createdAt - b.createdAt)
}

// ── Card delivery ────────────────────────────────────────────────────────────
// Button ids are namespaced so the webhook only intercepts its own replies.

export const cardButtonId = (cardId: string, action: "send" | "edit" | "skip") =>
  `appr:${cardId}:${action}`

export function parseCardButton(id: string): { cardId: string; action: "send" | "edit" | "skip" } | null {
  const m = /^appr:([0-9a-f]{24}):(send|edit|skip)$/.exec(String(id || ""))
  return m ? { cardId: m[1], action: m[2] as "send" | "edit" | "skip" } : null
}

/** The flags still open in a draft card: while there is one, Send does nothing but say so. */
export function sendLocked(card: ApprovalCard): string[] {
  return card.kind === "jobs-plan" ? [] : openFlags(`${card.subject}\n${card.body}`)
}

const FLAG_WORDS: Record<Flag["kind"], string> = { rate: "[rate unconfirmed", commitment: "[commitment —", gap: "[missing:", filing: "[filing may be", employer: "[employer claim", unchecked: "\u0000" }

/** After the owner's own edit: only the flags he left in the text stay listed; his words are not flagged again. */
export function keepOpenFlags(card: ApprovalCard): void {
  const open = sendLocked(card).join(" ")
  const left = (card.flags || []).filter(f => open.includes(FLAG_WORDS[f.kind]))
  if (left.length) card.flags = left
  else delete card.flags
}

export function cardBodyText(card: ApprovalCard): string {
  if (card.kind === "jobs-plan") {
    const text = card.body.length > 900 ? card.body.slice(0, 897) + "…" : card.body
    return [`🗓 ${card.label} — ready for your call`, ``, text].join("\n")
  }
  const notes = (card.flags || []).slice(0, 4).map(f => `• ${f.note.length > 110 ? f.note.slice(0, 109) + "…" : f.note}`)
  const room = notes.length ? 560 : 700
  const draft = card.body.length > room ? card.body.slice(0, room - 3) + "…" : card.body
  return [
    `📝 ${card.label} — ready for your call`,
    ``,
    `To: ${card.toEmail}`,
    `Subject: ${card.subject}`,
    ``,
    draft,
    ...(notes.length ? [``, `Needs your answer:`, ...notes, `Tap Edit and reply with the full text. Send stays locked while a [flag] is open.`] : []),
  ].join("\n")
}

/** Deliver the card to the owner's WhatsApp. Throws when WhatsApp is not wired. */
export async function deliverApprovalCard(card: ApprovalCard): Promise<string> {
  if (!waConfigured()) throw new Error("WhatsApp is not configured on this deployment.")
  const waId = await import("@/lib/whatsapp").then(m => m.sendInteractiveButtons(card.to,
    cardBodyText(card),
    card.status === "pending" && card.awaitingEdit
      ? (card.kind === "jobs-plan" ? "Reply with what to change." : "Reply with your edited version.")
      : (card.kind === "jobs-plan" ? "Nothing is scheduled until you tap Yes." : "Tap a button — nothing sends until you say so."),
    [
      { id: cardButtonId(card.id, "send"), title: card.kind === "jobs-plan" ? "Yes" : "Send" },
      { id: cardButtonId(card.id, "edit"), title: "Edit" },
      { id: cardButtonId(card.id, "skip"), title: "Skip" },
    ]))
  trace(card.to, { dir: "out", kind: "approval-card", text: `${card.label}: ${card.subject}` })
  return waId
}

/** The owner's WhatsApp number: the first number on the bot's sender allowlist. */
export function ownerWhatsAppDigits(): string {
  const raw = (process.env.WHATSAPP_ALLOWED_FROM || "").trim()
  const first = raw.split(",").map(s => digits(s)).find(Boolean)
  return first || ""
}

/**
 * Where a card for this account may go: the owner's number, only when that number answers as this same account (the
 * webhook acts on a tap as the account the number resolves to). "" when it does not: the card is not sent anywhere.
 */
export async function cardRecipientFor(userId: string): Promise<string> {
  const to = ownerWhatsAppDigits()
  if (!to) return ""
  try {
    const { resolveWhatsAppUser } = await import("@/lib/whatsapp-who")
    const who = (await resolveWhatsAppUser(to)).who
    return who?.userId === userId ? to : ""
  } catch { return "" }
}

// ── Gmail draft actions (the tap on Send/Edit/Skip is the owner's explicit consent) ──

async function gmailToken(userId: string, accountEmail: string): Promise<string | null> {
  const { listGoogleWorkspaceAccounts } = await import("@/lib/googleWorkspace")
  const { getGoogleWorkspaceAccessToken } = await import("@/lib/googleWorkspace")
  const accounts = await listGoogleWorkspaceAccounts(userId)
  const acct = accounts.find(a => a.gmail_enabled && a.google_email.toLowerCase() === accountEmail.toLowerCase())
  if (!acct) return null
  return getGoogleWorkspaceAccessToken(userId, acct.id).catch(() => null)
}

function draftRaw(to: string, subject: string, body: string): string {
  return Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`,
  ).toString("base64url")
}

/** Actually send a Gmail draft. Returns an error string, or null on success. */
export async function sendGmailDraft(userId: string, accountEmail: string, draftId: string): Promise<string | null> {
  const token = await gmailToken(userId, accountEmail)
  if (!token) return "Could not reach that Gmail account. Reconnect it in MarketFit, then tap Send again."
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: draftId }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) return `Gmail would not send it (${res.status}). The draft is still in your Drafts folder.`
  return null
}

/** Replace a Gmail draft's content (the owner's edit). Returns error string or null. */
export async function updateGmailDraft(
  userId: string, accountEmail: string, draftId: string, to: string, subject: string, body: string,
): Promise<string | null> {
  const token = await gmailToken(userId, accountEmail)
  if (!token) return "Could not reach that Gmail account."
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw: draftRaw(to, subject, body) } }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) return `Gmail would not update the draft (${res.status}).`
  return null
}

/** Delete a Gmail draft (Skip = discard). Never throws; returns error string or null. */
export async function deleteGmailDraft(userId: string, accountEmail: string, draftId: string): Promise<string | null> {
  const token = await gmailToken(userId, accountEmail)
  if (!token) return "Could not reach that Gmail account."
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok && res.status !== 404) return `Gmail would not delete the draft (${res.status}).`
  return null
}
