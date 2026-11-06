/** Full-mode tailoring length. One-page and quick passes stay shorter.
 * The summary cap is a ceiling, not a quota: a short source stays short.
 * 140 words is one paragraph a recruiter can still read, and it is enough to
 * keep tools and outcomes the source already states. The old 80-word clamp
 * cut those sentences off. */
export const FULL_SUMMARY_WORDS = 140
export const QUICK_SUMMARY_WORDS = 80
export const ONE_PAGE_SUMMARY_WORDS = 55

export function summaryWordCap(mode: { onePage?: boolean; quick?: boolean; refine?: boolean } = {}): number {
  if (mode.onePage) return ONE_PAGE_SUMMARY_WORDS
  if (mode.quick || mode.refine) return QUICK_SUMMARY_WORDS
  return FULL_SUMMARY_WORDS
}

/** Experience rewrite instruction for a full tailor. Grounded in the source line.
 * Does not ask the model to invent employers, metrics, or logistics. */
export const FULL_EXPERIENCE_DEPTH = `DEPTH: rewrite each relevant bullet as a complete line grounded only in that bullet's own facts. Keep every tool, system, employer, date, and outcome already written. When the source line supports it, say the action, the technology, and the purpose in one or two sentences, not a keyword list. Do not shorten a detailed bullet into a fragment. Do not invent employers, dates, metrics, certifications, or tools the source does not show. Do not add address, visa, relocation, or work authorization unless that exact fact is already in the source line.`

const STOP = new Set(["about", "after", "their", "there", "these", "those", "which", "while", "where", "using", "would", "could", "should", "being", "other", "every", "under", "again"])

/** Source tokens a rewrite dropped. A thin line that swaps the work for a generic phrase shows up here. */
export function droppedGrounding(source: string, rewritten: string): string[] {
  const tokens = (text: string) => new Set(
    (text.toLowerCase().match(/[a-z][a-z0-9+/-]{3,}/g) || []).filter(token => !STOP.has(token)),
  )
  const kept = tokens(rewritten)
  return [...tokens(source)].filter(token => !kept.has(token)).sort()
}
