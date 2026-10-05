/**
 * Which AI providers are answering right now?
 *
 * Why (2026-10-05): the owner sent a job description to the WhatsApp bot and got his own resume back with two bullets changed
 * and "Match 28% -> 28%". Most of the draft's calls had been refused by the providers, and nothing on the outside said so.
 *
 * For each provider that has a key, one tiny question is asked through the same code path the tailoring uses (same model, same
 * retry rule) and the refusal, if any, is sorted into a state. Each probe asks for a handful of output tokens; the answers are
 * kept for five minutes per server instance, and callers that arrive together share one probe. No key or reply text is returned.
 */
import { callLLM, resolveKeys, type Provider } from "@/lib/llm"

export type ProviderState = "ok" | "rate_limited" | "key_rejected" | "no_credit" | "model_not_found" | "slow_or_down" | "refused"
export type LlmStatus = {
  state: "ok" | "degraded" | "down" | "not_configured"
  /** What to do about it, for whoever runs the deployment. */
  fix: string
  /** In the order the tailoring tries them. `limit` names the limit when the provider said which. */
  providers: { provider: Provider; state: ProviderState; limit?: string }[]
}

const ORDER: Provider[] = ["gemini", "groq", "anthropic", "openrouter"]   // the tailoring ladder's order (src/lib/llm.ts)

function sort(message: string): { state: ProviderState; limit?: string } {
  const status = Number((/API (\d{3})/.exec(message) || [])[1]) || 0
  const limit = /per day|daily|\bTPD\b|\bRPD\b/i.test(message) ? "per day" : /per minute|\bTPM\b|\bRPM\b/i.test(message) ? "per minute" : undefined
  if (status === 429 || /rate.?limit|quota|resource_exhausted|too many requests/i.test(message)) return { state: "rate_limited", ...(limit ? { limit } : {}) }
  if (status === 402 || /credit balance|insufficient (credit|funds|balance)|billing/i.test(message)) return { state: "no_credit" }
  if (status === 401 || status === 403 || /api key not valid|invalid api key|unauthorized|permission denied/i.test(message)) return { state: "key_rejected" }
  if (status === 404 || /model.*(not found|does not exist|decommissioned)/i.test(message)) return { state: "model_not_found" }
  if (status >= 500 || /abort|timeout|timed out|fetch failed|network/i.test(message)) return { state: "slow_or_down" }
  return { state: "refused" }
}

let kept: { at: number; status: LlmStatus } | null = null
let inflight: Promise<LlmStatus> | null = null

export async function llmStatus(): Promise<LlmStatus> {
  if (kept && Date.now() - kept.at < 5 * 60_000) return kept.status
  inflight ??= probe().finally(() => { inflight = null })
  return inflight
}

async function probe(): Promise<LlmStatus> {
  const keys = resolveKeys({})
  const have = ORDER.filter(p => !!keys[p])
  if (!have.length) return { state: "not_configured", providers: [], fix: "No AI provider key is set on the deployment. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, then redeploy." }
  const providers = await Promise.all(have.map(async (provider) => {
    try {
      await callLLM({ keys, tier: "heavy", pref: provider, system: "Reply with the single word OK.", user: "OK?", maxTokens: 8, temperature: 0 })
      return { provider, state: "ok" as ProviderState }
    } catch (e) {
      return { provider, ...sort(String((e as Error)?.message || e)) }
    }
  }))
  const up = providers.filter(p => p.state === "ok").length
  const names: Record<ProviderState, string> = { ok: "answering", rate_limited: "out of its free allowance for now", key_rejected: "refusing its key", no_credit: "out of credit", model_not_found: "set to a model that does not exist", slow_or_down: "not answering", refused: "refusing the request" }
  const bad = providers.filter(p => p.state !== "ok").map(p => `${p.provider} is ${names[p.state]}${p.limit ? ` (${p.limit} limit)` : ""}`).join("; ")
  const status: LlmStatus = up === providers.length
    ? { state: "ok", providers, fix: "" }
    : up === 0
      ? { state: "down", providers, fix: `No AI provider is answering, so nothing can be tailored: ${bad}. A provider on a free allowance comes back when its limit resets; one with credit added or a corrected key comes back at once.` }
      : { state: "degraded", providers, fix: `Tailoring works but leans on fewer providers than it has: ${bad}. A full resume is drafted as several calls at once, so with one provider left some of them can be refused.` }
  kept = { at: Date.now(), status }
  return status
}
