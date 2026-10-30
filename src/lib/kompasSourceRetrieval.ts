/**
 * Source-grounded retrieval for Kompas (29 Oct 2026). Our own design, written from public descriptions of
 * source-grounded notebooks (see /workspace/research/notebooklm-grounding-study.md); no outside code.
 * Pure and offline: no model, no network. Every entry point fails safe to "no block, no check", so a turn with
 * empty or broken sources behaves exactly as before this module existed.
 */
import { questionKeywords, topicOfAsk } from "./kompasDissection.ts"
import { normalizeResumeLayout } from "./kompasResumeLayout.ts"
import { createHash } from "node:crypto"
import { CTX, dropCoveredFigureClaims, figureContextKeys, figureMentions, mentionSupported, type FigureMention } from "./kompasFigureContext.ts"
import { dossierItems, relatedTerms } from "./kompasDossierItems.ts"

export type Proves = "experience" | "emphasis"
export interface SourceDoc { name: string; text: string; proves: Proves }
export interface Passage { id: string; source: string; proves: Proves; text: string; line: string; score: number; span?: [number, number]; weight?: number; itemId?: string; body?: string }
export interface Retrieval { matched: boolean; passages: Passage[]; closest: Passage | null; all: Passage[]; missing?: string[] }

export const NOT_IN_SOURCES =
  "NOT IN YOUR SOURCES: nothing in the candidate's resume, dossier or saved answers covers this. Do not claim personal experience of it, and never invent an employer, tool, project or number. Answer in general voice (\"In general, teams...\"), then bridge to the closest real example below only if it truly relates."

const EMPTY: Retrieval = { matched: false, passages: [], closest: null, all: [] }
const PREFIX: Record<string, string> = { resume: "R", "job description": "J", dossier: "D", "saved Q&A": "Q" }
const STOP = new Set(("the and for with that this from your you have has was were are what how why when where which who did does " +
  "about tell time work experience describe example handle give walk through would could should can will into used use using " +
  "ever been them they their there then than also just like some more most very each every other").split(" "))

/** The user's own sources, each tagged with what it can prove. A job description is emphasis only, never experience. */
export function sourceDocs(src: { resume?: string; jd?: string; documents?: string; dossier?: string; savedQA?: string } | null | undefined): SourceDoc[] {
  if (!src || typeof src !== "object") return []
  const docs: SourceDoc[] = [
    { name: "resume", text: String(src.resume || ""), proves: "experience" },
    { name: "dossier", text: [src.documents, src.dossier].filter(Boolean).join("\n\n"), proves: "experience" },
    { name: "saved Q&A", text: String(src.savedQA || ""), proves: "experience" },
    { name: "job description", text: String(src.jd || ""), proves: "emphasis" },
  ]
  return docs.filter((d) => d.text.trim())
}

