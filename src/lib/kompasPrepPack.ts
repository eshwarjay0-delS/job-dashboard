// Prevents a prep pack the model did write from being thrown away for its wrapping. The prep route parsed the reply with a
// bare JSON.parse, so a reply in ```json fences or after one line of prose failed the whole session's prep the same way a
// reply cut off at the token ceiling did, and the route said only "Prep failed". This reads the object out of the reply and,
// when there is none, says why (cut off, or no JSON at all), so the reason reaches the log.

export type PrepPackResult = { ok: true; pack: Record<string, unknown> } | { ok: false; reason: string }

export function parsePrepPack(text: string): PrepPackResult {
  const raw = String(text || "").trim()
  if (!raw) return { ok: false, reason: "empty reply" }
  const unfenced = raw.replace(/^```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim()
  const start = unfenced.indexOf("{")
  if (start < 0) return { ok: false, reason: "no JSON object in the reply" }
  const end = unfenced.lastIndexOf("}")
  if (end < start) return { ok: false, reason: `reply cut off after ${raw.length} characters` }
  let pack: unknown
  try { pack = JSON.parse(unfenced.slice(start, end + 1)) }
  catch { return { ok: false, reason: `reply is not complete JSON (${raw.length} characters, likely cut off)` } }
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) return { ok: false, reason: "reply JSON is not an object" }
  if (!Array.isArray((pack as Record<string, unknown>).questions)) return { ok: false, reason: "reply has no questions list" }
  return { ok: true, pack: pack as Record<string, unknown> }
}

// What the route may say about a failure: a parse reason as written above, or a provider's name and HTTP status cut from
// its error ("OpenRouter API 429"). Never the provider's message body, which can echo the prompt.
export function prepFailureReason(e: unknown): string {
  const m = String((e as Error)?.message || e || "")
  const api = m.match(/^([A-Za-z]+ API \d{3})/)
  if (api) return api[1]
  if (/abort|timeout/i.test(m)) return "provider timed out"
  if (/^(empty reply|no JSON object|reply )/.test(m)) return m.slice(0, 120)
  if (/No API key/i.test(m)) return "no provider key"
  return "unexpected error"
}
