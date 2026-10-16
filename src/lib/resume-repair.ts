/** Commit section repairs independently so one bad role cannot erase another's gains. */
export async function acceptImprovingRepairs<P extends { cov: number; afterKw: Set<string> }, E>(
  initial: P, edits: E[], apply: (current: P, edit: E) => Promise<P>, quality: (pass: P) => number,
): Promise<P> {
  let current = initial
  for (const edit of edits) {
    const next = await apply(current, edit)
    if ([...current.afterKw].some(term => !next.afterKw.has(term))) continue
    if (next.cov > current.cov || quality(next) > quality(current) + .005) current = next
  }
  return current
}

export function mergeIndexedEdits<T extends { idx: number }>(old: T[], fresh: T[]): T[] {
  const byIdx = new Map(old.map(edit => [edit.idx, edit]))
  for (const edit of fresh) byIdx.set(edit.idx, edit)
  return [...byIdx.values()]
}
