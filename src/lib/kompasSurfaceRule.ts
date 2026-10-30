// r7 (29 Oct 2026, pending #27): ONE rule for code-first vs spoken no-code answers, per surface.
// Resolves contradiction 9 (master prompt v2 / per-bot AQ #8 "one fenced runnable code block first" vs the journal's
// "answers read and spoken aloud: no code, commands, symbols"). Both hold, each on its own surface:
//   CARD (the on-screen answer card, desktop and web):
//     - a coding ask (asksForCode) starts with exactly one fenced, runnable block, at every mode;
//     - the words after the block are what the user says aloud: first person, speakable, no code symbols outside the fence;
//     - any other ask (including "how would you design X") has no fence: speakable first-person prose only.
//   SPOKEN (anything read aloud: voice playback, the teleprompter's speak line, WhatsApp voice):
//     - never code, commands or symbols; the fence is dropped and the surrounding words are said;
//     - inline code is said as words ("dedupe()" -> "dedupe", "O(n)" -> "O of n").
// Pure helpers. They report; they never rewrite a card answer, so no existing guard is weakened.
import { asksForCode } from "./kompasDissection.ts"
import { blendSpoken } from "./kompasBlend.ts"
import { normalizeAskText } from "./kompasAskText.ts"

export type Surface = "card" | "spoken"
export const SURFACE_RULE = {
  card: "Coding ask: one fenced runnable block first at every mode, then speakable first-person words with no code symbols. Any other ask: speakable prose, no fence.",
  spoken: "Never code, commands or symbols. Drop the fence and say the words around it; say inline code as words.",
} as const

const FENCE = /```[\s\S]*?(?:```|$)/g
// Symbols that a person would have to read out character by character.
const SPOKEN_SYMBOL = /`|=>|==|!=|<=|>=|::|\{|\}|;\s*$|\w\(\)|\$\w|\b\w+\.\w+\(|[<>]\w|#include|\bdef\s+\w+\(|\bSELECT\s+\*/m

export function surfaceFor(raw: unknown): Surface {
  return /^(?:spoken|voice|speak|tts|audio|teleprompter)$/i.test(String(raw || "").trim()) ? "spoken" : "card"
}

export function codeFirstExpected(question: string): boolean {
  try { return asksForCode(normalizeAskText(question)) } catch { return false }
}

/** Words a person would say from a card answer: fences out, inline code said as words. Never throws. */
export function spokenSurface(text: string): string {
  const raw = String(text || "")
  try {
    let t = blendSpoken(raw)
    t = t.replace(FENCE, " ")
      .replace(/`([^`]*)`/g, (_m, inner: string) => inner.replace(/\(\)$/, "").replace(/[_.]/g, " "))
      .replace(/\bO\((\w+(?:\s*\w+)?)\)/g, (_m, n: string) => `O of ${n.replace(/\s+/g, " ")}`)
      .replace(/\b(\w+)\(\)/g, "$1")
      .replace(/\s*=>\s*/g, " then ").replace(/\s*==\s*/g, " equals ").replace(/\s*!=\s*/g, " is not ")
      .replace(/[{};`$#]/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ +([.,!?])/g, "$1")
      .trim()
    return t
  } catch {
    return raw.replace(FENCE, " ").replace(/[{};`$#]/g, " ").replace(/\s+/g, " ").trim()
  }
}

/** Rule breaks for one answer on one surface. Empty list means it follows the rule. */
export function surfaceViolations(question: string, text: string, surface: Surface = "card"): string[] {
  const out: string[] = []
  const t = String(text || "")
  if (!t.trim()) return ["blank answer"]
  const fences = (t.match(/^\s*```/gm) || []).length
  if (surface === "spoken") {
    if (fences) out.push("spoken surface contains a code fence")
    if (SPOKEN_SYMBOL.test(t)) out.push("spoken surface contains code symbols")
    return out
  }
  const code = codeFirstExpected(question)
  if (code) {
    if (!/^\s*```/.test(t)) out.push("coding ask without a fenced block first")
    if (fences > 2) out.push("coding ask with more than one fenced block")
    if (fences % 2 === 1) out.push("unclosed code fence")
  } else if (fences) {
    out.push("fenced block on a non-coding ask")
  }
  const prose = t.replace(FENCE, " ")
  if (SPOKEN_SYMBOL.test(prose)) out.push("code symbols in the words meant to be said")
  return out
}
