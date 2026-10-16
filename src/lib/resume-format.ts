/** Preserve existing technical expertise labels while updating values in place. */
export function preserveSkillHeadings(source: { idx: number; text: string }[], edits: { idx: number; text: string }[]) {
  const originals = new Map(source.map(s => [s.idx, s.text]))
  return edits.map(edit => {
    const original = originals.get(edit.idx) || ""
    const heading = original.match(/^([^:\n]{2,70}:)\s*/)?.[1]
    if (!heading) return edit
    const value = edit.text.replace(/^([^:\n]{2,70}:)\s*/, "").trim()
    return { ...edit, text: `${heading} ${value}` }
  })
}
