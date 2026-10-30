/**
 * r8 (29 Oct 2026, offline): flat dossier text → structured items, in the Dossier bot's BibleItem shape
 * (id = FNV-1a of section|kind|plain text, section, kind, text, source, status sourced|hole; see
 * /workspace/dossier-bot/schema.md). Dossier's own `loadBible` only reads `### Q` Markdown and {items:[{q,a}]};
 * the real dossiers are PDF text (pdftotext -layout), so this parser is new. Pure, no model, no network.
 * Failsafe: returns null when no question/heading structure is detectable, so the caller keeps today's line split.
 */
export type ItemKind = "metric" | "story" | "answer" | "term" | "opener"
export interface DossierItem {
  id: string; section: "qbank" | "evidence"; kind: ItemKind; text: string; heading: string; body: string
  source: { doc: "document"; session: null; span: string | null }; status: "sourced" | "hole"
  /** first and last line index (inclusive) in the source text */
  span: [number, number]
  /** ranking weight: 1 for an item with a real answer body; lower for a bare heading, a title, or a fragment */
  weight: number
}
export type LineKind = "blank" | "footer" | "title" | "question" | "heading" | "prose"

const HOLE_RE = /\[ ___ [^\]]*\]/
const plain = (t: string) => String(t || "").toLowerCase().replace(/\b\d[\d,.]*\+?%?/g, " ").replace(/[^a-z]+/g, " ").trim()
function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}
const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const squash = (s: string) => s.replace(/\s+/g, " ").trim()

/** Lines repeated 3+ times (digits ignored) are running page headers/footers. */
export function runningLines(lines: string[]): Set<string> {
  const n = new Map<string, number>()
  for (const l of lines) { const k = squash(l).replace(/\d+/g, "#").toLowerCase(); if (k && wc(k) <= 14) n.set(k, (n.get(k) || 0) + 1) }
  return new Set([...n].filter(([k, c]) => c >= 3 && !/\?$/.test(k)).map(([k]) => k))
}

