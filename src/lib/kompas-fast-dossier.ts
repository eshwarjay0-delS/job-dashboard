/**
 * Precomputed compact factual retrieval for live Kompas turns.
 * No LLM call inside queryFastDossier. Build once before interview; persist.
 */
import type { DossierSource } from "./kompas-dossier-bots"

export const FAST_DOSSIER_VERSION = "kompas-fast-dossier-v1"
const MAX_CHUNKS = 1200
const CHUNK_WIDTH = 880
const STOP = new Set(("a an the and or with within on at to in by for from of is are was were be being been " +
"i you we they he she it this that those these our their my his her which what when how why " +
"can could would should will did do does have has had about into then there here than if but " +
"some any all very more most much many as so not just using use used role work people team").split(/\s+/))

export type FastChunk = {
  sourceId: string
  sourceKind: DossierSource["kind"]
  title: string
  text: string
  claims: "candidate-asserted" | "supporting-document" | "context-only"
}
export type FastDossierIndex = {
  version: typeof FAST_DOSSIER_VERSION
  sourceDigest: string
  resumeFingerprint: string
  jobFingerprint: string
  createdAt: string
  chunks: FastChunk[]
  postings: Record<string, number[]>
}
export type FastHit = {
  sourceId: string
  kind: DossierSource["kind"]
  evidence: FastChunk["claims"]
  score: number
  text: string
  title: string
}
export function tokenizeDossier(value: string): string[] {
  const terms = String(value || "").normalize("NFKC").toLocaleLowerCase("en").match(/[\p{L}\p{N}]{2,}/gu) || []
  return terms.filter(t => !STOP.has(t))
}

const claimType = (kind: DossierSource["kind"]): FastChunk["claims"] =>
  kind === "resume" || kind === "candidate_correction" ? "candidate-asserted"
    : kind === "document" ? "supporting-document" : "context-only"

function splitSource(text: string): string[] {
  // Prefer paragraph boundaries, no overlap; content preserved in order.
  const chunks: string[] = []
  let at = 0
  while (at < text.length) {
    let end = Math.min(text.length, at + CHUNK_WIDTH)
    if (end < text.length) {
      const slice = text.slice(at, end)
      const candidates = [slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" ")]
      const pivot = candidates.find(n => n >= Math.min(260, Math.floor(slice.length * 0.38)))
      if (pivot !== undefined) end = at + pivot + 1
    }
    if (end <= at) end = Math.min(text.length, at + CHUNK_WIDTH)
    chunks.push(text.slice(at, end))
    at = end
  }
  return chunks
}

/** Immutable inverted index, once per source digest. */
export function buildFastDossierIndex(
  sources: DossierSource[], sourceDigest: string, resumeFingerprint: string, jobFingerprint: string,
  now = new Date().toISOString(),
): FastDossierIndex {
  if (!/^[a-f0-9]{64}$/.test(sourceDigest)) throw new Error("Invalid dossier digest.")
  const chunks: FastChunk[] = []
  const postings: Record<string, number[]> = Object.create(null) as Record<string, number[]>
  for (const src of sources) {
    for (const text of splitSource(src.text)) {
      if (chunks.length >= MAX_CHUNKS) throw new Error("Source index too large; use batch import.")
      if (!text.trim()) continue
      const id = chunks.length
      chunks.push({ sourceId: src.id, sourceKind: src.kind, title: src.title, text, claims: claimType(src.kind) })
      for (const t of new Set(tokenizeDossier(text))) {
        if (!Object.prototype.hasOwnProperty.call(postings, t)) postings[t] = []
        postings[t].push(id)
      }
    }
  }
  return { version: FAST_DOSSIER_VERSION, sourceDigest, resumeFingerprint, jobFingerprint, createdAt: now, chunks, postings }
}
const BIAS: Record<FastChunk["claims"], number> = {
  "candidate-asserted": 1.4, "supporting-document": 1.1, "context-only": 0.8,
}
/**
 * O(sum posting lengths for query terms + selected candidates), not
 * O(number of keywords * number of source characters).
 * Supports up to 2,000 distinct terms but emits bounded context.
 */
export function queryFastDossier(index: FastDossierIndex, question: string, opts: {
  limit?: number; maxChars?: number; followUp?: string; firstPerson?: boolean
} = {}): FastHit[] {
  if (index.version !== FAST_DOSSIER_VERSION || !Array.isArray(index.chunks) || !index.postings)
    throw new Error("Invalid dossier index version.")
  const terms = [...new Set(tokenizeDossier(question + (opts.followUp ? " " + opts.followUp.slice(0, 250) : "")))].slice(0, 2000)
  if (!terms.length) return []
  const scores = new Map<number, number>()
  const n = index.chunks.length
  for (const term of terms) {
    const hits = index.postings[term]
    if (!Array.isArray(hits) || !hits.length) continue
    const idf = Math.log(1 + (n + 1) / (1 + hits.length))
    for (const id of hits) scores.set(id, (scores.get(id) || 0) + idf)
  }
  const max = Math.max(1, Math.min(12, opts.limit ?? 6))
  const budget = Math.max(200, Math.min(6500, opts.maxChars ?? 3600))
  const sorted = [...scores.entries()].filter(([id]) => !!index.chunks[id]).map(([id, raw]) => {
    const chunk = index.chunks[id]
    const evidenceBias = opts.firstPerson && chunk.claims !== "candidate-asserted" ? 0.7 : BIAS[chunk.claims]
    return { id, score: raw * evidenceBias }
  }).sort((a,b) => b.score - a.score || a.id - b.id)
  let used = 0
  const out: FastHit[] = []
  for (const { id, score } of sorted) {
    if (out.length >= max || used >= budget) break
    const c = index.chunks[id]
    if (opts.firstPerson && c.claims === "context-only") continue
    const text = c.text.trim().slice(0, budget - used)
    if (!text) continue
    used += text.length
    out.push({ sourceId: c.sourceId, kind: c.sourceKind, evidence: c.claims, score: Math.round(score*1000)/1000, text, title: c.title })
  }
  return out
}
export function formatFastDossierContext(hits: FastHit[]): string {
  if (!hits.length) return ""
  return hits.map(h => "[S:" + h.sourceId + "] (" + h.evidence + "; " + h.kind + "; " + h.title + ")\n" + h.text).join("\n\n")
}


/**
 * End-of-session compaction: a bounded HOT index, not the source archive.
 * Old immutable minis remain in durable storage even after compaction.
 */
export function extendFastDossierIndex(
  prior: FastDossierIndex | null, next: FastDossierIndex,
  maxChunks = 800,
): FastDossierIndex {
  if (next.version !== FAST_DOSSIER_VERSION || (prior && prior.version !== FAST_DOSSIER_VERSION))
    throw new Error("Mismatched fast dossier index")
  const limit = Math.max(1, Math.min(MAX_CHUNKS, maxChunks))
  const chunks = [...(prior?.chunks || []), ...next.chunks].slice(-limit)
  const postings: Record<string, number[]> = Object.create(null) as Record<string, number[]>
  chunks.forEach((chunk, id) => {
    for (const term of new Set(tokenizeDossier(chunk.text))) {
      if (!Object.prototype.hasOwnProperty.call(postings, term)) postings[term] = []
      postings[term].push(id)
    }
  })
  return {
    ...next, chunks, postings, createdAt: next.createdAt,
  }
}
