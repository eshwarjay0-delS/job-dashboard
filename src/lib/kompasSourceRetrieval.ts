/**
 * Source-grounded retrieval for Kompas (29 Oct 2026). Our own design, written from public descriptions of
 * source-grounded notebooks (see /workspace/research/notebooklm-grounding-study.md); no outside code.
 * Pure and offline: no model, no network. Every entry point fails safe to "no block, no check", so a turn with
 * empty or broken sources behaves exactly as before this module existed.
 */
import { questionKeywords } from "./kompasDissection.ts"

export type Proves = "experience" | "emphasis"
export interface SourceDoc { name: string; text: string; proves: Proves }
export interface Passage { id: string; source: string; proves: Proves; text: string; line: string; score: number }
export interface Retrieval { matched: boolean; passages: Passage[]; closest: Passage | null; all: Passage[] }

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
  return [...raw, ...joined].filter((t) => t.length >= 3 && !STOP.has(t)).map(stem)
}
const CHATTER = new Set(("sorry line cut out resume mentions lot piece hardest change last part quick going back differently " +
  "again repeat mean say said job role question").split(" "))
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Labelled passages: one bullet or paragraph each; a role heading travels with its bullets so the employer is kept. */
export function splitPassages(docs: SourceDoc[] | null | undefined): Passage[] {
  if (!Array.isArray(docs)) return []
  const out: Passage[] = []
  for (const doc of docs) {
    let heading = ""
    let n = 0
    const chunks = doc.proves === "emphasis" ? doc.text.split(/(?<=[.!?])\s+|\n+/) : doc.text.split(/\n+/)
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

/** BM25-style lexical scoring against the dissected question's keywords; a JD line is weighted down. */
export function retrievePassages(question: string, docs: SourceDoc[] | null | undefined, k = 4): Retrieval {
  try {
    const q = String(question || "").trim()
    const passages = splitPassages(docs)
    if (!q || !passages.length) return EMPTY
    const keys = new Set(questionKeywords(q).flatMap((kw) => tokens(kw)).filter((t) => t !== "not"))
    for (const t of tokens(q)) keys.add(t)
    const docsTok = passages.map((p) => tokens(p.text))
    const avg = docsTok.reduce((a, d) => a + d.length, 0) / docsTok.length || 1
    const df = (t: string) => docsTok.filter((d) => d.includes(t)).length
    const N = passages.length
    const scored = passages.map((p, i) => {
      const d = docsTok[i]
      let s = 0
      for (const t of keys) {
        const tf = d.filter((x) => x === t).length
        if (!tf) continue
        const idf = Math.log(1 + (N - df(t) + 0.5) / (df(t) + 0.5))
        s += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * d.length / avg))
      }
      return { ...p, score: p.proves === "emphasis" ? s * 0.5 : s }
    })
    const ranked = scored.filter((p) => p.score > 0).sort((a, b) => b.score - a.score)
    const experience = scored.filter((p) => p.proves === "experience")
    // "In your sources" needs real topic coverage: the best experience passage holds at least half of the asked topic
    // words (interview chatter like "sorry, the line cut out" is not topic), not one shared generic word.
    const topic = [...new Set(questionKeywords(q).flatMap((kw) => tokens(kw)).filter((t) => t !== "not" && !CHATTER.has(t)))]
    const covers = (p: Passage) => {
      const d = new Set(tokens(p.text))
      // an ASR-split pair ("terra form") whose joined word is in the passage covers both halves
      const hit = new Set(topic.filter((t) => d.has(t)))
      topic.forEach((t, i) => { const n = topic[i + 1]; if (n && d.has(stem(t + n))) { hit.add(t); hit.add(n) } })
      return topic.length > 0 && hit.size * 2 >= topic.length
    }
    const matched = ranked.some((p) => p.proves === "experience" && covers(p))
    const closest = matched ? ranked.find((p) => p.proves === "experience") || null : closestExample(q, experience)
    return { matched, passages: ranked.slice(0, k), closest, all: scored }
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
    return `SOURCE PASSAGES (the candidate's own sources, most relevant first; personal claims about employers, tools, dates and numbers must be backed by these or the full resume. A job description line shows what to emphasise, never what the candidate did):\n${
      r.passages.map((p) => `[${p.id} · ${p.source} · ${p.proves}] ${p.text}`).join("\n")}`
  } catch {
    return ""
  }
}

const COMMON = new Set(("i a an the at in on for so and but then when after before first next that this it if as with to " +
  "my we our however also during once from by each every because while yes no in general there here what how " +
  "today now later finally from and so").split(" "))

/** Personal claims a listener would take as fact: named employers, tools, acronyms, and figures. */
export function extractClaims(text: string): string[] {
  const out: string[] = []
  const t = String(text || "")
  for (const m of t.matchAll(/\b\d[\d,.]*\d%?|\b\d{2,}%?|\b\d%/g)) out.push(m[0].replace(/[.,]$/, ""))
  for (const sentence of t.split(/(?<=[.!?])\s+/)) {
    const ws = sentence.replace(/[^\w\s&'-]/g, " ").split(/\s+/).filter(Boolean)
    let run: string[] = []
    const flush = () => { if (run.length) out.push(run.join(" ")); run = [] }
    ws.forEach((w, i) => {
      const proper = /^[A-Z][A-Za-z0-9&-]*$/.test(w) && !COMMON.has(w.toLowerCase()) && !/'/.test(w)
      if (proper && !(i === 0 && !/[A-Z].*[A-Z]|[a-z][A-Z]/.test(w) && COMMON.has(w.toLowerCase()))) run.push(w)
      else flush()
    })
    flush()
  }
  return [...new Set(out)]
}

function supportedBy(claim: string, haystack: string): boolean {
  const c = claim.toLowerCase()
  if (/\d/.test(c)) return haystack.replace(/,/g, "").includes(c.replace(/,/g, "").replace(/%$/, ""))
  return haystack.includes(c)
}

/** Claims the candidate's experience sources do not back. Words the interviewer said are not the candidate's claims. */
export function unsupportedClaims(text: string, passages: Passage[], docs: SourceDoc[] | null | undefined, question = ""): string[] {
  try {
    if (!Array.isArray(docs) || !docs.length) return []
    const hay = [...(passages || []).filter((p) => p.proves === "experience").map((p) => p.text),
      ...docs.filter((d) => d.proves === "experience").map((d) => d.text)].join("\n").toLowerCase()
    const q = String(question || "").toLowerCase()
    return extractClaims(text).filter((c) => !supportedBy(c, hay) && !q.includes(c.toLowerCase()))
  } catch {
    return []
  }
}

/** Supported claims over all claims for one answer (1 when the answer makes no personal claim). */
export function claimSupport(text: string, passages: Passage[], docs: SourceDoc[] | null | undefined, question = ""): { supported: number; total: number; share: number; unsupported: string[] } {
  const total = extractClaims(text).filter((c) => !String(question).toLowerCase().includes(c.toLowerCase())).length
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
