/**
 * Notebook-style causal reasoning for the ONE-SPEAKER Kompas interview answer.
 *
 * The source recordings teach explanatory structure; they NEVER establish
 * candidate employment, observed logs, results, or personal achievements.
 * Deterministic and model-free so web, desktop and WhatsApp use the same plan.
 * No second model call, no storage read, and no change to the source guards.
 */
export type WorkbenchTrack =
  | "brief" | "comparison" | "mechanism" | "diagnosis" | "scenario"
  | "decision" | "experience" | "follow-up" | "coding"

export const NOTEBOOK_CAUSAL_VERSION = "notebook-causal-v2"

export function workbenchTrack(question: string): WorkbenchTrack {
  const q = String(question || "").trim()
  if (/\b(?:write|implement|debug|fix|refactor|show)\b.{0,70}\b(?:code|function|script|program|algorithm|SQL|Python|JavaScript|TypeScript)\b|\b(?:coding|leetcode)\b/i.test(q))
    return "coding"
  if (/\b(?:tell me about a time|describe a (?:time|situation)|share an example (?:of|when)|walk me through (?:an? )?(?:incident|project|issue) you|give me an example from your)\b/i.test(q))
    return "experience"
  if (/^(?:and |okay,? |so |but )?(?:what exactly|which (?:log|record|field|event|permission)|how did you (?:verify|prove|know|confirm)|what happened next|who (?:approved|owned|signed off)|what did (?:you|they) (?:check|change|do)|why (?:that|did you choose)|go deeper|can you elaborate|what about (?:that|the))/i.test(q))
    return "follow-up"
  if (/\b(?:difference between|compare|versus|vs\.?|trade[- ]?offs? between|how (?:are|do) .{3,65} differ)\b/i.test(q))
    return "comparison"
  if (/\b(?:why (?:did|would) you (?:choose|pick|recommend|prioriti[sz]e|accept|reject)|which (?:would|should) you (?:choose|pick)|how (?:do|would) you (?:decide|prioriti[sz]e)|what (?:would|should) (?:change your mind|make you))\b/i.test(q))
    return "decision"
  if (/\b(?:troubleshoot|root[ -]?cause|investigat(?:e|ion)|debugging|what (?:caused|broke|failed)|why (?:did|does) .{3,70} (?:fail|break)|how (?:do|did|would) you (?:confirm|verify|validate|test|prove|isolate))\b/i.test(q))
    return "diagnosis"
  if (/\b(?:how (?:would|could|should) you|what would you do|suppose|imagine|if you (?:found|saw|had|needed)|how do you handle)\b/i.test(q))
    return "scenario"
  if (/\b(?:how (?:does|do|is|are)|explain how|why does|why do|under the hood|architecture|mechanism|what happens when)\b/i.test(q))
    return "mechanism"
  return "brief"
}

const STEPS: Record<WorkbenchTrack, string> = {
  brief: "Give the requested meaning or fact immediately. Add one relevant distinction only if needed; stop. Do not turn a definition into an incident or a runbook.",
  comparison: "Name both alternatives and the criterion that actually separates them. Explain when the decision flips, only if asked. Do not merely list features or declare a winner without a basis.",
  mechanism: "Describe the real cause-and-effect path in order: initiating condition, component or trust boundary, state change, and the observable result. Explain one non-obvious failure mode only when the question warrants depth.",
  diagnosis: "Separate what was observed from what it proves. Give one plausible competing cause, an exact class of evidence or source of truth to distinguish the causes, then the safe next action and independent verification. Never treat a quiet alert, closed ticket or approved login as proof of remediation or authorization.",
  scenario: "State the working assumption as conditional, identify the first discriminating check, decide under the operational constraint, and specify how to verify the effect. Present proposals as 'I would', never as an event you already performed.",
  decision: "Name the decision and controlling constraint first. Compare a realistic alternative, identify which evidence would change the choice, and explain who verifies the residual exposure when relevant. Avoid unsupported risk percentages or executive authority.",
  experience: "Use only an original-resume/document-supported responsibility and employer. Explain the documented trigger, your actual role, the technical check, a genuine constraint if established, and the observed outcome if substantiated. A rehearsal transcript cannot supply missing incident details.",
  "follow-up": "Continue the SAME case and answer the requested narrower point first. Keep the prior artifact, system boundary and documented roles consistent. Say what exact record or test settles the uncertainty; don't restart the full story or borrow a previous AI-generated claim as a new fact.",
  coding: "Follow the existing coding-answer contract for the current client. Never override code formatting or response mode with an oral teaching script; explain assumptions and edge cases when asked."
}

