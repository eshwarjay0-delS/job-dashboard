import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { groqAllowances } from "@/lib/llm"
import { readLlmCalls, summarizeCalls, type LlmCall } from "@/lib/llmLedger"
import { readSttCalls, type SttCall } from "@/lib/sttLedger"
import { priceTable, priceAudioMinutes, audioPriceTable } from "@/lib/llmPrices"
import { cachedLlmStatus } from "@/lib/llmStatus"
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

  const [tailors, llm, stt] = await Promise.all([
    readTailorEvents(readFrom, to),
    readLlmCalls(readFrom, to),
    readSttCalls(readFrom, to),
  ])

  const providers = cachedLlmStatus()
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
  // including reported usage on failed calls, over the resumes
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

  // ── Speech: audio minutes, session costs, and the business-model projections ──
  // Every STT call priced by its audio minutes. Sessions group the chunks of one
  // live run; the per-session average is what a "30-minute session costs $X"
  // figure is built from.
  const sttLocal = stt.calls.map(c => ({ c, day: dayIn(timeZone, c.at) }))
  const sttPick = (keep: (day: string) => boolean): SttCall[] => sttLocal.filter(x => keep(x.day)).map(x => x.c)
  const sttMonth = sttPick(d => d.startsWith(today.slice(0, 7)))
  const priceStt = (calls: SttCall[]) => {
    let minutes = 0, costUsd = 0, freeCalls = 0, unpricedCalls = 0
    const byModel = new Map<string, { model: string; provider: string; calls: number; minutes: number; costUsd: number; kind: string }>()
    for (const c of calls) {
      const mins = c.seconds / 60
      minutes += mins
      const p = priceAudioMinutes(c.model, c.provider, mins)
      costUsd += p.costUsd
      if (p.kind === "free") freeCalls++
      if (p.kind === "unpriced") unpricedCalls++
      const key = `${c.provider} ${c.model}`
      const row = byModel.get(key) || { model: c.model, provider: c.provider, calls: 0, minutes: 0, costUsd: 0, kind: p.kind }
      row.calls++; row.minutes += mins; row.costUsd += p.costUsd
      byModel.set(key, row)
    }
    return {
      calls: calls.length, minutes: Math.round(minutes * 100) / 100,
      costUsd: Math.round(costUsd * 1e6) / 1e6, freeCalls, unpricedCalls,
      byModel: [...byModel.values()].map(r => ({ ...r, minutes: Math.round(r.minutes * 100) / 100, costUsd: Math.round(r.costUsd * 1e6) / 1e6 })),
    }
  }
  // Session costs: one live run's chunks, priced together.
  const sessionCosts = (calls: SttCall[]) => {
    const by = new Map<string, { chunks: number; minutes: number; costUsd: number; at: number }>()
    for (const c of calls) {
      if (!c.session) continue
      const mins = c.seconds / 60
      const p = priceAudioMinutes(c.model, c.provider, mins)
      const row = by.get(c.session) || { chunks: 0, minutes: 0, costUsd: 0, at: c.at }
      row.chunks++; row.minutes += mins; row.costUsd += p.costUsd
      row.at = Math.min(row.at, c.at)
      by.set(c.session, row)
    }
    return [...by.entries()]
      .map(([session, r]) => ({ session: session.slice(0, 8), minutes: Math.round(r.minutes * 100) / 100, chunks: r.chunks, costUsd: Math.round(r.costUsd * 1e6) / 1e6, at: r.at }))
      .sort((a, b) => b.at - a.at)
  }
  const sttSummary = { today: priceStt(sttPick(d => d === today)), week: priceStt(sttPick(d => weekDays.has(d))), month: priceStt(sttMonth) }
  const sessions = sessionCosts(sttMonth)
  // The business-model numbers: what a session costs on average, what 30 and
  // 60 minutes cost at that rate, and how many sessions a budget buys.
  const pricedSessions = sessions.filter(s => s.costUsd > 0)
  const avgSessionCost = pricedSessions.length > 0 ? pricedSessions.reduce((n, s) => n + s.costUsd, 0) / pricedSessions.length : 0
  const avgSessionMin = sessions.length > 0 ? sessions.reduce((n, s) => n + s.minutes, 0) / sessions.length : 0
  const perMin = avgSessionMin > 0 && avgSessionCost > 0 ? avgSessionCost / avgSessionMin : 0
  const groqBudget = Number(process.env.GROQ_MONTHLY_BUDGET_USD)
  const speech = {
    ...sttSummary,
    sessions: sessions.slice(0, 25),
    sessionCount: sessions.length,
    avgSessionCostUsd: Math.round(avgSessionCost * 1e6) / 1e6,
    avgSessionMinutes: Math.round(avgSessionMin * 100) / 100,
    cost30minUsd: Math.round(perMin * 30 * 1e6) / 1e6,
    cost60minUsd: Math.round(perMin * 60 * 1e6) / 1e6,
    budgetUsd: Number.isFinite(groqBudget) && groqBudget > 0 ? groqBudget : null,
    sessionsLeft: Number.isFinite(groqBudget) && groqBudget > 0 && avgSessionCost > 0
      ? Math.max(0, Math.floor((groqBudget - sttSummary.month.costUsd) / avgSessionCost)) : null,
  }

  return NextResponse.json({
    at: new Date(now).toISOString(),
    timeZone,
    today,
    resumes,
    calls,
    speech,
    left: {
      openai,
      // Groq's own count, as of the last answer THIS server instance had from it. An idle instance has nothing to show.
      groq: groqAllowances(),
      providers: providers ? providers.status.providers : [],
      providersCheckedAt: providers?.checkedAt ?? null,
      perPersonWeeklyLimit: Number.isFinite(weeklyLimit) && weeklyLimit > 0 ? weeklyLimit : null,
    },
    prices: priceTable(),
    audioPrices: audioPriceTable(),
    accounting: {
      state: "UNRECONCILED",
      source: "reported token usage and current price table",
      reconciledCostUsd: null,
      reason: "Provider invoice reconciliation is not connected. Estimates exclude missing usage and unpriced models.",
    },
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
