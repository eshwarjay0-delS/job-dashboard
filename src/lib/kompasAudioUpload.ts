/**
 * Read an audio upload without trusting Content-Length. Reject as soon as the
 * cumulative byte limit is exceeded, before concatenating or calling STT.
 * null means oversized; an empty Uint8Array means no recording was sent.
 * No logging, persistence, decoding, or background capture occurs here.
 */
export async function readBoundedAudio(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError("Invalid audio size limit")
  if (!body) return new Uint8Array(0)

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let tooLarge = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Subtract first to avoid integer overflow and reject before copying.
      if (value.byteLength > maxBytes - size) {
        tooLarge = true
        try { await reader.cancel() } catch { /* a broken source is still oversized */ }
        break
      }
      size += value.byteLength
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (tooLarge) return null
  const audio = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    audio.set(chunk, offset)
    offset += chunk.byteLength
  }
  return audio
}
