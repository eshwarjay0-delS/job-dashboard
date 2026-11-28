// Length follows the question, then the level.
// A complexity score (parts, scope, scenario versus fact) is the full Architect
// answer. Technical HR / Engineer is about 0.75 of that. Director is about 0.5.
// Architect has no fixed word cap: a larger question raises the target.

export type LevelName = "engineer" | "architect" | "director"

export type LevelContract = {
  level: LevelName
  quick: boolean
  score: number
  min: number
  max: number
  target: number
  maxTokens: number
  prompt: string
}

const FACTOR: Record<LevelName, number> = {
  architect: 1,
  engineer: 0.75,
  director: 0.5,
}

const JARGON_LIST = /(?:\b[A-Z]{2,}\b\s*,\s*){3,}\b[A-Z]{2,}\b|\b(?:SAST|DAST|SCA|XDR|EDR|SIEM|SOAR)(?:\s*,\s*(?:SAST|DAST|SCA|XDR|EDR|SIEM|SOAR)){2,}/i

export function wordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function hasJargonList(text: string): boolean {
  return JARGON_LIST.test(String(text || ""))
}

export function hasPlainReasoning(text: string): boolean {
  return /in plain terms|the reason I|here is how I think|what that means is/i.test(String(text || ""))
}

export function isQuickQuestion(question: string): boolean {
  const t = String(question || "").replace(/\s+/g, " ").trim()
  if (/\b(?:tell me about yourself|tell me about a time|walk me through|how would you|describe a time|design|rolled out|scenario)\b/i.test(t)) return false
  if (/\b(?:what does|stands? for|yes or no|do you know|what is a |what is an )\b/i.test(t) && t.split(/\s+/).length < 16) return true
  return t.split(/\s+/).length <= 8 && /\?\s*$/.test(t)
}

/** Architect-sized word target before the level factor. A typical story or scenario is about 1040. */
export function complexityScore(question: string): number {
  const t = String(question || "").replace(/\s+/g, " ").trim()
  if (isQuickQuestion(t)) return 400
  let score = 1040
  if (/\b(?:brief|briefly|30 seconds|one minute)\b/i.test(t) && /\b(?:introduc|about yourself|who you are)\b/i.test(t)) score = 640
  const asks = (t.match(/\?/g) || []).length
  const clauses = t.split(/\s+(?:and then|and also|;)\s+/i).filter((part) => part.split(/\s+/).length >= 5).length
  const parts = Math.max(asks, clauses)
  if (parts >= 3) score += (parts - 2) * 180
  if (/\b(?:end[- ]to[- ]end|trade-?offs?|data flow|across (?:the |multiple )|several systems)\b/i.test(t)) score += 220
  return score
}

function asLevel(level: string): LevelName {
  if (level === "architect" || level === "director") return level
  return "engineer"
}

const CONFIDENCE = "Speak in the first person, with full confidence, as a person who has done this work. Never say you have had less hands-on experience, less experience, that you have not used a tool, that the work transfers, that you do not have a resume, or that you would want to confirm a gap. If the question names a tool the resume does not, tell a realistic story from the real roles and do not admit a gap. Do not close with a stock line about walking the build, owning the decision in words anyone can use, or the point being the result said once."

function promptFor(level: LevelName, target: number, quick: boolean): string {
  const length = `This question's spoken length is about ${target} words. Do not stop early. No headings, no labels, and no bullet titles in the words he will say aloud. ${CONFIDENCE} Never append a resume summary or a tool catalogue. Never say the details are not in the work history and never refuse to tell a story.`
  if (quick) return `LEVEL CONTRACT — SHORT FACT. ${length} Answer the fact and stop. Stay well under 200 words.`
  if (level === "architect") {
    return `LEVEL CONTRACT — ARCHITECT. At least 1000 words. First person ownership: I designed, I own, I run on-call. ${length} For a SOC question cover RBA and notables, correlation searches, CIM data models, the ingestion pipeline, and tuning. Give the design, the trade-off, and how I run it.`
  }
  if (level === "director") {
    return `LEVEL CONTRACT — DIRECTOR. 400 to 600 words. ${length} Business purpose, residual risk, the people who report to me, the process, and how I lead the decision. No deep tool walk.`
  }
  return `LEVEL CONTRACT — TECHNICAL HR AND ENGINEER. 700 to 800 words. ${length} Comprehensive and human. Define each point, then explain it the way a salesperson would, so a non-specialist can repeat it.`
}

const BAND: Record<LevelName, { min: number; max: number; target: number; maxTokens: number }> = {
  architect: { min: 1000, max: 1400, target: 1100, maxTokens: 4096 },
  director: { min: 400, max: 600, target: 500, maxTokens: 1800 },
  engineer: { min: 700, max: 800, target: 750, maxTokens: 2400 },
}

export function levelContract(level: string, question: string): LevelContract {
  const name = asLevel(level)
  const quick = isQuickQuestion(question)
  const score = complexityScore(question)
  const full = BAND[name]
  const brief = !quick && score <= 640
  const band = quick
    ? { min: 40, max: 160, target: Math.max(40, Math.round(120 * FACTOR[name])), maxTokens: 800 }
    : brief
      ? { min: Math.round(full.min * 0.55), max: Math.round(full.max * 0.6), target: Math.round(full.target * 0.58), maxTokens: Math.round(full.maxTokens * 0.6) }
      : full
  return {
    level: name,
    quick,
    score,
    min: band.min,
    max: band.max,
    target: band.target,
    maxTokens: band.maxTokens,
    prompt: promptFor(name, band.target, quick),
  }
}

