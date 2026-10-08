// Turning a chosen recording into parts the server will take.
//
// A request may carry 4 MB, and a recording is often far larger, and a compressed file cannot be cut at an arbitrary byte. So
// the file is decoded in the browser, mixed to one channel at 16,000 samples a second (all a speech recogniser uses), and cut
// into parts of 25 seconds, each written as a small plain WAV file of about 800 KB.
//
// The mistake this file prevents is a browser tab that dies on a long file: decoding holds the whole recording in memory
// uncompressed, so a file is refused by size before decoding and by length after, in words the page can show.

export const RATE = 16000
export const PART_SECONDS = 25
export const MAX_FILE_BYTES = 80 * 1024 * 1024
export const MAX_MINUTES = 45

export type Decoded = { samples: Float32Array; seconds: number }
export type DecodeProblem = "too-big" | "too-long" | "cannot-read" | "no-support"

export async function decode(file: File): Promise<{ ok: true; audio: Decoded } | { ok: false; because: DecodeProblem }> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, because: "too-big" }
  if (typeof AudioContext === "undefined" || typeof OfflineAudioContext === "undefined") return { ok: false, because: "no-support" }
  let context: AudioContext | null = null
  try {
    context = new AudioContext()
    const heard = await context.decodeAudioData(await file.arrayBuffer())
    if (heard.duration > MAX_MINUTES * 60) return { ok: false, because: "too-long" }
    if (!(heard.duration > 0)) return { ok: false, because: "cannot-read" }
    // One channel at the recogniser's rate. An offline context with one output channel mixes the channels down itself.
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(heard.duration * RATE)), RATE)
    const source = offline.createBufferSource()
    source.buffer = heard
    source.connect(offline.destination)
    source.start()
    const mono = await offline.startRendering()
    return { ok: true, audio: { samples: mono.getChannelData(0), seconds: heard.duration } }
  } catch {
    return { ok: false, because: "cannot-read" }
  } finally { void context?.close().catch(() => {}) }
}

/** Where each part starts and ends, in samples and in milliseconds. */
export function partsOf(total: number): { from: number; to: number; startMs: number; endMs: number }[] {
  const size = PART_SECONDS * RATE
  const out: { from: number; to: number; startMs: number; endMs: number }[] = []
  for (let from = 0; from < total; from += size) {
    const to = Math.min(total, from + size)
    out.push({ from, to, startMs: Math.round((from / RATE) * 1000), endMs: Math.round((to / RATE) * 1000) })
  }
  return out
}

/** One part as a 16-bit WAV file. */
export function wavPart(samples: Float32Array, from: number, to: number): Blob {
  const count = to - from
  const view = new DataView(new ArrayBuffer(44 + count * 2))
  const text = (at: number, word: string) => { for (let i = 0; i < word.length; i++) view.setUint8(at + i, word.charCodeAt(i)) }
  text(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); text(8, "WAVE")
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, "data"); view.setUint32(40, count * 2, true)
  for (let i = 0; i < count; i++) {
    const s = Math.max(-1, Math.min(1, samples[from + i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: "audio/wav" })
}
