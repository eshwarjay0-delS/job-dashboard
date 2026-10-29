import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { answerForVerifiedUser } from "@/lib/kompasAnswerService"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// The Kompas page calls /api/answer. The shell rewrites that in the browser.
// A client that misses the rewrite was getting the site 404. This route is the same engine.
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this.", quiet: true }, {
    status: 401, headers: { "Cache-Control": "no-store" },
  })
  return answerForVerifiedUser(request, user)
}
