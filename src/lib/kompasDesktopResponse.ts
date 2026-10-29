import { modeBand, type AnswerShape } from "./kompasDissection.ts"

/** Desktop response contract. The question sets the depth. The level changes how it is spoken. */
export type DesktopQuestionKind = 'definition' | 'comparison' | 'experience' | 'implementation' | 'topic' | 'general'
export type DesktopLevel = 'engineer' | 'architect' | 'director'

export type LevelMetrics = {
  depth: number
  distinction: number
  integration: number
  relevance: number
  confidence: number
  length: number
}

/** Six spoken measures. Relevance stays high. The other five move with the level. */
export function levelMetrics(level: DesktopLevel): LevelMetrics {
  // Depth, length, and confidence are at least 50% apart across the three modes.
  if (level === "architect") return { depth: 0.72, distinction: 0.85, integration: 0.95, relevance: 0.95, confidence: 0.48, length: 360 }
  if (level === "director") return { depth: 0.22, distinction: 0.95, integration: 0.15, relevance: 0.95, confidence: 0.84, length: 240 }
  return { depth: 0.4, distinction: 0.55, integration: 0.28, relevance: 0.95, confidence: 0.3, length: 160 }
}

export function metricsApart(a: LevelMetrics, b: LevelMetrics): number {
  const keys: (keyof LevelMetrics)[] = ["depth", "distinction", "integration", "relevance", "confidence", "length"]
  return keys.filter((key) => Math.abs(a[key] - b[key]) / Math.max(a[key], b[key], 0.01) >= 0.2).length
}

