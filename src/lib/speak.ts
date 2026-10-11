/**
 * Browser text-to-speech for Kompas and MarketFit: reads text aloud with the
 * best voice the device has. No server, no key, no cost — it uses the built-in
 * speech synthesis every modern browser ships.
 *
 * Text is prepared for the ear first: markdown stripped, abbreviations spoken
 * letter-by-letter so "SIEM" doesn't come out as "seem".
 */

let cachedVoice: SpeechSynthesisVoice | null | undefined

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice
  const voices = window.speechSynthesis.getVoices()
  const prefs: Array<(v: SpeechSynthesisVoice) => boolean> = [
    v => /en[-_]US/i.test(v.lang) && /natural|enhanced|premium|neural/i.test(v.name),
    v => /en[-_]US/i.test(v.lang) && /google/i.test(v.name),
    v => /en[-_]US/i.test(v.lang),
    v => /^en/i.test(v.lang),
  ]
  for (const p of prefs) {
    const found = voices.find(p)
    if (found) { cachedVoice = found; return found }
  }
  cachedVoice = voices[0] || null
  return cachedVoice
}

// Voices load async on some browsers; warm the cache early.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = undefined; pickVoice() }
}

const ABBR: Array<[RegExp, string]> = [
  [/\bAPI\b/g, "A P I"],
  [/\bIAM\b/g, "I A M"],
  [/\bSIEM\b/g, "S I E M"],
  [/\bSOC\b/g, "S O C"],
  [/\bEDR\b/g, "E D R"],
  [/\bXDR\b/g, "X D R"],
  [/\bMFA\b/g, "M F A"],
  [/\bSSO\b/g, "S S O"],
  [/\bVPN\b/g, "V P N"],
  [/\bCI\/CD\b/g, "C I C D"],
  [/\bK8s\b/g, "Kubernetes"],
  [/\be\.g\./g, "for example"],
  [/\bi\.e\./g, "that is"],
]

/** Strip formatting and expand abbreviations so it sounds like a person talking. */
export function prepareForSpeech(text: string): string {
  let t = text
    .replace(/[*_#`~>|]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
  for (const [re, spoken] of ABBR) t = t.replace(re, spoken)
  return t.replace(/\s+/g, " ").trim().slice(0, 2000)
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

/** Read text aloud. Returns false when speech isn't available. */
export function speak(text: string): boolean {
  if (!canSpeak()) return false
  const clean = prepareForSpeech(text)
  if (!clean) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = 1
  u.pitch = 1
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return canSpeak() && window.speechSynthesis.speaking
}
