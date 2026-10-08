import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { SpeechError, audioType, transcribeAudio, type SpeechCode } from "@/lib/kompasSpeech"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/speech — a recording in, its words out, for Kompas Flow and Kompas Transcribe.
//
// Signed-in people only, checked before a byte of the recording is read. The recording is held in memory for the length of
// this request and then gone: nothing a person said is stored or logged by MarketFit. A refusal says what was wrong in plain
// words with a short code the page can act on; it never carries the recogniser's own message.

const MAX_BYTES = 4 * 1024 * 1024      // under the host's 4.5 MB limit on a request
const MIN_BYTES = 800                   // less than this is a recorder that opened and closed
const NO_STORE = { "Cache-Control": "no-store" }

const WORDS: Record<SpeechCode | "signed-out", { status: number; error: string }> = {
  "signed-out": { status: 401, error: "Sign in again to use this." },
  "too-large": { status: 413, error: "That recording is too long to send in one piece." },
  "empty": { status: 400, error: "Nothing was heard. Try again, a little closer to the microphone." },
  "bad-audio": { status: 422, error: "That recording could not be read." },
  "busy": { status: 429, error: "Too much at once. Wait a moment and try again." },
  "unavailable": { status: 503, error: "Speech to text is not available right now. Try again in a minute." },
}
const refuse = (code: SpeechCode | "signed-out", retryAfterSec?: number) =>
  NextResponse.json({ error: WORDS[code].error, code }, { status: WORDS[code].status, headers: retryAfterSec ? { ...NO_STORE, "Retry-After": String(retryAfterSec) } : NO_STORE })

// A header a browser filled in. A malformed escape is a bad header, not a reason to fail the request.
function decoded(value: string | null, max: number): string {
  if (!value) return ""
  try { return decodeURIComponent(value).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max) } catch { return "" }
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return refuse("signed-out")
  const limited = checkRateLimit(`kompas-speech:${user.id}`, { max: 120, windowMs: 60_000 })
  if (!limited.ok) return refuse("busy", limited.retryAfterSec ?? 30)

  const purpose = request.headers.get("x-speech-for")
  if (purpose !== "flow" && purpose !== "transcribe") return refuse("bad-audio")
  const mime = request.headers.get("x-audio-mime")
  if (!audioType(mime)) return refuse("bad-audio")
  // Refused by its declared size before it is read, and again by its real size after.
  if (Number(request.headers.get("content-length")) > MAX_BYTES) return refuse("too-large")
  const audio = new Uint8Array(await request.arrayBuffer())
  if (audio.byteLength > MAX_BYTES) return refuse("too-large")
  if (audio.byteLength < MIN_BYTES) return refuse("empty")

  const language = (request.headers.get("x-speech-lang") || "").trim().toLowerCase()
  try {
    const heard = await transcribeAudio({
      audio, mime: mime!, purpose,
      hint: decoded(request.headers.get("x-speech-hint"), 400) || undefined,
      language: /^[a-z]{2}$/.test(language) ? language : undefined,
    })
    return NextResponse.json(heard, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof SpeechError) return refuse(e.code, e.retryAfterSec)
    return refuse("unavailable")
  }
}
