import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Kompas session archive — every live session's microphone + computer audio,
// saved for maturation and accuracy training.
//
// How it works: /api/kompas/speech accepts two optional headers:
//   x-session-id    — UUID for the live session (one per interview/practice run)
//   x-audio-source  — "mic" (the user's microphone) or "system" (computer audio)
// After a chunk is transcribed, the raw audio + transcript + metadata are stored
// in Supabase Storage under kompas-sessions/{userId}/{sessionId}/:
//   {timestamp}-{source}.webm   the raw audio chunk
//   manifest.jsonl              one JSON line per chunk: timestamp, source,
//                               transcript, language, chunk file, corrections
// The Sunday maturation pass reads these manifests as training material:
// real audio, real transcripts, and the user's corrections as labels.
//
// Best-effort by design: archiving never blocks or breaks transcription.
// If storage isn't configured, the chunk is simply not archived.

const BUCKET = "kompas-sessions"

function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key)
}

let bucketReady: Promise<boolean> | null = null
async function ensureBucket(sb: { storage: { listBuckets(): Promise<{ data: Array<{ name: string }> | null }>; createBucket(name: string, opts: { public: boolean }): Promise<{ error: unknown }> } }): Promise<boolean> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        const { data } = await sb.storage.listBuckets()
        if (data?.some(b => b.name === BUCKET)) return true
        const { error } = await sb.storage.createBucket(BUCKET, { public: false })
        return !error
      } catch {
        return false
      }
    })()
  }
  return bucketReady
}

export interface SessionChunk {
  userId: string
  sessionId: string
  source: "mic" | "system"
  audio: Uint8Array
  mime: string
  transcript: string
  language?: string
  at: number
  corrections?: number
  /** Must come from a server-verified consent record, never a client header. */
  archiveConsentVerified?: boolean
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("wav")) return "wav"
  return "webm"
}

/** Archive one transcribed chunk. Never throws. */
export async function archiveSessionChunk(c: SessionChunk): Promise<void> {
  // Fail closed until a trusted, user-scoped consent verification is wired in.
  // A session ID or browser-provided consent header is not authorization to retain audio.
  if (c.archiveConsentVerified !== true || process.env.KOMPAS_SESSION_ARCHIVE_ENABLED !== "true") return
  try {
    const sb = serviceClient()
    if (!sb) return
    if (!await ensureBucket(sb)) return

    const safeSession = c.sessionId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64)
    if (!safeSession) return
    const base = `${c.userId}/${safeSession}`
    const chunkFile = `${base}/${c.at}-${c.source}.${extFor(c.mime)}`

    // 1. The raw audio.
    const { error: upErr } = await sb.storage.from(BUCKET).upload(
      chunkFile, c.audio, { contentType: c.mime, upsert: true },
    )
    if (upErr) return

    // 2. The manifest line — download, append, re-upload (sessions are
    //    append-only and single-writer per session, so this is safe).
    const manifestPath = `${base}/manifest.jsonl`
    let existing = ""
    try {
      const { data } = await sb.storage.from(BUCKET).download(manifestPath)
      if (data) existing = await data.text()
    } catch { /* first chunk — no manifest yet */ }
    const line = JSON.stringify({
      at: c.at,
      source: c.source,
      chunk: chunkFile,
      transcript: c.transcript,
      language: c.language || null,
      corrections: c.corrections || 0,
    })
    await sb.storage.from(BUCKET).upload(
      manifestPath, existing + line + "\n",
      { contentType: "application/jsonl", upsert: true },
    )
  } catch {
    // Archiving is best-effort; transcription already succeeded.
  }
}