// Light stem so a misheard plural matches ("residual risks", "stale admin right"); words are compared stem to stem.
const stem = (t: string) => t.length > 4 && /[^s]s$/.test(t) ? t.slice(0, -1) : t
function tokens(text: string): string[] {
  const raw = String(text || "").toLowerCase().replace(/[^a-z0-9+#%-]+/g, " ").split(/\s+/).map((t) => t.replace(/^-+|-+$/g, ""))
  // ASR splits ("terra form", "cloud trail"): the joined pair is also a token, so it meets the source's one word.
  const joined = raw.slice(1).map((t, i) => raw[i] + t).filter((t) => t.length >= 8)
  // r3: "post-incident" also yields "postincident", so a transcript's "post incident" (joined pair) meets it
  const unhyphen = raw.filter((t) => t.includes("-")).map((t) => t.replace(/-/g, ""))
  return [...raw, ...joined, ...unhyphen].filter((t) => t.length >= 3 && !STOP.has(t)).map(stem)
}
const CHATTER = new Set(("else anything another sorry line cut out resume mentions lot piece hardest change last part quick going back differently " +
  "again repeat mean say said job role question").split(" "))
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Labelled passages: one bullet or paragraph each; a role heading travels with its bullets so the employer is kept. */
export function splitPassages(docs: SourceDoc[] | null | undefined): Passage[] {
  if (!Array.isArray(docs)) return []
  const out: Passage[] = []
  for (const doc of docs) {
    let heading = ""
    let n = 0
    const body0 = doc.name === "resume" ? normalizeResumeLayout(doc.text) : doc.text
    // r8: a structured dossier (question/heading lines with answers beneath) becomes one passage per item: the heading
    // travels with its answer paragraphs, wrapped lines stay together, page headers/footers are dropped. Failsafe: no
    // detectable structure (or any error) → the line split below, exactly as before.
    // Stack trial: r8 dossier-item split is behind KOMPAS_DOSSIER_ITEMS=1 (default OFF → line split, ranking unchanged).
    if (doc.name === "dossier" && dossierItemsOn()) {
      let items: ReturnType<typeof dossierItems> = null
      try { items = dossierItems(doc.text) } catch { items = null }
      if (items && items.length) {
        for (const it of items) {
          if (words(it.text) < 4) continue
          n++
          out.push({ id: `D${n}`, source: doc.name, proves: doc.proves, line: it.text, text: it.text, score: 0, span: it.span, weight: it.weight, itemId: it.id, body: it.body })
        }
        continue
      }
    }
    let chunks = doc.proves === "emphasis" ? body0.split(/(?<=[.!?])\s+|\n+/) : body0.split(/\n+/)
    // r5: a saved "Q: … / A: …" pair is one passage, so the answer travels with the question it answers.
    // Failsafe: lines without the markers (or any error) split exactly as before.
    try { if (doc.name === "saved Q&A") chunks = pairQA(chunks) } catch { /* keep the plain split */ }
    for (const raw of chunks) {
      const line = raw.trim()
      if (!line) continue
      const h = line.match(/^#{1,6}\s*(.+)$/)
      if (h) { heading = /^#\s/.test(line) ? "" : h[1].trim(); continue }
      const body = line.replace(/^[-*•\s]+/, "").trim()
      if (words(body) < 4) continue
      const roleHeading = /\(\d{4}/.test(heading) || /,/.test(heading)
      n++
      out.push({ id: `${PREFIX[doc.name] || "S"}${n}`, source: doc.name, proves: doc.proves, line: body,
        text: roleHeading ? `${heading}: ${body}` : body, score: 0 })
    }
  }
  return out
}

function pairQA(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const q = lines[i].trim(), a = (lines[i + 1] || "").trim()
    if (/^Q\s*[:.]/i.test(q) && /^A\s*[:.]/i.test(a)) { out.push(`${q} ${a}`); i++ } else out.push(lines[i])
  }
  return out
}

/**
 * r5 intent families (our own list): interview stories are told in other words than the question ("challenged my boss"
 * vs "disagreed with the CTO"). A question word in a family lets passages with any word of that family score, at a
 * lower weight than a shared word. A root ending in "=" must match the whole word. Pure data; no outside code.
 */
const INTENT: Record<string, string[]> = {
  conflict: ["disagre", "conflict", "clash", "argu", "friction", "tension", "dispute", "mediat", "pushed=", "push=", "objec", "challeng", "oppos", "fight", "settl", "resolv", "against=", "said=", "no="],
  failure: ["fail", "mistak", "missed=", "miss=", "missing=", "error", "wrong", "dropped=", "lesson", "responsib", "fell=", "fall=", "short=", "~owned="],
  crisis: ["crisis", "emergenc", "pressur", "stepped=", "charge=", "~commander", "~bridge=", "outbreak", "ownership"],
  ambiguity: ["ambigu", "unclear", "uncertain", "vague", "fuzzy", "unknown", "~option", "information="],
  deadline: ["deadline", "~date=", "~dates=", "tight=", "slip", "~scope=", "~fixed=", "schedul", "~standup", "~time=", "move="],
  mentoring: ["mentor", "coach", "~junior", "teach", "develop", "grew=", "grow=", "experienced="],
  influence: ["influenc", "persuad", "convinc", "buy-in", "buyin", "authorit", "skeptic", "~adopt", "~paired", "power=", "~manage=", "department"],
  burnout: ["burn", "exhaust", "overload", "overwork", "~rotation", "~on-call", "~oncall", "~secondary", "tired"],
  delegation: ["delegat", "hand=", "~triage", "~routine", "weakness", "improv", "letting="],
  motivation: ["motivat", "drive=", "drives=", "excit", "interest", "passion", "enjoy"],
  pride: ["proud", "accomplish", "achiev", "happiest", "happy="],
  // who the story is with: someone senior ("my boss", "an executive") vs peers ("two teammates")
  upward: ["boss", "executive", "senior=", "leadership=", "leader=", "~cto=", "~ciso=", "~ceo=", "~board="],
  peers: ["teammat", "colleague", "peers=", "people=", "~two=", "~engineers="],
}
// A root starting with "~" only matches in a passage; it never makes a question join the family ("lead key rotation").
const inFamily = (t: string, roots: string[], asked = false) => roots.some((r0) => {
  if (asked && r0.startsWith("~")) return false
  const r = r0.replace(/^~/, "")
  return r.endsWith("=") ? t === r.slice(0, -1) : t.startsWith(r)
})
/** Intent families a question touches (empty for a plain technical ask). */
export function intentFamilies(question: string): string[] {
  try {
    const ts = tokens(question).concat(String(question || "").toLowerCase().split(/[^a-z-]+/).filter((t) => t.length >= 2))
    return Object.keys(INTENT).filter((f) => ts.some((t) => inFamily(t, INTENT[f], true)))
  } catch { return [] }
}
/** A story: first person, past tense, a situation and what was done ("At X I …, so I …"). Resume bullets are not stories. */
export function storyShaped(text: string): boolean {
  const t = String(text || "")
  const firstPast = (t.match(/\b(?:I|we)\s+(?:\w+ed|ran|led|wrote|cut|kept|took|made|split|showed|had|was|were|got|went|stepped|built|set|said|told)\b/g) || []).length
  return firstPast >= 2 || (firstPast >= 1 && (/\b(?:so|then|because|after|until|when)\b|;/i.test(t) || /^(?:Desktop dossier:\s*)?(?:At|In|During|While|When)\b/.test(t)))
}

/**
 * r5, index-ready: intent score of one passage from its token list alone. A prebuilt per-session index can pass its
 * stored tokens and a cached family document count; nothing here rescans source text.
 */
export function intentScore(passageTokens: string[], fams: string[], famDf: (f: string) => number, N: number): number {
  let s = 0
  for (const f of fams) {
    const roots = INTENT[f]
    if (!roots) continue
    // distinct family roots met, so a joined pair ("disagreedwith") never counts its word twice
    const hit = roots.filter((r) => passageTokens.some((x) => inFamily(x, [r]))).length
    if (!hit) continue
    const fdf = famDf(f)
    s += 0.9 * (hit >= 2 ? 1.35 : 1) * Math.log(1 + (N - fdf + 0.5) / (fdf + 0.5))
  }
  return s
}
/** r5, index-ready: how many passages (as token lists) hold any word of a family. Cache it per session. */
export function familyDocFreq(docsTok: string[][], family: string): number {
  const roots = INTENT[family] || []
  return docsTok.filter((d) => d.some((x) => inFamily(x, roots))).length
}

/** BM25-style lexical scoring against the dissected question's keywords; a JD line is weighted down. */
/** Behavior 7: the kind of question decides which passages get a light boost. Empty or unknown → technical (no boost). */
export type QuestionKind = "behavioral" | "technical" | "leadership"
export function questionKind(question: string): QuestionKind {
  const q = String(question || "").toLowerCase()
  // r4: "a product lead" is a person, not leading; "manage firewall rules" is technical. Lead as a noun after
  // a/the/product/tech/team/project is not counted, and manage counts only with people, budget, on-call or hiring.
  // Failsafe: any other leadership word still labels the ask leadership, as before.
  const noun = q.replace(/\b(?:a|the|product|tech|team|project|engineering) lead\b/g, " ")
  const manageOther = /\bmanag(?:e|ed|ing)\b/.test(noun) && !/\bmanag(?:e|ed|ing) (?:the |a |my |your |our )?(?:team|people|staff|analysts?|engineers?|budget|security budget|tooling budget|on-call|hiring|reports?|stakeholders?|vendors?|managers?)\b/.test(noun)
  const rest = manageOther ? noun.replace(/\bmanag(?:e|ed|ing)\b/g, " ") : noun
  // r4: a story frame ("tell me about a time…") is behavioral unless the candidate is the one leading in it.
  const story = /\b(?:tell me about a time|a time (?:when|you|someone)|give me an example|describe a (?:situation|time)|walk me through a situation)\b/.test(q)
  const iLed = /\b(?:you|i) (?:lead|led|manage|managed|mentor|mentored|hire|hired|grew|coached)\b/.test(rest)
  if (story && !iLed) return "behavioral"
  if (/\b(?:lead|led|leading|manage|managed|managing|mentor|hire|hiring|grow (?:a|the) team|your team|stakeholders?|executives?|board|influence)\b/.test(rest)) return "leadership"
  // r4: program-owner asks (budget, roadmap, vendor spend, the CTO/CISO, an interview loop, growing engineers)
  if (/\b(?:budgets?|roadmap|vendor spend|cto|ciso|ceo|interview loop|grow engineers|staff roles|headcount)\b/.test(q)) return "leadership"
  if (/\b(?:tell me about a time|a time (?:when|you)|give me an example|describe a situation|walk me through a situation|disagree|conflict|mistake|failure|proud|why do you want|why this role|motivat\w*|strengths?|weakness(?:es)?)\b/.test(q)) return "behavioral"
  return "technical"
}
const KIND_BOOST: Record<QuestionKind, (p: Passage) => number> = {
  leadership: (p) => /\b(?:led|lead|owned|ran|managed|mentored|reported|partnered|reviewed .* with)\b/i.test(p.text) ? 1.25 : 1,
  behavioral: (p) => p.source === "saved Q&A" || p.source === "dossier" ? 1.25 : 1,
  technical: () => 1,
}
// Behavior 8: a passage the last answers already leaned on is demoted, unless the ask goes back to it on purpose.
const GOES_BACK = /\b(?:going back to|back to (?:that|the|your)|that (?:same )?(?:project|example|story|one)|same (?:project|example|story)|more (?:about|on) (?:that|it)|you (?:just )?mentioned|earlier you said)\b/i
// A recent answer used a passage when it quotes the line or says at least 60% of its content words (answers paraphrase).
function usedIn(p: Passage, answer: string): boolean {
  if (answer.includes(p.line.toLowerCase())) return true
  const said = new Set(tokens(answer))
  const own = [...new Set(tokens(p.line))]
  return own.length >= 3 && own.filter((t) => said.has(t)).length / own.length >= 0.6
}
const ASKS_NEW = /\b(?:what else|anything else|another (?:example|time|project|story)|other (?:example|time|project)s?|a different (?:example|project|story))\b/i
// r3: a misheard word ("spunk", "privilege", "hippa") maps to the one source word one edit away (two for long words),
// same first letter, only when the heard word is not itself in the sources. Never maps onto a stop word.
function edits(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
  }
  return d[a.length][b.length]
}
export function heardAs(token: string, vocab: Set<string>): string {
  if (vocab.has(token) || token.length < 5 || /\d/.test(token)) return token
  const max = token.length >= 8 ? 2 : 1
  let best = token, bestD = max + 1
  for (const v of vocab) {
    if (v[0] !== token[0] || Math.abs(v.length - token.length) > max) continue
    const e = edits(token, v)
    if (e < bestD || (e === bestD && v.length > best.length)) { best = v; bestD = e }
  }
  // "hippa" vs "hipaa" is a swap plus one letter: allow two edits on a 5-letter word only when the letters are the same set
  if (bestD > max && token.length >= 5) for (const v of vocab) if (v.length === token.length && v[0] === token[0] && [...v].sort().join("") === [...token].sort().join("")) return v
  return bestD <= max ? best : token
}
const PART_SPLIT = /\s*(?:,\s*(?:and\s+)?|\band\b|\bas well as\b|\bplus\b)\s*/i
const PART_FRAME = /^(?:(?:how|what|why|when|where|did|do|does|you|your|tell|me|about|walk|through|approach|approached|handle|handled|work|on|with|the|a|an|so|um|like)\s+)+/i
// Speed r6: `index` false forces the old per-question scan (equivalence tests and the "before" measurement); a
// prebuilt SourceIndex may be passed; otherwise the session index for these docs is looked up (built once per content).
export interface RetrieveOptions { recent?: string[] | null; kindBoost?: boolean | "full"; index?: SourceIndex | false | unknown }

// ---- Speed r6: a per-session source index (29 Oct 2026). Everything retrievePassages derived from the source text on
// every question (passages, token lists, vocabulary, document frequency, term counts) is built once per content hash
// and kept in a small bounded in-memory map, so a question is a hash-map lookup per keyword, not a rescan of the
// sources. Swappable: retrievePassages only reads the fields below, so a different index (the prototype's fastIndex,
// a stored blob) can stand in by producing the same shape. Results are identical to the scan (equivalence test).
export interface SourceIndex {
  kind: "kompas-source-index-v1"
  key: string
  passages: Passage[]
  docsTok: string[][]
  vocab: Set<string>
  single: Set<string>
  avg: number
  postings: Map<string, Array<[number, number]>>
}
const INDEX_MAX = 32
const indexCache = new Map<string, SourceIndex>()
export function sourceContentKey(docs: SourceDoc[] | null | undefined): string {
  const h = createHash("sha256")
  for (const d of Array.isArray(docs) ? docs : []) h.update(`${d.name}\u0000${d.proves}\u0000${d.text.length}\u0000${d.text}\u0001`)
  return h.digest("hex")
}
export function buildSourceIndex(docs: SourceDoc[] | null | undefined): SourceIndex | null {
  const passages = splitPassages(docs)
  if (!passages.length) return null
  const docsTok = passages.map((p) => tokens(p.text))
  const postings = new Map<string, Array<[number, number]>>()
  docsTok.forEach((d, i) => {
    const tf = new Map<string, number>()
    for (const t of d) tf.set(t, (tf.get(t) || 0) + 1)
    for (const [t, n] of tf) { const list = postings.get(t); if (list) list.push([i, n]); else postings.set(t, [[i, n]]) }
  })
  return {
    kind: "kompas-source-index-v1", key: sourceContentKey(docs), passages, docsTok,
    vocab: new Set(docsTok.flat()),
    single: new Set(passages.flatMap((p) => p.text.toLowerCase().split(/[^a-z0-9]+/)).filter((t) => t.length >= 6).map(stem)),
    avg: docsTok.reduce((a, d) => a + d.length, 0) / docsTok.length || 1,
    postings,
  }
}
/** The session index for these sources: built on first use, then reused while the content is unchanged. Null when empty. */
export function sourceIndexFor(docs: SourceDoc[] | null | undefined): SourceIndex | null {
  if (!Array.isArray(docs) || !docs.length) return null
  const key = sourceContentKey(docs)
  const hit = indexCache.get(key)
  if (hit) { indexCache.delete(key); indexCache.set(key, hit); return hit }
  const ix = buildSourceIndex(docs)
  if (!ix) return null
  indexCache.set(key, ix)
  while (indexCache.size > INDEX_MAX) indexCache.delete(indexCache.keys().next().value as string)
  return ix
}
export function clearSourceIndexCache(): void { indexCache.clear() }
const isIndex = (x: unknown): x is SourceIndex => !!x && typeof x === "object" && (x as SourceIndex).kind === "kompas-source-index-v1" &&
  Array.isArray((x as SourceIndex).passages) && (x as SourceIndex).postings instanceof Map

export function retrievePassages(question: string, docs: SourceDoc[] | null | undefined, k = 4, opts: RetrieveOptions = {}): Retrieval {
  try {
    const q = String(question || "").trim()
    if (!q) return EMPTY
    // Speed r6: the session index when available; failsafe: any problem → the per-question scan exactly as before.
    let ix: SourceIndex | null = null
    if (opts?.index !== false) {
      try { ix = opts?.index !== undefined ? (isIndex(opts.index) ? opts.index : null) : sourceIndexFor(docs) } catch { ix = null }
    }
    const passages = ix ? ix.passages : splitPassages(docs)
    if (!passages.length) return EMPTY
    const docsTok = ix ? ix.docsTok : passages.map((p) => tokens(p.text))
    const vocab = ix ? ix.vocab : new Set(docsTok.flat())
    let heard = (t: string) => t
    // r5: an intent word ("charge", "missing") is meant as said, never re-heard as a near source word ("change")
    const asIntent = (t: string) => Object.values(INTENT).some((roots) => inFamily(t, roots, true))
    try { heard = (t: string) => asIntent(t) ? t : heardAs(t, vocab) } catch { /* failsafe: exact words only */ }
    const keys = new Set(questionKeywords(q).flatMap((kw) => tokens(kw)).filter((t) => t !== "not").map(heard))
    // r5: in a long ask, context sentences before the real ask ("our pain was X… how did you handle Y?") do not rank.
    // Failsafe: when the ask part cannot be found (or any error), every question word counts as before.
    let askPart = q
    try { const a = topicOfAsk(q); if (a && a.length < q.length && a.trim().split(/\s+/).length >= 3) askPart = a } catch { askPart = q }
    for (const t of tokens(askPart)) keys.add(heard(t))
    // r3: a word the transcript split in two ("sis log") is tried joined against the source words ("syslog")
    const splitHeard: string[] = []
    try {
      const raw = q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
      // only a real one-word source term counts, never a pair the indexer joined ("siem rules" → "siemrules")
      const single = ix ? ix.single : new Set(passages.flatMap((p) => p.text.toLowerCase().split(/[^a-z0-9]+/)).filter((t) => t.length >= 6).map(stem))
      for (let i = 1; i < raw.length; i++) {
        const j = raw[i - 1] + raw[i]
        if (j.length < 6 || raw[i - 1].length > 4 || STOP.has(raw[i - 1])) continue
        const h = heardAs(j, single)
        if (single.has(h)) { keys.add(h); splitHeard.push(h) }
      }
    } catch { /* failsafe: no joined guesses */ }
    const avg = ix ? ix.avg : docsTok.reduce((a, d) => a + d.length, 0) / docsTok.length || 1
    const N = passages.length
    let fams: string[] = []
    let storyAsk = false
    const famDfCache = new Map<string, number>()
    const famDf = (f: string) => { if (!famDfCache.has(f)) famDfCache.set(f, familyDocFreq(docsTok, f)); return famDfCache.get(f) as number }
    const famWord = (t: string) => { try { return fams.some((f) => inFamily(t, INTENT[f], true)) } catch { return false } }
    try { fams = intentFamilies(q); storyAsk = fams.length > 0 || questionKind(q) === "behavioral" } catch { fams = []; storyAsk = false }
    // Speed r6: the lexical BM25 part comes from the index postings (same terms, same key order, so identical floats);
    // without an index it is the per-question scan exactly as r5 wrote it.
    let lex: number[] | null = null
    if (ix) {
      try {
        const sum = new Array<number>(N).fill(0)
        for (const t of keys) {
          if (famWord(t)) continue
          const post = ix.postings.get(t)
          if (!post) continue
          const idf = Math.log(1 + (N - post.length + 0.5) / (post.length + 0.5))
          for (const [i, tf] of post) sum[i] += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * docsTok[i].length / avg))
        }
        lex = sum
      } catch { lex = null }
    }
    const df = (t: string) => docsTok.filter((d) => d.includes(t)).length
    let related = new Map<string, number>()
    try { if (passages.some((p) => p.span)) related = relatedTerms([...keys].filter((t) => !famWord(t)), docsTok) } catch { related = new Map() }
    const scored = passages.map((p, i) => {
      const d = docsTok[i]
      let s = 0
      if (lex) s = lex[i]
      else for (const t of keys) {
        // r5: an intent word ("failed", "deadline") is scored once, by its family below, not again by spelling
        if (famWord(t)) continue
        const tf = d.filter((x) => x === t).length
        if (!tf) continue
        const idf = Math.log(1 + (N - df(t) + 0.5) / (df(t) + 0.5))
        s += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * d.length / avg))
      }
      // r5: intent families add a smaller score per family (at most two different words of it), so a story told in
      // other words is found. Failsafe: any error leaves the plain lexical score.
      // Stack trial: r10's ranking change (generic-story damping) is NOT included; guard parts only.
      try {
        s += intentScore(d, fams, famDf, N)
        // r5: a behavioral ask prefers a story-shaped passage once it already matches the topic
        if (s > 0 && storyAsk && storyShaped(p.line)) s *= 1.2
      } catch { /* failsafe: lexical score only */ }
      // r8: related words (same-passage co-occurrence and shared 6-letter stems; no hand lists) add a small score.
      // r8: an item that is a bare heading, title or fragment is weighted down. Failsafe: unchanged score on error.
      try {
        if (related.size) for (const [t, w] of related) { const tf = d.filter((x) => x === t).length; if (tf) s += w * Math.log(1 + (N - df(t) + 0.5) / (df(t) + 0.5)) * Math.min(tf, 2) / 2 }
        if (typeof p.weight === "number" && p.weight > 0 && p.weight < 1) s *= p.weight
      } catch { /* failsafe */ }
      return { ...p, score: p.proves === "emphasis" ? s * 0.5 : s }
    })
    // Behavior 7 and 8 only reorder: coverage ("matched") is computed on the same passages, so it never changes.
    let boost: (p: Passage) => number = () => 1
    // r3: kindBoost:false turns behavior 7 off, for the before/after weighting measurement only (default stays on)
    if (opts?.kindBoost !== false) try { boost = KIND_BOOST[questionKind(q)] || boost } catch { /* failsafe: no boost */ }
    const recent = Array.isArray(opts?.recent) ? opts.recent.map((r) => String(r || "").toLowerCase()).filter(Boolean) : []
    const demote = recent.length && !GOES_BACK.test(q)
    for (const p of scored) {
      if (p.score <= 0) continue
      // r4: behavior 7 is a tiebreaker only. On two fixtures (28 and 64 questions) the full 1.25x boost never moved the
      // right passage first more often than no boost, so it now only separates passages within 3% of each other.
      // kindBoost:"full" keeps the old strength for the measurement. Failsafe: a boost of 1 changes nothing.
      const b = boost(p)
      p.score *= opts?.kindBoost === "full" || b <= 1 ? b : 1.03
      if (demote && recent.some((r) => usedIn(p, r))) p.score *= ASKS_NEW.test(q) ? 0.2 : 0.4
    }
    let ranked = scored.filter((p) => p.score > 0).sort((a, b) => b.score - a.score)
    const experience = scored.filter((p) => p.proves === "experience")
    // "In your sources" needs real topic coverage: the best experience passage holds at least half of the asked topic
    // words (interview chatter like "sorry, the line cut out" is not topic), not one shared generic word.
    const topic = [...new Set([...questionKeywords(q).flatMap((kw) => tokens(kw)).filter((t) => t !== "not" && !CHATTER.has(t)).map(heard), ...splitHeard])]
    // r4: a topic word found only in the role title ("SOC Analyst") does not cover the ask ("SOC 2 Type II audits"); the
    // employer part of the heading still counts, so "What did you do at 3M?" is found. Failsafe: no heading → the text.
    const coverText = (p: Passage) => {
      try {
        // r11 (r8 honesty drop): a dossier item whose heading has no answer body under it (a bare question, title or
        // heading line that repeats the ask's words) proves nothing. An item with a body keeps heading + body, since
        // its heading is the question that body answers.
        if (p.span && typeof p.body === "string" && p.body.trim().split(/\s+/).length < 6) return ""
        if (p.text === p.line) return p.text
        const heading = p.text.slice(0, p.text.length - p.line.length).replace(/:\s*$/, "")
        const comma = heading.indexOf(",")
        return comma >= 0 ? `${heading.slice(comma + 1)} ${p.line}` : p.line
      } catch { return p.text }
    }
    // r10: coaching/prohibition sentences ("Do not claim…", "respond based on the actual terms…") never prove coverage,
    // and a count ask ("how many …") is covered only by a passage that states a count. Stricter only; failsafe: as before.
    const countAsk = /\bhow many\b|\bwhat (?:number|count) of\b|\bhow much\b/i.test(q)
    const coversTopic = (p: Passage, topic: string[]) => {
      let ct = coverText(p)
      try {
        ct = withoutCoaching(ct)
        if (countAsk && !COUNT_RE.test(ct)) return false
      } catch { ct = coverText(p) }
      const d = new Set(tokens(ct))
      // an ASR-split pair ("terra form") whose joined word is in the passage covers both halves
      const hit = new Set(topic.filter((t) => d.has(t)))
      topic.forEach((t, i) => { const n = topic[i + 1]; if (n && d.has(stem(t + n))) { hit.add(t); hit.add(n) } })
      return topic.length > 0 && hit.size * 2 >= topic.length
    }
    const covers = (p: Passage) => coversTopic(p, topic)
    // r3: "what else" leads on the best passage not said yet that still covers the topic, even when the score
    // demotion alone left a said passage first. When none does, the r2 order stands. Failsafe: order as before.
    try {
      if (demote && ASKS_NEW.test(q)) {
        const isUsed = (p: Passage) => recent.some((r) => usedIn(p, r))
        const lead = ranked.find((p) => p.proves === "experience" && !isUsed(p) && covers(p))
        if (lead && lead !== ranked[0]) ranked = [lead, ...ranked.filter((p) => p !== lead)]
      }
    } catch { /* failsafe: keep the scored order */ }
    const wholeMatched = ranked.some((p) => p.proves === "experience" && covers(p))
    // r3: a two-part ask ("X and Y") is in the sources when one part is; the part nothing covers is named as missing.
    // Each part needs two topic words of its own to be judged ("pros and cons" is never a part). Failsafe: any error →
    // the whole-question result as before, with no missing parts.
    let matched = wholeMatched
    let missing: string[] = []
    try {
      const parts = q.replace(/[?!.]+\s*$/, "").split(PART_SPLIT).map((x) => x.replace(PART_FRAME, "").trim()).filter(Boolean)
      if (parts.length >= 2) {
        const judged = parts.map((part) => {
          const pt = [...new Set(tokens(part).filter((t) => !CHATTER.has(t) && !/^(?:approach|handle|went|wrong|proud)/.test(t)).map(heard))]
          return { part, judged: pt.length >= 2, covered: pt.length >= 2 && experience.some((p) => p.score > 0 && coversTopic(p, pt)) }
        })
        const anyCovered = judged.some((j) => j.covered)
        if (anyCovered) { matched = true; missing = judged.filter((j) => j.judged && !j.covered).map((j) => j.part) }
      }
    } catch { matched = wholeMatched; missing = [] }
    // r11: stricter-only honesty gates. (a) A distinctive topic word that appears nowhere in the sources (a tool, an
    // employer fact like "salary") means the ask is not in them, however many generic words match. Intent words and
    // ASR-split pairs are exempt. (b) A question about the interviewer's side (their team, this role, "here") is never in
    // the candidate's sources. Failsafe: any error leaves matched as computed above.
    try {
      if (matched) {
        const corpus = new Set<string>(); for (const d of docsTok) for (const t of d) corpus.add(t)
        const joined = new Set<string>(); topic.forEach((t, i) => { const n = topic[i + 1]; if (n && corpus.has(stem(t + n))) { joined.add(t); joined.add(n) } })
        const absent = topic.filter((t) => t.length >= 4 && !/^\d+$/.test(t) && !corpus.has(t) && !joined.has(t) && !famWord(t) && !related.has(t) && !ASK_GENERIC.has(t) && !ASK_GENERIC.has(t.replace(/(?:ing|ed|es|s)$/, "")))
        // a two-part ask whose absent words all sit in the part already named missing keeps its covered part
        const inMissing = (t: string) => missing.some((m) => tokens(m).map(heard).includes(t))
        if (INTERVIEWER_SIDE.test(q) || (absent.length && !(missing.length && absent.every(inMissing)))) { matched = false; missing = [] }
      }
    } catch { /* failsafe: matched unchanged */ }
    const closest = matched ? ranked.find((p) => p.proves === "experience") || null : closestExample(q, experience)
    return missing.length ? { matched, passages: ranked.slice(0, k), closest, all: scored, missing } : { matched, passages: ranked.slice(0, k), closest, all: scored }
  } catch {
    return EMPTY
  }
}

