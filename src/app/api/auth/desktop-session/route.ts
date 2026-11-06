import { createHash } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimit } from "@/lib/rateLimit"
import { desktopAuthPort, exchangeDesktopSession, readDesktopSessionRequest } from "@/lib/desktopSession"
import { supabaseDesktopAuth } from "@/lib/desktopSessionSupabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

// POST /api/auth/desktop-session
// The Windows app sends the desktop refresh token, or an empty one when it
// only has a bearer. The website cookie family is not read and not rotated.
// An empty refresh token does not erase a refresh token the app stored.
export async function POST(request: NextRequest) {
  const read = await readDesktopSessionRequest(request)
  if ("status" in read) {
    return NextResponse.json(read.body, { status: read.status, headers: noStore })
  }
  const { accessToken, refreshToken } = read
  if (!refreshToken.trim() && accessToken) {
    const key = createHash("sha256").update(accessToken).digest("hex").slice(0, 24)
    const limit = checkRateLimit("desktop-session-mint:" + key, { max: 30, windowMs: 60 * 60_000 })
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: "invalid_grant", error_description: "Too many desktop session requests." },
        { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSec ?? 60) } },
      )
    }
  }
  const result = await exchangeDesktopSession(
    { accessToken, refreshToken },
    desktopAuthPort(supabaseDesktopAuth),
  )
  return NextResponse.json(result.body, { status: result.status, headers: noStore })
}
