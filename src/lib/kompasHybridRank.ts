/**
 * System 3 hybrid retrieval (BM25 already scored by kompasSourceRetrieval, plus a local dense vector).
 * No network and no paid embedding token. Deterministic hashed unigrams plus a fixed synonym map,
 * so a paraphrase can surface beside a lexical hit.
 *
 * KOMPAS_HYBRID_RETRIEVAL: default on. Set to 0, off, or false to keep the previous BM25-only order.
 */
export const HYBRID_POOL = 25
export const HYBRID_ANSWER_K = 5
export const HYBRID_SWITCH = "KOMPAS_HYBRID_RETRIEVAL"

export function hybridRetrievalOn(): boolean {
  try {
    const v = typeof process !== "undefined" ? String(process.env?.[HYBRID_SWITCH] ?? "").trim().toLowerCase() : ""
    if (v === "0" || v === "off" || v === "false") return false
    return true
  } catch {
    return true
  }
}

/** Passages the answer prompt asks for. Five when hybrid rerank is on, four when it is off. */
export function answerPassageCount(): number {
  return hybridRetrievalOn() ? HYBRID_ANSWER_K : 4
}

const DIM = 96
const CONCEPT_WEIGHT = 2.4
const DENSE_FLOOR = 0.38

const CONCEPTS: string[][] = [
  ["shrink", "shrunk", "shorten", "shortened", "reduce", "reduced", "reducing", "cut", "lower", "lowered", "dropped", "drop"],
  ["unresolved", "outstanding", "pending"],
  ["backlog", "queue", "queues"],
  ["alert", "alerts", "detection", "detections", "signal", "signals"],
  ["ticket", "tickets", "finding", "findings"],
  ["incident", "incidents", "outage", "outages"],
  ["rotate", "rotated", "rotating", "rotation", "renew", "renewed", "cycle", "cycled"],
  ["key", "keys", "secret", "secrets", "credential", "credentials"],
  ["disagree", "disagreed", "disagreement", "challenged", "challenge", "pushback", "objected", "conflict"],
  ["manager", "boss", "supervisor"],
  ["triage", "prioritize", "prioritise", "prioritized"],
  ["privileged", "privilege", "identity"],
  ["isolate", "isolated", "isolation", "contain", "contained", "containment"],
  ["open"],
]

const CONCEPT_OF = new Map<string, number>()
CONCEPTS.forEach((group, i) => { for (const w of group) CONCEPT_OF.set(w, i) })

const STOP = new Set(("the and for with that this from your you have has was were are what how why when where which who did does " +
  "about tell time work experience describe example handle give walk through would could should can will into used use using " +
  "ever been them they their there then than also just like some more most very each every other did you").split(/\s+/))

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function contentWords(text: string): string[] {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w))
}

export function embedText(text: string): Float64Array {
  const v = new Float64Array(DIM + CONCEPTS.length)
  const seen = new Set<string>()
  for (const w of contentWords(text)) {
    if (seen.has(w)) continue
    seen.add(w)
    v[hash(w) % DIM] += 1
    const c = CONCEPT_OF.get(w)
    if (c !== undefined) v[DIM + c] += CONCEPT_WEIGHT
  }
  let n = 0
  for (const x of v) n += x * x
  const norm = Math.sqrt(n) || 1
  for (let i = 0; i < v.length; i++) v[i] /= norm
  return v
}

export function cosine(a: Float64Array, b: Float64Array): number {
  let d = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) d += a[i] * b[i]
  return d
}

function contentRecall(question: string, text: string): number {
  const want = [...new Set(contentWords(question))]
  if (!want.length) return 0
  const have = new Set(contentWords(text))
  return want.filter((w) => have.has(w)).length / want.length
}

/** Bonus when the passage contains a contiguous run of the question's content words. */
export function phraseBonus(question: string, text: string): number {
  const words = contentWords(question)
  const hay = ` ${contentWords(text).join(" ")} `
  let bonus = 0
  for (let n = Math.min(6, words.length); n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      if (hay.includes(` ${words.slice(i, i + n).join(" ")} `)) bonus = Math.max(bonus, n >= 4 ? 0.45 : n === 3 ? 0.22 : 0.08)
    }
  }
  return bonus
}

export interface HybridPiece {
  text: string
  score: number
  proves: string
  source: string
}

/**
 * Rerank a candidate pool. Higher baseScore is the first-stage score (already normalized 0–1 within the pool).
 * A demoted passage sorts after every passage that was not demoted.
 */
export function rerankScored<T>(
  question: string,
  pool: T[],
  textOf: (row: T) => string,
  baseOf: (row: T) => number,
  provesOf: (row: T) => string,
  demoted: (row: T) => boolean,
): Array<{ row: T; score: number }> {
  const maxBase = Math.max(0, ...pool.map((row) => baseOf(row))) || 1
  const qv = embedText(question)
  const ranked = pool.map((row) => {
    const text = textOf(row)
    const base = Math.max(0, baseOf(row)) / maxBase
    const dense = cosine(qv, embedText(text))
    const emphasis = provesOf(row) === "emphasis" ? 0.85 : 1
    const score = (0.30 * base + 0.45 * dense + 0.25 * contentRecall(question, text) + phraseBonus(question, text)) * emphasis
    return { row, score, down: demoted(row) }
  })
  ranked.sort((a, b) => (a.down === b.down ? b.score - a.score : a.down ? 1 : -1))
  return ranked.map(({ row, score }) => ({ row, score }))
}

/**
 * Combine BM25 (`score` on each piece) with dense cosine, keep the top 25, rerank those.
 * Returned pieces are copies. `candidates` is how many entered the rerank (at most 25).
 * Passages that missed the pool stay after it, in their incoming order, so a later
 * document-first pass can still see them.
 */
export function fuseAndRerank<T extends HybridPiece>(
  question: string,
  all: T[],
  isDemoted: (row: T) => boolean,
): { passages: T[]; candidates: number } {
  const maxBm = Math.max(0, ...all.map((p) => (p.score > 0 ? p.score : 0))) || 1
  const qv = embedText(question)
  const cache = new Map<string, Float64Array>()
  const vec = (text: string) => {
    const hit = cache.get(text)
    if (hit) return hit
    const v = embedText(text)
    cache.set(text, v)
    return v
  }
  const fused = all.map((p) => {
    const dense = cosine(qv, vec(p.text))
    const bm = p.score > 0 ? p.score / maxBm : 0
    return { p, dense, combined: 0.72 * bm + 0.28 * dense }
  })
  const eligible = fused.filter((x) => x.p.score > 0 || x.dense >= DENSE_FLOOR).sort((a, b) => b.combined - a.combined)
  const pool = eligible.slice(0, HYBRID_POOL)
  const reranked = rerankScored(question, pool, (x) => x.p.text, (x) => x.combined, (x) => x.p.proves, (x) => isDemoted(x.p))
  const head = reranked.map(({ row, score }) => ({ ...row.p, score }))
  const tail = eligible.slice(HYBRID_POOL).map((x) => x.p)
  return { passages: [...head, ...tail], candidates: pool.length }
}
