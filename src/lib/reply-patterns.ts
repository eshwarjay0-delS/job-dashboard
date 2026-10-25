// Reply-pattern delegation: learn the reply shape from trigger + sender
// class, not from phrase counts. A stat is not a nudge: a true nudge is one
// decision, pre-filled, with Send / Edit / Skip.
//
// This file is pure logic only: no Gmail calls, no storage, no sends. The
// route in src/app/api/gmail/reply-patterns/route.ts owns auth, guardrail
// re-checks and the actual send; Smart Reply (3 chips, per-account
// profiles, approve-to-send) stays the default and is untouched by this
// layer. Delegate (Tier 2) is an explicit per-pattern opt-in, never global,
// and it may auto-send only the availability-interview pattern, only when
// every eligibility check passes. Anything else falls back to Tier 1.

import { MARKETING_FIRM_DOMAINS } from "./email-classifier.ts"

export type SenderClass = "new-external" | "known-vendor" | "marketing"
export type PatternId = "gate-c2c-c2h" | "availability-interview" | "followup-weekly-interview"
export type Bucket = "needs-you" | "waiting" | "done"

/** Marketing domains, from the classifier list, plus the TekBlu .com
 *  variant that appears in the app's own mail sample. Any sender on one
 *  of these is filed and tracked, never replied to. */
export const MARKETING_DOMAINS: readonly string[] = [
  ...MARKETING_FIRM_DOMAINS,
  "tekblu.com",
]

export const NEVER_AUTO_SEND: readonly string[] = [
  "PII (DOB, SSN last-4, passport number, street address, Skype ID)",
  "RTR or authorisation to submit, or employer language",
  "Rate negotiation (a rate number, a range, a counter-offer)",
  "Document copies (DL, GC, visa, passport, certificates, selfies with documents)",
  "Any reply to a marketing firm",
  "Any reply on a req with an active double-submit hold",
  "Any reply bundling two triggers (for example availability plus documents)",
]

export function domainOf(email: string): string {
  return String(email || "").trim().toLowerCase().split("@")[1] || ""
}

/** "Jane Doe <jane@firm.com>" -> "jane@firm.com"; a bare address passes through. */
export function senderEmailOf(from: string): string {
  const m = String(from || "").match(/<([^<>@\s]+@[^<>\s]+)>/)
  if (m) return m[1].toLowerCase()
  const bare = String(from || "").trim().toLowerCase()
  return bare.includes("@") && !bare.includes(" ") ? bare : ""
}

function domainMatches(ruleDomain: string, senderDomain: string): boolean {
  const r = ruleDomain.toLowerCase(), s = senderDomain.toLowerCase()
  return !!r && !!s && (s === r || s.endsWith(`.${r}`))
}

export function isMarketingSender(senderEmail: string): boolean {
  const d = domainOf(senderEmail)
  return MARKETING_DOMAINS.some(m => domainMatches(m, d))
}

/**
 * Sender class, in order: marketing first (never replied to), then known
 * vendor (on the vendor list, or a prior thread with this sender/domain),
 * otherwise new external. Vendor-list source of truth, settled
 * conservatively: the caller's own recruiter/vendor list (the
 * my-recruiters list the owner marks himself) plus any prior thread.
 * With no list supplied, nobody is assumed known — a sender is new
 * external until classified. No vendor list is invented here.
 */
export function classifySender(input: {
  senderEmail: string
  vendorEmails?: readonly string[]
  vendorDomains?: readonly string[]
  priorSenders?: readonly string[]
}): SenderClass {
  const email = input.senderEmail.toLowerCase().trim()
  if (!email) return "new-external"
  if (isMarketingSender(email)) return "marketing"
  const d = domainOf(email)
  const vendorEmails = (input.vendorEmails || []).map(e => e.toLowerCase().trim())
  const vendorDomains = (input.vendorDomains || []).map(e => e.toLowerCase().trim())
  const prior = (input.priorSenders || []).map(e => senderEmailOf(e))
  if (vendorEmails.includes(email)) return "known-vendor"
  if (vendorDomains.some(v => domainMatches(v, d))) return "known-vendor"
  if (prior.includes(email)) return "known-vendor"
  if (prior.some(p => domainOf(p) === d && d !== "")) return "known-vendor"
  return "new-external"
}

