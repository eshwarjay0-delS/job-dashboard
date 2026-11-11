/**
 * Conservative Auto Answer policy (2026-11-10, phase 2 + session-5 gates).
 *
 * Auto stays off until the user turns it on. A trigger requires a question
 * cue, trailing Them silence, a semantic completeness check (intent-to-complete),
 * and a confirm step. Mid-question breaths and stutter-rephrases wait for the
 * final constraint. Written for Kompas; not a copy of a third-party client.
 */

import { isIncompleteAsk, resolveStutterRephrase } from "./kompasStutterRephrase.ts"

export const AUTO_THEM_SILENCE_MS = 1_400
export const INTENT_COMPLETE_SILENCE_MS = 1_500
export const MANUAL_INCOMPLETE_WAIT_MS = 1_500
export const MAX_AUTO_DELAY_MS = 3_000
export const AUTO_DEFAULT_ON = false

const Q_CUE = /\?\s*$|^(so,? )?(what|how|why|when|where|which|who|whose|can|could|would|will|should|do|does|did|are|is|was|were|have|has|tell|walk|describe|explain|give|share|talk|imagine|suppose|let's|lets|define)\b|\b(tell me|walk me|how would you|what would you|why did you|can you|could you|would you|have you|do you|are you|what is|what are|your experience|about yourself|introduce|imagine (?:you|that|this)|define like)\b/i
const GREETING = /^(?:hi|hello|hey|thanks|thank you|good (?:morning|afternoon|evening)|yeah|yes|okay|ok|right|mm-?hmm|uh-?huh)\b[.!?]*$/i
const FILLER_ONLY = /^(?:um|uh|so|like|you know|i mean)[,.\s]*$/i
const CONVERSATIONAL = /^(?:that'?s (?:really )?cool|that must feel|i'?m sure that must|pretty (?:um )?meaningful)\b/i

const GARBAGE_TOK = /^(?:la+|de|da|el|le|un|une|et|en|les|des|du|al|na+|hmm+|mm+|ah+|uh+|oh+|ya+|yo+|huh|tsk|pfft|nah|ooh|woo|tee|dee|doo|ba+|pa+)$/i
const MICRO_OK = new Set("i me my we us it ok no hi hey yo so to do if or be am is".split(" "))

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

/**
 * Drop short low-confidence non-word You-channel fragments ("La la", "De la").
 * Optional confidence: a short, cue-less line under 0.45 is also dropped.
 */
export function isMicGarbage(text: string, opts?: { confidence?: number }): boolean {
  const raw = String(text || "").trim()
  if (!raw) return true
  const ws = raw.toLowerCase().replace(/[^a-z0-9'\s]+/g, " ").split(/\s+/).filter(Boolean)
  if (!ws.length) return true
  if (ws.length <= 4 && ws.every((w) => GARBAGE_TOK.test(w))) return true
  if (ws.length <= 3 && ws.every((w) => GARBAGE_TOK.test(w) || (w.length <= 2 && !MICRO_OK.has(w)))) return true
  const conf = opts && typeof opts.confidence === "number" ? opts.confidence : undefined
  if (conf != null && conf < 0.45 && ws.length <= 4 && !hasQuestionCue(raw) && !/\?/.test(raw)) return true
  return false
}

export function isQuestionComplete(text: string): boolean {
  const stutter = resolveStutterRephrase(text)
  if (stutter.incomplete) return false
  const t = stutter.text || String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return false
  if (/\b(?:and|or|but|if|when|because|the|a|an|to|of|for|with)\s*$/i.test(t) && !/[?]$/.test(t)) return false
  return !isIncompleteAsk(t)
}

export type IntentGate = { ready: boolean; reason: string; waitMs: number }

/**
 * Intent-to-complete: ~1.5 s of trailing interviewer silence plus a semantic
 * completeness check, so a mid-question breath does not fire. Wait is capped
 * so Auto / a short manual hold stay within MAX_AUTO_DELAY_MS (3 s).
 */
export function intentToComplete(opts: {
  text?: string
  themQuietMs?: number
  silenceMs?: number
}): IntentGate {
  const need = Math.max(INTENT_COMPLETE_SILENCE_MS, Number(opts.silenceMs) || INTENT_COMPLETE_SILENCE_MS)
  const quiet = Number(opts.themQuietMs)
  const stutter = resolveStutterRephrase(String(opts.text || ""))
  const text = stutter.text || String(opts.text || "")
  if (!Number.isFinite(quiet) || quiet < need) {
    const wait = Math.min(MAX_AUTO_DELAY_MS, Math.max(0, need - (Number.isFinite(quiet) ? quiet : 0)))
    return { ready: false, reason: "not-quiet", waitMs: wait }
  }
  if (stutter.incomplete || !isQuestionComplete(text)) {
    const wait = Math.min(MAX_AUTO_DELAY_MS, MANUAL_INCOMPLETE_WAIT_MS)
    return { ready: false, reason: "incomplete", waitMs: wait }
  }
  return { ready: true, reason: "complete", waitMs: 0 }
}

/** Local confirm used as a pre-filter and as the offline stand-in for an LLM confirm. */
export function confirmAutoQuestion(text: string, context: readonly string[] = []): AutoConfirm {
  const stutter = resolveStutterRephrase(text)
  const t = String((stutter.text || text || "")).replace(/\s+/g, " ").trim()
  if (!t) return { ok: false, reason: "empty" }
  if (GREETING.test(t) || FILLER_ONLY.test(t)) return { ok: false, reason: "noise" }
  if (CONVERSATIONAL.test(t) && !hasQuestionCue(t)) return { ok: false, reason: "confirmation" }
  if (!hasQuestionCue(t)) return { ok: false, reason: "no-cue" }
  if (stutter.incomplete || !isQuestionComplete(t)) return { ok: false, reason: "unfinished" }
  if (!/[?]$/.test(t) && t.split(/\s+/).length <= 4) return { ok: false, reason: "unfinished" }
  if (/\b(in this video|we're going to|on the channel|subscribe)\b/i.test(t) && !/\byou\b/i.test(t) && !/[?]$/.test(t)) {
    return { ok: false, reason: "commentary" }
  }
  void context
  return { ok: true, reason: stutter.rephrased ? "rephrased" : "cue" }
}

export function shouldAutoAnswer(opts: {
  autoOn?: boolean
  cue?: boolean
  themQuietMs?: number
  confirmed?: boolean
  text?: string
}): { fire: boolean; reason: string } {
  if (!opts.autoOn) return { fire: false, reason: "off" }
  if (!opts.cue) return { fire: false, reason: "no-cue" }
  if (opts.text != null && String(opts.text).trim()) {
    const gate = intentToComplete({ text: opts.text, themQuietMs: opts.themQuietMs })
    if (!gate.ready) return { fire: false, reason: gate.reason }
  } else if (!Number.isFinite(Number(opts.themQuietMs)) || Number(opts.themQuietMs) < AUTO_THEM_SILENCE_MS) {
    return { fire: false, reason: "not-quiet" }
  }
  if (!opts.confirmed) return { fire: false, reason: "unconfirmed" }
  return { fire: true, reason: "ready" }
}

export type ReplaySegment = { start: number; end: number; text: string; who: "Them" | "You" }
export type ReplayQuestion = { id: string | number; start: number; end: number; text: string }
export type ReplayFire = { at: number; text: string }

const INTERVIEWER_KEEP = /\b(?:i guess one question|i'?m (?:very )?curious|i see\b|i apologize|excuse me|gotcha|so i'?m curious|do you|have you|would you|how would you|how has|how do you|tell me|what kind|what do you|what is that|are you|if you were|tying this back|define like|imagine you)\b/i

export function looksLikeCandidateNarrative(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return false
  if (INTERVIEWER_KEEP.test(t) && /\b(?:you|your|question|curious|apologize|excuse|gotcha|define|imagine)\b/i.test(t)) return false
  if (/\?/.test(t) && /\b(?:you|your)\b/i.test(t)) return false
  const i = (t.toLowerCase().match(/\bi(?:'m|'ve|'d|'ll)?\b/g) || []).length
  const you = (t.toLowerCase().match(/\byou(?:r|re|'re|'ve)?\b/g) || []).length
  if (i >= 2 && i > you) return true
  if (/^(?:oh yeah|yeah sure|yeah so|um so i|so i\b|i went|i did|i do |i think|i would|i rarely|i teach|i'?d like|i feel|i have|i was|i'?m a )/i.test(t)) return true
  return false
}

export function replayAutoAnswer(opts: {
  segments: readonly ReplaySegment[]
  autoOn?: boolean
  silenceMs?: number
}): { fires: ReplayFire[] } {
  const silenceSec = (Number(opts.silenceMs) || INTENT_COMPLETE_SILENCE_MS) / 1000
  const autoOn = opts.autoOn !== false
  const labeled = Array.from(opts.segments || [])
  const events: Array<{ t: number; kind: "start" | "end"; s: ReplaySegment }> = []
  for (const s of labeled) {
    events.push({ t: s.start, kind: "start", s })
    events.push({ t: s.end, kind: "end", s })
  }
  events.sort((a, b) => a.t - b.t || (a.kind === "end" ? -1 : 1))

  let pending = ""
  let lastFireQ = ""
  let lastThemEnd: number | null = null
  let armedUntil: number | null = null
  const fires: ReplayFire[] = []

  const considerThem = (text: string) => !looksLikeCandidateNarrative(text)

  const tryFire = (now: number) => {
    if (lastThemEnd == null) return
    const quiet = (now - lastThemEnd) * 1000
    const resolved = resolveStutterRephrase(pending)
    const text = resolved.text || pending
    const cue = hasQuestionCue(text)
    const confirmed = confirmAutoQuestion(text).ok
    const { fire } = shouldAutoAnswer({ autoOn, cue, themQuietMs: quiet, confirmed, text })
    if (!fire) return
    if (text.trim() === lastFireQ.trim()) return
    lastFireQ = text
    fires.push({ at: now, text })
    pending = ""
  }

  for (const ev of events) {
    if (armedUntil != null && ev.t >= armedUntil - 1e-9) {
      tryFire(armedUntil)
      armedUntil = null
    }
    if (ev.kind === "end" && ev.s.who === "Them" && considerThem(ev.s.text)) {
      pending = (pending + " " + ev.s.text).replace(/\s+/g, " ").trim()
      lastThemEnd = ev.s.end
      armedUntil = ev.s.end + silenceSec
    }
    if (ev.kind === "start" && ev.s.who === "Them" && considerThem(ev.s.text)) {
      if (armedUntil != null && ev.t < armedUntil) armedUntil = null
    }
  }
  if (armedUntil != null) tryFire(armedUntil)
  return { fires }
}

const SCORE_STOP = new Set("the a an and or but if like you know i guess uh um so of to for with in on at as is was were be been being this that those these it your my their do does did have has had would could can will just maybe even about from into not don no yes yeah well then than they them we our who whom whose what when where which why how very really pretty kind kinda sort something anything everything there here also still only more most some any all each such same own onto upon too".split(/\s+/))

function contentWords(t: string): string[] {
  return String(t || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !SCORE_STOP.has(w))
}

export function overlapScore(a: string, b: string): number {
  const A = new Set(contentWords(a)), B = new Set(contentWords(b))
  if (!A.size || !B.size) return 0
  let n = 0
  for (const w of A) if (B.has(w)) n++
  return n / Math.min(A.size, B.size)
}

export function scoreAutoReplay(
  fires: readonly ReplayFire[],
  questions: readonly ReplayQuestion[],
  overlapMin = 0.35,
): {
  tp: number
  fp: number
  missed: Array<string | number>
  recall: number
  precision: number
  delays: number[]
  medianDelay: number | null
  hits: Array<{ id: string | number; score: number; delay: number } | { fp: true; text: string }>
} {
  const used = new Set<string | number>()
  let tp = 0, fp = 0
  const delays: number[] = []
  const hits: Array<{ id: string | number; score: number; delay: number } | { fp: true; text: string }> = []
  for (const f of fires) {
    let best: ReplayQuestion | null = null
    let bestSc = -1
    for (const q of questions) {
      if (used.has(q.id)) continue
      if (f.at < q.start + 0.4) continue
      const sc = overlapScore(f.text, q.text)
      // When one pending turn holds two asks, the later one wins (same rule as stutter/rephrase).
      if (sc > bestSc + 0.05 || (sc >= overlapMin && best && sc + 0.05 >= bestSc && q.start > best.start)) {
        bestSc = sc
        best = q
      }
    }
    if (best && bestSc >= overlapMin) {
      used.add(best.id)
      tp++
      const d = f.at - best.end
      delays.push(d)
      hits.push({ id: best.id, score: bestSc, delay: d })
    } else {
      fp++
      hits.push({ fp: true, text: f.text.slice(0, 200) })
    }
  }
  delays.sort((a, b) => a - b)
  const medianDelay = delays.length ? delays[Math.floor((delays.length - 1) / 2)] : null
  return {
    tp,
    fp,
    missed: questions.filter((q) => !used.has(q.id)).map((q) => q.id),
    recall: questions.length ? tp / questions.length : 0,
    precision: fires.length ? tp / fires.length : 0,
    delays,
    medianDelay,
    hits,
  }
}
