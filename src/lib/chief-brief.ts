// The person's own brief: the one rule, the four lines (Me, My candidates or customers, My voice, Never) and the
// never-contact list, which the Chief reads before every job.
//
// The mistake it prevents: a Chief working from the shared prompt alone, writing in nobody's voice and not knowing whom it
// must never contact. Owner, 23 Oct 2026, the course's brief "at the top of the first message", and his one rule: "Run
// my job hunt. Public data only. Never email [three vendors he names]. Never auto-send anything. Never invent what's not
// on my resume. Report to me in plain words." His three names are his data: they are kept with his account, never
// written into this public code. Every user's Chief starts from the same rule with an empty list of their own.
//
// Kept as one small file per person beside the recruiter list (my-recruiters-store.ts): no table, no migration.
import { blob } from "@/lib/storage"

export type ChiefBrief = {
  /** The one rule. Starts as ONE_RULE; the person may rewrite it in their own words. */
  rule: string
  me: string
  people: string
  /** Two lines in the person's own words. */
  voice: string
  never: string
  /** Vendors, firms, domains or people the Chief never writes to or drafts for. Matched in code (chief-guard.ts). */
  neverContact: string[]
  updatedAt?: number
}

export const ONE_RULE = "Run my job hunt. Public data only. Never email anyone on my never-contact list. Never auto-send anything. Never invent what's not on my resume. Report to me in plain words."
/** What the Never line always holds, whatever the person writes beside it. */
export const NEVER_ALWAYS = "contact anyone, send, post, pay, or commit to a rate without my yes"

const MAX_LINE = 300
const MAX_VOICE_LINE = 200
const MAX_NEVER_CONTACT = 40

export function emptyBrief(): ChiefBrief {
  return { rule: ONE_RULE, me: "", people: "", voice: "", never: "", neverContact: [] }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const oneLine = (s: unknown, n = MAX_LINE) => clip(String(s ?? "").replace(/\s+/g, " ").trim(), n)
/** Two lines at most, each its own sentence in the person's words. */
const twoLines = (s: unknown) => String(s ?? "").split(/\r?\n/).map(l => oneLine(l, MAX_VOICE_LINE)).filter(Boolean).slice(0, 2).join("\n")

/** "acme.com, Foo Staffing; jane@x.com" → ["acme.com", "Foo Staffing", "jane@x.com"], de-duplicated, case kept. */
export function contactList(v: unknown): string[] {
  const parts = Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[,;\n]+/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = oneLine(p, 80).replace(/^(?:and|or)\s+/i, "")
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out.slice(0, MAX_NEVER_CONTACT)
}

export function validBrief(v: unknown): ChiefBrief {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>
  return {
    rule: oneLine(o.rule) || ONE_RULE,
    me: oneLine(o.me),
    people: oneLine(o.people),
    voice: twoLines(o.voice),
    never: oneLine(o.never),
    neverContact: contactList(o.neverContact),
    ...(typeof o.updatedAt === "number" ? { updatedAt: o.updatedAt } : {}),
  }
}

// ── Reading what the person typed ────────────────────────────────────────────
type Field = "rule" | "me" | "people" | "voice" | "never" | "neverContact"
const LABELS: [RegExp, Field][] = [
  [/^(?:the\s+)?(?:one\s+)?rule$/i, "rule"],
  [/^me$/i, "me"],
  [/^(?:my\s+)?(?:candidates?|customers?|clients?|people)(?:\s+(?:or|and|\/)\s+(?:candidates?|customers?|clients?))?$/i, "people"],
  [/^(?:my\s+)?voice$/i, "voice"],
  [/^never[\s-]+(?:contact|email|write\s+to)$/i, "neverContact"],
  [/^never$/i, "never"],
]

/**
 * "Me: …" / "My candidates: …" / "My voice: …" (a second line under it carries on) / "Never: …" / "Never contact: …".
 * Returns only the fields that were written; lines it could not place are handed back so the person is told.
 */
export function parseBriefText(text: string): { patch: Partial<ChiefBrief>; unread: string[] } {
  const patch: Partial<Record<Field, string>> = {}
  const unread: string[] = []
  let last: Field | null = null
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^(?:my\s+)?brief\s*:?$/i.test(line)) continue
    const m = /^([A-Za-z /-]{2,40}?)\s*[:–—]\s*(.*)$/.exec(line)
    const field = m ? LABELS.find(([re]) => re.test(m[1].trim()))?.[1] : undefined
    if (m && field) {
      patch[field] = m[2].trim()
      last = field
    } else if (last === "voice" || last === "neverContact") {
      patch[last] = `${patch[last] || ""}\n${line}`.trim()
    } else if (last) {
      patch[last] = `${patch[last] || ""} ${line}`.trim()
    } else {
      unread.push(line)
    }
  }
  const out: Partial<ChiefBrief> = {}
  if (patch.rule !== undefined) out.rule = oneLine(patch.rule)
  if (patch.me !== undefined) out.me = oneLine(patch.me)
  if (patch.people !== undefined) out.people = oneLine(patch.people)
  if (patch.voice !== undefined) out.voice = twoLines(patch.voice)
  if (patch.never !== undefined) out.never = oneLine(patch.never)
  if (patch.neverContact !== undefined) out.neverContact = contactList(patch.neverContact)
  return { patch: out, unread }
}

