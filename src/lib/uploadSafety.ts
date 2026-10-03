import path from "node:path"

export const MAX_RESUME_BYTES = 5 * 1024 * 1024
export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
export const MAX_ARCHIVE_FILES = 200

export function safeResumeName(name: string): string {
  // Treat Windows separators as separators on Linux too.
  const base = path.posix.basename(name.replace(/\\/g, "/"))
  const safe = base.replace(/[^A-Za-z0-9._ \-()]/g, "_")
  if (!safe || safe.startsWith(".") || safe.length > 180 || !/\.docx$/i.test(safe)) {
    throw new Error("Use a .docx filename of at most 180 characters.")
  }
  return safe
}

export async function readLimitedStream(stream: AsyncIterable<Uint8Array | string>, max: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    size += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength
    if (size > max) throw new Error("Expanded ZIP exceeds the resume upload limit.")
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks, size)
}
