// Kompas answer intelligence — ported from perfACT's interview engine
// (copilot/api/answer.js + _audiences.js), running on MarketFit's OpenRouter
// provider. perfACT's classification, length calibration, follow-up chaining
// and question-detection gates; MarketFit's provider, dossier grounding and
// [beat]/[breath] pause architecture.

export type Tier = 0 | 1 | 2 | 3 | 4

const IDENTITY =
  /\b(intro(duc(e|tion))?|about yourself|tell me about your (experience|background)(?! (with|in|of|on|using|at|as|around)\b)|tell me about you\b|walk me through your (background|resume|cv|career|experience|profile)|your background|who are you|describe yourself|elevator pitch|your story|summari[sz]e your (experience|background|career)|(all )?about your (career|background|journey)|how you got (to )?where you are)\b/i
const T1 =
  /\b(tell me about a time|walk me through|describe a (time|situation)|give me an example|tell me about (a|an|the|your)|have you (ever|personally)|share an (example|experience))\b/i
const NOT_T1 =
  /\bwalk me through (how (you|we|i) (would|'d|should|could)|how to|what (you|we) would)\b|\bhave you (ever )?(used|worked with|heard of|touched)\b/i
const T3 =
  /\b(what exactly|what did the (policy|logs)|what logs did you|first thing you checked|what didn'?t work|specific responsibility|who did you|what happened after|how did you validate|what would you change|biggest bottleneck|business impact|why did you choose|what tools did you use|what did you see in the logs|how did you know|what alternatives|go deeper|more detail|elaborate)\b/i
const T2 =
  /\b(how would you|how do you|what would you|suppose|if you|design a|what belongs|where would|how could|what happens if|how can you|what is|what are|explain|difference between)\b/i

// A direct question about the candidate's own experience — answered from FACTS
// in the past tense, never as a hypothetical. (perfACT EXP_Q/EXP_Q2, added
// after self-play showed screening questions landing in the design catch-all.)
const EXP_Q =
  /\b(have|has) you (ever |personally |actually |already )?(done|performed|handled|led|implemented|configured|deployed|upgraded|patched|administ\w*|managed|worked (on|with)|supported|built|migrated|troubleshot|resolved|onboarded|integrated|automated|designed|used|owned|run|been)\b|\bdid you\b|\bhow (many|long)\b[^?]*\b(years?|months?|experience)\b|\bwhich\b[^?]*\b(have|did) you\b|\bdescribe (one|a|an|the)\b[^?]*\byou('ve| have| did)\b|\b(your|what'?s your|what is your) (current )?(role|responsibilities|title|client|project)\b/i
const EXP_Q2 =
  /\bwhat\b(?:\s+\w+){0,3}\s+(tools?|platforms?|stack|siem|edr|xdr|frameworks?|languages?|scanners?|methodolog\w*|process|approach|tech(?:nolog\w*)?)\s+(do|did) you (use|prefer|rely on|work with|run)\b|\bhow (do|did) you (usually |typically )?(handle|approach|go about|manage|deal with|prioriti[sz]e|decide|integrate|implement|configure|troubleshoot|investigate|tune|onboard|automate|monitor|validate|test|stay (current|up to date))\b|\bdescribe how you (handle|approach|manage|deal with)\b/i
const HYPOTHETICAL_GUARD = /\b(how would you|what would you|suppose|if you were)\b/i

export function classify(q: string): { tier: Tier; why: string } {
  if (IDENTITY.test(q)) return { tier: 0, why: "identity" }
  if (T3.test(q)) return { tier: 3, why: "drill-down" }
  if ((EXP_Q.test(q) || EXP_Q2.test(q)) && !HYPOTHETICAL_GUARD.test(q))
    return { tier: 4, why: "own experience" }
  if (T1.test(q) && !NOT_T1.test(q)) return { tier: 1, why: "experience" }
  if (T2.test(q)) return { tier: 2, why: "design/scenario" }
  return { tier: 2, why: "design/scenario (default)" }
}

// Parakeet baseline: median length of 1,767 real answers of each kind, scaled
// by difficulty, length preference, question complexity and audience depth.
// Spoken ≈ 2.5 words/sec.
const PK_WORDS: Record<string, number> = {
  technical: 144, simple: 100, intro: 139, recruiter: 139, story: 182,
  career: 200, drill: 123, closed: 50, which: 70, theirq: 35, logistics: 35,
  code: 170, smalltalk: 20, define: 55, preference: 45,
}
const PK_DIFF: Record<string, number> = { easy: 0.85, standard: 1, hard: 1.2, expert: 1.4 }
const LEN_MULT: Record<string, number> = { short: 0.7, balanced: 1, long: 1.3 }
export const AUDIENCE_DEPTH: Record<string, number> = {
  hr: 0.9, technical_hr: 1.0, analyst: 1.06, engineer: 1.12, developer: 1.18,
  supervisor: 1.24, architect: 1.3, lead: 1.36, director: 1.42, peer: 1.0,
}

const FILLER = /^(?:(?:um+|uh+|so|and|okay|ok|right|well|about \w+)[,.]?\s+)+/i
const SHORT_KINDS = ["simple", "closed", "which", "theirq", "logistics", "smalltalk", "define", "preference"]
const SMALLTALK =
  /^(?:(?:hi|hello|hey|thanks|thank you|good (?:morning|afternoon|evening))[\s,.!]*)*(?:how(?:'s| is| are| has| was)\s+(?:your|you|it|things|everything|the)\b[^?]{0,40}(?:day|going|doing|week|weekend|morning|today)?|how are you(?: doing)?|how have you been)\b[^?]{0,30}\??$/i
const PREFERENCE =
  /^(?:so,?\s+)?(?:what(?:'s| is| are)|which (?:is|are))\s+(?:your|you)\s+(?:favou?rite|strongest|preferred|go-to|best|primary|most comfortable)\b[^?]{0,60}\??$|^which\s+[^?]{1,40}\s+do you (?:prefer|like best)\b[^?]{0,30}\??$/i
const DEFINE =
  /^(?:in [\w .#+-]{1,25},\s*)?(?:what(?:'s| is| are| was)\s+(?:an?|the)?\s*[^?]{1,70}\b(?:called|named|known as)\b|what(?:'s| is| are)\s+(?:an?\s+|the\s+)?[^?,]{1,50}\??$|(?:what(?:'s| is) )?the difference between\b|define\b|what does\s+[^?]{1,40}\s+(?:stand for|mean)\b|what\s+(?:[\w-]+\s+){0,3}(?:exception|error|status code|port|keyword|command|flag|header)\s+(?:does|is|do)\b)/i
const DEFINE_ANY =
  /\bwhat\s+(?:[\w-]+\s+){0,3}(?:exception|error|status code|port|keyword|command|flag|header|method|event)\s+(?:does|is|do|will)\b|\bwhat (?:is|are) (?:it|they|this|that) called\b/i
const THEIRQ =
  /\b(questions?|queries|query)\b[^?]*\b(for (us|me)|from your (end|side))\b|\bdo you have any (questions|queries)\b/i
const LOGISTICS =
  /\b(comfortable|okay|ok|fine|willing|able|open)\b[^?]*\b(on-?site|onsite|in (the )?office|relocat\w*|travel\w*|remote|hybrid|shifts?|five days|day one)\b|\b(your|the) (hourly |bill |pay )?rate\b|\b(salary|compensation|notice period|start date|visa|work authori[sz]ation|sponsorship)\b/i
const SIMPLE =
  /^(what|which)\s+(?:[\w-]+\s+){0,2}(tool|tools|version|language|vendor|platform|protocol|port|cloud|siem|edr|scanner|framework|stack)s?\b|^(what|which)\s+(?:[\w-]+\s+){0,3}do you (use|have|prefer|run)\b|^(do|did|have|are|is|can) you (ever )?(know|use|used|familiar|work(ed)? with|comfortable|have|heard of|touched)\b/i
const CONFLICT =
  /\b(conflict|disagree|disagreement|push(ed)? back|difficult (person|stakeholder|colleague|manager)|under pressure|tight deadline|mistake|fail(ed|ure)?|went wrong)\b/i
const CODE_ASK = /\b(write|implement|code|refactor|debug|function|query|script)\b/i

function shortKind(q: string): string {
  const s = q.replace(FILLER, "").trim()
  const words = s.split(/\s+/).length
  const asks = (s.match(/\?/g) || []).length
  if (words <= 14 && SMALLTALK.test(s)) return "smalltalk"
  if (asks > 1 || /\b(and (then |also )?(how|why|what|when|where|explain|describe|walk)|with (one|an) example|step by step|walk me through|design|architect)\b/i.test(s)) return ""
  if (words <= 18 && PREFERENCE.test(s)) return "preference"
  if (words <= 22 && (DEFINE.test(s) || DEFINE_ANY.test(s)) && !/\b(you|your|you've|you're)\b/i.test(s.replace(/\bthe difference\b/i, ""))) return "define"
  return ""
}

function complexity(q: string): number {
  let m = 1
  const parts = (q.match(/\?/g) || []).length
  if (parts > 1) m += 0.2 * Math.min(2, parts - 1)
  if (/\b(and (then|also|how|why|what|where|which|describe|tell|walk|explain|especially)|as well as|end to end|step by step|compare|trade-?offs?|pros and cons|design|architect|at scale|migrat)/i.test(q)) m += 0.2
  if (q.split(/\s+/).length > 25) m += 0.1
  return Math.min(1.3, m)
}

export interface LengthPlan { kind: string; words: number; secs: [number, number]; maxTokens: number }

export function lengthPlan(
  tier: Tier, q: string, interviewer: string,
  opts: { difficulty?: string; length?: string } = {},
): LengthPlan {
  const pastAsk = /\b(tell me about|describe|walk me through|give me an example|share|a time|when you|have you ever)\b/i.test(q)
  const brief = ["hr", "technical_hr"].includes(interviewer)
  const quick = tier !== 0 && tier !== 1 && !CODE_ASK.test(q) ? shortKind(q) : ""
  const special =
    quick ||
    (THEIRQ.test(q) ? "theirq" : LOGISTICS.test(q) ? "logistics"
      : tier === 4 && brief && (/\bwhich\b|\bwhat (tools|components|platforms|modules)\b/i.test(q)) ? "which"
      : tier === 4 && brief ? "closed" : "")
  const kind =
    special ||
    (tier === 0 ? (/\b(career|journey|background|walk me through|how you got)\b/i.test(q) ? "career" : "intro")
      : tier === 1 || (tier !== 3 && CONFLICT.test(q) && pastAsk) ? "story"
      : tier === 3 ? "drill"
      : brief && SIMPLE.test(q.replace(FILLER, "")) && q.split(/\s+/).length < 16 ? "simple"
      : ["hr", "technical_hr"].includes(interviewer) && !/\b(how would you|design|architect|troubleshoot|configure)\b/i.test(q) ? "recruiter"
      : "technical")
  const words = Math.round(
    (PK_WORDS[kind] || 144) *
    (PK_DIFF[opts.difficulty || "standard"] || 1) *
    (LEN_MULT[opts.length || "balanced"] || 1) *
    (AUDIENCE_DEPTH[interviewer] || 1) *
    (SHORT_KINDS.includes(kind) ? 1 : complexity(q)),
  )
  return {
    kind, words,
    secs: [Math.round(words * 0.8 / 2.5), Math.round(words * 1.25 / 2.5)],
    maxTokens: Math.min(4000, Math.max(1400, Math.round(words * 2.6) + 900)),
  }
}

// ---- Question detection: three code gates before any model call ----

const ASKS =
  /\?\s*$|^(so,? |and,? |also,? )?(what|how|why|when|where|which|who|can|could|would|will|should|do|does|did|are|is|have|has|tell|walk|describe|explain|give|share|talk|imagine|suppose)\b|\b(tell me|walk me|how would you|what would you|can you|could you|would you|have you|do you)\b/i

/** Speaker-aware: any Them: line is a question; otherwise needs ? or an ask-pattern. */
export function plainlyNoQuestion(heard: string): boolean {
  const lines = String(heard || "").split("\n").filter((l) => l.trim())
  if (!lines.length) return true
  if (lines.some((l) => /^Them:/.test(l))) return false
  return !lines.some((l) => {
    const t = l.replace(/^(You|Them):\s*/, "")
    return /\?/.test(t) || ASKS.test(t) || LOGISTICS.test(t) || THEIRQ.test(t)
  })
}

/** Verbatim extraction when the transcript reduces to exactly one clean question. */
export function cleanQuestion(heard: string): string {
  const lines = String(heard || "").split("\n").filter((l) => l.trim())
  const them = lines.filter((l) => /^Them:/.test(l)).map((l) => l.replace(/^Them:\s*/, "").trim())
  if (!them.length) return ""
  const said = them.join(" ").replace(/\s+/g, " ").trim()
  if (said.split(" ").length > 45 || /\b(uh+|um+|er|erm|like,|you know|sort of|kind of|i mean)\b/i.test(said)) return ""
  const sentences = said.split(/(?<=[.?!])\s+/).filter((x) => x.split(" ").length >= 2)
  const asks = sentences.filter((x) => /\?$/.test(x) || ASKS.test(x))
  if (asks.length !== 1) return ""
  const q = asks[0]
  const n = q.split(" ").length
  if (!/\?$/.test(q) || n < 4 || n > 25) return ""
  if (sentences.indexOf(q) < sentences.length - 1) return "" // something came after: let the model weigh it
  return q.charAt(0).toUpperCase() + q.slice(1)
}

const PRESS =
  /\b(explain (it |that |this )?(more|further|again)|more (in[- ]depth|detail|specific\w*|clearly)|in (more )?(depth|detail)|elaborate|expand on|go deeper|dig deeper|what do you mean|meaning|clarify|be more specific|specifically|how exactly|what exactly|why (did|was|is|would) (that|it|you)|give (me )?an example|for example|walk me through (that|it)|can you repeat|once again|same question|like what|such as)\b/i
const POINTS_BACK =
  /\b(that|this|it|those|these|there|then|you (said|mentioned|described|talked about))\b/i

/** A topic-less follow-up ("go deeper") is glued to the previous question IN CODE. */
export function resolveFollowUp(d: string, history: Array<{ q?: string }>): string {
  const q = String(d || "").trim()
  const hist = Array.isArray(history) ? history.filter((h) => h && h.q) : []
  if (!q || !hist.length) return q
  const topicless = q.split(/\s+/).length <= 9 && (PRESS.test(q) || POINTS_BACK.test(q))
  if (!topicless) return q
  const last = String(hist[hist.length - 1].q).replace(/[?.!\s]+$/, "")
  return `${q.replace(/[?.!\s]+$/, "")} — following up on: "${last}"?`
}

// ---- Per-tier answer rules (perfACT TIER_RULES, pivoted to MarketFit's delivery) ----

export const INTRO_FOCUS: Record<string, string> = {
  hr: "who you are and why you do this work, how you work with people, and the impact you care about — at most one tool name; warm, calm and friendly",
  technical_hr: "your role, core stack and scope stated with confidence, the environments you've worked in, and what you're looking for next — friendly and technically fluent",
  developer: "what you build and maintain, the languages, APIs and pipelines you actually use, and how you work with engineering teams",
  engineer: "your hands-on specialty, the systems you run end to end, one concrete problem you solved, and how you work with stakeholders",
  architect: "your supported contribution to system design, how you reason about relevant trade-offs and failure domains, and the people affected by the design",
  analyst: "the investigations and evidence you work from, what you measure and report, and one finding that changed a decision",
  peer: "whatever this interviewer's own framing leads with — technical, people or business — in their register: what your work actually is, what you're good at, how you like to work",
  lead: "the work you lead and the people you support, how you prioritise and unblock, and your leadership presence — calm and authoritative, titles only as the resume states",
  supervisor: "where you take projects and why, how you keep people, process and design aligned, and your follow-through",
  director: "the business risk you reduce, the outcomes you own, the decisions you've made and their payoff, and why you fit this company — confident and relaxed",
}

export function tierRule(tier: Tier, interviewer: string): string {
  const focus = INTRO_FOCUS[interviewer] || INTRO_FOCUS.engineer
  switch (tier) {
    case 0:
      return `INTRODUCTION. Deliver the candidate's identity from FACTS, spoken naturally for this audience. Lead with: ${focus}. Include grounded highlights from FACTS and why this role fits. Never answer an intro with a technical deep-dive.`
    case 1:
      return `EXPERIENCE — STAR. Situation: where it happened and what triggered it. Task: what was theirs to solve. Action (the heart of it): what they personally did, in order, including the bottleneck as a concrete image and how they got past it. Result: what changed, then one human takeaway. Use the real specifics in FACTS — employer, tools, platforms, systems, projects the background names. Where FACTS is silent on a detail, say it naturally at the level FACTS supports ("our EDR platform", "the ticketing queue") so every sentence is complete.`
    case 4:
      return `DIRECT QUESTION ABOUT THE CANDIDATE'S OWN EXPERIENCE (have you…, how many years…, which … have you…, your role there…). The FIRST sentence is the direct answer from FACTS — yes or no, the number, the list, or their title — past tense for what they did, present tense for their current role. Then back it with what they actually did, at the employer and in the years FACTS shows, in the past tense. NEVER answer with how they WOULD approach it and never switch to a hypothetical.`
    case 3:
      return `DRILL-DOWN. Continue from where the last answer stopped: the same project, environment and people, with one clause of callback — never retell the story. Answer only what this follow-up adds, one level deeper. "What did YOU do": the two or three decisions that were theirs, in "I", then the team's part in one sentence, by role. "How did you know" / "go deeper": what they checked, what they ruled out, the real cause. Every fact matches what was already said.`
    default:
      return `DESIGN / SCENARIO. Explain how they WOULD approach it, present or conditional tense: impact, evidence, root cause, safest practical fix, how they test and monitor it. Anchor it in real experience from FACTS. The "where I've done this" proof must be one of the candidate's REAL projects — the employer, tools and work the background names — told at the level FACTS supports. Never invent an incident, error message, reading, number or date FACTS does not contain.`
  }
}

// Story rotation: which employers/projects already appeared in this session's
// answers, so the model reaches for a fresh one instead of retelling CodeQL.
export function usedProjects(history: Array<{ a?: string; answer?: string; text?: string }>): string[] {
  const found = new Set<string>()
  for (const h of history) {
    const a = String(h?.a ?? h?.answer ?? h?.text ?? "")
    // crude but effective: capitalized multi-word org/product names the model already said
    for (const m of a.matchAll(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/g)) {
      const name = m[1]
      if (name.split(" ").length > 1 && name.length < 40 && !/^(The|This|That|With|From|And|For|You|Your)$/.test(name))
        found.add(name)
    }
  }
  return [...found].slice(0, 12)
}

export const DERIVE_SYSTEM = `You read a live interview transcript and pull out the interviewer's most recent question.

HEARD is everything said since the last answer, merged and messy: fillers, cross-talk, fragments cut at random points by the transcriber. Lines starting "Them:" are the interviewer(s) on call audio; lines starting "You:" are the candidate's own microphone — usually the candidate replying, which is context, NOT a question (but if there is no Them: line at all, the interviewer is being picked up by the candidate's mic, so treat the speech as theirs).

FIRST derive the ONE question to answer now: centre it on what the interviewer is asking at the END of HEARD, and fold in every earlier question in HEARD that has not been answered yet, plus any constraint or context they gave. Small talk, their description of the team or role, and the candidate's own replies are context, not questions.

Return ONLY the question text, in the interviewer's own words, one or two sentences. Never add topics or angles they did not ask about. If nothing in HEARD is a question for the candidate, return exactly: NO_QUESTION`
