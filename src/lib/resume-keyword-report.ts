// Three-way keyword report (v2): covered / supportedGap (candidate's own words) / unsupportedGap.
// Accents, unicode dashes, ASP.NET/VB.NET, 'Node JS' and non-string terms handled.
const SYM: [RegExp, string][] = [[/c\+\+/g, ' cplusplus '], [/c#/g, ' csharp '], [/f#/g, ' fsharp '],
  [/(^|[^a-z0-9]|\basp|\bvb)\.net\b/g, '$1 dotnet '],            // .NET, ASP.NET, VB.NET (not example.net)
  [/\bci\s*[/\-&]\s*cd\b/g, ' cicd '], [/\bnode\s*\.?\s*js\b/g, ' nodejs '], [/\bnext\s*\.?\s*js\b/g, ' nextjs ']]
const DASH = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g
export function normTerm(s: unknown): string {
  if (typeof s !== 'string' && typeof s !== 'number') return ''
  // NFD + drop accents (résumé == resume), unicode dashes -> '-', then symbol rules
  let t = ` ${String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(DASH, '-').toLowerCase()} `
  for (const [re, r] of SYM) t = t.replace(re, r);
  return t.replace(/[^a-z0-9]+/g, ' ').trim()
}
function contains(hayNorm: string, term: string): boolean {
  const n = normTerm(term); if (!n) return false
  return ` ${hayNorm} `.includes(` ${n} `)
}
export type KeywordReport = {
  covered: string[], supportedGap: string[], unsupportedGap: string[],
  counts: { total: number, covered: number, supportedGap: number, unsupportedGap: number },
  coveragePct: number, noTerms?: true,
}

export function buildKeywordReport({ jobTerms = [], resumeText = '', supportedTerms = [] }:
  { jobTerms?: unknown, resumeText?: unknown, supportedTerms?: unknown } = {}): KeywordReport {
  const seen = new Set<string>(), terms: string[] = []
  const list = Array.isArray(jobTerms) ? jobTerms : typeof jobTerms === 'string' ? [jobTerms] : []
  for (const t of list as unknown[]) { const n = normTerm(t); if (n && !seen.has(n)) { seen.add(n); terms.push(t as string); } }
  const hay = normTerm(typeof resumeText === 'string' ? resumeText : '')
  const supList = Array.isArray(supportedTerms) ? (supportedTerms as unknown[]).filter((x): x is string => typeof x === 'string') : [] as string[]
  const sup = new Set(supList.map(normTerm))
  const supHay = normTerm(supList.join(' | '))
  const covered: string[] = [], supportedGap: string[] = [], unsupportedGap: string[] = []
  for (const t of terms) {
    if (contains(hay, t)) covered.push(t)
    else if (sup.has(normTerm(t)) || contains(supHay, t)) supportedGap.push(t)
    else unsupportedGap.push(t)
  }
  const counts = { total: terms.length, covered: covered.length, supportedGap: supportedGap.length, unsupportedGap: unsupportedGap.length }
  const coveragePct = terms.length ? Math.round(1000 * covered.length / terms.length) / 10 : 0
  return { covered, supportedGap, unsupportedGap, counts, coveragePct, ...(terms.length ? {} : { noTerms: true as const }) }
}
