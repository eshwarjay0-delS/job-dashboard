// Hard length and style contract for the three Kompas levels.
// The prompt and the token cap both come from this table. One post-check
// extends or trims a finished answer so it lands in the band.

export type LevelName = "engineer" | "architect" | "director"

export type LevelContract = {
  level: LevelName
  quick: boolean
  min: number
  max: number
  target: number
  maxTokens: number
  prompt: string
}

const FULL: Record<LevelName, { min: number; max: number; target: number; maxTokens: number }> = {
  architect: { min: 700, max: 1000, target: 900, maxTokens: 4096 },
  director: { min: 300, max: 450, target: 370, maxTokens: 2200 },
  engineer: { min: 250, max: 400, target: 320, maxTokens: 1800 },
}

const QUICK: Record<LevelName, { min: number; max: number; target: number; maxTokens: number }> = {
  architect: { min: 220, max: 320, target: 260, maxTokens: 1400 },
  director: { min: 90, max: 130, target: 110, maxTokens: 800 },
  engineer: { min: 70, max: 120, target: 90, maxTokens: 700 },
}

const JARGON_LIST = /(?:\b[A-Z]{2,}\b\s*,\s*){3,}\b[A-Z]{2,}\b|\b(?:SAST|DAST|SCA|XDR|EDR|SIEM|SOAR)(?:\s*,\s*(?:SAST|DAST|SCA|XDR|EDR|SIEM|SOAR)){2,}/i

export function wordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

export function hasJargonList(text: string): boolean {
  return JARGON_LIST.test(String(text || ""))
}

export function hasPlainReasoning(text: string): boolean {
  return /in plain terms|the reason I|here is how I think|what that means is/i.test(String(text || ""))
}

export function isQuickQuestion(question: string): boolean {
  const t = String(question || "").replace(/\s+/g, " ").trim()
  if (/\b(?:tell me about yourself|tell me about a time|walk me through|how would you|describe a time|design|rolled out|scenario)\b/i.test(t)) return false
  if (/\b(?:what does|stands? for|yes or no|do you know|what is a |what is an )\b/i.test(t) && t.split(/\s+/).length < 16) return true
  return t.split(/\s+/).length <= 8 && /\?\s*$/.test(t)
}

function asLevel(level: string): LevelName {
  if (level === "architect" || level === "director") return level
  return "engineer"
}

function promptFor(level: LevelName, row: { min: number; max: number; target: number }, quick: boolean): string {
  const band = `Speak about ${row.target} words, and stay between ${row.min} and ${row.max}. No headings, no labels, and no bullet titles in the words he will say aloud.`
  if (level === "architect") {
    return `LEVEL CONTRACT — ARCHITECT. This is the most comprehensive answer, about 90 to 120 percent of a full answer. ${band} Cover the design reasoning, the components, the trade-offs, how the pieces integrate, how the data flows, the risks, how it was rolled out, and how it was verified. Use spoken paragraphs. ${quick ? "This is a short factual question, so scale that full answer down, but stay clearly longer than a director answer." : "A behavioral or scenario answer stays in this long band."}`
  }
  if (level === "director") {
    return `LEVEL CONTRACT — DIRECTOR. Cover about half of a full answer and get straight to the point. ${band} Use plain words a person in business operations understands. Speak with ownership and responsibility. Name the decision and the outcome. Do not list deep tool jargon.`
  }
  return `LEVEL CONTRACT — TECHNICAL HR AND ENGINEER. ${band} Be very clear for a listener who is not deep in the tools. Sound like a strong sales engineer: conversational, connecting, and explaining the thought process in plain language. Translate any jargon. Include a sentence that starts with In plain terms.`
}

export function levelContract(level: string, question: string): LevelContract {
  const name = asLevel(level)
  const quick = isQuickQuestion(question)
  const row = (quick ? QUICK : FULL)[name]
  return { level: name, quick, ...row, prompt: promptFor(name, row, quick) }
}

const ARCHITECT_LINES = [
  "The way I would build it starts from the job the system has to do, then the parts that have to exist, and only then the path the data takes between them.",
  "Each component has one job, and I say what I would trade away if I made that part bigger or smaller.",
  "Integration is the promise between those parts, so I walk the handoff, what is checked, and what happens when the handoff fails.",
  "The data flow is the story of where a fact enters, who may change it, and where it is read later.",
  "The risks I would name are the ones that stop the operation, not a catalog of product names.",
  "Rollout is a small first slice, a watch on the live path, and a way back if the slice is wrong.",
  "Verification is the check I run before I call it done, and the check I leave running after it is live.",
  "I keep that account in spoken paragraphs, with the reason for each choice sitting next to the choice itself.",
]

const DIRECTOR_LINES = [
  "I own the decision, and I say it in words anyone in the operation can use.",
  "The outcome I am responsible for is that the work keeps moving and the risk we accepted is named.",
  "I do not walk the build. I say what I chose, why that choice protects the business, and what I will answer for if it fails.",
  "The point is the result, said once, with the responsibility sitting on me.",
]

const ENGINEER_LINES = [
  "In plain terms, the reason I work it this way is that the person listening should be able to follow the thought without a manual.",
  "What that means is I start from the need, I say the choice in everyday words, and I say how I would know it worked.",
  "I translate the specialist word as I use it, and I keep the story connected from one step to the next.",
]

function trimWords(text: string, max: number): string {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(" ")
  const sliced = words.slice(0, max).join(" ")
  const last = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("!"), sliced.lastIndexOf("?"))
  if (last >= Math.floor(sliced.length * 0.6)) return sliced.slice(0, last + 1).trim()
  return sliced.replace(/[^\w)]+$/g, "") + "."
}

function poolFor(level: LevelName): string[] {
  if (level === "architect") return ARCHITECT_LINES
  if (level === "director") return DIRECTOR_LINES
  return ENGINEER_LINES
}

/** One pass. Short text is extended to the target. Long text is cut to the max. */
export function fitLevelAnswer(text: string, contract: LevelContract): string {
  let out = String(text || "").replace(/\s+/g, " ").trim()
  if (contract.level === "director") out = out.replace(JARGON_LIST, "the tools").replace(/\s+/g, " ").trim()
  if (contract.level === "engineer" && !hasPlainReasoning(out)) {
    out = `${ENGINEER_LINES[0]} ${out}`.trim()
  }
  if (wordCount(out) > contract.max) out = trimWords(out, contract.max)
  if (wordCount(out) < contract.min) {
    const pool = poolFor(contract.level)
    let i = 0
    while (wordCount(out) < contract.target && i < pool.length * 12) {
      out = `${out} ${pool[i % pool.length]}`.replace(/\s+/g, " ").trim()
      i += 1
    }
  }
  if (wordCount(out) > contract.max) out = trimWords(out, contract.max)
  return out
}
