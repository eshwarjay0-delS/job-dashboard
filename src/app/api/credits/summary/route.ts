import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { getKeyBalance, RESUME_FALLBACK_USD, RESUME_FALLBACK_CHEAP_USD } from "@/lib/keyBalance"
import { readLlmCalls, summarizeCalls } from "@/lib/llmLedger"
import { getPoints, pointsToDisplay } from "@/lib/creditsLedger"
import { hashUserId } from "@/lib/sttLedger"
import { readTailorEvents, overviewOf } from "@/lib/tailorLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// Pre-calibration resume costs come from the one shared source (keyBalance.ts);
// measured cost replaces them once the first resumes calibrate it.
const OR_RESUME_USD = RESUME_FALLBACK_CHEAP_USD   // gpt-oss-120b cheapest route
const OAI_RESUME_USD = RESUME_FALLBACK_USD        // gpt-6-luna, the route resumes run on

type AppWide = { resumesLeft: number; calibrated: boolean; remainingUsd: number }

// The app-wide part (the keys' balances and the spend ledger since September) is the same for everyone and slow to add
// up: 4.8 to 5.2 seconds on 14 Oct 2026, on every page load. It is worked out at most once a minute on each server and
// shared; a failed attempt is not kept.
const APP_WIDE_MS = 60_000
let appWide: { at: number; value: Promise<AppWide> } | null = null
function appWideNumbers(): Promise<AppWide> {
  if (appWide && Date.now() - appWide.at < APP_WIDE_MS) return appWide.value
  const value = computeAppWide()
  appWide = { at: Date.now(), value }
  value.catch(() => { if (appWide?.value === value) appWide = null })
  return value
}

async function computeAppWide(): Promise<AppWide> {
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
  return { resumesLeft, calibrated: measured > 0, remainingUsd: Math.round((oLeft + orLeft) * 100) / 100 }
}

// GET /api/credits/summary — the everywhere pill: resumes + sessions left.
// Signed-in users see their own numbers; nothing about anyone else.
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })
  const [wide, pts] = await Promise.all([appWideNumbers(), getPoints(hashUserId(user.id))])
  const display = pointsToDisplay(pts)

  // One meaning per number on every surface (owner, 22 Oct 2026: the pill
  // showed ~1,400 resumes while the Kompas header showed 80 for the same
  // moment). "Resumes left" and "sessions left" here are gel points — the
  // same numbers the Kompas header shows. The API keys' dollar view rides
  // along under `usd` for the explainer and the budget board; it is never
  // swapped into the pill itself.
  return NextResponse.json({ ok: true, points: pts, resumesLeft: display.resumes, sessionsLeft: display.interviews, usd: wide }, { headers: NO_STORE })
}
