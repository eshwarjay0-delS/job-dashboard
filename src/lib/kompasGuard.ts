/**
 * Hallucination guard for Kompas speech-to-text. Pure functions, no keys, no
 * network — unit-tested in scripts/tests/kompas-pipeline.test.mjs.
 *
 * Whisper's signature failure modes, in the order this guard checks them:
 *  1. Exact loops — "Thank you for watching. Thank you for watching." Nobody
 *     ever *means* the same 4+ words twice in a row; an exact immediate repeat
 *     of a 4–12 word window collapses to one telling. (This was v1.)
 *  2. Fuzzy loops — the same failure with a stutter or a dropped word in the
 *     repeat ("the the the meeting", "thank you for watching / thank you for
 *     watchin"). A repeated window within word-edit-distance 1 collapses too.
 *  3. Known artifacts — Whisper invents subtitle boilerplate on silence, noise
 *     and music. When the ENTIRE utterance is one of these, it is removed.
 *     (Embedded in longer real speech it is left alone: stripping there risks
 *     deleting something the person actually said.)
 *
 * Shorter repeats ("no, no") are left alone: those can be genuine emphasis.
 * The guard never rewrites words, only removes what it is confident nobody said.
 */

export interface GuardResult {
  text: string
  /** What was removed, for transparency ("loop:thank you for watching", "artifact:thanks for watching"). */
  removed: string[]
}

const flat = (s: string): string =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()

/** Subtitle boilerplate Whisper invents on silence / noise / music. */
const ARTIFACTS = new Set([
  "thank you for watching",
  "thanks for watching",
  "thank you very much for watching",
  "thanks very much for watching",
  "thank you for listening",
  "thanks for listening",
  "please subscribe",
  "dont forget to subscribe",
  "like and subscribe",
  "subtitles by",
  "subtitle by",
  "captioned by",
  "transcribed by",
  "transcription by",
  "amara org",
  "www amara org",
])

/**
 * The flattened text is pure subtitle boilerplate when it is exactly one
 * artifact, or a composition of them ("subtitles by amara org"). Returns the
 * matched artifacts, or null when real words remain.
 */
function matchArtifact(text: string): string | null {
  let f = flat(text)
  if (!f) return null
  if (ARTIFACTS.has(f)) return f
  const used: string[] = []
  const ordered = [...ARTIFACTS].sort((a, b) => b.length - a.length)
  let prev = ""
  while (f && f !== prev) {
    prev = f
    for (const a of ordered) {
      const idx = f.indexOf(a)
      if (idx === -1) continue
      const before = idx === 0 || f[idx - 1] === " "
      const after = idx + a.length === f.length || f[idx + a.length] === " "
      if (!before || !after) continue
      used.push(a)
      f = (f.slice(0, idx) + " " + f.slice(idx + a.length)).replace(/\s+/g, " ").trim()
      break
    }
  }
  return f === "" && used.length ? used.join("+") : null
}

/** Word-level edit distance between two word arrays. */
function wordDistance(a: string[], b: string[]): number {
  const r = a.length, c = b.length
  const dp: number[][] = Array.from({ length: r + 1 }, (_, i) =>
    Array.from({ length: c + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= r; i++) {
    for (let j = 1; j <= c; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[r][c]
}

/**
 * Collapse exact and fuzzy immediate repeats. Returns the collapsed text,
 * whether anything collapsed, and a description of the first collapse found.
 */
function collapseLoops(words: string[]): { words: string[]; collapsed: boolean; kind: string } {
  const out: string[] = []
  let collapsed = false
  let kind = ""
  let i = 0
  while (i < words.length) {
    let done = false
    for (let w = 12; w >= 4; w--) {
      if (i + w * 2 > words.length) continue
      const a = words.slice(i, i + w)
      const b = words.slice(i + w, i + w * 2)
      const lower = (xs: string[]) => xs.join(" ").toLowerCase()
      const dist = wordDistance(a.map(x => x.toLowerCase()), b.map(x => x.toLowerCase()))
      if (dist > 1) continue
      // Count how many times the (fuzzy) window repeats.
      let reps = 2
      while (i + w * (reps + 1) <= words.length &&
        wordDistance(a.map(x => x.toLowerCase()), words.slice(i + w * reps, i + w * (reps + 1)).map(x => x.toLowerCase())) <= 1) reps++
      out.push(...a)
      i += w * reps
      collapsed = true
      if (!kind) kind = dist === 0 ? `loop:${lower(a)}` : `fuzzy-loop:${lower(a)}`
      done = true
      break
    }
    if (!done) { out.push(words[i]); i++ }
  }
  return { words: out, collapsed, kind }
}

export function guardHallucinations(raw: string): GuardResult {
  const removed: string[] = []
  const text = raw.trim()
  if (!text) return { text: "", removed }
  // The whole-text artifact check applies at any length: a short utterance is
  // where Whisper invents boilerplate most.
  const artifact = matchArtifact(text)
  if (artifact) return { text: "", removed: [`artifact:${artifact}`] }
  if (text.split(/\s+/).length < 8) return { text, removed }
  const words = text.split(/\s+/)
  const { words: collapsed, collapsed: did, kind } = collapseLoops(words)
  if (did) removed.push(kind)
  return { text: collapsed.join(" "), removed }
}

/** Backwards-compatible shape for the v1 call site: was anything removed? */
export function deLooped(result: GuardResult): boolean {
  return result.removed.length > 0
}
