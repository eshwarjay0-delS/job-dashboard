import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { getPoints, pointsToDisplay } from "@/lib/creditsLedger"
import { hashUserId } from "@/lib/sttLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// GET /api/kompas/credits — the header pill's numbers: how many interviews
// and resume preparations this user's gel points buy. Signed-in users only;
// a stranger learns nothing about anyone's balance.
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })
  const points = await getPoints(hashUserId(user.id))
  const display = pointsToDisplay(points)
  return NextResponse.json({ ok: true, points, ...display }, { headers: NO_STORE })
}
