import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { groqAllowances } from "@/lib/llm"
import { readLlmCalls, summarizeCalls, type LlmCall } from "@/lib/llmLedger"
import { priceTable } from "@/lib/llmPrices"
import { llmStatus } from "@/lib/llmStatus"
import { dayIn, daysEnding, overviewOf, readTailorEvents, utcDay } from "@/lib/tailorLedger"

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
  const weekDays = new Set<string>(daysEnding(today, 7))
  const pick = (keep: (day: string) => boolean): LlmCall[] => local.filter(x => keep(x.day)).map(x => x.c)
  const month = summarizeCalls(pick(d => d.startsWith(today.slice(0, 7))))
  const calls = { today: summarizeCalls(pick(d => d === today)), week: summarizeCalls(pick(d => weekDays.has(d))), month }

  // What is left. OpenAI does not tell a key how much credit remains, so the only honest figure is the owner's own budget
  // (OPENAI_MONTHLY_BUDGET_USD) less what the ledger says was spent this month. With no budget set there is no "left" to show.
  const openaiSpent = month.byModel.filter(m => m.provider === "openai").reduce((n, m) => n + m.costUsd, 0)
  // OpenAI calls answered by a model with no price in the table add nothing to "spent": when there are any, what is left is
  // "at most" the figure, and the page says so.
  const openaiUnpriced = month.byModel.filter(m => m.provider === "openai" && m.kind === "unpriced").reduce((n, m) => n + m.calls, 0)
  const budget = Number(process.env.OPENAI_MONTHLY_BUDGET_USD)
  const resumes = overviewOf(tailors.events, now, timeZone)
  // What one delivered resume costs, counted from the calls themselves: every call made for the resume tailor this month,
  // the ones spent on requests that failed included (a failed request is recorded with no cost of its own), over the resumes
  // that were written. The resume ledger's own average is the fallback when the call ledger has nothing.
  const resumeSpend = month.byPurpose.filter(p => p.app === "marketfit" && p.purpose.startsWith("resume-")).reduce((n, p) => n + p.costUsd, 0)
  const perResume = (resumes.month.generated > 0 && resumeSpend > 0 ? resumeSpend / resumes.month.generated : 0) || resumes.month.costPerResumeUsd || resumes.week.costPerResumeUsd
  const openai = {
    budgetUsd: Number.isFinite(budget) && budget > 0 ? budget : null,
    spentMonthUsd: Math.round(openaiSpent * 1e6) / 1e6,
    unpricedCalls: openaiUnpriced,
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
      // Said only when counting really began inside what is shown: the oldest record is later than the first two days that
      // were read. In a later month the oldest record read is simply the start of the window, and saying "counting began"
      // then would be false.
      recordingSince: llm.calls[0] && llm.calls[0].at > Date.parse(`${readFrom}T00:00:00Z`) + 2 * 86_400_000 ? new Date(llm.calls[0].at).toISOString() : null,
      empty: llm.calls.length === 0 && tailors.events.length === 0,
    },
  }, { headers: { "Cache-Control": "no-store" } })
}
