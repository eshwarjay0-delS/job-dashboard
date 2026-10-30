/**
 * Restore the candidate's original wording for any AI edit that introduces a
 * JD-only qualification. The caller decides what is unsupported from the
 * original resume and explicit candidate confirmations, never from the JD.
 *
 * Reverting an entire paragraph is intentional: deleting a product name from
 * an invented work claim would leave the invented work claim behind.
 * Original paragraphs are not edited, and the final rendered DOCX must still
 * pass all normal completeness and evidence checks.
 */
export function removeUnsupportedRewrites<E extends {
  headline?: { title?: string; tagline?: string }
  summary?: string
  skills?: { text: string }[]
  bullets?: { text: string }[]
  extras?: { text: string }[]
  added?: { text: string }[]
}>(edits: E, unsupported: (text: string) => boolean): { edits: E; removed: number } {
  let removed = 0
  const keep = <T extends { text: string }>(rows: T[] | undefined): T[] | undefined =>
    rows?.filter(row => {
      if (!unsupported(row.text || "")) return true
      removed++
      return false
    })
  const restore = (text: string | undefined): string | undefined => {
    if (!text || !unsupported(text)) return text
    removed++
    return ""
  }
  const cleaned = {
    ...edits,
    headline: edits.headline ? {
      ...edits.headline,
      title: restore(edits.headline.title),
      tagline: restore(edits.headline.tagline),
    } : undefined,
    summary: restore(edits.summary),
    skills: keep(edits.skills),
    bullets: keep(edits.bullets),
    extras: keep(edits.extras),
    added: keep(edits.added),
  } as E
  return { edits: removed ? cleaned : edits, removed }
}
