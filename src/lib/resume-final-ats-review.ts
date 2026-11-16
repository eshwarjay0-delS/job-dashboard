/**
 * Final exported-DOCX Gemini ATS review contract.
 * Gemini's score and suggested terms are diagnostic only. Candidate evidence remains
 * the selected source resume plus explicit candidate confirmations.
 */
export type FinalAtsReviewStatus = "ok" | "invalid_response" | "skipped_no_key" | "unavailable" | "skipped_incomplete" | "skipped_time_budget"

export interface FinalAtsReview {
  status: FinalAtsReviewStatus
  score: number | null
  missing: string[]
  weak: string[]
}

export interface FinalAtsReviewPromptInput {
  jd: string
  docxText: string
  terms: readonly string[]
}

const norm = (value: unknown): string => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9+#]+/g, " ")
  .replace(/\\s+/g, " ")
  .trim()

const unique = (items: readonly string[]): string[] => {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = norm(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The first instruction is the exact owner-approved phrase. */
export function buildFinalAtsReviewPrompt(input: FinalAtsReviewPromptInput): string {
  return [
    "Give me ATS score",
    "",
    "JOB DESCRIPTION:",
    String(input.jd || ""),
    "",
    "JD TARGET TERMS (report gaps using only these exact terms):",
    unique(input.terms).join(", "),
    "",
    "FINAL EXPORTED DOCX TEXT (review the actual exported document, not a draft):",
    String(input.docxText || ""),
    "",
    "Return ONLY JSON in this exact shape:",
    '{"score": 0, "missing": [], "weak": []}',
    "Score the final document against the job description. List missing terms and terms present only weakly or without meaningful context.",
    "Use only exact terms from the supplied JD TARGET TERMS list. Do not add synonyms, new requirements, or inferred qualifications.",
    "Do not rewrite the resume, invent experience, infer employer assignments, or treat the JD as candidate evidence. The score and lists are diagnostic only.",
  ].join("\\n")
}

/** Parse the score and discard every suggestion that is not a canonical JD term. */
export function parseFinalAtsReview(raw: string, allowedTerms: readonly string[]): FinalAtsReview {
  try {
    const fence = String.fromCharCode(96).repeat(3)
    let source = String(raw || "").trim()
    if (source.startsWith(fence)) source = source.slice(fence.length).replace(/^[a-zA-Z]*\\s*/, "")
    if (source.endsWith(fence)) source = source.slice(0, -fence.length).trim()
    const first = source.indexOf("{")
    const last = source.lastIndexOf("}")
    if (first < 0 || last <= first) throw new Error("missing_json_object")
    const parsed = JSON.parse(source.slice(first, last + 1)) as { score?: unknown; missing?: unknown; weak?: unknown }
    const scoreInput = parsed.score
    const scoreText = typeof scoreInput === "string" ? scoreInput.replace(/%/g, "").trim() : ""
    const scoreValue = typeof scoreInput === "number"
      ? scoreInput
      : typeof scoreInput === "string" && scoreText.length > 0
        ? Number(scoreText)
        : Number.NaN
    if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100) throw new Error("invalid_score")
    const canonical = new Map<string, string>()
    for (const term of unique(allowedTerms)) canonical.set(norm(term), term)
    const collect = (value: unknown): string[] => {
      if (!Array.isArray(value)) return []
      const out: string[] = []
      for (const candidate of value) {
        if (typeof candidate !== "string") continue
        const term = canonical.get(norm(candidate))
        if (term) out.push(term)
      }
      return unique(out).slice(0, 40)
    }
    return { status: "ok", score: Math.round(scoreValue * 10) / 10, missing: collect(parsed.missing), weak: collect(parsed.weak) }
  } catch {
    return { status: "invalid_response", score: null, missing: [], weak: [] }
  }
}

/** Only source/confirmation-backed terms may enter a correction pass. */
export function supportedFinalAtsGaps(
  review: FinalAtsReview,
  supportedTerms: readonly string[],
  alreadyCoveredTerms: ReadonlySet<string> | readonly string[],
): string[] {
  if (review.status !== "ok") return []
  const supported = new Set(supportedTerms.map(norm).filter(Boolean))
  const coveredValues = Array.isArray(alreadyCoveredTerms) ? alreadyCoveredTerms : [...alreadyCoveredTerms]
  const covered = new Set(coveredValues.map(norm).filter(Boolean))
  const missing = new Set(review.missing.map(norm))
  const weak = new Set(review.weak.map(norm))
  return unique(supportedTerms.filter(term => {
    const key = norm(term)
    return supported.has(key) && (weak.has(key) || (missing.has(key) && !covered.has(key)))
  }))
}

/** Unsupported gaps are disclosed, never written as candidate experience. */
export function unsupportedFinalAtsGaps(review: FinalAtsReview, supportedTerms: readonly string[]): string[] {
  if (review.status !== "ok") return []
  const supported = new Set(supportedTerms.map(norm).filter(Boolean))
  return unique([...review.missing, ...review.weak].filter(term => !supported.has(norm(term))))
}
