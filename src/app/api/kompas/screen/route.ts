import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/kompas/screen — screen-frame analysis ("Analyse Screen").
// Ported from perfACT's /api/screen. The frame comes from the desktop app's
// display capture (grabFrame); on the web the screen feature is desktop-only,
// so this returns a plain acknowledgement the card can show. The frontend
// renders card.question = "🖥 " + (data.question || "On screen") and
// card.answer = data.text, so both fields are always present.

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-screen:${user.id}`, { max: 20, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { body = {} }
  const hasImage = typeof body.image === "string" && (body.image as string).startsWith("data:image")

  return NextResponse.json({
    question: "Screen",
    text: hasImage
      ? "- Screen analysis runs in the Kompas desktop app, where display capture is available. On the web, describe what's on screen and ask about it directly."
      : "- No screen frame arrived. In the desktop app, Analyse Screen captures the display; on the web, describe what's on screen and ask about it directly.",
  }, { headers: NO_STORE })
}
