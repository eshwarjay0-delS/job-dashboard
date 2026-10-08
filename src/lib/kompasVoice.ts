/**
 * Telling voices apart in a transcript, and knowing which one is the person's own.
 *
 * The owner, 2026-10-08: "ask the person to say something with some text on the screen to speak and record that audio. And
 * recognize the user as you in the transcribing output ... recognizing multiple voices. Mainly distinguishing them ... Just
 * like a fingerprint help them recognize their voice."
 *
 * What this is: arithmetic on sound, run in the person's own browser. From a stretch of speech it works out a short list of
 * numbers that describes how the voice sounds (the shape of its spectrum, how much that shape moves, and how high the voice
 * is pitched): a voice print. Two stretches by one person give prints that are close; two people give prints further apart.
 *
 * THE MISTAKES THIS FILE PREVENTS:
 *
 *  1. CLAIMING TO KNOW. This is not a fingerprint. Two similar voices, a cold, a different microphone or a noisy room move a
 *     print about as much as a different person does. So every label it gives is a best guess that the person can change
 *     with one tap, a label the person set is never overridden, and a stretch too short to judge takes the label of the
 *     line before it and is not guessed at. The numbers in SCALE and SAME were measured (see where they are defined) on a
 *     small set of voices; they are not a promise.
 *  2. KEEPING OTHER PEOPLE'S VOICES. A voice print is a description of a person's body. The person's own is kept, on their
 *     own device, because they asked for it. Everybody else's is worked out while a transcript is open, used to tell
 *     "Speaker 1" from "Speaker 2" inside that transcript, and never stored: nothing in this file writes anything.
 *  3. SENDING A VOICE ANYWHERE. Nothing here makes a request. The recording is turned into a print on the device.
 *
 * No browser API and no clock: it takes samples and returns numbers, so the tests and the measurements run it in plain Node.
 */

export const VOICE_RATE = 16000
const FRAME = 400          // 25 ms
const HOP = 160            // 10 ms
const FFT_SIZE = 512
const MELS = 24
const CEPS = 12            // cepstral coefficients 1..12; the 0th is loudness, which says how close the microphone is
/** Fewer voiced frames than this (about half a second of speech) and a stretch is too short to judge. */
export const MIN_VOICED_FRAMES = 45

/** mean of 12 coefficients, their spread, the middle pitch (natural log of Hz) and the spread of pitch. NaN where unknown. */
export type Voiceprint = { v: 1; dims: number[]; frames: number }

// ─────────────────────────────────────────── the spectrum ────────────────────────────────────────────

const WINDOW = (() => { const w = new Float64Array(FRAME); for (let i = 0; i < FRAME; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)); return w })()

// Twenty-four triangles spaced the way hearing is, from 80 Hz to 7,600 Hz, as [first bin, weights] per triangle.
const FILTERS = (() => {
  const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700), hz = (m: number) => 700 * (10 ** (m / 2595) - 1)
  const low = mel(80), high = mel(7600)
  const edges = Array.from({ length: MELS + 2 }, (_, i) => (hz(low + ((high - low) * i) / (MELS + 1)) * FFT_SIZE) / VOICE_RATE)
  return Array.from({ length: MELS }, (_, m) => {
    const [a, b, c] = [edges[m], edges[m + 1], edges[m + 2]]
    const first = Math.ceil(a), last = Math.floor(c), weights: number[] = []
    for (let k = first; k <= last; k++) weights.push(k <= b ? (k - a) / (b - a) : (c - k) / (c - b))
    return { first, weights }
  })
})()

const COSINES = (() => Array.from({ length: CEPS }, (_, k) => Float64Array.from({ length: MELS }, (_, m) => Math.cos((Math.PI * (k + 1) * (m + 0.5)) / MELS))))()

/** In place, radix two. `re` and `im` are FFT_SIZE long. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const r = re[i]; re[i] = re[j]; re[j] = r; const m = im[i]; im[i] = im[j]; im[j] = m }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = (-2 * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const cos = Math.cos(step * k), sin = Math.sin(step * k)
        const a = start + k, b = a + half
        const tr = re[b] * cos - im[b] * sin, ti = re[b] * sin + im[b] * cos
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
      }
    }
  }
}

/** The pitch of 40 ms of sound starting at `at`, in Hz, or 0 when it has none (a hiss, a click, silence). */
function pitchAt(samples: Float32Array, at: number): number {
  const span = 640, least = 40, most = 266                                 // 400 Hz down to 60 Hz
  if (at + span + most > samples.length) return 0
  let mean = 0
  for (let i = 0; i < span + most; i++) mean += samples[at + i]
  mean /= span + most
  let power = 0
  for (let i = 0; i < span; i++) { const x = samples[at + i] - mean; power += x * x }
  if (power <= 1e-9) return 0
  const alike = new Float64Array(most + 1)
  let best = 0
  for (let lag = least; lag <= most; lag++) {
    let sum = 0, other = 0
    for (let i = 0; i < span; i++) { const x = samples[at + i] - mean, y = samples[at + i + lag] - mean; sum += x * y; other += y * y }
    alike[lag] = sum / Math.sqrt(power * other + 1e-12)
    if (alike[lag] > best) best = alike[lag]
  }
  if (best < 0.5) return 0
  // A wave that repeats every 5 ms also repeats every 10 and every 15, nearly as well. Taking the best match would call a
  // voice an octave lower every so often; the SHORTEST repeat that is nearly as good as the best is the pitch.
  for (let lag = least + 1; lag < most; lag++) {
    if (alike[lag] >= 0.88 * best && alike[lag] >= alike[lag - 1] && alike[lag] >= alike[lag + 1]) return VOICE_RATE / lag
  }
  return 0
}