export function desktopQuestionKind(question: string): DesktopQuestionKind {
  const q = question.toLowerCase().replace(/\s+/g, ' ').trim()
  // Explicit practical asks outrank incidental concept/comparison vocabulary.
  const practical = /\b(go deeper|in depth|in detail|step.by.step|same incident|that failure|first mitigation|falsifiable test|exit criterion)\b/.test(q)
    || /(?:^|[.?!]\s+)(?:please\s+)?(?:design|build|implement|configure|integrate|debug|troubleshoot)\b/.test(q)
  if (/\bhave you ever heard of\b/.test(q) && /\b(define|definition|briefly)\b/.test(q) && !practical) return 'definition'
  const askedForDepth = /\b(have you ever|tell me about a time|step.by.step|deep example|in detail|bottleneck|how (?:did|would|do) you)\b/.test(q)
  // Owner's Kompas Master Rules §2 (27 Oct 2026): when intent is ambiguous, take the technical/scenario lane rather than
  // manufacture an experience story. "Would you allow it? ... Explain your decision process" and "drawing on your
  // experience, how would you distinguish ..." ask for an approach; only a past, personal ask makes it the candidate's story.
  const pastAsk = /\b(?:did you|have you|were you|tell me about a time|you personally|you(?:'ve| have) (?:ever |personally )?(?:discovered|found|faced|built|implemented|led|handled|resolved|fixed|investigated|owned|delivered|migrated|automated|managed|caught)|(?:a|an|one) (?:real|recent|specific|actual|concrete) (?:[\w-]+ ){0,4}?(?:incident|project|outage|example|situation|case|story)|(?:same|that) incident)\b/.test(q)
  const wouldAsk = /\b(?:would you|how would|what would|which would|imagine|suppose|if (?:a|an|the|you|your|this|it))\b/.test(q)
  // Master Rules §1 (owner, 27 Oct 2026): "Tell me about a difficult EPM rollout" is one real project with its bottleneck,
  // and "What happened after that?" / "What logs did you check?" continue the same case. All three were read as a 70-word
  // general turn told not to add a personal incident.
  if (/\btell me about (?:a|an|one|your)\s+(?:[\w-]+\s+){0,3}?(?:rollout|project|incident|outage|migration|deployment|implementation|time|challenge|failure|investigation|situation)\b/.test(q)
    || /\bwhat happened (?:after|next|then)\b|\bafter that\b[^.?!]*\?|\bwhat (?:logs?|evidence|data|tools?|steps?|checks?) did you\b|\bwhat did you (?:check|see|find|try|do) (?:next|then|first)\b/.test(q)) return 'experience'
  // Master Rules §1/§11: a correction updates the reasoning on the same case ("Actually, the hosts files were clean and it
  // only fails on VPN. What changes in your reasoning?" took the 70-word general lane in r04).
  if (/\b(?:what changes in your|does that change your|how does that change|what would you do differently|now that|given that)\b/.test(q)) return 'implementation'
  // "How does Kerberos authentication work?": the mechanism explained in order, kept concise like a definition.
  if (!askedForDepth && /^how (?:does|do|is|are)\b[^?]*\bwork(?:s|ing)?\b/.test(q)) return 'definition'
  if (wouldAsk && !pastAsk) {
    if (practical || /\b(step.by.step|in.depth|deep|granular|implement|configure|integrate|debug|troubleshoot|design|build|investigate|distinguish|isolate|decide|allow|how (?:did|would|do) you)\b/.test(q)) return 'implementation'
  }
  if (/\b(what did you do|have you ever|how have you|tell me about a time|your experience|you discovered|you found|you faced|you built|you implemented)\b/.test(q)
    || /\bwalk me through\b[\s\S]*\byou (?:handled|managed|led|built|implemented|resolved|investigated)\b/.test(q)
    // "a vulnerability you personally discovered", "your first mitigation in that same incident": the candidate's own work.
    // Measured 26 Oct 2026: both were answered as a 70-90 word concept or as a generic procedure.
    || /\byou(?:'ve| have)? (?:personally |yourself |ever |once )?(?:discovered|found|faced|built|implemented|led|designed|handled|resolved|fixed|investigated|owned|delivered|migrated|automated|managed|reported|caught)\b/.test(q)
    || /\b(?:same|that) incident\b[\s\S]*\byour\b|\byour (?:first |own |initial )?(?:mitigation|fix|remediation|discovery|finding|incident|project|decision|approach)\b/.test(q)
    // "Choose a real Citi or CVS incident ...: what did you personally change" was answered as a hypothetical procedure,
    // and on its own as a 70-word general turn (evaluation, 27 Oct 2026). A real incident the candidate picks is their own.
    || /\b(?:choose|pick|describe|give|share|defend|walk (?:me )?through|tell me about)\b[^.?!]{0,80}?\b(?:a|an|one)\s+(?:real|recent|specific|actual|concrete)\s+(?:[\w-]+\s+){0,4}?(?:incident|project|outage|example|situation|case|story)\b/.test(q)
    || /\bwhat did you (?:personally |yourself )?(?:change|do|fix|own|decide|build)\b/.test(q)) return 'experience'
  if (practical) return 'implementation'
  if (!askedForDepth && /\b(compare|versus|vs\.?|difference|distinguish)\b/.test(q)) return 'comparison'
  if (!askedForDepth && /\b(define|definition|what (?:is|are)|meaning of)\b/.test(q)) return 'definition'
  if (/\b(step.by.step|in.depth|deep|granular|implement|configure|integrate|debug|troubleshoot|design|build|how (?:did|would|do) you)\b/.test(q)) return 'implementation'
  const words = q.split(' ').filter(Boolean)
  const shaped = /\b(what|how|why|when|where|which|who|can you|could you|would you|have you|did you|do you|are you|were you|tell me|define|compare|explain|describe|walk me|talk about)\b/.test(q)
  if (!shaped && words.length >= 1 && words.length <= 12) return 'topic'
  return 'general'
}

// Technical correctness only, never the voice or the depth (owner, 26 Oct 2026: "Dont change any realistic
// presentations things or depth of speaking like a authentic human"). Measured in evaluation round 3: containment that
// disabled JWT validation or ran deny-all on the critical service, "tests" that passed when no records came back, and
// hypotheses ruled out by the evidence that confirmed them.
const SAFE_LOGIC = "Containment never weakens a security control to restore service: no bypassing authentication, token validation or inspection, no blanket allow, and no deny-all that takes the critical service down. Missing telemetry is never a pass. A hypothesis is confirmed or ruled out by the evidence named, never both."
  // Judged 27 Oct 2026 on the Endpoint Analyst set: a "workaround" opened a subnet-wide Zscaler allow, an incident story
  // bypassed inspection for a whole domain, and "block NTLM fallback" was offered as the fix. Added, the rule above kept.
  + " A workaround or exception is the narrowest that restores the service: only the affected application, destination or group, with an owner, an expiry or review date and monitoring while it stands; never a subnet-wide allow, a disabled policy, or an inspection bypass beyond the named destination. An alert or detection is never muted or silenced to buy time."

// r03 judge: diagnosis answers opened by asserting the root cause and then went looking for it ("the root cause is the
// proxy" before any evidence). Master Rules §9: constraints, first decision, evidence, then the conclusion.
// Owner, 27 Oct 2026: "work on most super technical depth answers into better narrative ways so ... people can vocally
// express gibberish types of integrations and complex workflows which seems impossible to follow along and still grab
// audience full attention to the detail." Measured on the Endpoint Analyst rounds: the deepest answers stacked four
// sources and five complications into two noun-heavy sentences, put three or four product names in one sentence, and
// never followed one thing through the system, so a listener lost the thread. This changes the order and the pacing,
// never the depth: every technical name and mechanism stays.
// v2, judged 27 Oct 2026 on the 20 most complex Endpoint Analyst questions: v1 (follow one thing, at most two product
// names a sentence) was easier to follow aloud (70 vs 59) but dropped the named checks an expert gives (depth 68 to 58:
// certutil -verify -urlfetch, event IDs, CAPI2 and AppDiscovery logs). v2 keeps the map and the order and ties the
// exact evidence into every step.
export const NARRATE_FLOW = "NARRATING A COMPLEX FLOW (when the answer crosses several systems, sources or steps): First give the map in one sentence: how many pieces, in what order, and the one question they answer together. Then take the pieces in the order they really happen. For each one say where we are, then the exact evidence an expert reads there, the log or event ID, the command, the setting, the error, and what result confirms it or rules it out. Name a system by its job the first time (the inspection proxy, Zscaler). One step per sentence; a long list of checks becomes several sentences, never fewer checks. After four steps, one short line that says where we are. When the hard part arrives, flag it, here is where it breaks, and slow down on it. End on the one thing the listener should keep. Nothing an expert would check is left out to make it simpler: simpler comes from the order and the sentence length, never from fewer specifics. Every part the question asks for is still answered, at the same top technical depth."

const DIAGNOSIS_OPEN = "In a diagnosis, the first sentence gives the first move and the leading hypothesis as a hypothesis; a root cause is stated only after the evidence that confirms it."

// Same evaluation: confident but wrong specifics (Kerberos error codes, "whoami /f", AppEnforce.log as an EPM log), and
// Palo Alto placed at CVS, whose resume section lists Check Point. Real specifics stay; they must be exact and in place.
const EXACT_AND_PLACED = "Name an error code, event ID, log, setting or product behaviour only when it is exact for that product; otherwise say the check in plain words. When you say what you did at an employer, name only tools that employer's resume section lists."

const SURFACE_STOP = "Do not pull logs, list search keywords, open a tool chain, or aggregate Splunk. Do not add a personal incident, project lifecycle, implementation walkthrough, log collection, Splunk queries, integration plan, bottlenecks or achievement metrics to a definition or comparison."

/** The craft block for a desktop answer. A definition does not inherit the investigation outline. */
export function desktopCraft(kind: DesktopQuestionKind): string {
  if (kind === "topic") {
    return "RESPONSE CRAFT: They named a topic. Infer the interview question those words imply and answer that. Cover every word they said. One supported example if the record has it. No invented number."
  }
  if (kind === "definition" || kind === "comparison" || kind === "general") {
    return "RESPONSE CRAFT: Sentence one answers the question. A few more sentences may name the idea. Then stop. Do not open an investigation, a tool list, a log hunt, or a project story."
  }
  if (kind === "experience") {
    return "RESPONSE CRAFT: One real example. The bottleneck, what was done, and the impact. This is not the outline used for a definition."
  }
  return "RESPONSE CRAFT: Follow only the path this question asked, in spoken order. Do not add a log hunt that was not asked."
}

function desktopShape(kind: DesktopQuestionKind): AnswerShape {
  if (kind === "definition") return "definition"
  if (kind === "comparison") return "comparison"
  if (kind === "experience") return "personal-experience"
  if (kind === "implementation") return "technical-deep-dive"
  return "direct"
}

export function desktopResponsePolicy(audience: string, question: string) {
  const kind = desktopQuestionKind(question)
  const level = audience === "director" ? "director" : /architect|developer/.test(audience) ? "architect" : "engineer"
  // Master Rules §2 T4, a direct experience fact ("Have you configured CyberArk EPM?"): the fact first, one proof point.
  const directFact = kind === "general" && /^(?:so,?\s+|and\s+)?(?:have|has|did|do|are|were) you\b/i.test(question.trim())
  const surface = (kind === "definition" || kind === "comparison" || kind === "general") && !directFact
  const words = modeBand(desktopShape(kind), level).targetWords
  const angle = surface
    ? (level === "architect"
      ? "Name the mechanism in one precise sentence: the check that fails, or the boundary that is missing. Then stop. Do not build it, set it up, or integrate it."
      : level === "director"
      ? "Open on the risk and what it costs the operation. One line. Do not recite how it was built."
      : "This is not a general recruiter. Technical HR screens foundational JD readiness: say what it is, what it is used for, and why the job description asks for it. One everyday picture. Then stop.")
    : kind === "experience"
    ? (level === "architect"
      ? "Walk how it was built, set up, and integrated, bit by bit. Include the bottleneck in the system and what changed."
      : level === "director"
      ? "Open on the operational effect and the supported business result. Keep the architect's understanding, spoken at the business and operational level. A metric is named only when it was supplied."
      : "This is not a general recruiter. Give the method, the pivot, and who was accountable. Use hypotheses, evidence, research, alternatives, pivots. Show on-call accountability. Use metrics only when supplied. Do not give the build manual.")
    : kind === "implementation"
    ? (level === "architect"
      ? "Explain how it was built, configured, and integrated, bit by bit, including the interface, the tradeoff, and the test."
      : level === "director"
      ? "Keep that understanding and speak it at the business and operational level: the decision, the risk, and the result the operation can use. Do not recite the build steps."
      : "This is not a general recruiter. For this engineering problem, give methodical reasoning: hypotheses, evidence, research, alternatives, pivots. Show on-call accountability. Use metrics only when supplied. Do not give the build, the setup, and the integration unless this question asked how it was built.")
    : ""
  // Master Rules §11: a follow-up inherits the case — same project, environment and facts, one level deeper, no retelling.
  const followUp = kind === "experience" && /\bwhat happened (?:after|next|then)\b|\bafter that\b|\bwhat (?:logs?|evidence|data|tools?|steps?|checks?) did you\b|\bwhat did you (?:check|see|find|try|do) (?:next|then|first)\b/i.test(question)
  const scope = surface
    ? `This is a ${kind}. Touch the technical idea in the abstract and stop. ${angle} ${SURFACE_STOP}`
    : followUp
    ? `This continues the case from the previous turn. Keep its project, employer, environment and facts; a short callback, then only the new detail asked, one level deeper. Do not retell the story or move to another project because a word like logs appeared. ${SAFE_LOGIC} ${EXACT_AND_PLACED}`
    : kind === "experience"
    ? `Use one supported real example. Explain what was discovered or built, the candidate's own actions, the actual bottleneck, how it was resolved, and the impact on the work. A deep example gets that account. Use only supplied facts and metrics. If the incident is absent, say so and give the approach as a hypothesis. ${angle} ${SAFE_LOGIC} ${EXACT_AND_PLACED} ${NARRATE_FLOW}`
    : kind === "implementation"
    ? `Follow the precise path the question asked. ${angle} A follow-up stays on the piece that was asked. Do not restart the whole story. Do not pull logs or aggregate Splunk unless the question asked for that hunt. ${SAFE_LOGIC} ${EXACT_AND_PLACED} ${DIAGNOSIS_OPEN} ${NARRATE_FLOW}`
    : kind === "topic"
    ? `They said a topic, not a finished question. Treat every word as part of the question. If the record shows that work, use one example and cover every word. If it does not, give the approach and say that exact case was not in the record. A result number is spoken only when the source contains it. If it does not, say the result was not measured. Do not invent an incident, a metric, a tool, or an employer.`
    : directFact
    ? `This asks for a fact about the candidate. Answer it first, yes or no, from the resume, then one compact proof from the role whose section lists it. Do not define the tool, recite the introduction or open a story. ${EXACT_AND_PLACED}`
    : `This is an ordinary question. Answer it in a few sentences. ${angle} ${SURFACE_STOP}`
  const shape = levelMetrics(level)
  const spoken = `SPOKEN MEASURES for this level only: depth ${shape.depth}, distinction ${shape.distinction}, integration ${shape.integration}, relevance ${shape.relevance}, confidence ${shape.confidence}. These are not the same as the other two levels. SPOKEN CARD: one sentence a line, the way a person talks. Keep the technical name. Do not write a command, a sign, a math sum, or a block of code. Write at least nine, never >=9. Write and, never an ampersand and never x-amp. The last sentence is the plain takeaway, still about this question, said as the completed thought itself and never announced (no "The key takeaway is", "In conclusion", "To sum up"). Do not open another topic.`
  return { kind, level, words, metrics: shape, guidance: `DESKTOP THREE-LEVEL RESPONSE CONTRACT — this shape wins over any earlier template that treats every question as an investigation.\nQUESTION SHAPE: ${kind}. ${scope}\n${spoken}\nAim for about ${words} words. The level changes the angle. The question decides how far to go. A definition is not a deep example. A deep example is not a definition.` }
}
