import { cleanHeardQuestion } from "./kompasLongContext.ts"
import { matchKnownTerms } from "./kompasLexicon.ts"

/**
 * Fixed card order: claim, context, action, result, close.
 * The same question and the same words always produce the same sections.
 * A number is shown only when the resume or the question already contains it.
 */
export const SECTION_ORDER = ["Claim", "Context", "Action", "Result", "Close"] as const
export type AnswerSection = (typeof SECTION_ORDER)[number]

export function answerWordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function answerSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^(?:and|but|or|which|that)\b/i.test(s))
}

/** A design, a story, an incident, or a long explanation. A definition or a yes/no stays plain. */
export function answerIsComplex(question: string, text: string): boolean {
  const q = String(question || "")
  const sentences = answerSentences(text)
  const words = answerWordCount(text)
  if (/\*\*(?:Claim|Context|Action|Result|Close)\*\*/.test(text)) return true
  const simple = /^(?:what is|what does|what's|define|do you|are you|have you|can you hear)\b/i.test(q.trim()) && words < 55 && sentences.length < 3
  if (simple) return false
  if (/\b(?:design|tell me about a time|walk me through|incident|war room|contributions|proud of|strategy)\b/i.test(q)) return sentences.length >= 2 || words >= 36
  return sentences.length >= 4 || words >= 70
}

function digitsIn(text: string): string[] {
  return String(text || "").match(/\d[\d,.]*/g) || []
}

function numberIsSourced(sentence: string, source: string): boolean {
  const nums = digitsIn(sentence)
  if (!nums.length) return false
  return nums.every((n) => source.includes(n.replace(/[.,]+$/, "")))
}

/** Drop a figure the resume and the question do not already contain. */
export function withoutInventedNumbers(sentence: string, source: string): string {
  return String(sentence || "")
    .replace(/\d[\d,.]*/g, (n) => (source.includes(n.replace(/[.,]+$/, "")) ? n : ""))
    .replace(/\bby percent\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
}

const LEADING_MARK = /^(?:[-•*]|\d+[.)]|—|–)\s+/
const LEADING_CONNECTOR = /^(?:first|then|next|finally),\s+|^(?:first|then|next|finally)\s+(?=(?:i|we|so|the|a|an)\b)|^(?:the result)[:,]\s+|^(?:in addition|once that is established),\s+/i

/** Peel every leading dash and every leading connector. */
function peelBullet(sentence: string): { connector: string; body: string } {
  let s = String(sentence || "").trim()
  let connector = ""
  let prev = ""
  while (s && s !== prev) {
    prev = s
    s = s.replace(LEADING_MARK, "").trim()
    const hit = s.match(LEADING_CONNECTOR)
    if (!hit) break
    connector = hit[0].toLowerCase()
    s = s.slice(hit[0].length).trim()
  }
  return { connector, body: s.replace(LEADING_MARK, "").trim() }
}

function signpost(section: AnswerSection, sentence: string, first: boolean): string {
  const peeled = peelBullet(sentence)
  if (!peeled.body || genericThirdPerson(peeled.body)) return ""
  // Connectors are not written onto the left card. The final pass removes any that remain.
  void section
  void first
  return peeled.body
}

/** Drop a generic third-person line. A first-person sentence that only mentions a team stays. */
function genericThirdPerson(sentence: string): boolean {
  const text = peelBullet(sentence).body
  if (!text) return false
  if (/^in general,\s+teams\b/i.test(text) || /^teams start\b/i.test(text) || /^next they\b/i.test(text) || /\bthey build\b/i.test(text)) return true
  if (/\b(?:I|we|my|our|me|I'm|I've|I'd|I'll|we're|we've|we'd|we'll)\b/i.test(text)) return false
  return /\b(?:they|teams)\b/i.test(text)
}

function dictionaryOpener(sentence: string): boolean {
  return /,\s+or\s+["'“][^"'”]{1,80}["'”],?\s+is\b/i.test(sentence)
}

function pastWork(sentence: string): boolean {
  return /\b(?:I|we)\s+(?:did|didn't|led|ran|built|made|left|went|got|took|saw|found|had|wrote|chose|began|(?:\w+ed))\b/i.test(sentence)
}

function hypothetical(sentence: string): boolean {
  return /^(?:I|we) would\b|^(?:I|we)['’]d\b/i.test(sentence)
}

function sentenceKey(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
}

function nearDuplicate(a: string, b: string): boolean {
  if (!a || !b || a === b) return a === b && a.length > 0
  const wa = a.split(" ")
  const wb = b.split(" ")
  if (wa.length < 6 || wb.length < 6) return false
  const sa = new Set(wa)
  const sb = new Set(wb)
  let shared = 0
  for (const word of sa) if (sb.has(word)) shared += 1
  return shared / (sa.size + sb.size - shared) >= 0.82
}

function tidySentence(sentence: string): string {
  let text = sentence.replace(/\s+([,.!?;:])/g, "$1").replace(/([.!?])\1+/g, "$1").replace(/([,;:])\1+/g, "$1").replace(/,\./g, ".").replace(/\s{2,}/g, " ").trim()
  if (/^[a-z]/.test(text)) text = text.charAt(0).toUpperCase() + text.slice(1)
  return text
}

const META_LINE = /\b(?:not in the (?:sources|resume)|that part is not|sources or evidence|no evidence for)\b/i
const FRAGMENT_LABEL = /^(?:failure mode|root cause|touch ?point)\s*:\s*/i
const PROFILE_IDS = ["eshwarjay05", "jayeshwar44", "jayeshwar24", "eshwarjay06"]

function profileResume(raw: string): { text: string; profile: string; marked: boolean } {
  const text = String(raw || "")
  const lower = text.toLowerCase()
  const hits = PROFILE_IDS.map((id) => ({ id, at: lower.indexOf(id) })).filter((hit) => hit.at >= 0).sort((a, b) => a.at - b.at)
  if (!hits.length) return { text, profile: "eshwarjay05", marked: false }
  const mine = hits.find((hit) => hit.id === "eshwarjay05") || hits[0]
  const next = hits.find((hit) => hit.at > mine.at)
  return { text: text.slice(mine.at, next ? next.at : text.length), profile: mine.id, marked: true }
}

function contentWords(sentence: string): string[] {
  return sentence.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").split(/\s+/).filter((word) => word.length >= 5 && !/^(?:there|their|about|would|could|should|before|after|because|leave|increase|within|still|reach|which|where|while|other|these|those)$/.test(word))
}

function namedTokens(sentence: string): string[] {
  const acronyms = sentence.match(/\b[A-Z][A-Z0-9]{1,}\b/g) || []
  const numbers = sentence.match(/\b\d[\d,.]*\b/g) || []
  const phrases = sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []
  return [...acronyms, ...numbers, ...phrases]
}

function supportedSentence(sentence: string, resume: string, profile: string, marked: boolean): boolean {
  const hay = resume.toLowerCase()
  const known = new Set(matchKnownTerms(profile, sentence).known.map((item) => item.term.toLowerCase()))
  for (const token of namedTokens(sentence)) {
    const key = token.toLowerCase()
    if (hay.includes(key) || known.has(key)) continue
    return false
  }
  if (!marked) return true
  const words = contentWords(sentence)
  const hits = words.filter((word) => hay.includes(word))
  if (hits.length >= 2) return true
  for (let i = 0; i < words.length - 1; i++) if (hay.includes(`${words[i]} ${words[i + 1]}`)) return true
  return false
}

function splitClauses(sentence: string): string[] {
  return sentence
    .split(/\s+[-–—]\s+|,\s+(?=(?:ran|using|built|and then)\b)/i)
    .map((part) => part.replace(FRAGMENT_LABEL, "").trim())
    .filter((part) => part && !META_LINE.test(part))
}

function speakRank(sentence: string): number {
  const text = sentence.toLowerCase()
  const rejected = /\b(?:dismissed|rejected|instead of|rather than|cellular-only)\b/.test(text)
  if (!rejected && /\b(?:owned|i led|didn't design it alone)\b/.test(text)) return 0
  if (/\b(?:requirement|started by defining|i defined|meter-to-head-end)\b/.test(text)) return 1
  if (rejected || /\b(?:chose|kept the|hybrid mesh)\b/.test(text)) return 2
  if (/\b(?:built|implemented|configured|drafted|deployed|added)\b/.test(text)) return 3
  if (/\b(?:validat|in the lab|failover|tested|confirmed)\b/.test(text)) return 4
  if (/\b(?:before rollout|outcome|stopped dropping)\b/.test(text)) return 5
  return 3
}

function spokenQuestion(question: string): boolean {
  return /\b(?:ownership|architecture|how would you design|design the)\b/i.test(question)
}

/** Last pass for the left card. Drops labels, connectors, generic lines, and unsupported names. */
export function finishLeftAnswer(question: string, text: string, source = ""): string {
  const raw = String(text || "").trim()
  if (!raw) return raw
  const asked = String(question || "").trim()
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean)
  const bulleted = lines.some((line) => /^(?:[-•*]|\d+[.)])\s+/.test(line))
  const pieces: string[] = []
  for (const line of lines) {
    if (/^\*\*(?:Claim|Context|Action|Result|Close|What I did)\*\*$/.test(line)) continue
    if (/^(?:…|\.{3})$/.test(line)) continue
    const body = line.replace(/^(?:[-•*]|\d+[.)])\s+/, "")
    for (const bit of body.split(/(?<=[.!?])\s+/)) {
      for (const clause of splitClauses(peelBullet(bit).body)) pieces.push(clause)
    }
  }
  const resume = profileResume(source)
  const pastQuestion = /^(?:did you|what did you|have you|had you)\b/i.test(asked)
  const hasPast = pieces.some(pastWork)
  const kept: string[] = []
  const seen: string[] = []
  for (const piece of pieces) {
    if (dictionaryOpener(piece) || genericThirdPerson(piece) || META_LINE.test(piece)) continue
    if (pastQuestion && hasPast && hypothetical(piece)) continue
    if (source.trim() && !supportedSentence(piece, resume.text, resume.profile, resume.marked)) continue
    const key = sentenceKey(piece)
    if (!key || seen.some((prior) => nearDuplicate(prior, key))) continue
    seen.push(key)
    const tidy = tidySentence(piece)
    if (tidy) kept.push(tidy)
  }
  const intro = /^(?:introduce yourself|tell me about yourself|walk me through your (?:background|career|resume))\b/i.test(asked)
  const ordered = intro ? kept : kept.map((line, index) => ({ line, index, rank: speakRank(line) })).sort((a, b) => a.rank - b.rank || a.index - b.index).map((item) => item.line)
  if (!ordered.length) return source.trim() ? "I have not done that." : ""
  const speech = ordered.map((line) => /[.!?]$/.test(line) ? line : `${line}.`).join(" ")
  if (spokenQuestion(asked)) return speech
  return bulleted ? ordered.map((line) => `- ${line}`).join("\n") : speech
}

function repairSectioned(raw: string): string {
  let section: AnswerSection = "Claim"
  let index = 0
  const out: string[] = []
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t) continue
    if (/^(?:…|\.{3})$/.test(t)) { out.push(t); continue }
    const head = t.match(/^\*\*(Claim|Context|Action|Result|Close|What I did)\*\*$/)
    if (head) {
      section = head[1] === "What I did" ? "Action" : (head[1] as AnswerSection)
      index = 0
      out.push(`**${head[1]}**`)
      continue
    }
    const bullet = t.match(/^(?:[-•*]|\d+[.)])\s+(.+)$/)
    if (bullet) {
      const spoken = signpost(section, bullet[1], index === 0)
      index += 1
      if (spoken) out.push(`- ${spoken}`)
      continue
    }
    if (genericThirdPerson(t)) continue
    out.push(t)
  }
  return out.join("\n")
}