const middle = (sorted: number[], at: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(at * (sorted.length - 1))))]

/**
 * The voice print of a stretch of sound (one channel, 16,000 samples a second), or null when there is too little speech in
 * it to say anything. Silence is left out: only frames within about 26 dB of the loudest count.
 */
export function voiceprintOf(samples: Float32Array): Voiceprint | null {
  const count = Math.floor((samples.length - FRAME) / HOP) + 1
  if (count < MIN_VOICED_FRAMES) return null
  const loud = new Float64Array(count)
  let peak = -Infinity
  for (let f = 0; f < count; f++) {
    let e = 0
    for (let i = 0; i < FRAME; i++) { const x = samples[f * HOP + i]; e += x * x }
    loud[f] = Math.log(e / FRAME + 1e-12)
    if (loud[f] > peak) peak = loud[f]
  }
  const floor = Math.max(peak - 6, -16)                                      // 6 nepers of power is 26 dB; -16 is silence itself
  const re = new Float64Array(FFT_SIZE), im = new Float64Array(FFT_SIZE), bands = new Float64Array(MELS)
  const sum = new Float64Array(CEPS), squares = new Float64Array(CEPS), pitches: number[] = []
  let voiced = 0
  for (let f = 0; f < count; f++) {
    if (loud[f] < floor) continue
    re.fill(0); im.fill(0)
    // Pre-emphasis, so the quiet upper part of a voice is not drowned by the loud lower part.
    for (let i = 0; i < FRAME; i++) { const at = f * HOP + i; re[i] = (samples[at] - (at > 0 ? 0.97 * samples[at - 1] : 0)) * WINDOW[i] }
    fft(re, im)
    for (let m = 0; m < MELS; m++) {
      const { first, weights } = FILTERS[m]
      let e = 0
      for (let k = 0; k < weights.length; k++) { const bin = first + k; e += (re[bin] * re[bin] + im[bin] * im[bin]) * weights[k] }
      bands[m] = Math.log(e + 1e-10)
    }
    for (let k = 0; k < CEPS; k++) {
      let c = 0
      const cos = COSINES[k]
      for (let m = 0; m < MELS; m++) c += bands[m] * cos[m]
      sum[k] += c; squares[k] += c * c
    }
    // Pitch costs far more than the rest, and a voice's pitch does not change every hundredth of a second: every fourth frame.
    if (voiced % 4 === 0) { const hz = pitchAt(samples, f * HOP); if (hz > 0) pitches.push(Math.log(hz)) }
    voiced++
  }
  if (voiced < MIN_VOICED_FRAMES) return null
  const dims: number[] = []
  for (let k = 0; k < CEPS; k++) dims.push(sum[k] / voiced)
  for (let k = 0; k < CEPS; k++) dims.push(Math.sqrt(Math.max(0, squares[k] / voiced - (sum[k] / voiced) ** 2)))
  if (pitches.length >= 6) { pitches.sort((a, b) => a - b); dims.push(middle(pitches, 0.5), middle(pitches, 0.75) - middle(pitches, 0.25)) }
  else dims.push(NaN, NaN)
  return { v: 1, dims, frames: voiced }
}

// ─────────────────────────────────────────── how far apart two prints are ────────────────────────────────────────────

/**
 * How much each number in a print moves between two stretches of speech by the SAME voice. Dividing by it makes a distance
 * of about 1 mean "as different as one person usually is from themselves".
 *
 * MEASURED, 2026-10-08, on the recordings in hand: four synthetic voices (two men, two women, two speech synthesisers),
 * 120 sentences each of about 7 to 8 seconds, half of them used to set these numbers and the other half to test them.
 * Four voices from speech synthesisers are not a room of people: a synthetic voice differs from itself far less than a
 * person does. These are a first setting, to be corrected by what real use shows; scripts/measure-voice.mjs prints them
 * again from any folder of recordings.
 */
export const SCALE: readonly number[] = [
  3.70, 1.69, 1.83, 1.46, 1.01, 0.87, 0.64, 0.69, 0.56, 0.47, 0.44, 0.44,
  2.62, 0.74, 1.00, 1.12, 0.52, 0.43, 0.40, 0.38, 0.37, 0.29, 0.27, 0.24,
  0.025, 0.034,
]
/**
 * Two prints closer than this are taken to be one voice. On the setting half, 95 in 100 pairs by one voice were closer than
 * 2.87 and 95 in 100 pairs by two voices were further than 4.90; the cut that got the fewest pairs wrong was 4.10. Set a
 * little under that, because the voices that will really be confused (two men in one room) are closer than these four are.
 */