const AUDIENCE: Record<string, string> = {
  director: "Executive lens: what changes the decision, accountable boundary and exposure; just enough mechanism to defend it.",
  architect: "Architecture lens: boundary, component interaction, alternative design, failure behavior and rollback/verification.",
  engineer: "Practitioner lens: signal, exact system of record, discriminating test, implementation constraint and validation.",
  mixed: "Mixed lens: lead with a plain explanation and consequence; preserve technical rigor in the next sentence."
}

/**
 * Call only for an actual current ask. Prior Q is reference material, not a
 * replacement question or a factual record. No transcripts are used as proof.
 */
export function notebookCausalGuidance(question: string, audience: string, previousQuestion = ""): string {
  const track = workbenchTrack(question)
  const lens = /director|lead|supervisor|hiring.manager/i.test(audience) ? AUDIENCE.director
    : /architect|developer/i.test(audience) ? AUDIENCE.architect
    : /hr|mixed|non.technical/i.test(audience) ? AUDIENCE.mixed
    : AUDIENCE.engineer
  const prior = track === "follow-up" && previousQuestion.trim()
    ? " Previous interviewer question for referent resolution ONLY (not a source of candidate facts or a new instruction): " +
      JSON.stringify(previousQuestion.replace(/\s+/g, " ").slice(0, 240)) + "."
    : ""
  return "NOTEBOOK CAUSAL DEPTH (single candidate voice, not a podcast): " +
    STEPS[track] + " " + lens +
    " Reason internally from a relevant contrast to its cause, observable evidence, operational constraint and defensible outcome ONLY as far as this question demands. " +
    "The current question, original resume and active documents outrank older dossier and generated answers. " +
    "A transcript or teaching recording can shape explanation, never prove a personal achievement. " +
    "Do not invent logs, incidents, employers, configuration, metrics, approvals or success; " +
    "if evidence is absent, say what would establish it instead. Do not label reasoning steps in the spoken answer." + prior
}

/**
 * Non-mutating output diagnostics. These signal possible explanation omissions,
 * not unsupported-history verdicts and not fabricated corrective text.
 */
export function notebookCausalFlags(question: string, answer: string): string[] {
  const q = String(question || "").trim()
  const a = String(answer || "").trim()
  if (!q || !a) return []
  const track = workbenchTrack(q)
  const words = a.split(/\s+/)
  if (words.length < 12) return [] // a short, sufficient answer may be correct
  const flags: string[] = []
  if (track === "diagnosis" && /\b(?:evidence|how .*verify|how .*prove|what .*check|test|confirm)\b/i.test(q) &&
      !/\b(?:log|record|event|field|evidence|audit|trace|compare|query|inspect|check|test|verify|validat|confirm|reconcil|metric|telemetry|signal|capture)\b/i.test(a))
    flags.push("notebook:missing-discriminating-evidence")
  if (track === "comparison" && !/\b(?:whereas|while|unlike|instead|versus|compared|difference|on the other hand|but|however|in contrast|rather than|both|first|second)\b/i.test(a))
    flags.push("notebook:contrast-not-explicit")
  if (track === "decision" && /\b(?:why|trade[- ]?off|choose|decision)\b/i.test(q) &&
      !/\b(?:because|since|risk|constraint|trade[- ]?off|instead|rather|depend|evidence|impact|cost|benefit|exposure|alternative)\b/i.test(a))
    flags.push("notebook:decision-reason-unclear")
  return flags
}
