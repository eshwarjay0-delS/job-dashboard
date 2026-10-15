import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { getKeyBalance, setKeyBalance } from "@/lib/keyBalance"
import { readLlmCalls, summarizeCalls } from "@/lib/llmLedger"
import { readTailorEvents, overviewOf } from "@/lib/tailorLedger"
import { isAdminEmail } from "@/lib/owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

// GET /api/tailor/budget — the deterministic resume count.
// Declared key balance minus measured OpenAI spend, divided by the measured
// cost per resume. Before the first resume calibrates it, the price-table
// fallback is used and the response says so plainly.
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })

  const now = Date.now()
  const [balance, llm, tailors] = await Promise.all([
    getKeyBalance("openai"),
    readLlmCalls("2026-09-01", new Date(now).toISOString().slice(0, 10)),
    readTailorEvents("2026-09-01", new Date(now).toISOString().slice(0, 10)),
  ])

  // Measured OpenAI spend: every metered call on the openai provider.
  const summary = summarizeCalls(llm.calls)
  const openaiSpent = summary.byModel
    .filter(m => m.provider === "openai")
    .reduce((n, m) => n + m.costUsd, 0)

  const resumes = overviewOf(tailors.events, now, "America/Chicago")
  const measuredCostPerResume = resumes.month.costPerResumeUsd || resumes.week.costPerResumeUsd || 0
  const measuredResumes = resumes.month.generated || resumes.week.generated || 0

  // Fallback before calibration: price-table estimate for one gpt-6-luna run
  // (keyword expansion + main generation at typical token counts).
  // ~900 in/100 out for expansion, ~3000 in/1100 out for generation.
  const FALLBACK_PER_RESUME_USD = (900 * 0.10 + 100 * 0.50 + 3000 * 0.10 + 1100 * 0.50) / 1e6
  const perResume = measuredCostPerResume > 0 ? measuredCostPerResume : FALLBACK_PER_RESUME_USD
  const remaining = Math.max(0, balance.loadedUsd - openaiSpent)

  return NextResponse.json({
    ok: true,
    loadedUsd: balance.loadedUsd,
    spentUsd: round6(openaiSpent),
    remainingUsd: round6(remaining),
    perResumeUsd: round6(perResume),
    resumesLeft: perResume > 0 ? Math.floor(remaining / perResume) : null,
    calibrated: measuredCostPerResume > 0,
    measuredResumes,
    note: measuredCostPerResume > 0
      ? `Measured from ${measuredResumes} real resume(s) you generated.`
      : "Estimate from the price table — the first resume you generate will calibrate it to your real cost.",
  }, { headers: NO_STORE })
}

// POST /api/tailor/budget { loadedUsd } — declare what was loaded on the key. Owner only.
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })
  if (!isAdminEmail(user.email || "")) return NextResponse.json({ error: "Owner only." }, { status: 403, headers: NO_STORE })
  let body: { loadedUsd?: unknown }
  try { body = await request.json() } catch { body = {} }
  const loaded = Number(body.loadedUsd)
  if (!Number.isFinite(loaded) || loaded < 0 || loaded > 100000) {
    return NextResponse.json({ error: "loadedUsd must be a number between 0 and 100000." }, { status: 400, headers: NO_STORE })
  }
  const b = await setKeyBalance("openai", loaded)
  return NextResponse.json({ ok: true, ...b }, { headers: NO_STORE })
}
