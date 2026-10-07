/**
 * What a model call costs THIS deployment, per model.
 *
 * Why (2026-10-07): the owner asked the admin page for "a clear picture of resume gen costs". The one figure the tailor
 * reported, `estCostUSD`, priced every token at Claude Haiku's rate whatever model had answered. A resume written by GPT Luna
 * was shown at ten times its price, and one written on Groq's free allowance, which costs nothing, was shown as money spent.
 *
 * Two kinds of zero are kept apart, because adding them up is how a cost page lies:
 *   free      the provider does not bill this deployment for the call (a free allowance, a ":free" model). Cost 0, and true.
 *   unpriced  nobody has put this model's price in the table below. Cost counted as 0, reported as UNKNOWN beside the total.
 *
 * Prices are US dollars per million tokens. Each row says where the number came from and when it was read. A price is a remote
 * fact with an expiry date: when a row's date is old, re-read the source before trusting a total built on it.
 */
import type { Provider } from "@/lib/llm"

export type CallUsage = { provider?: Provider | string; model?: string; input: number; output: number; cacheRead?: number; cacheWrite?: number }

type Price = { in: number; out: number; cacheRead?: number; cacheWrite?: number; source: string; read: string }

/** First match wins. Matched against the model id as the provider reported it. */
const PRICES: { match: RegExp; price: Price }[] = [
  { match: /^gpt-6-luna(?!-pro)/i, price: { in: 0.10, out: 0.50, source: "OpenRouter's public model list (openai/gpt-6-luna), not OpenAI's own price page", read: "2026-10-05" } },
  { match: /^gpt-5\.6-luna(?!-pro)/i, price: { in: 0.20, out: 1.20, source: "OpenRouter's public model list (openai/gpt-5.6-luna)", read: "2026-10-05" } },
  { match: /^claude-haiku-4-5/i, price: { in: 1, out: 5, cacheRead: 0.1, cacheWrite: 1.25, source: "OpenRouter's public model list (anthropic/claude-haiku-4.5) for input; output and cache from the rates this file's predecessor used", read: "2026-10-05" } },
  { match: /^claude-sonnet-5/i, price: { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5, source: "third-party price trackers, as reported to the owner on 2026-10-01", read: "2026-10-01" } },
  { match: /^claude-opus-5/i, price: { in: 4, out: 20, cacheRead: 0.4, cacheWrite: 5, source: "third-party price trackers, as reported to the owner on 2026-10-01", read: "2026-10-01" } },
]

/**
 * Is this call free for this deployment?
 *
 * Groq: the key is on the free tier (its responses carry an 8,000 tokens-a-minute allowance, measured 2026-10-05), which is not
 * billed. Set GROQ_BILLED=1 the day that key moves to a paid tier, and add its models' prices above: until then they would show
 * as unpriced, which is the honest reading. OpenRouter: only a model whose id ends ":free".
 */
function isFree(provider: string, model: string): boolean {
  if (provider === "groq") return process.env.GROQ_BILLED !== "1" && process.env.GROQ_BILLED !== "true"
  if (provider === "openrouter") return /:free$/i.test(model)
  return false
}

export type PricedCall = { provider: string; model: string; calls: number; input: number; output: number; costUsd: number; kind: "priced" | "free" | "unpriced" }
export type PricedUsage = {
  /** What the calls cost this deployment. Unpriced calls add nothing to it: see `unpricedCalls`. */
  costUsd: number
  calls: number
  input: number
  output: number
  /** Calls to a model with no price in the table. When this is not 0 the total above is a floor, not the cost. */
  unpricedCalls: number
  byModel: PricedCall[]
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Price a list of calls. A call that does not say which model served it is unpriced: guessing a model is guessing a price. */
export function priceCalls(calls: readonly CallUsage[]): PricedUsage {
  const by = new Map<string, PricedCall>()
  for (const call of calls) {
    const provider = String(call.provider || "unknown"), model = String(call.model || "unknown")
    const row = PRICES.find(p => p.match.test(model))
    const kind: PricedCall["kind"] = isFree(provider, model) ? "free" : row ? "priced" : "unpriced"
    const cost = kind === "priced" && row
      ? (call.input * row.price.in + call.output * row.price.out + (call.cacheRead || 0) * (row.price.cacheRead ?? row.price.in) + (call.cacheWrite || 0) * (row.price.cacheWrite ?? row.price.in)) / 1e6
      : 0
    const key = `${provider}\u0000${model}`
    const line = by.get(key) || { provider, model, calls: 0, input: 0, output: 0, costUsd: 0, kind }
    line.calls += 1; line.input += call.input + (call.cacheRead || 0) + (call.cacheWrite || 0); line.output += call.output; line.costUsd += cost
    by.set(key, line)
  }
  const byModel = [...by.values()].map(l => ({ ...l, costUsd: round6(l.costUsd) })).sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls)
  return {
    costUsd: round6(byModel.reduce((n, l) => n + l.costUsd, 0)),
    calls: byModel.reduce((n, l) => n + l.calls, 0),
    input: byModel.reduce((n, l) => n + l.input, 0),
    output: byModel.reduce((n, l) => n + l.output, 0),
    unpricedCalls: byModel.filter(l => l.kind === "unpriced").reduce((n, l) => n + l.calls, 0),
    byModel,
  }
}

/** The table as data, for the admin page to show where each price came from. Never a secret in it. */
export function priceTable(): { model: string; in: number; out: number; source: string; read: string }[] {
  return PRICES.map(p => ({ model: p.match.source.replace(/^\^|\(\?!-pro\)|\\/g, ""), in: p.price.in, out: p.price.out, source: p.price.source, read: p.price.read }))
}
