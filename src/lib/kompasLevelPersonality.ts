// Level personality contract for Kompas.
// The answer route can import this later, beside the model call:
//
//   import { personalityPrompt } from "@/lib/kompasLevelPersonalityPrompt"
//   import { applyPersonalityFilter, personalityContract } from "@/lib/kompasLevelPersonality"
//
//   const spec = personalityContract(level, question)
//   const draft = await model(personalityPrompt(level, question), spec.maxTokens)
//   const spoken = await applyPersonalityFilter({ level, question, text: draft, regenerate })
//
// This file does not edit the answer route. PR 613 owns that route and the
// older length contract in kompasLevelContract.ts.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { levelContract } from "./kompasLevelContract.ts"
import { openingSentences, poolSentences, type PersonalityKind, type PersonalityLevel } from "./kompasLevelPersonalityCopy.ts"

export { openingSentences, poolSentences }

export type { PersonalityKind, PersonalityLevel }

export const PERSONALITY_LEVELS = ["architect", "director", "engineer"] as const

export const BANDS: Record<PersonalityLevel, { min: number; max: number; target: number; maxTokens: number }> = {
  architect: { min: 1000, max: 1400, target: 1120, maxTokens: 4096 },
  director: { min: 400, max: 600, target: 510, maxTokens: 1600 },
  engineer: { min: 700, max: 800, target: 750, maxTokens: 2200 },
}

const RESUME_FILE = join(typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "", "src/lib/kompas-houston-resume.txt")

const RESUME_FIXTURE = `eshwarjay05@gmail.com
Fortinet AWS Cloud Networking Engineer with 9+ years designing, deploying and migrating secure network infrastructures across multi-region AWS environments.
Lead end-to-end FortiGate-VM deployments, active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway.
Cisco FTD to Fortinet migrations across six AWS regions.
FortiManager and FortiAnalyzer supported those FortiGate-VM deployments.
NERC CIP applied to the network change and the zero-downtime cutovers.
The wider cutover beyond the FortiGate-VM clusters was a team effort.
Those FortiGate-VM deployments and the Cisco FTD to Fortinet migrations across six AWS regions were the part I can speak to.
`

/** The named Houston file. It is not in this repo. Do not invent its text. */
export const SR_CYBER_RESUME_NAME = "Eshwar_Resume_Sr_Cybersecurity_Engineer"

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "coverage"])

function walkForSrCyber(root: string): string | null {
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop() as string
    let names: string[] = []
    try { names = readdirSync(dir) } catch { continue }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      if (/^Eshwar_Resume_Sr_Cybersecurity_Engineer(?:\.(?:docx|txt|md|json))?$/i.test(name)) return full
      try { if (statSync(full).isDirectory()) stack.push(full) } catch { /* skip */ }
    }
  }
  return null
}

let srCyberCache: { found: boolean; path: string | null; missingName: string } | null = null

export function srCyberResumeLookup(root = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ""): { found: boolean; path: string | null; missingName: string } {
  if (srCyberCache && srCyberCache.missingName === SR_CYBER_RESUME_NAME) return srCyberCache
  const path = root ? walkForSrCyber(root) : null
  srCyberCache = { found: Boolean(path), path, missingName: SR_CYBER_RESUME_NAME }
  return srCyberCache
}

export function houstonResume(): string {
  try {
    const text = readFileSync(RESUME_FILE, "utf8")
    if (text.trim()) return text.trim()
  } catch { /* the route loader sometimes evaluates this file without the sibling text */ }
  return RESUME_FIXTURE.trim()
}

export function wordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function asLevel(level: string): PersonalityLevel {
  const value = String(level || "").toLowerCase()
  if (value.includes("architect")) return "architect"
  if (value.includes("director")) return "director"
  return "engineer"
}

