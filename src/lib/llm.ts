// ── Multi-provider LLM layer ──────────────────────────────────────────────────
// Supports Anthropic (Claude), OpenRouter, and Google Gemini. The provider is
// auto-detected from the API-key prefix, and calls are routed by TASK TIER:
//   • "light"  (simple edits — single field assists)  → cheap/free first: Gemini → OpenRouter → Anthropic
//   • "heavy"  (full resume tailoring)                  → quality first:    Anthropic → OpenRouter → Gemini
// A UI preference can pin a specific provider per tier; "auto" uses the order above.

export type Provider = "anthropic" | "openrouter" | "gemini" | "groq" | "openai"
export type ProviderPref = Provider | "auto"
export type Tier = "heavy" | "light"
export interface LlmKeys { anthropic?: string; openrouter?: string; gemini?: string; groq?: string; openai?: string }

// Identify the provider that issued a key purely from its prefix — so it works no
// matter which env var or Settings field it was pasted into.
export function providerOfKey(raw?: string): Provider | null {
  const k = (raw || "").trim()
  if (!k) return null
  if (k.startsWith("sk-ant-")) return "anthropic"
  if (k.startsWith("sk-or-")) return "openrouter"
  if (k.startsWith("gsk_")) return "groq"
  if (k.startsWith("AIza")) return "gemini"
  return null
}

// Model per provider per tier (all env-overridable).
// SPEED RULE: tailoring must finish in < 20s, so the HEAVY default is a FAST model
// (Haiku / Gemini Flash), not Sonnet (~30s). Set CLAUDE_MODEL_HEAVY=claude-sonnet-4-6
// (or OPENROUTER_MODEL_HEAVY) to trade speed for maximum quality.
function modelFor(provider: Provider, tier: Tier): string {
  const e = process.env
  if (provider === "anthropic")
    return tier === "heavy" ? (e.CLAUDE_MODEL_HEAVY || e.CLAUDE_MODEL || "claude-haiku-4-5")
                            : (e.CLAUDE_MODEL_LIGHT || "claude-haiku-4-5")
  if (provider === "openrouter")
    return tier === "heavy" ? (e.OPENROUTER_MODEL_HEAVY || e.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku")
                            : (e.OPENROUTER_MODEL_LIGHT || "anthropic/claude-3.5-haiku")
  if (provider === "groq")
    return tier === "heavy" ? (e.GROQ_MODEL_HEAVY || e.GROQ_MODEL || "openai/gpt-oss-120b")
                            : (e.GROQ_MODEL_LIGHT || e.GROQ_MODEL || "openai/gpt-oss-20b")
  // OpenAI is reached only through tailorKeys() below. GPT Luna is the model the owner chose for it (2026-10-05).
  if (provider === "openai") return e.OPENAI_MODEL_TAILOR || e.OPENAI_MODEL || "gpt-6-luna"
  // gemini-2.x models 404 for newer keys; 3.5-flash-lite is a current cheap/fast model.
  return tier === "heavy" ? (e.GEMINI_MODEL_HEAVY || e.GEMINI_MODEL || "gemini-3.5-flash-lite")
                          : (e.GEMINI_MODEL_LIGHT || e.GEMINI_MODEL || "gemini-3.5-flash-lite")
}

// Gather every available key (env + the client-provided body). Keys are classified by
// their SOURCE (env var / body field name) — NOT by prefix — so newer key formats work.
// (Google now issues Gemini keys as "AQ.…", not just "AIza…"; prefix-sniffing missed them.)
export function resolveKeys(body?: { claudeKey?: string; openrouterKey?: string; geminiKey?: string; groqKey?: string }): LlmKeys {
  const out: LlmKeys = {}
  const set = (p: Provider, raw?: string) => { const v = (raw || "").trim(); if (v && !out[p]) out[p] = v }
  const e = process.env
  set("anthropic", e.ANTHROPIC_API_KEY)
  set("openrouter", e.OPENROUTER_API_KEY)
  set("gemini", e.GEMINI_API_KEY || e.GOOGLE_API_KEY || e.GOOGLE_GENAI_API_KEY)
  set("groq", e.GROQ_API_KEY)
  set("anthropic", body?.claudeKey)
  set("openrouter", body?.openrouterKey)
  set("gemini", body?.geminiKey)
  set("groq", body?.groqKey)
  return out
}

export function hasAnyKey(keys: LlmKeys): boolean { return !!(keys.anthropic || keys.openrouter || keys.gemini || keys.groq || keys.openai) }

// ── The OpenAI key is kept apart from the others ─────────────────────────────
// The owner's instruction (2026-10-05): use GPT Luna, "for Resume tailoring only for now", "for my admin account only".
// So resolveKeys() never returns this key and the automatic provider order never includes OpenAI. The one way to an OpenAI
// call is tailorKeys(), which the callers of the resume tailor use, and it hands the key over only for the people
// OPENAI_TAILOR_FOR allows: "owner" (the default: an admin email or a listed owner WhatsApp number), "all", or "off".
export function tailorKeys(keys: LlmKeys, who: { owner: boolean }): LlmKeys {
  const key = (process.env.OPENAI_API_KEY || "").trim()
  if (!key || keys.openai) return keys
  const scope = (process.env.OPENAI_TAILOR_FOR || "owner").trim().toLowerCase()
  return scope === "all" || (scope === "owner" && who.owner) ? { ...keys, openai: key } : keys
}

// The order an automatic call asks the providers in. OpenAI is deliberately in neither list: see tailorKeys().
const AUTO_ORDER: Record<Tier, Provider[]> = {
  light: ["gemini", "groq", "openrouter", "anthropic"],   // simple tasks: free/cheap first
  heavy: ["gemini", "groq", "anthropic", "openrouter"],   // tailoring: free first, Claude as paid fallback
}

// Choose the provider+key for a tier. Honor an explicit preference when its key
// exists; otherwise fall back through the tier's default order.
export function pickProvider(keys: LlmKeys, tier: Tier, pref: ProviderPref = "auto"): { provider: Provider; key: string } | null {
  if (pref !== "auto" && keys[pref]) return { provider: pref, key: keys[pref]! }
  for (const p of AUTO_ORDER[tier]) if (keys[p]) return { provider: p, key: keys[p]! }
  return null
}

export type ChatMessage = { role: "user" | "assistant"; content: string }

// Token accounting for one call. cacheRead tokens bill at ~10% of input, so a high
// cacheRead share on repeat tailors of the same resume is the main cost win.
export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number }

