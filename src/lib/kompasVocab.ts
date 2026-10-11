// ── Kompas vocabulary, shared ───────────────────────────────────────────────
// Everything both Kompas modes (Flow dictation, Transcribe) feed the
// recogniser: the vocabulary hint, the words the person taught it by
// correcting, and the spoken-language lock.
// All browser-local: nothing here ever leaves the device.

export const KOMPAS_HINT_KEY = "mf_flow_hint"
export const KOMPAS_LEARNED_KEY = "mf_flow_learned"
export const KOMPAS_LANG_KEY = "mf_flow_lang"

const MAX_LEARNED = 40

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, MAX_LEARNED) : []
  } catch {
    return []
  }
}

/** Words the person taught the recogniser by fixing them after dictation. */
export function learnedWords(): string[] {
  return readList(KOMPAS_LEARNED_KEY)
}

/**
 * User correction learning: harvest what the person fixed. Words in `after`
 * that weren't in `before` (the recogniser's telling) are remembered and fed
 * back as vocabulary hints next time — the recogniser gets better at *their*
 * names and terms. Browser-only, most-recent-first, capped.
 */
export function learnFromCorrection(before: string, after: string): void {
  const heard = new Set(before.toLocaleLowerCase().split(/[^\p{L}\p{N}']+/u).filter(w => w.length > 2))
  const fresh = [...new Set(
    after.split(/[^\p{L}\p{N}']+/u).filter(w => w.length > 2 && !heard.has(w.toLocaleLowerCase())),
  )]
  if (!fresh.length) return
  try {
    localStorage.setItem(KOMPAS_LEARNED_KEY, JSON.stringify([...new Set([...fresh, ...learnedWords()])].slice(0, MAX_LEARNED)))
  } catch {
    /* storage blocked: learning simply doesn't persist */
  }
}

/** The vocabulary hint for one recognition request: typed hint + learned words. */
export function buildVocabHint(typedHint: string): string {
  return [typedHint, ...learnedWords()].filter(Boolean).join(", ")
}

/** The spoken-language lock ("en" etc.), or "" for auto-detect. Shared by both modes. */
export function readStoredLang(): string {
  try {
    return localStorage.getItem(KOMPAS_LANG_KEY) || ""
  } catch {
    return ""
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage blocked: the page works without it */
  }
}
