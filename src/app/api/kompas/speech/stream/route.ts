import { NextResponse } from "next/server"
import { streamingSttAvailability } from "@/lib/kompasStreamingStt"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET /api/kompas/speech/stream — capability only (no audio, no secrets).
 * Streaming stays off unless KOMPAS_STREAMING_STT is on and DEEPGRAM_API_KEY is set.
 * A websocket proxy is not served here: Vercel serverless cannot host it, and
 * no streaming key is wired in this repo today. The client falls back to Whisper.
 */
export async function GET() {
  const avail = streamingSttAvailability()
  return NextResponse.json({
    streaming: avail.enabled,
    reason: avail.reason,
    provider: avail.provider,
    fallback: avail.fallback,
  }, { headers: NO_STORE })
}