interface CallOpts {
  keys: LlmKeys; tier: Tier; pref?: ProviderPref; system: string; maxTokens: number
  // Either a plain user string OR a multi-turn messages array. Prefer `messages` for chat.
  user?: string
  messages?: ChatMessage[]
  // Stable, reusable context (e.g. the resume being tailored) placed in a SEPARATE
  // cached block after the system prompt. Anthropic caches [system + cacheContext] as
  // one prefix, so tailoring the SAME resume against many JDs re-reads it at ~10% cost
  // instead of re-sending it every time. Other providers just append it to the system.
  cacheContext?: string
  // Force a specific model (used by the tailoring escalation ladder). Applied only
  // when the resolved provider is Anthropic and the id looks like a Claude model —
  // an OpenRouter/Gemini call can't run a bare "claude-*" id, so it falls back to
  // the tier default there.
  model?: string
  // Use exactly this model id, on the provider `pref` names. The tailor sets it for each of its lanes: several models of one
  // provider are separate lanes there, because a provider counts its per-minute limit per model.
  exactModel?: string
  // Sampling temperature. Low (≈0.2) for tailoring so keyword coverage & the
  // escalation decision are CONSISTENT run-to-run (default sampling gave 93–98%
  // coverage and 25–73s swings on identical input). Omit for chatty/creative uses.
  temperature?: number
  // Optional sink: each call pushes its token usage here so the caller can total the
  // real cost of a whole tailor (and prove the cache is working).
  usageSink?: TokenUsage[]
}

// Hard per-call timeout. Without it, a throttled/hung provider request has no
// deadline and can consume the entire serverless function budget (Vercel kills the
// whole request at 60s → the user gets nothing). Aborting a single slow call lets
// best-of pick a surviving draw and the ladder fall through, instead of hanging.
const LLM_CALL_TIMEOUT_MS = Number(process.env.LLM_CALL_TIMEOUT_MS) || 35000
function callSignal(): AbortSignal {
  return AbortSignal.timeout(LLM_CALL_TIMEOUT_MS)
}

