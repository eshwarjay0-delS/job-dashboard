/** Desktop response contract. The question sets the depth. The level changes how it is spoken. */
export type DesktopQuestionKind = 'definition' | 'comparison' | 'experience' | 'implementation' | 'general'
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
  if (level === "architect") return { depth: 0.95, distinction: 0.85, integration: 0.95, relevance: 0.95, confidence: 0.75, length: 420 }
  if (level === "director") return { depth: 0.25, distinction: 0.95, integration: 0.1, relevance: 0.95, confidence: 0.95, length: 240 }
  return { depth: 0.55, distinction: 0.7, integration: 0.3, relevance: 0.95, confidence: 0.55, length: 180 }
}

export function metricsApart(a: LevelMetrics, b: LevelMetrics): number {
  const keys: (keyof LevelMetrics)[] = ["depth", "distinction", "integration", "relevance", "confidence", "length"]
  return keys.filter((key) => Math.abs(a[key] - b[key]) / Math.max(a[key], b[key], 0.01) >= 0.2).length
}

export function desktopQuestionKind(question: string): DesktopQuestionKind {
  const q = question.toLowerCase()
  const askedForDepth = /\b(have you ever|tell me about a time|step.by.step|deep example|in detail|bottleneck|how (?:did|would|do) you)\b/.test(q)
  if (/\b(have you ever|tell me about a time|your experience|you discovered|you found|you faced|you built|you implemented)\b/.test(q)) return 'experience'
  if (!askedForDepth && /\b(compare|versus|vs\.?|difference|distinguish)\b/.test(q)) return 'comparison'
  if (!askedForDepth && /\b(define|definition|what (?:is|are)|meaning of)\b/.test(q)) return 'definition'
  if (/\b(step.by.step|in.depth|deep|granular|implement|configure|integrate|debug|troubleshoot|design|build|how (?:did|would|do) you)\b/.test(q)) return 'implementation'
  return 'general'
}

export function desktopResponsePolicy(audience: string, question: string) {
  const kind = desktopQuestionKind(question)
  const level = audience === 'director' ? 'director' : /architect|developer/.test(audience) ? 'architect' : 'engineer'
  const surface = kind === 'definition' || kind === 'comparison'
  const words = surface ? (kind === 'comparison' ? 110 : 80) : kind === 'experience' ? (level === 'engineer' ? 250 : 390) : kind === 'implementation' ? (level === 'engineer' ? 180 : level === 'architect' ? 420 : 260) : 90
  const scope = surface
    ? 'Explain the concept directly, with its mechanism, the essential distinction and at most one short example. Stop once the question is answered. Do not add a personal incident, project lifecycle, implementation walkthrough, log collection, Splunk queries, integration plan, bottlenecks or achievement metrics to a definition or comparison.'
    : kind === 'experience'
    ? 'Use one supported real example. Explain what you discovered or built, your own actions, the actual bottleneck, how you resolved it, validation and the business consequence. A request for a deep example deserves a detailed causal account. Use only supplied facts and metrics; if the incident is absent, state that plainly and give a hypothetical approach.'
    : kind === 'implementation'
    ? 'Follow the precise technical path asked about. Explain setup, boundaries, integration, failure modes and validation where relevant. A focused follow-up stays on its requested component; do not restart the entire story.'
    : 'This is an ordinary question. Answer it in a few sentences. Do not pull logs, list search keywords, open a tool chain, or aggregate Splunk. That procedure was not asked.'
  const shape = levelMetrics(level)
  const listener = level === 'engineer'
    ? 'LEVEL 1 — Technical HR + Engineer. This is not a general recruiter. Technical HR screens foundational JD readiness: the keyword, what it is used for, and why the requirement matters, without the machinery. For engineering problems, give methodical reasoning: hypotheses, evidence, research, alternatives, pivots. Show on-call accountability. Use metrics only when supplied. Do not give the build, the setup, and the integration unless this question asked how it was built.'
    : level === 'architect'
    ? 'LEVEL 2 — Architect + Developer: for implementation and design questions, explain how it was built, configured and integrated, bit by bit, including interfaces, tradeoffs, failure handling and tests. Definitions and comparisons still stay concise.'
    : 'LEVEL 3 — Director: retain the architect/developer reasoning but express it at the business and operational level. Explain ownership, risk, delivery tradeoffs, operational effect and supported business achievements. Say which metrics you would measure; never turn proposed metrics into past results. Definitions and comparisons still stay concise. Do not recite the build steps.'
  const spoken = `SPOKEN MEASURES for this level only: depth ${shape.depth}, distinction ${shape.distinction}, integration ${shape.integration}, relevance ${shape.relevance}, confidence ${shape.confidence}. SPOKEN CARD: one sentence a line, the way a person talks. Keep the technical name. Do not write a command, a sign, a math sum, or a block of code. Write at least nine, never >=9. The last sentence is the plain takeaway, still about this question. Do not open another topic.`
  return {kind, level, words, metrics: shape, guidance: `DESKTOP THREE-LEVEL RESPONSE CONTRACT — use this scope over any earlier generic depth or storytelling template.\n${listener}\n${spoken}\nQUESTION SHAPE: ${kind}. ${scope}\nAim for about ${words} words, using fewer when sufficient. Selected audience changes the explanation, while the current question determines how far to go. No fixed rhythm, mandatory tool sequence, forced metaphor or invented personal achievement.`}
}