/** Nearest real example when nothing matches: a shared word stem, otherwise the most recent resume line. */
function closestExample(q: string, experience: Passage[]): Passage | null {
  if (!experience.length) return null
  const stems = tokens(q).map((t) => t.slice(0, 5))
  const hit = experience.find((p) => tokens(p.text).some((t) => stems.includes(t.slice(0, 5))))
  return hit || experience.find((p) => p.source === "resume") || experience[0]
}

/** The prompt block. Empty when there are no sources or no question, so the prompt is exactly as before. */
export function sourcePassagesPrompt(r: Retrieval | null | undefined): string {
  try {
    if (!r || !r.all.length) return ""
    if (!r.matched) return r.closest
      ? `${NOT_IN_SOURCES}\nCLOSEST REAL EXAMPLE [${r.closest.id} · ${r.closest.source}]: ${r.closest.text}`
      : NOT_IN_SOURCES
    const partly = Array.isArray(r.missing) && r.missing.length
      ? `\nPARTLY NOT IN YOUR SOURCES: ${r.missing.join("; ")}. Answer the covered part from the passages above, then say plainly you have not done ${r.missing.length > 1 ? "those" : "that"} yourself and answer it in general voice; never invent experience of it.`
      : ""
    return `SOURCE PASSAGES (the candidate's own sources, most relevant first; personal claims about employers, tools, dates and numbers must be backed by these or the full resume. A job description line shows what to emphasise, never what the candidate did):\n${
      r.passages.map((p) => `[${p.id} · ${p.source} · ${p.proves}] ${p.text}`).join("\n")}${partly}`
  } catch {
    return ""
  }
}

