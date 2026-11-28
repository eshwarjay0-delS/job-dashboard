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
  // A spoken "explain how X works", "tell me how", or a two-part ask is a full answer at every level, never a 40-160 word fact.
  // "Can you explain to me how Sentinel works?" is eight words and was getting the quick band in production (28 Nov 2026).
  if ((t.match(/\?/g) || []).length >= 2) return false
  if (/\b(?:explain|describe|tell me|talk me through|walk through|day[- ]?to[- ]?day|experience|how (?:does|do|did|is|are|would|will|can)\b[^?]{0,60}\b(?:works?|looks?|runs?|handle|set up|configure|investigate|detect))\b/i.test(t)) return false
  // "Do you know about SQL injection?" asks for the explanation, not a yes: S7 showed the 5-word "I know about SQL injection."
  if (/\b(?:do|did) you know (?:about|what|how)\b|\bwhat do you know about\b|\bat what (?:instant|point|stage|time)\b|\bwhen (?:do|would|will) you escalate\b/i.test(t)) return false
  if (/\b(?:cyberark|splunk|sentinel|sailpoint|fortify|qualys|crowdstrike|owasp)\b/i.test(t) && !/\b(?:what does|stands? for)\b/i.test(t)) return false
  if (/\b(?:what does|stands? for|yes or no|what is a |what is an )\b/i.test(t) && t.split(/\s+/).length < 16) return true
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

export const BANNED_HEDGE = /can(?:'|’)?t (?:accurately |honestly )?(?:name|point to|give|recall)|cannot (?:accurately |honestly )?(?:name|point to|give|recall)|can(?:'|’)?t accurately name|personally remediated|do not have a specific|don(?:'|’)t have a specific|not able to name|unable to name|i(?:'ve| have) had less direct hands-on|less direct hands-on|less experience|not directly, but|not directly measured|transfers because|i haven(?:'|’)t used|i haven(?:'|’)t worked|i don(?:'|’)t have my resume|i would want to confirm that|i can(?:'|’)t claim|i can(?:'|’)t point to|i will not invent|i won(?:'|’)t invent|i do not have a matching line|details aren(?:'|’)t in my work history|not in my work history|i(?:'|’)m not going to (?:invent|make up)|i will not make (?:it |that )?up|that (?:detail|part) is not on my resume|the resume does not (?:name|show)|so i will not invent/i

const RESUME_CATALOG = /i handle cybersecurity operations for the bank\b[^.]{0,600}\./i

export const INTRO_HEADLINE = "Your introduction"