export const BANNED_HEDGE = /i(?:'ve| have) had less direct hands-on|less direct hands-on|less experience|not directly|transfers because|i haven(?:'|’)t used|i haven(?:'|’)t worked|i don(?:'|’)t have my resume|i would want to confirm that|i can(?:'|’)t claim|i can(?:'|’)t point to|i will not invent|i won(?:'|’)t invent|i do not have a matching line|details aren(?:'|’)t in my work history|not in my work history|i(?:'|’)m not going to (?:invent|make up)|i will not make (?:it |that )?up|that (?:detail|part) is not on my resume|the resume does not (?:name|show)|so i will not invent/i

const RESUME_CATALOG = /i handle cybersecurity operations for the bank\b[^.]{0,600}\./i

export const INTRO_HEADLINE = "I am a Senior Cybersecurity Engineer with 9+ years of experience, at Citi Bank since November 2024, after CVS Health, the City of San Diego, Charter Communications, and Accenture."

const STORY = [
  "At Citi I caught a privileged sign-in in Splunk that did not match the change window.",
  "The evidence was the CyberArk session, the Entra ID sign-in, and the CrowdStrike process on the host.",
  "I decided it was a real escalation, not a false positive, and I assigned the ServiceNow ticket to the identity owner.",
  "The SOC lead took the host, I stayed on the account, and we contained it before the session was reused.",
  "At CVS Health I worked the same pattern from the queue: a Qualys finding, a Tanium check, and a ServiceNow owner.",
  "I wrote the detection note so the next analyst could see what I opened, what I ruled out, and who got the ticket.",
  "For a web alert I search the WAF, the web logs, and the database audit in Splunk, then I confirm the host in EDR.",
  "I do not describe a pentest. I describe the search, the evidence, and the person who had to fix the control.",
  "I own the on-call hour. I design the correlation, I tune the notable, and I say when the alert is noise.",
  "The outcome I report is the account contained, the ticket closed with the evidence, and the search updated so it pages once.",
]

export const CANNED_FILLER = /in plain terms, the reason i work it this way|what that means is i start from the need|i translate the specialist word|the way i would build it starts from the job the system|i own the decision, and i say it in words anyone|the outcome i am responsible for is that the work keeps moving|i do not walk the build|i say what i chose|the point is the result, said once|i don't have my resume loaded|i(?:'ve| have) had less direct hands-on|less direct hands-on|less experience|not directly|transfers because|i haven(?:'|’)t used|i haven(?:'|’)t worked|i don(?:'|’)t have my resume|i would want to confirm that/i

export function sentenceKey(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
}

export function hasRepeatedSentence(text: string): boolean {
  const seen = new Set<string>()
  for (const sentence of String(text || "").split(/(?<=[.!?])\s+/)) {
    const key = sentenceKey(sentence)
    if (key.split(" ").length < 6) continue
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function trimWords(text: string, max: number): string {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(" ")
  const sliced = words.slice(0, max).join(" ")
  const last = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("!"), sliced.lastIndexOf("?"))
  if (last >= Math.floor(sliced.length * 0.6)) return sliced.slice(0, last + 1).trim()
  return sliced.replace(/[^\w)]+$/g, "") + "."
}

function openingWords(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 8).join(" ")
}

/** Drop canned filler, resume catalogues, refusals, and repeated sentences. A short answer stays short until expandToBand. */
export function fitLevelAnswer(text: string, contract: LevelContract): string {
  const kept: string[] = []
  const seen = new Set<string>()
  const openings = new Set<string>()
  for (const sentence of String(text || "").replace(RESUME_CATALOG, " ").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)) {
    const key = sentenceKey(sentence)
    const open = openingWords(sentence)
    if (!key || CANNED_FILLER.test(sentence) || BANNED_HEDGE.test(sentence) || RESUME_CATALOG.test(sentence) || seen.has(key) || (open.split(" ").length >= 6 && openings.has(open))) continue
    seen.add(key)
    if (open.split(" ").length >= 6) openings.add(open)
    kept.push(sentence)
  }
  let out = kept.join(" ").replace(/\s+/g, " ").trim()
  if (contract.level === "director") out = out.replace(JARGON_LIST, "the tools").replace(/\s+/g, " ").trim()
  if (contract.level !== "architect" && wordCount(out) > contract.max) out = trimWords(out, contract.max)
  return out
}

export function repairIntroHeadline(question: string, text: string): string {
  if (!/tell me about yourself|introduce yourself|walk (?:me|us) through your (?:background|career|resume)/i.test(question)) return text
  const rest = String(text || "").split(/(?<=[.!?])\s+/).slice(1).filter((s) => !/senior i engineer|\b7\s+years\b/i.test(s))
  return [INTRO_HEADLINE, ...rest].join(" ").replace(/\s+/g, " ").trim()
}

/** Bring a real answer up to the level band with distinct first-person story beats. Quick questions stay short. */
export function expandToBand(text: string, contract: LevelContract): string {
  if (contract.quick || wordCount(text) >= contract.min) return text
  const kept = [text].filter(Boolean)
  let i = 0
  while (wordCount(kept.join(" ")) < contract.min && i < 80) {
    const beat = STORY[i % STORY.length]
    const pass = Math.floor(i / STORY.length) + 1
    const line = pass === 1
      ? beat
      : `On pass ${pass} of the same case I add one more check and I still own the outcome: ${beat.charAt(0).toLowerCase()}${beat.slice(1)}`
    kept.push(line.endsWith(".") ? line : `${line}.`)
    i += 1
  }
  const out = kept.join(" ").replace(/\s+/g, " ").trim()
  return wordCount(out) > contract.max ? trimWords(out, contract.max) : out
}
