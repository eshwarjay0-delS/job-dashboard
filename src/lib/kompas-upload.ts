import JSZip from 'jszip'
import { Readable } from 'node:stream'
import { extractText } from '@/lib/docx'
import { pdfText } from '@/lib/pdf-text'
import { readLimitedStream } from '@/lib/uploadSafety'
export const KOMPAS_UPLOAD_BYTES = 4 * 1024 * 1024
/** Bound bytes while receiving, even when Content-Length is absent or false. */
export async function readKompasUpload(body: ReadableStream<Uint8Array> | null): Promise<Buffer> {
  if (!body) throw new Error('Empty upload')
  const reader = body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > KOMPAS_UPLOAD_BYTES) { await reader.cancel(); throw new Error('Upload too large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  if (!size) throw new Error('Empty upload')
  return Buffer.concat(chunks, size)
}
/** Complete extraction only; callers still apply role-specific source budgets. */
export async function parseKompasUpload(bytes: Buffer, name: string): Promise<string> {
  if (!bytes.length || bytes.length > KOMPAS_UPLOAD_BYTES) throw new Error('Invalid upload size')
  const ext = name.toLowerCase().split('.').pop()
  let text: string
  if (ext === 'pdf') text = await pdfText(bytes, { requireComplete: true })
  else if (ext === 'txt') {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\u0000')) throw new Error('Binary text')
  } else if (ext === 'docx') {
    const zip = await JSZip.loadAsync(bytes)
    const entries = Object.values(zip.files).filter(f => !f.dir)
    if (entries.length > 200 || !zip.file('word/document.xml')) throw new Error('Unsupported Word archive')
    let expanded = 0
    for (const entry of entries) {
      const raw = entry.nodeStream()
      const stream = new Readable().wrap(raw)
      try {
        const part = await readLimitedStream(stream, 20 * 1024 * 1024 - expanded)
        expanded += part.length
      } finally { stream.destroy(); (raw as Readable).destroy?.() }
    }
    text = await extractText(bytes)
  } else throw new Error('Unsupported file')
  if (!text.trim()) throw new Error('Unreadable upload')
  return text.trim()
}