const COMMON = new Set(("i a an the at in on for so and but then when after before first next that this it if as with to " +
  "my we our however also during once from by each every because while yes no in general there here what how " +
  "today now later finally from and so where whenever wherever although though since until unless whether both most many " +
  "much some any all few several even still only just well sure right okay ok yes absolutely honestly frankly looking " +
  "overall together instead otherwise meanwhile afterwards ultimately initially again usually often sometimes").split(" "))

// Tools a listener takes as a personal claim even when written in lower case ("I ran it on kubernetes").
const TOOLS = ("kubernetes k8s terraform splunk datadog wiz snyk okta jenkins ansible docker helm istio prometheus grafana " +
  "crowdstrike sentinelone sentinel guardduty cloudtrail kms vault elastic elasticsearch kibana qradar palo tenable qualys " +
  "nessus burp jira servicenow archer workday salesforce snowflake databricks kafka redis mongodb postgres graphql " +
  "pulumi cloudformation azure gcp bigquery lambda opa gatekeeper falco sysdig lacework orca prisma zscaler netskope").split(" ")
const TOOL_RE = new RegExp(`\\b(?:${TOOLS.join("|")})\\b`, "gi")
// Vague scale claims ("a large team", "millions of users", "led dozens of engineers"): a scale word on a countable noun.
const VAGUE_RE = /\b(?:(?:a|an) (?:very )?(?:large|huge|big|massive|sizable|global|enterprise-wide) (?:team|org|organi[sz]ation|program(?:me)?|budget|portfolio|estate|fleet|user base|customer base)|(?:millions|thousands|hundreds|dozens|tens|scores|billions)(?: of (?:thousands|millions))? of (?:[a-z-]+ )?(?:users|customers|engineers|people|analysts|developers|staff|employees|accounts|servers|endpoints|hosts|devices|records|dollars|transactions|alerts|findings|applications|apps|services|clients|members|reports))\b/gi
const VAGUE_SCALE: Record<string, number> = { tens: 10, dozens: 24, scores: 40, hundreds: 200, thousands: 2000, millions: 2000000, billions: 2e9 }

