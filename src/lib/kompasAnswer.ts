import { repairDictation } from "./kompasDictation.ts"
import { latestInterviewerAsk } from "./kompasInterviewPrecision.ts"
import { interviewIntent } from "./kompasRelevance.ts"

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
const PERSONAL_ASK = /\byour (?:own |biggest |greatest |strongest |most significant |recent |current )?(?:experience|achievements?|accomplishments?|contributions?|career|strengths?|weaknesses?|background|projects?|clients?|responsibilities|role|mistakes?|failures?|successes?)\b|\byou (?:are |were )?(?:proud of|personally|responsible for)\b/i
const HYPOTHETICAL_GUARD = /\b(how would you|what would you|suppose|if you were)\b/i

/** Keep personal introductions distinct from "introduction to OAuth" or a
 * requested technical overview. One word must not override the subject. */
export function isCareerIntroduction(question: string): boolean {
  const q = String(question || '').trim()
  if (/\bintro(?:duction)?\s+(?:to|of|on|about)\s+(?!(?:my|your|me|you|myself|yourself|career|background)\b)/i.test(q)) return false
  return IDENTITY.test(q)
}

export function classify(q: string): { tier: Tier; why: string } {
  if (isCareerIntroduction(q)) return { tier: 0, why: "identity" }
  if (T3.test(q)) return { tier: 3, why: "drill-down" }
  if ((EXP_Q.test(q) || EXP_Q2.test(q) || PERSONAL_ASK.test(q)) && !HYPOTHETICAL_GUARD.test(q))
    return { tier: 4, why: "own experience" }
  if (T1.test(q) && !NOT_T1.test(q)) return { tier: 1, why: "experience" }
  if (T2.test(q)) return { tier: 2, why: "design/scenario" }
  return { tier: 2, why: "design/scenario (default)" }
}

/**
 * Minimal intro triggers ("intro", "about yourself", "who are you") confuse
 * the model when passed verbatim — cleanQuestion() needs 4-25 words ending
 * with ?, so short inputs fall through to derivation with no context. For
 * tier 0 with < 4 words, substitute a canonical intro question. The existing
 * INTRO_FOCUS and tier-0 rules then generate a proper spoken self-introduction.
 */
export function canonicalQuestion(q: string, tier: Tier): string {
  const words = String(q || "").trim().split(/\s+/).filter(Boolean)
  if (tier === 0 && words.length > 0 && words.length < 4) {
    return "Tell me about yourself"
  }
  // A bare term is a request to explain it (owner, 25 Oct 2026: "treating a question as abbreviation explain it"). The
  // model was handed "IDOR" alone and left to guess what was wanted.
  if (tier !== 0 && isBareTerm(q)) return `What is ${String(q).trim().replace(/[.?!]+$/, "")}? If it is an abbreviation, say what it stands for first.`
  return q
}

/**
 * An answer the token ceiling cut off far short of its target. Measured 26 Oct 2026 (evaluation round 3, iam-4): the
 * stream finished 42 ms after its first words, "I added a real‑time rev", and that was served as the answer. gpt-oss
 * pays its reasoning from the same ceiling as the answer, so a hard follow-up can spend nearly all of it reasoning.
 */
