// What a person is told when something could not be done: one plain sentence with the real reason, never the machinery.
//
// Asked on 13 Oct 2026, after the chat printed a failure as it came off the wire ("The agent hit an error: Groq API 429:
// {"error":{"message":"Rate limit reached for model ... in organization org_..."): "We should not show any failpoints,
// at least give minimal of real info." So the real reason is kept, in a few words a person can act on, and the rest
// (the service's own text, an organisation id) goes to the server log and nowhere else.
//
// The same afternoon the first version of this answered him "I could not answer this time", which said nothing: the
// reason was not one of the four it knew, and only the last service's refusal was looked at when several had been
// asked. Now every service that was asked counts (`tried`, set by callLLM), there are more reasons, and the owner of
// the site is also shown which service answered with which status ("Groq 413"): two words, no text of theirs.

export type FailureKind = "too_long" | "busy" | "no_credit" | "not_set_up" | "fault" | "slow" | "unreachable" | "other"

const TOO_LONG = /request too large|too large for|context.{0,12}length|maximum context|too many tokens|reduce the length|prompt is too long|payload too large/i
const BUSY = /rate.?limit|quota|tokens? per|\bTP[DM]\b|\bRP[DM]\b|overloaded|capacity|resource.?exhausted|too many requests|allowance/i
const NO_CREDIT = /credit balance|insufficient.{0,12}(?:credit|fund|balance|quota)|billing|payment required|out of credit/i
const NOT_SET_UP = /no api key configured|no ai (?:provider )?key|invalid.{0,20}key|key.{0,12}not valid|incorrect api key|unauthori[sz]ed|permission denied|not enabled|model.{0,30}(?:not found|does not exist|decommissioned)/i
const SLOW = /time.?out|timed out|abort|deadline|ETIMEDOUT|took too long/i
const UNREACHABLE = /ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed|network|socket hang up/i

const textOf = (err: unknown): string => (err instanceof Error ? `${err.name} ${err.message}` : String(err ?? ""))
/** The services that were asked and the status each answered with, as callLLM leaves them on the error: "groq 413". */
const triedOf = (err: unknown): string[] => {
  const list = (err as { tried?: unknown } | null)?.tried
  return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string").slice(0, 8) : []
}
const statusesOf = (err: unknown): number[] => {
  const fromTried = triedOf(err).map(t => Number((/\b(\d{3})$/.exec(t) || [])[1])).filter(Boolean)
  const own = Number((/API (\d{3})\b/.exec(textOf(err)) || [])[1])
  return own && !fromTried.includes(own) ? [...fromTried, own] : fromTried
}

/**
 * Which of the few reasons a person can act on this failure is. When several services were asked, the reason is the one
 * most worth telling: what the person can change now comes first, then what clears by itself, then what the owner fixes.
 */
export function failureKind(err: unknown): FailureKind {
  const text = textOf(err), statuses = statusesOf(err)
  const any = (...codes: number[]) => statuses.some(s => codes.includes(s))
  if (any(413) || TOO_LONG.test(text)) return "too_long"
  if (any(429, 503, 529) || BUSY.test(text)) return "busy"
  if (any(402) || NO_CREDIT.test(text)) return "no_credit"
  if (any(401, 403, 404) || NOT_SET_UP.test(text)) return "not_set_up"
  if (SLOW.test(text)) return "slow"
  if (UNREACHABLE.test(text)) return "unreachable"
  if (any(500, 502, 504)) return "fault"
  return "other"
}

/**
 * One plain sentence for the person. `could` finishes "I could not ...": "answer", "tailor your resume".
 * `changed` says whether anything was already done before the failure; when nothing was, the person is told so.
 */
export function plainFailure(err: unknown, could = "answer", changed = false): string {
  const kind = failureKind(err)
  const nothing = changed ? "" : " Nothing was changed."
  if (kind === "too_long") return `I could not ${could}: there was more to read than the AI service takes at once.${nothing} Ask about one company or one job at a time.`
  if (kind === "busy") return `I could not ${could} just now: the AI service is at its limit for the moment.${nothing} Try again in a few minutes.`
  if (kind === "no_credit") return `I could not ${could}: the AI service has run out of credit.${nothing} The owner of this site can top it up, or switch another one on from the Admin page.`
  if (kind === "not_set_up") return `I could not ${could}: no AI service is switched on for this yet. The owner of this site can switch one on from the Admin page.`
  if (kind === "slow") return `I could not ${could}: it took too long, so I stopped.${nothing} Try again, or ask for one thing at a time.`
  if (kind === "unreachable") return `I could not ${could}: the AI service could not be reached.${nothing} Try again in a moment.`
  if (kind === "fault") return `I could not ${could}: the AI service had a fault of its own.${nothing} Try again in a moment.`
  // Not one of the reasons above (it may not be an AI service at all): nothing truer can be said than this.
  return `I could not ${could} this time.${nothing} Try again in a moment.`
}

const NAMES: Record<string, string> = { groq: "Groq", gemini: "Gemini", openai: "OpenAI", openrouter: "OpenRouter", anthropic: "Anthropic" }
/**
 * For the owner of the site only: which service answered with which status, and nothing else. "Groq 413, Gemini 429".
 * Empty when it is not known. Never a word of the service's own text, so nothing of a key or an account can be in it.
 */
export function failureTag(err: unknown): string {
  const seen = triedOf(err).map(t => /^([a-z]+) (\d{3}|failed)$/.exec(t)).filter((m): m is RegExpExecArray => !!m).map(m => `${NAMES[m[1]] || m[1]} ${m[2] === "failed" ? "no answer" : m[2]}`)
  if (seen.length) return [...new Set(seen)].join(", ")
  const own = /\b(Anthropic|OpenRouter|Groq|OpenAI|Gemini) API (\d{3})\b/.exec(textOf(err))
  return own ? `${own[1]} ${own[2]}` : ""
}

/** Is it worth asking once more straight away? Only for what clears by itself in a moment. */
export const worthAnotherTry = (err: unknown): boolean => ["busy", "fault", "unreachable", "other"].includes(failureKind(err))