// r9: ordinary words that open a sentence are not names ("Leadership sees it weekly", "Failures go back to the owner").
// Only a single capitalised word at the very start of a sentence is read this way; a name run ("Acme Corp"), a tool,
// a word with inner capitals ("GuardDuty") or any word not on this list (Globex, Initech, Hooli, Boeing) is still a claim.
const OPENER_WORDS = new Set(("leadership ownership partnership membership sponsorship stewardship relationship relationships " +
  "failure failures success successes mistake mistakes lesson lessons result results outcome outcomes impact progress " +
  "communication collaboration coordination documentation automation prioritization escalation escalations remediation " +
  "accountability visibility consistency reliability availability scalability security safety privacy compliance governance " +
  "trust clarity speed quality focus context culture people teams team stakeholders stakeholder customers customer users " +
  "management engineering operations leaders leader owners owner engineers analysts everyone everything nothing someone something " +
  "data evidence metrics logs alerts findings risk risks controls policies policy change changes cost costs time budget scope " +
  "transparency honesty empathy patience feedback mentoring coaching training testing monitoring logging alerting tuning triage " +
  "working looking building ensuring having being getting moving starting reviewing tracking mapping running leading managing " +
  "using taking making keeping writing measuring explaining listening asking " +
  "afterward afterwards eventually luckily unfortunately fortunately personally practically basically clearly naturally " +
  "simply typically generally specifically importantly interestingly surprisingly looking back " +
  "my our their that those these this such another other each both either neither one two three first second third last " +
  "part most much more less half none few several plenty everybody nobody somebody " +
  "early later recently previously currently today tomorrow yesterday weekly monthly daily quarterly annually " +
  "good great better best bad worse worst hard harder easy simple key main core big small new old real true false " +
  "was were is are be been had has have did do does got went came made took gave kept said told asked felt knew thought " +
  "start begin end finish stop keep make take give get let try use run build lead own fix check").split(/\s+/))
