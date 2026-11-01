/**
 * Kompas narration calibration from source-grounded NotebookLM-style teaching
 * and the candidate's explicit preference for real workbench explanations.
 *
 * Applies to the ONE-CANDIDATE-VOICE answer route across web and desktop.
 * This is prompt guidance, not factual verification or synthesized speech.
 */
export type NaturalAnswerShape =
  | "identity" | "experience" | "follow-up" | "scenario" | "mechanism" | "direct"

export const NATURAL_NARRATION_VERSION = "kompas-workbench-v1"

export function naturalAnswerShape(question: string): NaturalAnswerShape {
  const q = String(question || "").trim()
  if (/\b(?:tell me about yourself|introduce yourself|your (?:career|background|resume)|walk me through your (?:career|background|resume))\b/i.test(q)) return "identity"
  if (/\b(?:what exactly|which logs|what did (?:you|the team) (?:check|do|change)|what happened next|how did you (?:verify|validate|prove|know)|who (?:approved|owned|signed off)|go deeper|more detail|what artifacts did you)\b/i.test(q)) return "follow-up"
  if (/\b(?:tell me about a time|describe a (?:time|situation)|share an example (?:of|when)|give me an example from|walk me through an? (?:issue|incident|project) (?:you|that))\b/i.test(q)) return "experience"
  if (/\b(?:how (?:would|could|should) you|what would you|suppose|imagine|if (?:you|the|an? )|how do you (?:decide|prioritize|assess|handle))\b/i.test(q)) return "scenario"
  if (/\b(?:how (?:does|do|did|is|are)|explain how|why does|why do|what happens when|what is the difference|compare|under the hood|troubleshoot|architecture|mechanism|root cause)\b/i.test(q)) return "mechanism"
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
].join(" ")

const KIND: Record<NaturalAnswerShape, string> = {
  identity: "IDENTITY VOICE: give a coherent career arc from documented experience. Connect responsibilities, work and impact; no invented turning-point scene or forced metaphor.",
  experience: "EXPERIENCE VOICE: one actually supported situation; what caused concern, what was your responsibility, the technical check or decision, the real obstacle if documented, and what the evidence established. STAR is an internal structure, never spoken as labels. If only a broad responsibility is sourced, don't invent a named incident.",
  "follow-up": "FOLLOW-UP VOICE: stay in the same project and facts. State the requested precise artifact, check, permission, observation or approval boundary first. If the record lacks it, distinguish what was personally documented from the test you would perform. No fresh story or restart.",
  scenario: "SCENARIO VOICE: identify an explicit, testable assumption. Show the evidence that would disprove it, the operational constraint, a safe action or decision, and how you'd check the outcome. Use 'I would' for hypothetical work and don't pretend the case happened.",
  mechanism: "MECHANISM VOICE: start with the actual mechanism and its cause-and-effect sequence. Show one failure mode or contrast only if the question needs it. Go into log/field/protocol detail when requested, but don't drag in a career story.",
  direct: "DIRECT VOICE: answer only the asked definition, comparison, personal experience fact, policy or logistics. No forced STAR episode, anecdote, dramatic premise or lengthy explanation.",
}

const AUDIENCE = {
  director: "AUDIENCE: foreground exposure, decision authority, constraints and evidence required for the business decision; one technical cause only as needed.",
  architect: "AUDIENCE: foreground system boundary, dependency, architectural alternative and failure behavior; describe the actual sequence when asked.",
  engineer: "AUDIENCE: foreground observed behavior, relevant source of truth, practical check, falsifiable alternative and verification.",
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
