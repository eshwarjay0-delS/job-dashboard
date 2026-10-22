const SEARCH_FIELDS = ["title", "location", "firm", "description"] as const
const MAX_SEARCH_TERMS = 8

/**
 * Turn a user job search into safe, distinct terms for PostgREST's raw `or`
 * filter. Keep punctuation that is meaningful in technical roles (C++, C#,
 * .NET) while removing PostgREST filter delimiters and wildcard characters.
 */
export function crawlSearchTerms(input: string): string[] {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of input.trim().split(/\s+/)) {
    const term = raw.replace(/[^a-zA-Z0-9@+#.-]/g, "")
    const key = term.toLowerCase()
    if (!term || !/[a-zA-Z0-9]/.test(term) || seen.has(key)) continue
    seen.add(key)
    terms.push(term)
    if (terms.length === MAX_SEARCH_TERMS) break
  }
  return terms
}

/**
 * Broad category search: any distinct term may match any searchable field.
 * This mirrors `/api/jobs` instead of requiring a literal multi-word phrase.
 */
export function crawlSearchOrFilter(input: string): string | null {
  const terms = crawlSearchTerms(input)
  if (!terms.length) return null
  return terms.flatMap(term => SEARCH_FIELDS.map(field => `${field}.ilike.*${term}*`)).join(",")
}
