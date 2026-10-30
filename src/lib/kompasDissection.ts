/**
 * Question dissection for Kompas.
 * The interviewer’s words choose the shape, the keywords, and the terms that
 * must not appear. The selected mode chooses length, depth, and confidence.
 * This module does not call a model.
 */
import { interviewIntent, type ReplyIntent } from "./kompasRelevance.ts"
import type { AnswerLevel } from "./kompasAnswer.ts"
import { repairDictation } from "./kompasDictation.ts"

export type AnswerShape =
  | "intro"
  | "personal-experience"
  | "comparison"
  | "scenario"
  | "technical-deep-dive"
  | "logistics"
  | "follow-up"
  | "closing"
  | "definition"
  | "direct"
  | "acknowledgement"
  | "value"

export type ModeBand = {
  minWords: number
  targetWords: number
  maxWords: number
  /** What the prompt asks for. Below the ceiling by a per-mode share, so real answers land 50% apart, not only their ceilings. */
  aimWords: number
  depth: number
  confidence: number
  voice: string
}

export type QuestionDissection = {
  ask: string
  intent: ReplyIntent
  shape: AnswerShape
  keywords: string[]
  banned: string[]
  depthAsked: boolean
  modes: Record<AnswerLevel, ModeBand>
}

const LEVELS: AnswerLevel[] = ["engineer", "architect", "director"]

const STOP = new Set(
  "about after again also and are because been before being between both can could does doing from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours tell describe explain give walk share please should has you the for how why did was were our any who its want need make made know mean means work works time example situation question questions role team company yourself myself something anything everything would could should have does did are was were this that with from into about across during using used use tell walk give show name list talk think really very also once ever never always still already here there where when what which who whom whose why how brief briefly quick short keep suitable define state now same deeper first going interviewer simple simply plain words".split(/\s+/),
)

const PHRASES = [
  "residual risk", "least privilege", "policy deviation", "policy exception", "compensating control",
  "root cause", "business impact", "privileged access", "service now", "multi factor",
  // Round 8: "explain the start method" is repaired to the STAR method, but the keywords split it into star|method.
  "star method",
]

type Jargon = { term: string; family: string; product?: boolean }

const JARGON: Jargon[] = [
  // Round 11 (29 Oct 2026): buzzwords a model adds to sound current; said only when asked or on the resume.
  ...["CNAPP", "CSPM", "XDR", "SOAR", "SASE", "SBOM", "eBPF", "service mesh", "Monte Carlo", "Bayesian network", "UEBA", "microsegmentation", "DevSecOps", "GitOps", "policy-as-code"]
    .map((term) => ({ term, family: "buzz" })),
  ...["ServiceNow", "Archer", "OneTrust"].map((term) => ({ term, family: "grc-tool", product: true })),
  { term: "Kerberoasting", family: "attack" },
  { term: "DCSync", family: "attack" },
  { term: "Golden Ticket", family: "attack" },
  { term: "AS-REP roasting", family: "attack" },
  { term: "pass-the-hash", family: "attack" },
  { term: "LSASS", family: "attack" },
  { term: "reverse shell", family: "attack" },
  { term: "Mimikatz", family: "attack", product: true },
  { term: "Cobalt Strike", family: "attack", product: true },
  { term: "BloodHound", family: "attack", product: true },
  { term: "SQL injection", family: "vuln" },
  { term: "cross-site scripting", family: "vuln" },
  { term: "XSS", family: "vuln" },
  { term: "Kubernetes", family: "cloud", product: true },
  { term: "Terraform", family: "cloud", product: true },
  { term: "Kafka", family: "cloud", product: true },
  { term: "service mesh", family: "cloud" },
  { term: "Splunk", family: "detect", product: true },
  { term: "Sentinel", family: "detect", product: true },
  { term: "CrowdStrike", family: "detect", product: true },
  { term: "CyberArk", family: "identity", product: true },
  { term: "Qualys", family: "vuln", product: true },
  { term: "Burp Suite", family: "vuln", product: true },
  { term: "YARA", family: "detect" },
  { term: "SAML", family: "identity" },
  { term: "OAuth", family: "identity" },
  { term: "OIDC", family: "identity" },
  { term: "JWT", family: "identity" },
  { term: "Kerberos", family: "identity" },
  { term: "NIST", family: "gov" },
  { term: "ISO 27001", family: "gov" },
  { term: "SOC 2", family: "gov" },
]

// Plain instructions only. The v1 wording ("I would not open a build walk", "One because is enough") was written to
// hit the depth and confidence word counters, and a model copies odd phrasing into the spoken answer.
const VOICE: Record<AnswerLevel, string> = {
  engineer: "Plain and accessible, for technical HR or an engineer screen. Say what it is, why the role needs it, and one example from my own work. Then stop.",
  director: "Decision first, then the business risk and who owns it. At most one sentence on how it works. No build walkthrough.",
  architect: "Precise. Say how it works, where it breaks, and what contains it. Use only the technical terms the question or my resume already uses.",
}

/** Targets are the ceilings. Verbose answers trim to these, so the three modes land at least 50% apart. */
const TARGETS: Record<AnswerShape, Record<AnswerLevel, number>> = {
  logistics: { engineer: 16, director: 24, architect: 36 },
  acknowledgement: { engineer: 18, director: 28, architect: 42 },
  closing: { engineer: 24, director: 36, architect: 54 },
  "follow-up": { engineer: 32, director: 48, architect: 72 },
  definition: { engineer: 40, director: 60, architect: 90 },
  direct: { engineer: 44, director: 66, architect: 99 },
  comparison: { engineer: 46, director: 70, architect: 105 },
  value: { engineer: 52, director: 78, architect: 117 },
  scenario: { engineer: 64, director: 96, architect: 144 },
  "technical-deep-dive": { engineer: 96, director: 144, architect: 216 },
  intro: { engineer: 90, director: 135, architect: 204 },
  "personal-experience": { engineer: 110, director: 165, architect: 248 },
}

const AIM: Record<AnswerLevel, number> = { engineer: 0.75, director: 0.9, architect: 0.95 }
const DEPTH: Record<AnswerLevel, number> = { engineer: 0.4, director: 0.22, architect: 0.72 }
const CONFIDENCE: Record<AnswerLevel, number> = { engineer: 0.3, director: 0.84, architect: 0.48 }

function band(target: number, level: AnswerLevel): ModeBand {
  return {
    minWords: Math.max(8, Math.round(target * 0.4)),
    targetWords: target,
    maxWords: target,
    aimWords: Math.round(target * AIM[level]),
    depth: DEPTH[level],
    confidence: CONFIDENCE[level],
    voice: VOICE[level],
  }
}

export function modeBand(shape: AnswerShape, level: AnswerLevel, scale = 1): ModeBand {
  const table = TARGETS[shape] || TARGETS.direct
  return band(Math.round((table[level] || table.engineer) * scale), level)
}

/** One scale for all three modes, so the 50% gaps between them hold for a long multi-part ask too. */
export function modesFor(shape: AnswerShape, scale = 1): Record<AnswerLevel, ModeBand> {
  return {
    engineer: modeBand(shape, "engineer", scale),
    architect: modeBand(shape, "architect", scale),
    director: modeBand(shape, "director", scale),
  }
}

/**
 * How many separate things the interviewer listed. "Explain trust boundaries, data flow, failure isolation,
 * rollout and validation" is five. Each one needs a sentence, so a five-part ask gets a longer ceiling than a
 * one-part ask of the same shape (measured: hitachi-grc-5 named three parts and had a 70-word Director ceiling).
 */
export function askedParts(question: string): number {
  const topic = topicOfAsk(question)
  let total = 0
  for (const clause of topic.split(/[.?!;]\s+/).filter((c) => c.trim().split(/\s+/).length >= 3)) {
    const commas = (clause.match(/,/g) || []).length
    total += commas >= 1 ? commas + (/\band\b/i.test(clause.split(",").pop() || "") ? 2 : 1) : 1
  }
  return Math.max(1, total)
}

export function partsScale(question: string): number {
  const parts = askedParts(question)
  return parts >= 3 ? Math.min(1.3, 1 + 0.1 * (parts - 2)) : 1
}

export function relativeGap(a: number, b: number): number {
  const floor = Math.min(Math.abs(a), Math.abs(b))
  if (floor === 0) return a === b ? 0 : Infinity
  return Math.abs(a - b) / floor
}

export function modesFiftyApart(shape: AnswerShape): boolean {
  const modes = modesFor(shape)
  for (let i = 0; i < LEVELS.length; i++) {
    for (let j = i + 1; j < LEVELS.length; j++) {
      const a = modes[LEVELS[i]]
      const b = modes[LEVELS[j]]
      if (relativeGap(a.targetWords, b.targetWords) < 0.5) return false
      if (relativeGap(a.depth, b.depth) < 0.5) return false
      if (relativeGap(a.confidence, b.confidence) < 0.5) return false
    }
  }
  return true
}

