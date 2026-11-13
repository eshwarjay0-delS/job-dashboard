/**
 * Kompas narration calibration from source-grounded NotebookLM-style teaching
 * and the candidate's explicit preference for real workbench explanations.
 *
 * Applies to the ONE-CANDIDATE-VOICE answer route across web and desktop.
 * This is prompt guidance, not factual verification or synthesized speech.
 */
export type NaturalAnswerShape =
  | "identity" | "experience" | "follow-up" | "design" | "scenario" | "mechanism" | "direct"

export const NATURAL_NARRATION_VERSION = "kompas-workbench-v4"

const DESIGN_ASK = /^(?:(?:um+|uh+|so|yeah|yes|ok(?:ay)?|right|well|then|now|like|please)[,.\s]+)*(?:please\s+)?design\b|\bdesign me\b|\bhow (?:would|could|should|do|did) (?:you|we|i) design\b|\b(?:can|could|would) you design\b|\bhow you (?:would|could|should) design\b/i

export function naturalAnswerShape(question: string): NaturalAnswerShape {
  const q = String(question || "").trim()
  if (/\b(?:tell me about yourself|introduce yourself|your (?:career|background|resume)|walk me through your (?:career|background|resume))\b/i.test(q)) return "identity"
  if (DESIGN_ASK.test(q)) return "design"
  if (/\b(?:what exactly|which logs|what did (?:you|the team) (?:check|do|change)|what happened next|how did you (?:verify|validate|prove|know)|who (?:approved|owned|signed off)|go deeper|more detail|what artifacts did you)\b/i.test(q)) return "follow-up"
  if (/\b(?:tell me about a time|describe a (?:time|situation)|share an example (?:of|when)|give me an example from|walk me through an? (?:issue|incident|project) (?:you|that))\b/i.test(q)) return "experience"
  if (/\b(?:how (?:would|could|should) you|what would you|suppose|imagine|if (?:you|the|an? )|how do you (?:decide|prioritize|assess|handle))\b/i.test(q)) return "scenario"
  if (/\b(?:how (?:does|do|did|is|are)|explain how|why does|why do|what happens when|under the hood|troubleshoot|architecture|mechanism|root cause)\b/i.test(q)) return "mechanism"
  return "direct"
}

const CORE = [
  "WORKBENCH NARRATION OVERRIDE: authenticity and question fidelity outrank decorative storytelling.",
  "Sound like one calm professional reasoning with another human, never like two enthusiastic podcast hosts or a scripted keynote.",
  "Explain one concrete discrepancy or decision that is directly relevant, then reveal the technical mechanism, the evidence that would test it, and the practical consequence.",
  "Use a real workplace bottleneck only when the original candidate evidence establishes it. Otherwise label a hypothetical operational example honestly, or give a clean mechanism without any story.",
  "Do not force analogies, jokes, rhetorical questions, stage scenes, 'imagine a house', apartment keys, doors, cooking, movie plots, cinematic imagery, or a picture before every answer.",
  "A naturally memorable line is an evidence-backed distinction, not a motivational slogan. Avoid theatrical amazement and an over-polished conclusion.",
  "Technical clarity: name the relevant log, permission path, record, control, component or failure mode WHEN it changes the reasoning. Explain unfamiliar terms briefly and don't recite an inventory of tools.",
  "Keep a consistent known-facts ledger. A prior generated interview answer and external Notebook-style teaching transcript are NOT evidence that the candidate performed an incident.",
  "Do not fabricate employers, technical observations, an executive, colleagues, dialogue, metrics, causation, approvals, implementation ownership or verified results.",
  "Do not trade technical precision for entertainment. If the interviewer asks for one fact, answer it and stop.",
  "Vary sentence length the way a person talks: a short claim, then one longer sentence that walks the work, then a short close. Do not manufacture um, uh, you know, right?, or basically for the candidate to read aloud. A short self-correction is fine; a scripted landing is not.",
  "Do not use empty phrasing such as delve, underscore, tapestry, shed light, pivotal role, robust framework, it is important to note, in conclusion, or in today's landscape. Keep the fact. Drop the frame.",
  "Open on the answer in the interviewer's words: the check, the decision, or the break. Never restate or praise the question.",
  "When the question is about work you did, prefer one worked example over a list of capabilities: say for example, then the sources, the join or key, and the actual batch or case. After the action, name the simpler path you rejected with rather than. If you did not do the thing they asked, say so in one short clause, then the nearest sourced work. For a failure or recovery question, start at the failed step, rerun only the affected batch, and say how you checked you did not create duplicates or gaps. Do not invent years, systems, or a case to fill the example.",
  "Length follows the question type first, then the mode; mode changes stance more than volume.",
  "On a blame or post-mortem question, name the pressure, own the miss, and do not deflect. Confidence is calm. It is not a boast.",
].join(" ")

