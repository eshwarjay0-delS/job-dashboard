/**
 * Screenshot frame classification and answer routing (2026-11-10, session 6).
 *
 * After the vision step extracts text, classify the frame as a problem
 * statement, on-screen code, a diagram, or no interview content, then route
 * the answer. The current audio question, when there is one, is always
 * combined with the frame. Cheap and deterministic; not an OCR engine.
 */

export const NO_QUESTION_ON_SCREEN = "No question on screen"

export type ScreenFrameKind = "problem" | "code" | "diagram" | "no-content"

export type ScreenFrameRoute = {
  kind: ScreenFrameKind
  display: string
  answerQuestion: string
  generate: boolean
  combinedAudio: boolean
}

const CODE_MARK = /\b(?:def\s+\w+\s*\(|function\s+\w+\s*\(|return\s+|for\s*\(|for\s+\w+\s+in\b|while\s*\(|#include|std::|vector\s*<|nullptr|cout\s*<<|public\s+|private\s+|class\s+\w+|const\s+\w+\s*=|let\s+\w+|var\s+\w+|int\s+\w+|void\s+\w+|i\+\+|j\+\+|if\s*\([^)]+\)\s*\{)\b/m
const CODE_LINE = /^\s{0,8}(?:def |function |return |for |while |if |else |elif |#include|public |private |const |int |void |auto |class )|\w+\s*\([^;]*\)\s*\{|;\s*$/m
const DIAGRAM_MARK = /[+\-|]{4,}|[┌┐└┘┬┴┼─│]|→|->\s|←|^\s*[01]\s+[01]\s+[01]\s+[01]\b|\bblocks?\s*:\s*\[.*\]/im
const PROBLEM_MARK = /\b(?:given\b|example\s*\d|constraints?:|input:|output:|write (?:a |the )?function|return the|sample input|reqs\s*=|requirements\s*=|blocks\s*=\s*\[)/i
const CHROME_ONLY = /^(?:greeting|hello|hi there|youtube|subscribe|faces?|blank(?: document)?|no text|two faces\b|a blank)\b/i

function words(text: string): string[] {
  return String(text || "").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean)
}

function compact(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim()
}

function codeLineCount(text: string): number {
  return String(text || "").split(/\n/).filter((line) => CODE_LINE.test(line) || /[{};]\s*$/.test(line)).length
}

export function classifyScreenFrame(opts: {
  text?: string
  kind?: string
}): ScreenFrameKind {
  const text = String(opts.text || "").trim()
  const declared = String(opts.kind || "").toLowerCase()
  if (!text) return "no-content"
  const askLead = /^(?:explain|describe|implement|write|find|return|what|which|how|why|solve|give|walk)\b/i.test(text) || /[?]/.test(text)
  if (CHROME_ONLY.test(text) && !CODE_MARK.test(text) && !PROBLEM_MARK.test(text) && !DIAGRAM_MARK.test(text) && !askLead) return "no-content"

  const codeLines = codeLineCount(text)
  const hasCode = CODE_MARK.test(text) || codeLines >= 3
  const hasProblem = PROBLEM_MARK.test(text)
  const hasDiagram = declared === "diagram" || DIAGRAM_MARK.test(text)

  if (hasProblem && !/\b(?:def\s+\w+\s*\(|function\s+\w+\s*\()/m.test(text)) {
    // Sample-input object literals are not "code on screen".
    return "problem"
  }
  if (hasCode && codeLines >= 2 && !(hasProblem && codeLines < 3)) return "code"
  if (hasCode) return "code"
  if (hasProblem) return "problem"
  if (hasDiagram) return "diagram"
  if (declared === "coding" && words(text).length >= 8) return "problem"
  // Remaining extracted text — including a short question stub from the
  // vision step — is a problem / written question, not a greeting.
  return "problem"
}

function briefFor(kind: ScreenFrameKind): string {
  if (kind === "problem") return "The screen shows a problem statement. Give an approach, working code, and time and space complexity."
  if (kind === "code") return "The screen shows code. Transcribe the key visible lines, then review, fix, or continue that code. Do not ignore the on-screen code in favor of a generic explanation."
  if (kind === "diagram") return "The screen shows a diagram. Explain the diagram and answer the ask."
  return NO_QUESTION_ON_SCREEN
}

function titleFor(kind: ScreenFrameKind, screenText: string, audio: string): string {
  if (kind === "no-content") return audio ? compact(audio) : NO_QUESTION_ON_SCREEN
  const first = compact(screenText).slice(0, 180)
  return first || (audio ? compact(audio) : "On screen")
}

/** Build the question the answer engine should see, combining frame + audio. */
export function routeScreenFrame(opts: {
  text?: string
  kind?: string
  audioQuestion?: string
}): ScreenFrameRoute {
  const screen = String(opts.text || "").trim()
  const audio = compact(opts.audioQuestion || "")
  const kind = classifyScreenFrame({ text: screen, kind: opts.kind })

  if (kind === "no-content") {
    if (!audio) {
      return { kind, display: NO_QUESTION_ON_SCREEN, answerQuestion: NO_QUESTION_ON_SCREEN, generate: false, combinedAudio: false }
    }
    const answerQuestion = `${NO_QUESTION_ON_SCREEN}. There is no interview question in the screenshot. Answer the audio question only:\n${audio}`
    return { kind, display: audio, answerQuestion, generate: true, combinedAudio: true }
  }

  const brief = briefFor(kind)
  const parts = [brief, "On screen:\n" + screen]
  if (audio) parts.push("Audio question:\n" + audio + "\nAddress the audio question using the screen as context.")
  return {
    kind,
    display: titleFor(kind, screen, audio),
    answerQuestion: parts.join("\n\n"),
    generate: true,
    combinedAudio: !!audio,
  }
}
