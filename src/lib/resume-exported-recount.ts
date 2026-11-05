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
  // Gemini enrichment visibility (Nov 4): the two pre-generation passes
  // suggest terms beyond the JD's own; the caller supplies which of those
  // the exported file actually contains, so the gap report can show
  // suggested vs placed vs gate-blocked instead of hiding the passes.
  enrichmentSuggested?: readonly string[]
  enrichmentCovered?: ReadonlySet<string> | readonly string[]
}

export type ExportedRecount = {
  coverage: number
  supportedCoverage: number
  matched: number
  missing: string[]
  placed: string[]
  writer: string[]
  summary: string[]
  // Present only when enrichmentSuggested was supplied.
  enrichment?: { placed: string[]; blocked: string[] }
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
  // Enrichment split: a suggested term is placed only when the exported
  // file itself contains it; the rest were blocked by the evidence gate,
  // never silently dropped. Case-insensitive, like the coverage match.
  const enrichment = input.enrichmentSuggested === undefined ? undefined : (() => {
    const eCovered = new Set([...(input.enrichmentCovered ?? [])].map(norm))
    return {
      placed: input.enrichmentSuggested.filter(t => eCovered.has(norm(t))),
      blocked: input.enrichmentSuggested.filter(t => !eCovered.has(norm(t))),
    }
  })()
  return {
    coverage: input.scoreKws.length ? coveragePercent(matchedKws.length / input.scoreKws.length) : 0,
    supportedCoverage: input.attainableKws.length ? coveragePercent(attainableMatched.length / input.attainableKws.length) : 0,
    matched: matchedKws.length,
    missing: input.scoreKws.filter(k => !covered.has(norm(k))),
    placed: keep(input.placed),
    writer: keep(input.writer),
    summary: keep(input.summary),
    ...(enrichment ? { enrichment } : {}),
  }
}
