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
  const words = String(text || "").split(/\s+/).filter(Boolean).length
  return finish === "length" && words < Math.max(25, Math.round(targetWords * 0.35))
}

const NOT_A_TERM =/^(?:next|continue|go on|go ahead|repeat|again|pause|stop|wait|done|skip|more|same|okay|ok|yes|no|thanks|thank you|hello|hi|hey)\b/i

/** One to four words with no verb and no question: a term, a tool or an abbreviation the interviewer named. */
export function isBareTerm(q: string): boolean {
  const t = String(q || "").trim().replace(/[.!]+$/, "")
  if (!t || /\?/.test(t) || NOT_A_TERM.test(t) || BARE_INTRO.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length > 4 || !/^[A-Za-z0-9]/.test(t)) return false
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
  const CONDITION = /^(?:keep|make it|stay|limit|avoid|assume|use only|focus|without|don'?t|do not|never)\b/i
  for (const sentence of String(question || "").split(/(?<=[.?!])\s+/)) {
    let core = sentence.replace(LEAD_FILLER, "").replace(/[.!]+$/, "").trim()
    if (!core) continue
    if (CONDITION.test(core)) { constraints.push(core); continue }
    const tail = core.match(/^(.*?),?\s+((?:without|but (?:do not|don't|never))\b.*)$/i)
    if (tail && tail[1].split(/\s+/).length >= 3) { core = tail[1].trim(); constraints.push(tail[2].trim()) }
    if (!/\?$/.test(core) && !ASK_OPENER.test(core)) continue   // the setup the ask stands on
    const list = core.match(LIST_VERB)
    if (list && /,|\band\b/.test(list[2]) && !/\b(?:why|how|what|when|where|whether|versus|vs)\b/i.test(list[2])) {
      const items = list[2].split(/,\s*(?:and\s+)?|\s+and\s+/).map((x) => x.trim()).filter(Boolean)
      if (items.length >= 2 && items.every((x) => x.split(/\s+/).length <= 8)) { for (const x of items) parts.push(`${list[1]} ${x}`); continue }
    }
    const clauses = core.split(/,\s*(?:and\s+)?|;\s*|\s+and\s+(?=(?:explain|give|describe|define|state|name|list|show|compare|walk|outline|discuss|recommend|propose|justify|why|how|what)\b)/i).map((x) => x.trim()).filter(Boolean)
    if (clauses.length >= 2 && clauses.every((x) => ASK_OPENER.test(x))) { parts.push(...clauses); continue }
    parts.push(core)
  }
  return { parts, constraints }
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
      return `ANSWER LEVEL — ${ANSWER_LEVEL_NAME[level]}: architect-and-developer understanding, spoken as business. Lead with the decision, or the stakes of the situation. Then what was achieved — the outcomes and the metrics that prove them: name the measures he actually tracks (coverage, detection or response time, false-positive rate, audit results, cost or hours saved) using only figures the background supports. The mechanism is compressed to the one line that shows he knows it cold — no step-by-step procedure, no settings, no tool walkthrough. Every technical point lands on a business consequence: risk reduced, operations protected, money or time saved.`
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

/** Speaker-aware: any Them: line is a question; otherwise needs ? or an ask-pattern. */
export function plainlyNoQuestion(heard: string): boolean {
  const lines = String(heard || "").split("\n").filter((l) => l.trim())
  if (!lines.length) return true
  if (lines.some((l) => /^Them:/.test(l))) return false
  return !lines.some((l) => {
    const t = l.replace(/^(You|Them):\s*/, "")
    return BARE_INTRO.test(t.trim()) || /\?/.test(t) || ASKS.test(t) || LOGISTICS.test(t) || THEIRQ.test(t)
  })
}

/**
 * The last real question inside a messy turn. The microphone hears the interviewer,
 * the candidate reading the previous answer, and noise. The answer follows the ask,
 * not the ramble. "Okay" alone is not a question.
 */
export function cutQuestion(heard: string): string {
  const text = String(heard || "")
    .replace(/^(?:You(?: \(typed\))?|Them):\s*/gim, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (BARE_INTRO.test(text)) return "Tell me about yourself"
  // The interviewer's whole ask, not its last clause (measured 26 Oct 2026: "Design X. Explain trust boundaries..."
  // was answered as "Explain trust boundaries...", and "Give a falsifiable test and an exit criterion" was dropped).
  // The last ask, the asks and the scenario just before it, and the instructions right after it, in order.
  const parts = askSentences(text)
  let last = -1
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].kind === "ask") { last = i; break }
  if (last < 0) return ""
  let from = last, context = 0
  while (from > 0 && (parts[from - 1].kind === "ask" || (parts[from - 1].kind === "context" && context < 2))) {
    if (parts[from - 1].kind === "context") context++
    from--
  }
  while (from < last && parts[from].kind === "context" && parts[from].text.split(/\s+/).length > 40) from++   // a long monologue is not setup
  // Instructions after the ask ("Give a falsifiable test", "Keep it suitable for technical HR") are asks themselves, so
  // the last ask is the end of the question.
  const q = parts.slice(from, last + 1).map((p) => p.text).join(" ").replace(/\s+/g, " ").trim()
  if (q.split(/\s+/).length < 3) return ""
  return (q.charAt(0).toUpperCase() + q.slice(1)).slice(0, 2000)
}

// The openers of an interviewer's ask or instruction. Before 26 Oct 2026 only how/what/why..., can/would you, tell me,
// walk me, give me, explain, describe, define and compare counted, so any other imperative ("Design", "Walk through",
// "State", "Give a", "Keep it") was not part of the question at all.
const ASK_OPENER = /^(?:how|what|why|when|where|which|who|whom|whose)\b|^(?:can|could|would|will|should|do|does|did|are|have|has)\s+(?:you|we)\b|^(?:tell|walk|take|talk|show|give|explain|describe|define|compare|contrast|differentiate|distinguish|design|build|implement|configure|architect|plan|outline|list|name|state|share|write|draft|map|diagnose|troubleshoot|debug|identify|recommend|propose|justify|estimate|summari[sz]e|discuss|evaluate|assess|analy[sz]e|elaborate|expand|go|dig|introduce|imagine|suppose|pick|choose|select|rank|prioriti[sz]e|break|weigh|defend|verify|validate|test|measure|quantify|detail|clarify|demonstrate|illustrate|cover|include|keep|focus|assume|consider|avoid|limit|stay|mention|start|end|finish|continue)\b/i
// Somewhere inside a sentence that does not open as one (speech-to-text often has no full stops): the ask starts here.
const ASK_INSIDE = /\b(?:how|what|why|when|where|which|who)\b|\b(?:can|could|would|will|do|did|are|have)\s+you\b|\b(?:tell me|walk me|give me|explain|describe|define|compare|design|build|implement|configure)\b/i
const LEAD_FILLER = /^(?:(?:ok(?:ay)?|so|and|also|now|then|next|finally|right|alright|all right|well|yes|yeah|uh+|um+|please|great|perfect|cool|sure)[,.!]?\s+)+/i
const PLEASANTRY = /^(?:(?:that'?s|that is)\s+(?:great|good|interesting|fair|helpful|clear|right|true)|thanks?\b|thank you\b|(?:great|perfect|nice|good|interesting|excellent|awesome|wonderful|got it|makes sense|i see|understood)[.!]*$)/i
const OWN_WORDS = /^(?:i|i'm|i've|i'd|i'll|we|we're|we've|we'd|my|our|me)\b/i

type AskPart = { kind: "ask" | "context" | "noise" | "own"; text: string }

/** Each sentence, read as an ask, setup for one, a filler, or the candidate's own words. */
function askSentences(text: string): AskPart[] {
  return String(text || "").split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean).map((sentence): AskPart => {
    const bare = sentence.replace(LEAD_FILLER, "").trim()
    if (!bare || noiseOnly(bare) || PLEASANTRY.test(bare)) return { kind: "noise", text: bare }
    if (ASK_OPENER.test(bare) || (/\?$/.test(bare) && !OWN_WORDS.test(bare))) return { kind: "ask", text: bare }
    const inside = bare.search(ASK_INSIDE)
    if (inside > 0 && bare.slice(inside).split(/\s+/).length >= 3) {
      const tail = bare.slice(inside)
      // "In your experience, how do you..." keeps its lead; a ramble before the ask does not.
      return { kind: "ask", text: OWN_WORDS.test(bare) ? tail.slice(0, 400) : bare }
    }
    return { kind: OWN_WORDS.test(bare) ? "own" : "context", text: bare }
  })
}

const SPOKEN_NOISE =
  /^(?:ok(?:ay)?|hi|hello|hey|thanks|thank you|yeah|yep|yes|no|nope|uh+|um+|hmm+|bye|goodbye|good morning|good afternoon|good evening|how are you|what'?s up|cool|sure|right|alright|all right|got it|sounds good)[.!?]*$/i

/** A greeting or a filler is not a question. A short technical fragment is. */
export function noiseOnly(text: string): boolean {
  const t = String(text || "")
    .replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!t) return true
  return SPOKEN_NOISE.test(t)
}

/**
 * The question the answer must follow. A pinned line is the one already on
 * screen. A ramble still loses to the ask inside it. A greeting stays
 * unanswered. Anything else typed or heard is kept — dropping it is what
 * left the card on the previous answer.
 */
export function questionToAnswer(heard: string, explicit: string, pinned = false): string {
  const asked = String(explicit || "").replace(/\s+/g, " ").trim()
  if (pinned && asked && !noiseOnly(asked)) {
    // The formed question on the card is the whole of what was asked (owner, 23 Oct 2026): every ask, the setup between
    // them and every instruction, in order. Only leading filler and the candidate's own words before the first ask go.
    // Before 26 Oct a single recognised ask was cut out of it, so "Design X. Explain Y." was answered as "Explain Y."
    const parts = askSentences(asked)
    let from = 0
    while (from < parts.length - 1 && (parts[from].kind === "noise" || parts[from].kind === "own")) from++
    const whole = parts.slice(from).map((p) => p.text).join(" ").replace(/\s+/g, " ").trim()
    return (whole && !noiseOnly(whole) ? whole : asked).slice(0, 2000)
  }
  const cut = cutQuestion([heard, asked].filter(Boolean).join("\n"))
  if (cut) return cut
  if (asked && !noiseOnly(asked)) return asked.slice(0, 2000)
  const bare = String(heard || "")
    .replace(/^(?:You(?: \(typed\))?|Them(?: \(earlier\))?):\s*/gim, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (bare && !noiseOnly(bare) && bare.split(/\s+/).filter(Boolean).length >= 3) return bare.slice(0, 2000)
  return ""
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

export const INTRO_CAREER_SPINE = `CAREER-WIDE INTRODUCTION CONTRACT: The answer's subject is the PERSON across the resume, not a favourite project, vendor or an invented success metric. Give a clear current professional identity and total experience only if supported by dates or an explicit source. Connect the distinct supported career stages and broad specialities in a coherent progression, moving from the earlier work toward current responsibilities. Preserve relevant clients/employers, their roles and differences without inventing chronology. Each tool, client and achievement belongs to the role it is listed under; never move one to another employer. Say employer names exactly as the resume writes them and never expand an abbreviation in a name (measured 26 Oct 2026: "City of San Diego (DOE)" became an invented "Department of Education"). Make one or two well-chosen examples prove abilities, but no single example dominates or becomes a deep implementation walkthrough. No isolated CodeQL, CyberArk, SIEM or other tool excursion unless the question specifically narrows to it. Explain why each experience follows the previous one, and make natural human transitions rather than [beat], [breath], (pause), stock catchphrases or sudden topic changes. Do not announce job-description fit. If only one career stage is documented, describe only that stage; do not manufacture breadth. If asked for a brief introduction, compress the same truthful career arc instead of changing its subject.`

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
  // Director means decision first in every register: a compare question
  // ("risk acceptance versus remediation") registers as concept, and the
  // practice-only gate let its owner requirement silently never fire in
  // round 4. The register still shapes how the answer is built; it no longer
  // excuses a missing owner.
  if (opts.level === "director") {
    const first = plain.split(/(?<=[.!?])\s/)[0] || plain
    if (!/\b(owner|product manager|CISO|business (unit )?leader|vice president|risk manager|accountable)\b/i.test(first)) missing.push("the decision owner named in sentence one")
  }
  return missing
}

export const STRUCTURE_REPAIR_SYSTEM = `You repair one interview answer. Rewrite the SAME answer with minimal changes: keep every sentence, fact, example, and pause marker ([beat]/[breath]) unless a change is required by the missing element below. Do not shorten it, do not add new claims, do not invent numbers, and do not change the answer's level or voice. Add ONLY the missing element, in the place its instruction names. You MUST add the missing element even if that means adding a sentence: keeping the existing sentences does not mean leaving the answer unchanged.`

/** First-win archetype match. Returns the shape instruction or null. */
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
