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

/** Pause markers the humanize pass writes; speak() turns them into real silence.
 *  [beat]   — dramatic pause before a key insight (~900ms). The listener leans in.
 *  [breath] — natural breath between ideas (~450ms). The listener catches up.
 *  Visible in text so a human speaker sees them too. */
const PAUSES: Array<[RegExp, number]> = [
  [/\[beat\]/gi, 900],
  [/\[breath\]/gi, 450],
]

/** Strip formatting and expand abbreviations so it sounds like a person talking. */
export function prepareForSpeech(text: string): string {
  let t = text
    .replace(/[*_#`~>|]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
  for (const [re, spoken] of ABBR) t = t.replace(re, spoken)
  // Keep pause markers out of the spoken words; speak() handles them as silence.
  for (const [re] of PAUSES) t = t.replace(re, " ")
  return t.replace(/\s+/g, " ").trim().slice(0, 2000)
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

/** Read text aloud. Pause markers become real silence between utterances. Returns false when speech isn't available. */
export function speak(text: string): boolean {
  if (!canSpeak()) return false
  // Split on pause markers so each becomes a timed silence.
  const segments: { text: string; pauseAfter: number }[] = []
  let remaining = text
  const markerRe = /(\[beat\]|\[breath\])/gi
  let last = 0, m: RegExpExecArray | null
  const pauses: { index: number; ms: number }[] = []
  while ((m = markerRe.exec(text)) !== null) {
    pauses.push({ index: m.index, ms: /beat/i.test(m[1]) ? 900 : 450 })
  }
  if (!pauses.length) {
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
  let cursor = 0
  for (const p of pauses) {
    const chunk = text.slice(cursor, p.index)
    if (prepareForSpeech(chunk)) segments.push({ text: chunk, pauseAfter: p.ms })
    cursor = p.index + (text.slice(p.index).match(/^\[(beat|breath)\]/i)?.[0].length || 0)
  }
  const tail = text.slice(cursor)
  if (prepareForSpeech(tail)) segments.push({ text: tail, pauseAfter: 0 })
  if (!segments.length) return false

  window.speechSynthesis.cancel()
  const voice = pickVoice()
  let i = 0
  const playNext = () => {
    if (i >= segments.length) return
    const seg = segments[i++]
    const u = new SpeechSynthesisUtterance(prepareForSpeech(seg.text))
    if (voice) u.voice = voice
    u.rate = 1
    u.pitch = 1
    u.onend = () => {
      if (seg.pauseAfter > 0) setTimeout(playNext, seg.pauseAfter)
      else playNext()
    }
    u.onerror = () => playNext()
    window.speechSynthesis.speak(u)
  }
  playNext()
  return true
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return canSpeak() && window.speechSynthesis.speaking
}
