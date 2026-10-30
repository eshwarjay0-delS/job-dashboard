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
import { sourceIndexFor, unsupportedClaims, type Passage, type SourceDoc } from "./kompasSourceRetrieval.ts"

export interface SourcedOpener { text: string; sourceId: string; category: string; verbatim: true }
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
    const text = o.text.trim()
    if (!text) return false
    const p = (Array.isArray(passages) ? passages : []).find((x) => x.id === o.sourceId)
    return !!p && p.proves === "experience" && (p.line === text || p.text === text)
  } catch { return false }
}

export function withOpener(finalText: string, opener: string): string {
  const o = String(opener || "").trim()
  if (!o) return finalText
  return String(finalText || "").trimStart().startsWith(o) ? finalText : `${o} ${String(finalText || "").trimStart()}`.trim()
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
  const opener = approveSourcedOpener(o.opener, o.sourcePassages) ? (o.opener as SourcedOpener).text.trim() : ""
  const judge = (s: string): string[] => {
    const t = s.trim()
    if (!t || stop) return []
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