function bucket(sentence: string, source: string): AnswerSection {
  if (numberIsSourced(sentence, source)) return "Result"
  if (/\b(?:result|stopped|outcome)\b/i.test(sentence)) return "Close"
  if (/\b(?:I|we)\s+(?:checked|built|added|implemented|sent|reviewed|mapped|held|would|joined|ran)\b/i.test(sentence)) return "Action"
  return "Context"
}

const INTRO_ASK = /^(?:introduce yourself|tell me about yourself|walk me through your (?:background|career|resume))\.$/i

/** An introduction stays one paragraph. Kept from the intro cleanup. */
export function plainIntroAnswer(text: string): string {
  const sentences: string[] = []
  for (const line of String(text || "").split("\n")) {
    const t = line.trim()
    if (!t || /^(?:…|\.{3})$/.test(t) || /^\*\*(?:Claim|Context|Action|Result|Close|What I did)\*\*$/.test(t)) continue
    for (const bit of t.split(/(?<=[.!?])\s+/)) {
      let spoken = bit.replace(/^(?:[-•*]|\d+[.)])\s+/, "").replace(/^(?:first|then|finally|the result)\b[:,]?\s+/i, "").trim()
      if (!spoken) continue
      spoken = spoken.replace(/^([a-z])/, (letter) => letter.toUpperCase())
      if (answerWordCount(spoken) >= 3) sentences.push(spoken)
    }
  }
  return sentences.join(" ")
}