/**
 * The brief holds what the Chief reads before every job, so it never holds what the Chief must never handle (the
 * public-data rule): identity numbers, passwords, keys. Returns the reason it was refused, or "".
 */
export function screenBrief(patch: Partial<ChiefBrief>): string {
  const all = [patch.rule, patch.me, patch.people, patch.voice, patch.never, ...(patch.neverContact || [])].join("\n")
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(all)) return "It looks like it holds a social security number. The brief never keeps identity numbers."
  if (/\b(?:password|passcode|api[\s_-]?key|secret key|passport\s*(?:no|number|#))\b/i.test(all)) return "It looks like it holds a password, a key or a passport number. The brief never keeps those."
  if (/\b(?:date of birth|dob)\b/i.test(all)) return "It looks like it holds a date of birth. The brief never keeps it."
  return ""
}

export function mergeBrief(current: ChiefBrief, patch: Partial<ChiefBrief>, now = Date.now()): ChiefBrief {
  return validBrief({ ...current, ...patch, updatedAt: now })
}

// ── What the Chief reads ─────────────────────────────────────────────────────
/** The person's brief as it opens every Chief prompt. An unwritten line says so instead of being guessed. */
export function briefBlock(brief: ChiefBrief | null | undefined): string {
  const b = validBrief(brief || emptyBrief())
  const blank = "(not written yet)"
  const lines = [
    "THE USER'S BRIEF (their own words; read it before every job, and let every draft sound like My voice):",
    `- The one rule: ${b.rule}`,
    `- Me: ${b.me || blank}`,
    `- My candidates or customers: ${b.people || blank}`,
    `- My voice: ${b.voice ? b.voice.replace(/\n/g, " / ") : blank}`,
    `- Never without my yes: ${b.never ? `${b.never}; and always: ${NEVER_ALWAYS}` : NEVER_ALWAYS}`,
    `- Never contact (no draft, no message, no card addressed to them): ${b.neverContact.length ? b.neverContact.join(", ") : "(none listed)"}`,
  ]
  if (!b.me && !b.people && !b.voice) {
    lines.push("The brief is not written yet. When it would help, ask once for the four lines (Me, My candidates, My voice, Never) — on WhatsApp the user sends *brief* — and carry on meanwhile.")
  }
  return lines.join("\n")
}

/** Every Chief job prompt starts from the brief: this is the one way a prompt is put together with it. */
export function startFromBrief(brief: ChiefBrief | null | undefined, prompt: string): string {
  return `${briefBlock(brief)}\n\n${prompt}`
}

/** The person's own words in the brief: a figure written here came from them (chief-guard.ts). */
export function briefWords(brief: ChiefBrief | null | undefined): string {
  const b = validBrief(brief || emptyBrief())
  return [b.me, b.people, b.voice, b.never].filter(Boolean).join("\n")
}

/** The brief as the person sees it on WhatsApp. */
export function briefShowText(brief: ChiefBrief | null | undefined): string {
  const b = validBrief(brief || emptyBrief())
  const blank = "_not written yet_"
  return [
    "*Your brief* — I read it before every job:",
    "",
    `*Rule:* ${b.rule}`,
    `*Me:* ${b.me || blank}`,
    `*My candidates:* ${b.people || blank}`,
    `*My voice:* ${b.voice ? b.voice.replace(/\n/g, " / ") : blank}`,
    `*Never:* ${b.never ? `${b.never} (and always: ${NEVER_ALWAYS})` : NEVER_ALWAYS}`,
    `*Never contact:* ${b.neverContact.length ? b.neverContact.join(", ") : "_nobody listed yet_"}`,
    "",
    "To change a line, send *brief* and the line, for example:",
    "_brief_",
    "_Me: C2C cybersecurity contractor, Houston_",
    "_Never contact: example-staffing.com, Example Firm_",
  ].join("\n")
}

// ── Where it is kept ─────────────────────────────────────────────────────────
const keyOf = (userId: string): string => `chief/brief/${userId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`

export async function readBrief(userId: string): Promise<ChiefBrief> {
  try {
    const raw = await blob.getText(keyOf(userId))
    return raw ? validBrief(JSON.parse(raw)) : emptyBrief()
  } catch { return emptyBrief() }
}

export async function writeBrief(userId: string, brief: ChiefBrief): Promise<ChiefBrief> {
  const kept = validBrief(brief)
  await blob.put(keyOf(userId), JSON.stringify(kept))
  return kept
}
