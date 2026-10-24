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
  if (/\b(have you ever|how have you|tell me about a time|your experience|you discovered|you found|you faced|you built|you implemented)\b/.test(q)
    || /\bwalk me through\b[\s\S]*\byou (?:handled|managed|led|built|implemented|resolved|investigated)\b/.test(q)) return 'experience'
  if (!askedForDepth && /\b(compare|versus|vs\.?|difference|distinguish)\b/.test(q)) return 'comparison'
  if (!askedForDepth && /\b(define|definition|what (?:is|are)|meaning of)\b/.test(q)) return 'definition'
  if (/\b(step.by.step|in.depth|deep|granular|implement|configure|integrate|debug|troubleshoot|design|build|how (?:did|would|do) you)\b/.test(q)) return 'implementation'
  return 'general'
}

const SURFACE_STOP = "Do not pull logs, list search keywords, open a tool chain, or aggregate Splunk. Do not add a personal incident, project lifecycle, implementation walkthrough, log collection, Splunk queries, integration plan, bottlenecks or achievement metrics to a definition or comparison."

/** The craft block for a desktop answer. A definition does not inherit the investigation outline. */
export function desktopCraft(kind: DesktopQuestionKind): string {
  if (kind === "definition" || kind === "comparison" || kind === "general") {
    return "RESPONSE CRAFT: Sentence one answers the question. A few more sentences may name the idea. Then stop. Do not open an investigation, a tool list, a log hunt, or a project story."
  }
  if (kind === "experience") {
    return "RESPONSE CRAFT: One real example. The bottleneck, what was done, and the impact. This is not the outline used for a definition."
  }
  return "RESPONSE CRAFT: Follow only the path this question asked, in spoken order. Do not add a log hunt that was not asked."
}

export function desktopResponsePolicy(audience: string, question: string) {
  const kind = desktopQuestionKind(question)
  const level = audience === "director" ? "director" : /architect|developer/.test(audience) ? "architect" : "engineer"
  const surface = kind === "definition" || kind === "comparison" || kind === "general"
  const words = kind === "definition"
    ? (level === "architect" ? 100 : level === "director" ? 90 : 80)
    : kind === "comparison"
    ? (level === "architect" ? 120 : level === "director" ? 110 : 100)
    : kind === "experience"
    ? (level === "engineer" ? 250 : level === "architect" ? 420 : 320)
    : kind === "implementation"
    ? (level === "engineer" ? 180 : level === "architect" ? 420 : 260)
    : (level === "architect" ? 90 : 70)
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
  const scope = surface
    ? `This is a ${kind}. Touch the technical idea in the abstract and stop. ${angle} ${SURFACE_STOP}`
    : kind === "experience"
    ? `Use one supported real example. Explain what was discovered or built, the candidate's own actions, the actual bottleneck, how it was resolved, and the impact on the work. A deep example gets that account. Use only supplied facts and metrics. If the incident is absent, say so and give the approach as a hypothesis. ${angle}`
    : kind === "implementation"
    ? `Follow the precise path the question asked. ${angle} A follow-up stays on the piece that was asked. Do not restart the whole story. Do not pull logs or aggregate Splunk unless the question asked for that hunt.`
    : `This is an ordinary question. Answer it in a few sentences. ${angle} ${SURFACE_STOP}`
  const shape = levelMetrics(level)
  const spoken = `SPOKEN MEASURES for this level only: depth ${shape.depth}, distinction ${shape.distinction}, integration ${shape.integration}, relevance ${shape.relevance}, confidence ${shape.confidence}. These are not the same as the other two levels. SPOKEN CARD: one sentence a line, the way a person talks. Keep the technical name. Do not write a command, a sign, a math sum, or a block of code. Write at least nine, never >=9. Write and, never an ampersand and never x-amp. The last sentence is the plain takeaway, still about this question. Do not open another topic.`
  return { kind, level, words, metrics: shape, guidance: `DESKTOP THREE-LEVEL RESPONSE CONTRACT — this shape wins over any earlier template that treats every question as an investigation.\nQUESTION SHAPE: ${kind}. ${scope}\n${spoken}\nAim for about ${words} words. The level changes the angle. The question decides how far to go. A definition is not a deep example. A deep example is not a definition.` }
}
