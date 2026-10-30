// What a question explicitly asks for, checked in the answer text. Keyed on the question's own words, not on a
// fixture id, so the same checks run on every chain in scripts/fixtures/kompas-evaluation/interview-50.json and on
// live questions. These are the pieces the repair loop is supposed to add (hitachi-grc Q2 and Q3 failed on them in
// live rounds 11 to 14), so a miss here after repair means the repair was discarded or cut.

export interface CriteriaMiss { check: string; question: string }

const ALTERNATIVE = /\b(?:rejected|instead of|rather than|the alternative|over (?:a|an|the)\b|i ruled out|i chose\b[^.]*\bover\b)/i
const HYPOTHESIS = /\bHypothesis (?:1|one)\b[\s\S]*\bHypothesis (?:2|two)\b/i
const EXIT = /\b(?:exit criteri|stop condition|i stop when|we stop when|stop (?:the|this) (?:test|rollout|change) (?:when|if)|done when)\w*/i
const FALSIFY = /\b(?:falsif\w*|proves? (?:it|this|that|the hypothesis) wrong|rules? (?:it|this|that) out|if [^.]{3,80}, then\b|would (?:disprove|rule out))/i
const OWNER = /\b(?:owner|owns|accountable|decision rests with|signs off)\b/i
const MEASURE = /\b(?:measure|measures|track|metric|metrics|indicator)\b/i
const ACHIEVED_FIGURE = /\b(?:reduced|cut|improved|lowered|increased|saved|achieved)\b[^.]*\b\d[\d,.]*\s*%/i

/** Every explicit piece the question names that the answer does not contain. */
export function criteriaMisses(question: string, answer: string): CriteriaMiss[] {
  const q = String(question || "")
  const a = String(answer || "")
  const out: CriteriaMiss[] = []
  const miss = (check: string) => out.push({ check, question: q })
  for (const code of q.match(/\b[A-Z]{2,}[\s-]?\d{2,4}-\d{1,3}\b|\b\d{3}-\d{2,3}\b/g) || []) {
    const bare = code.match(/\d{2,4}-\d{1,3}/)?.[0] || code
    if (!a.includes(bare)) miss(`names ${code}`)
  }
  if (/^\s*design\b/i.test(q) && !ALTERNATIVE.test(a)) miss("rejected alternative")
  if (/\bcompeting hypothes/i.test(q) && !HYPOTHESIS.test(a)) miss("Hypothesis 1 and Hypothesis 2 labels")
  if (/\brollback\b/i.test(q) && !/\broll(?:s|ed|ing)?[ -]?back\b/i.test(a)) miss("rollback")
  if (/\bexit criteri/i.test(q) && !EXIT.test(a)) miss("exit criterion")
  if (/\bfalsifiable\b/i.test(q) && !FALSIFY.test(a)) miss("falsifiable test")
  if (/\b(?:decision )?owner\b/i.test(q) && !OWNER.test(a)) miss("decision owner")
  if (/\bmeasures?\b|\bmetrics?\b|\btrack\b/i.test(q) && !MEASURE.test(a)) miss("measures to track")
  if (/without inventing achieved numbers/i.test(q) && ACHIEVED_FIGURE.test(a)) miss("no invented achieved numbers")
  return out
}
