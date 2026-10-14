// Voice repair — ported from perfACT's _voice.js (2026-10-14, perfACT sunset).
// Deterministic post-processing: prompt rules are wishes, these are guarantees.
// Adapted to MarketFit's [beat]/[breath] markers (perfACT used (pause)).

const BANNED = [
  "worked with stakeholders", "aligned with leadership", "improved security posture",
  "ensured compliance", "leveraged", "spearheaded", "end-to-end",
  "first and foremost", "so yeah", "very passionate", "at the end of the day",
  "it's important to note", "in summary", "great question",
]

const ABBR = new Set([
  "mr.", "mrs.", "ms.", "dr.", "vs.", "etc.", "e.g.", "i.e.", "st.", "ave.",
  "jan.", "feb.", "mar.", "apr.", "jun.", "jul.", "aug.", "sep.", "sept.", "oct.", "nov.", "dec.",
])

/** Split into sentences, respecting abbreviations and initials. */
function segment(s: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== "." && c !== "!" && c !== "?") continue
    let j = i + 1
    while (j < s.length && /["”’')\]]/.test(s[j])) j++
    if (j >= s.length || !/\s/.test(s[j])) continue
    if (c === ".") {
      let ts = i
      while (ts > 0 && !/\s/.test(s[ts - 1])) ts--
      const tok = s.slice(ts, i + 1).replace(/^[(“"'‘*]+/, "").toLowerCase()
      if (ABBR.has(tok)) continue
    }
    const piece = s.slice(start, j).trim()
    if (piece) out.push(piece)
    let k = j
    while (k < s.length && /\s/.test(s[k])) k++
    start = k
    i = k - 1
  }
  const rest = s.slice(start).trim()
  if (rest) out.push(rest)
  return out
}

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length

/** Split a long sentence at a natural clause boundary. */
function splitLong(sentence: string): string[] {
  if (words(sentence) <= 25) return [sentence]
  const parts = sentence.split(/,\s+(?=(and|but|so|because|which|who|when|where|while|although|though|if)\b)/i)
  if (parts.length > 1) {
    const out: string[] = []
    for (const p of parts) {
      const t = p.trim()
      if (!t) continue
      if (words(t) <= 25) out.push(t)
      else out.push(...splitLong(t))
    }
    return out.map((p, i) => (i < out.length - 1 && !/[.!?]$/.test(p) ? p + "." : p))
  }
  return [sentence]
}

/**
 * Repair one answer: split over-long sentences, strip banned phrases.
 * Returns the repaired text.
 */
export function voiceRepair(text: string): string {
  let t = String(text || "")
  for (const b of BANNED) {
    t = t.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
  }
  t = t.replace(/\s{2,}/g, " ").replace(/\s+([.!?])/g, "$1").trim()

  const lines = t.split("\n")
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^#{1,6}\s/.test(trimmed) || /^\s*[-•]\s+/.test(line)) {
      out.push(line)
      continue
    }
    const sentences = segment(trimmed)
    const repaired: string[] = []
    for (const s of sentences) repaired.push(...splitLong(s))
    out.push(repaired.join(" "))
  }
  t = out.join("\n")

  // Ensure pause markers: a multi-paragraph answer with no breath gets one.
  if (!/\[beat\]|\[breath\]/i.test(t)) {
    const ls = t.split("\n")
    const proseIdx: number[] = []
    ls.forEach((l, i) => {
      const tt = l.trim()
      if (tt && !/^#{1,6}\s/.test(tt) && !/^(?:[-•]|\d{1,2}[.)])\s+/.test(tt)) proseIdx.push(i)
    })
    if (proseIdx.length >= 2) {
      const i = proseIdx[0]
      const m = ls[i].match(/^([\s\S]*?)(\s*)$/)
      if (m && /[.!?]$/.test(m[1])) ls[i] = m[1] + " [breath]" + m[2]
      t = ls.join("\n")
    }
  }
  return t.replace(/\s{2,}/g, " ").trim()
}