export function questionKind(question: string): PersonalityKind {
  const q = String(question || "").toLowerCase()
  if (/\btell me about yourself\b|\bintroduce yourself\b|\bwalk me through your background\b/.test(q)) return "intro"
  if (/\bsaviynt\b|\bterrible iam\b|\biam experience\b/.test(q)) return "iam"
  if (/\bsql injection\b|\bsentinel\b|\bsiem\b/.test(q)) return "security"
  if (/\bdesign\b|\binspection path\b/.test(q)) return "design"
  if (/\bftd\b|\bmigration you ran\b|\bwalk me through the cisco\b/.test(q)) return "migration"
  if (/\btell me about a time\b|\bled a cutover\b/.test(q)) return "behavioral"
  return "technical"
}

export type PersonalityContract = {
  level: PersonalityLevel
  kind: PersonalityKind
  min: number
  max: number
  target: number
  maxTokens: number
}

/** An interviewer who asks for a brief introduction keeps the shorter budget. */
export function isBriefIntroduction(question: string): boolean {
  const t = String(question || "")
  return /\b(?:brief|briefly|30 seconds|one minute)\b/i.test(t) && /\b(?:introduc|about yourself|who you are)\b/i.test(t)
}

export function personalityContract(level: string, question: string): PersonalityContract {
  const name = asLevel(level)
  const kind = questionKind(question)
  if (isBriefIntroduction(question)) {
    const brief = levelContract(name, question)
    return {
      level: name,
      kind,
      min: Math.max(40, Math.round(brief.target * 0.55)),
      max: brief.max,
      target: brief.target,
      maxTokens: brief.maxTokens,
    }
  }
  return { level: name, kind, ...BANDS[name] }
}

export const BANNED_PHRASES = [
  "I own the decision",
  "the risk we accepted is named",
  "I do not walk the build",
  "I don't walk the build",
  "I say what I chose",
  "The point is the result, said once",
  "I've had less direct hands-on with that; my Sr work transfers",
  "I’ve had less direct hands-on with that; my Sr work transfers",
]