function commonOpener(w: string, next: string | undefined): boolean {
  const l = w.toLowerCase()
  if (!/^[A-Z][a-z]+$/.test(w) || TOOLS.includes(l)) return false
  if (next && /^[A-Z][A-Za-z0-9&-]*$/.test(next) && !COMMON.has(next.toLowerCase())) return false // "Leadership Council", "Acme Corp"
  return OPENER_WORDS.has(l) || COMMON.has(l) || (l.length >= 6 && /(?:ship|ment|ness|ity|tion|sion|ance|ence|ism)s?$/.test(l)) || (l.length >= 6 && /ly$/.test(l))
}

const ctxCache = new Map<string, Set<string>>()
function contextSet(haystack: string): Set<string> {
  let s = ctxCache.get(haystack)
  if (!s) { s = new Set(figureContextKeys(haystack)); if (ctxCache.size > 16) ctxCache.clear(); ctxCache.set(haystack, s) }
  return s
}

/** Personal claims a listener would take as fact: named employers, tools, acronyms, and figures. */
export function extractClaims(text: string): string[] {
  const out: string[] = []
  const t = String(text || "")
  // r9: a figure that names what it counts is one claim with its noun ("4 regions", "3-5 weeks", "a 4-week"), so a bare
  // "4" elsewhere in the sources no longer backs it; a bare or standard-name number stays as it was ("40%", "27001").
  let ments: FigureMention[] = []
  try { ments = figureMentions(t) } catch { ments = [] }
  const bareRe = /^(?:\d[\d,.]*\d%?|\d{2,}%?|\d%)$/
  for (const m of ments) {
    if (!m.label && (m.head.length || m.money)) out.push(m.claim.replace(/[.,]$/, ""))
    else if (bareRe.test(m.raw.replace(/^\$\s?/, "").replace(/\s*(?:percent|per cent)$/i, "%").replace(/\s+%/, "%"))) out.push(m.raw.replace(/^\$\s?/, "").replace(/\s*(?:percent|per cent)$/i, "%").replace(/\s+%/, "%").replace(/[.,]$/, ""))
  }
  // the pre-r9 figure pass, so no figure it caught is lost (claims are de-duplicated below)
  for (const m of t.matchAll(/\b\d[\d,.]*\d%?|\b\d{2,}%?|\b\d%/g)) out.push(m[0].replace(/[.,]$/, ""))
  // r2: a small figure with a scale word or a currency sign ("$2 million", "3 billion") is a claim too
  for (const m of t.matchAll(/\$\s?\d[\d,.]*(?:\s?(?:k|m|bn|million|billion|thousand)\b)?|\b\d[\d,.]*\s(?:million|billion|thousand)\b/gi)) out.push(m[0].replace(/^\$\s?/, "").toLowerCase())
  for (const m of t.matchAll(VAGUE_RE)) out.push(m[0].toLowerCase())
  for (const m of t.matchAll(TOOL_RE)) if (!/^[A-Z]/.test(m[0])) out.push(m[0].toLowerCase())
  for (const sentence of t.split(/(?<=[.!?])\s+/)) {
    // r9: a comma, semicolon, colon or bracket ends a name ("SOC 2 Type II, NIST 800-53" is two names, each checked)
    const ws = sentence.replace(/[,;:()]/g, " \u0002 ").replace(/[^\w\s&'\u0002-]/g, " ").split(/\s+/).filter(Boolean)
    let run: string[] = []
    const flush = () => { if (run.length) out.push(run.join(" ")); run = [] }
    ws.forEach((w, i) => {
      let opener = false
      try { opener = i === 0 && commonOpener(w, ws[1]) } catch { opener = false }
      if (w === "\u0002") { flush(); return }
      const proper = /^[A-Z][A-Za-z0-9&-]*$/.test(w) && !COMMON.has(w.toLowerCase()) && !/'/.test(w) && !opener
      if (proper && !(i === 0 && !/[A-Z].*[A-Z]|[a-z][A-Z]/.test(w) && COMMON.has(w.toLowerCase()))) run.push(w)
      else flush()
    })
    flush()
  }
  // one claim per name: a lower-case tool and its capitalised form count once
  const seen = new Set<string>()
  return out.filter((c) => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
}

function supportedBy(claim: string, haystack: string): boolean {
  const c = claim.toLowerCase()
  const vague = c.match(/^(millions|thousands|hundreds|dozens|tens|scores|billions)(?: of (?:thousands|millions))? of (?:[a-z-]+ )?([a-z]+)$/)
  if (vague) {
    // a figure in the sources on the same noun backs the vague scale word ("1,200 privileged accounts" → "hundreds of accounts")
    const noun = vague[2].replace(/s$/, "")
    const min = VAGUE_SCALE[vague[1]] || 10
    for (const m of haystack.replace(/,/g, "").matchAll(new RegExp(`\\b(\\d+)(?: [a-z-]+){0,2} ${noun}`, "g"))) if (Number(m[1]) >= min) return true
    return haystack.includes(c)
  }
  if (/\d\s?(?:k|m|bn|million|billion|thousand)$/.test(c) && !/^\$/.test(c)) return haystack.replace(/,/g, "").includes(c.replace(/,/g, ""))
  if (/\d/.test(c)) {
    // r9: the same number with the same unit or noun (and "$" for money); a figure claim whose number never appears is unsupported
    try {
      const m = figureMentions(c)[0]
      if (!m) return haystack.replace(/,/g, "").includes(c.replace(/,/g, "").replace(/%$/, ""))
      const keys = contextSet(haystack)
      const pre = haystack.replace(/,/g, "").includes(c.replace(/,/g, "").replace(/%$/, ""))
      if (m.label) return pre
      if (!m.head.length && !m.money) return pre && keys.has(`${CTX}${m.n}|`)
      return mentionSupported(m, keys)
    } catch { return false }
  }
  return haystack.includes(c)
}

// r5: an interviewer premise about the candidate ("since you led a team of 50", "given your time as CISO at Contoso",
// "I see you ran…"). Only the clause about "you/your" is read, never the interviewer's own company line.
// r10 (Lens r4 note): result verbs (cut, reduced, slashed, lowered, dropped, …) and "I heard / I understand" lead-ins added.
const PREMISE_CLAUSE = /(?:^|[.?!,;]\s*|\b(?:so|and|i see|i know|i noticed|i read that|i heard(?: that)?|i understand(?: that)?|i was told(?: that)?)\s+)((?:since|as|given(?: that)?|because|now that|considering|with)\s+(?:you|your)\b[^,?.;]{3,140}|(?:you|you've|you have)\s+(?:led|managed|ran|built|owned|were|grew|headed|scaled|cut|reduced|lowered|slashed|dropped|decreased|halved|closed|saved|rotated|wrote|caught|deployed|implemented|improved|increased|boosted)\b[^,?.;]{3,140})/gi
/** Interviewer claims about the candidate that the experience sources do not back. Empty with no sources or no premise. */
export function falsePremises(question: string, docs: SourceDoc[] | null | undefined): string[] {
  try {
    if (!Array.isArray(docs) || !docs.some((d) => d.proves === "experience")) return []
    const hay = docs.filter((d) => d.proves === "experience").map((d) => d.text).join("\n").toLowerCase()
    const out: string[] = []
    for (const m of String(question || "").matchAll(PREMISE_CLAUSE)) {
      const clause = m[1].replace(/^(?:since|as|given(?: that)?|because|now that|considering|with)\s+/i, "").replace(/^(?:you|your)\s+/i, "")
      for (const c of extractClaims(clause)) if (!/^(?:you|your|i)$/i.test(c) && !supportedBy(c, hay) && !out.includes(c)) out.push(c)
    }
    return dropCoveredFigureClaims(out)
  } catch {
    return []
  }
}
/** Prompt line for a false premise: do not accept it, correct it in one clause from the sources, then answer. */
export function premisePrompt(question: string, docs: SourceDoc[] | null | undefined): string {
  const bad = falsePremises(question, docs)
  return bad.length
    ? `INTERVIEWER PREMISE NOT IN YOUR SOURCES: ${bad.join(", ")}. Do not accept or repeat it as the candidate's fact. Correct it politely in one short clause with what the sources do show, then answer the real ask.`
    : ""
}

/** Claims the candidate's experience sources do not back. Words the interviewer said are not the candidate's claims. */
export function unsupportedClaims(text: string, passages: Passage[], docs: SourceDoc[] | null | undefined, question = ""): string[] {
  try {
    if (!Array.isArray(docs) || !docs.length) return []
    const hay = [...(passages || []).filter((p) => p.proves === "experience").map((p) => p.text),
      ...docs.filter((d) => d.proves === "experience").map((d) => d.text)].join("\n").toLowerCase()
    const q = String(question || "").toLowerCase()
    // r5: words the interviewer said are exempt, except a false premise about the candidate (failsafe: none → as before)
    let premise: string[] = []
    try { premise = falsePremises(question, docs).map((c) => c.toLowerCase()) } catch { premise = [] }
    return dropCoveredFigureClaims(extractClaims(text).filter((c) => !supportedBy(c, hay) && (!q.includes(c.toLowerCase()) || premise.includes(c.toLowerCase()))))
  } catch {
    return []
  }
}

/** Supported claims over all claims for one answer (1 when the answer makes no personal claim). */
export function claimSupport(text: string, passages: Passage[], docs: SourceDoc[] | null | undefined, question = ""): { supported: number; total: number; share: number; unsupported: string[] } {
  const total = dropCoveredFigureClaims(extractClaims(text).filter((c) => !String(question).toLowerCase().includes(c.toLowerCase()))).length
  const unsupported = unsupportedClaims(text, passages, docs, question)
  const supported = total - unsupported.length
  return { supported, total, share: total ? supported / total : 1, unsupported }
}

/** Repair-loop core item: one line naming every unsupported claim; empty with no sources (behaves as before). */
export function repairLoopSourceChecks(question: string, text: string, docs: SourceDoc[] | null | undefined): string[] {
  try {
    if (!Array.isArray(docs) || !docs.some((d) => d.proves === "experience")) return []
    const r = retrievePassages(question, docs)
    const bad = unsupportedClaims(text, r.passages, docs, question)
    return bad.length ? [`remove or replace claims the candidate's sources do not support: ${bad.join(", ")}; use the closest real example or say it in general terms, and never keep an invented number`] : []
  } catch {
    return []
  }
}

/** Behavior 5: the graceful path when nothing in the sources covers the ask. Null when the sources do cover it. */
export function notInSourcesPlan(r: Retrieval | null | undefined, topic: string): { general: string; bridge: string; sideNote: string } | null {
  if (!r || r.matched || !r.all.length) return null
  const t = String(topic || "this").trim()
  return {
    general: `In general, here is how teams approach ${t}.`,
    bridge: r.closest ? `The closest thing I've done is this: ${r.closest.text}` : "",
    sideNote: `Your resume has nothing on ${t}. If you have done it, add it.`,
  }
}

/** Behavior 6: where each spoken sentence came from, attached by code; the quote is checked to exist in the passage. */
export function whereFrom(text: string, passages: Passage[]): Array<{ sentence: string; factId: string; source: string; quote: string }> {
  try {
    const out: Array<{ sentence: string; factId: string; source: string; quote: string }> = []
    for (const sentence of String(text || "").split(/(?<=[.!?])\s+/).filter(Boolean)) {
      const st = new Set(tokens(sentence))
      let best: Passage | null = null
      let shared = 0
      for (const p of passages || []) {
        const n = new Set(tokens(p.text).filter((t) => st.has(t))).size
        if (n > shared) { shared = n; best = p }
      }
      if (best && shared >= 3 && best.text.includes(best.line)) out.push({ sentence, factId: best.id, source: best.source, quote: best.line })
    }
    return out
  } catch {
    return []
  }
}

/** Behavior 9: an employer whose start year differs between the resume and the dossier is shown; the resume wins. */
export function sourceConflicts(docs: SourceDoc[] | null | undefined): string[] {
  try {
    const years = (text: string) => {
      const m = new Map<string, string>()
      for (const x of text.matchAll(/([A-Z][\w&]*(?: [A-Z][\w&]*)*) \((\d{4}) to /g)) m.set(x[1], x[2])
      return m
    }
    const resume = docs?.find((d) => d.name === "resume")
    const dossier = docs?.find((d) => d.name === "dossier")
    if (!resume || !dossier) return []
    const r = years(resume.text)
    const out: string[] = []
    for (const [employer, year] of years(dossier.text)) {
      const ry = r.get(employer)
      if (ry && ry !== year) out.push(`${employer}: resume says ${ry}, dossier says ${year}; using the resume.`)
    }
    return out
  } catch {
    return []
  }
}

/** r10: a coaching, prohibition or advice-to-candidate sentence, not the candidate's own evidence. */
export function coachingSentence(sentence: string): boolean {
  const t = String(sentence || "").trim()
  if (/^(?:do not|don't|never|avoid|ask|respond|confirm|fill|say|tell them|be ready|prepare|mention|remember)\b/i.test(t)) return true
  if (/\b(?:do not|don't|never) (?:claim|say|mention|invent|state|promise|imply|overclaim)\b/i.test(t) && !/^(?:I|We|My)\b/.test(t)) return true
  return /\brespond based on\b|\bbefore the call\b|\[ ___/i.test(t)
}
/** r10: text with coaching sentences removed (failsafe: the text unchanged on error). */
export function withoutCoaching(text: string): string {
  try { return String(text || "").split(/(?<=[.!?])\s+/).filter((x) => !coachingSentence(x)).join(" ") } catch { return String(text || "") }
}
const COUNT_RE = /\b\d+\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|dozens|hundred|hundreds|thousand|thousands|single|a couple|several)\b/i

/** r11: a question about the interviewer's side (their team or company, this role, "here", who I would report to). */
const INTERVIEWER_SIDE = /\b(?:this (?:role|position|job|opening)|your (?:company|organi[sz]ation|org)\b|(?:team|company|org|people|stack|tools?) (?:here|at your)\b|\bhere\?|would i (?:report|be|work|start)|will i (?:report|be|work|start)|after this round|salary band|interview process)/i
/** r11: ask words that are never a topic of their own (verbs and fillers of the asking), so their absence proves nothing. */
const ASK_GENERIC = new Set(("done do doing did make made making keep kept keeps many much more most mention mentioned prepare prepar meet meeting met use used using usage "
  + "handle handl speed fast quick quickly approach work worked working get got give gave take took run ran running go went going come came "
  + "think thought feel felt know knew want wanted need needed like liked help helped start started stop stopped tell told talk talked walk "
  + "describe explain example examples time times thing things something anything everything someone people person kind sort type part parts "
  + "best better good great hard hardest easy easier biggest big small large lot lots way ways really actually just also still ever never "
  + "usually typically generally exactly specifically overall today recently currently first last next previous past future year years month "
  + "months week weeks day days ensure make sure deal dealt manage managed apply applied build built create created set setup set-up "
  + "improve improved reduce reduced increase increased change changed look looked find found decide decided choose chose pick picked "
  + "role roles job jobs task tasks project projects process processes team teams company companies area areas field level levels").split(/\s+/))

/** r11: the r8 dossier-item ranking switch. On only when KOMPAS_DOSSIER_ITEMS is "on" or "1"; any error → off. */
export const DOSSIER_ITEMS_SWITCH = "KOMPAS_DOSSIER_ITEMS"
export function dossierItemsOn(): boolean {
  try { const v = typeof process !== "undefined" ? String(process.env?.[DOSSIER_ITEMS_SWITCH] ?? "").trim().toLowerCase() : ""; return v === "on" || v === "1" } catch { return false }
}
