import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { answerAside } from "@/lib/kompasAnswerAside"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Resume-backed clarify panel. No answer model call. */
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, {
    status: 401, headers: { "Cache-Control": "no-store" },
  })
  let body: { question?: string; transcript?: string; resume?: string } = {}
  try { body = await request.json() } catch { body = {} }
  const aside = answerAside({
    question: String(body.question || "").slice(0, 500),
    transcript: String(body.transcript || "").slice(0, 12000),
    resume: String(body.resume || "").slice(0, 20000),
  })
  return NextResponse.json({ aside }, { headers: { "Cache-Control": "no-store" } })
}
