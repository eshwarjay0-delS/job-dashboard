import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser, takeAuthBlock } from "@/lib/authBoundary"
import { rejectIfSyntheticOwnerLimited } from "@/lib/syntheticOwnerGuards"
import { answerForVerifiedUser } from "@/lib/kompasAnswerService"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// The Kompas page calls /api/answer. The shell rewrites that in the browser.
// A client that misses the rewrite was getting the site 404. This route is the same engine.
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) {
    const block = takeAuthBlock(request)
    if (block) {
      return NextResponse.json({ error: block.message, code: block.code, ready: false }, {
        status: block.status, headers: { "Cache-Control": "no-store" },
      })
    }
    return NextResponse.json({ error: "Sign in again to use this.", code: "signed_out", quiet: true }, {
      status: 401, headers: { "Cache-Control": "no-store" },
    })
  }
  const limited = rejectIfSyntheticOwnerLimited(request, "answer", user)
  if (limited) return limited
  return answerForVerifiedUser(request, user)
}