/** First word of a display name, safe to drop into a greeting. */
export function firstNameOf(from: string): string {
  const name = String(from || "").replace(/<[^>]*>/g, "").trim()
  const first = name.split(/\s+/)[0] || ""
  return first.replace(/[^A-Za-z'-]/g, "").slice(0, 40) || "there"
}

const PITCH_SIGNALS: readonly RegExp[] = [
  /are you interested/i,
  /let me know if (you are )?interested/i,
  /share (your )?(resume|profile|updated resume)/i,
  /job description|jd attached|attached.*\bjd\b/i,
  /\b(role|position|opening)\b.{0,80}\b(client|location|remote|onsite|hybrid)\b/i,
]

function countPitchSignals(text: string, jobTitle: string): number {
  let n = 0
  for (const re of PITCH_SIGNALS) if (re.test(text)) n++
  if (jobTitle.trim()) n++
  return n
}

/**
 * A gate fires only on a new role pitch: sender class new-external, not
 * an interview invite, RTR, rate confirmation, rejection, offer,
 * submission confirmation, document request or follow-up, and at least
 * two pitch signals (a role title counts as one).
 */
export function isRolePitch(input: {
  senderClass: SenderClass
  category: string
  text: string
  jobTitle?: string
}): boolean {
  if (input.senderClass !== "new-external") return false
  const nonPitch = new Set([
    "Interview Request", "RTR Request", "Rate Confirmation", "Rejection",
    "Offer", "Submission Confirmation", "Document Request", "Follow-up",
  ])
  if (nonPitch.has(input.category)) return false
  return countPitchSignals(input.text || "", input.jobTitle || "") >= 2
}

/** A direct interview-availability question, with no other ask bundled in. */
export function isAvailabilityAsk(text: string): boolean {
  const t = text || ""
  return /when are you available|share your availability|availability for (an? )?(interview|call|meeting)|available for (an? )?(interview|call|meeting)/i.test(t)
    && !hasBundledAsk(t)
}

/** Rate, RTR or document asks present in the same message. */
export function hasBundledAsk(text: string): boolean {
  const t = text || ""
  return /\$\s?\d|per hour|\/hr\b/i.test(t)
    || /right to represent|\brtr\b|authori[sz]e.*submit/i.test(t)
    || /driver'?s licen[cs]e|\bdl\b.{0,20}copy|passport|visa copy|gc copy|share (your )?(dl|license|documents)/i.test(t)
}

/** The gate reply, whole and minimal: one question, asked first. */
export function gateReply(recruiterFirstName: string, role: string, client?: string): string {
  const name = recruiterFirstName.trim() || "there"
  const rolePart = role.trim() ? ` about ${role.trim()}` : ""
  const clientPart = client && client.trim() ? `, ${client.trim()}` : ""
  return [
    `Hello ${name},`,
    ``,
    `Thank you for reaching out${rolePart}${clientPart}.`,
    ``,
    `Before we discuss rate, location, or documents, could you please confirm one thing: is this role offered as C2C or as C2H?`,
    ``,
    `I am only available on a C2C or C2H basis at the moment, so I want to confirm the engagement type first.`,
    ``,
    `Thank you,`,
    `Eshwar`,
  ].join("\n")
}

/** The Tier 1 / Tier 2 availability reply: window only, nothing else. */
export function availabilityReply(recruiterFirstName: string): string {
  const name = recruiterFirstName.trim() || "there"
  return [
    `Hello ${name},`,
    ``,
    `Thank you for reaching out. I am available for interviews Monday to Thursday, 9 AM to 3 PM CST. Please let me know a time that works on your side.`,
    ``,
    `Thank you,`,
    `Eshwar`,
  ].join("\n")
}

const GATE_FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
  [/\$\s?\d/, "rate number"],
  [/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, "SSN-shaped number"],
  [/passport|driver'?s licen[cs]e|social security|date of birth|skype/i, "PII or document reference"],
  [/right to represent|represent me|authori[sz]e.*submit|you are my employer/i, "RTR or employer language"],
  [/\b(monday|tuesday|wednesday|thursday|friday)\b.{0,40}\b\d{1,2}\s?(am|pm)\b/i, "availability window"],
  [/resume attached|attached.*resume/i, "resume attachment claim"],
]

/** Every rule a gate reply must pass. Empty means safe to send. */
export function gateViolations(body: string): string[] {
  return GATE_FORBIDDEN.filter(([re]) => re.test(body)).map(([, why]) => why)
}

const AVAILABILITY_FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
  [/\$\s?\d/, "rate number"],
  [/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, "SSN-shaped number"],
  [/passport|driver'?s licen[cs]e|social security|date of birth|skype/i, "PII or document reference"],
  [/right to represent|represent me|authori[sz]e.*submit|you are my employer/i, "RTR or employer language"],
]

export function availabilityViolations(body: string): string[] {
  return AVAILABILITY_FORBIDDEN.filter(([re]) => re.test(body)).map(([, why]) => why)
}

function norm(s: string | undefined): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/**
 * Same-req match, settled conservatively: an exact req number wins; with
 * no req number on either side, client plus role plus location must all
 * three match. Anything weaker is a possible match for a human to link,
 * never an automatic double-submit hold.
 */
export function chainsMatch(a: { req?: string; client?: string; role?: string; location?: string },
  b: { req?: string; client?: string; role?: string; location?: string }): boolean {
  const ra = (a.req || "").trim(), rb = (b.req || "").trim()
  if (ra && rb) return ra === rb
  const ca = norm(a.client), cb = norm(b.client)
  const roa = norm(a.role), rob = norm(b.role)
  const la = norm(a.location), lb = norm(b.location)
  return !!ca && !!roa && !!la && ca === cb && roa === rob && la === lb
}

/** Req-first card key: req number when stated, else sender + role + date. */
export function cardKey(input: { req?: string; senderEmail?: string; role?: string; firstPitchDate?: string }): string {
  const req = (input.req || "").trim()
  if (req) return `req:${req}`
  return `pitch:${domainOf(input.senderEmail || "")}:${norm(input.role)}:${input.firstPitchDate || ""}`
}

export function bucketFor(input: {
  decisionWaiting: boolean
  sentAwaitingReply: boolean
  resolved: boolean
  filedOnly?: boolean
}): Bucket {
  if (input.resolved || input.filedOnly) return "done"
  if (input.decisionWaiting) return "needs-you"
  if (input.sentAwaitingReply) return "waiting"
  return "needs-you"
}

/** The three questions every Gmail screen must answer, in plain words. */
export function cardHeader(input: {
  role: string
  client?: string
  recruiterName?: string
  decision: string
  deadline?: string
}): { what: string; todo: string; ifIgnored: string } {
  const role = input.role.trim() || "a role"
  const client = input.client && input.client.trim() ? ` at ${input.client.trim()}` : ""
  const who = input.recruiterName && input.recruiterName.trim() ? ` from ${input.recruiterName.trim()}` : ""
  return {
    what: `${role}${client}${who}: ${input.decision}`,
    todo: input.decision,
    ifIgnored: input.deadline && input.deadline.trim()
      ? `If you ignore it, the req may move on after ${input.deadline.trim()}.`
      : "If you ignore it, the recruiter will not hear back and the req may move on. Nothing is sent by ignoring it.",
  }
}

/** Buttons are verbs plus outcomes, never bare Reply or Send. */
export function verbLabel(pattern: PatternId): string {
  switch (pattern) {
    case "gate-c2c-c2h": return "Ask C2C or C2H"
    case "availability-interview": return "Confirm availability"
    case "followup-weekly-interview": return "Send follow-up"
  }
}

export type DelegateOptIn = {
  patternId: PatternId
  account: string
  senderClass: SenderClass
  enabledAt: string
}

export function validDelegateOptIn(r: unknown): r is DelegateOptIn {
  if (!r || typeof r !== "object") return false
  const o = r as Record<string, unknown>
  return o.patternId === "availability-interview"
    && typeof o.account === "string" && o.account.includes("@")
    && (o.senderClass === "new-external" || o.senderClass === "known-vendor")
    && typeof o.enabledAt === "string" && !!o.enabledAt
}

/**
 * Tier 2 eligibility, all five spec checks, no close-enough auto-send.
 * Note the deliberate narrowness: only availability-interview can ever
 * be delegated, and only after at least one Tier 1 send of that exact
 * pattern on that account. Any failure falls back to Tier 1.
 */
export function delegateEligible(input: {
  optIn: unknown
  patternId: PatternId
  account: string
  senderClass: SenderClass
  priorTier1Sends: number
  pureAvailabilityAsk: boolean
  doubleSubmitHold: boolean
  body: string
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!validDelegateOptIn(input.optIn)) reasons.push("no Tier 2 opt-in for availability-interview on this account and sender class")
  else {
    const o = input.optIn as DelegateOptIn
    if (o.patternId !== input.patternId) reasons.push("opt-in is for a different pattern")
    if (o.account.toLowerCase() !== input.account.toLowerCase()) reasons.push("opt-in is for a different account")
    if (o.senderClass !== input.senderClass) reasons.push("opt-in does not cover this sender class")
  }
  if (input.patternId !== "availability-interview") reasons.push("only availability-interview can be delegated")
  if (input.priorTier1Sends < 1) reasons.push("no prior Tier 1 send of this pattern on this account")
  if (!input.pureAvailabilityAsk) reasons.push("the ask is not a pure availability ask")
  if (input.doubleSubmitHold) reasons.push("double-submit hold is active")
  if (input.senderClass === "marketing") reasons.push("sender is a marketing firm")
  const violations = availabilityViolations(input.body)
  if (violations.length) reasons.push(`reply body is not the exact availability template: ${violations.join(", ")}`)
  return { eligible: reasons.length === 0, reasons }
}

/** Skip pauses only the 48-hour re-nudge for that ask; the weekly
 *  follow-up cadence for the req is unchanged. */
export const SKIP_RENUDGE_MS = 48 * 60 * 60 * 1000
