// ── Multi-provider LLM layer ──────────────────────────────────────────────────
// Supports Anthropic (Claude), OpenRouter, and Google Gemini. The provider is
// auto-detected from the API-key prefix, and calls are routed by TASK TIER:
//   • "light"  (simple edits — single field assists)  → cheap/free first: Gemini → OpenRouter → Anthropic
//   • "heavy"  (full resume tailoring)                  → quality first:    Anthropic → OpenRouter → Gemini
// A UI preference can pin a specific provider per tier; "auto" uses the order above.

export type Provider = "anthropic" | "openrouter" | "gemini"
export type ProviderPref = Provider | "auto"
export type Tier = "heavy" | "light"
export interface LlmKeys { anthropic?: string; openrouter?: string; gemini?: string }

// Identify the provider that issued a key purely from its prefix — so it works no
// matter which env var or Settings field it was pasted into.
export function providerOfKey(raw?: string): Provider | null {
  const k = (raw || "").trim()
  if (!k) return null
  if (k.startsWith("sk-ant-")) return "anthropic"
  if (k.startsWith("sk-or-")) return "openrouter"
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
  return tier === "heavy" ? (e.GEMINI_MODEL_HEAVY || e.GEMINI_MODEL || "gemini-2.0-flash")
                          : (e.GEMINI_MODEL_LIGHT || e.GEMINI_MODEL || "gemini-2.0-flash")
}

// Gather every available key (env + the client-provided body). Keys are classified by
// their SOURCE (env var / body field name) — NOT by prefix — so newer key formats work.
// (Google now issues Gemini keys as "AQ.…", not just "AIza…"; prefix-sniffing missed them.)
export function resolveKeys(body?: { claudeKey?: string; openrouterKey?: string; geminiKey?: string }): LlmKeys {
  const out: LlmKeys = {}
  const set = (p: Provider, raw?: string) => { const v = (raw || "").trim(); if (v && !out[p]) out[p] = v }
  const e = process.env
  set("anthropic", e.ANTHROPIC_API_KEY)
  set("openrouter", e.OPENROUTER_API_KEY)
  set("gemini", e.GEMINI_API_KEY || e.GOOGLE_API_KEY || e.GOOGLE_GENAI_API_KEY)
  set("anthropic", body?.claudeKey)
  set("openrouter", body?.openrouterKey)
  set("gemini", body?.geminiKey)
  return out
}

export function hasAnyKey(keys: LlmKeys): boolean { return !!(keys.anthropic || keys.openrouter || keys.gemini) }

// Choose the provider+key for a tier. Honor an explicit preference when its key
// exists; otherwise fall back through the tier's default order.
export function pickProvider(keys: LlmKeys, tier: Tier, pref: ProviderPref = "auto"): { provider: Provider; key: string } | null {
  if (pref !== "auto" && keys[pref]) return { provider: pref, key: keys[pref]! }
  const order: Provider[] = tier === "light"
    ? ["gemini", "openrouter", "anthropic"]   // simple tasks: free/cheap first
    : ["anthropic", "openrouter", "gemini"]   // tailoring: quality first
  for (const p of order) if (keys[p]) return { provider: p, key: keys[p]! }
  return null
}

export type ChatMessage = { role: "user" | "assistant"; content: string }

interface CallOpts {
  keys: LlmKeys; tier: Tier; pref?: ProviderPref; system: string; maxTokens: number
  // Either a plain user string OR a multi-turn messages array. Prefer `messages` for chat.
  user?: string
  messages?: ChatMessage[]
  // Force a specific model (used by the tailoring escalation ladder). Applied only
  // when the resolved provider is Anthropic and the id looks like a Claude model —
  // an OpenRouter/Gemini call can't run a bare "claude-*" id, so it falls back to
  // the tier default there.
  model?: string
  // Sampling temperature. Low (≈0.2) for tailoring so keyword coverage & the
  // escalation decision are CONSISTENT run-to-run (default sampling gave 93–98%
  // coverage and 25–73s swings on identical input). Omit for chatty/creative uses.
  temperature?: number
}

// One LLM call. Returns the assistant text plus which provider/model served it.
// Throws Error("<Provider> API <status>: …") on a non-2xx.
export async function callLLM(opts: CallOpts): Promise<{ text: string; provider: Provider; model: string }> {
  const chosen = pickProvider(opts.keys, opts.tier, opts.pref || "auto")
  if (!chosen) throw new Error("No API key configured. Add a Claude, OpenRouter, or Gemini key in Settings.")
  const { provider, key } = chosen
  const model = (opts.model && provider === "anthropic" && /^claude/i.test(opts.model))
    ? opts.model
    : modelFor(provider, opts.tier)
  // Normalise to a messages array so providers always get structured turns.
  const msgs: ChatMessage[] = opts.messages ?? [{ role: "user", content: opts.user ?? "" }]
  const text = provider === "anthropic" ? await callAnthropic(key, model, opts, msgs)
    : provider === "openrouter" ? await callOpenRouter(key, model, opts, msgs)
    : await callGemini(key, model, opts, msgs)
  return { text, provider, model }
}

async function callAnthropic(key: string, model: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: o.maxTokens,
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      system: [{ type: "text", text: o.system, cache_control: { type: "ephemeral" } }],
      messages: msgs.map(m => ({ role: m.role, content: m.content })),
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return (data.content || []).map((b: { text?: string }) => b.text || "").join("")
}

async function callOpenRouter(key: string, model: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  // OpenRouter bills the requested ceiling against the balance — keep it modest.
  const cap = Math.min(o.maxTokens, Number(process.env.OPENROUTER_MAX_TOKENS) || 2048)
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "authorization": `Bearer ${key}`, "content-type": "application/json", "x-title": "MarketFit" },
    body: JSON.stringify({
      model, max_tokens: cap,
      ...(o.temperature != null ? { temperature: o.temperature } : {}),
      messages: [
        { role: "system", content: o.system },
        ...msgs.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ""
}

async function callGemini(key: string, model: string, o: CallOpts, msgs: ChatMessage[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  // Gemini uses "model" (not "assistant") for the non-user role.
  const contents = msgs.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: o.system }] },
      contents,
      generationConfig: { maxOutputTokens: o.maxTokens, temperature: o.temperature ?? 0.7 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  return parts.map((p: { text?: string }) => p.text || "").join("")
}
