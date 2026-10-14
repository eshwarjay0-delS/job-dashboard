import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { isAdminEmail } from "@/lib/owner"
import { getKeyBalance } from "@/lib/keyBalance"
import { readLlmCalls, summarizeCalls } from "@/lib/llmLedger"
import { readTailorEvents, overviewOf } from "@/lib/tailorLedger"
import { readSttCalls } from "@/lib/sttLedger"
import { summarizeBudgetAudio } from "@/lib/budgetAudio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }
const r6 = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Verified provider prices (read 2026-10-11). Sources live in llmPrices.ts.
 * Kept here so the board shows the same numbers the ledgers meter with.
 */
const RESUME_TOKENS = { in: 3900, out: 1200 } // keyword expansion + main generation, typical
const GROQ_120B = { in: 0.15, out: 0.60 }     // $/M — groq.com/pricing via 3 trackers, Oct 2026
const WHISPER_TURBO_PER_MIN = 0.04 / 60       // $/min — Groq docs, verified Oct 11

const resumeCost = (p: { in: number; out: number }) =>
  (RESUME_TOKENS.in * p.in + RESUME_TOKENS.out * p.out) / 1e6

// GET /api/budget — one board: every key's balance, what it buys, and the
// unit economics (cost per resume, cost per session, margin at plan prices).
// Owner only: balances are his money.
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })
  if (!isAdminEmail(user.email || "")) return NextResponse.json({ error: "Owner only." }, { status: 403, headers: NO_STORE })

  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10)
  const [openaiBal, groqBal, orBal, llm, tailors, stt] = await Promise.all([
    getKeyBalance("openai"),
    getKeyBalance("groq"),
    getKeyBalance("openrouter"),
    readLlmCalls("2026-09-01", today),
    readTailorEvents("2026-09-01", today),
    readSttCalls("2026-09-01", today),
  ])

  const priced = summarizeCalls(llm.calls)
  const spentByProvider: Record<string, number> = {}
  for (const m of priced.byModel) spentByProvider[m.provider] = (spentByProvider[m.provider] || 0) + m.costUsd

  const resumes = overviewOf(tailors.events, now, "America/Chicago")
  const measuredPerResume = resumes.month.costPerResumeUsd || resumes.week.costPerResumeUsd || 0
  const measuredCount = resumes.month.generated || resumes.week.generated || 0
  // Measured when available; otherwise the Groq 120B price-table figure, labeled.
  const perResume = measuredPerResume > 0 ? measuredPerResume : resumeCost(GROQ_120B)

  const audio = summarizeBudgetAudio(stt.calls, now)
  for (const [provider, cost] of Object.entries(audio.costByProvider)) {
    spentByProvider[provider] = (spentByProvider[provider] || 0) + cost
  }
  const sttSeconds = audio.todaySeconds
  const sttCost = audio.todayCostUsd
  const perSession60 = 60 * WHISPER_TURBO_PER_MIN // 1-hour interview session, STT only

  const openaiLeft = Math.max(0, openaiBal.loadedUsd - (spentByProvider.openai || 0))
  const groqLeft = Math.max(0, groqBal.loadedUsd - (spentByProvider.groq || 0))
  const orLeft = Math.max(0, orBal.loadedUsd - (spentByProvider.openrouter || 0))
  // OpenRouter can route gpt-oss-120b to the cheapest provider (DeepInfra
  // $0.037/$0.17 per M, per llm-stats.com Oct 2026) — the floor for resume cost.
  const OR_120B_FLOOR = { in: 0.037, out: 0.17 }

  // Free plan: 7 resumes/month + one 1-hour session.
  const freePlanCost = 7 * perResume + perSession60

  return NextResponse.json({
    ok: true,
    keys: [
      {
        provider: "openai", label: "OpenAI", loadedUsd: openaiBal.loadedUsd,
        spentUsd: r6(spentByProvider.openai || 0), remainingUsd: r6(openaiLeft),
        buys: { resumes: perResume > 0 ? Math.floor(openaiLeft / perResume) : null, unit: "resumes (gpt-6-luna)" },
      },
      {
        provider: "openrouter", label: "OpenRouter", loadedUsd: orBal.loadedUsd,
        spentUsd: r6(spentByProvider.openrouter || 0), remainingUsd: r6(orLeft),
        buys: {
          resumes: Math.floor(orLeft / resumeCost(OR_120B_FLOOR)),
          unit: "resumes (gpt-oss-120b via cheapest route)",
        },
      },
      {
        provider: "groq", label: "Groq", loadedUsd: groqBal.loadedUsd,
        spentUsd: r6(spentByProvider.groq || 0), remainingUsd: r6(groqLeft),
        buys: {
          resumes: perResume > 0 ? Math.floor(groqLeft / resumeCost(GROQ_120B)) : null,
          sessionMinutes: Math.floor(groqLeft / WHISPER_TURBO_PER_MIN),
          unit: "resumes (gpt-oss-120b) + STT minutes",
        },
      },
    ],
    unitEconomics: {
      perResumeUsd: r6(perResume),
      perResumeCalibrated: measuredPerResume > 0,
      measuredResumes: measuredCount,
      perSession60MinUsd: r6(perSession60),
      sttPerMinuteUsd: r6(WHISPER_TURBO_PER_MIN),
      freePlanMonthlyCostUsd: r6(freePlanCost),
      note: "Estimate for 7 resumes plus one hour of transcription. Session answer generation, retries, and hosting are additional. Provider balances use recorded top-ups and priced usage, not live provider balances.",
    },
    measured: {
      resumesGenerated: measuredCount,
      sttSecondsToday: Math.round(sttSeconds),
      sttCostTodayUsd: r6(sttCost),
      timeZone: "America/Chicago",
      unpricedAudioCalls: audio.unpricedCalls,
      unreadableDays: stt.unreadableDays + llm.unreadableDays,
      unpricedLlmCalls: priced.unpricedCalls,
    },
  }, { headers: NO_STORE })
}
