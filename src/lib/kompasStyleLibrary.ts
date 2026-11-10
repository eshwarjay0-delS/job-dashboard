// Curated spoken style. Shape only. Not a transcript and not a fact source.
// Drawn from the interview-caption patterns (SOC mocks and behavioral coaching),
// the 20 dossier openers (So, Then, That, What I, Where), the recovered deep-dive
// connectors, and the LPL gold shape (answer, steps, one example, close).
// Exemplars are short original lines in that shape. They are never copied as content.

import { sheetKey } from "./kompasSheetMatch.ts"

export const STYLE_OPENERS = [
  "So I would",
  "The first thing I'd",
  "I'd start with",
  "Yeah so",
  "What I'd usually do is",
  "The way I look at it",
]

export const STYLE_TRANSITIONS = [
  "And then",
  "From there",
  "After that",
  "That's why",
  "For example",
  "The result",
  "Where it usually breaks is",
  "That matters because",
]

export const STYLE_MOVES = [
  "one everyday picture, then the real term",
  "three or four concrete steps, action before result",
  "one resume example only when it is the same topic",
  "name the check that proves it, then stop",
]

export const STYLE_CLOSES = [
  "The result is the check holds.",
  "That's the part I would keep.",
  "And the result is what the next person can verify.",
  "So the outcome is the one the work actually produced.",
]

export type StyleExemplar = { intent: string; shape: string }

export const STYLE_EXEMPLARS: StyleExemplar[] = [
  { intent: "definition", shape: "Name what it is in the first sentence. Then the job it does. Then the one place it stops." },
  { intent: "definition", shape: "A plain definition, one picture, then the real name, then where it fails." },
  { intent: "definition", shape: "Say the distinction in sentence one. Do not open on a project." },
  { intent: "contrast", shape: "Sentence one is the axis that separates them. Then each side, in the order asked. Close on what flips the choice." },
  { intent: "contrast", shape: "Keep both sides. Do not answer only the last noun." },
  { intent: "contrast", shape: "One sentence on the difference, then where you would use each." },
  { intent: "howto", shape: "The first move, then the next check, then what you do with the result." },
  { intent: "howto", shape: "Three or four steps. Each step is something you would actually do." },
  { intent: "howto", shape: "Start with the action. The last sentence is what that action proves." },
  { intent: "incident", shape: "First the move that shows it is real. Then contain. Then the control you change." },
  { intent: "incident", shape: "No invented ticket, event id, or clock time. The steps are the answer." },
  { intent: "incident", shape: "Detection, scope, contain, recover, and the lesson, in that order, short." },
  { intent: "story", shape: "Use the closest real project. Situation in one line, your action, then the result that project can support." },
  { intent: "story", shape: "If the resume has no such incident, say the approach and name the real project you would borrow the habit from." },
  { intent: "story", shape: "Weight the action and the result. Do not invent a duration or a percentage." },
  { intent: "triage", shape: "Say what you look at first, why that one, and what would make you escalate." },
  { intent: "triage", shape: "Separate a real signal from noise before you name a tool." },
  { intent: "disagreement", shape: "The conflict in sentence one, their constraint, what you offered, and how it ended." },
  { intent: "disagreement", shape: "No invented colleague. The result is the working agreement." },
  { intent: "intro", shape: "Who you are, the work you do now, and why this kind of role, from the resume only." },
  { intent: "intro", shape: "Three or four points. No project inventory." },
  { intent: "value", shape: "The reason in sentence one, tied to the job's work, then the unfinished piece of your own work." },
  { intent: "value", shape: "One hook from the role. Do not list employers." },
  { intent: "direct", shape: "Answer the asked thing first. One example only if it is the same topic. Close on the result." },
  { intent: "direct", shape: "Three or four points. No stock objection from a different question." },
]

const STOCK = /\b(?:MFA alone|The takeaway is|The key point is|Furthermore|Moreover|In conclusion)\b/i

function pick<T>(items: T[], start: number, count: number): T[] {
  const out: T[] = []
  if (!items.length) return out
  for (let i = 0; i < count; i++) out.push(items[(start + i) % items.length])
  return out
}

export function styleIntent(question: string): string {
  const key = sheetKey(question)
  return STYLE_EXEMPLARS.some((e) => e.intent === key.intent) ? key.intent : "direct"
}

/** Two or three shape lines for this ask, plus the opener and close for this telling. Facts in the exemplars are not to be copied. */
export function stylePrompt(question: string, generation = 0): string {
  const n = Math.max(0, generation | 0)
  const intent = styleIntent(question)
  const pool = STYLE_EXEMPLARS.filter((e) => e.intent === intent)
  const exemplars = pick(pool.length ? pool : STYLE_EXEMPLARS.filter((e) => e.intent === "direct"), n, 3)
  const opener = STYLE_OPENERS[n % STYLE_OPENERS.length]
  const transitions = pick(STYLE_TRANSITIONS, n, 3)
  const close = STYLE_CLOSES[n % STYLE_CLOSES.length]
  return [
    "STYLE INSPIRATION ONLY. Do not copy these lines, their wording as facts, or any employer, tool, event id, or number they might suggest. The resume is the only source of those.",
    `This telling opens with: ${opener}`,
    `Transitions to rotate, in this order: ${transitions.join("; ")}. Do not reuse one of them twice.`,
    `Close shape: ${close}`,
    "Shape notes for this question:",
    ...exemplars.map((e) => `- ${e.shape}`),
  ].join("\n")
}

/** The compact rules the sheet and the dossier share. No exemplars that could be copied as a candidate's story. */
export function styleRules(): string {
  return [
    "SPOKEN STYLE LIBRARY: every spoken answer sounds lived-in and stays inside the resume.",
    "Sentence one answers the question. Then one concrete example only when a resume project is the same topic. Three or four points. The action and the result carry the weight. The last sentence is the result.",
    `Openers to rotate, never the same one on the next answer: ${STYLE_OPENERS.join("; ")}.`,
    `Transitions to rotate: ${STYLE_TRANSITIONS.join("; ")}.`,
    `Moves: ${STYLE_MOVES.join("; ")}.`,
    "No fake event id, percentage, duration, or tool that the resume does not list. A number in the question is not a result. Style notes are not content.",
  ].join("\n")
}

export function styleHasStock(text: string): boolean {
  return STOCK.test(text)
}
