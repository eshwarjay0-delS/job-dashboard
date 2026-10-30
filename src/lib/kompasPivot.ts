// Lens 3D/4D (30 Oct 2026): pivot and perspective moves heard in the 17 NotebookLM-style audio overviews
// (research/podcast-3d-4d-presentation.md). A deterministic pick of two or three moves per answer, at most one analogy,
// rotated by an angle ledger so a follow-up never reuses the angles of the answer before it. Prompt text only: every move
// is first person, resume-grounded, says an unknown as "[ ___ confirm ]" in written prep and as a spoken hedge in a spoken answer (a spoken
// "[ ___ ]" is stripped by the guards into a broken sentence, lens r3), and holds no number. A logistics ask gets nothing.
import { depthFor, lensOf } from "./kompasAudience.ts"
import { withoutLogistics } from "./kompasLogistics.ts"

export type QuestionType = "define" | "tradeoff" | "failure" | "howto" | "behavioural" | "deeper" | "general"
export type Move = { angle: string; dim: "3D" | "4D"; analogy?: boolean; say: string }

export const MOVES: Move[] = [
  { angle: "zoom_out", dim: "3D", say: "zoom out: one sentence on how my part fit the whole system or team, as the resume states it" },
  { angle: "zoom_in", dim: "3D", say: "zoom in: the one mechanism under the hood that I used, named once and said plainly" },
  { angle: "other_seat", dim: "3D", say: "other seat: one sentence from the seat the question touches (user, ops, security or the business): what they needed from my work" },
  { angle: "edge_case", dim: "3D", say: "edge case: the case I had to plan for, then how I handled it, or would; if my sources name none, {BLANK}" },
  { angle: "tradeoff", dim: "3D", say: "trade-off: \"I chose this over that, because ...\", and the cost of my choice in plain words" },
  { angle: "analogy", dim: "3D", analogy: true, say: "analogy: one everyday picture I would use for the idea, said once, then the real term" },
  { angle: "quarter_scope", dim: "3D", say: "quarter of the problem: \"a quarter of my work was ..., the other three-quarters was ...\" as effort or scope, never as a percentage" },
  { angle: "before_after", dim: "4D", say: "before, during, after: how it was before my work, what I did, what changed after; only what the resume holds; else {BLANK}" },
  { angle: "past_lesson", dim: "4D", say: "past lesson: what I learned early and what I do now because of it, only from my sources; else what I would guard against, or {BLANK}" },
  { angle: "now_later", dim: "4D", say: "now and later: what I would do today, and what I would change as it grows" },
  { angle: "over_time", dim: "4D", say: "over time: how it drifts or breaks later, and the one thing I would watch" },
  { angle: "sequence", dim: "4D", say: "sequence: first, then, then; the steps I took or would take, in plain words" },
]
const BY = Object.fromEntries(MOVES.map((m) => [m.angle, m])) as Record<string, Move>

const PREFS: Record<QuestionType, string[]> = {
  define: ["analogy", "zoom_out", "other_seat", "before_after", "edge_case", "zoom_in"],
  tradeoff: ["tradeoff", "other_seat", "now_later", "edge_case", "quarter_scope", "zoom_out"],
  failure: ["before_after", "past_lesson", "over_time", "zoom_in", "other_seat", "edge_case"],
  howto: ["sequence", "edge_case", "quarter_scope", "now_later", "zoom_in", "other_seat"],
  behavioural: ["before_after", "other_seat", "past_lesson", "zoom_out", "quarter_scope", "now_later"],
  deeper: ["zoom_in", "edge_case", "over_time", "quarter_scope", "tradeoff", "zoom_out"],
  general: ["zoom_out", "tradeoff", "before_after", "other_seat", "edge_case", "now_later"],
}