/** One line's role in a dossier. */
export function lineKind(raw: string, running: Set<string> = new Set()): LineKind {
  const l = squash(raw)
  if (!l) return "blank"
  if (/^page \d+$|\bpage \d+\s*$/i.test(l) || running.has(l.replace(/\d+/g, "#").toLowerCase())) return "footer"
  if (/^(?:tree|scenario|part|section|story|case|round)\s+(?:\d+|[ivx]+)\b[^.?!]{0,60}$/i.test(l)) return "title"
  const q = l.replace(/^(?:Q\s?\d+[a-z]?[.:)]?|[A-Z]\d+[.:)]?|\d+[.)]|[•*-])\s*/, "")
  if (/\?["”']?\s*$/.test(q) && wc(q) >= 4 && wc(q) <= 40) return "question"
  if (wc(l) <= 9 && !/[.,;:]\s*$/.test(l) && (/^[A-Z0-9][^a-z]*$/.test(l) || /^[A-Z]/.test(l)) && !/^(?:I|We|My)\b/.test(l)) return "heading"
  return "prose"
}

/**
 * Items from flat dossier text: a question or heading line plus the answer paragraphs beneath it is ONE item (stops at
 * the next question, heading or title, or at maxWords); wrapped lines of one paragraph stay together; page
 * headers/footers are dropped. Returns null when fewer than 3 headed items with a body exist (no structure).
 */
export function dossierItems(text: string, maxWords = 160): DossierItem[] | null {
  try {
    const lines = String(text || "").split("\n")
    const running = runningLines(lines)
    const kinds: Array<LineKind | "qcont"> = lines.map((l) => lineKind(l, running))
    // a question wrapped over two lines: an unpunctuated line directly above a line ending in "?" is its first half
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1].trim(), cur = lines[i].trim()
      if (!/\?["”']?$/.test(cur) || !prev || /[.!?:;"”)]$/.test(prev) || !["heading", "prose"].includes(kinds[i - 1] as string)) continue
      if (kinds[i] !== "question" && kinds[i] !== "prose") continue
      const n = wc(`${prev} ${cur}`)
      if (n >= 4 && n <= 40) { kinds[i - 1] = "question"; kinds[i] = "qcont" }
    }
    const out: DossierItem[] = []
    let head = -1, headEnd = -1, start = -1, body: number[] = [], bodyWords = 0
    const flush = (endAt: number) => {
      if (start < 0) return
      const heading = head >= 0 ? squash(lines.slice(head, Math.max(head, headEnd) + 1).join(" ")) : ""
      const b = squash(body.map((j) => lines[j]).join(" "))
      if (!heading && !b) { start = -1; return }
      const k = head >= 0 ? kinds[head] : "prose"
      const textOut = heading && b ? `${heading} ${b}` : heading || b
      const weight = !b ? (k === "title" ? 0.3 : 0.5) : wc(b) < 6 ? 0.6 : k === "title" ? 0.8 : 1
      const section = k === "question" ? "qbank" : "evidence"
      const kind: ItemKind = k === "question" ? "answer" : /\b\d[\d,.]*\s*(?:%|percent|x\b|ms\b|hours?|days?|weeks?)/i.test(b) ? "metric" : /\b(?:I|we)\s+\w+ed\b/.test(b) ? "story" : "answer"
      const last = body.length ? body[body.length - 1] : head
      out.push({ id: fnv(`${section}|${kind}|${plain(textOut)}`), section, kind, text: textOut, heading, body: b,
        source: { doc: "document", session: null, span: textOut.slice(0, 200) }, status: HOLE_RE.test(textOut) ? "hole" : "sourced",
        span: [start, Math.max(start, last ?? endAt)], weight })
      head = -1; headEnd = -1; start = -1; body = []; bodyWords = 0
    }
    let blankRun = 0
    for (let i = 0; i < lines.length; i++) {
      const k = kinds[i]
      if (k === "footer") continue
      if (k === "blank") { blankRun++; continue }
      if (k === "qcont") { if (head === i - 1) headEnd = i; continue }
      if (k === "question" || k === "heading" || k === "title") {
        // consecutive heading lines (wrapped title) join one heading
        if (start >= 0 && !body.length && head >= 0 && blankRun === 0 && k === "heading" && kinds[head] !== "question") { blankRun = 0; continue }
        flush(i); head = i; headEnd = i; start = i; blankRun = 0; continue
      }
      // prose: an untitled item breaks at a blank line (paragraph); a headed item keeps paragraphs until maxWords
      if (start >= 0 && (bodyWords + wc(lines[i]) > maxWords || (head < 0 && blankRun > 0))) flush(i)
      if (start < 0) start = i
      body.push(i); bodyWords += wc(lines[i]); blankRun = 0
    }
    flush(lines.length)
    const headed = out.filter((x) => x.heading && x.body && wc(x.body) >= 6).length
    return headed >= 3 ? out : null
  } catch { return null }
}

/**
 * r8 related words without hand lists: for each asked word, the source words that appear in the SAME passages most
 * often (Jaccard of passage sets) and words sharing a 6-letter stem. Returns word → weight (0..0.6). Pure; a prebuilt
 * index can pass its own passage token lists. Failsafe: empty map on any error.
 */
export function relatedTerms(keys: Iterable<string>, docsTok: string[][], maxPer = 2): Map<string, number> {
  const out = new Map<string, number>()
  try {
    const N = docsTok.length
    if (!N) return out
    const inDocs = new Map<string, Set<number>>()
    docsTok.forEach((d, i) => { for (const t of d) { let s = inDocs.get(t); if (!s) inDocs.set(t, s = new Set()); s.add(i) } })
    const keySet = new Set(keys)
    for (const k of keySet) {
      if (k.length >= 6) for (const t of inDocs.keys()) if (t !== k && !keySet.has(t) && t.length >= 6 && t.slice(0, 6) === k.slice(0, 6)) out.set(t, Math.max(out.get(t) || 0, 0.6))
      const ks = inDocs.get(k)
      if (!ks || ks.size < 2) continue
      const cands: Array<[string, number]> = []
      const seen = new Map<string, number>()
      for (const i of ks) for (const t of new Set(docsTok[i])) if (t !== k && !keySet.has(t)) seen.set(t, (seen.get(t) || 0) + 1)
      for (const [t, co] of seen) {
        const dt = inDocs.get(t)!.size
        if (co < 2 || dt > N / 5 || t.length < 4 || /^\d+$/.test(t)) continue
        const j = co / (ks.size + dt - co)
        if (j >= 0.25) cands.push([t, j])
      }
      cands.sort((a, b) => b[1] - a[1]).slice(0, maxPer).forEach(([t, j]) => out.set(t, Math.max(out.get(t) || 0, 0.35 * j)))
    }
  } catch { return new Map() }
  return out
}
