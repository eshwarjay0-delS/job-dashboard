/**
 * Chief approval cards — Phase 4 of the Chief of Staff (docs/research/chief-of-staff-rea.md).
 *
 * When the Chief drafts something sensitive (a follow-up email, …), it is delivered to
 * the owner's WhatsApp as an interactive message with Send / Edit / Skip quick-reply
 * buttons (Meta interactive button message, max 3 buttons). The webhook answers the
 * button taps; nothing is ever sent without the owner tapping Send on the card.
 *
 * Storage is blob-backed, next to the WhatsApp sessions — no SQL migration needed.
 */
import { randomBytes } from "crypto"
import { blob } from "@/lib/storage"
import { sendInteractiveButtons, waConfigured } from "@/lib/whatsapp"
import { trace } from "@/lib/whatsapp-trace"

export type ApprovalCardKind = "followup-draft"

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

export async function createApprovalCard(input: {
  userId: string
  to: string
  kind: ApprovalCardKind
  label?: string
  toEmail: string
  subject: string
  body: string
  draftId?: string
  accountEmail?: string
}): Promise<ApprovalCard> {
  const card: ApprovalCard = {
    id: randomBytes(12).toString("hex"),
    userId: input.userId,
    to: digits(input.to),
    kind: input.kind,
    label: input.label || (input.kind === "followup-draft" ? "Follow-up draft" : "Draft"),
    toEmail: input.toEmail,
    subject: input.subject,
    body: input.body,
    draftId: input.draftId,
    accountEmail: input.accountEmail,
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

function cardBodyText(card: ApprovalCard): string {
  const draft = card.body.length > 700 ? card.body.slice(0, 697) + "…" : card.body
  return [
    `📝 ${card.label} — ready for your call`,
    ``,
    `To: ${card.toEmail}`,
    `Subject: ${card.subject}`,
    ``,
    draft,
  ].join("\n")
}

/** Deliver the card to the owner's WhatsApp. Throws when WhatsApp is not wired. */
export async function deliverApprovalCard(card: ApprovalCard): Promise<string> {
  if (!waConfigured()) throw new Error("WhatsApp is not configured on this deployment.")
  const waId = await import("@/lib/whatsapp").then(m => m.sendInteractiveButtons(card.to,
    cardBodyText(card),
    card.status === "pending" && card.awaitingEdit
      ? "Reply with your edited version."
      : "Tap a button — nothing sends until you say so.",
    [
      { id: cardButtonId(card.id, "send"), title: "Send" },
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
