/**
 * Speed r6 (29 Oct 2026): per-sentence guarded release for personal-history answers ("guarded-sentence" policy).
 * A sentence reaches the screen only after the same deterministic checks the final answer gets pass on that sentence:
 * the figures allowlist and place/prestige/title/version guards (applyGuards must leave it unchanged), the source check
 * (no employer, tool, vague scale or money claim the user's own sources do not back), no provider-error text and no
 * third-person or placeholder text. The first sentence that fails stops ALL further release (fail closed); the full
 * answer still goes through guards, repair and settle, and the final replace always follows, so the existing
 * correction path still applies. A check that throws also stops release.
 *
 * Lens hook: a precomputed sourced opener (owned by Lens) may be shown first. It is approved only when it is marked
 * verbatim, cites a passage id from the user's own experience sources, and its text equals that passage exactly;
 * anything else is rejected and the normal guarded path runs. With no provider registered nothing changes.
 */
import { applyGuards, type SpeakFacts } from "./kompasGuards.ts"
import { isProviderErrorAnswer } from "./kompasDissection.ts"
import { retrievePassages, sourceIndexFor, unsupportedClaims, type Passage, type SourceDoc } from "./kompasSourceRetrieval.ts"

/** Lens contract v1 (research/lens-opener-contract.md): Opener. sourceDoc optional for the r6 hook's callers. */
export interface SourcedOpener { text: string; sourceId: string; sourceDoc?: string; category: string; verbatim: true; leadIn?: string }
/** Lens contract v2 (r5): the fixed lead-in list, mirrors Lens kompasOpener.ts LEAD_INS (r6); scripts/tests/kompas-guards-r9b.test.mjs fails if it differs from the Lens bundle. A lead-in
 *  not on this list is dropped, never spoken. None holds a name, number or date, so it can add no fact. */
export const LEAD_INS: readonly string[] = ["In one of my roles, I ", "In my work, I ", "My work has involved ", "My work has included ", "In one of my roles, I was ", "I am ", "I have "]
/** Spoken opener = known lead-in + the approved verbatim text. Approval is on `text` alone (approveSourcedOpener). */
/** Lens contract v3 (r6) mirror of displayOpener: lead-in + text with only text's first letter lowercased (kept for an
 *  acronym, inner-capital product name or one-letter first word). Pure; approval never uses it. */
export function displayOpenerText(o: { text: string; leadIn?: string } | null | undefined): string {
  const spoken = spokenOpenerText(o)
  if (!o || !spoken) return ""
  const t = o.text.trim(), l = spoken.slice(0, spoken.length - t.length)
  if (!l) return t
  const first = t.split(/\s+/)[0] || ""
  const keep = /^[A-Z][A-Z0-9/&-]+\b/.test(first) || /^[A-Z][a-z]+[A-Z]/.test(first) || first.length === 1
  return keep ? spoken : `${l}${t[0].toLowerCase()}${t.slice(1)}`
}
/** Mirror of Lens isSafeDisplay: true only for a known lead-in, shown === displayOpenerText(o), and the body equal to text
 *  except the case of its first letter. Anything else falls back to the exact text. */
export function isSafeDisplayText(o: { text: string; leadIn?: string } | null | undefined, shown: string): boolean {
  if (!o || typeof o.text !== "string" || !o.text.trim() || !LEAD_INS.concat([""]).includes(String(o.leadIn || ""))) return false
  const t = o.text.trim(), s = String(shown || "")
  if (!s || s !== displayOpenerText(o)) return false
  const body = s.slice(String(o.leadIn || "").length)
  return body.length === t.length && body.slice(1) === t.slice(1) && body[0].toLowerCase() === t[0].toLowerCase()
}
function safeDisplay(op: SourcedOpener): string {
  const shown = displayOpenerText(op)
  return isSafeDisplayText(op, shown) ? shown : op.text.trim()
}
export function spokenOpenerText(o: { text: string; leadIn?: string } | null | undefined): string {
  if (!o || typeof o.text !== "string") return ""
  const t = o.text.trim()
  return t ? `${LEAD_INS.includes(String(o.leadIn || "")) ? o.leadIn : ""}${t}` : ""
}
export type OpenerCategory = "experience-story" | "introduction" | "scenario" | "coding" | "definition" | "general"
export type OpenerTable = Record<string, SourcedOpener[]>
export interface OpenerSourceItem { id: string; sourceDoc: string; category: string; text: string; status: string }
type PickOpener = (table: OpenerTable, question: string, match?: { passages: Array<{ id: string; kind?: string; proves?: string }> }) => SourcedOpener | null | undefined
const EXPERIENCE_DOCS = new Set(["resume", "document", "documents", "transcript", "session"])
export type SentenceCheck = (sentence: string) => boolean

