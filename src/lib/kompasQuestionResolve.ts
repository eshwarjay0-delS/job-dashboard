/**
 * Live-question resolution for Kompas (2026-11-10).
 *
 * When AI Answer is pressed, the question is not only a copied span of the
 * last line. The last 60–90 seconds of transcript are the context window:
 * adjacent question sentences are merged, phrases such as "this question"
 * are resolved from that window, and filler is dropped. The model derive
 * prompt does the same rewrite; this module is the offline, deterministic
 * half used as a fallback and in tests. Written for Kompas; not a copy of
 * any third-party client.
 */

export const CONTEXT_WINDOW_MS = 90_000
export const CONTEXT_WINDOW_MIN_MS = 60_000

export type TranscriptLine = {
  who?: string
  text?: string
  at?: number
  seq?: number
}

const LABEL = /^\s*(?:You(?: \((?:typed|earlier|context keywords)\))?|Them(?: \(earlier\))?):\s*/i
const THIS_REF = /\bthis (?:kind of |sort of |type of )?question\b/i
const FILLER_LEAD = /^(?:(?:uh|um|so|like|okay|ok|right|yeah|yes|well)\s*,?\s*)+/i

export function stripLineLabel(text: string): string {
  return String(text || "").replace(LABEL, "").replace(/\s+/g, " ").trim()
}

/** Lines spoken inside the last `windowMs` (default 90 s). Falls back to the last 40 lines when timestamps are missing. */
export function linesInWindow(
  lines: readonly TranscriptLine[] | null | undefined,
  now = Date.now(),
  windowMs = CONTEXT_WINDOW_MS,
  beforeSeq?: number,
): TranscriptLine[] {
  const all = Array.from(lines || []).filter((l) => (beforeSeq == null ? true : Number(l.seq) < beforeSeq))
  const cutoff = now - windowMs
  const stamped = all.filter((l) => Number.isFinite(Number(l.at)) && Number(l.at) > 0)
  if (stamped.length >= Math.min(all.length, 1) && stamped.length === all.length) {
    const recent = all.filter((l) => Number(l.at) >= cutoff)
    return recent.length ? recent : all.slice(-40)
  }
  return all.slice(-40)
}

export function interviewerTexts(lines: readonly TranscriptLine[] | readonly string[]): string[] {
  const raw: ReadonlyArray<TranscriptLine | string> = lines || []
  return raw
    .map((l) => (typeof l === "string" ? l : `${l.who || ""}: ${l.text || ""}`))
    .map(stripLineLabel)
    .map((text) => text.replace(FILLER_LEAD, "").trim())
    .filter(Boolean)
}

/** Last explicit interviewer question in the window, ignoring mere back-references. */
export function priorExplicitQuestion(context: readonly string[]): string {
  const asks = Array.from(context || [])
    .map((t) => String(t || "").replace(/\s+/g, " ").trim())
    .filter((t) => /[?]/.test(t) || /^(?:tell|walk|describe|explain|give|how|what|why|when|where|which|who|can|could|would|will|do|does|did)\b/i.test(t))
    .filter((t) => !THIS_REF.test(t))
  return asks.length ? asks[asks.length - 1] : ""
}

function topicFromQuestion(ask: string): string {
  const t = String(ask || "").replace(/\?\s*$/, "").replace(/\s+/g, " ").trim()
  const about = t.match(/\b(?:about|on)\s+(.+)$/i)
  if (about) return about[1].replace(/^(?:a|an|the)\s+/i, "").trim()
  const tell = t.match(/^tell me about\s+(.+)$/i)
  if (tell) return tell[1].replace(/^(?:a|an|the)\s+/i, "").trim()
  return t
}

/** Resolve "this question" / "this kind of question" against the prior explicit ask in the window. */
export function resolveReferent(question: string, context: readonly string[]): string {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (!q || !THIS_REF.test(q)) return q
  const prior = priorExplicitQuestion(context)
  if (!prior) return q
  const topic = topicFromQuestion(prior)
  if (!topic) return q
  // "from this question" → "from the conflict question" when the prior ask is a conflict question.
  const shortTopic = topic.length > 80 ? topic.slice(0, 77).trim() + "…" : topic
  if (/\bthis question\b/i.test(q)) {
    return q.replace(THIS_REF, () => {
      // Prefer a compact noun phrase when the prior ask is a well-known pattern.
      if (/\bconflict\b/i.test(prior)) return "the conflict question"
      return `the question about ${shortTopic}`
    })
  }
  return q.replace(THIS_REF, `the question about ${shortTopic}`)
}

/** Merge two adjacent interviewer asks that belong to the same turn (e.g. story + "How did you resolve it?"). */
export function mergeAdjacentAsks(asks: readonly string[]): string {
  const parts = Array.from(asks || []).map((s) => String(s || "").replace(/\s+/g, " ").trim()).filter(Boolean)
  if (!parts.length) return ""
  if (parts.length === 1) return parts[0]
  // Keep the last two when the second is a short follow-up of the first.
  const a = parts[parts.length - 2]
  const b = parts[parts.length - 1]
  const bWords = b.split(/\s+/).length
  const followUp = /^(?:how|why|what|and how|and what|can you|could you)\b/i.test(b) && bWords <= 16
  const sameSubject = !differentSubjects(a, b)
  if (followUp || (sameSubject && bWords <= 16)) {
    const left = /[.?!]$/.test(a) ? a : a + (a.endsWith("?") ? "" : ".")
    return `${left} ${b}`.replace(/\s+/g, " ").trim()
  }
  return b
}

function differentSubjects(a: string, b: string): boolean {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3))
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return false
  let overlap = 0
  for (const w of B) if (A.has(w)) overlap++
  return overlap === 0
}

/**
 * Form the one question the Answer button should send: merge adjacent asks,
 * resolve back-references from the 60–90 s window, drop filler leads.
 */
export function resolveLiveQuestion(opts: {
  formed?: string
  pending?: readonly string[]
  context?: readonly string[]
}): string {
  const pending = (opts.pending || []).map((t) => stripLineLabel(t).replace(FILLER_LEAD, "").trim()).filter(Boolean)
  const context = (opts.context || []).map((t) => stripLineLabel(t).replace(FILLER_LEAD, "").trim()).filter(Boolean)
  const mergedPending = pending.length ? mergeAdjacentAsks(pending) : ""
  let formed = String(opts.formed || mergedPending || "").replace(/\s+/g, " ").trim()
  if (!formed && pending.length) formed = pending[pending.length - 1]
  formed = formed.replace(FILLER_LEAD, "").trim()
  const windowTexts = context.length ? context : pending
  return resolveReferent(formed, windowTexts)
}
