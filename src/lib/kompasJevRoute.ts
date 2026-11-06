import { questionDepth } from "./kompasAnswer.ts"
import { SPOKEN_BLANK } from "./kompasPivot.ts"
import { interviewIntent, type ReplyIntent } from "./kompasRelevance.ts"

/**
 * Thin route table in front of Kompas answer generation.
 *
 * Jev here is a decision style: one atomic choice, made in code, before a
 * generation call. It is not a product and not a dependency. Nothing in this
 * module calls TypeSafe, a hosted Jev, or any other model.
 *
 * The rows extend the gates that already exist:
 * - personal logistics is out of lane (the strip in kompasLogistics), so the
 *   broad interviewIntent label "logistics" is not itself a stop
 * - depth is questionDepth; the listener audience is the level already chosen
 * - evidence uses the retrieval coverage gate (matched, plus a named missing part)
 * Experience stories are the class that gate already treats as personal history.
 * A full match goes. A partial match, or a below-gate overlap, is middling: confirm
 * when the answer card can already show the existing confirm line, otherwise go.
 * A miss is not silence. The generator already answers that ask in general voice
 * ("not in your sources"). Stopping it would drop questions the resume can still
 * support when the scorer returns zero, including an incident the resume describes.
 * Other classes go at every band. A definition does not need passage coverage.
 * Out of lane is the personal-logistics strip, and that is the stop.
 */

export type JevAction = "go" | "confirm" | "stop"
export type ConfidenceBand = "high" | "mid" | "low" | "none"
export type JevReason = "out-of-lane" | "evidence-weak" | "confirm" | "clear"

/** Spoken words already used when a claim is not ready to say. Quotes in SPOKEN_BLANK are prompt wrapping. */
export const CONFIRM_LINE = SPOKEN_BLANK.replace(/^"|"$/g, "")

export type RetrievalConfidenceInput = {
  matched?: boolean
  missing?: string[]
  all?: Array<{ score?: number }>
} | null | undefined

export type JevRouteRow = {
  outOfLane?: boolean
  questionClass: ReplyIntent | "*"
  confidence: ConfidenceBand | "*"
  confirmSurface?: boolean
  action: JevAction
  reason: JevReason
}

/**
 * First match wins. Out of lane stops before confidence matters.
 * Experience-story is the class whose existing evidence gate is passage coverage.
 * High and a total miss both clear the call: the miss still generates.
 * Mid confirms only when the caller already has a place to show the confirm line.
 * Without that surface, mid goes, so this table does not invent a new card.
 * No scored sources ("none") does not fail a gate that was never measured.
 * Evidence that is too weak to answer at all is the out-of-lane row: personal
 * logistics never becomes a generation, at any class and any band.
 */
export const JEV_ROUTE_TABLE: readonly JevRouteRow[] = [
  { outOfLane: true, questionClass: "*", confidence: "*", action: "stop", reason: "out-of-lane" },
  { questionClass: "experience-story", confidence: "mid", confirmSurface: true, action: "confirm", reason: "confirm" },
  { questionClass: "experience-story", confidence: "mid", confirmSurface: false, action: "go", reason: "clear" },
  { questionClass: "experience-story", confidence: "low", action: "go", reason: "clear" },
  { questionClass: "experience-story", confidence: "high", action: "go", reason: "clear" },
  { questionClass: "experience-story", confidence: "none", action: "go", reason: "clear" },
  { questionClass: "*", confidence: "*", action: "go", reason: "clear" },
]

export type JevRoute = {
  action: JevAction
  questionClass: ReplyIntent
  confidence: ConfidenceBand
  depth: number
  audience: string
  reason: JevReason
  callModel: boolean
  confirmLine: string
}

export type RouteAnswerInput = {
  question?: string
  questionClass?: ReplyIntent
  confidence?: ConfidenceBand
  retrieval?: RetrievalConfidenceInput
  /** True when the live answer card can already show CONFIRM_LINE. */
  confirmSurface?: boolean
  /** True only after the personal-logistics strip removed the whole ask. */
  outOfLane?: boolean
  /** Listener already chosen for this turn. Depth still comes from the question. */
  audience?: string
}

/** Band from the coverage gate retrievePassages already computed. A fallback closest line is not confidence. */
export function retrievalConfidence(retrieval: RetrievalConfidenceInput): ConfidenceBand {
  const all = retrieval && Array.isArray(retrieval.all) ? retrieval.all : []
  if (!all.length) return "none"
  const missing = Array.isArray(retrieval?.missing) && retrieval.missing.length > 0
  if (retrieval?.matched && !missing) return "high"
  if (retrieval?.matched && missing) return "mid"
  if (all.some((p) => typeof p?.score === "number" && p.score > 0)) return "mid"
  return "low"
}

function rowMatches(row: JevRouteRow, outOfLane: boolean, questionClass: ReplyIntent, confidence: ConfidenceBand, confirmSurface: boolean): boolean {
  if ((row.outOfLane === true) !== outOfLane) return false
  if (row.questionClass !== "*" && row.questionClass !== questionClass) return false
  if (row.confidence !== "*" && row.confidence !== confidence) return false
  if (row.confirmSurface !== undefined && row.confirmSurface !== confirmSurface) return false
  return true
}

/** One row, one action. Depth and audience are recorded; they do not spend a call. */
export function routeAnswer(input: RouteAnswerInput = {}): JevRoute {
  const question = String(input.question || "")
  const questionClass = input.questionClass || interviewIntent(question)
  const confidence = input.confidence || retrievalConfidence(input.retrieval)
  const confirmSurface = input.confirmSurface === true
  const outOfLane = input.outOfLane === true
  const row = JEV_ROUTE_TABLE.find((candidate) => rowMatches(candidate, outOfLane, questionClass, confidence, confirmSurface))
    || JEV_ROUTE_TABLE[JEV_ROUTE_TABLE.length - 1]
  return {
    action: row.action,
    questionClass,
    confidence,
    depth: questionDepth(question),
    audience: String(input.audience || "engineer"),
    reason: row.reason,
    callModel: row.action === "go",
    confirmLine: CONFIRM_LINE,
  }
}
