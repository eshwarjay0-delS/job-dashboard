/** Desktop response contract approved by the owner on 22 October 2026. */
export type DesktopQuestionKind = 'definition' | 'comparison' | 'experience' | 'implementation' | 'general'

export function desktopQuestionKind(question: string): DesktopQuestionKind {
  const q = question.toLowerCase()
  if (/\b(have you ever|tell me about a time|your experience|you discovered|you found|you faced|you built|you implemented)\b/.test(q)) return 'experience'
  if (/\b(step.by.step|in.depth|deep|granular|implement|configure|integrate|debug|troubleshoot|design|build|how (?:did|would|do) you)\b/.test(q)) return 'implementation'
  if (/\b(compare|versus|vs\.?|difference|distinguish)\b/.test(q)) return 'comparison'
  if (/\b(define|definition|what (?:is|are)|meaning of)\b/.test(q)) return 'definition'
  return 'general'
}

export function desktopResponsePolicy(audience: string, question: string) {
  const kind = desktopQuestionKind(question)
  const level = audience === 'director' ? 'director' : /architect|developer/.test(audience) ? 'architect' : 'engineer'
  const surface = kind === 'definition' || kind === 'comparison'
  const words = surface ? (kind === 'comparison' ? 120 : 85) : kind === 'experience' ? (level === 'engineer' ? 250 : 390) : kind === 'implementation' ? (level === 'engineer' ? 220 : level === 'architect' ? 420 : 300) : 150
  const scope = surface
    ? 'Explain the concept directly, with its mechanism, the essential distinction and at most one short example. Stop once the question is answered. Do not add a personal incident, project lifecycle, implementation walkthrough, log collection, Splunk queries, integration plan, bottlenecks or achievement metrics to a definition or comparison.'
    : kind === 'experience'
    ? 'Use one supported real example. Explain what you discovered or built, your own actions, the actual bottleneck, how you resolved it, validation and the business consequence. A request for a deep example deserves a detailed causal account. Use only supplied facts and metrics; if the incident is absent, state that plainly and give a hypothetical approach.'
    : kind === 'implementation'
    ? 'Follow the precise technical path asked about. Explain setup, boundaries, integration, failure modes and validation where relevant. A focused follow-up stays on its requested component; do not restart the entire story.'
    : 'Answer the actual ask in ordinary spoken language. Use only the detail needed to make the answer useful. Do not impose a repeated story or investigation template.'
  const listener = level === 'engineer'
    ? 'LEVEL 1 — Technical HR + Engineer: adapt within this level to the question. Technical HR screens foundational JD readiness: explain each relevant keyword, what it is used for, why it matters to the requirement, and its operational context, without assuming implementation expertise. For engineering problems, give methodical reasoning: hypotheses, evidence, research, alternatives, pivots, system dependencies, troubleshooting, patching, validation and monitoring as relevant. Show ownership, on-call accountability, peer communication and mentoring when asked. Use metrics only when supplied, or clearly label proposed measures. Do not flatten an engineer into a recruiter script or recite this entire checklist. Definitions remain concise; a focused problem deserves the actual technical reasoning.'
    : level === 'architect'
    ? 'LEVEL 2 — Architect + Developer: for implementation and design questions, explain how it was built, configured and integrated, bit by bit, including interfaces, tradeoffs, failure handling and tests. Definitions and comparisons still stay concise.'
    : 'LEVEL 3 — Director: retain the architect/developer reasoning but express it at the business and operational level. Explain ownership, risk, delivery tradeoffs, operational effect and supported business achievements. Say which metrics you would measure; never turn proposed metrics into past results. Definitions and comparisons still stay concise.'
  return {kind, level, words, guidance: `DESKTOP THREE-LEVEL RESPONSE CONTRACT — use this scope over any earlier generic depth or storytelling template.\n${listener}\nQUESTION SHAPE: ${kind}. ${scope}\nAim for about ${words} words, using fewer when sufficient. Selected audience changes the explanation, while the current question determines how far to go. No fixed rhythm, mandatory tool sequence, forced metaphor or invented personal achievement.`}
}
