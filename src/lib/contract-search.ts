export type ContractSearchFields = {
  title?: string | null
  company?: string | null
  location?: string | null
  body?: string | null
  tags?: readonly string[]
}

/**
 * Match the user's contract-board query against any meaningful term in the
 * listing. This mirrors /api/jobs category-search behavior: multi-word presets
 * are broad OR searches, not literal phrases or AND-of-every-word filters.
 *
 * Splitting only on whitespace deliberately preserves technical tokens such as
 * C++, C#, and .NET.
 */
export function matchesContractSearch(query: string, fields: ContractSearchFields): boolean {
  const terms = String(query ?? "").trim().toLowerCase().split(/\\s+/).filter(Boolean)
  if (!terms.length) return true

  const haystack = [
    fields.title,
    fields.company,
    fields.location,
    fields.body,
    ...(fields.tags ?? []),
  ].filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase()

  return terms.some(term => haystack.includes(term))
}
