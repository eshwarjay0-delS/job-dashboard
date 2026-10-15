import { getKeyBalance } from "./src/lib/keyBalance"
import { readLlmCalls, summarizeCalls } from "./src/lib/llmLedger"
import { readTailorEvents, overviewOf, summarizeTailor } from "./src/lib/tailorLedger"
import { getPoints, pointsToDisplay } from "./src/lib/creditsLedger"

const r6 = (n: number) => Math.round(n * 1e6) / 1e6

async function main() {
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10)

  const [openaiBal, orBal, groqBal] = await Promise.all([
    getKeyBalance("openai"),
    getKeyBalance("openrouter"),
    getKeyBalance("groq"),
  ])

  const llm = await readLlmCalls("2026-09-01", today)
  const priced = summarizeCalls(llm.calls)
  const spentByProvider: Record<string, number> = {}
  for (const m of (priced as any).byModel || []) spentByProvider[m.provider] = (spentByProvider[m.provider] || 0) + m.costUsd

  const tailors = await readTailorEvents("2026-09-01", today)
  const ov = overviewOf(tailors.events, now, "America/Chicago")

  // credits: owner hash unknown without his Google user id; report what's readable
  const points = null

  console.log(JSON.stringify({
    ts: new Date(now).toISOString(),
    keys: {
      openai: { loadedUsd: openaiBal.loadedUsd, updatedAt: openaiBal.updatedAt },
      openrouter: { loadedUsd: orBal.loadedUsd, updatedAt: orBal.updatedAt },
      groq: { loadedUsd: groqBal.loadedUsd, updatedAt: groqBal.updatedAt },
    },
    llm: {
      calls: llm.calls.length,
      unreadableDays: llm.unreadableDays,
      failed: (priced as any).failed,
      spentByProvider: Object.fromEntries(Object.entries(spentByProvider).map(([k, v]) => [k, r6(v as number)])),
      totalCostUsd: r6((priced as any).costUsd ?? 0),
      byPurpose: ((priced as any).byPurpose || []).map((p: any) => ({ app: p.app, purpose: p.purpose, calls: p.calls, costUsd: r6(p.costUsd) })),
    },
    tailor: {
      unreadable: tailors.unreadable,
      today: { generated: ov.today.generated, failed: ov.today.failed, costUsd: ov.today.costUsd },
      week: { generated: ov.week.generated, costPerResumeUsd: ov.week.costPerResumeUsd },
      month: { generated: ov.month.generated, costPerResumeUsd: ov.month.costPerResumeUsd },
      recent: ov.recent.slice(0, 5).map(r => ({ at: r.at, channel: r.channel, outcome: r.outcome, costUsd: r.costUsd })),
    },
    credits: { note: "owner userHash unknown locally; skipping" },
  }, null, 2))
}

main().catch(e => { console.error("BUDGET_WATCH_ERROR", e?.message || e); process.exit(1) })