const THIRD = /\bthe candidate\b|\b(?:she|he) (?:led|built|ran|wrote|owned|managed)\b|\[[^\]]*\]|\{\{/i
export function sentenceCheck(ctx: { facts: SpeakFacts | null; allowed: Set<string>; asked?: Set<string>; docs: SourceDoc[]; question: string; passages: Passage[] }): SentenceCheck {
  return (sentence: string) => {
    const s = String(sentence || "").trim()
    if (!s) return false
    if (isProviderErrorAnswer(s)) return false
    if (THIRD.test(s)) return false
    if (applyGuards(s, ctx.facts, ctx.allowed, ctx.asked || new Set()).text.trim() !== s) return false
    if (unsupportedClaims(s, ctx.passages, ctx.docs, ctx.question).length) return false
    return true
  }
}

const ABBREV = /(?:^|\s)(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|inc|ltd|co|corp|no|approx|[a-z])\.$/i
function nextBoundary(buf: string): number {
  const re = /[.!?]+["')\]]?(?=\s)|\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(buf))) {
    const end = m.index + m[0].length
    if (m[0] !== "\n" && ABBREV.test(buf.slice(Math.max(0, end - 8), end))) continue
    return end
  }
  return -1
}

export function approveSourcedOpener(op: unknown, passages: Passage[] | null | undefined): boolean {
  try {
    const o = op as SourcedOpener | null
    if (!o || o.verbatim !== true || typeof o.text !== "string" || typeof o.sourceId !== "string") return false
    // r9 (Lens contract): a category is required, and a named source document must be an experience source (never JD/legacy)
    if (typeof o.category !== "string" || !o.category.trim()) return false
    if (o.sourceDoc !== undefined && !EXPERIENCE_DOCS.has(String(o.sourceDoc))) return false
    const text = o.text.trim()
    if (!text) return false
    const p = (Array.isArray(passages) ? passages : []).find((x) => x.id === o.sourceId)
    return !!p && p.proves === "experience" && (p.line === text || p.text === text)
  } catch { return false }
}

// r9: same rule as Lens's withoutOpenerRepeat (contract §6): a body sentence whose word overlap with the opener is >= 0.6
// (over the smaller word set, words of 3+ letters) restates it and is dropped. Only deletes; never adds or rewrites.
const owords = (s: string) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase().replace(/[^a-z0-9%\s]/g, " ").split(" ").filter((w) => w.length > 2)
export function repeatsOpener(sentence: string, opener: SourcedOpener | string | null | undefined): boolean {
  try {
    const t = typeof opener === "string" ? opener : opener?.text
    const ow = new Set(owords(String(t || "")))
    const sw = new Set(owords(sentence))
    if (!ow.size || !sw.size) return false
    let inter = 0
    for (const w of sw) if (ow.has(w)) inter++
    return inter / Math.min(sw.size, ow.size) >= 0.6
  } catch { return false }
}
export function withoutOpenerRepeat(body: string, opener: SourcedOpener | string | null | undefined): string {
  if (!opener) return body
  try {
    const parts = String(body || "").split(/(?<=[.!?])\s+/)
    const kept = parts.filter((x) => !repeatsOpener(x, opener))
    return kept.length === parts.length ? body : kept.join(" ").trim()
  } catch { return body }
}

export function withOpener(finalText: string, opener: string): string {
  const o = String(opener || "").trim()
  if (!o) return finalText
  if (String(finalText || "").trimStart().startsWith(o)) return finalText
  return `${o} ${withoutOpenerRepeat(String(finalText || "").trimStart(), o)}`.trim()
}

export interface SentenceGate {
  start(): string[]
  push(delta: string): string[]
  finish(): string[]
  halted(): boolean
  openerText(): string
  released(): string[]
}
export function createSentenceGate(o: { check: SentenceCheck; opener?: unknown; sourcePassages?: Passage[] }): SentenceGate {
  let buf = ""
  let stop = false
  const out: string[] = []
  // r9b (contract v3): approve on exact `text` only (cited session passage id); show displayOpener only if isSafeDisplay, else text
  const opener = approveSourcedOpener(o.opener, o.sourcePassages) ? safeDisplay(o.opener as SourcedOpener) : ""
  const judge = (s: string): string[] => {
    const t = s.trim()
    if (!t || stop) return []
    // r9: a body sentence that restates the approved opener is dropped (Lens contract §6/§7: repeat filter, then the guard)
    if (opener && repeatsOpener(t, opener)) return []
    let ok = false
    try { ok = o.check(t) === true } catch { ok = false }
    if (!ok) { stop = true; return [] }
    out.push(t)
    return [t]
  }
  return {
    start: () => (opener ? [opener] : []),
    push(delta: string) {
      if (stop) return []
      buf += String(delta || "")
      const got: string[] = []
      for (let at = nextBoundary(buf); at >= 0 && !stop; at = nextBoundary(buf)) {
        const s = buf.slice(0, at)
        buf = buf.slice(at)
        got.push(...judge(s))
      }
      return got
    },
    finish() { const rest = buf; buf = ""; return judge(rest) },
    halted: () => stop,
    openerText: () => opener,
    released: () => [...out],
  }
}

// ---- Opener provider registry (Lens plugs in here; default none). Any error → no opener.
type OpenerProvider = (question: string, docs: SourceDoc[]) => SourcedOpener | null | undefined
let provider: OpenerProvider | null = null
export function setSourcedOpenerProvider(fn: OpenerProvider | null): void { provider = fn }
export function sourcedOpenerFor(question: string, docs: SourceDoc[]): SourcedOpener | null {
  try { return provider ? provider(question, docs) || null : null } catch { return null }
}


/** The passages an opener may cite: the session index's passages (same ids retrieval uses). Empty on any error. */
export function splitOpenerPassages(docs: SourceDoc[] | null | undefined): Passage[] {
  try { return sourceIndexFor(docs)?.passages || [] } catch { return [] }
}

// ---- r9: Lens opener wiring (contract v1). Lens's buildOpenerTable/pickOpener plug in through lensOpenerProvider.
// Lens's module (lens-work, branch lens-r1, src/lib/kompasOpener.ts) imports kompasAsk.ts, which is not on this branch,
// so it is NOT imported here. contractOpenerTable/contractPickOpener are STUBS with the same contract shape, for tests and
// until Lens's file lands; registering either one is the caller's choice (the service registers nothing by default).
/** STUB of Lens buildOpenerTable: keeps sourced, single-sentence, word-for-word experience lines; refuses the rest. */
export function contractOpenerTable(items: OpenerSourceItem[], sources: { resume?: string; documents?: string; transcript?: string; session?: string }): { table: OpenerTable; refused: Array<{ id: string; reason: string }> } {
  const table: OpenerTable = { "experience-story": [], introduction: [], scenario: [], coding: [], definition: [], general: [] }
  const refused: Array<{ id: string; reason: string }> = []
  const flat = (x: string) => String(x || "").replace(/\s+/g, " ").trim()
  const key: Record<string, "resume" | "documents" | "transcript" | "session"> = { resume: "resume", document: "documents", documents: "documents", transcript: "transcript", session: "session" }
  for (const it of items || []) {
    const text = flat(it?.text)
    const k = key[String(it?.sourceDoc)]
    const reason = it?.status !== "sourced" ? "not sourced" : !k ? "not an experience source" : !(String(it.category) in table) ? "unknown category"
      : !text ? "empty" : !flat(String(sources?.[k] || "")).includes(text) ? "not word for word in its source" : ""
    if (reason) { refused.push({ id: String(it?.id), reason }); continue }
    table[it.category].push({ text, sourceId: it.id, sourceDoc: String(it.sourceDoc), category: it.category, verbatim: true })
  }
  return { table, refused }
}
/** STUB of Lens pickOpener: personal-history asks only (story / introduction); prefers a matched passage id; empty → null. */
export function contractPickOpener(table: OpenerTable, question: string, match?: { passages: Array<{ id: string; kind?: string; proves?: string }> }): SourcedOpener | null {
  const q = String(question || "")
  const cat = /\b(introduce yourself|about yourself|walk me through your (?:resume|background))\b/i.test(q) ? "introduction"
    : /\b(?:tell me about (?:a|one|the) time|(?:a|one) time (?:when )?you|describe a (?:situation|time)|how did you|what did you|did you|have you)\b/i.test(q) ? "experience-story" : ""
  if (!cat) return null
  const list = table?.[cat] || []
  if (!list.length) return null
  for (const p of match?.passages || []) { if (p.proves === "emphasis") continue; const hit = list.find((o) => o.sourceId === p.id); if (hit) return hit }
  return list[0]
}
/**
 * Provider for setSourcedOpenerProvider from a Lens-shaped table and pick function. The matched passages come from the
 * existing retrieval (read only). Anything that throws, or a pick that is not contract-shaped, gives no opener. The gate
 * still approves an opener only by exact match to its cited source passage (approveSourcedOpener).
 */
export function lensOpenerProvider(o: { table: (docs: SourceDoc[]) => OpenerTable; pick: PickOpener }): (question: string, docs: SourceDoc[]) => SourcedOpener | null {
  return (question, docs) => {
    try {
      const table = o.table(docs)
      let match: { passages: Array<{ id: string; kind?: string; proves?: string }> } = { passages: [] }
      try { match = { passages: retrievePassages(question, docs, 4).passages } } catch { /* first item in the category */ }
      const op = o.pick(table, question, match)
      if (!op || op.verbatim !== true || typeof op.text !== "string" || typeof op.sourceId !== "string" || !String(op.category || "").trim()) return null
      return { text: op.text, sourceId: op.sourceId, sourceDoc: op.sourceDoc, category: op.category, verbatim: true, ...(typeof op.leadIn === "string" ? { leadIn: op.leadIn } : {}) }
    } catch { return null }
  }
}