// POST with automatic retry on rate-limit / overload. Concurrent use of the app (many
// tabs/devices at once) fires several LLM calls in the same minute, which trips the
// provider's per-minute rate limit → 429 (or 529 "overloaded"). Instead of failing the
// tailor, wait a short backoff (honoring Retry-After when present) and retry a couple
// times. 429/529 responses come back fast, so this adds only a few seconds under load.
async function fetchRetry(url: string, init: RequestInit): Promise<Response> {
  const RETRIABLE = new Set([429, 529, 503])
  // Total time one call may spend WAITING between retries. A short blip (a burst of concurrent
  // tailors) clears in a second or two. A long rate-limit window, like Groq's free-tier
  // tokens-per-minute wall (one resume prompt nearly fills it), won't clear in time: waiting
  // it out stretched tailors to 51-56s. So return the 429 at once and let the ladder use
  // another provider.
  const RETRY_BUDGET_MS = Number(process.env.LLM_RETRY_BUDGET_MS) || 5000
  let waited = 0
  const signal = callSignal() // One deadline across retries, not a fresh timeout per attempt.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, signal })
    if (res.ok || attempt >= 3 || !RETRIABLE.has(res.status)) return res
    const retryAfter = Number(res.headers.get("retry-after")) || 0
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1) * (attempt + 1)
    if (waited + waitMs > RETRY_BUDGET_MS) return res
    waited += waitMs
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return }
      const abort = () => { clearTimeout(timer); reject(signal.reason) }
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve() }, waitMs)
      signal.addEventListener("abort", abort, { once: true })
    })
  }
}

// One LLM call. Returns the assistant text plus which provider/model served it.
// Throws Error("<Provider> API <status>: …") on a non-2xx.
//
// With a named provider (`pref`), that provider is the only one asked. With "auto", the providers that have a key are asked in
// the tier's order until one answers. Before 2026-10-05 an automatic call asked only the first provider with a key, so while
// Gemini was out of credit every automatic call failed (keyword expansion, the role and company on a WhatsApp reply, every
// single-field edit), although Groq was answering the whole time.
export async function callLLM(opts: CallOpts): Promise<{ text: string; provider: Provider; model: string }> {
  const pref = opts.pref || "auto"
  const first = pickProvider(opts.keys, opts.tier, pref)
  if (!first) throw new Error("No API key configured. Add a Claude, OpenRouter, or Gemini key in Settings.")
  const named = pref !== "auto" && !!opts.keys[pref]
  let order: Provider[] = [first.provider]
  if (!named) {
    const now = Date.now()
    const keyed = AUTO_ORDER[opts.tier].filter(p => !!opts.keys[p])
    order = [...keyed.filter(p => (downUntil.get(p) || 0) <= now), ...keyed.filter(p => (downUntil.get(p) || 0) > now)]
  }
  // Normalise to a messages array so providers always get structured turns.
  const msgs: ChatMessage[] = opts.messages ?? [{ role: "user", content: opts.user ?? "" }]
  let lastErr: unknown = null
  for (const provider of order) {
    const key = opts.keys[provider]!
    const model = named && opts.exactModel ? opts.exactModel
      : (opts.model && provider === "anthropic" && /^claude/i.test(opts.model)) ? opts.model
      : modelFor(provider, opts.tier)
    try {
      const text = provider === "anthropic" ? await callAnthropic(key, model, opts, msgs)
        : provider === "openrouter" ? await callOpenRouter(key, model, opts, msgs)
        : provider === "groq" ? await callGroq(key, model, opts, msgs)
        : provider === "openai" ? await callOpenAI(key, model, opts, msgs)
        : await callGemini(key, model, opts, msgs)
      downUntil.delete(provider)
      // For OpenAI, report the id that answered: it may be the account's own name for the model that was asked for.
      return { text, provider, model: provider === "openai" ? openaiAlias.get(model) || model : model }
    } catch (e) {
      lastErr = e
      if (WONT_CLEAR.test(String((e as Error)?.message || e))) downUntil.set(provider, Date.now() + 5 * 60_000)
    }
  }
  throw lastErr
}

// A provider that refused with something that will not clear by itself in the next minutes (no credit, a rejected key, a model
// that does not exist) is remembered for five minutes per server instance, and an automatic call asks it last. It is still
// asked when nothing else answers, so it comes back by itself once it is fixed.
const downUntil = new Map<Provider, number>()
const WONT_CLEAR = /API (400|401|402|403|404)\b/
/** For tests. */
export function forgetProviderFailures() { downUntil.clear() }