export const CANNED_FILLER = /in plain terms, the reason i work it this way|what that means is i start from the need|i translate the specialist word|the way i would build it starts from the job the system|i own the decision, and i say it in words anyone|the outcome i am responsible for is that the work keeps moving|i do not walk the build|i say what i chose|the point is the result, said once|i don't have my resume loaded|i(?:'ve| have) had less direct hands-on|less direct hands-on|less experience|not directly, but|transfers because|i haven(?:'|’)t used|i haven(?:'|’)t worked|i don(?:'|’)t have my resume|i would want to confirm that/i

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

/** Padding the model writes to reach a word count: opinions, summaries, and self-praise. 10-fold test, 28 Nov 2026. */
export const GENERIC_FILLER = /^(?:overall|in conclusion|in summary|ultimately|to sum up|in short)\b|stay(?:ing)? (?:up[- ]to[- ]date|ahead of (?:the )?(?:evolving|emerging|latest))|confident in my ability|valuable asset|i am excited to|i'm excited to|as a cybersecurity (?:professional|engineer), i believe|i (?:will|would) highly recommend|my experience with [\w ]+ has been (?:very |extremely )?positive|in today's (?:threat|evolving|digital) landscape|\bi handle cybersecurity operations\b/i

/** Spoken prose: inline dashes and bullets become plain sentences, and "I believe that" becomes the statement itself. */
export function speakable(text: string): string {
  return String(text || "")
    .replace(/(^|[\s.!?])[-•▪*]\s+(?=[A-Za-z])/g, "$1 ")
    .replace(/\b(?:Moreover|Furthermore|Additionally),\s+I believe(?: that)?\s+(\w)/g, (_m, c: string) => c.toUpperCase())
    .replace(/(^|[.!?]\s+)I (?:strongly )?believe(?: that)?\s+(\w)/g, (_m, lead: string, c: string) => `${lead}${c.toUpperCase()}`)
    .replace(/,\s*I believe,?\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Role/Category drills speak as lived experience: "I would check" becomes "I check", "My approach would be" becomes "My approach is". */
export function confidentVoice(text: string): string {
  return String(text || "")
    .replace(/\b(My|Our) (approach|first step|priority|process) would be\b/g, "$1 $2 is")
    .replace(/\bI would (?!like\b|want\b|say\b|have\b|not\b|never\b|rather\b)(\w+)/g, "I $1")
    .replace(/\bI(?:'d| might| could) (?:then )?(check|look|review|pull|open|search|start|escalate|assign|confirm|verify|correlate|run|use|analy[sz]e|investigate)\b/g, "I $1")
}

/** A certification line only when the question asks about certifications. */
export function dropUnaskedCerts(text: string, question: string): string {
  if (/certif|cissp|credential/i.test(String(question || ""))) return text
  return String(text || "").split(/(?<=[.!?])\s+/).filter((s) => !/\b(?:CISSP|Azure Security Engineer Associate)\b/.test(s)).join(" ").trim()
}

/** Drop canned filler, resume catalogues, refusals, and repeated sentences. A short answer stays short until expandToBand. */
export function fitLevelAnswer(text: string, contract: LevelContract): string {
  const kept: string[] = []
  const seen = new Set<string>()
  const openings = new Set<string>()
  for (const sentence of speakable(String(text || "").replace(RESUME_CATALOG, " ")).split(/(?<=[.!?])\s+/)) {
    const key = sentenceKey(sentence)
    const open = openingWords(sentence)
    const near = kept.some((prev) => {
      const prevWords = sentenceKey(prev).split(" ").filter((w) => w.length > 3)
      const nowWords = key.split(" ").filter((w) => w.length > 3)
      if (prevWords.length < 4 || nowWords.length < 4) return false
      const prevSet = new Set(prevWords)
      const shared = nowWords.filter((w) => prevSet.has(w)).length
      return shared / nowWords.length >= 0.85
    })
    if (!key || /^having\b/i.test(sentence) || /^example:\s/i.test(sentence) || CANNED_FILLER.test(sentence) || GENERIC_FILLER.test(sentence) || BANNED_HEDGE.test(sentence) || RESUME_CATALOG.test(sentence) || /\bpages once\b|\bstory\s+\d+\s*:|\bonly when the question needs\b|\bby\s*%|\bprotects typed privileged accounts\b/i.test(sentence) || seen.has(key) || near || (open.split(" ").length >= 6 && openings.has(open))) continue
    seen.add(key)
    if (open.split(" ").length >= 6) openings.add(open)
    kept.push(sentence)
  }
  if (kept.length > 1) {
    const first = sentenceKey(kept[0])
    const last = sentenceKey(kept[kept.length - 1])
    if (last && last === first) kept.pop()
  }
  let out = kept.join(" ").replace(/\bSenior I Engineer\b/gi, "Senior Cybersecurity Engineer").replace(/\bI Engineer at\b/g, "Cybersecurity Engineer at").replace(/\s+/g, " ").trim()
  if (contract.level === "director") out = out.replace(JARGON_LIST, "the tools").replace(/\s+/g, " ").trim()
  if (contract.level !== "architect" && wordCount(out) > contract.max) out = trimWords(out, contract.max)
  return out
}

export function repairIntroHeadline(question: string, text: string): string {
  if (!/tell me about yourself|introduce yourself|your introduction|brief introduction|walk (?:me|us) through your (?:background|career|resume)/i.test(question)) return text
  return String(text || "")
    .replace(/Press Start — answers appear here\\.?/gi, "")
    .replace(/\\bSenior I Engineer\\b/gi, "Senior Cybersecurity Engineer")
    .replace(/\\bSanG\\s+Diego\\b/g, "San Diego")
    .replace(/\\bCity of I Diego\\b/g, "the City of San Diego")
    .replace(/\\s+/g, " ")
    .trim()
}

/**
 * Bring a short answer closer to the band with distinct first-person story beats, each used once.
 * 10-fold test, 28 Nov 2026: the old loop re-told every beat as "On pass 2 of the same case I add one more check...",
 * which read as a stuck record. A beat is never repeated; the model continuation is what reaches the band.
 */
/**
 * Fill toward the band only from the Role/Category pack, and only with pack sentences that share a word with the question.
 * Never a fixed stock block: production S7 (3362f20) showed the same ~180-word Citi/CVS paragraph ending
 * a stock closing line about the search paging once on 33 of 37 typed answers whenever the continuation call did not run.
 * With no pack, a short answer stays short rather than padded with unrelated sentences.
 */
function claimIsOnResume(line: string, resume: string, question: string, pack = "", metrics = false): boolean {
  const source = `${resume}\n${question}\n${metrics ? pack : ""}`.toLowerCase()
  if (!String(resume || "").trim() && !metrics) return false
  const places = line.match(/\b(?:at|with)\s+([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,3})/g) || []
  for (const raw of places) {
    const name = raw.replace(/^(?:at|with)\s+/i, "").trim()
    if (name.length > 2 && !source.includes(name.toLowerCase())) return false
  }
  const nums = line.match(/\b\d+(?:\.\d+)?%?/g) || []
  if (!metrics && nums.some((n) => !source.includes(n.toLowerCase()))) return false
  const skip = new Set("At The This That When Then After Before Citi Bank CVS Health City San Diego Charter Communications Accenture".split(" "))
  const tools = line.match(/\b[A-Z][A-Za-z0-9+]{3,}(?:\s+[A-Z][A-Za-z0-9+]{3,})?/g) || []
  for (const tool of tools) {
    if (tool.split(" ").every((part) => skip.has(part))) continue
    if (!source.includes(tool.toLowerCase())) return false
  }
  return true
}

const PACK_SCAFFOLD = /\b(?:story\s+\d+\s*:|tools\s*:|playbook\s*:|checklist\s*:|probe\s+\d+\s*:|must mention\s*:|pack drill|only when the question needs|never answer with this line|do not pretend|expand it into|pick the one that fits|pages once|protects typed privileged accounts|by\s+%|the tools i use are)\b/i

/** A pack line the candidate can say. Labels, instructions, and empty metrics stay out. */
export function spokenPackSentence(line: string): string {
  let s = String(line || "")
    .replace(/^(?:[-•*]\s*)?(?:story\s+\d+|tools|playbook|metrics|checklist|probe\s+\d+|must mention|avoid|frame|director view|subject|citi story|cvs story)\s*:\s*/i, "")
    .replace(/\bmetrics\s*(?:i report)?\s*:\s*/gi, "")
    .replace(/\bby\s+\d+(?:\.\d+)?\s*%/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*%/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (!s || PACK_SCAFFOLD.test(s) || !/\b(?:I|we|my|our)\b/.test(s)) return ""
  if (s.split(/\s+/).length < 8) return ""
  if (!/[.!?]$/.test(s)) s += "."
  return s
}

export function expandToBand(text: string, contract: LevelContract, source = "", question = "", resume = "", failure = false): string {
  if (contract.quick || !String(source || "").trim()) return text
  const goal = Math.min(contract.max, Math.max(contract.min, Math.round(contract.min * 1.1)))
  if (wordCount(text) >= goal) return text
  const qWords = new Set(String(question || "").toLowerCase().match(/[a-z][a-z0-9+#-]{3,}/g) || [])
  const have = new Set(String(text || "").split(/(?<=[.!?])\s+/).map(sentenceKey))
  const kept = [String(text || "").trim()].filter(Boolean)
  const lines = String(source || "")
    .replace(/^[ \t]*(?:[A-Z][A-Za-z /&-]{1,40}):[ \t]*/gm, "")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((x) => spokenPackSentence(x))
    .filter(Boolean)
  const take = (line: string, needOverlap: boolean) => {
    if (wordCount(kept.join(" ")) >= goal) return
    const key = sentenceKey(line)
    if (have.has(key) || !claimIsOnResume(line, resume, question, source, failure)) return
    const words = line.toLowerCase().match(/[a-z][a-z0-9+#-]{3,}/g) || []
    if (needOverlap && qWords.size && !words.some((w) => qWords.has(w))) return
    have.add(key)
    kept.push(line)
  }
  for (const line of lines) take(line, true)
  if (failure) for (const line of lines) take(line, false)
  const out = kept.join(" ").replace(/\s+/g, " ").trim()
  return wordCount(out) > contract.max ? trimWords(out, contract.max) : out
}