/** Hedge and gap-admission family. A hit fails the answer even when the exact canned line is absent. */
export const HEDGE_FAMILY: { label: string; pattern: RegExp }[] = [
  { label: "less direct hands-on", pattern: /less direct hands-on/i },
  { label: "transfers because", pattern: /transfers because/i },
  { label: "my Sr work transfers", pattern: /\bmy\s+sr\.?\s+work\s+transfers\b/i },
  { label: "I haven't used", pattern: /\bi\s+have(?:\s+not|n['’]t)\s+used\b/i },
  { label: "I haven't had", pattern: /\bi\s+have(?:\s+not|n['’]t)\s+had\b/i },
  { label: "not directly", pattern: /\bnot directly\b/i },
  { label: "limited experience", pattern: /\blimited experience\b/i },
  { label: "I'm not as familiar", pattern: /\bi(?:['’]m|\s+am)\s+not\s+as\s+familiar\b/i },
  { label: "while I haven't", pattern: /\bwhile\s+i\s+have(?:\s+not|n['’]t)\b/i },
  { label: "I'm not familiar", pattern: /\bi(?:['’]m|\s+am)\s+not\s+familiar\b/i },
  { label: "I'm less familiar", pattern: /\bi(?:['’]m|\s+am)\s+less\s+familiar\b/i },
  { label: "I haven't worked with", pattern: /\bi\s+have(?:\s+not|n['’]t)\s+(?:worked(?:\s+with)?|been|done|seen|run|owned|deployed|administered|touched|got|gotten)\b/i },
  { label: "no direct experience", pattern: /\b(?:no|little|limited)\s+(?:direct\s+)?(?:experience|exposure|hands-on)\b/i },
  { label: "not hands-on", pattern: /\b(?:less|not|limited)\s+hands-on\b/i },
  { label: "outside my experience", pattern: /\boutside\s+(?:of\s+)?my\s+(?:experience|background|wheelhouse)\b/i },
  { label: "I would need to look it up", pattern: /\bi\s+would\s+need\s+to\s+(?:look(?:\s+it\s+up|\s+up)?|research|check|learn)\b/i },
  { label: "resume gap admission", pattern: /\b(?:the resume does not|not on my resume|i will not invent|i have not invented|that detail is not)\b/i },
  { label: "I can't speak to", pattern: /\bi\s+(?:cannot|can['’]t)\s+speak\s+to\b/i },
  { label: "I don't know", pattern: /\bi\s+(?:do not|don['’]t)\s+know\b/i },
  { label: "I'm not sure", pattern: /\bi(?:['’]m|\s+am)\s+not\s+sure\b/i },
  { label: "never used", pattern: /\bnever\s+(?:used|worked with|touched|run|owned|deployed)\b/i },
  { label: "gap in experience", pattern: /\bgap in (?:my )?(?:experience|knowledge|background)\b/i },
  { label: "not my area", pattern: /\bnot my (?:area|background|strength)\b/i },
  { label: "my work transfers", pattern: /\b(?:my|that|the|sr\.?)\s+work\s+transfers\b/i },
  { label: "I haven't had exposure", pattern: /\b(?:no|without)\s+(?:direct\s+)?exposure\b/i },
]

export const BUILD_DETAIL = /\b(FortiGate(?:-VM)?|FortiManager|FortiAnalyzer|Gateway Load Balancer|Transit Gateway|GENEVE|Cisco FTD|\bFTD\b|VPC|subnet|packets?|CLI|active\/active|active\/passive|HA clusters?|high[- ]availability|firewalls?|load balancers?|clusters?)\b/i

const PROFILE_MIX = /\b(?:jayeshwar44|jayeshwar24|eshwarjay06@gmail\.com|saint louis)\b/i
const INVENTED_TITLE = /\b(?:i am|i'm|i was|i served as|my role as|my title is|as an?)\s+(?:a |an |the )?(?:director|architect|ciso|iam lead|iam architect|iam engineer|senior security engineer|soc analyst|servicenow developer)\b/i

const DENY_EMPLOYERS = [
  "Saviynt",
  "Accenture",
  "Charter Communications",
  "Charter",
  "Cigna",
  "Citi Bank",
  "Citi",
  "McKesson",
  "Mckesson",
  "Molina",
  "Valero",
  "Qualcomm",
  "CVS Health",
  "CVS",
  "Northern Trust",
  "Fifth Bank",
]

export type EvalCase = { id: string; kind: PersonalityKind; question: string }

export const EVAL_CASES: EvalCase[] = [
  { id: "intro", kind: "intro", question: "Tell me about yourself." },
  { id: "technical", kind: "technical", question: "How does a FortiGate-VM high availability cluster hold up during a cutover?" },
  { id: "design", kind: "design", question: "How would you design a multi-region AWS inspection path for firewall traffic?" },
  { id: "behavioral", kind: "behavioral", question: "Tell me about a time you led a cutover that had to stay up." },
  { id: "security", kind: "security", question: "How would you investigate a SQL injection alert in Microsoft Sentinel?" },
  { id: "migration", kind: "migration", question: "Walk me through the Cisco FTD to Fortinet migration you ran across six AWS regions." },
  { id: "iam", kind: "iam", question: "Tell me about a customer who had a terrible IAM experience, what you implemented to fix it, and give a real example of a Saviynt issue you dealt with." },
]

export function sentencesOf(text: string): string[] {
  return String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

export function bannedHits(text: string): string[] {
  const hay = String(text || "")
  return BANNED_PHRASES.filter((phrase) => hay.toLowerCase().includes(phrase.toLowerCase()))
}

export function hedgeHits(text: string): string[] {
  const hay = String(text || "")
  return HEDGE_FAMILY.filter((row) => row.pattern.test(hay)).map((row) => row.label)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function claimsEmployment(sentence: string, name: string): boolean {
  const n = escapeRegExp(name)
  const patterns = [
    new RegExp(`\\b(?:worked|work|working)\\s+(?:at|for)\\s+${n}\\b`, "i"),
    new RegExp(`\\b(?:employed by|hired by|employment at)\\s+${n}\\b`, "i"),
    new RegExp(`\\bjoined\\s+${n}\\b`, "i"),
    new RegExp(`\\bmy\\s+(?:time|role|job|employer)\\s+(?:at|with)\\s+${n}\\b`, "i"),
    new RegExp(`\\b(?:while|when)\\s+i\\s+was\\s+at\\s+${n}\\b`, "i"),
    new RegExp(`\\bi\\s+was\\s+at\\s+${n}\\b`, "i"),
    new RegExp(`^(?:at|for)\\s+${n}\\b`, "i"),
    new RegExp(`\\b(?:i am|i'm|i was)\\s+(?:a|an|the)\\s+(?:(?!\\.)[\\s\\w,'’-]){0,40}\\bat\\s+${n}\\b`, "i"),
  ]
  return patterns.some((pattern) => pattern.test(sentence.trim()))
}

/** Employers named as his employer. Customer and partner tool stories are allowed. */
export function employmentViolations(text: string, resume = houstonResume()): string[] {
  const hits: string[] = []
  const allow = new Set(
    String(resume || "")
      .split(/\n+/)
      .map((line) => (line.match(/^client:\s*([^|–—-]+)/i) || [])[1] || "")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  )
  for (const sentence of sentencesOf(text)) {
    if (PROFILE_MIX.test(sentence)) hits.push(sentence.match(PROFILE_MIX)?.[0] || "other profile")
    if (INVENTED_TITLE.test(sentence)) hits.push("invented title")
    for (const name of DENY_EMPLOYERS) {
      const present = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(sentence)
      if (present && claimsEmployment(sentence, name)) hits.push(name)
    }
    const generic = sentence.matchAll(/\b(?:(?:worked|work)\s+at|employed by|joined)\s+([A-Z][A-Za-z0-9&.'’-]+(?:\s+[A-Z][A-Za-z0-9&.'’-]+){0,3})/g)
    for (const match of generic) {
      const name = match[1].replace(/[.,;:]+$/g, "").trim()
      if (name && !allow.has(name.toLowerCase())) hits.push(name)
    }
    const emails = sentence.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []
    for (const email of emails) {
      if (email.toLowerCase() !== "eshwarjay05@gmail.com") hits.push(email)
    }
  }
  return [...new Set(hits)]
}

export function isBulletSalad(text: string): boolean {
  const lines = String(text || "").split(/\n/)
  const bullets = lines.filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(line))
  return bullets.length >= 2
}

function hasSteps(text: string): boolean {
  const t = text.toLowerCase()
  return /\bfirst\b/.test(t) && /\bthen\b/.test(t) && /\bnext\b/.test(t) && /\bafter that\b/.test(t)
}

const QUESTION_STOP = new Set(["about", "does", "what", "how", "the", "and", "your", "you", "with", "that", "this", "from", "have", "tell", "give", "would", "when", "where", "which", "into", "them", "they", "their", "were", "been", "will", "just", "like", "then", "work", "time", "does"])

export function questionTerms(question: string): string[] {
  return [...new Set(String(question || "").toLowerCase().match(/[a-z][a-z0-9+]{4,}/g) || [])].filter((word) => !QUESTION_STOP.has(word))
}

export function addressesQuestion(question: string, text: string): boolean {
  const terms = questionTerms(question)
  if (!terms.length) return true
  const hay = text.toLowerCase()
  const hits = terms.filter((term) => hay.includes(term))
  return hits.length >= Math.min(2, terms.length)
}

function topicPass(level: PersonalityLevel, kind: PersonalityKind, text: string, question = ""): boolean {
  const t = text.toLowerCase()
  if (kind === "intro") {
    const years = /(?:9\+|more than nine|nine years)/.test(t)
    if (level === "director") return years && /network/.test(t)
    return years && /fortinet|fortigate|networking/.test(t)
  }
  if (kind === "technical") {
    const asksNetwork = /fortigate|cutover|failover|high[- ]availability|migration/i.test(question)
    if (!asksNetwork) return addressesQuestion(question, text)
    if (level === "director") return /cutover|zero[- ]downtime/.test(t) && /six/.test(t)
    return /fortigate|high[- ]availability|failover/.test(t) && /cutover/.test(t)
  }
  if (kind === "design" || kind === "migration") {
    if (!hasSteps(text) || isBulletSalad(text)) return false
    if (level === "director") return /six/.test(t) && /zero[- ]downtime|region/.test(t)
    if (kind === "migration") return /ftd|fortinet/.test(t) && /six/.test(t)
    return /fortigate|inspection|gateway/.test(t) && /region/.test(t)
  }
  if (kind === "behavioral") return /\bled\b|\bi lead\b/.test(t) && /cutover|zero[- ]downtime/.test(t)
  if (kind === "security") return /sql injection/.test(t) && /sentinel/.test(t)
  if (kind === "iam") return (/\biam\b/.test(t) || /identity/.test(t)) && /saviynt/.test(t) && /implement|integrated|troubleshoot/.test(t)
  return false
}

export type Assessment = {
  words: number
  min: number
  max: number
  wordBand: boolean
  employer: boolean
  employerHits: string[]
  banned: boolean
  bannedHits: string[]
  topic: boolean
  hedges: boolean
  hedgeHits: string[]
  style: boolean
  styleHits: string[]
  ok: boolean
}

export function assessAnswer(question: string, level: string, text: string): Assessment {
  const name = asLevel(level)
  const kind = questionKind(question)
  const band = BANDS[name]
  const words = wordCount(text)
  const bannedList = bannedHits(text)
  const hedgeList = hedgeHits(text)
  const employerList = employmentViolations(text)
  const styleHits: string[] = []
  const iCount = (text.match(/\bI\b/g) || []).length
  if (iCount < 5) styleHits.push("first person")
  if (/\bthe candidate\b/i.test(text)) styleHits.push("third person")
  if (name === "director" && BUILD_DETAIL.test(text)) styleHits.push("build detail")
  if (isBulletSalad(text)) styleHits.push("bullets")
  if ((kind === "design" || kind === "migration") && !hasSteps(text)) styleHits.push("steps")
  const wordBand = words >= band.min && words <= band.max
  const employer = employerList.length === 0
  const banned = bannedList.length === 0
  const topic = topicPass(name, kind, text, question)
  const hedges = hedgeList.length === 0
  const style = styleHits.length === 0
  return {
    words, min: band.min, max: band.max, wordBand, employer, employerHits: employerList,
    banned, bannedHits: bannedList, topic, hedges, hedgeHits: hedgeList, style, styleHits,
    ok: wordBand && employer && banned && topic && hedges && style,
  }
}

export function fallbackAnswer(level: string, question: string): string {
  return composeLevelAnswer(level, question, "")
}

/** Keep an on-topic draft, then fill the level band. A draft that misses the question uses the level opening. */
export function composeLevelAnswer(level: string, question: string, draft = ""): string {
  const name = asLevel(level)
  const kind = questionKind(question)
  const band = personalityContract(level, question)
  const clean = sentencesOf(draft).filter((sentence) => !sentenceRejected(sentence, name))
  const draftText = clean.join(" ")
  const useDraft = clean.length > 0 && addressesQuestion(question, draftText)
  const kept = useDraft ? [...clean] : [...openingSentences(name, kind)]
  const seen = new Set(kept.map((sentence) => sentence.toLowerCase()))
  const count = () => wordCount(kept.join(" "))
  const push = (sentence: string) => {
    const key = sentence.toLowerCase()
    if (seen.has(key)) return false
    const next = wordCount(`${kept.join(" ")} ${sentence}`)
    if (next > band.max) return false
    kept.push(sentence)
    seen.add(key)
    return true
  }
  for (const sentence of poolSentences(name)) {
    if (count() >= band.target) break
    push(sentence)
  }
  if (count() < band.min) {
    for (const sentence of openingSentences(name, kind)) {
      if (count() >= band.min) break
      push(sentence)
    }
  }
  return kept.join(" ").replace(/\s+/g, " ").trim()
}

function sentenceRejected(sentence: string, level: PersonalityLevel): boolean {
  if (/^\s*(?:[-*•]|\d+[.)])\s+\S/.test(sentence)) return true
  if (bannedHits(sentence).length || hedgeHits(sentence).length || employmentViolations(sentence).length) return true
  if (level === "director" && BUILD_DETAIL.test(sentence)) return true
  return false
}

function cleanDraft(text: string, level: PersonalityLevel): string {
  const band = BANDS[level]
  const lines = String(text || "").split(/\n/).filter((line) => !/^\s*(?:[-*•]|\d+[.)])\s+\S/.test(line))
  let sentences = sentencesOf(lines.join(" ")).filter((sentence) => !sentenceRejected(sentence, level))
  while (wordCount(sentences.join(" ")) > band.max && sentences.length > 1) sentences = sentences.slice(0, -1)
  return sentences.join(" ").replace(/\s+/g, " ").trim()
}

export function rewriteInstruction(assessment: Assessment): string {
  const problems = [
    ...assessment.bannedHits.map((hit) => `banned phrase: ${hit}`),
    ...assessment.hedgeHits.map((hit) => `hedge: ${hit}`),
    ...assessment.employerHits.map((hit) => `employer or title: ${hit}`),
    ...assessment.styleHits.map((hit) => `style: ${hit}`),
    assessment.wordBand ? "" : `word count ${assessment.words}, need ${assessment.min}-${assessment.max}`,
    assessment.topic ? "" : "the answer missed the question",
  ].filter(Boolean)
  return [
    "Rewrite the spoken answer.",
    "First person, confident, and decisive. You did this work.",
    "No hedging and no gap admission.",
    `Stay between ${assessment.min} and ${assessment.max} words.`,
    "Use only the Houston resume. A tool that resume does not name is a customer or partner story inside that real work.",
    "Do not claim employment, a title, or a role the Houston resume does not show.",
    problems.length ? `Fix these problems: ${problems.join("; ")}.` : "",
  ].filter(Boolean).join(" ")
}

export async function applyPersonalityFilter(input: {
  level: string
  question: string
  text: string
  regenerate?: (instruction: string) => Promise<string>
}): Promise<{ text: string; rewritten: boolean; reasons: string[]; assessment: Assessment }> {
  const level = asLevel(input.level)
  const question = String(input.question || "")
  const reasons: string[] = []
  let text = cleanDraft(input.text, level)
  let assessment = assessAnswer(question, level, text)
  if (!assessment.ok && input.regenerate) {
    reasons.push("regenerated")
    try {
      text = cleanDraft(await input.regenerate(rewriteInstruction(assessment)), level)
      assessment = assessAnswer(question, level, text)
    } catch {
      reasons.push("regenerate-failed")
    }
  }
  if (!assessment.ok) {
    reasons.push("fallback")
    text = composeLevelAnswer(level, question, cleanDraft(input.text, level))
    assessment = assessAnswer(question, level, text)
  }
  const rewritten = reasons.length > 0 || text.replace(/\s+/g, " ").trim() !== String(input.text || "").replace(/\s+/g, " ").trim()
  return { text, rewritten, reasons, assessment }
}

export function modelKeyUsable(value: string | undefined): boolean {
  const key = String(value || "").trim()
  if (key.length < 20) return false
  if (/placeholder|example|changeme|your[_-]?key|sk-or-placeholder|sk-ant-placeholder/i.test(key)) return false
  return true
}

export type MatrixRow = EvalCase & { level: PersonalityLevel; text: string; assessment: Assessment }

export function evaluateFallbackMatrix(): MatrixRow[] {
  const rows: MatrixRow[] = []
  for (const item of EVAL_CASES) {
    for (const level of PERSONALITY_LEVELS) {
      const text = fallbackAnswer(level, item.question)
      rows.push({ ...item, level, text, assessment: assessAnswer(item.question, level, text) })
    }
  }
  return rows
}