export const SAME = 3.6

/** How far apart two prints are, in units of "how much one voice differs from itself". Numbers either lacks are left out. */
export function voiceDistance(a: Voiceprint, b: Voiceprint): number {
  let total = 0, used = 0
  for (let i = 0; i < SCALE.length; i++) {
    const x = a.dims[i], y = b.dims[i]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const d = (x - y) / SCALE[i]
    total += d * d; used++
  }
  return used ? Math.sqrt(total / used) * Math.sqrt(2) : Infinity
}

/** The print of several stretches taken as one voice, each counting for as much speech as it holds. */
export function blend(prints: readonly Voiceprint[]): Voiceprint | null {
  const real = prints.filter(p => p && p.frames > 0)
  if (!real.length) return null
  const dims = SCALE.map((_, i) => {
    let sum = 0, weight = 0
    for (const p of real) { if (Number.isFinite(p.dims[i])) { sum += p.dims[i] * p.frames; weight += p.frames } }
    return weight ? sum / weight : NaN
  })
  return { v: 1, dims, frames: real.reduce((n, p) => n + p.frames, 0) }
}

// ─────────────────────────────────────────── who said each line ────────────────────────────────────────────

export const YOU = "you"
export const MAX_OTHERS = 6
export type Said = { id: string; print: Voiceprint | null; set?: string }

/**
 * A speaker for every line of a transcript, in the order the lines were said: "you", or "s1", "s2", and so on.
 *
 *  - A line whose speaker the person set (`set`) keeps it, and that line's voice then counts as that speaker's: a
 *    correction teaches the rest of the transcript.
 *  - A line close to the person's own print is "you". With no print of their own there is no "you": only s1, s2...
 *  - Any other line joins the speaker it is closest to when that is close enough, and otherwise starts a new one.
 *  - A line too short to have a print takes the speaker of the line before it. It is not guessed at.
 */
export function speakersOf(lines: readonly Said[], mine: Voiceprint | null): Record<string, string> {
  const voices = new Map<string, Voiceprint[]>()
  const centre = (id: string) => blend(voices.get(id) ?? [])
  const learn = (id: string, print: Voiceprint | null) => { if (print) voices.set(id, [...(voices.get(id) ?? []), print]) }
  // What the person told us comes first, so it can pull later AND earlier lines to the right speaker.
  for (const line of lines) if (line.set) learn(line.set, line.print)
  const out: Record<string, string> = {}
  let before = mine ? YOU : "s1", others = [...voices.keys()].filter(id => id !== YOU).length
  for (const line of lines) {
    if (line.set) { out[line.id] = line.set; before = line.set; continue }
    if (!line.print) { out[line.id] = before; continue }
    let best = "", bestFar = Infinity
    const mineNow = blend([...(mine ? [mine] : []), ...(voices.get(YOU) ?? [])])
    if (mineNow) { bestFar = voiceDistance(line.print, mineNow); best = YOU }
    for (const id of voices.keys()) {
      if (id === YOU) continue
      const c = centre(id)
      if (!c) continue
      const far = voiceDistance(line.print, c)
      if (far < bestFar) { bestFar = far; best = id }
    }
    if (!best || bestFar > SAME) {
      if (others < MAX_OTHERS) { others++; best = nextOther(voices) }
      else if (!best || best === YOU) best = nearestOther(line.print, voices) ?? "s1"
    }
    if (best !== YOU || !line.set) learn(best, line.print)
    out[line.id] = best
    before = best
  }
  return out
}

function nextOther(voices: Map<string, Voiceprint[]>): string {
  for (let n = 1; ; n++) if (!voices.has(`s${n}`)) return `s${n}`
}
function nearestOther(print: Voiceprint, voices: Map<string, Voiceprint[]>): string | null {
  let best: string | null = null, bestFar = Infinity
  for (const [id, prints] of voices) {
    if (id === YOU) continue
    const c = blend(prints)
    if (!c) continue
    const far = voiceDistance(print, c)
    if (far < bestFar) { bestFar = far; best = id }
  }
  return best
}

/** A kept print, checked: the right shape, and numbers where numbers must be. Anything else is no print. */
export function readVoiceprint(value: unknown): Voiceprint | null {
  const p = value as Voiceprint | null
  if (!p || p.v !== 1 || !Array.isArray(p.dims) || p.dims.length !== SCALE.length || typeof p.frames !== "number" || !(p.frames > 0)) return null
  const dims = p.dims.map(n => (typeof n === "number" && Number.isFinite(n) ? n : NaN))
  if (dims.slice(0, 2 * CEPS).some(n => !Number.isFinite(n))) return null
  return { v: 1, dims, frames: Math.round(p.frames) }
}