const KIND: Record<NaturalAnswerShape, string> = {
  identity: "IDENTITY VOICE: give a coherent career arc from documented experience. Connect responsibilities, work and impact; no invented turning-point scene or forced metaphor.",
  experience: "EXPERIENCE VOICE: one actually supported situation; what caused concern, what was your responsibility, the technical check or decision, the real obstacle if documented, and what the evidence established. STAR is an internal structure, never spoken as labels. If only a broad responsibility is sourced, don't invent a named incident. Prefer a single worked example to a list of systems.",
  "follow-up": "FOLLOW-UP VOICE: stay in the same project and facts. State the requested precise artifact, check, permission, observation or approval boundary first. If the record lacks it, distinguish what was personally documented from the test you would perform. No fresh story or restart.",
  design: "DESIGN VOICE: Name the map in one short sentence. Build only the first layer, as thought in progress. End with a named-layer checkpoint such as \"Want me to go deeper on the storage layer, or shall I keep sketching the whole shape?\" Keep optional tangents explicitly optional or out of scope. Follow-ups do not restart the map. Never invent components, metrics or years. The director gives the decision and tradeoff first, then the offer. The engineer gives a concrete behavior, then the mechanism, then the offer. The architect gives the boundary, a short ramble, a return, then the offer.",
  scenario: "SCENARIO VOICE: identify an explicit, testable assumption. Show the evidence that would disprove it, the operational constraint, a safe action or decision, and how you'd check the outcome. Use 'I would' for hypothetical work and don't pretend the case happened.",
  mechanism: "MECHANISM VOICE: start with the actual mechanism and its cause-and-effect sequence. Show one failure mode or contrast only if the question needs it. Go into log/field/protocol detail when requested, but don't drag in a career story.",
  direct: "DIRECT VOICE: answer only the asked definition, comparison, personal experience fact, policy or logistics. No forced STAR episode, anecdote, dramatic premise or lengthy explanation.",
}

const AUDIENCE = {
  director: "AUDIENCE: foreground exposure, decision authority, constraints and evidence required for the business decision; one technical cause only as needed. Sound like someone who has done the work and is now making the call: the cost, the owner, and what would change your mind. Calm, not hype.",
  architect: "AUDIENCE: foreground system boundary, dependency, architectural alternative and failure behavior; describe the actual sequence when asked. A short ramble into the surrounding design is fine if the next sentence returns to the question. Curiosity is about the tradeoff and where it breaks.",
  engineer: "AUDIENCE: foreground observed behavior, relevant source of truth, practical check, falsifiable alternative and verification. Sound like a developer working through the technical need: one failed attempt if you have it, then the check that worked. Excitement belongs on the puzzle, not on a slogan. For a failure, start at the failed activity, not the whole pipeline, and say how you verified the recovery.",
  mixed: "AUDIENCE: give a short plain-language consequence after technical reasoning so a less technical listener can rejoin without oversimplifying.",
}

export function naturalNarrationGuidance(question: string, audience: string): string {
  const kind = naturalAnswerShape(question)
  const role = /director|lead|supervisor|hiring.manager/i.test(audience)
    ? AUDIENCE.director
    : /architect|developer/i.test(audience)
      ? AUDIENCE.architect
      : /mixed|hr|technical.hr|non.technical/i.test(audience)
        ? AUDIENCE.mixed
        : AUDIENCE.engineer
  return CORE + " " + KIND[kind] + " " + role
}


/**
 * Non-mutating observational lint for finished model replies. Important:
 * these flags are NOT a factuality judge and never strip a real candidate
 * claim. Clients already receive precision.flags for the SSE and JSON paths.
 *
 * Avoid flagging normal technical terms such as API keys, door-controller
 * access, rotating an encryption key, or a physical facility incident.
 */
export function naturalNarrationFlags(question: string, answer: string): string[] {
  const ask = String(question || "")
  const response = String(answer || "")
  if (!response.trim()) return []
  const flags: string[] = []
  const requestedAnalogy = /\b(?:analogy|metaphor|metaphorical|compare (?:it|this) to|like i(?:'m| am) five|explain it like|make (?:an?|the) analogy)\b/i.test(ask)
  const isCandidateStory = naturalAnswerShape(ask) === "experience" || naturalAnswerShape(ask) === "identity"
  const initial = response.trim()
  if (/^(?:(?:you know[, ]+)?(?:it'?s funny|welcome back|today we(?:'re| are) going to|let'?s (?:dive in|unpack|explore)|picture this)[,:.! ]+)/i.test(initial))
    flags.push("podcast-style-opening")
  if (/\b(?:delve|delving|tapestry|shed light|underscore the importance|it is important to note|in today'?s(?: rapidly evolving)? landscape|robust framework|comprehensive framework)\b/i.test(response))
    flags.push("empty-frame-phrasing")
  // This deliberately keys on an analogy prompt AND a toy scene; isolated
  // words like "key", "door", and "apartment" are not sufficient.
  if (!requestedAnalogy && /\b(?:think of it like|think of this like|it'?s (?:just )?like|imagine (?:you(?:'re| are)?|a|the)|picture (?:a|the|yourself))\b[^.!?\n]{0,120}\b(?:apartment|house key|front door|spare key under|kitchen|bouncer|movie ticket|airport security|traffic light)\b/i.test(response))
    flags.push("unrequested-toy-analogy")
  if (/\b(?:(?:that'?s|that is) (?:a )?(?:phenomenal|amazing|brilliant|excellent) question|what an incredible question|absolutely mind[- ]blowing)\b/i.test(response))
    flags.push("performative-interviewer-praise")
  if (/\b(?:at the end of the day|in conclusion|to summarize|to sum up|in summary|as you can see)\b/i.test(response))
    flags.push("scripted-landing")
  if (/^\s*(?:(?:HOST|EXPERT|NARRATOR|INTERVIEWER)\s*[:\-])/im.test(response))
    flags.push("podcast-speaker-label")
  if (!isCandidateStory && /^(?:what (?:is|are|does)|define|difference between|compare)\b/i.test(ask.trim()) &&
      /^\s*(?:at\s+[A-Z][A-Za-z& ]{2,35}[,.]?\s+(?:i|we)\b|when i was working at\b)/i.test(response))
    flags.push("unasked-personal-story")
  const count = response.trim().split(/\s+/).length
  if (naturalAnswerShape(ask) === "direct" && ask.trim().split(/\s+/).length <= 10 && count > 115)
    flags.push("direct-answer-overlong")
  return flags
}
