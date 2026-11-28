// Deterministic relevance check for a spoken answer: which parts of the question it answers,
// whether the first part is answered first, and whether it drifts into an unasked resume tail.
// Used by the answer service (to ask a continuation for a skipped part) and by the band/relevance tests.

const STOP = new Set(("a an the and or but if of to for with in on at as is are was were be been being this that those these it its " +
  "you your yours me my i we our us they them their he she do does did done have has had can could would will should shall may might " +
  "tell describe explain share walk give provide talk let know about what which who whom why how where when there here then than " +
  "so very just also some any all each every one two three more most much many such like okay ok got right uh um yeah well " +
  "time times situation scenario example examples experience experiences specific specifically particular particularly " +
  "process approach steps step take took taking make made making handle handled handling ensure ensured used use using utilize " +
  "work worked working daily day-to-day typically typical usually generally kind sort thing things way ways able into from out up " +
  "after before during while over under between through across within without other another same own new last first next " +
  "imagine suppose assume consider given happen happened would've i'd i'm i've you're you've don't didn't isn't wasn't " +
  "factors decide decision determine consider considered key important effectively effective efficiency process").split(/\s+/))

const LOGISTICS = /^(?:okay|ok|alright|all right|got it|great|good|sure|cool|right|perfect|thanks|thank you|nice|awesome|i see|makes sense)[.!,\s]*$/i
const ASK = /^(?:and\s+|so\s+|now\s+|also\s+|uh\s+|um\s+)*(?:what|which|who|why|how|where|when|can|could|would|will|do|does|did|have|has|are|is|tell|describe|explain|give|walk|share|talk|provide|list|name|compare|in your experience|if)\b/i

export type QuestionPart = { text: string; keys: string[] }

const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9+#]/g, "").slice(0, 6)

export function contentKeys(text: string): string[] {
  const out: string[] = []
  for (const raw of String(text || "").toLowerCase().replace(/day[- ]to[- ]day|dayto-day/g, "dayday").split(/[^a-z0-9+#'-]+/)) {
    const w = raw.replace(/^'+|'+$/g, "")
    if (w.length < 3 || STOP.has(w)) continue
    const s = stem(w)
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

/** The asked parts of a (possibly multi-part, spoken) question, in order. Context lines ("Imagine ...") join the next ask. */
export function questionParts(question: string): QuestionPart[] {
  const pieces = String(question || "").replace(/\s+/g, " ").trim()
    .split(/(?<=[?.!])\s+/).map((p) => p.trim()).filter((p) => p && !LOGISTICS.test(p))
  const parts: QuestionPart[] = []
  let context = ""
  for (const p of pieces) {
    const asks = /\?\s*$/.test(p) || ASK.test(p)
    if (!asks) { context = `${context} ${p}`.trim(); continue }
    const keys = contentKeys(p)
    const ctxKeys = context ? contentKeys(context) : []
    parts.push({ text: context ? `${context} ${p}` : p, keys: keys.length ? keys : ctxKeys })
    context = ""
  }
  if (!parts.length && context) parts.push({ text: context, keys: contentKeys(context) })
  return parts.filter((p) => p.keys.length)
}

function hits(keys: string[], text: string): number {
  const bag = new Set(contentKeys(text))
  return keys.filter((k) => bag.has(k) || [...bag].some((b) => b.length >= 4 && k.length >= 4 && (b.startsWith(k.slice(0, 4)) && k.startsWith(b.slice(0, 4))))).length
}

export function partAddressed(part: QuestionPart, answer: string): boolean {
  const need = part.keys.length <= 2 ? 1 : Math.min(3, Math.ceil(part.keys.length * 0.34))
  return hits(part.keys, answer) >= need
}

const RESUME_TAIL = /\b(?:I handle cybersecurity operations|years of experience in|I hold (?:the )?(?:CISSP|CISM|CISA|Security\+|CEH|OSCP)|certifications? (?:include|such as)|my resume|in summary, my background|overall, my experience)\b/i

export type RelevanceReport = { parts: number; addressed: number; missing: string[]; firstFirst: boolean; drift: boolean; pass: boolean }

/** Every part answered, the first part answered in the opening two sentences, and no unasked resume tail. */
export function relevanceReport(question: string, answer: string): RelevanceReport {
  const parts = questionParts(question)
  const text = String(answer || "")
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const missing = parts.filter((p) => !partAddressed(p, text)).map((p) => p.text)
  const opening = sentences.slice(0, 2).join(" ")
  const firstFirst = !parts.length || hits(parts[0].keys, opening) >= 1
  const allKeys = parts.flatMap((p) => p.keys)
  const tail = sentences.slice(Math.floor(sentences.length * 0.75))
  const drift = tail.some((s) => RESUME_TAIL.test(s) && hits(allKeys, s) === 0)
  return { parts: parts.length, addressed: parts.length - missing.length, missing, firstFirst, drift, pass: !missing.length && firstFirst && !drift && !!text.trim() }
}
