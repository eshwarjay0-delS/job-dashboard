/**
 * Conservative Auto Answer policy (2026-11-10, phase 2).
 *
 * Auto stays off until the user turns it on. A trigger requires a question
 * cue, 1.4 s of quiet on the Them (tab/computer audio) channel, and a
 * confirm step (local, with an optional LLM confirm in the live path).
 * Written for Kompas; not a copy of a third-party client.
 */

export const AUTO_THEM_SILENCE_MS = 1_400
export const AUTO_DEFAULT_ON = false

const Q_CUE = /\?\s*$|^(so,? )?(what|how|why|when|where|which|who|whose|can|could|would|will|should|do|does|did|are|is|was|were|have|has|tell|walk|describe|explain|give|share|talk|imagine|suppose|let's|lets)\b|\b(tell me|walk me|how would you|what would you|why did you|can you|could you|would you|have you|do you|are you|what is|what are|your experience|about yourself|introduce)\b/i
const GREETING = /^(?:hi|hello|hey|thanks|thank you|good (?:morning|afternoon|evening)|yeah|yes|okay|ok|right|mm-?hmm|uh-?huh)\b[.!?]*$/i
const FILLER_ONLY = /^(?:um|uh|so|like|you know|i mean)[,.\s]*$/i

export function hasQuestionCue(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t || t.split(/\s+/).length < 3) return false
  return Q_CUE.test(t)
}

export function themQuietLongEnough(lastThemVoiceAt: number | null | undefined, now: number, needMs = AUTO_THEM_SILENCE_MS): boolean {
  if (lastThemVoiceAt == null || !Number.isFinite(Number(lastThemVoiceAt))) return false
  return now - Number(lastThemVoiceAt) >= needMs
}

export type AutoConfirm = { ok: boolean; reason: string }

/** Local confirm used as a pre-filter and as the offline stand-in for an LLM confirm. */
export function confirmAutoQuestion(text: string, context: readonly string[] = []): AutoConfirm {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return { ok: false, reason: "empty" }
  if (GREETING.test(t) || FILLER_ONLY.test(t)) return { ok: false, reason: "noise" }
  if (!hasQuestionCue(t)) return { ok: false, reason: "no-cue" }
  // A short unfinished stem ("How would you", "Tell me about") is not ready.
  if (!/[?]$/.test(t) && t.split(/\s+/).length <= 4) return { ok: false, reason: "unfinished" }
  // A trailing conjunction or article is not finished.
  if (/\b(?:and|or|but|if|when|because|the|a|an|to|of|for|with)\s*$/i.test(t) && !/[?]$/.test(t)) {
    return { ok: false, reason: "unfinished" }
  }
  // Pure commentary / rhetorical discussion without addressing the candidate.
  if (/\b(in this video|we're going to|on the channel|subscribe)\b/i.test(t) && !/\byou\b/i.test(t) && !/[?]$/.test(t)) {
    return { ok: false, reason: "commentary" }
  }
  void context
  return { ok: true, reason: "cue" }
}

export function shouldAutoAnswer(opts: {
  autoOn?: boolean
  cue?: boolean
  themQuietMs?: number
  confirmed?: boolean
}): { fire: boolean; reason: string } {
  if (!opts.autoOn) return { fire: false, reason: "off" }
  if (!opts.cue) return { fire: false, reason: "no-cue" }
  if (!Number.isFinite(Number(opts.themQuietMs)) || Number(opts.themQuietMs) < AUTO_THEM_SILENCE_MS) {
    return { fire: false, reason: "not-quiet" }
  }
  if (!opts.confirmed) return { fire: false, reason: "unconfirmed" }
  return { fire: true, reason: "ready" }
}
