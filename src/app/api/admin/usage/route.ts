import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { groqAllowances } from "@/lib/llm"
import { readLlmCalls, summarizeCalls, type LlmCall } from "@/lib/llmLedger"
import { priceTable } from "@/lib/llmPrices"
import { llmStatus } from "@/lib/llmStatus"
import { dayIn, overviewOf, readTailorEvents, utcDay } from "@/lib/tailorLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// GET /api/admin/usage — the one place that says what the products did and what it cost (owner, 2026-10-07: "a centralized
// place for job-dashboard and kompas usage. API costs, tokens costs", "how much usage is left. How many were interacted. clear
// picture of resume gen costs. How many generated this week and today").
//
// Admins only (src/lib/adminAccess.ts). Everything here is counts, labels and money: the two ledgers it reads hold no words and
// nobody's identity (src/lib/llmLedger.ts, src/lib/tailorLedger.ts).
//
// "Today" and "this week" are the owner's days, not UTC's: ADMIN_TIME_ZONE, an IANA name, America/Chicago unless set.
export async function GET(request: NextRequest) {
  if (!(await adminOf(request))) return NextResponse.json({ error: "Admins only." }, { status: 403, headers: { "Cache-Control": "no-store" } })

  const now = Date.now()
  const timeZone = (process.env.ADMIN_TIME_ZONE || "America/Chicago").trim()
  const today = dayIn(timeZone, now)
  // The month so far in the owner's zone, read a UTC day wide on both sides so a zone's edge never drops a record.
  const from = utcDay(Date.parse(`${today.slice(0, 7)}-01T00:00:00Z`) - 86_400_000)
  const to = utcDay(now + 86_400_000)
  // The last seven local days can reach into the month before.
  const weekFrom = utcDay(now - 8 * 86_400_000)
  const readFrom = weekFrom < from ? weekFrom : from

  const [tailors, llm, providers] = await Promise.all([
    readTailorEvents(readFrom, to),
    readLlmCalls(readFrom, to),
    llmStatus().catch(() => null),
  ])

  const local = llm.calls.map(c => ({ c, day: dayIn(timeZone, c.at) }))
  const weekDays = new Set<string>(); for (let back = 0; back < 7; back++) weekDays.add(dayIn(timeZone, now - back * 86_400_000))
  const pick = (keep: (day: string) => boolean): LlmCall[] => local.filter(x => keep(x.day)).map(x => x.c)
  const month = summarizeCalls(pick(d => d.startsWith(today.slice(0, 7))))
  const calls = { today: summarizeCalls(pick(d => d === today)), week: summarizeCalls(pick(d => weekDays.has(d))), month }

  // What is left. OpenAI does not tell a key how much credit remains, so the only honest figure is the owner's own budget
  // (OPENAI_MONTHLY_BUDGET_USD) less what the ledger says was spent this month. With no budget set there is no "left" to show.
  const openaiSpent = month.byModel.filter(m => m.provider === "openai").reduce((n, m) => n + m.costUsd, 0)
  const budget = Number(process.env.OPENAI_MONTHLY_BUDGET_USD)
  const resumes = overviewOf(tailors.events, now, timeZone)
  const perResume = resumes.month.costPerResumeUsd || resumes.week.costPerResumeUsd
  const openai = {
    budgetUsd: Number.isFinite(budget) && budget > 0 ? budget : null,
    spentMonthUsd: Math.round(openaiSpent * 1e6) / 1e6,
    leftUsd: Number.isFinite(budget) && budget > 0 ? Math.round((budget - openaiSpent) * 1e6) / 1e6 : null,
    // How many more resumes the money left would buy at this month's average. Null when either number is missing.
    resumesLeft: Number.isFinite(budget) && budget > 0 && perResume > 0 ? Math.max(0, Math.floor((budget - openaiSpent) / perResume)) : null,
  }
  const weeklyLimit = Number(process.env.TAILOR_WEEKLY_LIMIT ?? 0)

  return NextResponse.json({
    at: new Date(now).toISOString(),
    timeZone,
    today,
    resumes,
    calls,
    left: {
      openai,
      // Groq's own count, as of the last answer THIS server instance had from it. An idle instance has nothing to show.
      groq: groqAllowances(),
      providers: providers ? providers.providers : [],
      perPersonWeeklyLimit: Number.isFinite(weeklyLimit) && weeklyLimit > 0 ? weeklyLimit : null,
    },
    prices: priceTable(),
    // Said plainly when the picture is incomplete, so a low number is never mistaken for a quiet week.
    gaps: {
      unreadable: tailors.unreadable + llm.unreadableDays,
      truncated: tailors.truncated,
      kompasReporting: month.byApp.kompas !== undefined,
      recordingSince: llm.calls[0] ? new Date(llm.calls[0].at).toISOString() : null,
    },
  }, { headers: { "Cache-Control": "no-store" } })
}