export function wordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function sentencesOf(text: string): string[] {
  return String(text || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

export function firstSentence(text: string): string {
  return sentencesOf(text)[0] || ""
}

/**
 * Cut at the ceiling on a sentence boundary. A sentence that `mustKeep` marks (a repaired rejected alternative,
 * a numbered hypothesis, the decision owner) is kept even past the ceiling and the plain sentences around it give
 * way first, so the cut never undoes a repair the answer was just given.
 */
export function trimToWords(text: string, maxWords: number, mustKeep?: (sentence: string) => boolean): string {
  const cap = Math.max(1, maxWords)
  const all = sentencesOf(text)
  const pinned = new Set<number>()
  if (mustKeep) all.forEach((sentence, i) => { if (i > 0 && mustKeep(sentence)) pinned.add(i) })
  let budget = cap - [...pinned].reduce((sum, i) => sum + wordCount(all[i]), 0)
  const keep = new Set<number>(pinned)
  let full = false
  for (let i = 0; i < all.length; i++) {
    if (pinned.has(i)) continue
    const n = wordCount(all[i])
    if (full || (i > 0 && n > budget)) { full = true; continue }
    keep.add(i)
    budget -= n
  }
  const kept = all.filter((_, i) => keep.has(i))
  let out = kept.join(" ")
  if (pinned.size) return out.trim()
  if (wordCount(out) > cap) {
    out = out.split(/\s+/).slice(0, cap).join(" ").replace(/[,:;]+$/, "")
    if (!/[.!?]$/.test(out)) out += "."
  }
  return out.trim()
}

function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text)
}

/**
 * The topic part of the ask. Audience and format instructions ("Keep it suitable for technical HR",
 * "explain it to a director", "in two minutes") steer the mode, not the topic, so they are not keywords.
 */
export function topicOfAsk(question: string): string {
  // Stress round 2 (29 Oct 2026): "Since you led the SOC at a large bank, how big was your team?" made the premise the
  // keywords, so the prompt told the model to open on "led, SOC, large bank" - a premise the resume may not support.
  // A leading since/given/as clause before the actual question is context, not topic. Failsafe: nothing left keeps all.
  const raw = String(question || "")
  const premise = raw.match(/^\s*(?:since|given(?: that)?|as|because|now that)\s+(?:you|your)\b[^,?]{3,120},\s*((?:how|what|why|when|where|which|who|can|could|would|do|did|have|tell|walk|describe)\b[\s\S]+)$/i)
  let asked = premise && premise[1].trim().split(/\s+/).length >= 3 ? premise[1] : raw
  // Round 11 (29 Oct 2026): a jargon-stuffed setup ("With zero trust, SASE and all that, how do you…", "…, you know, with
  // all the SOAR and CNAPP stuff these days?") was read as the topic, so answers opened on and repeated the buzzwords.
  // Failsafe: the ask left must be 3+ words, or the whole question is kept.
  const setup = asked.match(/^\s*(?:so,?\s+)?(?:with|given|considering|thinking about|in a world of|in light of|what with)\s+[^?]{3,200}?,\s*((?:how|what|why|when|where|which|who|can|could|would|do|did|tell|walk|describe)\b[^,]*[\s\S]*)$/i)
  if (setup && setup[1].trim().split(/\s+/).length >= 3 && !/^(?:with|given)\s+(?:the|a|an)?\s*(?:time|example)\b/i.test(asked)) asked = setup[1]
  const tail = asked.replace(/,\s*(?:you know,?\s*)?(?:with|and) all (?:the|that|this|those)\b[^?.!]*(?=[?.!]?\s*$)/i, "")
  if (tail.trim().split(/\s+/).length >= 3) asked = tail
  return asked
    .replace(/\b(?:keep|make) it (?:suitable|simple|short|brief|plain)[^.?!]*[.?!]?/gi, " ")
    .replace(/\b(?:for|to) (?:a |an |the )?(?:technical hr|non-technical|recruiter|director|executive|cfo|ceo|business audience|hiring manager|engineer|architect|developer|new analyst|junior analyst)\b/gi, " ")
    .replace(/\bin (?:one|two|three|\d+) (?:minutes?|sentences?|lines?)\b/gi, " ")
    .replace(/\bwithout inventing achieved numbers\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Idea D (stress round 3, 29 Oct 2026): a follow-up is tied to the previous question in code as
 * `ask — following up on: "previous"?`. The tag is ours, not the interviewer's: the follow-up's own words lead and the
 * previous question only adds topic, so "following" was never a keyword and the intent was not read off the old ask.
 */
const FOLLOW_UP_TAG = /\s+—\s+following up on:\s+"([^"]*)"\??\s*$/
export function splitFollowUp(question: string): { own: string; previous: string } {
  const text = String(question || "")
  const m = text.match(FOLLOW_UP_TAG)
  if (!m) return { own: text, previous: "" }
  const own = text.slice(0, m.index).trim()
  // Failsafe: an empty follow-up part (never expected) keeps the whole text, so the ask is never lost.
  return own ? { own: /[?.!]$/.test(own) ? own : `${own}?`, previous: m[1].trim() } : { own: text, previous: "" }
}

