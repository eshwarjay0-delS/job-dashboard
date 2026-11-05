// Verbatim copy of Dossier's no-logistics phrase list and bannedLogistics (dossier-engine-master 79f91b38,
// src/lib/dossierBlueprint.ts). scripts/tests/kompas-lens-logistics.test.mjs fails if it drifts from Dossier's copy.
// When both land, keep one file and import it from the other.
// Eshwar's rule (29 Oct 2026): no logistics anywhere in a dossier or answer. Phrases, not bare words, so
// "address the root cause" or "relocated the pipeline" are not caught.
const LOGISTICS: RegExp[] = [
  /\b(?:visa|h-?1b|green\s*card|sponsorship|sponsor\s+(?:me|my|a\s+visa)|work\s+authori[sz]ation|authori[sz]ed\s+to\s+work|citizen(?:ship)?|work\s+permit|\bOPT\b|EAD)\b/gi,
  /\b(?:salary|compensation|pay\s+(?:rate|range|expectations?)|hourly\s+rate|bill\s+rate|rate\s+expectations?|per\s+hour)\b/gi,
  /\b(?:relocat(?:e|ion|ing)\b(?!\s+(?:the|a|an|our|my|its)\s+(?:log|pipeline|data|bucket|service|server|workload|database)))/gi,
  /\b(?:current(?:ly)?\s+(?:location|located|based)|where\s+(?:are\s+you|I\s+am|I'm)\s+(?:located|based)|local\s+to|commut(?:e|ing)|home\s+address|mailing\s+address|street\s+address)\b/gi,
  /\b(?:start\s+date|notice\s+period|available\s+to\s+start|when\s+(?:could|can|would)\s+you\s+start)\b/gi,
  /\b(?:on-?site|in-?office|in\s+office|hybrid|(?:fully\s+|not\s+)?remote\s*(?:role|position|work|job)?(?=\W)|work\s+from\s+home|days?\s+(?:a|per|each)\s+week|working\s+model|return\s+to\s+office)\b/gi,
  /\b(?:contract\s+(?:length|term|duration|terms)|conversion\s+to\s+(?:full-?time|FTE|perm)|contract-to-hire|w-?2|c2c|1099)\b/gi,
  /^#{1,4}\s.*\blogistics\b/gim,
]
export function bannedLogistics(text: string): string[] {
  const out: string[] = []
  for (const re of LOGISTICS) for (const m of String(text || "").matchAll(new RegExp(re.source, re.flags))) out.push(m[0].trim())
  return out
}

const VISA_CLAIM = /\b(?:i|i'm|i am|my|we)\b[^.]{0,80}\b(?:visa|h-?1b|green\s*card|sponsorship|work\s+authori[sz]ation|authori[sz]ed\s+to\s+work|citizen(?:ship)?|work\s+permit|\bopt\b|\bead\b)\b/i
const ADDRESS_CLAIM = /\b(?:my\s+(?:home|mailing|street)\s+address|i\s+live\s+at|my address is)\b/i
const PLACE_CLAIM = /\bi(?:\s+am|'m)?\s+(?:live|based|located)\s+in\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i
const PERSONAL_RELOC = /\b(?:willing|open|able|happy|ready)\s+to\s+relocat|\bi\s+(?:can|would|will)\s+relocate\b(?!\s+(?:the|a|an|our|those|these)\b)/i
const SYSTEM_RELOC = /\brelocat(?:e|ed|es|ing|ion)\s+(?:the|a|an|our|my|its|those|these)\b/i
const LOGISTICS_TOPIC = /\b(?:visa|h-?1b|green\s*card|sponsorship|work\s+authori[sz]ation|home\s+address|mailing\s+address|street\s+address|open\s+to\s+relocation|willing\s+to\s+relocat)\b/i
const REFUSAL = "I will not guess a personal detail that is not on my resume."

function answerSentences(text: string): string[] {
  return String(text || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

function questionAsksLogistics(question: string, sentence: string): boolean {
  const q = question.toLowerCase()
  const s = sentence.toLowerCase()
  if (/\b(?:visa|h-?1b|green card|sponsorship|work authori[sz]ation|citizen)\b/.test(s) && /\b(?:visa|h-?1b|green card|sponsorship|work authori[sz]ation|citizen)\b/.test(q)) return true
  if (/\b(?:home address|mailing address|street address|my address)\b/.test(s) && /\baddress\b/.test(q)) return true
  if (/\b(?:live in|based in|located in)\b/.test(s) && /\b(?:live|based|located|where)\b/.test(q)) return true
  if (/\brelocat/.test(s) && /\brelocat/.test(q)) return true
  return false
}

function sourcesSupportLogistics(sentence: string, sources: string): boolean {
  const src = sources.toLowerCase()
  const place = sentence.match(PLACE_CLAIM)
  if (place && !src.includes(place[1].toLowerCase())) return false
  if (/\b(?:visa|h-?1b|green\s*card|sponsorship|work\s+authori|citizen(?:ship)?|\bopt\b|\bead\b)\b/i.test(sentence)
    && !/\b(?:visa|h-?1b|green\s*card|sponsorship|work\s+authori|citizen(?:ship)?|\bopt\b|\bead\b)\b/i.test(sources)) return false
  if (ADDRESS_CLAIM.test(sentence) && !/\b(?:home|mailing|street)\s+address\b/i.test(sources)) return false
  if (PERSONAL_RELOC.test(sentence) && !/\brelocat/i.test(sources)) return false
  return true
}

/** Sentences that state visa, home address, where the speaker lives, or personal relocation without the resume and the question both allowing it. Moving a system stays. */
export function ungroundedLogisticsSentences(text: string, sources = "", question = ""): string[] {
  return answerSentences(text).filter((sentence) => {
    if (SYSTEM_RELOC.test(sentence) && !VISA_CLAIM.test(sentence) && !ADDRESS_CLAIM.test(sentence) && !PLACE_CLAIM.test(sentence) && !PERSONAL_RELOC.test(sentence)) return false
    const personal = VISA_CLAIM.test(sentence) || ADDRESS_CLAIM.test(sentence) || PLACE_CLAIM.test(sentence) || PERSONAL_RELOC.test(sentence)
    const topic = LOGISTICS_TOPIC.test(sentence)
    if (!personal && !topic) return false
    if (!personal && topic) return !questionAsksLogistics(question, sentence)
    if (!questionAsksLogistics(question, sentence)) return true
    return !sourcesSupportLogistics(sentence, sources)
  })
}

/** Drop those sentences. When nothing else remains, a short refusal stands in so the turn is not a blank provider error. */
export function dropUngroundedLogistics(text: string, sources = "", question = ""): string {
  const all = answerSentences(text)
  const bad = new Set(ungroundedLogisticsSentences(text, sources, question))
  if (!bad.size) return String(text || "")
  const kept = all.filter((sentence) => !bad.has(sentence))
  return kept.length ? kept.join(" ") : REFUSAL
}
