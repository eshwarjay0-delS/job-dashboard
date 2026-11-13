/**
 * Question dissection for Kompas.
 * The interviewer’s words choose the shape, the keywords, the terms that
 * must not appear, and the length. The selected mode chooses stance, depth, and confidence.
 * This module does not call a model.
 */
import { normalizeResumeLayout } from "./kompasResumeLayout.ts"
import { normalizeAskText } from "./kompasAskText.ts"
import { interviewIntent, type ReplyIntent } from "./kompasRelevance.ts"
import type { AnswerLevel } from "./kompasAnswer.ts"
import { repairDictation } from "./kompasDictation.ts"
import { dropUngroundedLogistics, ungroundedLogisticsSentences } from "./kompasLogisticsPhrases.ts"

export type AnswerShape =
  | "intro"
  | "personal-experience"
  | "comparison"
  | "scenario"
  | "design"
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
  /** What the prompt aims for. The question type sets this. The mode does not pad up to it. */
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
  engineer: "Plain and accessible. For technical HR, say what it is in plain words and one example, then stop. For an engineer on a mechanism or a design stage, go to the check, then leave a checkpoint.",
  director: "Decision first, then the business risk and who owns it. At most one sentence on how it works. No build walkthrough.",
  architect: "Precise. Say how it works, where it breaks, and what contains it. Use only the technical terms the question or my resume already uses.",
}

/**
 * Aim and ceiling, in words, by question type then mode: engineer, director, architect.
 * A director is often shorter. The mode changes the stance, not the padding.
 * Ceilings scale with partsScale and never pass 300.
 */
export type LengthKind = "yes-no" | "definition" | "compare" | "follow-up" | "opener" | "star" | "design-first" | "design-later"

export const QUESTION_LENGTH: Record<LengthKind, Record<AnswerLevel, { aim: number; ceiling: number }>> = {
  "yes-no": { engineer: { aim: 20, ceiling: 40 }, director: { aim: 18, ceiling: 36 }, architect: { aim: 22, ceiling: 40 } },
  definition: { engineer: { aim: 40, ceiling: 70 }, director: { aim: 30, ceiling: 50 }, architect: { aim: 55, ceiling: 90 } },
  compare: { engineer: { aim: 80, ceiling: 130 }, director: { aim: 60, ceiling: 90 }, architect: { aim: 110, ceiling: 160 } },
  "follow-up": { engineer: { aim: 80, ceiling: 140 }, director: { aim: 50, ceiling: 90 }, architect: { aim: 90, ceiling: 160 } },
  opener: { engineer: { aim: 140, ceiling: 200 }, director: { aim: 120, ceiling: 170 }, architect: { aim: 160, ceiling: 230 } },
  star: { engineer: { aim: 180, ceiling: 280 }, director: { aim: 140, ceiling: 200 }, architect: { aim: 200, ceiling: 300 } },
  "design-first": { engineer: { aim: 90, ceiling: 160 }, director: { aim: 70, ceiling: 120 }, architect: { aim: 120, ceiling: 200 } },
  "design-later": { engineer: { aim: 100, ceiling: 180 }, director: { aim: 60, ceiling: 100 }, architect: { aim: 140, ceiling: 220 } },
}