/** Format a finished answer for the card. Idempotent. No random choice. */
export function presentSpokenAnswer(question: string, text: string, source = ""): string {
  const raw = String(text || "").trim()
  if (!raw) return raw
  if (INTRO_ASK.test(cleanHeardQuestion(question))) return finishLeftAnswer(question, plainIntroAnswer(raw), source)
  if (/\*\*(?:Claim|Context|Action|Result|Close|What I did)\*\*/.test(raw)) return finishLeftAnswer(question, repairSectioned(raw), source)
  const allowed = `${source}\n${question}`
  const sentences = answerSentences(raw).map((s) => withoutInventedNumbers(s, allowed)).filter((s) => answerWordCount(s) >= 3 && !genericThirdPerson(s))
  if (!answerIsComplex(question, sentences.join(" ")) || sentences.length < 2) return finishLeftAnswer(question, sentences.join(" ") || raw, source)
  const groups: Record<AnswerSection, string[]> = { Claim: [], Context: [], Action: [], Result: [], Close: [] }
  groups.Claim.push(sentences[0])
  for (const sentence of sentences.slice(1)) groups[bucket(sentence, allowed)].push(sentence)
  const blocks: string[] = []
  for (const title of SECTION_ORDER) {
    const group = groups[title]
    if (!group.length) continue
    if (blocks.length) blocks.push("…")
    blocks.push(`**${title}**`)
    const tight = group.length <= 4 ? group : [...group.slice(0, 3), group.slice(3).join(" ")]
    tight.forEach((sentence, index) => {
      const line = signpost(title, sentence, index === 0)
      if (line) blocks.push(`- ${line}`)
    })
  }
  return finishLeftAnswer(question, blocks.join("\n"), source)
}

export function sectionOrder(card: string): string[] {
  return [...String(card || "").matchAll(/^\*\*([^*]+)\*\*$/gm)].map((m) => m[1])
}
