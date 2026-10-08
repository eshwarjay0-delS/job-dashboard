// Turning a chosen recording into parts the server will take.
//
// A request may carry 4 MB, and a recording is often far larger, and a compressed file cannot be cut at an arbitrary byte. So
// the file is decoded in the browser, mixed to one channel at 16,000 samples a second (all a speech recogniser uses), and cut
// into parts of 25 seconds, each written as a small plain WAV file of about 800 KB.
//
// The mistake this file prevents is a browser tab that dies on a long file. Decoding holds the whole recording in memory
// uncompressed, so the limits are applied BEFORE decoding, not after (found in review, 2026-10-08: a three-hour mp3 is under
// the size limit, and decoding it to find out it was too long needed gigabytes):
//   - the file's size is checked first;
//   - its length is read from the file's own header with a media element, which decodes nothing;
//   - a file whose length cannot be read that way is taken only when it is small;
//   - what is decoded is decoded straight at the recogniser's rate, a third of the memory of the device's rate.

export const RATE = 16000
export const PART_SECONDS = 25
export const MAX_FILE_BYTES = 60 * 1024 * 1024
export const MAX_MINUTES = 30
/** A file that will not say how long it is is taken only up to this size. */
const MAX_UNMEASURED_BYTES = 20 * 1024 * 1024

export type Decoded = { samples: Float32Array; seconds: number }
export type DecodeProblem = "too-big" | "too-long" | "cannot-read" | "no-support"

/** How long the recording is, read from its header without decoding it. Null when the browser cannot tell. */
function lengthOf(file: File): Promise<number | null> {
  return new Promise(resolve => {
    let url = ""
    try {
      url = URL.createObjectURL(file)
      const probe = document.createElement(file.type.startsWith("video/") ? "video" : "audio")
      let settled = false
      const done = (seconds: number | null) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        probe.removeAttribute("src")
        try { probe.load() } catch { /* nothing to unload */ }
        URL.revokeObjectURL(url)
        resolve(seconds)
      }
      const timer = window.setTimeout(() => done(null), 8000)
      probe.preload = "metadata"
      probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : null)
      probe.onerror = () => done(null)
      probe.src = url
    } catch {
      if (url) URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

export async function decode(file: File): Promise<{ ok: true; audio: Decoded } | { ok: false; because: DecodeProblem }> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, because: "too-big" }
  if (typeof OfflineAudioContext === "undefined") return { ok: false, because: "no-support" }
  const stated = await lengthOf(file)
  if (stated !== null && stated > MAX_MINUTES * 60) return { ok: false, because: "too-long" }
  if (stated === null && file.size > MAX_UNMEASURED_BYTES) return { ok: false, because: "too-long" }
  try {
    // An offline context at the recogniser's rate decodes straight to that rate.
    const context = new OfflineAudioContext(1, 1, RATE)
    const heard = await context.decodeAudioData(await file.arrayBuffer())
    if (heard.duration > MAX_MINUTES * 60) return { ok: false, because: "too-long" }
    if (!(heard.duration > 0) || heard.length === 0) return { ok: false, because: "cannot-read" }
    let samples: Float32Array
    if (heard.sampleRate !== RATE) {
      // A browser that decoded at another rate after all: one pass through an offline context brings it to ours, mixed down.
      const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(heard.duration * RATE)), RATE)
      const source = offline.createBufferSource()
      source.buffer = heard
      source.connect(offline.destination)
      source.start()
      samples = (await offline.startRendering()).getChannelData(0)
    } else if (heard.numberOfChannels === 1) {
      samples = heard.getChannelData(0)
    } else {
      // Mixed to one channel here, a channel at a time, so no second copy of every channel is held.
      samples = new Float32Array(heard.length)
      for (let c = 0; c < heard.numberOfChannels; c++) {
        const channel = heard.getChannelData(c)
        for (let i = 0; i < channel.length; i++) samples[i] += channel[i] / heard.numberOfChannels
      }
    }
    return { ok: true, audio: { samples, seconds: heard.duration } }
  } catch {
    return { ok: false, because: "cannot-read" }
  }
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