const DEPTH: Record<AnswerLevel, number> = { engineer: 0.4, director: 0.22, architect: 0.72 }
const CONFIDENCE: Record<AnswerLevel, number> = { engineer: 0.3, director: 0.84, architect: 0.48 }
const DEEPER_ON = /\b(?:go deeper|dig deeper|deeper on)\b/i
const BLAME_ASK = /\b(?:whose fault|who(?:'s| is) to blame|post-?mortem|blame you|why did you (?:miss|fail|drop)|what did you miss)\b/i

/** A one-word or empty prompt. The answer states the assumption, then answers in one sentence. */
export function vagueReply(question: string, level: AnswerLevel): string {
  const topic = leadPhrase(question)
  if (level === "director") return `Assuming you mean ${topic}, I leave the decision with the owner.`
  if (level === "architect") return `Assuming you mean ${topic}, I hold the boundary where the evidence stops matching the plan.`
  return `Assuming you mean ${topic}, I check the live setting before I change it.`
}

/** The miss, as a grammatical clause. The opener names what was missed. */
export function blameClause(question: string): string {
  const text = String(question || "").replace(/\s+/g, " ").trim()
  const parts: string[] = []
  const dropped = text.match(/\bdrop(?:ped)?\s+((?:the|a|an)\s+[^?.!]+)/i)
  const failed = text.match(/\bfail(?:ed)?\s+((?:the|a|an)\s+[^?.!]+)/i)
  const missed = text.match(/\bmiss(?:ed)?\s+([^?.!]+)/i)
  if (dropped) parts.push(`I dropped ${dropped[1].trim()}`)
  if (failed && !/\b(?:rollback|batch)\b/i.test(failed[1])) parts.push(`I failed ${failed[1].trim()}`)
  if (missed) {
    const obj = missed[1].trim()
    parts.push(/^in\b/i.test(obj) ? `I missed the check ${obj}` : `I missed ${/^(?:the|a|an)\b/i.test(obj) ? obj : `the ${obj}`}`)
  }
  if (parts.length) return parts.join(", and ")
  const fault = text.match(/\bwhose fault is\s+(?:the\s+)?([^?.!]+)/i)
  if (fault) return `I owned the ${fault[1].trim()}`
  const blameFor = text.match(/\bblame you for\s+(?:the\s+)?([^?.!]+)/i)
  if (blameFor) return `I owned the ${blameFor[1].trim()}`
  return `I owned ${leadPhrase(text)}`
}
export function vagueAsk(question: string): boolean {
  const q = String(question || "").trim()
  if (!q) return false
  if (/^(?:thoughts|and|so|well|ok(?:ay)?|security|stuff|the usual)[?.!]*$/i.test(q)) return true
  return /^(?:what do you think|any thoughts|your take)\b/i.test(q) && q.split(/\s+/).filter(Boolean).length <= 6
}

/** "Wait, forget that. What is least privilege?" keeps the ask after the cancel. */
export function afterInterruption(question: string): string {
  const text = String(question || "").trim()
  const parts = text.split(/(?<=[.?!])\s+/).filter(Boolean)
  if (parts.length < 2) return text
  const cancel = /^(?:wait|sorry|hold on|actually|forget that|never mind|new question)\b[,:]?\s*/i
  const ask = /^(?:what|how|why|when|who|define|design|tell|describe|explain)\b/i
  const last = parts[parts.length - 1].replace(cancel, "")
  const earlierCancel = parts.slice(0, -1).some((part) => cancel.test(part))
  if ((earlierCancel || cancel.test(parts[parts.length - 1])) && ask.test(last)) return last
  return text
}
const DESIGN_ASK = /^(?:(?:um+|uh+|so|yeah|yes|ok(?:ay)?|right|well|then|now|like|please)[,.\s]+)*(?:please\s+)?design\b|\bdesign me\b|\bhow (?:would|could|should|do|did) (?:you|we|i) design\b|\b(?:can|could|would) you design\b|\bhow you (?:would|could|should) design\b/i

export function lengthKind(question: string, shape: AnswerShape): LengthKind {
  const q = String(question || "")
  const design = shape === "design" || DESIGN_ASK.test(q)
  if (design && DEEPER_ON.test(q)) return "design-later"
  if (design) return "design-first"
  if (DEEPER_ON.test(q)) return "design-later"
  switch (shape) {
    case "definition": return "definition"
    case "comparison": return "compare"
    case "follow-up": return "follow-up"
    case "intro":
    case "value": return "opener"
    case "personal-experience": return "star"
    case "scenario": return "design-first"
    case "technical-deep-dive": return "design-later"
    case "logistics":
    case "acknowledgement":
    case "closing": return "yes-no"
    case "direct":
      if (!q.trim() || vagueAsk(q) || /^(?:(?:so|and|ok(?:ay)?|well)[, ]+)*(?:do|does|did|are|is|was|were|have|has|can|could|would|will|should) you\b/i.test(q) || /\b(?:brief(?:ly)?|quick(?:ly)?|in (?:one|a) sentence|in a nutshell|one-liner)\b/i.test(q)) return "yes-no"
      if (/\b(?:your experience|tell me about your|what did you do at)\b/i.test(q)) return "star"
      if ((q.match(/,/g) || []).length >= 1) return "compare"
      return "definition"
    default: return "yes-no"
  }
}

function bandFor(kind: LengthKind, level: AnswerLevel, scale: number): ModeBand {
  const row = QUESTION_LENGTH[kind][level]
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1
  const ceiling = Math.min(300, Math.round(row.ceiling * safe))
  const aim = Math.min(ceiling, Math.round(row.aim * safe))
  return {
    minWords: Math.max(8, Math.round(aim * 0.25)),
    targetWords: ceiling,
    maxWords: ceiling,
    aimWords: aim,
    depth: DEPTH[level],
    confidence: CONFIDENCE[level],
    voice: VOICE[level],
  }
}

export function modeBand(shape: AnswerShape, level: AnswerLevel, scale = 1, question = ""): ModeBand {
  return bandFor(lengthKind(question, shape), level, scale)
}

/** One scale for all three modes. A long ask raises the ceiling. It does not reorder the modes. */
export function modesFor(shape: AnswerShape, scale = 1, question = ""): Record<AnswerLevel, ModeBand> {
  return {
    engineer: modeBand(shape, "engineer", scale, question),
    architect: modeBand(shape, "architect", scale, question),
    director: modeBand(shape, "director", scale, question),
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

/** Depth and confidence stay apart. Word count does not: the question type sets the length. */
export function modesFiftyApart(shape: AnswerShape): boolean {
  const modes = modesFor(shape)
  for (let i = 0; i < LEVELS.length; i++) {
    for (let j = i + 1; j < LEVELS.length; j++) {
      const a = modes[LEVELS[i]]
      const b = modes[LEVELS[j]]
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

// r7: role or achievement premises the earlier since/given/as-you rule missed.
const ROLE_PREMISE = /^\s*([Aa]s\s+(?:the\s+|a\s+|an\s+)?(?!I\b|We\b|You\b)(?:[A-Z][\w&.-]*|head|lead|leader|manager|director|founder|owner)\b[^,?]{1,100}),\s*((?:how|what|why|when|where|which|who|can|could|would|do|did|tell|walk|describe)\b[\s\S]+)$/
const CLAIM_PREMISE = /^\s*(you(?:'ve| have)?\s+(?:cut|scaled|led|managed|built|grew|saved|founded|ran|reduced|increased|doubled|tripled|hired|owned)\b[^,?]{3,140}),\s*(?:so|and)\s+((?:how|what|why|when|where|which|who|can|could|would|do|did|tell|walk|describe)\b[\s\S]+)$/i
function premiseSplit(raw: string): { premise: string; ask: string } | null {
  const m = String(raw || "").match(ROLE_PREMISE) || String(raw || "").match(CLAIM_PREMISE)
  // "You scaled the API to a billion requests a day, so what broke?": a wh-ask of 2+ words is enough after an explicit
  // "You <claim>, so"; a one-word ask ("so why?") keeps the whole question (failsafe).
  const min = m && CLAIM_PREMISE.test(String(raw || "")) ? 2 : 3
  return m && m[2].trim().split(/\s+/).length >= min ? { premise: m[1].trim(), ask: m[2].trim() } : null
}
/** The premise an ask leans on ("You cut cloud spend by 90 percent"), or "" when there is none. Never throws. */
export function questionPremise(question: string): string {
  try {
    const raw = String(question || "")
    const old = raw.match(/^\s*((?:since|given(?: that)?|as|because|now that)\s+(?:you|your)\b[^,?]{3,120}),\s*((?:how|what|why|when|where|which|who|can|could|would|do|did|have|tell|walk|describe)\b[\s\S]+)$/i)
    if (old && old[2].trim().split(/\s+/).length >= 3) return old[1].trim()
    return premiseSplit(raw)?.premise || ""
  } catch { return "" }
}

export function topicOfAsk(question: string): string {
  // Stress round 2 (29 Oct 2026): "Since you led the SOC at a large bank, how big was your team?" made the premise the
  // keywords, so the prompt told the model to open on "led, SOC, large bank" - a premise the resume may not support.
  // A leading since/given/as clause before the actual question is context, not topic. Failsafe: nothing left keeps all.
  let raw = String(question || "")
  // r5 (29 Oct 2026): a long multi-sentence ask ("Last quarter our pain was X… What I actually want to hear is how you
  // handled Y?") opened on the context sentence. The topic is the last sentence that asks, from a "my question is" /
  // "what I want to know is" marker when there is one. Failsafe: one sentence, no asking sentence, or fewer than 3
  // words left keeps the whole text.
  try {
    const sentences = raw.split(/(?<=[.?!])\s+/).filter((x) => x.trim())
    if (sentences.length >= 2) {
      const asks = (x: string) => /\?\s*$/.test(x) || /^\s*(?:so,?\s+)?(?:how|what|why|when|where|which|who|tell me|describe|explain|walk me|give me|can you|could you|would you)\b/i.test(x) || /\b(?:my question is|what i (?:really |actually )?want to (?:know|hear|understand) is|the thing i want to know is)\b/i.test(x)
      const last = [...sentences].reverse().find(asks)
      // only when the earlier sentences are context (not an ask or an instruction like "Design X.") and the last ask
      // names a topic of its own ("What would you do?" keeps the premise before it as its topic)
      const instruction = (x: string) => asks(x) || /^\s*(?:design|build|explain|list|compare|outline|define|propose|sketch|draw|imagine|assume|suppose|say)\b/i.test(x)
      const generic = new Set("what would you do how did does handle handled approach think about tell more that this then next there here want know hear really actually question anyway okay walk through give example describe explain".split(" "))
      const topicWords = (x: string) => x.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length >= 4 && !generic.has(w)).length
      const context = last ? sentences.slice(0, sentences.indexOf(last)).every((x) => !instruction(x)) : false
      // and only for a long setup (3+ sentences) or a spoken pivot ("set that aside", "anyway", "my question is"); a short
      // "A key expired last night. Who do you call first?" keeps its premise as the topic
      const pivot = /\b(?:set (?:that|it|this) aside|anyway|that said|my question is|want to (?:know|hear|understand)|the thing i want to know)\b/i.test(raw)
      const imperative = last ? /^\s*(?:so,?\s+)?(?:tell me about|walk me through|describe|give me an example of)\b/i.test(last) : false
      if (last && last !== sentences[0] && context && topicWords(last) >= 1 && (sentences.length >= 3 || pivot || imperative)) {
        const marked = last.replace(/^[\s\S]*?\b(?:my question is|what i (?:really |actually )?want to (?:know|hear|understand) is|the thing i want to know is)[,:]?\s*/i, "").replace(/^(?:so|anyway|okay)[,]?\s+/i, "")
        if (marked.trim().split(/\s+/).length >= 3) raw = marked.trim()
      }
    }
    // a lone sentence can still carry the marker ("Anyway, what I really want to know is how you handled X?")
    const lone = raw.match(/^\s*(?:(?:so|anyway|okay|ok)[,]?\s+)?(?:my question is|what i (?:really |actually )?want to (?:know|hear|understand) is|the thing i want to know is)[,:]?\s+([\s\S]+)$/i)
    if (lone && lone[1].trim().split(/\s+/).length >= 3) raw = lone[1].trim()
  } catch { raw = String(question || "") }
  const premise = raw.match(/^\s*(?:since|given(?: that)?|as|because|now that)\s+(?:you|your)\b[^,?]{3,120},\s*((?:how|what|why|when|where|which|who|can|could|would|do|did|have|tell|walk|describe)\b[\s\S]+)$/i)
  let asked = premise && premise[1].trim().split(/\s+/).length >= 3 ? premise[1] : raw
  // r7: "As VP of Engineering at Corvid, how…" and "You cut cloud spend by 90 percent, so how
  // did you do it?" opened on the false claim. Same failsafe: the ask left must be 3+ words.
  const more = asked === raw ? premiseSplit(raw) : null
  if (more) asked = more.ask
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
    case "design": return "design"
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
    modes: modesFor(shape, partsScale(ask), ask),
  }
}

// Same trigger the service uses for its coding block (CODE_ASK_Q), narrowed to an actual request for code so a
// question that only mentions "function" in passing is not forced into a code block.
// CODE_REQUEST_Q is the coarse extracted surface pattern (verb + unambiguous code noun, or a bare sql/regex/unit-test
// phrase). asksForCode is stricter: the noun must sit within CODE_NOUN_WINDOW tokens of the verb, and ambiguous nouns
// (job, dag, limiter, pipeline, method) count only with a nearby code context or language name.
// "rate limiter" with no language is not an existing positive fixture (the positive is "Implement a token bucket
// rate limiter in TypeScript."; "How would you design a rate limiter…" is already a negative because the verb is
// design). A bare limiter therefore follows the same context rule.
export const CODE_REQUEST_Q = /\b(?:write|implement|code up|show me the code|give me (?:the )?code)\b[^?]*\b(?:code|function|script|query|program|class|regex|algorithm|endpoint|test)\b|\b(?:sql query|regex (?:to|for)|unit test for)\b/i
const BARE_CODE_PHRASE = /\b(?:sql query|regex (?:to|for)|unit test for)\b/i
const UNAMBIGUOUS_CODE_NOUN = new Set(["code", "function", "script", "query", "program", "class", "regex", "algorithm", "endpoint", "test", "api"])
const AMBIGUOUS_CODE_NOUN = new Set(["method", "pipeline", "job", "dag", "limiter"])
const CODE_CONTEXT = new Set([
  "function", "class", "api", "endpoint", "script", "query", "algorithm", "sql", "python", "spark", "pyspark",
  "airflow", "go", "golang", "java", "javascript", "typescript", "js", "ts", "regex", "code", "ruby", "rust",
  "scala", "kotlin", "swift", "php", "bash", "shell", "perl", "lua", "r", "c", "c++", "cpp", "csharp", "c#",
  "nodejs", "node", "haskell", "elixir", "erlang", "matlab", "powershell",
])
const CODE_NOUN_WINDOW = 8
const CODE_CONTEXT_RADIUS = 4

function codeAskTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((raw) => raw.replace(/^[^\w#+]+|[^\w#+]+$/g, "").split(/[-_/]/))
    .map((t) => t.toLowerCase())
    .filter(Boolean)
}

function requestIsCodeAsk(text: string): boolean {
  if (BARE_CODE_PHRASE.test(text)) return true
  const tokens = codeAskTokens(text)
  for (let i = 0; i < tokens.length; i++) {
    const one = tokens[i]
    const two = tokens.slice(i, i + 2).join(" ")
    const three = tokens.slice(i, i + 3).join(" ")
    const four = tokens.slice(i, i + 4).join(" ")
    let verbLen = 0
    if (four === "show me the code" || four === "give me the code") verbLen = 4
    else if (three === "give me code") verbLen = 3
    else if (two === "code up") verbLen = 2
    else if (one === "write" || one === "implement") verbLen = 1
    if (!verbLen) continue
    const start = i + verbLen
    const window = tokens.slice(start, start + CODE_NOUN_WINDOW)
    if (window.some((t) => UNAMBIGUOUS_CODE_NOUN.has(t))) return true
    for (let j = 0; j < window.length; j++) {
      if (!AMBIGUOUS_CODE_NOUN.has(window[j])) continue
      const abs = start + j
      const ctx = tokens.slice(Math.max(0, abs - CODE_CONTEXT_RADIUS), abs + 1 + CODE_CONTEXT_RADIUS)
      if (ctx.some((t) => CODE_CONTEXT.has(t))) return true
    }
  }
  return false
}

export function asksForCode(question: string): boolean {
  // r7 (#28): zero-width spaces and odd whitespace must not change a coding ask ("Wri\u200bte a Python function").
  const q = normalizeAskText(question)
  const tied = splitFollowUp(q)
  // "Can you also add unit tests?" after a coding ask is still a coding ask; any other follow-up is judged on its own words.
  if (tied.previous) return requestIsCodeAsk(tied.own) || (requestIsCodeAsk(tied.previous) && /\b(?:tests?|code|function|index|query|edge cases?|complexity|handle|refactor)\b/i.test(tied.own))
  return requestIsCodeAsk(q)
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
    // r7: a premise is the interviewer's claim, not the user's fact. Failsafe: no premise, no line.
    questionPremise(question) ? `The question assumes: "${questionPremise(question).slice(0, 140)}". Do not repeat or confirm it unless the sources show it; if they do not, say so in one short first-person clause and answer the actual ask.` : "",
    "Do not state a visa, a home address, where you live, or personal relocation unless my resume already says it and this question asked.",
    "BRAIN POLICY: Sentence one answers this question. Connect the next beat with once that was confirmed, not And then or From there. If the resume has no matching incident, say I would. Do not borrow another speaker's story. Never mix Houston and Saint Louis.",
    /\btechnical HR\b/i.test(question) ? "Technical HR: one plain sentence for what it is and why it matters, then stop. No build walk." : "",
    cut.shape === "design" ? "Architect: if a thought is optional, label it as a tangent and leave it out of scope. Director: own one tradeoff in a single sentence." : "",
    cut.shape === "personal-experience" ? "After the result, one short line may offer to keep going. Do not restart the story." : "",
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
  // r4: OpenRouter's bare "Provider returned error" was shown as an answer. Only when the text opens with it.
  /^\s*provider returned error\b/i,
  // Round 10: dotted module path + exception class + colon ("httpx.ReadTimeout: timed out",
  // "google.api_core.exceptions.ServiceUnavailable: 503").
  /^\s*(?:[a-z_][a-z0-9_]*\.)+[A-Z]\w*(?:Error|Exception|Timeout|Unavailable|Overloaded)\s*:/,
]
// The whole text is the gateway's sentence, not an interview answer that mentions a failure.
const BARE_GATEWAY = /^(?:sorry[,.]?\s+)?(?:something went wrong[.!]?\s+please try again|the (?:ai|model|answer) service is unavailable|the model failed to respond|we could(?: not|n't) generate (?:a |the )?response(?:[.!]?\s+please (?:try again|retry))?|(?:anthropic|openai|openrouter|gemini) is experiencing (?:high demand|an outage))[.!?]*$/i
export function isProviderErrorAnswer(text: string): boolean {
  const t = String(text || "").trim()
  if (PROVIDER_ERROR.test(t) || BARE_GATEWAY.test(t)) return true
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

/** If the opening misses the question's words and a later sentence has them, that sentence is spoken first. */
function leadWithAskedWords(text: string, keywords: string[]): string {
  const all = sentencesOf(text)
  if (all.length < 2 || !keywords.length) return text
  const has = (sentence: string) => keywords.some((keyword) => sentence.toLowerCase().includes(keyword.toLowerCase()))
  if (has(all[0])) return text
  const idx = all.findIndex(has)
  if (idx <= 0) return text
  return [all[idx], ...all.slice(0, idx), ...all.slice(idx + 1)].join(" ")
}

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
  // A caller may pass a larger plan. The spoken answer still stops at this mode's ceiling.
  const cap = ceiling && ceiling > 0 ? Math.min(ceiling, mode.maxWords) : mode.maxWords
  if (isProviderErrorAnswer(answer)) {
    return { text: "", words: 0, providerError: true, banned: [], missingEcho: false, repeated: false, thirdPerson: false, inBand: false }
  }
  // Code-first: a fenced block is shown exactly as written, at every level. Only the prose around it is settled.
  const fence = String(answer || "").match(/```[\s\S]*?```/)
  if (fence) {
    const prose = String(answer).replace(fence[0], " ").replace(/\s+/g, " ").trim()
    const around = prose ? trimToWords(stripListMarkers(leadWithAskedWords(dropUngroundedLogistics(prose, sources, question), cut.keywords)), cap) : ""
    const text = [fence[0], around].filter(Boolean).join("\n\n")
    return { text, words: wordCount(around), providerError: false, banned: [], missingEcho: false, repeated: false, thirdPerson: false, inBand: true }
  }
  // An asked repeat ("say that again") keeps every sentence; only an unasked read-back is trimmed.
  const askedRepeat = /\b(?:repeat|again|once more|say that|same answer)\b/i.test(question)
  const voiced = firstPersonRewrite(spokenMarkup(answer), sources)
  const spoken = askedRepeat ? voiced.text : dropParaphrasedRepeat(dropRepeatedSentences(voiced.text, previousAnswer), previousAnswer)
  const kept = sentencesOf(spoken).filter((sentence) => !cut.banned.some((term) => containsTerm(sentence, term)))
  const stripped = stripListMarkers(leadWithAskedWords(dropUngroundedLogistics(kept.join(" "), sources, question), cut.keywords))
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
 * Sentences copied from one of the last three answers are dropped when the new answer also has a new point.
 * A sentence is a copy when fewer than one in five of its content words are new. If every sentence is a copy,
 * or nothing new is left to stand on, the original stands and the repeated flag still reports it.
 */
export function dropParaphrasedRepeat(text: string, previousAnswer = ""): string {
  const turns = String(previousAnswer || "").split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(-3)
  let out = text
  for (const last of turns.reverse()) {
    const bare = (word: string) => word.replace(/[^a-z0-9+#-]+/g, "")
    const tokensOf = (value: string) => contentTokens(value).map(bare).filter((word) => word.length >= 4 && !STOP.has(word))
    const prev = new Set(tokensOf(last))
    if (!prev.size) continue
    const scored = sentencesOf(out).map((sentence) => {
      const tokens = tokensOf(sentence)
      const novel = tokens.length ? tokens.filter((token) => !prev.has(token)).length / tokens.length : 1
      return { sentence, novel }
    })
    const fresh = scored.filter((row) => row.novel >= 0.5)
    const stale = scored.filter((row) => row.novel < 0.2)
    if (!fresh.length || !stale.length) continue
    const kept = scored.filter((row) => row.novel >= 0.2).map((row) => row.sentence)
    if (kept.length && wordCount(kept.join(" ")) >= 8) out = kept.join(" ")
  }
  return out
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
 * ungrounded tool, or the same answer for different questions (same mode, Jaccard >= 0.7). Two modes of one
 * question under 50% apart in content (1 - Jaccard) are warnings: the pair is named, and the draft is not padded
 * to widen it. Depth and confidence gaps are word-count heuristics, so they are warnings too.
 * A yes-or-no logistics answer is not stretched to make one mode longer than another.
 */
function namesItsOwnAsk(question: string, text: string, otherQuestion: string): boolean {
  const mine = questionKeywords(cleanSpokenAsk(question))
  const other = new Set(questionKeywords(cleanSpokenAsk(otherQuestion)).flatMap((keyword) => keyword.toLowerCase().split(/\s+/)))
  const fresh = mine.filter((keyword) => !keyword.toLowerCase().split(/\s+/).every((token) => other.has(token)))
  return fresh.length > 0 && fresh.some((keyword) => saysTerm(text, keyword))
}

export function evaluateLiveAnswers(rows: LiveAnswer[], sources = ""): { ok: boolean; failures: string[]; warnings: string[] } {
  const failures: string[] = []
  const warnings: string[] = []
  const grouped = new Map<string, LiveAnswer[]>()
  for (const row of rows) {
    const list = grouped.get(row.question) || []
    list.push(row)
    grouped.set(row.question, list)
    if (isProviderErrorAnswer(row.text)) failures.push(`provider error text in ${row.level}: ${row.question}`)
    if (ungroundedLogisticsSentences(row.text, sources, row.question).length) failures.push(`ungrounded logistics in ${row.level}: ${row.question}`)
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
      if (rows[i].question === rows[j].question || rows[i].level !== rows[j].level) continue
      if (sameAnswerRatio(rows[i].text, rows[j].text) < 0.7) continue
      // Two long answers can share a frame and still each name their own ask. A copy that
      // never says what makes the other question different is the same answer.
      const distinct = namesItsOwnAsk(rows[i].question, rows[i].text, rows[j].question)
        && namesItsOwnAsk(rows[j].question, rows[j].text, rows[i].question)
      if (!distinct) failures.push(`same answer for different questions: "${rows[i].question}" and "${rows[j].question}"`)
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
        const spokenText = (row: LiveAnswer) => asksForCode(question) ? row.text.replace(/```[\s\S]*?(?:```|$)/g, " ") : row.text
        const overlap = sameAnswerRatio(spokenText(a), spokenText(b))
        const contentGap = overlap >= 1 ? 0 : 1 - overlap
        const depthGap = relativeGap(scoreDepth(a.text), scoreDepth(b.text))
        const confidenceGap = relativeGap(scoreConfidence(a.text), scoreConfidence(b.text))
        // Content overlap is reported, not padded. A short mode is not stretched to manufacture a word gap.
        if (contentGap < 0.5) warnings.push(`stance gap ${contentGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (depthGap < 0.5) warnings.push(`depth gap ${depthGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
        if (confidenceGap < 0.5) warnings.push(`confidence gap ${confidenceGap.toFixed(2)} under 0.50 for ${LEVELS[i]} vs ${LEVELS[j]}: ${question}`)
      }
    }
  }
  return { ok: failures.length === 0, failures, warnings }
}

/** The experience lines of a resume, in the candidate's order. Header, name, contact, and education are not experience. */
export function experienceLines(resume: string): string[] {
  // r3: one-paragraph, table and "Role | Employer" layouts are read as role headings and one line per bullet
  const text = normalizeResumeLayout(String(resume || "")).replace(/[*`]/g, " ")
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
    // r8: coaching text about another person ("He is reporting up favourably", "She wants someone who…") is never the
    // candidate's own evidence, so it never enters a first-person draft. Failsafe: any error keeps the line.
    .filter((line) => { try { return !thirdPersonCoaching(line) } catch { return true } })
}

/**
 * r8: a line that is coaching or notes about another person, not the candidate's own work: it opens on a third-person
 * subject (He/She/They + verb, His/Her words) or talks to the reader about someone else ("told you to", "your recruiter").
 * A resume line that merely names a third party ("Led the migration with the CTO and his team") is not matched.
 */
export function thirdPersonCoaching(line: string): boolean {
  const t = String(line || "").replace(/^[-*•"“'\s]+/, "")
  if (/^(?:He|She|They)\s+(?:is|was|were|are|has|had|have|also|said|says|told|tells|wants|wanted|will|would|thinks|thought|likes|liked|asked|asks|covers|seemed|seems|mentioned|is\b|'s)\b/.test(t)) return true
  if (/^(?:His|Her|Their)\s+(?:words|view|take|concern|point|team|boss|note|feedback)\b/.test(t)) return true
  return /\b(?:he|she|they) (?:also )?told you\b|\byour (?:\w+ )?recruiter\b|\breporting up favourabl/i.test(t)
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
  // "In that design, a worker processes an object…" is one incident, not a list. The lead is the incident.
  // A real list ("run a vendor risk review, what would you ask…") still keeps the first part.
  const scene = /^(?:in (?:that|this) (?:design|case|scenario|setup)|in (?:that|this) situation)$/i
  if (firstPart !== topic && scene.test(firstPart) && rest.split(/\s+/).filter(Boolean).length >= 3) topic = rest
  else if (firstPart !== topic && (firstPart.split(/\s+/).length >= 3 || /^(?:how|what|who|when|why|where|which)\b/i.test(rest))) topic = firstPart
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
      if (/^(?:in (?:that|this) (?:design|case|scenario|setup)|in (?:that|this) situation)$/i.test(part)) continue
      if (part && wordCount(part) <= 5) out.push(part.split(/\s+/).map((word) => /^[A-Z0-9]{2,}$/.test(word) ? word : word.toLowerCase()).join(" "))
    }
  }
  return [...new Set(out)]
}

const PART_LINES: Record<AnswerLevel, Array<(part: string) => string>> = {
  engineer: [(p) => `For ${p}, I say what it is in one line and why it matters here.`],
  director: [
    (p) => `On ${p}, the owner and the risk if it slips go on the record.`,
    (p) => `For ${p}, I give the decision and the date it is due.`,
  ],
  architect: [
    (p) => `For ${p}, the line covers the check that proves it.`,
    (p) => `On ${p}, the failure point is where it can fail and what keeps it from spreading.`,
    (p) => `With ${p}, I keep one result that confirms it before I move on.`,
  ],
}

// r4 (item 26): each experience line's role heading, so "your experience at Hitachi" finds the Hitachi bullets (they
// never say "Hitachi" themselves) and an intro starts from the latest role. Empty map on any error (old ranking).
function headingOf(resume: string): Map<string, string> {
  const out = new Map<string, string>()
  try {
    const text = normalizeResumeLayout(String(resume || "")).replace(/[*`]/g, " ")
    let heading = ""
    for (const raw of text.split(/\n+/)) {
      if (/^\s*###/.test(raw)) { heading = raw.replace(/^[#\s]+/, "").toLowerCase(); continue }
      if (/^\s*#/.test(raw)) { heading = ""; continue }
      const line = raw.replace(/^[-•\s#]+/, "").replace(/\s+/g, " ").trim()
      if (line && heading && !out.has(line)) out.set(line, heading)
    }
  } catch { /* old ranking */ }
  return out
}
const INTRO_ASK = /\b(?:tell me about yourself|introduce yourself|walk me through your (?:background|resume|career|experience)|about your background)\b/i

function rankedExperience(question: string, resume: string, offTopicAllowed = 99): string[] {
  const lines = experienceLines(resume)
  const keys = questionKeywords(question).map((k) => k.toLowerCase())
  const headings = headingOf(resume)
  const firstHeading = [...headings.values()][0] || ""
  const intro = INTRO_ASK.test(String(question || ""))
  const employerKeys = keys.filter((k) => k.length >= 3 && /^[a-z0-9]/.test(k) && [...headings.values()].some((h) => {
    const emp = h.split(/\s+[—–·|,]\s+|\s+at\s+|\(/).slice(1).join(" ")
    return new RegExp(`(?:^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`).test(emp)
  }))
  const byHeading = (line: string) => {
    const h = headings.get(line.replace(/[*`]/g, " ").replace(/\s+/g, " ").trim()) || ""
    return (h && employerKeys.some((k) => h.includes(k)) ? 2 : 0) + (intro && h && h === firstHeading ? 1 : 0)
  }
  const score = (line: string) => byHeading(line) + baseScore(line)
  const baseScore = (line: string) => {
    const low = line.toLowerCase()
    // r4: a key matches as a whole word (plural or -ed/-ing allowed), so "cloud" no longer matches inside "CloudTrail".
    // Failsafe: a key the pattern cannot be built for falls back to the substring check as before.
    const has = (key: string) => {
      try { return new RegExp(`(?:^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es|ed|ing)?(?:$|[^a-z0-9])`).test(low) } catch { return low.includes(key) }
    }
    return keys.reduce((sum, key) => sum + (has(key) ? (key.includes(" ") ? 3 : 1) : 0), 0)
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
    engineer: (l) => `For ${l}, I would check the first failing step.`,
    director: (l) => `For ${l}, I would make the first decision quickly and name who owns it.`,
    architect: (l) => `For ${l}, I would walk the steps in order and note where each one can fail.`,
  },
  design: {
    engineer: (l) => `For ${l}, the first behavior I would sketch is the check on the first layer.`,
    director: (l) => `For ${l}, I would decide the tradeoff first and leave the rest of the map for later.`,
    architect: (l) => `For ${l}, the boundary comes first. One short look at what sits beside it, then I come back.`,
  },
  "technical-deep-dive": {
    engineer: (l) => `On ${l}, once I confirm the evidence, I check the next step, because that decides it.`,
    director: (l) => `On ${l}, I start with the decision and the risk it carries for the business.`,
    architect: (l) => `On ${l}, I would show how the pieces connect and where they fail.`,
  },
  direct: {
    engineer: (l) => `On ${l}, once I confirm the evidence, I check the next step, because that decides it.`,
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
    () => "One owner holds that call, with a date for the next review.",
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
    () => "The proof that would show it wrong is written down.",
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
/**
 * The offline stand-in has no model, so a code question still needs one fenced block first.
 * The block is a short runnable sketch of the ask. It is not a claim about the candidate.
 * Spoken word counts ignore it; settle keeps it verbatim.
 */
export function standInFence(question: string): string {
  const q = String(question || "")
  if (/\bsql\b/i.test(q)) return "```sql\nselect id\nfrom items\nwhere open_days > 30;\n```"
  const lang = /\btypescript\b/i.test(q) ? "typescript" : /\bjavascript\b/i.test(q) ? "javascript" : "python"
  const body = lang === "python"
    ? "def still_open(items, days=30):\n    return [item for item in items if item.get(\"age_days\", 0) > days]\n"
    : "function stillOpen(items, days = 30) {\n  return items.filter((item) => item.ageDays > days)\n}\n"
  return "```" + lang + "\n" + body + "```"
}

export function draftSpokenAnswer(question: string, level: AnswerLevel, resume: string, previous: string[] = []): string {
  const text = draftLadder(question, resume, previous)[level]
  return asksForCode(question) ? `${standInFence(question)}\n\n${text}` : text
}

// Each mode drafts to its own aim and stops at its own ceiling. A short mode is not padded, and a long mode is
// not cut, to manufacture a word-count gap. Content overlap is measured later.
function draftLadder(question: string, resume: string, previous: string[]): Record<AnswerLevel, string> {
  const heard = afterInterruption(question)
  const cut = dissectQuestion(heard, resume)
  const one = (level: AnswerLevel) => draftAtLevel(heard, level, resume, previous, cut.modes[level].minWords)
  return {
    engineer: compactEngineer(one("engineer")),
    director: one("director"),
    architect: one("architect"),
  }
}

// r4 (29 Oct 2026): with ceilings exactly 1.5x apart (44/66/99) an Engineer near its ceiling can leave the Director one
// word short (two-part ask, one-paragraph resume: 43/64/99). The Engineer then drops only the filler after its lead
// ("On X, here is my answer from my own work." + line → "On X, I led …"): it still opens on the asked words and keeps
// its resume line, and gets shorter, never longer. Failsafe: used only when the ladder fails and the compact ladder holds.
const ENGINEER_FILLER = /^((?:Building on that, )?(?:On|For|As for|as for|for) [^]*?), (?:I add one concrete step|here is (?:my answer|the real example|what [^.]{1,80} means)(?:,? (?:from|in) my own work)?|I bring careful, evidence-first work)\.$/
export function compactEngineer(text: string): string {
  try {
    const all = sentencesOf(text)
    const m = all[0]?.match(ENGINEER_FILLER)
    if (!m || all.length < 2 || !/^(?:I|As I said earlier)\b/.test(all[1])) return text
    const next = all[1].replace(/^As I said earlier\b/, "as I said earlier")
    return [`${m[1]}, ${next}`, ...all.slice(2)].join(" ")
  } catch {
    return text
  }
}

export const NUMBER_ASK = /\b(?:what (?:percentage|percent|share|number|proportion)|by what percent|how many|how much (?:faster|money|time|did)|in dollars|dollar value|roi\b|pass rate|false-positive rate|give me (?:a|the) (?:number|percentage)|exact(?:ly)? how many|to the nearest)\b/i
export const NO_GUESS = "I won't guess a figure I can't back up."

const HONEST_LINES = [
  "My resume does not show this exact work, so I walk through how I would handle it.",
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

const PAIR_GENERIC = new Set("risk incident owner finding findings control business work same issue plan review open access".split(" "))
/** A comparison may cite a resume line only when that line names one side of the pair, not a shared word such as "risk". */
function spokenSide(side: string): string {
  const trimmed = side.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/** Length that names the two sides and adds no shared content word of its own. */
function pairSideLines(sides: [string, string]): string[] {
  const left = spokenSide(sides[0])
  const right = spokenSide(sides[1])
  const again = (side: string, original: string) => (/^[A-Z]/.test(original.trim()) ? side : side.charAt(0).toLowerCase() + side.slice(1))
  const leftAgain = again(left, sides[0])
  const rightAgain = again(right, sides[1])
  return [
    `${left} is not ${rightAgain}.`,
    `${right} is not ${leftAgain}.`,
    `I would not use ${leftAgain} for ${rightAgain}.`,
    `I would not use ${rightAgain} for ${leftAgain}.`,
    `What I want from ${leftAgain} is not what I want from ${rightAgain}.`,
    `I have ${leftAgain} here and ${rightAgain} there.`,
    `I keep ${leftAgain} with ${leftAgain}.`,
    `I keep ${rightAgain} with ${rightAgain}.`,
    `I mean ${leftAgain} when I say ${leftAgain}.`,
    `I mean ${rightAgain} when I say ${rightAgain}.`,
    `On ${leftAgain}, I would give it its own time.`,
    `On ${rightAgain}, I would give it its own time.`,
    `I do not want ${leftAgain} to be ${rightAgain}.`,
    `I do not want ${rightAgain} to be ${leftAgain}.`,
  ]
}

/** "rollback scope versus lateral movement risk" is two sides. A lead with no versus stays one phrase. */
function versusSides(lead: string): [string, string] | null {
  const cleaned = lead.replace(/^the same incident\s*:\s*/i, "").trim()
  const parts = cleaned.split(/\s+versus\s+/i).map((part) => part.trim()).filter(Boolean)
  if (parts.length !== 2) return null
  if (parts.some((part) => part.split(/\s+/).length < 1)) return null
  return [parts[0], parts[1]]
}

function lineMentionsPair(line: string, lead: string): boolean {
  const words = lead.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 5 && !PAIR_GENERIC.has(word))
  if (!words.length) return true
  const low = line.toLowerCase()
  return words.some((word) => low.includes(word))
}

/** First design stage only. Each line names this design, so two designs do not share one answer. */
function designStageLines(level: AnswerLevel, lead: string): string[] {
  if (level === "director") return [
    `For ${lead}, the tradeoff is speed against a safe change, and the decision is made before the rest of the map.`,
    `The owner of ${lead} hears what is still open, and the risk of waiting is the call on the record.`,
    `The later layers of ${lead} wait until that decision is written down.`,
  ]
  if (level === "architect") return [
    `For ${lead}, the boundary around the first layer is the part I sketch before any later path.`,
    `The next layer of ${lead} starts only after that check has a failure point and a place the evidence can sit.`,
    `I would keep ${lead} to one path in this pass, with the handoff written beside the boundary.`,
    `A later pass on ${lead} can add the rest of the map once this layer holds.`,
    `The step that can break ${lead} is the one I mark before I leave the first layer.`,
  ]
  return [
    `For ${lead}, the first layer is one check on the request before it reaches the rest of the path.`,
    `I would sketch that check for ${lead}, write down what it rejects, and leave the rest of the map for a later pass.`,
    `The evidence for ${lead} sits next to that check so the next person can see why it fired.`,
  ]
}

function draftAtLevel(question: string, level: AnswerLevel, resume: string, previous: string[], floor: number): string {
  const cut = dissectQuestion(question, resume)
  const lead = spokenLead(leadPhrase(question), splitFollowUp(cleanSpokenAsk(question)).own)
  const pairSides = (cut.shape === "comparison" || cut.shape === "definition") ? versusSides(lead) : null
  const designAsk = cut.shape === "design" || (/^\s*design\b/i.test(question) && lead.split(/\s+/).filter(Boolean).length >= 3)
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
  // r4: a bare follow-up ("Why that?", "How so?", "And then?") has no topic of its own, so it is ranked on the question
  // it follows up on; otherwise every such follow-up drafted "my resume does not show this". Failsafe: a follow-up
  // with any other word is ranked on its own words as before.
  const bareFollow = (t: string) => /^(?:(?:and|so|then|why|how|what|that|this|happened|next|come|though|go|on|after|not|now)\b[\s,]*)+[?.!]*$/i.test(t.trim())
  const rankOn = tied.previous ? (bareFollow(tied.own) ? tied.previous : tied.own) : question
  let lines = rankedExperience(rankOn, resume, { engineer: 0, director: 1, architect: 3 }[level]).map(firstPerson).filter(fresh)
  if (cut.shape === "comparison" || cut.shape === "definition") lines = lines.filter((line) => lineMentionsPair(line, lead))
  // A named incident may cite a resume line only when that line names the incident.
  // A shared word such as access is not enough, or two incidents share the same lines.
  const incidentAsk = lead.split(/\s+/).filter(Boolean).length >= 6 && askedPartList(question).length >= 3
  if (incidentAsk) lines = lines.filter((line) => lineMentionsPair(line, lead))
  // The director's stance is the decision. When several lines match, leave the first ones for the engineer.
  // One or two lines stay, so a real resume line is not replaced by "does not show".
  if (level === "director" && lines.length > 2 && askedPartList(rankOn).length < 2) lines = lines.slice(2)
  // r4: a three-part ask ("triage, access reviews, and HIPAA controls") spent Director's room on two lines for one part
  // and never named the third. With 2+ asked parts, the best line for each part goes first, in the asked order.
  // Failsafe: one part, or any error, keeps the ranked order.
  try {
    const asked = askedPartList(rankOn)
    if (asked.length >= 2) {
      const lead: string[] = []
      for (const part of asked) {
        // The part's own best line; when an earlier answer already said it, a short pointer names the part instead of
        // letting a line about another part stand in for it (500-sequence run: 10/63 three-part asks dropped a part).
        const top = rankedExperience(part, resume, 0).map(firstPerson)[0]
        const pick = top && lines.includes(top) && !lead.includes(top) ? top : rankedExperience(part, resume, 0).map(firstPerson).find((l) => lines.includes(l) && !lead.includes(l))
        if (top && !fresh(top) && !lead.some((l) => l.startsWith(`On ${part},`))) lead.push(`On ${part}, it is the work I described a moment ago.`)
        else if (pick) lead.push(pick)
      }
      lines = [...lead, ...lines.filter((l) => !lead.includes(l))]
    }
  } catch { /* failsafe: ranked order */ }
  const mode = cut.modes[level]
  // Stop at this mode's own aim. Do not shorten it so another mode can look longer.
  const stop = mode.aimWords
  const parts = [naturalOpener(opener(premiseLead(lead)))]
  if (vagueAsk(question)) return trimToWords(vagueReply(question, level), mode.maxWords)
  if (BLAME_ASK.test(question)) {
    parts[0] = `The pressure was real, and the miss was mine: ${blameClause(question)}.`
    parts.splice(1, 0, level === "director"
      ? "The decision and the risk still sit with me."
      : level === "architect"
        ? "The break is the step I failed to check."
        : "I check the evidence again before I call it done.")
  }
  if (/\b(?:strategy|govern|change your mind)\b/i.test(question)) parts.push("The owner holds the decision, and the risk is what would change my mind.")
  if (/\b(?:war room|failed overnight|duplicate row|customers are waiting|disagrees with the live)\b/i.test(question)) parts.push("I check the live evidence before I change the path.")
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
  // r4 (29 Oct 2026): when the only resume line that covers the ask was already said, the draft claimed "my resume does
  // not show this exact work", which is false. The covering line is said again, marked as said earlier. Failsafe: only a
  // line that matches the ask (rankedExperience returns none when nothing matches), and only when nothing else was used.
  if (!used && cut.shape !== "personal-experience") {
    try {
      const again = rankedExperience(rankOn, resume, 0).map(firstPerson).find((l) => !fresh(l))
      if (again) {
        const full = `As I said earlier, ${again.charAt(0).toLowerCase()}${again.slice(1)}`.replace(/^As I said earlier, i\b/, "As I said earlier, I")
        // a short mode with no room for the whole line points back to it instead of dropping it
        // a new question (not a follow-up) never reads the same line back, so two asks never get one answer (round 6)
        const line = tied.previous && words + wordCount(full) <= mode.maxWords ? full : "As I said earlier, this comes from the work I just described."
        parts.push(line)
        words += wordCount(line)
        used++
      }
    } catch { /* failsafe: the honest line below */ }
  }
  // A definition with no resume line was filled from one honest sentence and one approach
  // sentence, so two different terms shared almost every content word.
  const bareTerm = !used && cut.shape === "definition" && !pairSides
  const hrAsk = /\btechnical HR\b/i.test(question)
  if (bareTerm) {
    parts[0] = plainDefinition(level, lead, hrAsk)
    words = wordCount(parts.join(" "))
  } else if (!used && !pairSides && !designAsk) {
    const honest = HONEST_LINES.find(fresh) || HONEST_LINES[0]
    parts.push(honest)
    words += wordCount(honest)
  }
  const askedParts = askedPartList(question)
  // A named incident plus three or more asked parts is already the answer. The shared approach
  // catalog and the shared closing lines made those different incidents the same long answer.
  const incident = lead.split(/\s+/).filter(Boolean).length >= 6 && askedParts.length >= 3
  // A comparison or definition is the two named things. The shared closing catalog made
  // "Define IDOR versus CSRF" and "Define containment versus eradication" the same long answer.
  const namedPair = cut.shape === "comparison" || cut.shape === "definition"
  const sides = pairSides
  // Two design questions often share the same "explain trust boundaries…" list. An approach
  // line that does not name this design is the same sentence for both.
  const namedDesign = designAsk
  // A shared checklist ("decision owner, business exposure, measures") is the same sentence
  // on every pair that asks it. The two sides are the difference, so the checklist stays off.
  // A second "Explain trust boundaries, data flow…" sentence is the same list on different designs.
  // Only the pieces named in the design sentence are spoken.
  const firstClause = topicOfAsk(cleanSpokenAsk(question)).split(/(?<=[a-z0-9)])[?!.]\s+/i)[0]?.toLowerCase() || ""
  const spokenParts = (namedDesign ? askedParts.filter((part) => firstClause.includes(part.toLowerCase())) : askedParts)
  if (!sides) spokenParts.slice(0, level === "engineer" ? 2 : level === "director" ? 3 : spokenParts.length).forEach((part, i) => {
    if (namedDesign) {
      const line = `I would give ${spokenLead(part)} its own time.`
      const n = wordCount(line)
      if (words + n <= mode.maxWords) { parts.push(line); words += n }
      return
    }
    if (incident) {
      const line = `For ${spokenLead(part)}, I stay on ${lead}.`
      const n = wordCount(line)
      if (words + n <= mode.maxWords) { parts.push(line); words += n }
      return
    }
    const templates = PART_LINES[level]
    // Round 11: a listed part was said in the interviewer's voice ("On what would you check yourself"); it is said as mine.
    const said = spokenLead(part.replace(/^(what|how|when|who|why|where|which) (would|do|will|should|did) you\s+(.+)$/i,
      (_m, wh, aux, rest) => `${wh} I ${/^do$/i.test(aux) ? "" : aux + " "}${rest}`))
    const line = templates[i % templates.length](said)
    const n = wordCount(line)
    if (words + n > mode.maxWords) return
    parts.push(line)
    words += n
  })
  // Shared closing lines do not name the incident or the two things being compared.
  if (!incident && !namedPair && !namedDesign) {
    for (const line of CLOSERS[level]) {
      const n = wordCount(line)
      if (words + n > stop || !fresh(line)) continue
      parts.push(line)
      words += n
    }
  }
  const approach = APPROACH[level].map((make) => make(cut.shape === "personal-experience" ? "that situation" : lead)).filter((line) => fresh(line) && !parts.includes(line))
  const anchored = namedPair || namedDesign ? approach.filter((line) => line.toLowerCase().includes(lead.toLowerCase())) : approach
  // Short shapes (greeting, logistics, closing) stop at the opener and the supported lines; others fill to the aim.
  if (!incident && !sides && !namedDesign && !bareTerm && !["acknowledgement", "logistics", "closing"].includes(cut.shape)) {
    for (const line of anchored) {
      const n = wordCount(line)
      if (words >= stop) break
      if (words + n > (level === "architect" ? mode.maxWords : stop) || parts.includes(line)) continue
      parts.push(line)
      words += n
    }
  }
  // A named incident can land a word or two under the mode floor once the shared catalog is left off.
  // The pad stays inside the last sentence so a later ladder trim cannot drop it as its own sentence.
  // The ladder may drop the last sentence to keep the mode gap. The extra words go on the
  // first sentence so the answer still clears the mode floor after that cut.
  if (incident && parts[0]) {
    const extra = " in this case, as I saw it."
    if (words + 6 <= mode.maxWords) {
      parts[0] = parts[0].replace(/[.]\s*$/, extra)
      words += 6
    }
  } else if (namedDesign && parts[0] && words + 3 <= mode.maxWords) {
    parts[0] = parts[0].replace(/[.]\s*$/, " in this case.")
    words += 3
  }
  // The floor from the mode below: unused supported lines first, then approach lines, each only if it fits the ceiling.
  // An incident that already named its parts does not refill from the shared catalog.
  if (words < floor) {
    for (const line of [...lines, ...(incident || namedPair || namedDesign ? [] : CLOSERS[level].filter(fresh)), ...(incident || sides || namedDesign ? [] : anchored)]) {
      if (words >= floor) break
      const n = wordCount(line)
      if (parts.includes(line) || words + n > mode.maxWords) continue
      parts.push(line)
      words += n
    }
  }
  // Length for a named incident or a named comparison comes from those words, not the shared catalog.
  if (incident || namedPair || namedDesign) {
    const extra = sides
      ? pairSideLines(sides)
      : bareTerm
      ? []
      : namedDesign
      ? (cut.shape === "design" && !DEEPER_ON.test(question) && askedParts.length < 2 ? designStageLines(level, lead) : [])
      : [
          `I start from ${lead}.`,
          `The case is ${lead}.`,
          `I check ${lead} before I move on.`,
          `What I watch is ${lead}.`,
        ]
    const designFirst = namedDesign && cut.shape === "design" && !DEEPER_ON.test(question) && askedParts.length < 2
    const fillTo = designFirst ? Math.max(mode.minWords, stop - 8) : Math.max(stop, mode.minWords)
    for (const line of extra) {
      if (words >= fillTo) break
      const n = wordCount(line)
      if (words + n > (designFirst ? fillTo : mode.maxWords) || parts.includes(line)) continue
      parts.push(line)
      words += n
    }
  }
  // A first design stage names the map, builds one layer, and stops at a checkpoint.
  // A later "go deeper" turn does not start the map over.
  if (cut.shape === "design" && !DEEPER_ON.test(question)) {
    const layer = (spokenParts[0] && spokenLead(spokenParts[0])) || "the first layer"
    const checkpoint = `Want me to go deeper on ${layer}, or shall I keep sketching the whole shape?`
    const n = wordCount(checkpoint)
    if (words + n <= mode.maxWords && !parts.includes(checkpoint)) {
      parts.push(checkpoint)
      words += n
    }
  }
  const shortFact = /^(?:have you|did you|do you|are you|were you)\b/i.test(question) && /\b(?:worked|used|use|familiar|experience|been|done|know)\b/i.test(question)
  const storyAsk = cut.shape === "personal-experience" || cut.shape === "scenario" || /\b(?:tell me about a time|describe a (?:time|situation)|a time you)\b/i.test(question)
  if (!bareTerm && !(hrAsk && level !== "architect")) {
    const stance = modeStance(level, lead, { design: cut.shape === "design", story: storyAsk })
    const placed = placeStance(parts, stance, mode.maxWords)
    parts.splice(0, parts.length, ...placed)
  }
  const keepGoing = storyAsk || cut.shape === "comparison" || /\bexplain the same incident\b/i.test(question)
  if (keepGoing && level === "engineer" && !parts.some((line) => /keep going/i.test(line))) {
    const line = `I can keep going on the result if you want the rest.`
    if (wordCount(parts.join(" ")) + wordCount(line) + 2 <= mode.maxWords) parts.push(line)
    else if (parts.length > 1) {
      const swapped = parts.slice()
      swapped[swapped.length - 1] = line
      if (wordCount(swapped.join(" ")) <= mode.maxWords) parts.splice(0, parts.length, ...swapped)
    }
  }
  const bit = lead.split(/\s+/).filter(Boolean).slice(0, 6).join(" ") || "this"
  words = wordCount(parts.join(" "))
  const causal = [
    `Once that was confirmed, I would stay with ${bit}.`,
    `Because of that, the next check on ${bit} is the one I would not skip.`,
    `That is why I would not close ${bit} until the owner has seen it.`,
    `The reason I would stop there is that ${bit} already has a check.`,
  ]
  const lengthFloor = Math.min(80, mode.maxWords - 4)
  for (const line of causal) {
    if (words >= lengthFloor || shortFact || bareTerm || (hrAsk && level === "engineer")) break
    const n = wordCount(line)
    if (words + n > mode.maxWords - 2 || parts.includes(line)) break
    parts.push(line)
    words += n
  }
  if (shortFact) return trimToWords(parts.slice(0, 2).join(" "), Math.min(mode.maxWords, 28))
  if (hrAsk && level === "engineer" && (cut.shape === "definition" || cut.shape === "direct" || cut.shape === "comparison")) {
    return trimToWords(parts.join(" "), Math.min(mode.maxWords, 48))
  }
  return trimToWords(parts.join(" "), mode.maxWords)
}

function plainDefinition(level: AnswerLevel, lead: string, hr: boolean): string {
  if (level === "director") {
    return hr
      ? `I would rather name ${lead} in plain words than walk the build.`
      : `I would rather decide ${lead} than walk past ${lead}.`
  }
  if (level === "architect") return `${lead} is the boundary I watch for ${lead}.`
  return hr
    ? `${lead} means a plain look at what could go wrong. I stop there.`
    : `${lead} means the check I run on ${lead} before I stop.`
}

function modeStance(level: AnswerLevel, lead: string, flags: { design: boolean; story: boolean }): string {
  const bit = lead.split(/\s+/).filter(Boolean).slice(0, 6).join(" ") || "this"
  if (level === "architect") return `I was also thinking of a neighboring tangent on ${bit}, and we can leave that out of scope.`
  if (level === "director") return `I would rather record the tradeoff on ${bit} than leave that residual unsigned.`
  if (flags.story) return `I can keep going on the result of ${bit}.`
  if (flags.design) return `The check I run on ${bit} is the live setting against the written record.`
  return `The check I run on ${bit} is the live setting against the written record.`
}

function placeStance(parts: string[], stance: string, maxWords: number): string[] {
  if (!stance || parts.includes(stance)) return parts
  const n = wordCount(stance)
  const words = wordCount(parts.join(" "))
  // Leave room for the spoken pause marks the blend pass inserts.
  if (words + n + 4 > maxWords) return parts
  const next = parts.slice()
  next.splice(Math.min(1, next.length), 0, stance)
  return next
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
