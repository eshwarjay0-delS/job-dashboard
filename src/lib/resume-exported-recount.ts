// Real-metrics recount (Nov 4): the numbers a caption reports must be measured
// on the exported file's bytes, never on in-memory tailored text alone. The
// export is the exact buffer that gets stored and sent, so a term the export
// dropped is a term the file does not have, whatever the tailor counted.
// Pure: the caller supplies the set of JD terms the exported file actually
// contains (matched with the same coveredJdKeywords matcher the tailor
// uses), so this file needs no imports beyond the shared percent helper.
import { coveragePercent } from "./resume-quality.ts"

export type ExportedRecountInput = {
  scoreKws: string[]
  attainableKws: string[]
  exportedCovered: ReadonlySet<string> | readonly string[]
  placed: readonly string[]
  writer: readonly string[]
  summary: readonly string[]
}

export type ExportedRecount = {
  coverage: number
  supportedCoverage: number
  matched: number
  missing: string[]
  placed: string[]
  writer: string[]
  summary: string[]
}

const norm = (s: string) => String(s).toLowerCase().trim()

export function recountExported(input: ExportedRecountInput): ExportedRecount {
  const covered = new Set([...input.exportedCovered].map(norm))
  const matchedKws = input.scoreKws.filter(k => covered.has(norm(k)))
  const attainableMatched = input.attainableKws.filter(k => covered.has(norm(k)))
  // Placed terms are JD spellings of score terms, so they match modulo case.
  // A placed term with no score-term form is dropped: never claim what the
  // file was not verified to contain.
  const keep = (list: readonly string[]) => list.filter(t => covered.has(norm(t)))
  return {
    coverage: input.scoreKws.length ? coveragePercent(matchedKws.length / input.scoreKws.length) : 0,
    supportedCoverage: input.attainableKws.length ? coveragePercent(attainableMatched.length / input.attainableKws.length) : 0,
    matched: matchedKws.length,
    missing: input.scoreKws.filter(k => !covered.has(norm(k))),
    placed: keep(input.placed),
    writer: keep(input.writer),
    summary: keep(input.summary),
  }
}