async function callAnthropic(key: string, model: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  // Two cached blocks: the stable RULES prompt AND (when present) the resume. Both are
  // re-read at ~10% cost on the next call that shares the same prefix — which is every
  // subsequent tailor of the SAME resume, the common batch-applying workflow.
  const system = o.cacheContext
    ? [
        { type: "text", text: o.system, cache_control: { type: "ephemeral" } },
        { type: "text", text: o.cacheContext, cache_control: { type: "ephemeral" } },
      ]
    : [{ type: "text", text: o.system, cache_control: { type: "ephemeral" } }]
  const res = await fetchRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: o.maxTokens,
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      system,
      messages: msgs.map(m => ({ role: m.role, content: m.content })),
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const u = data.usage || {}
  o.usageSink?.push({
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  })
  return (data.content || []).map((b: { text?: string }) => b.text || "").join("")
}

async function callOpenRouter(key: string, model: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  // OpenRouter bills the requested ceiling against the balance — keep it modest.
  const cap = Math.min(o.maxTokens, Number(process.env.OPENROUTER_MAX_TOKENS) || 2048)
  const res = await fetchRetry("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "authorization": `Bearer ${key}`, "content-type": "application/json", "x-title": "MarketFit" },
    body: JSON.stringify({
      model, max_tokens: cap,
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      // Measured 2026-10-05 on nvidia/nemotron-3-super-120b-a12b:free: with reasoning on, a two-bullet rewrite spent 228 of its
      // 312 output tokens reasoning and took 6.5 s; with it off, 76 tokens and 0.6 s, the same JSON.
      ...(/nemotron/i.test(model) ? { reasoning: { enabled: false } } : {}),
      messages: [
        { role: "system", content: o.cacheContext ? `${o.system}\n\n${o.cacheContext}` : o.system },
        ...msgs.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const u = data.usage || {}
  o.usageSink?.push({ input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cacheRead: 0, cacheWrite: 0 })
  return data.choices?.[0]?.message?.content || ""
}

// Groq — OpenAI-compatible chat API, very fast.
//
// Two things decide whether a free-tier call gives an answer, both measured on this account on 2026-10-05:
//  1. Each model has its own tokens-per-minute allowance (8,000 on the free tier) and Groq charges a request its prompt PLUS
//     the reply ceiling it asks for. So the ceiling is what is left of the allowance after the prompt, not a fixed number.
//  2. The gpt-oss models reason before they answer and the reasoning is paid from the same ceiling. With the old fixed
//     ceiling of 1,500 a resume rewrite came back "200 OK" with 1,498 reasoning tokens and an empty answer, every time: that,
//     more than the rate limit, is why the free path returned a resume with nothing changed. "low" brought a two-bullet
//     rewrite from 286 reasoning tokens to 11. (qwen/qwen3.8-27b does not reason unless asked, so it gets no such field.)
// GROQ_MAX_TOKENS still fixes the ceiling for an account on a paid tier; GROQ_TPM names a different allowance.
async function callGroq(key: string, model: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  const system = o.cacheContext ? `${o.system}\n\n${o.cacheContext}` : o.system
  const promptChars = system.length + msgs.reduce((n, m) => n + m.content.length, 0)
  const allowance = Number(process.env.GROQ_TPM) || 8000
  const room = allowance - Math.ceil(promptChars / 3.2) - 250   // 3.2 characters a token overestimates English prose a little
  const cap = Math.min(o.maxTokens, Number(process.env.GROQ_MAX_TOKENS) || Math.max(1024, room))
  const res = await fetchRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "authorization": `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: cap,
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      ...(/^openai\/gpt-oss/i.test(model) ? { reasoning_effort: "low" } : {}),
      messages: [
        { role: "system", content: system },
        ...msgs.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) throw new Error(`Groq API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const u = data.usage || {}
  o.usageSink?.push({ input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cacheRead: 0, cacheWrite: 0 })
  return data.choices?.[0]?.message?.content || ""
}

// OpenAI (resume tailoring only: see tailorKeys).
//
// The key this runs on could not be tried when the code was written (the owner adds it to the deployment himself), and OpenAI's
// models differ in which request fields they take: a reasoning model refuses a temperature other than its default, some refuse
// reasoning_effort, older ones want max_tokens. So a 400 that names one of those fields drops or swaps that field and asks
// again, and a model id the account does not have is looked up once in the account's own model list ("gpt-6-luna" was taken
// from a public price list, not from OpenAI). What was learned is kept per server instance.
const openaiRefused = new Map<string, Set<string>>()   // model id → request fields it refused
const openaiAlias = new Map<string, string>()          // the id asked for → the id this account has
const OPENAI_FIELDS = ["temperature", "reasoning_effort", "max_completion_tokens"]
/** For tests. */
export function forgetOpenAILearning() { openaiRefused.clear(); openaiAlias.clear() }

/** Among an account's model ids, the one that best stands for `wanted`: the same family word ("luna"), newest version, no variant suffix. */
export function closestOpenAIModel(wanted: string, ids: string[]): string | null {
  const family = (/([a-z]+)$/i.exec(wanted) || [])[1]?.toLowerCase()
  if (!family || /^(gpt|preview|latest|mini|nano|pro)$/.test(family)) return null
  const shaped = new RegExp(`^gpt-([\\d.]+)-${family}(-\\d{4}-\\d{2}-\\d{2})?$`, "i")
  const hits = ids.map(id => ({ id, m: shaped.exec(id) })).filter(x => x.m)
    .map(x => ({ id: x.id, version: Number(x.m![1]) || 0, dated: !!x.m![2] }))
    .sort((a, b) => b.version - a.version || Number(a.dated) - Number(b.dated) || b.id.localeCompare(a.id))
  return hits[0]?.id || null
}

async function callOpenAI(key: string, wanted: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  const headers = { "authorization": `Bearer ${key}`, "content-type": "application/json" }
  let model = openaiAlias.get(wanted) || wanted
  for (let attempt = 0; ; attempt++) {
    const refused = openaiRefused.get(model) || new Set<string>()
    const body: Record<string, unknown> = {
      model,
      // Reasoning, where a model does it, is paid from this ceiling: ask for little of it and leave the reply its room.
      max_completion_tokens: o.maxTokens,
      reasoning_effort: "low",
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      messages: [
        { role: "system", content: o.cacheContext ? `${o.system}\n\n${o.cacheContext}` : o.system },
        ...msgs.map(m => ({ role: m.role, content: m.content })),
      ],
    }
    for (const field of refused) delete body[field]
    if (refused.has("max_completion_tokens")) body.max_tokens = o.maxTokens
    const res = await fetchRetry("https://api.openai.com/v1/chat/completions", { method: "POST", headers, body: JSON.stringify(body) })
    if (res.ok) {
      const data = await res.json()
      const u = data.usage || {}
      const cached = u.prompt_tokens_details?.cached_tokens || 0
      o.usageSink?.push({ input: Math.max(0, (u.prompt_tokens || 0) - cached), output: u.completion_tokens || 0, cacheRead: cached, cacheWrite: 0 })
      return data.choices?.[0]?.message?.content || ""
    }
    const raw = await res.text()
    let err: { message?: string; param?: string; code?: string } = {}
    try { err = (JSON.parse(raw) as { error?: typeof err }).error || {} } catch { /* not JSON: reported as it came */ }
    // Only a refusal of the field itself counts ("Unsupported parameter", "Unsupported value", "Unrecognized request argument").
    // A complaint about the field's VALUE (a ceiling below the minimum) is a real error and is reported as one.
    const unsupported = /unsupported|unrecognized|unknown/i.test(`${err.code || ""} ${err.message || ""}`) || /not supported/i.test(err.message || "")
    const field = unsupported ? OPENAI_FIELDS.find(f => err.param === f || (!err.param && (err.message || "").includes(f))) : undefined
    if (attempt < 4 && res.status === 400 && field && !refused.has(field)) {
      openaiRefused.set(model, new Set([...refused, field]))
      continue
    }
    if (attempt < 4 && (res.status === 404 || err.code === "model_not_found") && !openaiAlias.has(wanted)) {
      const list = await fetchRetry("https://api.openai.com/v1/models", { method: "GET", headers })
      const ids: string[] = list.ok ? ((await list.json()).data || []).map((m: { id?: string }) => String(m.id || "")) : []
      const found = closestOpenAIModel(wanted, ids)
      if (found && found !== model) { openaiAlias.set(wanted, found); model = found; continue }
    }
    throw new Error(`OpenAI API ${res.status}: ${raw.slice(0, 200)}`)
  }
}

async function callGemini(key: string, model: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  // Gemini uses "model" (not "assistant") for the non-user role.
  const contents = msgs.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  const res = await fetchRetry(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: o.cacheContext ? `${o.system}\n\n${o.cacheContext}` : o.system }] },
      contents,
      generationConfig: { maxOutputTokens: o.maxTokens, temperature: o.temperature ?? 0.7 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const m = data.usageMetadata || {}
  o.usageSink?.push({ input: m.promptTokenCount || 0, output: m.candidatesTokenCount || 0, cacheRead: m.cachedContentTokenCount || 0, cacheWrite: 0 })
  const parts = data.candidates?.[0]?.content?.parts || []
  return parts.map((p: { text?: string }) => p.text || "").join("")
}