export function questionType(question: string): QuestionType {
  const q = String(question || "").toLowerCase()
  if (/\btell me about a time\b|\bdescribe a (?:time|situation)\b|\bgive (?:me )?an example\b|\bhave you ever\b|\ba time (?:you|when)\b|\bwhen did you\b/.test(q)) return "behavioural"
  if (/\bgo deeper\b|\bdeeper\b|\bunder the hood\b|\bdig (?:in|into)\b|\bdouble.?click\b|\bmore detail\b|\belaborate\b/.test(q)) return "deeper"
  if (/\btrade.?offs?\b|\bversus\b|\bvs\.?\s|\bpros and cons\b|\bwhy (?:would you )?(?:pick|choose|use)\b|\bcompare\b|\bdifference between\b|\bover the\b|\binstead of\b/.test(q)) return "tradeoff"
  if (/\bfail(?:ed|ure|s)?\b|\bbr(?:eak|eaks|oke)\b|\boutage\b|\bwent wrong\b|\bmistake\b|\bwhat happened\b|\b(?:about|during|after) (?:an?|the) (?:incident|outage)\b/.test(q)) return "failure"
  if (/\bhow (?:would|do|did|can|to|should)\b|\bset(?:ting)? up\b|\bwalk me through\b|\bwhat steps\b|\broll(?:ing)? (?:it )?out\b/.test(q)) return "howto"
  if (/\bwhat (?:is|are)\b|\bwhat's\b|\bdefine\b|\bexplain\b|\bmeaning of\b/.test(q)) return "define"
  return "general"
}

/** The ledger holds the angle lists of the last answers in this follow-up chain (newest last). */
export function recordAngles(ledger: string[][], angles: string[]): string[][] {
  return [...(ledger || []), angles].slice(-3)
}

export function pickMoves(question: string, audience: string, ledger: string[][] = []): Move[] {
  const type = questionType(question)
  const simple = depthFor(question) === "simple"
  const n = simple || lensOf(audience) === "hr" ? 2 : 3
  let order = [...PREFS[type], ...MOVES.map((m) => m.angle)]
  if (simple) order = ["analogy", ...order]
  order = order.filter((a, i) => order.indexOf(a) === i)
  const last = (ledger || []).at(-1) || []
  const recent = new Set((ledger || []).flat())
  const pick = (skip: Set<string>) => order.filter((a) => !skip.has(a)).slice(0, n)
  let chosen = pick(recent)
  if (chosen.length < n) chosen = pick(new Set(last))
  const out: Move[] = []
  for (const a of chosen) if (!(BY[a].analogy && out.some((m) => m.analogy))) out.push(BY[a])
  return out
}

export const PIVOT_RULES = (blank: string) => "Woven in, never labelled; first person, the way I would say it in the room. Only my resume and the sources; an unknown is said as " + blank + "; no number the resume does not hold; quarter or three-quarters is effort or scope, never as a percentage; at most one analogy; no logistics."

/** The prompt line, or "" for a logistics ask (owner rule, 29 Oct 2026). A mixed ask is read without its logistics part. */
// Fold 0: the candidate's own rate or pay range, which the shared helper does not reduce on this base.
const PAY_BACKSTOP = /\byour\s+(?:expected\s+|desired\s+|target\s+|current\s+)?(?:hourly\s+|day\s+|daily\s+)?(?:rate|pay(?: range)?|salary|compensation|range)\b/i
export const SPOKEN_BLANK = "\"I would want to confirm that\""
export const WRITTEN_BLANK = "[ ___ confirm ]"
export function pivotBlock(question: string, audience: string, ledger: string[][] = [], mode: "spoken" | "written" = "spoken"): string {
  const blank = mode === "written" ? WRITTEN_BLANK : SPOKEN_BLANK
  const q = String(question || "").trim()
  const kept = q ? withoutLogistics(q).split(/(?<=[?!.])\s+|\s+(?:and|also)\s+(?=(?:are|is|do|does|what|when|where|how|would|will|can|could)\b)/i).filter((c) => !PAY_BACKSTOP.test(c)).join(" ").trim() : q
  if (q && !kept) return ""
  const moves = pickMoves(kept, audience, ledger)
  return `PIVOT (${moves.length === 2 ? "two" : "three"} moves): ${moves.map((m) => `${m.say.split("{BLANK}").join(blank)} (${m.angle})`).join("; then ")}. ${PIVOT_RULES(blank)}`
}
