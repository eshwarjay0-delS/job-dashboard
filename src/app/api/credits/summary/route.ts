import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { getKeyBalance } from "@/lib/keyBalance"
import { readLlmCalls, summarizeCalls } from "@/lib/llmLedger"
import { getPoints, pointsToDisplay } from "@/lib/creditsLedger"
import { hashUserId } from "@/lib/sttLedger"
import { readTailorEvents, overviewOf } from "@/lib/tailorLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// Cheapest-route resume costs (deterministic; replaced by measured once data exists).
const OR_RESUME_USD = (3900 * 0.037 + 1200 * 0.17) / 1e6   // gpt-oss-120b cheapest route
const OAI_RESUME_USD = (3900 * 0.10 + 1200 * 0.50) / 1e6   // gpt-6-luna

// GET /api/credits/summary — the everywhere pill: resumes + sessions left.
// Signed-in users see their own numbers; nothing about anyone else.
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })
  const today = new Date().toISOString().slice(0, 10)
  const [oBal, orBal, llm, tailors] = await Promise.all([
    getKeyBalance("openai"),
    getKeyBalance("openrouter"),
    readLlmCalls("2026-09-01", today),
    readTailorEvents("2026-09-01", today),
  ])
  const priced = summarizeCalls(llm.calls)
  const spent: Record<string, number> = {}
  for (const m of priced.byModel) spent[m.provider] = (spent[m.provider] || 0) + m.costUsd

  const resumes = overviewOf(tailors.events, Date.now(), "America/Chicago")
  const measured = resumes.month.costPerResumeUsd || resumes.week.costPerResumeUsd || 0
  const perResumeOAI = measured > 0 ? measured : OAI_RESUME_USD
  const perResumeOR = measured > 0 ? measured : OR_RESUME_USD

  const oLeft = Math.max(0, oBal.loadedUsd - (spent.openai || 0))
  const orLeft = Math.max(0, orBal.loadedUsd - (spent.openrouter || 0))
  const resumesLeft = Math.floor(oLeft / perResumeOAI) + Math.floor(orLeft / perResumeOR)

  const pts = await getPoints(hashUserId(user.id))
  const sessionsLeft = pointsToDisplay(pts).interviews

  return NextResponse.json({
    ok: true,
    resumesLeft,
    sessionsLeft,
    calibrated: measured > 0,
    remainingUsd: Math.round((oLeft + orLeft) * 100) / 100,
  }, { headers: NO_STORE })
}