export function questionKeywords(question: string): string[] {
  const tied = splitFollowUp(question)
  if (tied.previous) return [...new Set([...questionKeywords(tied.own), ...questionKeywords(tied.previous)])].slice(0, 8)
  const raw = topicOfAsk(question)
  const lower = raw.toLowerCase()
  const found: string[] = []
  // Round 4: "When would you not accept residual risk?" had the same keywords as its opposite. The negated verb leads.
  const negated = lower.match(/\b(?:not|never|n't)\s+(?:\w+ly\s+)?([a-z]{4,})\b/)
  if (negated && !STOP.has(negated[1])) found.push(`not ${negated[1]}`)
  for (const phrase of PHRASES) if (lower.includes(phrase)) found.push(phrase)
  for (const match of raw.matchAll(/\b[A-Z][A-Z0-9]{1,6}\b/g)) found.push(match[0])
  for (const rawToken of lower.replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/)) {
    const token = rawToken.replace(/^[.\-]+|[.\-]+$/g, "")
    if (token.length < 4 || STOP.has(token) || /^\d+$/.test(token)) continue
    if (found.some((item) => item.toLowerCase().includes(token))) continue
    found.push(token)
  }
  return [...new Set(found)].slice(0, 8)
}

function shapeFromIntent(intent: ReplyIntent): AnswerShape {
  switch (intent) {
    case "introduction": return "intro"
    case "experience-story": return "personal-experience"
    case "comparison": return "comparison"
    case "scenario": return "scenario"
    case "technical-process": return "technical-deep-dive"
    case "logistics": return "logistics"
    case "follow-up": return "follow-up"
    case "closing-question": return "closing"
    case "definition": return "definition"
    case "acknowledgement": return "acknowledgement"
    case "value": return "value"
    default: return "direct"
  }
}

function depthAsked(question: string, shape: AnswerShape): boolean {
  return shape === "technical-deep-dive" || /\b(step by step|under the hood|in detail|deep dive|go deeper|deeper on|walk (?:me )?through|how does|how do)\b/i.test(question)
}

export function bannedTerms(question: string, sources: string, shape: AnswerShape): string[] {
  // Round 11: jargon in a context preamble ("With SOAR, XDR and CNAPP, how do you…") is not asked; only the ask counts.
  const hay = `${topicOfAsk(question)}\n${sources}`
  const deep = depthAsked(question, shape)
  const families = new Set(JARGON.filter((item) => containsTerm(hay, item.term)).map((item) => item.family))
  return JARGON.filter((item) => {
    if (containsTerm(hay, item.term)) return false
    if (item.product) return true
    if (deep && families.has(item.family)) return false
    return true
  }).map((item) => item.term)
}

/**
 * Stress round 2 (29 Oct 2026): speech fillers decided the cut. "Tell me about uh yourself" was not an intro, and
 * "the uh resid jewel risk thing" made "thing" a keyword. Fillers, doubled words and a trailing "thing" go before the
 * intent and keywords are read; the ask itself is returned as heard.
 */
export function cleanSpokenAsk(question: string): string {
  // Round 6: a typed or derived ask gets the same garble repair as heard speech ("resid jewel risk" is residual risk).
  const out = repairDictation(String(question || ""))
    .replace(/\b(?:um+|uh+|erm+|er|hmm+)\b[,.]?/gi, " ")
    .replace(/(?<!\b(?:do|did|does|would|as|if|what|how|where|don't|didn't)\s)\b(?:you know|i mean)\b,?/gi, " ")
    .replace(/(?<!\b(?:what|which|the|this|that|any|some|a|one)\s)\b(?:sort of|kind of)\b,?/gi, " ")
    .replace(/(^|[\s,])like,?(?=\s+(?:what|how|why|the|a|an|inherent|residual|\w+ing)\b)/gi, "$1")
    // Round 8/10: "how do you like, scope", and a restarted phrase ("what would you, what would you do", "how do you, how do you").
    .replace(/\b(you|we|i)\s+like,\s+/gi, "$1 ")
    .replace(/,\s*like,\s*/gi, ", ").replace(/\band,\s+like,?\s+/gi, "and ")
    .replace(/\b((?:\w+\s+){1,3}\w+),?\s+\1\b/gi, "$1")
    .replace(/^\s*(?:so|okay so|ok so|alright so|well)[,\s]+/i, "")
    // Round 10: a spoken setup before the ask ("the thing is, how do you prove…") made "thing" a keyword.
    .replace(/^\s*(?:(?:so|okay|ok|and)[,\s]+)*(?:the thing is|here'?s the thing|the question is|my question is|what i want to know is|i guess)[,:\s]+(?=\S)/i, "")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/\s+(?:thing|stuff)(?=\s*[?.!]*\s*$)/i, "")
    .replace(/\s+([?.!,])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  // Failsafe: an ask that is only filler keeps its words, so nothing is lost.
  return out || String(question || "").trim()
}

export function dissectQuestion(question: string, sources = ""): QuestionDissection {
  const ask = String(question || "").replace(/\s+/g, " ").trim()
  const tied = splitFollowUp(cleanSpokenAsk(ask))
  const own = interviewIntent(tied.own)
  // A tied follow-up keeps its own intent when it has one; a generic one ("what would you monitor?") is a follow-up.
  const intent: ReplyIntent = tied.previous && (own === "direct" || own === "acknowledgement") ? "follow-up" : own
  let shape = shapeFromIntent(intent)
  // "Go deeper on that failure" was a direct answer with a 99-word Architect ceiling. Asked depth wins over a
  // generic shape; it never turns an intro, a story, or a logistics ask into a deep dive.
  if ((shape === "direct" || shape === "follow-up") && depthAsked(ask, shape)) shape = "technical-deep-dive"
  return {
    ask,
    intent,
    shape,
    keywords: questionKeywords(cleanSpokenAsk(ask)),
    // Round 6: "what's the cooper netties control plane" asked about Kubernetes; the repaired ask decides what is grounded.
    banned: bannedTerms(repairDictation(ask), sources, shape),
    depthAsked: depthAsked(ask, shape),
    modes: modesFor(shape, partsScale(ask)),
  }
}

// Same trigger the service uses for its coding block (CODE_ASK_Q), narrowed to an actual request for code so a
// question that only mentions "function" in passing is not forced into a code block.
const CODE_REQUEST_Q = /\b(?:write|implement|code up|show me the code|give me (?:the )?code)\b[^?]*\b(?:code|function|script|query|program|class|regex|algorithm|endpoint|test)\b|\b(?:sql query|regex (?:to|for)|unit test for)\b/i
export function asksForCode(question: string): boolean {
  const tied = splitFollowUp(question)
  // "Can you also add unit tests?" after a coding ask is still a coding ask; any other follow-up is judged on its own words.
  if (tied.previous) return CODE_REQUEST_Q.test(tied.own) || (CODE_REQUEST_Q.test(tied.previous) && /\b(?:tests?|code|function|index|query|edge cases?|complexity|handle|refactor)\b/i.test(tied.own))
  return CODE_REQUEST_Q.test(String(question || ""))
}

export function dissectionPrompt(question: string, level: AnswerLevel, sources = ""): string {
  const cut = dissectQuestion(question, sources)
  const mode = cut.modes[level] || cut.modes.engineer
  const echo = cut.keywords.slice(0, 4).join(", ")
  const ban = cut.banned.slice(0, 20).join(", ")
  return [
    `QUESTION DISSECTION. Shape: ${cut.shape}. Intent: ${cut.intent}.`,
    echo ? `The first sentence must use the interviewer's own words: ${echo}.` : "The first sentence answers the ask in the interviewer's own terms.",
    asksForCode(question)
      ? `Mode ${level}. Code first at every level: one fenced, runnable block in the language asked for, before any words. After the block, at most ${mode.aimWords} spoken words. ${mode.voice}`
      : `Mode ${level}. Aim for about ${mode.aimWords} words and never more than ${mode.maxWords}. Stop as soon as the question is answered. ${mode.voice}`,
    ban ? `Banned unless the question already used them: ${ban}.` : "",
    "Do not reuse the previous answer. Do not add a second topic.",
  ].filter(Boolean).join("\n")
}

const PROVIDER_ERROR = /\bopenrouter\b|\btry again in\s+\d|\btokens per minute\b|\bOPENROUTER_[A-Z0-9_]+\b|\banswer engine is at its limit\b|\bpaid provider is temporarily\b|\bpaid answer service returned\b/i

// Stress round 3 (29 Oct 2026): nine of ten raw provider or gateway failures ("Error: Request failed with status code 429",
// "502 Bad Gateway", a JSON error body, "model is overloaded", a context-length refusal, a model refusal) were not
// recognised, so settle would have shown them as the answer. These shapes only count when the text IS the failure:
// short, or opening with it. A real answer that mentions a 502 or rate limiting while explaining a design is kept.
const PROVIDER_FAILURE_SHAPE = [
  /^\s*\{\s*"error"\s*:/i,
  /^\s*(?:error\b|request failed\b)/i,
  /\bstatus code (?:4\d\d|5\d\d)\b/i,
  /^\s*(?:4\d\d|5\d\d)\s+(?:bad gateway|gateway time-?out|service unavailable|internal server error|too many requests|payment required)\b/i,
  /^\s*(?:internal server error|bad gateway|service unavailable|gateway time-?out|too many requests)[.!]?\s*$/i,
  /\bupstream connect error\b|\bdisconnect\/reset before headers\b/i,
  /\brate limit (?:exceeded|reached)\b|\bplease retry later\b/i,
  /\binsufficient (?:credits|quota|balance)\b|\bquota exceeded\b/i,
  /\b(?:model|server) is (?:currently )?overloaded\b/i,
  /\bmaximum context length\b|\bcontext[_ ]length[_ ]exceeded\b/i,
  /^\s*(?:i'm sorry|i am sorry|sorry),? (?:but )?i (?:can't|cannot|am unable to|won't) (?:help|assist|comply|answer)\b/i,
  /^\s*as an ai(?: language model)?\b/i,
  // Round 5: client or gateway timeouts.
  /^\s*(?:the )?(?:request|connection|upstream) timed out\b|\btimed out after \d+\s*ms\b|\bE(?:TIMEDOUT|CONNRESET|CONNREFUSED)\b/i,
  // Round 6: "HTTP 503 Service Unavailable" and "The upstream request timed out." were shown as answers.
  /^\s*HTTP(?:\/[\d.]+)?\s+[45]\d\d(?:\s+[A-Za-z' ]{0,40})?[.!]?\s*$/i,
  /^\s*(?:the )?(?:upstream|gateway|server|api) (?:request|connection|call) timed out\b/i,
  // Round 8: SDK exception lines ("openai.APIConnectionError: Connection error.", "anthropic.InternalServerError:
  // overloaded_error") were shown as answers. Only when the text opens with the exception class.
  /^\s*(?:[a-z_]+\.)*(?:API\w*|InternalServer|RateLimit|ServiceUnavailable|Overloaded|Authentication|PermissionDenied|BadRequest|NotFound|UnprocessableEntity|Conflict)Error\b\s*:?/,
  /\boverloaded_error\b|\brate_limit_error\b|\bapi_error\b/i,
  // Round 10: dotted module path + exception class + colon ("httpx.ReadTimeout: timed out",
  // "google.api_core.exceptions.ServiceUnavailable: 503").
  /^\s*(?:[a-z_][a-z0-9_]*\.)+[A-Z]\w*(?:Error|Exception|Timeout|Unavailable|Overloaded)\s*:/,
]
export function isProviderErrorAnswer(text: string): boolean {
  const t = String(text || "")
  if (PROVIDER_ERROR.test(t)) return true
  const short = wordCount(t) <= 30
  return PROVIDER_FAILURE_SHAPE.some((re) => re.test(t) && (short || re.source.startsWith("^")))
}

/** Shared content words over all content words of both answers (Jaccard). Two grounded answers may share a resume line; the same answer shares nearly everything. */
export function sameAnswerRatio(a: string, b: string): number {
  const left = new Set(contentTokens(a))
  const right = new Set(contentTokens(b))
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / (left.size + right.size - shared)
}

export function overlapRatio(a: string, b: string): number {
  const left = new Set(contentTokens(a))
  const right = new Set(contentTokens(b))
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / Math.min(left.size, right.size)
}

function contentTokens(text: string): string[] {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/).filter((word) => word.length >= 4 && !STOP.has(word))
}

export function scoreDepth(text: string): number {
  const hits = (String(text || "").match(/\b(because|fails|boundary|mechanism|trade-?off|component|setting)\b/gi) || []).length
  return Math.max(0.05, hits)
}

export function scoreConfidence(text: string): number {
  const decisive = (String(text || "").match(/\b(I would|I will|the decision|I start|I ask|I choose|I keep)\b/gi) || []).length
  const hedge = (String(text || "").match(/\b(maybe|perhaps|I think|might|possibly|I guess)\b/gi) || []).length
  return Math.max(0.05, decisive * 2 - hedge)
}

export type SpokenAssessment = {
  text: string
  words: number
  providerError: boolean
  banned: string[]
  missingEcho: boolean
  repeated: boolean
  /** Round 6: the answer still speaks about the candidate in the third person after the safe rewrite. */
  thirdPerson: boolean
  inBand: boolean
}

const ECHO_OPTIONAL = new Set<AnswerShape>(["intro", "closing", "logistics", "acknowledgement"])

export function settleSpokenAnswer(
  question: string,
  answer: string,
  level: AnswerLevel,
  sources = "",
  previousAnswer = "",
  ceiling?: number,
): SpokenAssessment {
  const cut = dissectQuestion(question, sources)
  const mode = cut.modes[level] || cut.modes.engineer
  const cap = ceiling && ceiling > 0 ? ceiling : mode.maxWords
  if (isProviderErrorAnswer(answer)) {
    return { text: "", words: 0, providerError: true, banned: [], missingEcho: false, repeated: false, thirdPerson: false, inBand: false }
  }
  // Code-first: a fenced block is shown exactly as written, at every level. Only the prose around it is settled.
  const fence = String(answer || "").match(/```[\s\S]*?```/)
  if (fence) {
    const prose = String(answer).replace(fence[0], " ").replace(/\s+/g, " ").trim()
    const around = prose ? trimToWords(stripListMarkers(prose), cap) : ""
    const text = [fence[0], around].filter(Boolean).join("\n\n")
    return { text, words: wordCount(around), providerError: false, banned: [], missingEcho: false, repeated: false, thirdPerson: false, inBand: true }
  }
  // An asked repeat ("say that again") keeps every sentence; only an unasked read-back is trimmed.
  const askedRepeat = /\b(?:repeat|again|once more|say that|same answer)\b/i.test(question)
  const voiced = firstPersonRewrite(spokenMarkup(answer), sources)
  const spoken = askedRepeat ? voiced.text : dropRepeatedSentences(voiced.text, previousAnswer)
  const kept = sentencesOf(spoken).filter((sentence) => !cut.banned.some((term) => containsTerm(sentence, term)))
  const stripped = stripListMarkers(kept.join(" "))
  const text = trimToWords(stripped, cap, (sentence) => requiredSentence(question, sentence))
  const opening = firstSentence(text).toLowerCase()
  const missingEcho = !ECHO_OPTIONAL.has(cut.shape) && cut.keywords.length > 0 && !cut.keywords.some((keyword) => opening.includes(keyword.toLowerCase()))
  const repeated = Boolean(previousAnswer) && questionKeywords(question).length > 0 && overlapRatio(text, previousAnswer) >= 0.85
  const words = wordCount(text)
  const banned = cut.banned.filter((term) => containsTerm(text, term))
  const minWords = ceiling && ceiling > 0 ? Math.min(mode.minWords, ceiling) : mode.minWords
  return {
    text,
    words,
    providerError: false,
    banned,
    missingEcho,
    repeated,
    thirdPerson: voiced.thirdPerson,
    inBand: words >= minWords && words <= cap && !missingEcho && !banned.length && !repeated && !voiced.thirdPerson,
  }
}

// ------------------------------------------------------------------ Round 6: third person about the candidate
const JOB_WORD = /\b(?:analyst|engineer|manager|director|architect|developer|security|senior|lead|consultant|specialist|resume|curriculum|vitae|sample|experience|summary|profile)\b/i
/** The candidate's name from the resume header: the first plain two- or three-word capitalised line before any section. */
export function candidateName(sources: string): { first: string; full: string } | null {
  const lines = String(sources || "").split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8)
  for (const line of lines) {
    if (/^#/.test(line)) {
      if (/^#+\s*(?:experience|work|professional|education|skills|summary|profile)\b/i.test(line)) break
      continue
    }
    const m = line.match(/^([A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?)(?:\s+[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?){1,2}$/)
    if (m && !JOB_WORD.test(line)) return { first: m[1], full: line }
  }
  return null
}

const PAST_IRREGULAR = new Set("told led ran wrote sent built made took gave saw found kept set got put held brought began chose drove knew met paid said spent taught thought understood won was had did became stood rewrote oversaw".split(" "))
const MODAL_VERB = new Set("would will can could should might must".split(" "))
/** "Jordan tracked" can become "I tracked" with no other word changed; "Jordan tracks" cannot ("I tracks"). */
function firstPersonVerb(verb: string): string | null {
  const v = verb.toLowerCase()
  if (v === "is") return "am"
  if (v === "has") return "have"
  if (MODAL_VERB.has(v) || PAST_IRREGULAR.has(v)) return v
  if (/^[a-z]{3,}ed$/.test(v)) return v
  return null
}
function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Stress round 4/6 (29 Oct 2026): a live answer that says "Jordan tracked residual risk… He told the business…" passed
 * settle unchanged. The only automatic rewrite is the safe one: the candidate's own name (from the resume header), or
 * he/she straight after such a sentence, as the subject of a past-tense or modal verb becomes "I"; "Jordan's" leading a
 * sentence becomes "My". Anything else that still names the candidate, or an answer with no "I" that is told by he/she,
 * is left as written and flagged so the repair loop asks for a first-person rewrite. Other people in a first-person
 * story ("My manager Sam… He agreed") are never touched. Introductions ("I'm Jordan Hale") are not third person.
 */
const ADVERB = "then|also|later|still|first|quickly|personally|again|now"
export function firstPersonRewrite(text: string, sources = ""): { text: string; thirdPerson: boolean } {
  const original = String(text || "")
  const name = candidateName(sources)
  let out = original
  let leftover = false
  if (name) {
    // Round 7: "He then checked" and "Jordan also sent" carry one adverb between the subject and the verb.
    const subject = new RegExp(`^(${escapeRe(name.full)}|${escapeRe(name.first)})('s)?\\s+(?:(${ADVERB})\\s+)?([A-Za-z]+)`)
    let changed = false
    let candidateLed = false
    const rewritten = sentencesOf(original).map((sentence) => {
      const m = sentence.match(subject)
      if (m) {
        if (m[2]) { changed = true; candidateLed = true; return `My ${m[3] ? `${m[3]} ` : ""}${m[4]}${sentence.slice(m[0].length)}` }
        const verb = firstPersonVerb(m[4])
        candidateLed = Boolean(verb)
        if (!verb) return sentence
        changed = true
        return `I ${m[3] ? `${m[3]} ` : ""}${verb}${sentence.slice(m[0].length)}`
      }
      // Round 10: a connector before the pronoun ("Then he agreed the evidence") kept "he" after the name was rewritten.
      const pronoun = candidateLed ? sentence.match(new RegExp(`^(?:((?:Then|Later|Next|Afterwards|After that|So|And),?)\\s+(?:he|she)|He|She)\\s+(?:(${ADVERB})\\s+)?([A-Za-z]+)`)) : null
      const verb = pronoun ? firstPersonVerb(pronoun[3]) : null
      if (pronoun && verb) { changed = true; return `${pronoun[1] ? `${pronoun[1]} ` : ""}I ${pronoun[2] ? `${pronoun[2]} ` : ""}${verb}${sentence.slice(pronoun[0].length)}` }
      if (pronoun) leftover = true
      candidateLed = false
      return sentence
    })
    if (changed) out = rewritten.join(" ")
  }
  const intro = /\b(?:I'm|I am|my name is|name's|call me|this is)\s+$/i
  const named = name ? [...out.matchAll(new RegExp(`\\b${escapeRe(name.first)}\\b`, "g"))].some((m) => !intro.test(out.slice(0, m.index))) : false
  const toldByPronoun = !/\b(?:I|I'm|I've|I'd)\b/.test(out) && !/\b(?:my|me|mine)\b/i.test(out) && sentencesOf(out).some((sentence) => /^(?:He|She)\s+[a-z]/.test(sentence))
  return { text: out, thirdPerson: named || toldByPronoun || leftover }
}

// ------------------------------------------------------------------ Round 6: the same answer for a different question
const ASKED_REPEAT_Q = /\b(?:repeat|again|once more|say that|same answer)\b/i
export type AnswerEcho = { same: boolean; ratio: number; against: string; reason: string; fresh: string[] }
function saysTerm(answer: string, term: string): boolean {
  if (containsTerm(answer, term)) return true
  const words = contentTokensLoose(answer)
  return term.toLowerCase().split(/\s+/).filter((t) => t !== "not").every((t) => {
    const stem = t.slice(0, Math.max(4, t.length - 2))
    return words.some((w) => w.startsWith(stem))
  }) && (!/^not\s/i.test(term) || /\b(?:not|never|n't|reject|refuse|decline)\b/i.test(answer))
}
function contentTokensLoose(text: string): string[] {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/).filter((w) => w.length >= 3)
}

/**
 * Round 6 (29 Oct 2026): near-duplicate questions ("What is a policy exception?" then "When would you reject a policy
 * exception?"; Kubernetes then a CI pipeline) could get the previous answer again. Production only had a prompt line
 * and an exact-sentence trim against the last answer. This checks the last three turns: the same answer (Jaccard >= 0.6)
 * to a different question, or a mostly shared answer (>= 0.4) that never says the words that make the new question new.
 * Failsafes: an asked repeat, a tied or short follow-up, the same question, or no previous answer is never flagged; a
 * flag only asks the repair loop for a rewrite, and the original stands when the rewrite is not better.
 */
export function answerEchoesPrevious(question: string, answer: string, turns: Array<{ q?: unknown; a?: unknown }> = []): AnswerEcho {
  const none: AnswerEcho = { same: false, ratio: 0, against: "", reason: "", fresh: [] }
  const q = String(question || "").trim()
  const text = String(answer || "").trim()
  if (!q || !text || ASKED_REPEAT_Q.test(q) || splitFollowUp(q).previous || interviewIntent(q) === "follow-up") return none
  const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const now = questionKeywords(cleanSpokenAsk(q))
  for (const turn of (Array.isArray(turns) ? turns : []).slice(-3).reverse()) {
    const prevQ = String(turn?.q ?? "").trim()
    const prevA = String(turn?.a ?? "").trim()
    if (!prevQ || !prevA || key(prevQ) === key(q)) continue
    const ratio = sameAnswerRatio(text, prevA)
    const before = new Set(questionKeywords(cleanSpokenAsk(prevQ)).flatMap((k) => k.toLowerCase().split(/\s+/)))
    const fresh = now.filter((k) => !k.toLowerCase().split(/\s+/).every((t) => before.has(t)))
    // A short answer that shares a frame but says the new words and is mostly new content is a new answer.
    const prevTokens = new Set(contentTokens(prevA))
    const own = contentTokens(text)
    const novelShare = own.length ? own.filter((t) => !prevTokens.has(t)).length / own.length : 0
    const answersNew = fresh.length > 0 && fresh.some((k) => saysTerm(text, k)) && novelShare >= 0.3
    if (ratio >= 0.8 || (ratio >= 0.6 && !answersNew)) return { same: true, ratio, against: prevQ, reason: `the answer repeats the answer to the earlier question "${prevQ}"`, fresh }
    if (ratio >= 0.4 && fresh.length && !fresh.some((k) => saysTerm(text, k))) {
      return { same: true, ratio, against: prevQ, reason: `the answer never addresses ${fresh.join(", ")}, which is what makes this question different from "${prevQ}"`, fresh }
    }
  }
  return none
}

/**
 * A sentence that carries a part the question explicitly asked for. Measured in rounds 11-14 (hitachi-grc Q2, Q3):
 * the repair added the rejected alternative and the numbered hypotheses at the end, and the ceiling cut removed
 * exactly those sentences again.
 */
export function requiredSentence(question: string, sentence: string): boolean {
  const q = String(question || "")
  if (/\bhypothes/i.test(q) && /\bhypothesis\s+\d/i.test(sentence)) return true
  if (/\b(design|architect|approach|trade-?off|versus|vs\.?)\b/i.test(q) && /\b(rejected|instead of|rather than|the alternative|i ruled out|i chose .+ over)\b/i.test(sentence)) return true
  if (/\bowner\b/i.test(q) && /\bowner\b|\bowns\b/i.test(sentence)) return true
  if (/\bmeasures?\b|\bmetrics?\b|\btrack\b/i.test(q) && /\b(measure|metric|track)/i.test(sentence)) return true
  if (/\b(exit criterion|stop condition|falsifiable)\b/i.test(q) && /\b(exit|stop|falsif|disprove)/i.test(sentence)) return true
  for (const code of q.match(/\b\d{2,4}-\d{1,3}\b/g) || []) if (sentence.includes(code)) return true
  return false
}

/**
 * Stress round 4 (29 Oct 2026): the model sometimes writes for a page, not for speech ("## Answer", "**Residual risk**",
 * "Answer: ..."). Those were read out as written. Only the markup goes; every word of the answer stays.
 */
export function spokenMarkup(text: string): string {
  const out = String(text || "")
    .replace(/^\s{0,3}#{1,6}\s*(?:(?:short |spoken |final )?answer|response|summary)\s*:?\s*$/gim, "")
    .replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, (_, heading: string) => (/[.?!:]$/.test(heading.trim()) ? heading.trim() : `${heading.trim()}.`))
    .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, a: string, b: string) => a || b)
    .replace(/(^|\s)\*([^*\n]+)\*(?=[\s.,;:!?]|$)/g, "$1$2")
    .replace(/\[([^\]\n]+)\]\((?:https?:)?[^)\s]*\)/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s*(?:(?:short|spoken|final|my)\s+)?(?:answer|response)\s*[:\-–—]\s*/i, "")
    .trim()
  // Failsafe: markup-only text (never expected) keeps the original rather than showing nothing.
  return out || String(text || "")
}

/**
 * Stress round 4: when the model reads back the previous answer, the sentences it already said are dropped. If too
 * little is left to stand as an answer, the text is kept as written (the repeated flag still reports it).
 */
export function dropRepeatedSentences(text: string, previousAnswer = ""): string {
  if (!previousAnswer) return text
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const said = new Set(sentencesOf(previousAnswer).map(key).filter((k) => k.split(" ").length >= 5))
  const all = sentencesOf(text)
  const fresh = all.filter((sentence) => !said.has(key(sentence)))
  if (fresh.length === all.length) return text
  return fresh.length && wordCount(fresh.join(" ")) >= 8 ? fresh.join(" ") : text
}

function stripListMarkers(text: string): string {
  return text
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}

export type LiveAnswer = { question: string; level: AnswerLevel; text: string }

/** No-model relevance gate used by the live eval and by the fixture tests. */
const GAP_EXEMPT = new Set<AnswerShape>(["logistics", "acknowledgement"])

/**
 * Hard failures: provider error text, outside the mode band, first sentence without the question's words, an
 * ungrounded tool, the same answer for different questions (same mode, Jaccard >= 0.7), or two modes under 50%
 * apart on length. Depth and confidence gaps are word-count heuristics, so they are warnings, not failures:
 * failing on them taught the offline draft to stuff "because" and "I would" into every sentence.
 * A yes-or-no logistics answer is not stretched to make Architect 50% longer than Engineer.
 */
export function evaluateLiveAnswers(rows: LiveAnswer[], sources = ""): { ok: boolean; failures: string[]; warnings: string[] } {
  const failures: string[] = []
  const warnings: string[] = []
  const grouped = new Map<string, LiveAnswer[]>()
  for (const row of rows) {
    const list = grouped.get(row.question) || []
    list.push(row)
    grouped.set(row.question, list)
    if (isProviderErrorAnswer(row.text)) failures.push(`provider error text in ${row.level}: ${row.question}`)
    const cut = dissectQuestion(row.question, sources)
    const mode = cut.modes[row.level]
    const code = asksForCode(row.question)
    if (code && !/^\s*```/.test(row.text)) failures.push(`code question without a fenced block first for ${row.level}: ${row.question}`)
    // For a code answer only the words after the block are measured; the block itself is the answer.
    const prose = code ? row.text.replace(/```[\s\S]*?(?:```|$)/g, " ") : row.text
    const words = wordCount(prose)
    if ((!code && words < mode.minWords) || words > mode.maxWords) failures.push(`length ${words} outside ${mode.minWords}-${mode.maxWords} for ${row.level}: ${row.question}`)
    const opening = firstSentence(prose).toLowerCase()
    if (!code && !ECHO_OPTIONAL.has(cut.shape) && cut.keywords.length && !cut.keywords.some((keyword) => opening.includes(keyword.toLowerCase()))) {
      failures.push(`missing question terms for ${row.level}: ${row.question}`)
    }
    const banned = cut.banned.filter((term) => containsTerm(row.text, term))
    if (banned.length) failures.push(`ungrounded jargon (${banned.join(", ")}) for ${row.level}: ${row.question}`)
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].question !== rows[j].question && rows[i].level === rows[j].level && sameAnswerRatio(rows[i].text, rows[j].text) >= 0.7) {
        failures.push(`same answer for different questions: "${rows[i].question}" and "${rows[j].question}"`)
      }
    }
  }
  for (const [question, group] of grouped) {
    const exempt = GAP_EXEMPT.has(dissectQuestion(question, sources).shape) || asksForCode(question)
    const byLevel = new Map(group.map((row) => [row.level, row]))
    for (let i = 0; i < LEVELS.length; i++) {
      for (let j = i + 1; j < LEVELS.length; j++) {
        const a = byLevel.get(LEVELS[i])
        const b = byLevel.get(LEVELS[j])
        if (!a || !b) continue
        const lengthGap = relativeGap(wordCount(a.text), wordCount(b.text))
        const depthGap = relativeGap(scoreDepth(a.text), scoreDepth(b.text))
        const confidenceGap = relativeGap(scoreConfidence(a.text), scoreConfidence(b.text))
        if (lengthGap < 0.5) (exempt ? warnings : failures).push(`length gap ${lengthGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (depthGap < 0.5) warnings.push(`depth gap ${depthGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (confidenceGap < 0.5) warnings.push(`confidence gap ${confidenceGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
      }
    }
  }
  return { ok: failures.length === 0, failures, warnings }
}

/** The experience lines of a resume, in the candidate's order. Header, name, contact, and education are not experience. */
export function experienceLines(resume: string): string[] {
  const text = String(resume || "").replace(/[*`]/g, " ")
  const section = text.match(/^(#+)\s*(?:experience|work history|professional experience)\b[^\n]*\n([\s\S]*)/im)
  // Source grounding (29 Oct 2026): a "### Role, Employer" heading inside Experience no longer ends the section; only
  // a heading at the Experience level or higher does, and role headings themselves are not experience lines.
  let body = text
  if (section) {
    const end = section[2].search(new RegExp(`^#{1,${section[1].length}}\\s`, "m"))
    body = end >= 0 ? section[2].slice(0, end) : section[2]
  }
  return body
    .split(/\n+/)
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/^[-•\s#]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => wordCount(line) >= 6 && !/@|https?:|^fictional\b|^b\.?s\.?\b|^education\b/i.test(line))
}

function firstPerson(line: string): string {
  const clean = line.replace(/[.\s]+$/, "")
  if (/^(?:I|We|My)\b/.test(clean)) return `${clean}.`
  if (/^(?:[A-Z][a-z]*ed|Wrote|Sent|Led|Built|Made|Took|Told|Kept|Set|Ran|Drove|Taught|Brought|Thought|Held|Won|Grew|Gave|Spoke|Met|Found|Began|Ran|Rewrote|Ran)\b/.test(clean)) return `I ${clean[0].toLowerCase()}${clean.slice(1)}.`
  return `In my work, ${clean[0].toLowerCase()}${clean.slice(1)}.`
}

/**
 * The interviewer's own phrase: the ask with its question frame taken off ("Tell me about a time you",
 * "What is the difference between", "Are you able to", "How do you"), so the answer can open on those exact words.
 */
/** The pushback lead and the sentence it sits in ("That doesn't sound right.", "I disagree, I think…"). */
const PUSHBACK_LEAD = /^\s*(?:hmm+[,.]?\s*|well[,\s]+|really\??\s*)*(?:that (?:doesn\'t|does not) (?:sound|seem) right|i\'m not (?:sure|convinced)(?: that\'s (?:right|correct))?|i(?:\'d| would) push back(?: on that)?|really\?\s*(?=\w)|that seems (?:backwards|too simple|wrong|off)|i don\'t think that\'s (?:right|how it works)|that contradicts|are you sure(?: about that)?|i disagree|most people would (?:say|just)|that\'s not (?:right|what i)|i\'m not buying)\b[^.?!]*[.?!]?\s*/i
export function leadPhrase(question: string): string {
  const tied = splitFollowUp(cleanSpokenAsk(question))
  // Round 12: for pushback the topic is the question being challenged, not "that doesn't sound right".
  const ownTopic = tied.own.replace(PUSHBACK_LEAD, "").trim()
  question = tied.previous ? (PUSHBACK_LEAD.test(tied.own) ? tied.previous : ownTopic || tied.own) : (cleanSpokenAsk(question).replace(PUSHBACK_LEAD, "").trim() || cleanSpokenAsk(question))
  let topic = (topicOfAsk(question).split(/(?<=[a-z0-9)])[?!.]\s+/i)[0] || "").replace(/[?!.]+\s*$/, "").trim()
  const frames = [
    /^(?:so,?\s+|and\s+|now,?\s+)/i,
    /^(?:can|could|would) you\s+(?:please\s+)?(?:tell me|explain|describe|walk me through|share)\s+(?:about\s+)?/i,
    /^(?:can|could|would) you\s+(?:also\s+)?(?:add|include)\s+(?:an?\s+|the\s+|some\s+)?/i,
    /^what about\s+/i,
    // Round 10: "what would you do if the owner says…" was said back as "For do if the owner says…".
    /^what (?:would|do|should|will) you do\s+(?=if\b|when\b)/i,
    /^walk me through\s+/i,
    /^tell me about (?:a time (?:when )?(?:you|that you)\s+)?/i,
    /^(?:give me an example of (?:a time )?(?:when )?(?:you\s+)?)/i,
    /^what(?:'s| is) the difference between\s+/i,
    /^what(?:'s| is| are| does| do)\s+(?:a |an |the )?/i,
    /^(?:how|why) (?:do|did|would|does|is|are) (?:you\s+)?/i,
    /^(?:are|were) you (?:able|willing|comfortable|open) to\s+/i,
    /^(?:define|explain|describe|compare)\s+/i,
  ]
  for (let i = 0; i < 3; i++) for (const frame of frames) topic = topic.replace(frame, "")
  topic = topic.replace(/^actually\s+/i, "")
  // Round 13 (read by eye): "what would you decide first" lost its frame ("On decide first…") and "Do you trust X" was
  // "On trust X". They are said as mine: "what I would decide first", "whether I trust X", "whether I have ever…".
  topic = topic.replace(/^what would you\s+/i, "what I would ").replace(/^(?:do|did) you\s+/i, "whether I ").replace(/^(?:have|has) you\s+/i, "whether I have ")
  // Round 11: a multi-part ask's lead was cut mid-list ("how I run a vendor risk review, what would I ask the vendor, what").
  // The lead is the first part only, when that part has 3+ words.
  const firstPart = topic.split(/,\s*/)[0]
  const rest = topic.slice(firstPart.length).replace(/^,\s*(?:and\s+)?/, "")
  if (firstPart !== topic && (firstPart.split(/\s+/).length >= 3 || /^(?:how|what|who|when|why|where|which)\b/i.test(rest))) topic = firstPart
  topic = topic.replace(/(?<!\b(?:at|to|from|for|of|my|our|the))\s+(?:mean|means|work|works)$/i, "").replace(/\s+/g, " ").trim()
  const words = topic.split(/\s+/).filter(Boolean)
  if (!words.length) return questionKeywords(question)[0] || "this question"
  if (/^[A-Z][a-z]/.test(words[0])) words[0] = words[0].toLowerCase()
  // Round 11 (29 Oct 2026): a 9-word cut left "if the owner says it's fixed but there's no". The cut now allows 12 words
  // and never ends on a function word; past 12 words it ends at the last clause break before the cut.
  let kept = words.slice(0, 12)
  if (words.length > 12) {
    const brk = kept.findLastIndex((w, i) => i >= 3 && /^(?:but|and|or|so|because|while|which|that|then)$/i.test(w))
    if (brk > 0) kept = kept.slice(0, brk)
  }
  while (kept.length < words.length && kept.length > 1 && /^(?:a|an|the|no|not|of|to|for|but|and|or|so|there's|there|is|are|with|in|on|at|by|my|your|its|their|if|when|that|which)$/i.test(kept[kept.length - 1].replace(/[,;:]+$/, ""))) kept.pop()
  return kept.join(" ").replace(/[,;:]+$/, "")
}

/** The separate things the interviewer listed, in order: "trust boundaries, data flow, failure isolation, rollout and validation". */
export function askedPartList(question: string): string[] {
  const out: string[] = []
  // Round 10 (29 Oct 2026): fillers between commas ("So, uh, what would you, um, what would you do") were read as listed
  // parts ("so", "uh", "what would you"), so the prompt and the stand-in answered each. The ask is cleaned first.
  for (const clause of topicOfAsk(cleanSpokenAsk(question)).split(/(?<=[a-z0-9)])[?!.]\s+/i)) {
    if (!clause.includes(",")) continue
    const body = clause.replace(/^(?:explain|walk (?:me )?through|give|state|cover|describe|include|discuss)\s+/i, "").replace(/[?!.]+$/, "")
    for (const item of body.split(/,\s*|\s+and\s+/)) {
      // Round 13 (by eye): "and who signs off" was said "On and who signs off".
      const part = item.replace(/^(?:and|or|then)\s+/i, "").replace(/^(?:the|a|an)\s+/i, "").trim()
      if (part && wordCount(part) <= 5) out.push(part.toLowerCase())
    }
  }
  return [...new Set(out)]
}

const PART_LINES: Record<AnswerLevel, Array<(part: string) => string>> = {
  engineer: [(p) => `For ${p}, I say what it is in one line and why it matters here.`],
  director: [
    (p) => `On ${p}, I name the owner and the risk if it slips.`,
    (p) => `For ${p}, I give the decision and the date it is due.`,
  ],
  architect: [
    (p) => `For ${p}, I state what it covers and the check that proves it.`,
    (p) => `On ${p}, I name where it can fail and what stops the failure from spreading.`,
    (p) => `With ${p}, I keep one result that confirms it before I move on.`,
  ],
}

function rankedExperience(question: string, resume: string, offTopicAllowed = 99): string[] {
  const lines = experienceLines(resume)
  const keys = questionKeywords(question).map((k) => k.toLowerCase())
  const score = (line: string) => {
    const low = line.toLowerCase()
    return keys.reduce((sum, key) => sum + (low.includes(key) ? (key.includes(" ") ? 3 : 1) : 0), 0)
  }
  // Lines that do not match the question are rotated by the question, so two questions never fall back on the same lines.
  const seed = [...String(question)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const spin = (i: number) => (i + seed) % Math.max(1, lines.length)
  const ranked = lines
    .map((line, i) => ({ line, i, n: score(line) }))
    .sort((a, b) => b.n - a.n || spin(a.i) - spin(b.i))
  // The best line always stays (it is the experience the answer points at). Lines that share no word with the
  // question are capped, so a long mode does not become a reading of the whole resume.
  let offTopic = 0
  // When nothing in the resume matches, no resume line is cited: reusing the same unrelated lines for every
  // question is how different questions got the same answer.
  if (!ranked.some((row) => row.n > 0)) return []
  return ranked.filter((row, index) => index === 0 || row.n > 0 || offTopic++ < offTopicAllowed).map((row) => row.line)
}

/** "challenged a weak plan" is said "When I challenged a weak plan"; "a situation where a fix did not hold" is "In a situation...". */
function storyFrame(lead: string): string {
  return /^(?:\w+ed|led|built|made|took|told|kept|set|ran|drove|taught|brought|held|found|wrote|sent|had|trained|got|caught|fought|dealt|saw)\b/i.test(lead) ? `When I ${lead}` : /^(?:my|our)\b/i.test(lead) ? `On ${lead}` : `In ${lead.replace(/^a time\b/i, "the time")}`
}

const OPENERS: Record<AnswerShape, Record<AnswerLevel, (lead: string) => string>> = {
  definition: {
    engineer: (l) => `Here is what ${l} means in my own work.`,
    director: (l) => `For the business, ${l} decides what risk we carry, so I lead with the decision.`,
    architect: (l) => `I would explain ${l} by where it sits in the process and where it can break.`,
  },
  comparison: {
    engineer: (l) => `Here is the difference in ${l}, from my own work.`,
    director: (l) => `On ${l}, the choice changes who carries the risk, so I make that call early.`,
    architect: (l) => `I separate ${l} by what each one checks and where each one stops.`,
  },
  "personal-experience": {
    engineer: (l) => `${storyFrame(l)}, here is the real example.`,
    director: (l) => `${storyFrame(l)}, my decision was to hold the item until the proof was there.`,
    architect: (l) => `${storyFrame(l)}, I checked the plan against the evidence one step at a time.`,
  },
  logistics: {
    engineer: (l) => `Yes, I can ${l}, and that schedule works for me.`,
    director: (l) => `Yes, I can ${l}, and I plan my week around it.`,
    architect: (l) => `Yes, I can ${l}, and I have worked that way before.`,
  },
  "follow-up": {
    engineer: (l) => `Building on that, for ${l}, I add one concrete step.`,
    director: (l) => `Building on that, ${l} is where I make the next call for the business.`,
    architect: (l) => `Building on that, I treat ${l} as its own check with its own failure point.`,
  },
  intro: {
    engineer: () => `Here is a short introduction to my background and the work I do now.`,
    director: () => `Here is my background in brief, with the decisions my work supports.`,
    architect: () => `Here is my background, and how my work fits together from evidence to sign-off.`,
  },
  value: {
    engineer: (l) => `On ${l}, I bring careful, evidence-first work.`,
    director: (l) => `On ${l}, I bring clear decisions and owners who know what is still open.`,
    architect: (l) => `On ${l}, I bring a process where each step has a check that proves it.`,
  },
  closing: {
    engineer: () => `Yes, I would like to ask how this team decides which open items matter most.`,
    director: () => `Yes, I would like to ask who owns the risk decisions here and how they are reported.`,
    architect: () => `Yes, I would like to ask how evidence moves from the control owners to sign-off here, and where it stalls.`,
  },
  acknowledgement: {
    engineer: () => `Yes, I can hear you clearly, thank you, and I am glad to be here.`,
    director: () => `Yes, I can hear you clearly, thank you, and I am ready whenever you are.`,
    architect: () => `Yes, I can hear you clearly, thank you, and I am glad to talk through the work.`,
  },
  scenario: {
    engineer: (l) => `For ${l}, here is the first thing I would do.`,
    director: (l) => `For ${l}, I would make the first decision quickly and name who owns it.`,
    architect: (l) => `For ${l}, I would walk the steps in order and note where each one can fail.`,
  },
  "technical-deep-dive": {
    engineer: (l) => `On ${l}, here is what I do in practice.`,
    director: (l) => `On ${l}, I start with the decision and the risk it carries for the business.`,
    architect: (l) => `On ${l}, I would show how the pieces connect and where they fail.`,
  },
  direct: {
    engineer: (l) => `On ${l}, here is my answer from my own work.`,
    director: (l) => `On ${l}, I start with the decision and the risk it carries for the business.`,
    architect: (l) => `On ${l}, I would show how the pieces connect and where they fail.`,
  },
} as Record<AnswerShape, Record<AnswerLevel, (lead: string) => string>>

/** The interviewer's phrase said by the candidate: "your background" is "my background" in the answer. */
function spokenLead(lead: string, question = ""): string {
  // "How do you handle a suspicious login" leaves a verb phrase; said back it is "how I handle a suspicious login".
  const verb = /^\s*(?:(?:so|and|now)[,\s]+)?(?:how|why) (?:do|did|would|will|should|could|can) you\b/i.test(topicOfAsk(cleanSpokenAsk(question).replace(PUSHBACK_LEAD, "")))
  const said = verb && !/^how\b/i.test(lead) ? `how I ${lead}` : lead
  // Round 11: a condition ("if the owner says…") after "For"/"On" was "For if the owner says…"; it is said as a case.
  // Round 11: a yes/no ask ("Would you close a finding…") was said back "On would I close a finding…"; it is "whether I would…".
  // Round 11: "By what percent did you cut open findings" was said back "On by what percent did I cut…".
  const amount = said.match(/^(by what (?:percent(?:age)?|share)|what (?:percent(?:age)?|share|number)|how (?:many|much|often|fast))((?: [\w-]+){0,3}?) (?:did|do|was|were|have|has) (?:you|I|we)\s+(.+)$/i)
  if (amount) return spokenLead(`${/^by /i.test(amount[1]) ? "how much" : amount[1].toLowerCase()}${amount[2]} I ${amount[3]}`)
  // Round 13: "What was the ROI of your programme" was said back "On what was the ROI of my programme".
  if (/^what (?:percentage|share|portion|proportion|fraction) of /i.test(said)) return spokenLead(said.replace(/^what \w+ of /i, "the share of ").replace(/ (?:were|was) /i, " "))
  if (/^what (?:was|is|are|were) (?:the|my|our|your) /i.test(said)) return spokenLead(said.replace(/^what (?:was|is|are|were) /i, ""))
  const yesNo = said.match(/^(would|will|should|could|can|do|did) (you|I|we)\s+(.+)$/i)
  if (yesNo) return spokenLead(`whether ${yesNo[2].toLowerCase() === "we" ? "we" : "I"} ${/^(?:do|did)$/i.test(yesNo[1]) ? "" : yesNo[1].toLowerCase() + " "}${yesNo[3]}`)
  if (/^(?:if|when|whenever)\b/i.test(said)) return spokenLead(`the case where ${said.replace(/^\w+\s+/, "")}`)
  return said
    .replace(/\byourself\b/gi, "myself").replace(/\byours\b/gi, "mine").replace(/\byour\b/gi, "my")
    // Round 9 (29 Oct 2026): "What if the owner is senior to you?" was said back as "senior to I". Object "you" is "me".
    .replace(/\b(to|for|with|than|at|from|about|of|by|ask|asks|asked|tell|told|give|gave|show|let|help|hire|pay|trust|call|against|behind|before|after|like)\s+you\b(?!\s+(?:are|were|have|had|do|did|can|could|would|will|should|need|want|think)\b)/gi, "$1 me")
    .replace(/\byou are\b/gi, "I am").replace(/\byou(?:'ve| have)\b/gi, "I have").replace(/\byou\b/gi, "I")
}

// Offline stand-in only: approach lines, seeded with the interviewer's phrase, that fill a mode to its aim when the
// resume has nothing more on the topic. They make no claim about past results and carry no numbers.
const APPROACH: Record<AnswerLevel, Array<(lead: string) => string>> = {
  engineer: [
    (l) => `On ${l}, I would start by confirming the scope and who owns it.`,
    () => "Then I check the evidence against the live setting before I call it done.",
    () => "I write down what changed so the next person can repeat it.",
    (l) => `For ${l}, I keep the first step small and check it worked.`,
    () => "If something does not match, I ask the owner before I change anything.",
    () => "I keep the notes short so anyone on the team can follow them.",
  ],
  director: [
    (l) => `On ${l}, the first call is whether the risk is acceptable today or needs action now.`,
    () => "I name one owner for that call and a date for the next review.",
    () => "The decision goes on record.",
    () => "The owner signs off in writing.",
    () => "If the owner accepts the risk, I record the reason and when it expires.",
    (l) => `For ${l}, I tell leadership what is still open and what it costs to wait.`,
    () => "I agree the deadline with the owner before work starts.",
    () => "Anything past its date comes back to me for a new decision.",
    () => "I keep the summary to one page so it gets read.",
    // Round 13: short lines so a floor one or two words short can still be met under the ceiling.
    () => "I own that call.",
    () => "Leadership sees it weekly.",
  ],
  architect: [
    (l) => `On ${l}, I break the work into parts that each have their own check.`,
    () => "For each part, I note what it depends on and what happens when that dependency fails.",
    () => "I keep the evidence for each step next to the step, so a reviewer can follow it without asking me.",
    () => "Where the work touches another team, I agree the handoff and the proof that it happened.",
    () => "I test the weakest step first, because that is where a fix usually stops holding.",
    () => "When a check fails, the item goes back to its owner with the evidence that failed.",
    () => "After the change, I confirm the setting again later to make sure it stayed in place.",
    () => "I keep the steps short enough that someone new can run them the same way.",
    () => "Each part gets its own owner.",
    () => "I name what would prove it wrong.",
    () => "Every check is written down.",
    () => "Failures go back to the owner.",
    (l) => `For ${l}, I write down the inputs, the check, and the expected result before I start.`,
    () => "I look for the step that depends on a person remembering, and I replace it with a check.",
    () => "I record which evidence came from the live setting and which came from a ticket.",
    () => "If two steps can fail the same way, I make sure one of them is caught early.",
  ],
}

const CLOSERS: Record<AnswerLevel, string[]> = {
  engineer: [],
  director: [
    "The owner leaves with one clear next step and a date.",
    "I report what is still open in business terms, not tool terms.",
  ],
  architect: [
    "The boundary I watch is the point where the evidence stops matching the plan.",
    "When that check fails, I send the item back instead of closing it.",
    "Each step has one result that tells me it worked, so the next person can repeat it.",
  ],
}

/**
 * Code-level spoken draft so the gates can run with no model. It opens on the interviewer's own phrase, uses the
 * experience lines that match the question (never the resume header), and adds more supported lines per mode
 * instead of filler, so Engineer, Director, and Architect differ by real content. It is a stand-in, not a live answer.
 */
export function draftSpokenAnswer(question: string, level: AnswerLevel, resume: string, previous: string[] = []): string {
  // Round 6: each mode is at least 1.5 times the one below it. The mode below is drafted first and this one fills to
  // that floor from more supported or approach lines, never past its own ceiling (failsafe: the ceiling wins).
  const below = level === "architect" ? "director" : level === "director" ? "engineer" : null
  const floor = below ? Math.ceil(wordCount(draftSpokenAnswer(question, below, resume, previous)) * 1.5) : 0
  const text = draftAtLevel(question, level, resume, previous, floor)
  // Round 13 (29 Oct 2026): a Director draft at its own ceiling left the Architect no room to be 1.5 times longer
  // ("ROI … in dollars": 66 vs 94 words). Director is cut to the Architect ceiling over 1.5 on a sentence boundary.
  // Failsafe: never below the Director floor from Engineer, so the lower gap holds too.
  if (level === "director") {
    const cut = dissectQuestion(question, resume)
    const room = Math.floor(cut.modes.architect.maxWords / 1.5)
    const trimmed = wordCount(text) > room && room >= floor ? trimToWords(text, room) : text
    if (wordCount(trimmed) >= floor) return trimmed
  }
  return text
}

export const NUMBER_ASK = /\b(?:what (?:percentage|percent|share|number|proportion)|by what percent|how many|how much (?:faster|money|time|did)|in dollars|dollar value|roi\b|pass rate|false-positive rate|give me (?:a|the) (?:number|percentage)|exact(?:ly)? how many|to the nearest)\b/i
export const NO_GUESS = "I won't guess a figure I can't back up."

const HONEST_LINES = [
  "My resume does not show this exact work, so I answer from how I would approach it.",
  "I have not done this in a past role, so I will walk through how I would handle it.",
  "This is not something I have run before, so I will give the steps I would take.",
]

// r2 (29 Oct 2026): two stiff lead-ins. A statement premise ("the control failed in 37% of samples") after "For" is said
// "For the control that failed…"; a wh-lead after "for" ("for who should accept a risk") is said "as for who…".
// Failsafe: any other lead is returned unchanged.
const PREMISE_VERB = /^(the|a|an|our|my|this|that|one|two|three|\d+)((?: [a-z][\w-]*){1,2}?) (failed|broke|missed|passed|slipped|was|were|is|are|had|has|went|got|kept|stopped|lapsed|expired)\b(.*)$/i
export function premiseLead(lead: string): string {
  try {
    const m = String(lead || "").match(PREMISE_VERB)
    if (!m || /\b(?:that|which|who|i|we|you)$/i.test(m[2].trim()) || /\b(?:is|are|was|were|has|had)\b/i.test(m[2])) return lead
    return `${/^(?:The|A|An|Our|My|This|That|One|Two|Three)$/.test(m[1]) ? m[1].toLowerCase() : m[1]}${m[2]} that ${m[3]}${m[4]}`
  } catch {
    return lead
  }
}
export function naturalOpener(text: string): string {
  return String(text || "")
    .replace(/^For (who|whom|what|which|where|why|whether)\b/, "As for $1")
    .replace(/, for (who|whom|what|which|where|why|whether)\b/, ", as for $1")
    .replace(/^On (who|whom|which|where)\b/, "As for $1")
    .replace(/\bI treat (who|whom|which|where)\b/, "I treat the question of $1")
}

function draftAtLevel(question: string, level: AnswerLevel, resume: string, previous: string[], floor: number): string {
  const cut = dissectQuestion(question, resume)
  const lead = spokenLead(leadPhrase(question), splitFollowUp(cleanSpokenAsk(question)).own)
  const opener = (OPENERS[cut.shape] || OPENERS.direct)[level] || OPENERS.direct[level]
  // Round 6: as asked live, the previous answers are known. A sentence already said in them is not said again, as the
  // production prompt asks ("Do not reuse the previous answer") and settle enforces; the next line in the pool is used.
  // Round 9: a template line seeded with a new lead ("On what if it slips again, the first call is…") is the same line said
  // again; the lead clause is ignored when comparing.
  const key = (text: string) => text.replace(/^(?:on|for) [^,]{1,80}, /i, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const said = new Set(previous.flatMap((answer) => sentencesOf(answer)).map(key))
  const fresh = (line: string) => !said.has(key(line))
  // A tied follow-up is ranked on its own words, so it does not read back the lines the first answer already used.
  const tied = splitFollowUp(question)
  const lines = rankedExperience(tied.previous ? tied.own : question, resume, { engineer: 0, director: 1, architect: 3 }[level]).map(firstPerson).filter(fresh)
  const mode = cut.modes[level]
  // Each mode stops about a third short of the next one up, so the three stay at least 50% apart in length.
  const archStop = cut.modes.architect.aimWords
  const dirStop = Math.min(cut.modes.director.aimWords, Math.floor(archStop / 1.55))
  const stop = level === "architect" ? archStop : level === "director" ? dirStop : Math.max(cut.modes.engineer.minWords, Math.min(cut.modes.engineer.aimWords, Math.floor(dirStop / 1.7)))
  const parts = [naturalOpener(opener(premiseLead(lead)))]
  // Round 13 (read by eye): a trick ask for a figure ("What percentage…", "ROI in dollars") got a resume line and no
  // word on the number, which reads as dodging. The stand-in says once that it will not guess. Failsafe: a figure the
  // interviewer gave, or one on the resume, is not refused.
  // Engineer says it in the opener itself, so it stays short enough for the 50% gaps (its ceiling is tight).
  if (NUMBER_ASK.test(question) && !/\d/.test(question)) {
    if (level === "engineer") parts[0] = `On ${lead}, ${NO_GUESS}`
    else parts.push(NO_GUESS)
  }
  let words = wordCount(parts.join(" "))
  const story = cut.shape === "personal-experience" || cut.shape === "scenario"
  const deep = story || cut.shape === "technical-deep-dive"
  const most = { engineer: deep ? 2 : 1, director: 3, architect: 5 }[level]
  let used = 0
  // Supported lines are added until the mode's aim; a line that does not fit is skipped, not cut.
  for (const line of lines) {
    const n = wordCount(line)
    // The best matching line may run past the aim (never past the ceiling): it is the evidence the answer needs.
    if (used >= most || words + n > (used ? stop : mode.maxWords)) continue
    parts.push(line)
    words += n
    used++
  }
  // Round 12 (29 Oct 2026): a behavioural story with no matching resume line became "how I would approach it", which is
  // not a story. The closest real resume line is told as the example, said as the closest one, never as an exact match.
  // Failsafe: an empty resume keeps the honest line.
  if (!used && cut.shape === "personal-experience") {
    const real = experienceLines(resume).map(firstPerson).filter(fresh)
    const pick = real[[...question].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % Math.max(1, real.length)]
    if (pick) {
      const intro = "The closest real example from my work is this one."
      parts.push(intro, pick)
      words += wordCount(intro) + wordCount(pick)
      used++
    }
  }
  if (!used) {
    const honest = HONEST_LINES.find(fresh) || HONEST_LINES[0]
    parts.push(honest)
    words += wordCount(honest)
  }
  const askedParts = askedPartList(question)
  askedParts.slice(0, level === "engineer" ? 2 : level === "director" ? 3 : askedParts.length).forEach((part, i) => {
    const templates = PART_LINES[level]
    // Round 11: a listed part was said in the interviewer's voice ("On what would you check yourself"); it is said as mine.
    const said = spokenLead(part.replace(/^(what|how|when|who|why|where|which) (would|do|will|should|did) you\s+(.+)$/i,
      (_m, wh, aux, rest) => `${wh} I ${/^do$/i.test(aux) ? "" : aux + " "}${rest}`))
    const line = templates[i % templates.length](said)
    const n = wordCount(line)
    if (words + n > stop) return
    parts.push(line)
    words += n
  })
  for (const line of CLOSERS[level]) {
    const n = wordCount(line)
    if (words + n > stop || !fresh(line)) continue
    parts.push(line)
    words += n
  }
  const approach = APPROACH[level].map((make) => make(cut.shape === "personal-experience" ? "that situation" : lead)).filter((line) => fresh(line) && !parts.includes(line))
  // Short shapes (greeting, logistics, closing) stop at the opener and the supported lines; others fill to the aim.
  if (!["acknowledgement", "logistics", "closing"].includes(cut.shape)) {
    for (const line of approach) {
      const n = wordCount(line)
      if (words >= stop) break
      if (words + n > (level === "architect" ? mode.maxWords : stop) || parts.includes(line)) continue
      parts.push(line)
      words += n
    }
  }
  // The floor from the mode below: unused supported lines first, then approach lines, each only if it fits the ceiling.
  if (words < floor) {
    for (const line of [...lines, ...CLOSERS[level].filter(fresh), ...approach]) {
      if (words >= floor) break
      const n = wordCount(line)
      if (parts.includes(line) || words + n > mode.maxWords) continue
      parts.push(line)
      words += n
    }
  }
  return trimToWords(parts.join(" "), mode.maxWords)
}

/**
 * The two round-6 repair-loop checks, as one pure function so the service and the recorded-output harness
 * (scripts/kompas-repair-harness.mjs) run the same code: the previous answer given again to a different question, and
 * third person about the candidate that the settle rewrite cannot fix. Both are core items for judgeRewrite.
 */
export function repairLoopVoiceEchoChecks(question: string, text: string, previousTurns: Array<{ q?: unknown; a?: unknown }> = [], sourceText = ""): string[] {
  const echo = answerEchoesPrevious(question, text, previousTurns)
  const echoed = echo.same ? [`${echo.reason}; answer only this question${echo.fresh.length ? ` and say ${echo.fresh.join(", ")} in the first sentence` : ""}`] : []
  const voice = firstPersonRewrite(text, sourceText).thirdPerson ? ["speak as the candidate in the first person (I, my); never use the candidate's name or he or she for the candidate"] : []
  return [...echoed, ...voice]
}
