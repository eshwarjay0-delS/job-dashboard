import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { answerForVerifiedUser } from "@/lib/kompasAnswerService"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, {
    status: 401, headers: { "Cache-Control": "no-store" },
  })
  return answerForVerifiedUser(request, user)
}
