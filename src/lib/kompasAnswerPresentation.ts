import { cleanHeardQuestion } from "./kompasLongContext.ts"

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

function uncap(sentence: string): string {
  return sentence.replace(/^([A-Z])([a-z])/, (_, a: string, b: string) => a.toLowerCase() + b)
}

const LEADING_MARK = /^(?:[-•*]|\d+[.)])\s+/
const LEADING_CONNECTOR = /^(first|then|finally|the result)\b[:,]?\s+/i

function connectorLabel(name: string): string {
  if (name === "first") return "First,"
  if (name === "then") return "Then,"
  if (name === "finally") return "Finally,"
  return "The result:"
}

/** Peel every leading dash and every leading connector. A later connector wins, so a prepended "First," cannot cover "Then" or "Finally". */
function peelBullet(sentence: string): { connector: string; body: string } {
  let s = String(sentence || "").trim()
  let connector = ""
  let prev = ""
  while (s && s !== prev) {
    prev = s
    s = s.replace(LEADING_MARK, "").trim()
    const hit = s.match(LEADING_CONNECTOR)
    if (!hit) break
    connector = hit[1].toLowerCase()
    s = s.slice(hit[0].length).trim()
  }
  return { connector, body: s.replace(LEADING_MARK, "").trim() }
}

function signpost(section: AnswerSection, sentence: string, first: boolean): string {
  const peeled = peelBullet(sentence)
  if (!peeled.body) return ""
  const clean = uncap(peeled.body)
  if (peeled.connector) return `${connectorLabel(peeled.connector)} ${clean}`
  if (!first) return peeled.body
  if (section === "Context") return `First, ${clean}`
  if (section === "Action") return `Then, ${clean}`
  if (section === "Result") return `The result: ${clean}`
  return peeled.body
}

function repairSectioned(raw: string): string {
  let section: AnswerSection = "Claim"
  let index = 0
  const out: string[] = []
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || /^(?:…|\.{3})$/.test(t)) continue
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

/** An introduction is one paragraph. Section headings and a prepended First are not spoken. */
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
  if (INTRO_ASK.test(cleanHeardQuestion(question))) return plainIntroAnswer(raw)
  if (/\*\*(?:Claim|Context|Action|Result|Close|What I did)\*\*/.test(raw)) return repairSectioned(raw)
  const allowed = `${source}\n${question}`
  const sentences = answerSentences(raw).map((s) => withoutInventedNumbers(s, allowed)).filter((s) => answerWordCount(s) >= 3)
  if (!answerIsComplex(question, sentences.join(" ")) || sentences.length < 2) return sentences.join(" ") || raw
  const groups: Record<AnswerSection, string[]> = { Claim: [], Context: [], Action: [], Result: [], Close: [] }
  groups.Claim.push(sentences[0])
  for (const sentence of sentences.slice(1)) groups[bucket(sentence, allowed)].push(sentence)
  const blocks: string[] = []
  for (const title of SECTION_ORDER) {
    const group = groups[title]
    if (!group.length) continue
    blocks.push(`**${title}**`)
    const tight = group.length <= 4 ? group : [...group.slice(0, 3), group.slice(3).join(" ")]
    tight.forEach((sentence, index) => {
      const line = signpost(title, sentence, index === 0)
      if (line) blocks.push(`- ${line}`)
    })
  }
  return blocks.join("\n")
}

export function sectionOrder(card: string): string[] {
  return [...String(card || "").matchAll(/^\*\*([^*]+)\*\*$/gm)].map((m) => m[1])
}
