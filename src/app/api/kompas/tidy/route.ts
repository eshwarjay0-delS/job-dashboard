import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { MAX_TIDY_CHARS, tidyText } from "@/lib/kompasSpeech"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/tidy — what a person said, with the stumbles taken out and the punctuation put in.
//
// Signed-in people only, checked before the text is read. The answer is the tidied text only when it is still what the
// person said (src/lib/kompasTranscript.ts holds that rule); otherwise it is their own words back, with a note. Being unable
// to tidy is never an error: the page always has something true to show. Nothing sent here is stored or logged.

const NO_STORE = { "Cache-Control": "no-store" }
const refuse = (status: number, code: string, error: string, retryAfterSec?: number) =>
  NextResponse.json({ error, code }, { status, headers: retryAfterSec ? { ...NO_STORE, "Retry-After": String(retryAfterSec) } : NO_STORE })

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return refuse(401, "signed-out", "Sign in again to use this.")
  const limited = checkRateLimit(`kompas-tidy:${user.id}`, { max: 60, windowMs: 60_000 })
  if (!limited.ok) return refuse(429, "busy", "Too much at once. Wait a moment and try again.", limited.retryAfterSec ?? 30)

  const raw = await request.text()
  if (raw.length > MAX_TIDY_CHARS * 8) return refuse(413, "too-long", "That is too much text to tidy in one piece.")
  let body: { text?: unknown; for?: unknown }
  try { body = JSON.parse(raw) } catch { return refuse(400, "empty", "There was no text to tidy.") }
  const text = typeof body?.text === "string" ? body.text.trim() : ""
  if (!text) return refuse(400, "empty", "There was no text to tidy.")
  if (text.length > MAX_TIDY_CHARS) return refuse(413, "too-long", "That is too much text to tidy in one piece.")
  const purpose = body.for === "transcribe" ? "transcribe" : "flow"

  return NextResponse.json(await tidyText({ text, purpose }), { headers: NO_STORE })
}
