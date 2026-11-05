// A job-post term the resume has not claimed is still named on the skills line.
// It is not written into an experience bullet. A certification is never added.
// A term already in the document is not written again.

export function skillsFloorTerms(
  scoreKws: readonly string[],
  floor: ReadonlySet<string>,
  already: ReadonlySet<string>,
  isCertification: (term: string) => boolean,
): string[] {
  return scoreKws.filter(k => floor.has(k) && !already.has(k) && !isCertification(k))
}