export function cutShort(finish: string, text: string, targetWords: number): boolean {
  if (finish !== "length") return false
  const t = String(text || "").trim()
  const words = t.split(/\s+/).filter(Boolean).length
  // Also stopped mid-sentence: the intent baseline's comparison answers ended on "or same" with the mitigation missing.
  return words < Math.max(25, Math.round(targetWords * 0.35)) || !/[.!?]["')\]]*$/.test(t)
}

const NOT_A_TERM =/^(?:next|continue|go on|go ahead|repeat|again|pause|stop|wait|done|skip|more|same|okay|ok|yes|no|thanks|thank you|hello|hi|hey)\b/i

/** One to four words with no verb and no question: a term, a tool or an abbreviation the interviewer named. */
export function isBareTerm(q: string): boolean {
  const t = String(q || "").trim().replace(/[.!]+$/, "")
  if (!t || /\?/.test(t) || NOT_A_TERM.test(t) || BARE_INTRO.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length > 3 || !/^[A-Za-z0-9]/.test(t)) return false
  return !ASK_OPENER.test(t) && !/\b(?:is|are|was|were|do|does|did|can|could|would|should|have|has|i|you|we|my|your)\b/i.test(t)
}

/**
 * Every part the question asks for, in order, and the conditions it sets (owner, 25 Oct 2026: understand what each
 * question demands and "make sure it completes to deliver everything that's expected"). Measured 26 Oct: "Explain trust
 * boundaries, data flow, failure isolation, rollout and validation" lost parts, and "Define IDOR, explain why it
 * matters, and give one mitigation" was answered as a definition. Setup sentences are context, not parts.
 */
export function requestedParts(question: string): { parts: string[]; constraints: string[] } {
  const parts: string[] = [], constraints: string[] = []
  // Not "compare": "Compare IDOR and CSRF" is one part, the comparison.
  const LIST_VERB = /^((?:explain|state|cover|give|include|describe|list|name|walk through|walk me through|discuss|outline|address|show|identify)\b)\s+(.+)$/i
  const CONDITION = /^(?:keep|make it|stay|limit|avoid|assume|use only|focus|without|don'?t|do not|never|there can be no|(?:with |and )?no (?:production )?(?:downtime|restart|outage))\b/i
  for (const sentence of String(question || "").split(/(?<=[.?!])\s+/)) {
    let core = sentence.replace(LEAD_FILLER, "").replace(/[.!]+$/, "").trim()
    if (!core) continue
    if (CONDITION.test(core)) {
      // "No downtime, how would you verify it?" is a limit and an ask. Taking the
      // whole sentence as the limit dropped the ask (the same miss as a trailing
      // "without", on the other side of the sentence).
      const embedded = core.match(/^(.*?),?\s+((?:how|what|why|when|where|which|who)\b.+)$/i)
      const limit = embedded ? embedded[1].replace(/[?,]+$/, "").trim() : ""
      if (embedded && limit.split(/\s+/).length >= 2 && limit.split(/\s+/).length <= 14) {
        constraints.push(limit)
        core = embedded[2].trim()
      } else {
        constraints.push(core)
        continue
      }
    }
    // Read before the condition is cut off: "..., how would you distinguish A, B and C without bypassing inspection?" kept
    // its question mark on the condition, so the ask itself was taken for setup and dropped (27 Oct 2026).
    const asked = /\?$/.test(core)
    const tail = core.match(/^(.*?),?\s+((?:without|but (?:do not|don't|never)|with no (?:production )?(?:downtime|restart|outage)|and no (?:production )?(?:downtime|restart|outage))\b.*)$/i)
    if (tail && tail[1].split(/\s+/).length >= 3) { core = tail[1].trim(); constraints.push(tail[2].trim().replace(/\?$/, "")) }
    if (!asked && !ASK_OPENER.test(core)) {
      // "The service must stay up. How would you patch it?" The limit was only
      // in a side prompt, and the parts list named the question alone.
      if (/\b(?:must (?:stay|keep|remain|not)|no production access|cannot|can(?:not|'t))\b/i.test(core) && core.split(/\s+/).length <= 16)
        constraints.push(core.replace(/\.$/, ""))
      continue
    }
    const list = core.match(LIST_VERB)
    if (list && /,|\band\b/.test(list[2]) && !/\b(?:why|how|what|when|where|whether|versus|vs)\b/i.test(list[2])) {
      const items = list[2].split(/,\s*(?:and\s+)?|\s+and\s+/).map((x) => x.trim()).filter(Boolean)
      if (items.length >= 2 && items.every((x) => x.split(/\s+/).length <= 8)) { for (const x of items) parts.push(`${list[1]} ${x}`); continue }
    }
    const clauses = core.split(/,\s*(?:and\s+)?|;\s*|\s+and\s+(?=(?:explain|give|describe|define|state|name|list|show|compare|walk|outline|discuss|recommend|propose|justify|why|how|what)\b)/i).map((x) => x.trim()).filter(Boolean)
    if (clauses.length >= 2 && clauses.every((x) => ASK_OPENER.test(x))) { parts.push(...clauses); continue }
    parts.push(core, ...listedParts(core))
  }
  return { parts, constraints }
}

// One sentence that names a set: "how would you distinguish a stale DNS response, overlapping routes, proxy selection, and
// a NAC restriction?", "...correlate A, B, C and D while accounting for E, F, G", "how would you organize X, select Y,
// communicate Z, and separate W". Judged 27 Oct 2026 on the owner's Endpoint Analyst set: such a sentence counted as one
// part, the model got no parts list, and answers gave general checks that skipped items or never told them apart. Each
// listed item is now its own part under the sentence; a list of fewer than three, or one with a long item, stays whole.
const SET_VERB = /\b(distinguish(?: between)?|differentiate(?: between)?|tell apart|isolate|investigate|test|examine|correlate|balance|account(?:ing)? for|evaluate|assess|verify|segment|prioriti[sz]e|handle|cover)\s+(.+)$/i
const TELL_APART = /^(?:distinguish|differentiate|tell apart|isolate)/i
const STEP_VERB = /^(?:organi[sz]e|select|choose|communicate|separate|identify|correct|establish|design|assess|segment|isolate|prioriti[sz]e|decide|implement|enforce|protect|handle|avoid|explain|verify|validate|build|assign|maintain|distinguish|investigate|test|examine|preserve|coordinate|escalate|contain|restore|document|collect|compare)\b/i
const CLAUSE_START = /,?\s+(?:and\s+|or\s+)?(?=(?:what|how|why|which|while|without|so that|before|whether|then)\b)/i

function setItems(text: string): string[] {
  const out: string[] = []
  let rest = text
  for (let guard = 0; guard < 3 && rest; guard++) {
    const m = rest.replace(/[?.!]+$/, "").match(SET_VERB)
    if (!m) break
    const body = m[2].split(CLAUSE_START)[0]
    rest = m[2].slice(body.length)
    let items = body.split(/,\s*(?:and\s+|or\s+)?/).map((x) => x.trim()).filter(Boolean)
    if (!/,\s*(?:and|or)\s/.test(body) && items.length >= 2) {   // "A, B and C": the last pair has no comma of its own
      const lastPair = items[items.length - 1].split(/\s+(?:and|or)\s+/)
      if (lastPair.length === 2 && lastPair.every((x) => x.split(/\s+/).length <= 4)) items = [...items.slice(0, -1), ...lastPair]
    }
    if (TELL_APART.test(m[1]) && items.length && / from /.test(items[0])) items = [...items[0].split(/ from /), ...items.slice(1)]
    if (items.length < 3 || items.some((x) => x.split(/\s+/).length > 9)) continue
    out.push(...items.map((x) => (TELL_APART.test(m[1]) ? `${x}: the evidence that confirms or rules it out` : `${m[1].toLowerCase()} ${x}`)))
  }
  return out
}

const STEP_SPLIT = new RegExp(`,\\s*(?:and\\s+)?(?=${STEP_VERB.source.slice(1)})`, "i")
const ASK_SPLIT = /,\s*(?:and\s+)?(?=(?:what|which|how|why|when|where|who)\b)/i

export function listedParts(core: string): string[] {
  const text = core.replace(/[?.!]+$/, "")
  // "how would you organize X, select Y, communicate Z, and separate W": a chain of steps, each its own part (and a set
  // inside one step, "distinguish A, B, C and D", is listed under it).
  const steps = text.split(STEP_SPLIT).map((x) => x.trim()).filter(Boolean)
  if (steps.length >= 2 && steps.slice(1).every((x) => x.split(/\s+/).length <= 14)) {
    const first = steps[0].replace(/^.*?\b(?:would|will|do|did|could|should)\s+you\s+/i, "")
    return [first, ...setItems(first), ...steps.slice(1).flatMap((x) => [x, ...setItems(x)])]
  }
  // "...: what was your hypothesis, which evidence confirmed it, what did you change, and how did you verify it?"
  const asks = text.split(ASK_SPLIT).map((x) => x.trim()).filter(Boolean)
  if (asks.length >= 3) return [asks[0].replace(/^[^:]*:\s*/, ""), ...asks.slice(1)]
  const items = setItems(core)
  // "while enforcing least privilege, protecting sensitive information, handling partial failures, and avoiding ..."
  const whileList = core.match(/\bwhile\s+(\w+ing\b.+?)[?.!]*$/i)
  if (whileList) {
    const gerunds = whileList[1].split(/,\s*(?:and\s+)?/).map((x) => x.trim()).filter(Boolean)
    if (gerunds.length >= 3 && gerunds.every((x) => /^\w+ing\b/.test(x) && x.split(/\s+/).length <= 8) && !items.some((x) => gerunds.some((g) => x.includes(g)))) items.push(...gerunds)
  }
  return items
}

// Parakeet baseline: median length of 1,767 real answers of each kind, scaled
// by difficulty, length preference, question complexity and audience depth.
// Spoken ≈ 2.5 words/sec.
const PK_WORDS: Record<string, number> = {
  technical: 144, simple: 100, intro: 240, recruiter: 139, story: 182,
  career: 280, drill: 123, closed: 50, which: 70, theirq: 35, logistics: 35,
  code: 170, smalltalk: 20, define: 55, preference: 45,
}
const PK_DIFF: Record<string, number> = { easy: 0.85, standard: 1, hard: 1.2, expert: 1.4 }
const LEN_MULT: Record<string, number> = { short: 0.7, balanced: 1, long: 1.3 }
export const AUDIENCE_DEPTH: Record<string, number> = {
  hr: 0.9, technical_hr: 1.0, analyst: 1.06, engineer: 1.0, developer: 1.18,
  supervisor: 1.24, architect: 1.2, lead: 1.36, director: 1.05, peer: 1.0,
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
const CODE_REQUEST = /\b(?:write|give|show|create)\b[^?]*\b(?:code|program|script|function|query)\b|\b(?:coding|program for|code for|implement (?:a|an|the) (?:function|algorithm))\b/i
const CODE_ASK = /\b(write|implement|code|coding|program|refactor|debug|function|query|script)\b/i

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

/**
 * Question specificity scorer — calibrates answer depth to the question's depth.
 * A yes/no question ("Do you know Splunk?") gets a brief answer.
 * A scoped technical question ("How did you tune Splunk correlation searches
 * for low false positives in a 50k EPS environment?") gets a deep, focused answer.
 * Returns 0.5 (surface) to 1.5 (deep).
 */
export function questionDepth(q: string): number {
  const text = String(q || '').toLowerCase();
  let depth = 1.0;

  // How-questions go deeper than what-questions; what deeper than do-you
  if (/\bhow (did|do|would|can|could) you\b/.test(text)) depth += 0.25;
  else if (/\bwhat (was|were|did|is|are)\b/.test(text)) depth += 0.1;
  if (/^(do|does|did|are|is|have|has|can|could|would) you\b/.test(text.trim())) depth -= 0.3;

  // Scoping signals: numbers, environments, constraints → deeper
  const scopes = (text.match(/\b\d+[kmb]?\b/g) || []).length; // 50k, 300, etc.
  depth += Math.min(0.2, scopes * 0.05);
  if (/\b(in|for|with|across)\s+(a|an|the)?\s*\w+\s+(environment|setup|deployment|pipeline|fleet|cluster|org)/.test(text)) depth += 0.15;
  if (/\b(trade-?off|constraint|challenge|bottleneck|scale|performance|reliability)\b/.test(text)) depth += 0.15;

  // Multi-part questions → broader but not necessarily deeper per part
  const parts = (text.match(/\?/g) || []).length;
  if (parts > 1) depth += 0.1;

  // Very short questions are usually surface-level
  if (text.split(/\s+/).length < 6) depth -= 0.15;

  return Math.max(0.5, Math.min(1.5, depth));
}

// ---- The three answering levels (owner directive, 22 Oct 2026) ----
// Exactly three levels replace the old nine-listener ladder:
//   Level 1 "engineer"  — Technical HR + Engineer
//   Level 2 "architect" — Architect + Developer
//   Level 3 "director"  — Director
// The level keys stay the anchor-era keys so the client level map, the
// session stores and the prep fan-out keep working untouched. Any legacy
// listener key maps onto the level it now belongs to.
export type AnswerLevel = "engineer" | "architect" | "director"

export const ANSWER_LEVEL_NAME: Record<AnswerLevel, string> = {
  engineer: "Level 1 — Technical HR + Engineer",
  architect: "Level 2 — Architect + Developer",
  director: "Level 3 — Director",
}

const LEVEL_OF: Record<string, AnswerLevel> = {
  hr: "engineer", technical_hr: "engineer", analyst: "engineer", engineer: "engineer", peer: "engineer",
  developer: "architect", architect: "architect",
  supervisor: "director", lead: "director", director: "director",
}

/** The answering level for a request: an explicit level wins; otherwise the
 *  interviewer/anchor key the client sent maps onto its level. */
export function answerLevel(raw: unknown, fallbackInterviewer?: string): AnswerLevel {
  const fromRaw = typeof raw === "string" ? LEVEL_OF[raw.trim().toLowerCase()] : undefined
  if (fromRaw) return fromRaw
  const fromFallback = typeof fallbackInterviewer === "string" ? LEVEL_OF[fallbackInterviewer.trim().toLowerCase()] : undefined
  return fromFallback || "engineer"
}

// ---- Question register: what kind of depth the QUESTION itself asks for ----
// "concept" — the question asks what something IS: a definition, a comparison,
// a concept explained. It is answered ABSTRACTLY at every level: the technical
// aspects are touched, never turned into a procedure.
// "practice" — the question asks about the candidate's work, a scenario, a
// design, an investigation, a deep example. The level's full depth applies.
export type QuestionRegister = "concept" | "practice"

const CONCEPT_ASK =
  /\b(define|what (?:is|are|does|do|was|were) (?:a |an |the )?|what'?s the difference|difference between|compare|versus|\bvs\.?\b|how does (?:a |an |the )?[\w-]+(?: [\w-]+){0,3} (?:work|works)|explain (?:the|how a|how an|how the)|meaning of|stands? for|meant by)\b/i
const PRACTICE_ASK =
  /\bhow (?:would|do|did|can|could) you\b|\bdesign (?:a|an|the|me)\b|\bsuppose\b|\bif you (?:were|had|found|saw|got)\b|\binvestigat\w*\b|\btroubleshoot\w*\b|\byou (?:discovered|found|built|faced|handled|implemented|configured|deployed|led|ran|owned)\b/i

export function questionRegister(q: string, tier: Tier): QuestionRegister {
  const text = String(q || "")
  const personal = tier === 0 || tier === 1 || tier === 3 || EXP_Q.test(text) || EXP_Q2.test(text) || PERSONAL_ASK.test(text)
  const concept = (DEFINE.test(text) || DEFINE_ANY.test(text) || CONCEPT_ASK.test(text)) && !PRACTICE_ASK.test(text)
  if (concept && !personal) return "concept"
  if (personal) return "practice"
  if (PRACTICE_ASK.test(text)) return "practice"
  if (concept) return "concept"
  if (tier !== 2) return "practice"
  return "practice"
}

/** The controlling depth spec for one answer: the level's register, capped by
 *  the question's own register. Placed in the per-turn context, after the
 *  craft policies, so it is the last word on HOW DEEP the answer goes. */
export function levelGuidance(level: AnswerLevel, register: QuestionRegister): string {
  if (register === "concept") {
    const shade = level === "architect"
      ? "Level shading (Architect + Developer): the mechanism may be named precisely — the check that fails, the boundary that is missing — in a sentence or two. Still no procedure and no tooling steps."
      : level === "director"
        ? "Level shading (Director): after the plain meaning, one line on why it matters — the risk it creates, the exposure it opens — and stop. No procedure."
        : "Level shading (Technical HR + Engineer): foundational JD fluency: define the relevant term, its use, why the requirement matters and its operational context. Explain acronyms once; assume technical screening familiarity without assuming implementation expertise."
    return `QUESTION REGISTER — CONCEPT (this overrides the level's normal depth): this question asks what something IS — a definition, a comparison, a concept — not what the candidate did and not how they would run it. Answer ABSTRACTLY: the plain meaning first, the one distinction that matters, and one small concrete example the listener can picture. Touch the technical aspects — name the mechanism in principle — and stop there. Do NOT turn it into a procedure: no log sources, no queries or keywords to search, no tool steps, no integration or aggregation walkthrough, no "how I would hunt for it", no war story. A definition that becomes a tutorial is a wrong answer at every level. ${shade}`
  }
  switch (level) {
    case "architect":
      return `ANSWER LEVEL — ${ANSWER_LEVEL_NAME[level]}: full build depth. How it was built, set up and integrated, step by step in the order it happens — the components, the settings, queries or code where they ARE the answer, the alternatives weighed and what each costs, the failure modes and how each was handled. This listener builds systems: leave nothing at "we configured it", and ground every step in the background's real stack.`
    case "director":
      return `ANSWER LEVEL — ${ANSWER_LEVEL_NAME[level]}: architect-and-developer understanding, spoken as business. Lead with the decision, or the stakes of the situation. Then explain the supported evidence, the decision or gap, and what risk remains. Name measurements only when the interviewer asks for them, and only quote a measured achievement when an original source substantiates its value. The mechanism is compressed to the one line that shows he knows it cold — no step-by-step procedure, no settings, no tool walkthrough. Every technical point lands on a business consequence: risk reduced, operations protected, money or time saved.`
    default:
      return `ANSWER LEVEL — ${ANSWER_LEVEL_NAME[level]}: adapt to the current question. For Technical HR screening, explain the relevant JD keywords, their uses, requirement rationale and operational significance. For engineering problem-solving, explain hypotheses, evidence, research, alternatives and pivots, dependencies, troubleshooting, remediation, testing and monitoring as relevant. Include ownership, on-call decisions, peer communication and mentoring when asked. Allow technical specifics needed to solve the problem; do not turn every question into a complete runbook. Use supplied metrics or label proposed measures; never invent results.`
  }
}

export function lengthPlan(
  tier: Tier, q: string, interviewer: string,
  opts: { difficulty?: string; length?: string; register?: QuestionRegister } = {},
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
    (CODE_REQUEST.test(q) ? "code" : "") || special ||
    (tier === 0 ? (/\b(career|journey|background|walk me through|how you got)\b/i.test(q) ? "career" : "intro")
      : tier === 1 || (tier !== 3 && CONFLICT.test(q) && pastAsk) ? "story"
      : tier === 3 ? "drill"
      : brief && SIMPLE.test(q.replace(FILLER, "")) && q.split(/\s+/).length < 16 ? "simple"
      : ["hr", "technical_hr"].includes(interviewer) && !/\b(how would you|design|architect|troubleshoot|configure)\b/i.test(q) ? "recruiter"
      : "technical")
  const briefIntro = tier === 0 && /\b(brief|briefly|quick|short|30 seconds|one minute)\b/i.test(q)
  const rawWords = Math.round(
    (briefIntro ? 0.5 : 1) * (PK_WORDS[kind] || 144) *
    (PK_DIFF[opts.difficulty || "standard"] || 1) *
    (LEN_MULT[opts.length || "balanced"] || 1) *
    (AUDIENCE_DEPTH[interviewer] || 1) *
    (SHORT_KINDS.includes(kind) ? 1 : complexity(q)) *
    // An introduction keeps its full budget: "Tell me about yourself." is short, but INTRODUCTION_POLICY says a short
    // question must not cut it down (questionDepth gave it 0.85, so 204 words where 240 are planned).
    (SHORT_KINDS.includes(kind) || tier === 0 ? 1 : questionDepth(q)),
  )
  // A concept question (a definition, a comparison) is answered abstractly at
  // every level — its word budget is capped no matter who is asking, so a
  // bigger level can never inflate it back into a tutorial.
  const words = opts.register === "concept" ? Math.min(rawWords, 170) : rawWords
  return {
    kind, words,
    secs: [Math.round(words * 0.8 / 2.5), Math.round(words * 1.25 / 2.5)],
    maxTokens: Math.min(4000, Math.max(1400, Math.round(words * 2.6) + 900)),
  }
}

// ---- Question detection: three code gates before any model call ----

const BARE_INTRO = /^(?:(?:big|brief|short|quick|full|personal|detailed|self)\s+)?intro(?:duction)?[.?!]*$/i

const ASKS =
  /\?\s*$|^(so,? |and,? |also,? )?(what|how|why|when|where|which|who|can|could|would|will|should|do|does|did|are|is|have|has|tell|walk|describe|explain|give|share|talk|imagine|suppose|pick|choose|name|list|select|design|compare|outline|rank|identify|recommend|propose)\b|\b(tell me|walk me|show me|how would you|what would you|can you|could you|would you|have you|do you)\b/i

// Asks that do not open like a question (the page's ASK_PHRASE in public/kompas/app.js is the same list).
const ASK_PHRASE = /\b(?:my question is|the (?:real |other |next |last |main |follow[- ]?up )?question is|(?:i )?wanted to ask|i want to ask|i'd like to ask|let me ask|what i want to (?:know|understand)|(?:the )?thing i'm trying to get at|the follow[- ]?up is|part (?:one|two|three) is)\b/i

/** Speaker-aware: any Them: line is a question; otherwise needs ? or an ask-pattern. */
export function plainlyNoQuestion(heard: string): boolean {
  const lines = String(heard || "").split("\n").filter((l) => l.trim())
  if (!lines.length) return true
  if (lines.some((l) => /^Them:/.test(l))) return false
  return !lines.some((l) => {
    const t = l.replace(/^(You|Them):\s*/, "")
    // Each sentence of a segment, and asks that do not open like a question ("Got it. My question is how you'd
    // isolate..."): review of 398f299, these were "no question" and the page was dropped.
    return BARE_INTRO.test(t.trim()) || /\?/.test(t) || t.split(/(?<=[.!])\s+/).some((x) => ASKS.test(x)) || ASK_PHRASE.test(t) || LOGISTICS.test(t) || THEIRQ.test(t) || topicFragment(t)
  })
}

/**
 * The last real question inside a messy turn. The microphone hears the interviewer,
 * the candidate reading the previous answer, and noise. The answer follows the ask,
 * not the ramble. "Okay" alone is not a question.
 */
// A transcript line that ends with no punctuation, followed by one that starts with a capital, ends a sentence. Owner's
// live session, 27 Oct 2026, mic only: "Are you working on any projects currently" / "Yeah, yeah, I'm still working with
// the city." / "could you ... elaborate on that" was joined into one asked sentence, and his reply rode along in the cut.
function transcriptSentences(heard: string): string {
  // The page's own labels are never words of the question: his mic fragments ("You (context keywords)") are context
  // only, and the on-screen question and lane lines are copies (review of 398f299: the label was answered as text).
  const lines = String(heard || "").split(/\r?\n/)
    .filter((l) => !/^\s*(?:You \(context keywords\)|Current question \(on screen\)|Lane \([^)]*\)):/i.test(l))
    .map((l) => l.replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/i, "").trim()).filter(Boolean)
  // A segment is several words; one ending in a word that wants more ("integrate", "with", "the") runs on into the next.
  const CONTINUES = /\b(?:a|an|the|to|of|for|with|and|or|but|between|about|on|in|into|from|by|at|as|is|are|was|were|be|your|my|our|their|this|that|these|those|integrate|use|using|configure|compare|between)$/i
  return lines.map((l, i) => (i < lines.length - 1 && l.split(/\s+/).length >= 3 && !/[.?!,;:…-]$/.test(l) && !CONTINUES.test(l) && /^[A-Z]/.test(lines[i + 1]) ? l + "." : l)).join(" ")
}

// The candidate's reply to the previous question, heard on the same mic, is not setup for the next one. Owner's live
// session, 27 Oct 2026 (mic only): his spoken answer about dependency confusion was cut in front of the next question.
// His reply either reads the last answer aloud (most of its content words are that answer's) or defines the subject
// the last question asked about ("Dependency confusion is when..."). The last QUESTION's words alone prove nothing: an
// interviewer's follow-up setup shares them (review of 398f299: "The security tools report the same vulnerability
// twice..." was dropped at 0.4 against question and answer).
const TOPIC_STOP = new Set("about after again also been before being could does doing from have here into just like more most much only other over same some such than that their them then there these they this those through very what when where which while will with would your yours explain describe tell".split(" "))
function topicWords(text: string): string[] {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.-]+/g, " ").split(/\s+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, "")).filter((w) => w.length >= 4 && !TOPIC_STOP.has(w))
}
export type PreviousTurn = { question: string; answers: string }
function belongsToPrevious(sentence: string, previous: PreviousTurn): boolean {
  const words = topicWords(sentence)
  if (words.length < 3) return false
  if (previous.answers) {
    const bag = new Set(topicWords(previous.answers))
    if (words.filter((w) => bag.has(w)).length / words.length >= 0.6) return true
  }
  const defined = sentence.replace(LEAD_FILLER, "").match(/^(?:(?:the|a|an)\s+)?([a-z0-9][\w+#.-]*(?:\s+[a-z0-9][\w+#.-]*){0,3}?)\s+(?:is|are|means|refers to|happens)\b/i)
  if (!defined || !previous.question) return false
  const subject = topicWords(defined[1]), asked = new Set(topicWords(previous.question))
  return subject.length > 0 && subject.every((w) => asked.has(w))
}
/** The last turns the page sends (recentQA): the last question and the last two answers. */
export function previousTurn(history: unknown): PreviousTurn {
  const turns = (Array.isArray(history) ? history : []).filter((t) => t && typeof t === "object").slice(-2) as Array<Record<string, unknown>>
  const last = turns[turns.length - 1]
  return {
    question: last ? String(last.q ?? last.question ?? "").slice(0, 400) : "",
    answers: turns.map((t) => String(t.a ?? "").slice(0, 2400)).join(" ").trim(),
  }
}
const NO_TURN: PreviousTurn = { question: "", answers: "" }

/** The interviewer said the earlier words were not this question. Keep what follows. */
function afterMarkedNextQuestion(text: string): string {
  const next = /\b(?:moving (?:on )?to|on to|let['’]?s (?:move|go) to) (?:the )?next question(?: is)?[,:.\s]*/gi
  let lastEnd = -1
  for (let m: RegExpExecArray | null; (m = next.exec(text));) lastEnd = next.lastIndex
  return lastEnd >= 0 && lastEnd < text.length ? text.slice(lastEnd).trim() : text
}

/** "And why?", "Why?", "How come?" — a follow-up, not a new subject and not silence. */
export function shortFollowUp(text: string): boolean {
  const t = String(text || "").replace(/^(?:You|Them):\s*/gi, " ").replace(/\s+/g, " ").trim()
  // r4: "And?", "and then?", "what happened next?" and "why that?" were dropped or answered with no topic. Failsafe:
  // only these whole short forms count; anything longer is judged as before.
  if (/^(?:(?:and|so|ok(?:ay)?|um+|uh+)[, ]+)*(?:and|and then|then what|what then|what happened next|what happened then|what next|what came next|and after that|go on|why that|why so)[.?!]*$/i.test(t)) return true
  return /^(?:(?:and|so|but|ok(?:ay)?|right|well|then|now|um+|uh+|yeah|yes)[, ]+)*(?:how come|how so|why not|why though|and why|and how|go deeper|dig deeper|explain that|explain this|explain it|say that again|why|how)(?:\s+though)?[.?!]*$/i.test(t)
}

/** An unpunctuated clause, or one that stops on a function word, is still being said. */
export function clauseStillOpen(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t || /[?.!…]["']?$/.test(t)) return false
  if (/^(?:how|what|why|when|where|which|who|can|could|would|will|do|does|did|have|has|are|is|tell|walk|describe|explain|give)\b/i.test(t)) return true
  return /\b(?:a|an|the|to|of|for|with|and|or|but|about|on|in|into|from|by|at|as|your|my|our|their|between|would|could|should)\s*$/i.test(t)
}

const PRIOR_STOP = new Set("the a an and or of to in on for with you your yours we our it its is are was were do does did have has had can could would should will just like really very this that those these what how why when where which who about from into".split(" "))

/** The same question said again. A short follow-up is not a duplicate, and a new noun is not either. */
export function repeatsPriorQuestion(text: string, previous: string): boolean {
  if (repeatsPriorQuestionV2(text, previous)) return true
  try {
    return !shortFollowUp(text) && repeatsPriorQuestionV3(text, previous) // slice 3: only ever adds a repeat
  } catch {
    return false
  }
}

function repeatsPriorQuestionV2(text: string, previous: string): boolean {
  const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()
  const a = norm(text)
  const b = norm(previous)
  if (!a || !b) return false
  if (shortFollowUp(text)) return false
  if (a === b) return true
  const words = (s: string) => norm(s).split(/\s+/).filter((w) => w.length >= 3 && !PRIOR_STOP.has(w))
  const aw = words(text)
  const bw = new Set(words(previous))
  if (!aw.length || aw.some((w) => !bw.has(w))) return false
  return aw.filter((w) => bw.has(w)).length / aw.length >= 0.85
}

export function cutQuestion(heard: string, previous: PreviousTurn = NO_TURN, reask = false): string {
  const raw = transcriptSentences(repairDictation(heard)).replace(/\s+/g, " ").trim()
  const text = afterMarkedNextQuestion(raw)
  if (BARE_INTRO.test(text)) return "Tell me about yourself"
  // The interviewer's whole ask, not its last clause (measured 26 Oct 2026: "Design X. Explain trust boundaries..."
  // was answered as "Explain trust boundaries...", and "Give a falsifiable test and an exit criterion" was dropped).
  // The last ask, the asks and the scenario just before it, and the instructions right after it, in order.
  const parts = askSentences(text)
  let last = -1
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].kind === "ask") { last = i; break }
  if (last < 0) return ""
  // Deterministic window selection (owner, 31 Oct 2026, count corrected 1 Nov 2026): before it answers, the engine
  // always puzzles "was this everything they were expecting?" It keeps every piece that belongs to the question —
  // the brain chooses the last 2 things, the last 3 things, or many more sentences, however many the question spans —
  // and only shrinks that window on proof something was settled: an ask from the previous turn, the candidate's own
  // speech taking the floor, or a long fragment between asks. There is no count cap: a fixed count is what cut the
  // head off a question spanning more than four asks, leaving the card answering only the tail. A short
  // acknowledgement ("Yeah.", "Right.") or setup sentences between asks never shrink it: shrinking there is what left
  // the card answering only the last question, as if the rest was never heard.
  // "Let me push on that. <setup>": announced setup is kept. So is the sentence a pointing ask ("rate limit it") needs.
  const before = TOPIC_SHIFT.test(text) ? NO_TURN : previous
  const points = /\b(?:it|that|this|them|those|these|there)\b/i.test(parts[last].text)
  const reply = (i: number) => !/\?$/.test(parts[i].text) && !ASK_OPENER.test(parts[i].text) && !(points && i === last - 1) && belongsToPrevious(parts[i].text, before)
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length
  const kept: number[] = [last]
  let c = last - 1
  // A re-press is the user saying the last answer missed: the concatenation widens to whatever was heard, previous
  // things included, so a part missed at one instance comes back on the next tap. The material itself stays bounded
  // client-side (the page chain plus what was heard since) and by the 4000-char return cap, so keeping every ask back
  // to the first break never re-forms the whole interview. The break rules — previous turn, own speech, long
  // fragment — still hold on a re-press. (reask is kept in the signature for callers; since 1 Nov 2026 it no longer
  // changes the count, because no mode is count-capped anymore.)
  while (c >= 0) {
    if (reply(c)) break
    const kind = parts[c].kind
    if (kind === "ask") { kept.unshift(c); c-- }
    else if (kind === "context") { kept.unshift(c); c-- }
    else if (kind === "noise") {
      // One short acknowledgement run between asks is skipped: never kept as text, never a break. A longer
      // fragment is a real break (the transcriber's cut-off tail in the 27 Oct 2026 Gemalto card).
      let s = c, w = 0, settled = false
      while (s >= 0 && parts[s].kind === "noise") { w += words(parts[s].text); if (reply(s)) settled = true; s-- }
      if (settled || w > 4) break
      c = s
    } else break // the candidate's own speech: an answer was given, or the floor changed hands
  }
  while (kept.length > 1 && parts[kept[0]].kind === "context" && words(parts[kept[0]].text) > 40) kept.shift()   // a long monologue is not setup
  // "could you elaborate on that": the ask it points to is kept, the candidate's own reply between them is not.
  let pointed = ""
  if (kept.length === 1 && /\b(?:that|this|it|those|these)\b/i.test(parts[last].text) && last >= 2 && parts[last - 1].kind === "own" && parts[last - 2].kind === "ask") pointed = parts[last - 2].text.replace(/[.]$/, "") + ". "
  // Instructions after the ask ("Give a falsifiable test", "Keep it suitable for technical HR") are asks themselves, so
  // the last ask is the end of the question.
  const q = (pointed + kept.map((i) => parts[i].text).join(" ")).replace(/\s+/g, " ").trim()
  // "And why?" is two words or fewer. Dropping it left the previous answer on screen.
  if (!q || (q.split(/\s+/).length < 3 && !shortFollowUp(q) && !shortFollowUp(text) && !shortLogistics(q) && !shortLogistics(text))) return ""
  return (q.charAt(0).toUpperCase() + q.slice(1)).slice(0, 4000)
}

// The openers of an interviewer's ask or instruction. Before 26 Oct 2026 only how/what/why..., can/would you, tell me,
// walk me, give me, explain, describe, define and compare counted, so any other imperative ("Design", "Walk through",
// "State", "Give a", "Keep it") was not part of the question at all.
const ASK_OPENER = /^(?:how|what|why|when|where|which|who|whom|whose)\b(?!\s+to\b)|^(?:can|could|would|will|should|do|does|did|are|have|has)\s+(?:you|we)\b|^(?:tell|walk|take|talk|show|give|explain|describe|define|compare|contrast|differentiate|distinguish|design|build|implement|configure|architect|plan|outline|list|name|state|share|write|draft|map|diagnose|troubleshoot|debug|identify|recommend|propose|justify|estimate|summari[sz]e|discuss|evaluate|assess|analy[sz]e|elaborate|expand|go|dig|introduce|imagine|suppose|pick|choose|select|rank|prioriti[sz]e|break|weigh|defend|verify|validate|test|measure|quantify|detail|clarify|demonstrate|illustrate|cover|include|keep|focus|assume|consider|avoid|limit|stay|mention|start|end|finish|continue)\b/i
// Somewhere inside a sentence that does not open as one (speech-to-text often has no full stops): the ask starts here.
const ASK_INSIDE = /\b(?:how|what|why|when|where|which|who)\b(?!\s+to\b)|\b(?:can|could|would|will|do|did|are|have)\s+you\b|\b(?:tell me|walk me|give me|explain|describe|define|compare|design|build|implement|configure)\b/i
const LEAD_FILLER = /^(?:(?:ok(?:ay)?|so|and|also|now|then|next|finally|right|alright|all right|well|yes|yeah|uh+|um+|please|great|perfect|cool|sure)[,.!]?\s+)+/i
const PLEASANTRY = /^(?:(?:that'?s|that is)\s+(?:great|good|interesting|fair|helpful|clear|right|true)|thanks?\b|thank you\b|(?:great|perfect|nice|good|interesting|excellent|awesome|wonderful|got it|makes sense|i see|understood)[.!]*$)/i
const OWN_WORDS = /^(?:i|i'm|i've|i'd|i'll|we|we're|we've|we'd|my|our|me)\b/i
// Speaks to the candidate, or says it is asking: such a sentence is never read as a statement.
const ADDRESSES = /\byou(?:rs?|rself)?\b/i
const ASKS_FOR = /\b(?:question|asking|wonder(?:ing)?|curious|follow[- ]?up|(?:want|like|love|need|trying) to (?:know|hear|understand|see|learn|get at)|get at|part (?:one|two|three)|next part|scenario)\b/i
// The interviewer says the next sentence is new setup, even when it shares the last turn's words.
const TOPIC_SHIFT = /\b(?:different topic|new topic|change of topic|switch(?:ing)? gears|moving on|let me push|push on that|build(?:ing)? on that|next question|(?:another|new|different) scenario|let's say|imagine|suppose)\b/i

type AskPart = { kind: "ask" | "context" | "noise" | "own"; text: string }

/** Each sentence, read as an ask, setup for one, a filler, or the candidate's own words. */
function interviewSentences(text: string): string[] {
  // "U.S. citizen?" is one question. The period in U.S. is an abbreviation, not a sentence end.
  const hidden = String(text || "").replace(/\bU\.S\.(?=\s)/gi, "U\u0001S\u0001").replace(/\bU\.K\.(?=\s)/gi, "U\u0001K\u0001")
  return hidden.split(/(?<=[.?!])\s+/).map((s) => s.replace(/\u0001/g, ".").trim()).filter(Boolean)
}

/** A two-word logistics ask is still the question. "U.S. citizen?" used to fall under the three-word floor and disappear. */
function shortLogistics(text: string): boolean {
  return /\b(?:u\.?s\.?|u\s+s|united states)\s+citizens?\b|\b(?:h-?1b|opt|green card|hybrid|on-?site|salary|remote|bonus|notice|ts\s*\/\s*sci|start date|night shift|on-?call|relocation|clearance|sponsorship|shift|weekend|overtime|citizen|travel|visa|w-?2|c2c|full[- ]time|pto|benefits|401k|equity|ead|l-?1|hourly|day rate|contract)\b/i.test(text)
}

function askSentences(text: string): AskPart[] {
  const sentences = interviewSentences(text)
  // The words after a fragment the transcriber cut off ("captured... how to use the Gemalto app") are that fragment's
  // tail: setup there is noise too, and only a clear ask survives it.
  return sentences.map(classifyAskSentence).map((part, i) =>
    i > 0 && /(?:\.{2,}|…)$/.test(sentences[i - 1]) && part.kind === "context" ? { kind: "noise", text: part.text } : part)
}

function classifyAskSentence(sentence: string): AskPart {
  {
    const bare = sentence.replace(/^(?:\.{2,}|…)\s*/, "").replace(LEAD_FILLER, "").trim()
    if (!bare || noiseOnly(bare) || PLEASANTRY.test(bare)) return { kind: "noise", text: bare }
    // Measured 27 Oct 2026 on his live card: "Why I have it. ...requirements. 11. Explain the concept of session
    // recording..." kept all of it. A why/how/what straight into "I" is the candidate talking; a short fragment with no
    // ask in it, or one the transcriber cut off with an ellipsis, is not part of the question.
    const asked = /\?$/.test(bare)
    if (!asked && /^(?:why|how|what|when|where|which|who)\s+(?:i|we|my|our|i'm|i've|we're)\b/i.test(bare)) return { kind: "own", text: bare }
    if (!asked && !ASK_OPENER.test(bare) && (bare.split(/\s+/).length < 4 || /\.{2,}|…/.test(bare))) return { kind: "noise", text: bare }
    if (ASK_OPENER.test(bare) || (asked && !OWN_WORDS.test(bare))) return { kind: "ask", text: bare }
    // "Dependency confusion is when the build pulls...", "..., which is why we pin names": in a sentence that speaks to
    // no one and asks for nothing, a wh-word after "is" or a comma explains and "the build" is a noun, so it is not an
    // ask (baseline contract, 27 Oct 2026: his spoken answer was glued in front of the next question). A sentence that
    // speaks to the candidate ("my question is how you'd...") or says it asks ("the real question is why...") keeps
    // every hit: the review of 398f299 measured eleven real questions lost when the blanking applied to them too.
    const explains = !ADDRESSES.test(bare) && !ASKS_FOR.test(bare)
    const blank = (m: string) => " ".repeat(m.length)
    const inside = (explains
      ? bare.replace(/\b(?:is|are|was|were|'s|means|happens)\s+(?:when|where|what|which|who|how|why)\b/gi, blank)
        .replace(/,\s*which\b/gi, blank)
        .replace(/\b(?:the|a|an|this|that|each|every)\s+(?:build|design)\b/gi, blank)
      : bare).search(ASK_INSIDE)
    if (inside > 0 && bare.slice(inside).split(/\s+/).length >= 3) {
      const tail = bare.slice(inside)
      // "In your experience, how do you..." keeps its lead; a ramble before the ask does not.
      return { kind: "ask", text: OWN_WORDS.test(bare) ? tail.slice(0, 400) : bare }
    }
    return { kind: OWN_WORDS.test(bare) ? "own" : "context", text: bare }
  }
}

const SPOKEN_NOISE =
  /^(?:ok(?:ay)?|hi|hello|hey|thanks|thank you|yeah|yep|yes|no|nope|uh+|um+|hmm+|uh[- ]?huh|mm+[- ]?hmm+|m+hm+|mm+|ah+|oh+|i see|bye|goodbye|good morning|good afternoon|good evening|how are you|what'?s up|cool|sure|right|alright|all right|got it|sounds good)[.!?]*$/i

// Stress round 2, idea E of the competitor study (a rival's auto trigger fired on "yeah that's a tough one"): 13 of 15
// interviewer acknowledgements and small-talk lines ("makes sense", "let's dive in", "I see what you mean", "give me one
// second", "sorry, my dog is barking") were formed into a question and answered; "I see what you mean" became the
// question "What you mean". A whole utterance that is only one of these, with no question mark, is not a question.
const SMALL_TALK_LEAD = "(?:(?:yeah|yes|ok(?:ay)?|right|alright|all right|so|well|hmm+|mm+|oh|ah|nice|great|good|perfect|cool|sure|sorry|wow|excellent|awesome|thanks)[,.!]?\\s+)*"
const SMALL_TALK_CORE = [
  "that'?s (?:a |an |really |very )?(?:tough|hard|good|great|fair|interesting|helpful|fine|clear|nice|solid|cool|tricky)(?: one| question| point| answer| idea| example)?",
  "that (?:makes sense|helps|is helpful|is interesting|works)",
  "makes (?:total |perfect )?sense", "fair enough", "good,? good", "very good", "all good", "no worries", "sounds good",
  "(?:thanks|thank you)(?: so much| for that)?", "i see(?: what you mean)?", "i hear you", "got it", "understood", "noted",
  "interesting(?: point| one)?", "(?:i )?(?:really )?like that(?: answer| idea| one| example)?", "(?:i )?appreciate (?:that|it)",
  "let'?s (?:dive in|get started|begin|start|move on|keep going|continue|jump in|jump right in)",
  "give me (?:a|one) (?:second|sec|moment|minute)", "(?:just )?(?:one|a) (?:second|sec|moment)", "hold on", "bear with me",
  "let me (?:pull up|find|check|grab|look at) (?:my|the) (?:notes|screen|list|questions|next question)",
  "(?:my|the) (?:dog|cat|kid|kids|baby|neighbou?r) (?:is|are) (?:barking|crying|loud|here|making noise)",
  "the weather (?:has been|is|was) [a-z ]{2,30}", "(?:you'?re|you are) breaking up(?: a (?:bit|little))?", "okay cool", "cool cool", "nice one",
  // Round 6 (29 Oct 2026): five more interviewer asides were formed into questions and answered.
  "that'?s (?:basically |about |pretty much )?(?:the team|it|all|everything|the role|the setup)", "right,? right",
  "(?:we'?ll|let'?s|i'?ll) circle back (?:on|to) (?:that|it|this)",
  "(?:my|the|your) (?:screen|video|audio|connection|internet|wi-?fi|mic) (?:froze|dropped|cut out|lagged|glitched|is lagging)(?: for a (?:second|sec|moment|bit))?",
  "i'?m (?:just )?(?:writing|noting|jotting) (?:that|this|it) down", "let me (?:write|note|jot) (?:that|this|it) down",
  // Round 8 (29 Oct 2026): five more asides were formed into questions and answered ("mm-hm", "got it, thanks", "I'm going
  // to mute for a second", "let me check the time", "sorry, someone just walked in"). Whole-utterance only, no "?".
  "(?:mm-?hm+|uh-?huh|mhm+)(?:,? (?:okay|ok|right|sure|yeah|got it))?", 
  // Round 10: meeting housekeeping.
  "(?:i'?m|i am) (?:going to|gonna|about to) share my screen", "(?:sorry,? )?(?:i'?m|i was|you'?re|you were) (?:on|still on) mute",
  "can (?:everyone|everybody|you|you all) (?:hear|see) me(?: okay| alright| now| well| fine)?", "got it,? (?:thanks|thank you)", "(?:i'?m|i am) (?:going to|gonna) (?:mute|go on mute)(?: for a (?:second|sec|moment|bit|minute))?",
  "let me (?:check|look at) the (?:time|clock)", "someone (?:just )?(?:walked|came) in",
]
const SMALL_TALK = new RegExp(`^${SMALL_TALK_LEAD}(?:${SMALL_TALK_CORE.join("|")})[.!]*$`, "i")

/** An interviewer acknowledgement or small talk, on its own: never answered. */
export function smallTalkOnly(text: string): boolean {
  const t = String(text || "").replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gi, " ").replace(/\s+/g, " ").trim()
  if (!t || /\?/.test(t) || t.split(/\s+/).length > 14) return false
  return SMALL_TALK.test(t)
}

/** A greeting or a filler is not a question. A short technical fragment is. */
export function noiseOnly(text: string): boolean {
  const t = String(text || "")
    .replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!t) return true
  return SPOKEN_NOISE.test(t) || smallTalkOnly(t)
}

/**
 * The question the answer must follow. A pinned line is the one already on
 * screen. A ramble still loses to the ask inside it. A greeting stays
 * unanswered. Anything else typed or heard is kept — dropping it is what
 * left the card on the previous answer.
 */
export function questionToAnswer(heard: string, explicit: string, pinned = false, previous: PreviousTurn = NO_TURN, reask = false): string {
  const asked = String(explicit || "").replace(/\s+/g, " ").trim()
  if (pinned && asked && !noiseOnly(asked)) {
    // The formed question on the card is the whole of what was asked (owner, 23 Oct 2026): every ask, the setup between
    // them and every instruction, in order. Only leading filler and the candidate's own words before the first ask go.
    // Before 26 Oct a single recognised ask was cut out of it, so "Design X. Explain Y." was answered as "Explain Y."
    const parts = askSentences(asked)
    let from = 0
    while (from < parts.length - 1 && (parts[from].kind === "noise" || parts[from].kind === "own")) from++
    const whole = parts.slice(from).map((p) => p.text).join(" ").replace(/\s+/g, " ").trim()
    return (whole && !noiseOnly(whole) ? whole : asked).slice(0, 4000)
  }
  // Stress round 5 (29 Oct 2026): unpinned with the derived ask (a retry sends both), the ask was cut out of heard AND
  // appended again, so the model was told to answer "...scope an access review? Anyway, how do you scope an access
  // review?". When heard already holds the ask, heard alone is cut; the joined cut stays as the fallback.
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const inHeard = asked && key(asked).length > 0 && key(heard).includes(key(asked))
  const cut = (inHeard ? cutQuestion(heard, previous, reask) : "") || cutQuestion([heard, asked].filter(Boolean).join("\n"), previous, reask)
  if (cut) return cut
  if (asked && !noiseOnly(asked)) return asked.slice(0, 4000)
  const bare = String(heard || "")
    .replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gim, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (bare && !noiseOnly(bare)) {
    const words = bare.split(/\s+/).filter(Boolean)
    // "Explain that" is two words. Dropping it left the previous answer on screen.
    const shortFollow = words.length >= 2 && words.length <= 9 && (PRESS.test(bare) || POINTS_BACK.test(bare))
    if (topicFragment(bare) || words.length >= 3 || shortFollow || shortLogistics(bare)) return bare.slice(0, 4000)
  }
  return ""
}

/** A short topic, with no question mark, is still the question. A greeting is not. */
export function topicFragment(text: string): boolean {
  const t = String(text || "")
    .replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!t || noiseOnly(t) || /\?/.test(t) || ASKS.test(t) || ASK_PHRASE.test(t)) return false
  if (/\b(?:thanks|thank you|happy to|nice to meet|good to meet|making the time)\b/i.test(t)) return false
  if (/^(?:hi|hello|hey|yes|yeah|ok(?:ay)?|sure|of course)\b/i.test(t)) return false
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 12) return false
  const said = words.map((w) => w.replace(/[.!?]+$/g, "")).filter((w) => w && !SPOKEN_NOISE.test(w))
  return said.length >= 1
}

/**
 * The code gates of a derive, in order: plainly no question → null; one clean question from the call audio; the cut,
 * which knows the previous turn unless this is a re-ask of it. "" means the model decides. The service and the
 * baseline contract (scripts/kompas-baseline.mjs) both call this, so the contract replays the real derive.
 */
/**
 * Round 8 (29 Oct 2026): "uh so, um, how do you like, scope an an access review" was derived and answered word for word,
 * so the ask "scope an access review" never appeared in it. Fillers inside the ask, "you like," and a doubled word or
 * restarted phrase ("how do you, how do you prove") are removed. Failsafe: if that leaves nothing, the ask is kept as is.
 */
export function tidySpokenAsk(question: string): string {
  const raw = String(question || "")
  const out = raw
    .replace(/(^|[\s,])(?:um+|uh+|erm+)\b[,.]?/gi, "$1")
    .replace(/\b(you|we|i)\s+like,\s+/gi, "$1 ")
    .replace(/\b((?:\w+\s+){1,3}\w+),?\s+\1\b/gi, "$1")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/\s+([?.!,])/g, "$1")
    .replace(/^[\s,]+/, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!out) return raw.trim()
  // Once tidied, the heard ask and the derived ask can be the same sentence; it is said once.
  const seen = new Set<string>()
  const once = out.split(/(?<=[.?!])\s+/).filter((sentence) => {
    const key = sentence.toLowerCase().replace(/[^a-z0-9 ]+/g, "").trim()
    if (key && seen.has(key)) return false
    seen.add(key)
    return true
  }).join(" ")
  return once.charAt(0).toUpperCase() + once.slice(1)
}

export function deriveByCode(heard: string, history: unknown, reask = false): string | null {
  const derived = deriveByCodeRaw(heard, history, reask)
  return derived ? tidySpokenAsk(derived) : derived
}

function deriveByCodeRaw(heard: string, history: unknown, reask = false): string | null {
  if (!heard || plainlyNoQuestion(heard)) return null
  // Every line is small talk ("Them: makes sense"): nothing to derive, and the model is not asked to find a question in it.
  if (String(heard).split("\n").filter((l) => l.trim()).every((l) => noiseOnly(l))) return null
  const clean = cleanQuestion(heard) || cutQuestion(heard, reask ? NO_TURN : previousTurn(history), reask)
  if (clean) return clean
  const topic = topicFragment(String(heard).replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gim, " "))
  return topic ? String(heard).replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gim, " ").replace(/\s+/g, " ").trim().slice(0, 4000) : ""
}

/**
 * The question the answer request answers: the formed question when pinned, otherwise the cut of what was heard with
 * the derived question, knowing the previous turn (review of 398f299: without it his reply was glued back in front of
 * the question the model was told to answer). A topic-less follow-up is tied to the last question.
 */
/** Screen capture labels the kind of question. That label is not part of the ask. */
export function stripScreenChrome(question: string): string {
  const stripped = String(question || "").replace(/^Question \d+ \([^)\n]{0,80}\):\s*/gm, "").trim()
  return stripped || String(question || "").trim()
}

// r4 (29 Oct 2026): an interviewer who corrects themselves mid-question ("Tell me about X, sorry, actually, how did you
// handle Y?") was answered on the whole garbled line. Only the corrected ask is kept; one that points back ("after it")
// keeps the first topic as what it follows up on. Failsafe: no marker after a clause break, a remainder under three
// words or without an ask word, or any error → the text unchanged.
const SELF_CORRECTION = /(?:[,.;:!?]|\s[\u2014\u2013-])\s*(?:(?:sorry|actually|no|wait|no wait|scratch that|let me rephrase(?: that)?|i mean|or rather|rather)[,.;:]?\s+)+/gi
const ASK_WORD = /^(?:how|what|why|when|where|who|which|tell|walk|describe|give|can|could|would|did|do|have|explain|talk)\b/i
export function afterSelfCorrection(text: string): string {
  try {
    const t = String(text || "")
    let last: RegExpExecArray | null = null
    for (const m of t.matchAll(SELF_CORRECTION)) {
      if (/\b(?:sorry|actually|wait|scratch|rephrase|mean|rather)\b/i.test(m[0])) last = m as RegExpExecArray
    }
    if (!last) return t
    const rest = t.slice(last.index + last[0].length).trim()
    const before = t.slice(0, last.index).replace(/[\s,.;:\u2014\u2013-]+$/, "").trim()
    if (rest.split(/\s+/).length < 3 || !ASK_WORD.test(rest) || !before) return t
    const ask = rest.charAt(0).toUpperCase() + rest.slice(1)
    if (/\b(?:it|that|this|them|those)\b/i.test(ask)) return `${ask.replace(/[?.!\s]+$/, "")} \u2014 following up on: "${before}"?`
    return ask
  } catch {
    return String(text || "")
  }
}
export function questionForAnswer(heard: string, asked: string, pinned: boolean, again: boolean, history: unknown): string {
  const turns = Array.isArray(history) ? history : []
  const formed = afterMarkedNextQuestion(questionToAnswer(stripScreenChrome(heard), stripScreenChrome(asked), pinned, again ? NO_TURN : previousTurn(turns), again))
  const corrected = formed ? afterSelfCorrection(formed) : formed
  const q = corrected ? (/following up on: "/.test(corrected) && corrected !== formed ? corrected : tidySpokenAsk(corrected)) : formed
  const source = String((pinned && asked) || heard || "").split("\n").filter((l) => l.trim()).pop() || ""
  const startedWithAnd = /^\s*(?:(?:Them|You)(?: \([a-z]+\))?:\s*)?(?:and|but)\b/i.test(source)
  // Round 13: "I'm not convinced. Who decides it is acceptable?" lost the pushback when only the last ask was kept, so it
  // was answered as a new question with no topic. With history, the pushback sentence is kept in front of the ask.
  const said = source.replace(/^\s*(?:Them|You)(?: \([a-z]+\))?:\s*/i, "").trim()
  const pushed = turns.length && q && PUSHBACK.test(said) && !PUSHBACK.test(q) && said.replace(/[?.!\s]+$/, "").toLowerCase().endsWith(q.replace(/[?.!\s]+$/, "").toLowerCase().slice(-20)) ? `${said.match(/^[^.?!]*[.?!]?/)?.[0] || ""} ${q}`.trim() : q
  return q ? resolveFollowUp(pushed, turns.map((h) => {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>
    return { q: String(o.q ?? o.question ?? "").slice(0, 300) }
  }), startedWithAnd) : ""
}

// The Director level's opening, in the owner's words, plus the 27 Oct rule that the decision owner is a role.
export const DIRECTOR_OPENING = `DIRECTOR OPENING: Answer the exact question in its own terms. For a definition or comparison, start with the meaning or direct preference, not an unasked decision-maker. For a process question, explain the evidence and the risk judgment. For personal experience, state the real work and specific supported action, not a fictitious approval. Name a decision owner only if the interviewer asks who owns or approves something; never add a KPI or metric the question does not call for. A decision owner, when relevant, is a role in the organisation, never a person's name, and the candidate keeps the title the resume gives: never speak as a CISO or any title the resume does not hold.`

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

/** What is left once the follow-up phrase and the pronoun are gone. A named subject means a new question. */
function followUpResidue(q: string): string {
  return String(q || "")
    .replace(PRESS, " ")
    .replace(POINTS_BACK, " ")
    .replace(/\b(?:explain|elaborate|expand|clarify|repeat|deeper|detail|specifically|exactly|meaning|example)\b/gi, " ")
    .replace(/\b(?:would|could|should|please|just|really|start|with|about|through|walk)\b/gi, " ")
}

/** A follow-up that adds to the previous ask rather than starting a new one. */
export const ADDITIVE_FOLLOW_UP =
  /^\s*(?:(?:and|so|okay|ok)[,\s]+)?(?:(?:can|could|would|will) you (?:also|then)\b|(?:can|could|would) you add\b[^?]*\b(?:it|that|this|them|there)\b|what would you (?:monitor|do differently|change|measure|track|log|alert on)\b|what (?:about|if)\b|how (?:would|do|will) you test (?:it|that|this|them)\b|also\b|any (?:edge cases|trade-?offs)\b|what(?:'s| is) the (?:time|space) complexity\b)/i

/** A topic-less follow-up ("go deeper", "explain that") is glued to the previous question IN CODE.
 * A short question that still names its own subject is not. "What exactly is least privilege?"
 * used to be rewritten as a follow-up of whatever was on screen, so a different question was answered as the same one.
 */
// Round 9 (29 Oct 2026): short follow-ups that start with "and" ("And who signs it off?", "And how often?", "And who do
// you include?") or lean on a pronoun ("How long can it last?", "If it fails?") were answered as new questions with no
// subject. They are tied when short and they do not open a new subject of their own ("And what is zero trust?" is new).
const CONTINUES_LEAD = /^\s*(?:and|so then|but)\b[,\s]+/i
const OWN_SUBJECT = /\b(?:what (?:is|are)|define|explain|tell me about|describe|where are you|when can you)\b/i
const LEANS_BACK = /\b(?:it|they|them|those|these|ones)\b/i
function continuesPrevious(q: string, startedWithAnd: boolean): boolean {
  const words = q.split(/\s+/).length
  if ((startedWithAnd || CONTINUES_LEAD.test(q)) && words <= 7 && (!OWN_SUBJECT.test(q) || LEANS_BACK.test(q))) return true
  return words <= 5 && LEANS_BACK.test(q) && !OWN_SUBJECT.test(q) && !/^\s*(?:tell|walk|describe|why do you want)\b/i.test(q)
}

/** The question a follow-up chain started from: the innermost quoted ask of "X — following up on: "…"". */
export function rootAsk(q: string): string {
  let out = String(q || "")
  for (let i = 0; i < 5; i++) {
    const m = out.match(/following up on:\s*"([\s\S]*)"\??\s*$/i)
    if (!m) break
    out = m[1]
  }
  return out.replace(/[?.!\s]+$/, "")
}

/** "the second one" after a multi-part question: the part it points at, or "" when the previous ask has no list. */
const ORDINALS: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, last: -1 }
export function orderedPartOf(previous: string, ask: string): string {
  const m = String(ask || "").match(/\b(?:the )?(first|second|third|fourth|last) (?:one|part|point|thing|bit)\b/i)
  if (!m) return ""
  const body = String(previous || "").replace(/[?.!\s]+$/, "")
    .replace(/^\s*(?:can you |could you )?(?:explain|describe|define|tell me about|walk me through|what (?:is|are))\s+/i, "")
  const parts = body.split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return ""
  const i = ORDINALS[m[1].toLowerCase()]
  return parts[i < 0 ? parts.length - 1 : i] || ""
}

/** Round 12 (29 Oct 2026): interviewer pushback ("That doesn't sound right.") was answered as a new question with
 * "that doesn't sound right" as its topic. It is tied to the question it challenges. A pushback that carries a new
 * question of its own ("That doesn't sound right. How would you prove it?") stays tied, since it is the same topic. */
export const PUSHBACK = /^\s*(?:hmm+[,.]?\s*|well[,\s]+|really\??\s*)*(?:that (?:doesn\'t|does not) (?:sound|seem) right|i\'m not (?:sure|convinced)(?: that\'s (?:right|correct))?|i(?:\'d| would) push back(?: on that)?|really\?\s*(?=\w)|that seems (?:backwards|too simple|wrong|off)|i don\'t think that\'s (?:right|how it works)|that contradicts|are you sure(?: about that)?|i disagree|most people would (?:say|just)|that\'s not (?:right|what i)|i\'m not buying)\b/i
export function resolveFollowUp(d: string, history: Array<{ q?: string }>, startedWithAnd = false): string {
  const q = String(d || "").trim()
  const hist = Array.isArray(history) ? history.filter((h) => h && h.q) : []
  if (!q || !hist.length) return q
  // Round 9: a follow-up to a follow-up nested the tag ("X — following up on: "Y — following up on: …"") and the inner tag
  // was said aloud. The chain is tied to its root question, the real topic.
  const lastRaw = String(hist[hist.length - 1].q)
  const inChain = /following up on:/i.test(lastRaw)
  const lastAsk = rootAsk(lastRaw)
  if (PUSHBACK.test(q) && q.split(/\s+/).length <= 30) return `${q.replace(/[?.!\s]+$/, "")} — following up on: "${lastAsk}"?`
  const part = orderedPartOf(lastAsk, q)
  if (part) {
    // Round 10: "And the second one again?" names the part, so the answer and keywords carry it. Failsafe: no list, no change.
    const said = q.replace(/\b(?:the )?(?:first|second|third|fourth|last) (?:one|part|point|thing|bit)\b/i, part).replace(/[?.!\s]+$/, "")
    return `${said.charAt(0).toUpperCase() + said.slice(1)} — following up on: "${lastAsk}"?`
  }
  if ((continuesPrevious(q, startedWithAnd) || (inChain && q.split(/\s+/).length <= 5 && !OWN_SUBJECT.test(q) && !/^\s*(?:tell|walk|describe)\b/i.test(q))) && !shortFollowUp(q)) {
    const say = q.replace(CONTINUES_LEAD, "").replace(/[?.!\s]+$/, "")
    return `${say.charAt(0).toUpperCase() + say.slice(1)} — following up on: "${lastAsk}"?`
  }
  if (shortFollowUp(q)) {
    const last = lastAsk
    const say = q.replace(/[?.!\s]+$/, "")
    return `${say.charAt(0).toUpperCase() + say.slice(1)} — following up on: "${last}"?`
  }
  const points = PRESS.test(q) || POINTS_BACK.test(q)
  const named = topicWords(followUpResidue(q)).length > 0
  const short = q.split(/\s+/).length <= 9
  // Idea D (stress round 3): an additive follow-up ("can you also add unit tests?") names a new word but stays on the
  // previous topic, so it is tied too. A short ask that is its own question ("what is least privilege?") is not.
  if (!(short && ((points && !named) || ADDITIVE_FOLLOW_UP.test(q)))) return q
  const last = lastAsk
  return `${q.replace(/[?.!\s]+$/, "")} — following up on: "${last}"?`
}

const PROPER_STOP = new Set("what how why when where which who tell walk have has can could would will did does are the and but for you your yeah okay right great thanks this that those these".split(" "))
const SEPARATE_START = /^(?:what|why|how|when|where|which|who|can you|could you|would you|will you|do you|did you|have you|are you|tell me|walk me|describe)\b/i
const CONTINUES_ASK = /^(?:what if|what about (?:that|this|it)|how about (?:that|this)|why (?:is|was|did|would) (?:that|it|this)|how (?:did|would|do) (?:that|it|this)|which of (?:those|these|them)|walk me through (?:that|this|it))\b/i

function properNouns(sentence: string): string[] {
  return (sentence.match(/\b[A-Z][A-Za-z0-9+#.-]{2,}\b/g) || []).map((w) => w.toLowerCase()).filter((w) => !PROPER_STOP.has(w))
}

function whatIsHead(sentence: string): string {
  const m = sentence.replace(LEAD_FILLER, "").match(/^what (?:is|are)\s+(?:an?|the\s+)?(?:meaning of\s+)?([a-z0-9][\w+#.-]*(?:\s+[a-z0-9][\w+#.-]*){0,3})/i)
  return m ? m[1].toLowerCase().replace(/[?.!\s]+$/g, "").trim() : ""
}

// Slice 3 (29 Oct 2026), round-2 production failures. Every rule below only runs inside the v3 pass, and
// splitDistinctAsks returns the v2 cut whenever the v3 pass throws or would change a single heard word.
const SPLIT_ORDINAL = /^(?:(?:first|second|third|fourth|fifth)(?:ly)?|lastly|number (?:one|two|three|four|five))\b[,:]?\s*/i;
const SPLIT_TAG = /,\s*(?:right|correct|yes|no|yeah|true|isn't it|aren't you|don't you|didn't you|haven't you|wasn't it)\?\s*$/i;
const SPLIT_POLITE = /^(?:i'?d (?:love|like|be (?:curious|interested|keen)) to (?:hear|know|learn|understand)|i would (?:love|like) to (?:hear|know)|i'?m curious (?:about|how|what|why|to hear))\b/i;
const SPLIT_AUDIO_CHECK = /^(?:(?:hello|hi|hey)[,.!]?\s+)?(?:(?:can|could) you (?:hear|see) me(?:\s+(?:ok(?:ay)?|now|alright|all right|well|clearly))?|(?:am i|are you) (?:audible|on mute|muted|still there|there)|is my (?:audio|mic|microphone|video|sound) (?:ok(?:ay)?|working|coming through)|(?:are|is) (?:you|my audio) (?:breaking up|cutting out))[?.!]*$/i;
const SPLIT_CONTEXT_FOLLOW = /^(?:what about|how about)\s+(?:with\s+|in\s+|for\s+|on\s+)?[\w+#.-]+(?:\s+[\w+#.-]+){0,3}\s*\?*$|^(?:can|could) you (?:give|share) (?:me |us )?(?:an?|one|some) (?:\w+ )?examples?\b|^(?:for example|for instance|like what|such as)\??$|^what (?:was|were) the (?:outcome|result|results|impact|lesson|lessons|takeaway)\b|^what happened (?:next|after|then)\b|^(?:and )?then what\b|^what did you learn\b|^(?:how|what|why|when|where) (?:does|do|did|is|are|was|were|would|can|could|will) (?:it|they|that|this|those|these)\b/i;
function splitAskBody(sentence: string): string { return String(sentence || "").replace(LEAD_FILLER, "").replace(SPLIT_ORDINAL, "").replace(LEAD_FILLER, "").trim(); }
function splitSetsAsk(sentence: string): boolean {
  const bare = String(sentence || "").replace(LEAD_FILLER, "").trim();
  if (!bare || noiseOnly(bare) || SPLIT_AUDIO_CHECK.test(bare)) return false;
  const body = splitAskBody(sentence);
  return ASK_OPENER.test(body) || (/\?\s*$/.test(body) && SEPARATE_START.test(body)) || SPLIT_TAG.test(bare) || SPLIT_POLITE.test(body);
}
// "What is Zscaler? I would say Zscaler is a cloud proxy.": an ask, then four or more words of answer, nothing asked since.
function splitAnswerBetween(prevText: string): boolean {
  const ss = String(prevText || "").trim().split(/(?<=[.?!])\s+/).filter(Boolean);
  let last = -1;
  ss.forEach((s: string, i: number) => { if (splitSetsAsk(s)) last = i; });
  if (last < 0 || last >= ss.length - 1) return false;
  const after = ss.slice(last + 1);
  return after.every((s) => !/\?\s*$/.test(s) && !ASK_OPENER.test(splitAskBody(s))) && after.join(" ").split(/\s+/).length >= 4;
}
// v3 rules, checked before the v2 rules: true = new card, false = same card, null = let v2 decide.
function splitSeparateV3(next: string, prevText: string): boolean | null {
  const bare = String(next || "").replace(LEAD_FILLER, "").trim();
  if (!bare) return null;
  const body = splitAskBody(next);
  if (SPLIT_ORDINAL.test(bare) && !/^first(?:ly)?\b/i.test(bare) && (ASK_OPENER.test(body) || /\?\s*$/.test(body))) return true;
  if (SPLIT_AUDIO_CHECK.test(bare)) return false;
  const prevProper = new Set(properNouns(prevText));
  const prevTopic = new Set(topicWords(prevText));
  // "And what about SailPoint, have you used it?" names a new subject and asks its own question.
  const named = bare.match(/^what about\s+([\w+#.-]+(?:\s+[\w+#.-]+){0,2}),\s*(?:have|do|did|can|could|would|are|were|is|was) you\b/i);
  if (named && named[1].toLowerCase().split(/\s+/).some((w) => w.length >= 3 && !prevTopic.has(w) && !prevProper.has(w))) return true;
  if (SPLIT_CONTEXT_FOLLOW.test(bare)) return false;
  const fresh = properNouns(bare).some((n) => !prevProper.has(n));
  const prevWords = new Set(topicWords(prevText));
  const freshWords = topicWords(bare).filter((w) => !prevWords.has(w));
  const politeNoise = new Set("love like hear know learn understand curious interested keen also".split(" "));
  if (SPLIT_POLITE.test(bare) && (fresh || (freshWords.some((w) => !politeNoise.has(w)) && !/\b(?:that|this|it|those|these|more)\b/i.test(bare)))) return true;
  if (/\?\s*$/.test(bare) && /^(?:what|why|how|when|where|which|who)\b/i.test(bare) && freshWords.length > 0 && !/\b(?:that|this|it|those|these|the same)\b/i.test(bare) && splitAnswerBetween(prevText)) return true;
  return null;
}
// Cross-turn repeat (slice 3): "Sorry, what is CyberArk?", "..., again?", "... please.", "Can you tell me how Kerberos
// works?". Filler is dropped and plurals are folded, and both questions must hold exactly the same words, so a question
// with one new word is never hidden.
const REPEAT_FILLER = new Set("sorry again please said repeat let tell me can could you just once more question asked asking ask".split(" "));
function repeatsPriorQuestionV3(text: string, previous: string): boolean {
  const stop = new Set("the a an and or of to in on for with you your yours we our it its is are was were do does did have has had can could would should will just like really very this that those these what how why when where which who about from into".split(" "));
  const bag = (s: string) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim().split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w) && !REPEAT_FILLER.has(w)).map((w) => w.length > 4 ? w.replace(/([^s])s$/, "$1") : w));
  const a = bag(text), b = bag(previous);
  if (!a.size || a.size !== b.size) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
}
/** A later sentence is its own interview question, not the next part of the one already started. */
function separateQuestion(next: string, prevText: string, v3 = false, v4 = false): boolean {
  if (v4) { const r = splitSeparateV4(next, prevText); if (r !== null) return r }
  if (v3) { const r = splitSeparateV3(next, prevText); if (r !== null) return r }
  const bare = next.replace(LEAD_FILLER, "").trim()
  if (!bare || shortFollowUp(bare) || CONTINUES_ASK.test(bare)) return false
  // "Go deeper" stays with the question it follows. "Go deeper on that exception" is the next question.
  if (/^(?:(?:and|so|ok(?:ay)?|right|well|then|now)[, ]+)*(?:go deeper|dig deeper|elaborate|explain that|explain this|explain it|walk me through|explain (?:the|your|that|this)\s+(?:[\w+#.-]+\s+){1,4}(?:part|piece|bit|side|step)\b)\b/i.test(bare)) {
    const press = new Set("deeper dig elaborate explain walk through that this part piece side step more".split(" "))
    const fresh = topicWords(bare).filter((w) => !press.has(w) && !topicWords(prevText).includes(w))
    if (fresh.length > 0) return true
  }
  // "Tell me about yourself. What questions do you have?" is two asks. A design followed by an explanation stays one.
  const prevBare = ((prevText.trim().split(/(?<=[.?!])\s+/).pop() || prevText).replace(LEAD_FILLER, "")).replace(/[.?!]+$/, "").trim()
  if (/^(?:tell me about yourself|introduce yourself|walk (?:me|us) through your (?:career|background))\b/i.test(prevBare)
      && /^(?:what questions (?:do|would|might|can) you have|any questions(?: for (?:us|me|the team))?|do you have any questions)\b/i.test(bare.replace(/[.?!]+$/, ""))) return true
  const prevSentence = (prevText.trim().split(/(?<=[.?!])\s+/).pop() || prevText).trim()
  // "Tell me about yourself. Why do you want this job?" An opening ask about you is answered on its own, so a
  // question-word question that follows it with its own "?" is the next card, even when it says "this job".
  if (INTRO_ASK.test(prevSentence.replace(LEAD_FILLER, "")) && /^(?:what|why|how|when|where|which|who)\b/i.test(bare) && (/\?\s*$/.test(bare) || !/[.?!]\s*$/.test(prevSentence))) return true
  if (/\b(?:that|this|it|those|these|the same)\b/i.test(bare) && properNouns(bare).length === 0) return false
  if (!SEPARATE_START.test(bare)) return false
  const prevProper = new Set(properNouns(prevText))
  const nextProper = properNouns(bare)
  const parallel = /^(?:how|what) (?:do|did|would|could) you\b/i
  if (parallel.test(bare) && parallel.test(prevSentence.replace(LEAD_FILLER, ""))) {
    return nextProper.some((n) => !prevProper.has(n))
  }
  if (nextProper.some((n) => !prevProper.has(n))) return true
  const a = whatIsHead(prevSentence)
  const b = whatIsHead(bare)
  if (a && b && a !== b) return true
  const fresh = topicWords(bare).filter((w) => !topicWords(prevText).includes(w))
  if (/^(?:have you|do you|did you|can you|could you|would you|tell me|walk me|describe)\b/i.test(bare) && fresh.length > 0) return true
  // A piece cut mid-sentence by midSentenceAsks has no "?" of its own; it was already a finished ask.
  const prevEnded = /\?\s*$/.test(prevSentence) || (/^(?:tell me about|walk me through)\b/i.test(prevSentence.replace(LEAD_FILLER, "")) && /\.\s*$/.test(prevSentence) && /\?\s*$/.test(bare)) || (!/[.?!]\s*$/.test(prevSentence) && SEPARATE_START.test(prevSentence.replace(LEAD_FILLER, "")))
  return prevEnded && /^(?:what|why|how|when|where|which|who)\b/i.test(bare) && fresh.length > 0
}

// Speech-to-text often drops every full stop: "what is cyberark what is okta". A new question can start in the
// middle of a sentence only at a strong opener ("what is", "how do", "tell me about"), never after a word that
// keeps the clause going ("and why", "handle what happens", "a time when"), and only after a finished ask of three
// words or more. The pieces are rejoined unless separateQuestion says the next one is a new question.
const INTRO_ASK = /^(?:tell me (?:a (?:little |bit )?(?:bit )?)?about yourself|introduce yourself|(?:walk|take) me through (?:your )?(?:resume|background|career|cv)|tell me about your (?:background|career))\b/i

const MID_ASK = /\b(?:(?:go|dig) deeper on\b|explain the (?:[\w+#.-]+\s+){1,4}part\b|(?:what|how|why|when|where|who|which)\s+(?:is|are|was|were|do|does|did|would|could|can|will|should|has|have)\b|what's\b|tell me about\b|walk me through\b|can you (?:tell|walk|explain|describe)\b|could you (?:tell|walk|explain|describe)\b)/gi
const MID_KEEPS = /\b(?:and|or|but|so|nor|then|me|us|them|him|her|know|knows|explain|describe|tell|ask|asked|asking|understand|see|show|about|on|of|in|for|to|than|that|is|are|was|were|wonder|sure|decide|decided|mean|matters|handle|exactly|just|like|into|from|with|by|at|as|if|whether|because|a|an|the|time|moment|day|case|cases|place|reason|point)\s*$/i
const MID_OPEN_CLAUSE = /\b(?:if|whether|unless|(?:how|where|when|what) (?:you|we|they))\b/i   // "how you would migrate what is left": the clause is still open
function midSentenceAsks(sentence: string): string[] {
  if (/[.?!]\s*\S/.test(sentence)) return [sentence]
  const cuts: number[] = []
  MID_ASK.lastIndex = 0
  for (let m: RegExpExecArray | null; (m = MID_ASK.exec(sentence));) {
    if (m.index === 0) continue
    const left = sentence.slice(cuts.length ? cuts[cuts.length - 1] : 0, m.index).trim()
    const bareLeft = left.replace(LEAD_FILLER, "")
    if (bareLeft.split(/\s+/).length < 3 || !SEPARATE_START.test(bareLeft) || MID_KEEPS.test(left) || MID_OPEN_CLAUSE.test(bareLeft.replace(/^\S+\s+/, ""))) continue
    cuts.push(m.index)
  }
  if (!cuts.length) return [sentence]
  const out: string[] = []
  let from = 0
  for (const at of cuts) { out.push(sentence.slice(from, at).trim()); from = at }
  out.push(sentence.slice(from).trim())
  return out.filter(Boolean)
}

// Slice 4 (29 Oct 2026): punctuation-stripped runs ("what is pam okay what is iga um what is oidc") and "Explain the
// CyberArk CPM. Explain the PSM.". Every rule below only runs inside the v4 pass, and splitDistinctAsks returns the
// slice-3 cut whenever the v4 pass throws or would change a single heard word.
const SPLIT_MID_ASK4 = /\b(?:(?:go|dig) deeper on\b|explain the (?:[\w+#.-]+\s+){1,4}part\b|(?:what|how|why|when|where|who|which)\s+(?:is|are|was|were|do|does|did|would|could|can|will|should|has|have)\b|what's\b|tell me about\b|walk me through\b|(?:can|could) you (?:tell|walk|explain|describe)\b|(?:have|did) you (?:ever )?(?:used|use|worked|work|implemented|deployed|managed|led|built|configured|administered|run)\b|do you (?:have|use|know)\b|explain (?:the|your)\s)/gi
// Filler that sits between two asks: "okay", "um", "so", "and then (after that)", "next". "and" alone is not one,
// so "tell me about zscaler and why did you choose it" keeps its clause.
const SPLIT_BRIDGE_WORDS = "um+|uh+|so|okay|ok|alright|and then(?: after that)?|and (?:um+|uh+)|then|next|now|also|(?:and )?after that"
const SPLIT_BRIDGE_ORD = "second(?:ly)?|third(?:ly)?|fourth(?:ly)?|lastly|number (?:two|three|four|five)"
const SPLIT_BRIDGE_TAIL = new RegExp("(?:\\b(?:" + SPLIT_BRIDGE_WORDS + "|" + SPLIT_BRIDGE_ORD + ")\\s+)+$", "i")
const SPLIT_BRIDGE_LEAD = new RegExp("^(?:(?:" + SPLIT_BRIDGE_WORDS + ")[,]?\\s+)+", "i")
// A piece may start where a strong opener follows a finished ask of three words or more, with the filler before the
// opener moved onto the new piece. The pieces are rejoined unless the separate rules say the next one is new.
function splitMidAsksV4(sentence: string): string[] {
  if (/[.?!]\s*\S/.test(sentence)) return [sentence]
  const cuts: number[] = []
  SPLIT_MID_ASK4.lastIndex = 0
  for (let m: RegExpExecArray | null; (m = SPLIT_MID_ASK4.exec(sentence));) {
    if (m.index === 0) continue
    const from = cuts.length ? cuts[cuts.length - 1] : 0
    const left = sentence.slice(from, m.index)
    const tail = left.match(SPLIT_BRIDGE_TAIL)
    const coreLen = tail ? left.length - tail[0].length : left.length
    const core = left.slice(0, coreLen).trim()
    const bareCore = core.replace(LEAD_FILLER, "").replace(SPLIT_ORDINAL, "").replace(LEAD_FILLER, "")
    // "explain the cyberark cpm explain the psm": an "explain the" piece only after a finished "explain the" piece.
    if (/^explain (?:the|your)\s$/i.test(m[0]) && !(/^explain (?:the|your)\s/i.test(bareCore) && bareCore.split(/\s+/).length >= 3 && !MID_KEEPS.test(core))) continue
    if (/^explain (?:the|your)\s$/i.test(m[0])) { if (from + coreLen > from) cuts.push(from + coreLen); continue }
    if (!bareCore || /,\s*$/.test(core) || bareCore.split(/\s+/).length < 3 || !SEPARATE_START.test(bareCore) || MID_KEEPS.test(core) || MID_OPEN_CLAUSE.test(bareCore.replace(/^\S+\s+/, ""))) continue
    if (from + coreLen > from) cuts.push(from + coreLen)
  }
  if (!cuts.length) return [sentence]
  const out: string[] = []
  let from = 0
  for (const at of cuts) { out.push(sentence.slice(from, at).trim()); from = at }
  out.push(sentence.slice(from).trim())
  return out.filter(Boolean)
}
// true = new card, false = same card, null = let the slice-3 rules decide.
function splitSeparateV4(next: string, prevText: string): boolean | null {
  const raw = String(next || "").trim()
  // "and then after that what is okta", "um have you used saviynt": judge the ask without the bridge filler.
  const stripped = raw.replace(SPLIT_BRIDGE_LEAD, "").replace(/^,\s*/, "").trim()
  // "um second how does it rotate passwords": a numbered ask after the bridge is the next card (as in slice 3).
  const ord = stripped.match(SPLIT_ORDINAL)
  if (ord && stripped !== raw && !/^first(?:ly)?\b/i.test(stripped) && ASK_OPENER.test(stripped.slice(ord[0].length).replace(LEAD_FILLER, ""))) return true
  if (stripped && stripped !== raw && stripped.split(/\s+/).length >= 3 && /^(?:what|why|how|when|where|which|who|have you|did you|do you|can you|could you|tell me|walk me)\b/i.test(stripped)) return separateQuestion(stripped, prevText, true)
  // "Explain the CyberArk CPM. Explain the PSM.": an "explain the X" after a finished explain or question sentence,
  // where X is all new words, is the next card. "Explain that part", "Explain the trust part" stay.
  const prevSentence = (String(prevText || "").trim().split(/(?<=[.?!])\s+/).pop() || "").trim()
  const ex = raw.replace(LEAD_FILLER, "").match(/^explain (?:the|your)\s+([\w+#.-]+(?:\s+[\w+#.-]+){0,3})\s*[.?!]?$/i)
  if (ex && (/[.?!]\s*$/.test(prevSentence) || /^explain (?:the|your)\s/i.test(prevSentence.replace(LEAD_FILLER, ""))) && /^(?:explain|describe|what|how|why|tell me|walk me)\b/i.test(prevSentence.replace(LEAD_FILLER, "")) && !/\b(?:that|this|it|those|these|same|part|piece|bit|side|step|more|further|again)\b/i.test(ex[1])) {
    const prevW = new Set(String(prevText || "").toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean))
    const obj = ex[1].toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3 && !/^(?:and|the|how|why|your)$/.test(w))
    if (obj.length && obj.every((w) => !prevW.has(w))) return true
  }
  return null
}

function spokenWords(text: string): string {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#']+/g, " ").trim()
}

function looksLikeAsk(sentence: string): boolean {
  const bare = sentence.replace(LEAD_FILLER, "").trim()
  if (!bare || noiseOnly(bare)) return false
  return ASK_OPENER.test(bare) || (/\?\s*$/.test(bare) && SEPARATE_START.test(bare))
}

/**
 * Distinct interview questions inside one heard stretch. A multi-part ask
 * ("Design X. Explain the trust boundaries.") stays one question. "What is
 * Kubernetes? What is Terraform?" does not.
 */
function splitDistinctAsksBy(text: string, midCut: boolean, v3 = false, v4 = false): string[] {
  const clean = repairDictation(String(text || "")).replace(/\s+/g, " ").trim()
  if (!clean) return []
  const said = clean.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
  const sentences = midCut ? said.flatMap(v4 ? splitMidAsksV4 : midSentenceAsks) : said
  const groups: string[][] = [[]]
  let asked = false
  for (const sentence of sentences) {
    const bare = sentence.replace(LEAD_FILLER, "").trim()
    if (!bare || noiseOnly(bare) || noiseOnly(sentence)) continue
    const prev = groups[groups.length - 1].join(" ")
    if (asked && separateQuestion(sentence, prev, v3, v4)) {
      groups.push([sentence])
      asked = true
      continue
    }
    groups[groups.length - 1].push(sentence)
    if (v3 ? splitSetsAsk(sentence) : looksLikeAsk(sentence)) asked = true
  }
  return groups.map((g) => g.join(" ").replace(/\s+/g, " ").trim()).filter(Boolean)
}

// Slice 5b (29 Oct 2026), from the blind dossier bank. A pass over the slice-4 cards that only regroups whole
// pieces: on a fault or any changed word the slice-4 cut stands.
//  - "what dashboards or data tools || have you used": a what/which piece with no verb is finished by the next one.
//  - "how do you speak about controls to people || who do not have a security background": "who" right after a
//    word for people, with no filler between, is that clause. "where do guardrails belong who can modify" still cuts.
//  - Two finished "?" asks, each 7 words or more, that share no topic word and do not point back, are two cards.
//    "How do you assess the business impact? How do you understand root cause?" (6 words) stays one card.
const SPLIT5_STOP = new Set("what how why when where which who whom whose you your yours the and for with that this from have does did would could should into about there their them they been being were was are is can will what's tell walk give describe explain me us our ever just really also more most some any many much very".split(" "));
const SPLIT5_VERB = /\b(?:is|are|was|were|do|does|did|have|has|had|would|could|should|can|will|make|makes|look|looks|use|used|prevent|prevented|show|shows)\b/i;
const SPLIT5_OPEN = /^(?:what|how|why|when|where|which|who|is there|are there|are you|were you|was there|is it|do you|did you|have you|has your|can you|could you|would you|tell me|walk me|describe)\b/i;
const SPLIT5_BACK = /\b(?:it|its|that|this|they|them|their|those|these|the same|such)\b/i;
function split5Words(s: string): string[] { return String(s || "").toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 4 && !SPLIT5_STOP.has(w)).map((w) => w.length > 4 ? w.replace(/([^s])s$/, "$1") : w); }
function split5Lead(s: string): string { return String(s || "").replace(/^(?:(?:um+|uh+|so|okay|ok|and|then|next|now|also|alright)[,]?\s+)+/i, "").trim(); }
function split5Pair(a: string, b: string): boolean {
  const x = split5Lead(a), y = split5Lead(b);
  if (!/\?\s*$/.test(x) || !/\?\s*$/.test(y)) return false;
  if (!SPLIT5_OPEN.test(x) || !SPLIT5_OPEN.test(y)) return false;
  if (x.split(/\s+/).length < 7 || y.split(/\s+/).length < 7) return false;
  if (SPLIT5_BACK.test(y)) return false;
  const left = new Set(split5Words(x));
  return split5Words(y).every((w) => !left.has(w));
}
function splitCardsV5(cards: string[]): string[] {
  const merged: string[] = [];
  for (const card of cards) {
    const prev = merged.length ? merged[merged.length - 1] : "";
    const bare = split5Lead(card);
    const prevBare = split5Lead(prev);
    const fragment = prev && !/[.?!]\s*$/.test(prev) && /^(?:what|which|how many|how much)\s/i.test(prevBare) && prevBare.split(/\s+/).length <= 6 && !SPLIT5_VERB.test(prevBare.replace(/^\S+\s+/, ""))
      && /^(?:have|did|do|would|could|can|will) you\b/i.test(bare);
    const clause = prev && !/[.?!]\s*$/.test(prev) && /^who\s/i.test(card) && /\b(?:people|someone|anyone|everyone|those|users|staff|person|persons|stakeholders|engineers|owners|managers|leaders|executives|employees|members|colleagues|peers|clients|customers|vendors)\s*$/i.test(prev);
    if (fragment || clause) merged[merged.length - 1] = prev + " " + card;
    else merged.push(card);
  }
  const out: string[] = [];
  for (const card of merged) {
    const ss = card.split(/(?<=[?])\s+/).filter(Boolean);
    let cur = ss[0] || "";
    for (let i = 1; i < ss.length; i++) {
      if (split5Pair(ss[i - 1], ss[i])) { out.push(cur.trim()); cur = ss[i]; } else cur += " " + ss[i];
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
// Slice 6 (30 Oct 2026): spoken filler at a question's start or end ("Um so what…", "…, right?", "you know,",
// "What what…", "How do you, sorry, what…") hid the question opener. The cut is run again on a detection copy with
// that filler left out. The shown and saved text is never changed: cards are cut from the original words, only at
// a "?" "." or "!" the speaker's text already has, and only when every sentence-end cut of slice 5 is kept.
// Any fault, lost word or doubt returns the slice-5 cut.
const FILL6_LEAD = /^(?:um+|uh+|so|okay|ok|alright|like|yeah|well|and)$/i
const FILL6_OPEN = /^(?:what|why|how|when|where|which|who|whose|can|could|would|will|do|does|did|is|are|was|were|have|has|tell|walk|describe|explain|give|should)$/i
const fill6Bare = (t: string) => String(t).replace(/^[^\w']+|[^\w']+$/g, "").toLowerCase()
const fill6Norm = (t: string) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "")
const fill6End = (t: string) => /[.?!]["')\]]*$/.test(t)
function fill6Detect(tokens: string[]) {
  const det: (string | null)[] = tokens.slice()
  const sentOf: number[] = [], touched = new Set<number>()
  const falseStart: number[] = []
  let sent = 0
  for (let i = 0; i < tokens.length; i++) { sentOf.push(sent); if (fill6End(tokens[i])) sent++; }
  const drop = (i: number) => { det[i] = null; touched.add(sentOf[i]); }
  for (let s = 0; s < tokens.length; s++) {
    if (s > 0 && !fill6End(tokens[s - 1])) continue
    let i = s
    // a false start: "How do you, sorry, what…" / "What was, um, how…"
    for (let k = 1; k <= 3 && i + k + 1 < tokens.length; k++) {
      const end = tokens[i + k - 1], f = tokens[i + k]
      if (fill6End(end)) break
      if (/,$/.test(end) && /^(?:sorry|um+|uh+|i mean),$/i.test(f) && FILL6_OPEN.test(fill6Bare(tokens[i + k + 1])) && FILL6_OPEN.test(fill6Bare(tokens[i]))) {
        for (let j = i; j <= i + k; j++) drop(j)
        falseStart.push(i + k + 1)
        i += k + 1; break
      }
    }
    // leading filler run: "Um so", "Okay, um,", "Yeah and", "Like" — only before an opener; a lone "and" stays
    let j = i
    while (j < tokens.length && !fill6End(tokens[j]) && FILL6_LEAD.test(fill6Bare(tokens[j]))) j++
    if (j > i && j < tokens.length && FILL6_OPEN.test(fill6Bare(tokens[j])) && !(j - i === 1 && fill6Bare(tokens[i]) === "and")) {
      for (let x = i; x < j; x++) drop(x)
      i = j
    }
    // "What what is…": a doubled opener
    if (i + 1 < tokens.length && FILL6_OPEN.test(fill6Bare(tokens[i])) && fill6Bare(tokens[i]) === fill6Bare(tokens[i + 1]) && !/[,.?!]$/.test(tokens[i])) drop(i)
  }
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (det[i] === null || det[i + 1] === null) continue
    if (fill6Bare(tokens[i]) === "you" && /^know,$/i.test(tokens[i + 1]) && i + 2 < tokens.length && !fill6End(tokens[i + 1])) { drop(i); drop(i + 1); }
  }
  for (let i = 1; i < tokens.length; i++) {
    if (/^right\?$/i.test(tokens[i]) && det[i - 1] !== null && /,$/.test(tokens[i - 1])) { drop(i); det[i - 1] = tokens[i - 1].replace(/,$/, "?"); }
  }
  for (let i = 0; i < det.length; i++) {
    if (det[i] === null) continue
    let p = i - 1; while (p >= 0 && det[p] === null) p--
    const prev = p < 0 ? null : det[p]
    const cur = det[i]
    if (cur == null) continue
    if ((prev == null || fill6End(prev)) && (i === 0 || det[i - 1] === null)) det[i] = cur.charAt(0).toUpperCase() + cur.slice(1)
  }
  return { det, sentOf, touched, falseStart }
}
// Maps cards back onto token indices; null if any card is not a whole run of the given tokens.
function fill6Bounds(cards: string[], toks: string[]): number[] | null {
  const bounds: number[] = []; let at = 0
  for (const c of cards) {
    const n = String(c).trim().split(/\s+/).filter(Boolean).length
    const want = fill6Norm(String(c)), have = toks.slice(at, at + n).map(fill6Norm).join("")
    if (!n || want !== have) return null
    at += n; bounds.push(at)
  }
  return at === toks.length ? bounds.slice(0, -1) : null
}
function splitCardsFiller6(text: string, cut5: string[], cutAgain: (t: string) => string[]): string[] {
  try {
    const tokens = String(text).trim().split(/\s+/).filter(Boolean)
    if (tokens.length < 4) return cut5
    const { det, falseStart } = fill6Detect(tokens)
    if (det.every((t, i) => t === tokens[i])) return cut5
    const keptIdx: number[] = [], detToks: string[] = []
    det.forEach((t, i) => { if (t !== null) { keptIdx.push(i); detToks.push(t); } })
    const b6det = fill6Bounds(cutAgain(detToks.join(" ")), detToks)
    const b5 = fill6Bounds(cut5, tokens)
    if (!b6det || !b5) return cut5
    const b6: number[] = []
    for (const b of b6det) {
      const o1 = keptIdx[b - 1], o2 = keptIdx[b]
      let cut = -1
      for (let p = o2 - 1; p >= o1; p--) if (fill6End(tokens[p])) { cut = p + 1; break; }
      if (cut < 0) return cut5
      b6.push(cut)
    }
    for (const b of b5) {
      if (b6.includes(b)) continue
      // a slice-5 cut may only be dropped when it sits just after a false start ("What was, um, what methods || do you…")
      if (fill6End(tokens[b - 1]) || !falseStart.some((f) => b > f && b - f <= 6)) return cut5
    }
    if (b6.length === b5.length && b6.every((b, k) => b === b5[k])) return cut5
    const out: string[] = []; let from = 0
    for (const b of [...b6, tokens.length]) { out.push(tokens.slice(from, b).join(" ")); from = b; }
    return fill6Norm(out.join(" ")) === fill6Norm(tokens.join(" ")) ? out : cut5
  } catch { return cut5; }
}
export function splitDistinctAsks(text: string): string[] {
  const cut5 = splitDistinctAsksV5(text)
  return splitCardsFiller6(text, cut5, splitDistinctAsksV5)   // slice 6: never worse than slice 5 (falls back on doubt)
}

function splitDistinctAsksV5(text: string): string[] {
  const cut4 = splitDistinctAsksV4(text)
  try {
    // Slice 5b failsafe: the v5 pass may only regroup whole pieces; on any change or fault, the slice-4 cut stands.
    const cut5 = splitCardsV5(cut4)
    return spokenWords(cut5.join(" ")) === spokenWords(cut4.join(" ")) ? cut5 : cut4
  } catch {
    return cut4
  }
}

function splitDistinctAsksV4(text: string): string[] {
  const v3 = splitDistinctAsksV3(text)
  try {
    // Slice 4 failsafe: the v4 rules may only regroup words; on any change or fault, the slice-3 cut stands.
    const cut4 = splitDistinctAsksBy(text, true, true, true)
    return spokenWords(cut4.join(" ")) === spokenWords(v3.join(" ")) ? cut4 : v3
  } catch {
    return v3
  }
}

function splitDistinctAsksV3(text: string): string[] {
  const before = splitDistinctAsksBy(text, false)
  let v2 = before
  try {
    const after = splitDistinctAsksBy(text, true)
    // Failsafe: the cut never drops or reorders a word; if it would, keep the earlier cut.
    v2 = spokenWords(after.join(" ")) === spokenWords(before.join(" ")) ? after : before
  } catch {
    return before
  }
  try {
    // Slice 3 failsafe: the v3 rules may only regroup words; on any change or fault, the v2 cut stands.
    const v3 = splitDistinctAsksBy(text, true, true)
    return spokenWords(v3.join(" ")) === spokenWords(v2.join(" ")) ? v3 : v2
  } catch {
    return v2
  }
}

/** Every question in one heard stretch, each cut the way a single ask is cut. */
export function answerableQuestions(heard: string, history: unknown): string[] {
  const body = String(heard || "").replace(/^(?:You|Them):\s*/gim, " ").replace(/\s+/g, " ").trim()
  const spans = splitDistinctAsks(body)
  let turns = (Array.isArray(history) ? history : []).filter((t) => t && typeof t === "object") as Array<Record<string, unknown>>
  const out: string[] = []
  for (const span of spans) {
    const q = latestInterviewerAsk(questionForAnswer(span, "", false, false, turns))
    if (!q) continue
    out.push(q)
    turns = [...turns, { q, a: "" }]
  }
  return out
}

function spokenKey(text: string): string {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/** The line the answer prompt adds when this ask is not the previous one. */
export function differentQuestionLine(question: string, history: unknown): string {
  if (/following up on/i.test(question) || shortFollowUp(question) || interviewIntent(question) === "follow-up") return ""
  const turns = (Array.isArray(history) ? history : []).filter((t) => t && typeof t === "object") as Array<Record<string, unknown>>
  const last = turns[turns.length - 1]
  if (!last) return ""
  const prev = spokenKey(String(last.q ?? last.question ?? ""))
  const next = spokenKey(question)
  if (!prev || !next || prev === next) return ""
  return "DIFFERENT QUESTION: this ask is not the previous one. Do not reuse the previous answer, its opening, or its example."
}

// ---- Per-tier answer rules (perfACT TIER_RULES, pivoted to MarketFit's delivery) ----

export const INTRO_FOCUS: Record<string, string> = {
  hr: "your supported career progression, present responsibilities, collaboration and working approach — warm, calm and friendly",
  technical_hr: "your role, core stack and scope stated with confidence, the environments you've worked in, and how your responsibilities developed — friendly and technically fluent",
  developer: "what you build and maintain, the languages, APIs and pipelines you actually use, and how you work with engineering teams",
  engineer: "your hands-on specialty, the systems you run end to end, your supported responsibilities and how you work with application, infrastructure and security teams",
  architect: "your supported contribution to system design, how you reason about relevant trade-offs and failure domains, and the people affected by the design",
  analyst: "the investigations and evidence you work from, what you measure and report, and one finding that changed a decision",
  peer: "whatever this interviewer's own framing leads with — technical, people or business — in their register: what your work actually is, what you're good at, how you like to work",
  lead: "the work you lead and the people you support, how you prioritise and unblock, and your leadership presence — calm and authoritative, titles only as the resume states",
  supervisor: "where you take projects and why, how you coordinate people, process and design, and your follow-through",
  director: "the business risk you reduce, the outcomes you own, the decisions you've made and their payoff, and how you carry decisions through delivery — confident and relaxed",
}

export const INTENT_BOUNDARY = `INTENT FIRST: Before choosing a story, name the exact request internally: personal career overview, single project/experience, definition, implementation, design, or follow-up. A broad introduction covers the person's supported career breadth; it is never a single-tool case study. A question about one project stays on that project; a definition stays on the definition; a follow-up continues the same subject and answers only the new ask. Never pull an example merely because it is available, salient in cached context, or shares keywords with the JD. Every sentence must serve the original question and move the same thought forward. A new tool or employer requires an explicit relationship to the requested scope. If there is no evidence, state the limit rather than fill it with a polished but invented story.`

export const INTRO_CAREER_SPINE = `CAREER-WIDE INTRODUCTION CONTRACT: The answer's subject is the PERSON across the resume, not a favourite project, vendor or an invented success metric. Give a clear current professional identity and total experience only if supported by dates or an explicit source. Connect the distinct supported career stages and broad specialities in a coherent progression, moving from the earlier work toward current responsibilities. Preserve relevant clients/employers, their roles and differences without inventing chronology. Each tool, client and achievement belongs to the role it is listed under; never move one to another employer. Say employer names exactly as the resume writes them and never expand an abbreviation in a name (measured 26 Oct 2026: "City of San Diego (DOE)" became an invented "Department of Education"). Make one or two well-chosen examples prove abilities, but no single example dominates or becomes a deep implementation walkthrough. No isolated CodeQL, CyberArk, SIEM or other tool excursion unless the question specifically narrows to it. Explain why each experience follows the previous one, and make natural human transitions rather than [beat], [breath], (pause), stock catchphrases or sudden topic changes. Do not announce job-description fit. If only one career stage is documented, describe only that stage; do not manufacture breadth. If asked for a brief introduction, compress the same truthful career arc instead of changing its subject. When the resume states the total years of experience, say that total in the opening sentence with the current identity, so the listener hears the whole career first (owner, 27 Oct 2026: an introduction is the entire years of experience summed up).`

export const INTRODUCTION_POLICY = `PERSONAL INTRODUCTION: present the person through their supported career, in first person, with direct statements of work and ownership. Open with the current professional identity and scope. Connect the major career stages in the resume, explaining how responsibilities developed, then describe the current work from design or investigation through implementation, collaboration, delivery and ongoing operation, where the resume supports those stages. Show agency through accurate verbs such as I design, I maintain, I investigate, I automate and I work with. Do not inflate ownership from contributed to led. Use technologies inside actions, never as a detached skills catalogue. Include earlier work that explains the person's breadth, not only the work resembling the JD. Make the introduction memorable through named clients or employers, signature projects, documented achievements, and the impact of the work. Preserve each relationship accurately: a client is a client and an employer is an employer; never relabel one as the other. For the strongest supported projects, connect the client or business context, the candidate's own actions and decisions, and the documented result or impact. Prefer evidence of accomplishment over a list of duties, but when the resume supplies only responsibilities, state those plainly rather than inventing an achievement, project name, incident or result. Use figures only when the original source supports them. Be a little bold and humble: state supported ownership and accomplishments confidently, make the candidate's contribution specific, and acknowledge the team's role where the source does. Let the work demonstrate ability instead of calling the person exceptional, a visionary, or a perfect fit. End on the person's present responsibilities, a supported achievement, or working approach. Never close with a job application pitch, enthusiasm for this opening, or claims of alignment, matching the JD, being a perfect fit, or what the company is seeking. The JD may orient vocabulary, but the introduction is about the person. Allow a substantial connected introduction when the resume has the material; a short technical question budget or 75 word rule must not cut it down. Do not invent incidents, metrics, motivations, a personal origin story or transitions the resume does not establish. Do not volunteer education unless the question asks for it. Include certifications only when they help explain the work; never recite a list. An explicit request for a brief introduction still takes precedence.`

export const PERSONAL_EXPERIENCE_POLICY = `PERSONAL EVIDENCE OPPORTUNITY: an introduction or a question about the person's own work is a valuable opportunity to make a strong impression through evidence. Answer the exact personal question first, then select the strongest relevant example supported by the resume or original documents. Connect the named client or employer, the project or challenge, the candidate's own actions and decisions, and the documented achievement or impact. Show capability through specific work rather than praise, slogans or a JD fit pitch. Be confident about supported ownership and humble about team contributions. Keep clients and employers distinct. A narrow fact, yes or no, title or years question stays concise: give the fact first and at most one compact piece of proof, not the whole introduction again. A story question gets the project depth it needs. For a failure, conflict or weakness, state the difficult fact honestly and explain the supported response; never disguise failure as success or pivot to an unrelated achievement. No invented project, incident, result, client, metric or lesson. If the source lacks an example or outcome, say what the source supports. Use this opportunity when the interviewer asks about the person, not as an unsolicited career pitch inside a general technical answer.`

export const TECHNICAL_ANSWER_BOUNDARY = `TECHNICAL ANSWER BOUNDARY: explain the requested concept, mechanism, design or test directly. Do not insert an unsolicited career pitch, client list or personal achievement. Introductions and explicit questions about personal work are the place for personal evidence. A hypothetical stays hypothetical, even when the resume contains related technology.`

// Response craft — owner directive, 21 Oct 2026: the reference interview
// transcripts he supplied are the style bar ("these detailings are so good —
// repeat this way of communicating, and the balancing of depth and
// technicalities"). Distilled as delivery rules, in our own words: answers
// unfold in connected layers instead of landing as isolated facts.
export const RESPONSE_CRAFT_POLICY = `RESPONSE CRAFT (how the answer is built, on top of every other rule): Give the direct answer first, in one plain sentence. Then unfold it in the order the thing actually works, one layer at a time, and connect every layer to the previous one with plain linking words a person would say out loud — so, and then, however, unlike that, that means, from there. Never stack facts side by side with no thread between them.
For a concept: plain meaning first, then its parts in working order — what each part does, what it carries, where it hands off — then the contrast with the neighbouring concept the listener is most likely confusing it with, then what it means in practice.
For a comparison: hold both sides to the same axes — what it is, where it wins, where it costs, and what that costs you when you run it.
For an investigation or incident: start from the suspected source, then gather evidence from several independent places rather than one screen (the perimeter, the proxies, the cloud trail, the sign-ins, the endpoint), group what you find into clear buckets, say what the pattern means, give the immediate containment, and only then the long-term fix that stops it recurring. Immediate and long-term are never blurred together.
Balance of depth: technical specifics — the tool, the log source, the field, the port, the version — are named when they carry the point, and each one arrives with its plain meaning already established, never as raw jargon. Depth comes from the chain of reasoning being complete, not from the density of terms.
Close the answer: end on the implication, the result, or a one-line recap of the chain just walked. Never trail off mid-layer, never open a second topic at the end, and never repeat the opening sentence as the close.
Flow like a person talking, not a document being read: think forward out loud — first this, then that, from there this follows — so the listener can walk with you. Where real practice varies, say so plainly ("it depends on the setup") and then give what you actually do. Where your knowledge ends, mark the edge honestly in one breath ("beyond this there may be more; this is what I have seen") instead of bluffing past it or apologising for it. A brief self-correction mid-answer is human and fine; losing the thread is not.`

export function isPersonalEvidenceQuestion(tier: Tier, question: string): boolean {
  if (tier === 0 || tier === 1 || tier === 4) return true
  return tier === 3 && /\byour\b|\byou (?:did|personally|owned|led|built|handled|chose|choose|decided|learned|contributed|said|mentioned)\b|\btell me about a time\b/i.test(question)
}

export function tierRule(tier: Tier, interviewer: string): string {
  const focus = INTRO_FOCUS[interviewer] || INTRO_FOCUS.engineer
  switch (tier) {
    case 0:
      return `${INTRODUCTION_POLICY} Audience emphasis: ${focus}. Preserve the complete career narrative while adjusting the language to the listener.`
    case 1:
      return `EXPERIENCE — STAR. Situation: where it happened and what triggered it. Task: what was theirs to solve. Action (the heart of it): what they personally did, in order, including the bottleneck as a concrete image and how they got past it. Result: what changed, then one human takeaway. Use the real specifics in FACTS — employer, tools, platforms, systems, projects the background names. Where FACTS is silent on a detail, say it naturally at the level FACTS supports ("our EDR platform", "the ticketing queue") so every sentence is complete.`
    case 4:
      return `DIRECT QUESTION ABOUT THE CANDIDATE'S OWN EXPERIENCE (have you…, how many years…, which … have you…, your role there…). The FIRST sentence is the direct answer from FACTS — yes or no, the number, the list, or their title — past tense for what they did, present tense for their current role. Then back it with what they actually did, at the employer and in the years FACTS shows, in the past tense. NEVER answer with how they WOULD approach it and never switch to a hypothetical.`
    case 3:
      return `DRILL-DOWN. Continue from where the last answer stopped: the same project, environment and people, with one clause of callback — never retell the story. Answer only what this follow-up adds, one level deeper. "What did YOU do": the two or three decisions that were theirs, in "I", then the team's part in one sentence, by role. "How did you know" / "go deeper": what they checked, what they ruled out, the real cause. Every fact matches what was already said.`
    default:
      return `DESIGN / SCENARIO. Explain the requested mechanism or how they WOULD approach the scenario, present or conditional tense: relevant impact, evidence, cause, practical fix and how they test it. ${TECHNICAL_ANSWER_BOUNDARY} Never invent an incident, error message, reading, number or date.`
  }
}

// ---- Project rotation ledger (perfACT answer.js): anti-repetition ----
// Client-carried rotation state: the frontend sends its ledger with every
// answer request and stores the ledger the server returns, so turns in one
// session never retell the same story, bottleneck or angle. This is what kept
// perfACT from telling the same CodeQL story three times in thirty minutes.

export interface LedgerProject {
  id: string
  title: string
  terms: string
  bottlenecks: string[]
  employer?: string
}

export interface Ledger {
  story: Record<string, number>
  projects: Record<string, number>
  recent: string[]
  bottlenecks: string[]
  angles: string[]
  last_project: string | null
}

/** Normalize a client-carried ledger — null/foreign shapes become empty. */
export function normLedger(l: unknown): Ledger {
  const o = (l && typeof l === "object" ? l : {}) as Record<string, unknown>
  return {
    story: (o.story && typeof o.story === "object" ? o.story : {}) as Record<string, number>,
    projects: (o.projects && typeof o.projects === "object" ? o.projects : {}) as Record<string, number>,
    recent: Array.isArray(o.recent) ? (o.recent as unknown[]).map(String) : [],
    bottlenecks: Array.isArray(o.bottlenecks) ? (o.bottlenecks as unknown[]).map(String) : [],
    angles: Array.isArray(o.angles) ? (o.angles as unknown[]).map(String) : [],
    last_project: typeof o.last_project === "string" ? o.last_project : null,
  }
}

export const ANGLES: string[] = [
  "tooling and the evidence it produced", "ownership and accountability",
  "what failed on the first attempt", "a specific person and the disagreement",
  "testing and validation", "rollout and change management",
  "monitoring afterward", "the exception and its expiry",
  "user or business impact", "how it looked to audit",
  "what we stopped doing by hand", "the decision I would reverse today",
]

const ledgerWords = (s: string): string[] =>
  String(s || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []

/** Adapt MarketFit prep projects ({id,name,role,impact}) to ledger atoms. */
export function toLedgerProjects(prepProjects: unknown): LedgerProject[] {
  if (!Array.isArray(prepProjects)) return []
  const out: LedgerProject[] = []
  for (const raw of prepProjects) {
    const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const id = String(p.id ?? "").trim()
    if (!id) continue
    const name = String(p.name ?? p.title ?? "").trim()
    out.push({
      id,
      title: name || id,
      terms: String(p.terms ?? `${name} ${p.role ?? ""} ${p.impact ?? ""}`),
      bottlenecks: Array.isArray(p.bottlenecks) ? (p.bottlenecks as unknown[]).map(String).filter(Boolean) : [],
      employer: typeof p.employer === "string" ? p.employer : undefined,
    })
  }
  return out
}

function scoreProjects(q: string, projects: LedgerProject[]): Array<{ id: string; score: number }> {
  const qt = new Set(ledgerWords(q))
  return projects
    .map((p) => {
      const pt = new Set(ledgerWords(`${p.terms} ${p.title}`))
      let overlap = 0
      for (const t of qt) if (pt.has(t)) overlap++
      return { id: p.id, score: overlap }
    })
    .sort((a, b) => b.score - a.score)
}

/** Higher = less recently used (999 = never). */
function recency(ledger: Ledger, pid: string): number {
  const i = ledger.recent.lastIndexOf(pid)
  return i === -1 ? 999 : ledger.recent.length - i
}

/**
 * Route the question to a project: term overlap first, then least-recently-used.
 * Tier 1 (STAR) prefers a story never told before. Tier 3 (drill-down) holds the
 * previous project. A prepared answer's project wins as a hint — except a tier 1
 * never retells an already-told story.
 */
export function pickProject(
  q: string, tier: Tier, ledger: Ledger, projects: LedgerProject[], hint?: string | null,
): { id: string | null; reason: string } {
  if (!projects.length) return { id: null, reason: "no project atoms" }
  if (tier === 3 && ledger.last_project && projects.some(p => p.id === ledger.last_project)) return { id: ledger.last_project, reason: "drill-down: holding previous project" }
  if (hint && projects.some((p) => p.id === hint) && !(tier === 1 && ledger.story[hint]))
    return { id: hint, reason: "prepared answer's project" }
  const ranked = scoreProjects(q, projects)
  const top = ranked[0].score
  if (tier === 1) for (const r of ranked) {
    if (r.score === 0) break
    if (!ledger.story[r.id]) return { id: r.id, reason: "unused story" }
  }
  if (top > 0) {
    const near = ranked.filter((r) => r.score >= Math.max(top - 1, 1))
    near.sort((a, b) => recency(ledger, b.id) - recency(ledger, a.id))
    return { id: near[0].id, reason: "term overlap, least recently used" }
  }
  const least = projects
    .slice()
    .sort((a, b) => (ledger.story[a.id] || 0) - (ledger.story[b.id] || 0) || (ledger.projects[a.id] || 0) - (ledger.projects[b.id] || 0))[0]
  return { id: least.id, reason: "least-told story" }
}

/** Rotate concrete bottlenecks per project — never repeats until the pool is spent. */
export function pickBottleneck(project: LedgerProject | null, ledger: Ledger): string {
  const pool = (project && project.bottlenecks) || []
  for (const b of pool) if (!ledger.bottlenecks.includes(b)) return b
  return pool[0] || ""
}

/** 12 angles, never repeats until all 12 are used. */
export function pickAngle(ledger: Ledger): string {
  for (const a of ANGLES) if (!ledger.angles.includes(a)) return a
  return ledger.angles.find(a => ANGLES.includes(a)) || ANGLES[0]
}

export function recordAngle(ledger: Ledger, angle: string): void {
  if (!ANGLES.includes(angle)) return
  ledger.angles = ledger.angles.filter(a => a !== angle && ANGLES.includes(a))
  ledger.angles.push(angle)
}

/** Record what this turn used, so the next turn routes around it. */
export function commit(ledger: Ledger, pid: string | null, angle: string, bott: string, tier: Tier): void {
  recordAngle(ledger, angle)
  if (!pid) return
  ledger.projects[pid] = (ledger.projects[pid] || 0) + 1
  if (tier === 1) ledger.story[pid] = (ledger.story[pid] || 0) + 1
  if (tier === 1 || tier === 2 || tier === 4) {
    ledger.last_project = pid
    ledger.recent.push(pid)
    if (ledger.recent.length > 40) ledger.recent.shift()
  }
  if (bott && !ledger.bottlenecks.includes(bott)) ledger.bottlenecks.push(bott)
}

/** Best-matching prep question by word overlap (needs 2+) — its projectId is the routing hint. */
export function matchBank(
  q: string, questions: unknown,
): { q: string; projectId?: string } | null {
  if (!Array.isArray(questions) || !questions.length) return null
  const qt = new Set(ledgerWords(q))
  let best: { q: string; projectId?: string } | null = null
  let bestScore = 0
  for (const raw of questions) {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const iq = String(item.q ?? "")
    if (!iq) continue
    let ov = 0
    for (const t of new Set(ledgerWords(iq))) if (qt.has(t)) ov++
    if (ov > bestScore) {
      bestScore = ov
      best = { q: iq, projectId: typeof item.projectId === "string" ? item.projectId : undefined }
    }
  }
  return bestScore >= 2 ? best : null
}

export const DERIVE_SYSTEM = `You read a live interview transcript and pull out the interviewer's most recent question.

HEARD is everything said since the last answer, merged and messy: fillers, cross-talk, fragments cut at random points by the transcriber. Lines starting "Them:" are the interviewer(s) on call audio; lines starting "You:" are the candidate's own microphone — usually the candidate replying, which is context, NOT a question (but if there is no Them: line at all, the interviewer is being picked up by the candidate's mic, so treat the speech as theirs).

FIRST derive the ONE question to answer now: centre it on what the interviewer is asking at the END of HEARD, and fold in every earlier question in HEARD that has not been answered yet, plus any constraint or context they gave. Small talk, their description of the team or role, and the candidate's own replies are context, not questions.

A request with no question mark is still a question: "Pick one internal system", "Name the tool you would use", "Walk me through that". Small talk is not.
Return ONLY the question text, in the interviewer's own words, one or two sentences. Never add topics or angles they did not ask about. If nothing in HEARD is a question for the candidate, return exactly: NO_QUESTION`
export interface ShapeDef {
  type: string; re: RegExp; tier1: boolean; noYou: boolean; unknownProduct: boolean; shape: string
}

export const SHAPES: Record<string, ShapeDef[]> = {
  behavioural: [
    { type: "failure / mistake / missed deadline", re: /\b(fail(ed|ure)?(?!\s+(isolation|modes?)\b)|mistake|went wrong|bad (call|decision)|misjudg\w*|missed (a|the) deadline|didn'?t go (as|to) plan|regret)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one owns it: the decision that was yours and what it cost. A real miss, never a disguised win and never one that questions your core craft. One line of context. The cost said flatly, nobody blamed. Then half the answer: the real cause, the fix you drove, and the check you added so it could not repeat. Serious register; the last beat names who absorbed the cost." },
    { type: "disagreed with manager / disagree and commit", re: /\b(disagree(d|ment)?|didn'?t agree|push(ed)? back on|challenged (a|the|your|my) (decision|manager|lead|boss))\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the call you disagreed on and how it landed. Their reason, stated fairly. Your evidence and how you raised it, directly and with an alternative. The decision, then what you did to make it work whichever way it went; committing gets as much time as pushing back. Close on the outcome and how you worked together afterwards. Never \"I was right\", never a split-the-difference ending." },
    { type: "difficult person / team resisted a control", re: /\b(difficult|challenging|tough) (stakeholder|colleague|person|customer|client|team ?mate|coworker|manager|owner)s?\b|\bconflict with\b|\b(team|owner|business|developers?) (refused|pushed back|resisted|ignored)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the role you clashed with, over what, and how it ended. Their constraint and why it was reasonable. How you learned it, then the risk put in their terms. What you offered so they could keep working, and how the real fix landed. The working relationship afterwards, shown by what happened next rather than claimed." },
    { type: "influence without authority / convinced someone senior", re: /\b(convinc\w*|persuad\w*|buy-?in|without (formal )?authority|more senior than you|change (their|his|her) mind)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: who you had to move and what they decided in the end. Their objection in their own terms, and the condition they set. Meeting that condition became your work: the evidence you gathered, framed in their currency of cost, time, risk or audit. The changed decision and what it let the team do. Show the evidence; never say you convinced them." },
    { type: "critical feedback received", re: /\b(critical|negative|tough|constructive|hard) feedback\b|\bfeedback (you|that you) (got|received)\b|\bcritici[sz](ed|m)\b|\bcoached on\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the feedback in plain words and the role who gave it. Why it was right, in your own voice, with no defensiveness and no resentment. The specific change in how you worked after it. The later moment where that change mattered, at the level FACTS supports, and who it helped." },
    { type: "ethics / integrity", re: /\b(unethical|integrity|ethic(s|al)|policy violation|asked to (hide|bend|skip|downplay)|cut(ting)? corners)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: what you saw and what you did. How you raised it: the facts, the right channel (your manager, security leadership, HR or legal), no accusation. A proportionate outcome, then the control that changed so it could not happen again. Serious register. If FACTS holds no such moment, say how you handle it in the present tense and prove it with one real control from FACTS." },
    { type: "weakness", re: /\b(weakness(es)?|areas? (of|for) improvement|development areas?|where do you struggle|what would your (manager|boss) (change|say you need))\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Three beats, no landing. One real gap in plain words: a JD nice-to-have the resume does not show, or a working trait the persona file names, never the role's core requirement. Never a cliche or a strength in disguise. Where it shows in your work, without inventing an incident. What you are doing about it now, in the present tense, with no course, certification or date FACTS lacks." },
    { type: "strengths / why should we hire you", re: /\byour (greatest |biggest |key |main )?strengths?\b|\bwhy should we hire\b|\bwhy (are you|you'?re) the (right|best)\b|\bwhat (sets you apart|makes you (different|unique|a good fit))\b|\bwhat (do|would|will|can) you bring\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the strength as the job it does for this team, tied to the JD's hardest requirement. One or two real moments from FACTS, each with what changed and what others relied on you for. Then what that means for this role's early work. No adjective about yourself, no comparison with other candidates." },
    { type: "why us / why this role / why Amazon", re: /\bwhy (do you want to |would you like to )?(work (here|for us|with us|at)|join)\b|\bwhy (this|our) (company|role|team|position)\b|\bwhy (amazon|aws|us)\b|\bwhat (interests|attracts|excites|draws) you (to|about)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the reason, specific to this team's work as the JD describes it. The unfinished part of your own work that continues here, from FACTS. One hook only this company has: its customers, a product or a principle the JD names. Swap test: nothing may still be true with a competitor's name in it. No praise list, no pay, no word about wanting the job." },
    { type: "why are you leaving", re: /\bwhy (are you )?(leaving|looking|moving on|changing jobs|did you leave)\b|\breason for (leaving|the change|a change)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Two or three beats, no landing. The move as a step toward the work this role does, never away from anything. One line of credit to the current employer for what you built there. How this role continues it. Never criticise an employer, a manager or pay." },
    { type: "pressure / tight deadline / competing priorities", re: /\b(under pressure|tight deadline|competing priorities|multiple priorities|stressful|overwhelm\w*|juggl\w*)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the deadline and whether it held. What made it tight. What you cut, what you kept and why, including the risk you would not trade. Who you told early and what you asked for. The delivered result and what you changed so the next one was less tight. Show composure through the order of your moves; never claim it." },
    { type: "ambiguity / decision without full data", re: /\b(ambigu\w*|incomplete (data|information)|without (all|enough|complete) (the )?(data|information|facts)|quick decision|judg(e)?ment call|had to move fast)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the call and when you made it. What was unknown and what waiting would have cost. How you narrowed it: similar past work, the person you asked, the data you pulled. Whether it could be undone, and the guardrail in case you were wrong. How you checked it afterwards and what you adjusted. Speed as judgement; never cast security as the delay." },
    { type: "proudest / hardest / most complex work", re: /\b(proudest|biggest (achievement|accomplishment)|most (challenging|difficult|complex) (project|problem|thing|work|situation)|hardest (project|problem|thing|part))\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: the work and how it ended. Most of the answer is what made it hard: the dependent systems, the people, what failed first, and how you got past it. Then what is still running because of it and who uses it. Never say you are proud; let the obstacle carry it." },
    { type: "customer / above and beyond (priority 14, tier 1 only)", re: /\b(customers?|clients?|end users?|above and beyond|extra mile)\b/i, tier1: true, noYou: false, unknownProduct: false, shape: "Sentence one: who the customer was and what you did for them. In security work that is often the engineering team, the business owner or the people whose data it was. What they needed against the default. The choice beyond your remit and what it cost you short term. What you did, then their experience afterwards. Routine duties do not count." },
    { type: "improved a process / challenged the status quo (priority 15, tier 1 only)", re: /\b(status quo|improv(e|ed) (a|the) process|simplif\w*|better way|inefficien\w*|by hand|manual(ly)?|automat(e|ed|ing) (a|the))\b/i, tier1: true, noYou: false, unknownProduct: false, shape: "Sentence one: what you changed, and that the work still runs that way. The old way in operational terms: who did what by hand, and what it cost. How you spotted it and the option you rejected. The change, how you trialled it, who resisted and why. Before and after in words or FACTS figures, and who uses it now." },
  ],
  technical: [
    { type: "challenge / correction / why-not probe (priority 1, follow-ups only)", re: /\b(why (not|didn'?t you|did you (choose|pick|use|go with))|couldn'?t (you|they|we) (just|have)|how do you know|are you sure|that'?s not (what|right)|no,? (i mean|that'?s not)|what if (that|it) (fails|failed|was wrong))\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Never open with a defence. A corrected technical fact: accept it in one clause, rerun the reasoning, give the new conclusion, two sentences in all; your own employer, title and location stay as stated. A questioned choice: the data that drove it and the error it prevented, then when their option wins. \"Why not the simple way\": two or three concrete mechanisms, never a principle." },
    { type: "knowledge gap: tool not in FACTS", re: /\b(have you (ever )?(used|worked (with|on)|touched|deployed|configured)|are you familiar with|do you know|experience (with|in|on))\b/i, tier1: false, noYou: false, unknownProduct: true, shape: "One clause first: that product was not yours, and the one you ran for that job. Then the full answer anyway, in the present tense: how that tool does the job, mapped onto what you operated, the same log sources, policy model or failure you tuned out. No second disclaimer. Close on what carries over on day one." },
    { type: "business conflict: pushback, downtime, exception", re: /\b(refus\w*|push(es|ed)? back|won'?t (patch|allow|approve|accept)|too (expensive|slow|disruptive)|downtime|no budget|wants? an exception|bypass|skip (the )?(control|review|scan)|balance security (and|with) (usability|speed|the business)|business (says|wants|won'?t))\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one: you do not force it, and what you do instead. Confirm their constraint and whether it is a legal requirement or a preference. Put the risk in their terms. A compensating control now; the real fix in an agreed window with a pilot group and a rollback. Hand them a ready fix, then verify it yourself. Still blocked: an expiring risk acceptance signed by the business owner." },
    { type: "incident / alert scenario", re: /\b(what would you do|how would you (respond|investigate|triage|handle|contain)|a user reports|you (see|notice|get|receive)|suppose|what('?s| is) your first|walk me through (how you'?d|the response))\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one is your first move to prove it is real: the raw event, the process tree, the destination's reputation, a call to the user. Fork aloud: benign closes light; real widens scope first. Contain before root cause, preserving evidence. Eradicate, then recover from known-good. Close on the detection or control you change, and what containment alone did not fix." },
    { type: "false premise / is X secure / is this X", re: /\b(is (it|the incident|that|this) (over|done|enough|safe|secure)|isn'?t .{1,40} enough|why (do|would) (we|you) need .{1,40} if|so (it'?s|we'?re) (fine|safe|done)|can .{1,30} be (hacked|broken|trusted))\b|\bis .{1,30} (safe|secure|enough)\?|\bis (this|that|it) (a |an )?[\w-]+ (attack|incident|breach|false positive)\?/i, tier1: false, noYou: false, unknownProduct: false, shape: "The verdict in the first words, then the gap between the premise and reality. \"Is X secure\": the deciding conditions, the single point of failure, the control covering it. \"Why X if we have Y\": grant Y, then the job only X does. \"Is this X\": the baseline, the deviation, one corroborating signal, the verdict. Close on the risk the premise hid." },
    { type: "contrast: X vs Y", re: /\b(difference between|differs? from|vs\.?|versus|compared? (to|with)|which is better)\b|\bhow is .{1,40} different\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one names the axis that separates them: what each produces, where it inspects, whom it emulates, or whether it can be undone. Then each on that axis, in the order asked, with where it fits and, where FACTS shows it, where you ran it. \"Which is better\": pick one for their case first. Close on the condition that flips the choice." },
    { type: "competing hypotheses / rival explanations", re: /\b(hypothes[ei]s|competing (explanations|theories)|rival explanations)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Number each hypothesis in order: 1, 2, 3. Test each hypothesis by its number and rule it in or out before moving on — never refer to a hypothesis without its number, never write 'several' in place of a number. Once one hypothesis survives, contain on it and roll back to the audited state, then close on the guardrail that catches the next drift." },
    { type: "design / architecture trade-off", re: /\b(design|architect\w*|how would you (structure|secure|build|set up|segment)|trade-?offs?|at scale|high availability|fail (open|closed)|zero trust (model|architecture)|reference architecture)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one commits to the design and its driving assumption: the threat model, the data class or the scale. Sentence two names the one alternative you rejected and what it cost — this sentence is required, never skipped. Components in data-flow order, one line each. The failure mode, fail open or closed, and why. Start simple; add scale only where a stated constraint demands it. Close on how you prove it holds." },
    { type: "mechanism walk-through: how does X work", re: /\b(how does .{1,40} work|what happens (when|after|during)|walk (me )?through (how|what happens)|under the hood|step by step|explain the (handshake|flow|process|lifecycle))\b/i, tier1: false, noYou: true, unknownProduct: false, shape: "Follow one real request in the order it moves: each hop, the message, flag or field there, and what that step proves. Walk the first loop fully, then say it repeats and name the end condition. One level down: what a failure looks like in the logs or trace. Close on the security consequence of that mechanism." },
    { type: "definition / concept (priority 9, ahead of SIEM so \"What is a SIEM?\" gets a definition; tested)", re: /\byou(r)?\b/i, tier1: false, noYou: true, unknownProduct: false, shape: "Sentence one: what it is and its job in production, precise, no analogy. Then each part in standard order: what it guarantees, what breaks it, the control that delivers it. Where a common misreading exists, correct it and name the neighbour that really does that job. Close on where it stops protecting you." },
    { type: "SIEM / detection / tuning / hunting", re: /\b(siem|splunk|sentinel|qradar|elastic|kql|spl|edr|xdr|soar|correlation (rule|search)|use case|detection (rule|logic|engineering)|write a (rule|query)|log sources?|onboard\w*|tuning|tune (a|the|it)|false positives?|alert fatigue|retention|ingest\w*|threat hunt\w*)\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Answer from the platform FACTS holds. Follow the data: source, collection, parsing, index, query, alert, case. A detection gets its use case, proof the source arrives, and exact logic: match, count, window, grouping. Then one scoped exclusion and the check that no true positive was lost. Tuning is a scoped exception, never a blanket threshold raise. Close on the telemetry gap it closed." },
    { type: "manager / strategy: prioritise, executives, metrics", re: /\b(prioriti[sz]\w*|where would you start|first (30|60|90) days|roadmap|backlog|budget|justify|make the case|board|executives?|ciso|kpis?|metrics|measure (success|the program)|hundreds of (findings|alerts|vulnerabilities)|risk (register|appetite|acceptance))\b/i, tier1: false, noYou: false, unknownProduct: false, shape: "Sentence one is the call and the principle deciding it, such as exposure and business criticality first. Rank the top three, one reason each. Separate today's action from the mechanism that stops a repeat: an owner, a threshold alert, a leading indicator. For executives, give the actual line you would say. Security recommends; the business owner accepts the residual risk. Business words, no invented figure." },
  ],
};

const SHAPE_SKIP = new Set(["I", "Have", "Are", "Do", "What", "How", "Can", "Could", "Would", "Tell", "Why", "When", "Which"]);

/** Code check for the two structural requirements prompt wording keeps
 * dropping: the design shape's required alternative sentence, and the
 * director practice opening naming the decision owner. Returns what is
 * missing, so the route can repair it with one targeted rewrite instead of
 * another prompt tweak. A heuristic gate, not a verdict: an answer that
 * phrases the element unusually still counts as present when its marker
 * words appear. */
export function missingStructure(text: string, opts: { level: string; register: string; shape: string; tier: number }): string[] {
  const missing: string[] = []
  if (!text || !text.trim() || opts.tier === 0) return missing
  const plain = text.replace(/\[(?:beat|breath)\]|\(pause\)/gi, " ")
  if (/Sentence two names the one alternative/.test(opts.shape || "")) {
    if (!/\b(alternative|rejected|ruled out|ruled against|passed on|passed over|instead of|instead\b|rather than|did not choose|didn't choose|chose .* over|opted against|opted for .* over|went with .* over|set aside|decided against)\b/i.test(plain)) missing.push("a sentence naming the one alternative you rejected and what it cost")
  }
  // Numbered hypotheses are a shape requirement, not a prompt preference:
  // rounds 11-12 (Oct 29) both answered a competing-hypotheses question with
  // unnumbered prose even though pickShape returned the numbering shape, and
  // nothing in this check flagged it, so repair never ran for Q3.
  if (/Number each hypothesis in order/.test(opts.shape || "")) {
    const labels = plain.match(/hypothesis\s*[1-9]\d*/gi) || []
    const distinct = new Set(labels.map((l) => l.replace(/\D/g, "")))
    if (distinct.size < 2) missing.push("each competing hypothesis numbered in order (Hypothesis 1, Hypothesis 2, ...), with a test attached to each and back-references by number")
  }
  // A Director-level audience does not imply the interviewer asked who decides.
  // Never force an owner into a definition, comparison, or personal example.
  // (The explicit-owner case is handled by precision parts, not here: see the
  // pinned test 'Director owner is never automatically forced by structural
  // repair' — an owner is only repaired in when the question itself asks for
  // one, via questionParts, never from the level alone.)
  return missing
}

export const STRUCTURE_REPAIR_SYSTEM = `You repair one interview answer. Rewrite the SAME answer with minimal changes: keep every supported fact and relevant example that answers the question, unless a change is required by the missing element below. Do not change the answer's level or voice, and do not invent achieved numbers or results. If the answer is already at its word limit, make room by tightening wording or dropping a point the interviewer did not ask about, never by dropping the missing element. The missing element is part of what the interviewer asked for, so writing it completes the answer — it is not an invented claim, and it must not be left out to keep the answer unchanged. Add ONLY the missing element, in the place its instruction names. You MUST add the missing element even if that means adding a sentence: keeping the existing sentences does not mean leaving the answer unchanged. When a missing element names a label or a form, write it literally: a rejected alternative gets one sentence naming the alternative and what it cost; numbered hypotheses get literal 'Hypothesis 1:', 'Hypothesis 2:' labels, a test attached to each, and later references by number; a named framework or term gets named in the answer and tied to specific design elements with its control families or codes, not merely mentioned in passing.`

/** First-win archetype match. Returns the shape instruction or null. */
// One repair prompt, no contradictions: v1 said "Do not shorten it" while the tangent instruction said "delete that
// jargon" and the mode ceiling then trimmed the longer rewrite, so a landed repair could be cut back out (hitachi-grc
// Q2 and Q3, rounds 11 to 14). The ceiling is stated here so the rewrite fits it.
export function structureRepairSystem(maxWords: number, removeTangent: boolean): string {
  const limit = maxWords > 0 ? `\nStay within ${maxWords} words in total.` : ""
  const tangent = removeTangent
    ? "\nWhen the missing element says remove an unasked tangent, delete that jargon and its unrelated clause. Keep the one direct answer and every point the interviewer asked for; do not replace it with a different technical story."
    : ""
  return `${STRUCTURE_REPAIR_SYSTEM}${tangent}${limit}`
}

export function pickShape(question: string, tier: number, known = ""): string | null {
  const q = String(question || "");
  for (const mode of ["behavioural", "technical"]) {
    for (const s of SHAPES[mode] || []) {
      if (s.unknownProduct) {
        const toks = (q.match(/\b[A-Z][A-Za-z0-9.+-]{1,}\b/g) || []).slice(1).filter(t => !SHAPE_SKIP.has(t));
        if (!toks.some(t => !String(known).toLowerCase().includes(t.toLowerCase()))) continue;
      }
      if (s.tier1 && tier !== 1) continue;
      if (s.noYou && /\byou(r)?\b/i.test(q)) continue;
      if (s.re.test(q)) return s.shape;
    }
  }
  return null;
}
