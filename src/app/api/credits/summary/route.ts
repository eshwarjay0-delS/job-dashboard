import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { getPoints, pointsToDisplay } from "@/lib/creditsLedger"
import { hashUserId } from "@/lib/sttLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Personal entitlements come from this user's points. Provider balances belong
// to the business and are available separately on the owner-only budget board.
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  const headers = { "Cache-Control": "private, no-store" }
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers })
  const points = await getPoints(hashUserId(user.id))
  const display = pointsToDisplay(points)
  return NextResponse.json({
    ok: true, resumesLeft: display.resumes, sessionsLeft: display.interviews,
    points, source: "personal-credits", sessionMinutes: 60,
  }, { headers })
}
