import { priceAudioMinutes } from "./llmPrices.ts"
import type { SttCall } from "./sttLedger.ts"

// The ledger records seconds. The pricing table accepts minutes. Use the
// recorded provider/model and preserve unknown prices instead of guessing.
export function summarizeBudgetAudio(calls: readonly SttCall[], now: number) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
  const today = date.format(now)
  const costByProvider: Record<string, number> = {}
  let todaySeconds = 0, todayCostUsd = 0, unpricedCalls = 0
  for (const call of calls) {
    if (!call.ok || !Number.isFinite(call.at) || call.at > now || !Number.isFinite(call.seconds) || call.seconds < 0) continue
    const priced = priceAudioMinutes(call.model, call.provider, call.seconds / 60)
    if (priced.kind === "unpriced") unpricedCalls++
    costByProvider[call.provider] = (costByProvider[call.provider] || 0) + priced.costUsd
    if (date.format(call.at) === today) {
      todaySeconds += call.seconds
      todayCostUsd += priced.costUsd
    }
  }
  return { todaySeconds, todayCostUsd, costByProvider, unpricedCalls }
}
